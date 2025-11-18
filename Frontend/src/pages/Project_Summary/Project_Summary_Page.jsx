// src/pages/Project_Summary/Project_Summary_Page.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import ManagerSummaryPanel from '../AI_Summary/ManagerSummaryPanel';
import API_BASE_URL from '../../config/api';
import buildHeaders from '../../config/fetcher';
import { formatSecondsHm } from '../../utils/time';

const ProjectSummaryPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState('Project');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [projectBudget, setProjectBudget] = useState('');
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');
  const [hourlyRate, setHourlyRate] = useState(0);

  // Try to resolve project name from cached projects in session storage set by Dashboard
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('hg_projects');
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const found = arr.find(p => String(p._id || '') === String(projectId));
        if (found && (found.name || found.ProjectName)) setProjectName(found.name || found.ProjectName);
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [projectId]);

  // Fetch all time entries for the project
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setFetchError('');
      try {
        const res = await fetch(`${API_BASE_URL}/api/time-entries/project/${encodeURIComponent(projectId)}` , { credentials: 'include', headers: buildHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (mounted) {
            setFetchError(data && (data.msg || data.error) ? (data.msg || data.error) : `Server returned ${res.status}`);
            setEntries([]);
          }
          return;
        }

        // Collect all entries across employees (manager view) or fallback shapes
        let allEntries = [];
        if (data && data.isManager && Array.isArray(data.employeeStats)) {
          for (const emp of data.employeeStats) {
            if (emp && Array.isArray(emp.entries)) allEntries.push(...emp.entries);
          }
        } else if (Array.isArray(data.entries)) {
          allEntries = data.entries;
        } else if (Array.isArray(data)) {
          allEntries = data;
        }

        if (mounted) {
          setEntries(allEntries);
        }
      } catch (err) {
        if (mounted) {
          setFetchError(String(err));
          setEntries([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  // Flatten intervals and compute totals across the project
  const { flattened, totals } = useMemo(() => {
    const flat = [];
    let billable = 0, nonbill = 0, ambiguous = 0, total = 0;
    for (const entry of entries || []) {
      const username = entry.username || entry.user || entry.owner || '';
      const appointments = Array.isArray(entry.appointments) ? entry.appointments : [];
      for (const apt of appointments) {
        const apptitle = apt.apptitle || apt.appname || 'Session';
        const appname = apt.appname || apptitle || 'Unknown';
        const isBillable = !!apt.isBillable;
        const suggested = apt.suggestedCategory || apt.suggested || 'ambiguous';
        const intervals = Array.isArray(apt.timeIntervals) ? apt.timeIntervals : [];
        for (const iv of intervals) {
          const dur = Number(iv.duration) || 0;
          flat.push({
            id: `${entry._id || entry.id || username}_${appname}_${iv.startTime || ''}_${iv.endTime || ''}`,
            username,
            apptitle,
            appname,
            startTime: iv.startTime,
            endTime: iv.endTime,
            duration: dur,
            isBillable,
            suggestedCategory: suggested
          });
          total += dur;
          if (isBillable) billable += dur;
          else if ((suggested || '').toLowerCase().startsWith('non')) nonbill += dur;
          else ambiguous += dur;
        }
      }
    }
    return { flattened: flat, totals: { billable, nonbill, ambiguous, total } };
  }, [entries]);

  // Member payment table data
  const memberPaymentData = useMemo(() => {
    const memberMap = {};
    for (const iv of flattened || []) {
      const username = iv.username || 'Unknown';
      if (!memberMap[username]) {
        memberMap[username] = { username, billableSeconds: 0 };
      }
      if (iv.isBillable) {
        memberMap[username].billableSeconds += iv.duration || 0;
      }
    }
    return Object.values(memberMap).sort((a, b) => b.billableSeconds - a.billableSeconds);
  }, [flattened]);

  // Manager AI summary (project-level)
  const postDailySummary = async (date) => {
    setAiError('');
    setAiLoading(true);
    try {
      const body = { projectId };
      if (date) body.date = date;
      const res = await fetch(`${API_BASE_URL}/api/time-entries/daily-summary/manager`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data && data.error ? data.error : `Server returned ${res.status}`);
        setAiSummary(null);
      } else {
        setAiSummary(data);
      }
    } catch (err) {
      setAiError(String(err));
      setAiSummary(null);
    } finally {
      setAiLoading(false);
    }
  };

  const getAiSummary = async (date) => {
    setAiError('');
    setAiLoading(true);
    try {
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      const url = `${API_BASE_URL}/api/time-entries/ai-summary/manager/${encodeURIComponent(projectId)}${q}`;
      const res = await fetch(url, { credentials: 'include', headers: buildHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data && data.error ? data.error : `Server returned ${res.status}`);
        setAiSummary(null);
      } else {
        setAiSummary(data);
      }
    } catch (err) {
      setAiError(String(err));
      setAiSummary(null);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg text-gray-200">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-brand-bg text-gray-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center justify-center gap-2 border border-cyan text-cyan font-semibold py-2 px-5 rounded-lg hover:bg-cyan hover:text-brand-bg transition-all duration-300 w-auto"
          >
            <RiArrowLeftLine className="text-xl transition-transform duration-300 group-hover:-translate-x-1" />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold text-center text-white">
            ✨ Project Summary{projectName ? `: ${projectName}` : ''}
          </h1>
          <div className="w-28" />
        </div>

        {/* Manager Summary Controls */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 mb-4">
          <label htmlFor="proj-ai-summary-date" className="text-sm text-gray-300">Date:</label>
          <input
            id="proj-ai-summary-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-surface text-gray-200 py-2 px-3 rounded-lg border border-surface"
          />
          <button
            onClick={() => postDailySummary(selectedDate)}
            className="bg-yellow-500 text-black font-semibold py-2 px-4 rounded-lg hover:brightness-90"
          >
            Generate Daily Summary
          </button>
          <button
            onClick={() => getAiSummary(selectedDate)}
            className="bg-cyan text-brand-bg font-semibold py-2 px-4 rounded-lg hover:bg-cyan-dark"
          >
            Load AI Summary
          </button>
        </div>

        {/* Error Message */}
        {fetchError && (
          <div className="flex-shrink-0 bg-red-800/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4">
            {fetchError}
          </div>
        )}

        {/* AI Summary / Server Response */}
        {(aiLoading || aiError || aiSummary) && (
          <div className="mb-4">
            {aiLoading && (
              <div className="bg-surface-light p-3 rounded-md text-gray-200">Working... contacting server</div>
            )}
            {aiError && (
              <div className="bg-red-800/50 border border-red-700 text-red-200 p-3 rounded-md mt-2">{aiError}</div>
            )}
            {aiSummary && (
              <div className="mt-2">
                <ManagerSummaryPanel data={aiSummary} />
              </div>
            )}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6 lg:overflow-y-auto pb-4 pr-2">
            {/* Member Payment Table */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-white">Member Payment</h2>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-400">Rate/hour:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value || 0))}
                    placeholder="0"
                    className="w-24 bg-surface-light text-gray-200 placeholder-gray-500 py-1 px-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface text-sm"
                  />
                  <span className="text-sm text-gray-400">INR</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-surface-light">
                    <tr>
                      <th className="py-3 px-4 text-gray-400 font-semibold">Member Name</th>
                      <th className="py-3 px-4 text-gray-400 font-semibold text-right">Billable Hours</th>
                      <th className="py-3 px-4 text-gray-400 font-semibold text-right">1 Hour Payment</th>
                      <th className="py-3 px-4 text-gray-400 font-semibold text-right">Total Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberPaymentData && memberPaymentData.length > 0 ? (
                      memberPaymentData.map((member) => {
                        const hours = member.billableSeconds / 3600;
                        const totalPay = hours * hourlyRate;
                        return (
                          <tr key={member.username} className="border-b border-surface-light hover:bg-surface-light transition-colors">
                            <td className="py-3 px-4 text-white font-medium">{member.username}</td>
                            <td className="py-3 px-4 text-cyan text-right">{hours.toFixed(2)} hrs</td>
                            <td className="py-3 px-4 text-gray-300 text-right">₹{hourlyRate.toFixed(2)}</td>
                            <td className="py-3 px-4 text-white font-semibold text-right">₹{totalPay.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-6 text-center text-gray-400">No member data available</td>
                      </tr>
                    )}
                  </tbody>
                  {memberPaymentData && memberPaymentData.length > 0 && (
                    <tfoot className="border-t-2 border-cyan">
                      <tr>
                        <td className="py-3 px-4 text-white font-bold">Total</td>
                        <td className="py-3 px-4 text-cyan font-bold text-right">
                          {(() => {
                            const totalSeconds = memberPaymentData.reduce((sum, m) => sum + m.billableSeconds, 0);
                            return (totalSeconds / 3600).toFixed(2);
                          })()} hrs
                        </td>
                        <td className="py-3 px-4"></td>
                        <td className="py-3 px-4 text-white font-bold text-right">
                          ₹{(() => {
                            const totalSeconds = memberPaymentData.reduce((sum, m) => sum + m.billableSeconds, 0);
                            const totalHours = totalSeconds / 3600;
                            return (totalHours * hourlyRate).toFixed(2);
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-6 lg:overflow-y-auto pb-4 pr-2">
            {/* Project Details Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Project Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Project Budget (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={projectBudget}
                    onChange={(e) => setProjectBudget(e.target.value)}
                    placeholder="Enter project budget"
                    className="w-full bg-surface-light text-gray-200 placeholder-gray-500 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={projectStartDate}
                      onChange={(e) => setProjectStartDate(e.target.value)}
                      className="w-full bg-surface-light text-gray-200 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">End Date</label>
                    <input
                      type="date"
                      value={projectEndDate}
                      onChange={(e) => setProjectEndDate(e.target.value)}
                      className="w-full bg-surface-light text-gray-200 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface"
                    />
                  </div>
                </div>
                {projectStartDate && projectEndDate && (
                  <div className="bg-surface-light p-3 rounded-lg">
                    <div className="text-sm text-gray-400">Project Duration</div>
                    <div className="text-lg font-semibold text-white mt-1">
                      {(() => {
                        const start = new Date(projectStartDate);
                        const end = new Date(projectEndDate);
                        const diffTime = Math.abs(end - start);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Summary Totals */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Time Summary</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Total hours</div>
                  <div className="text-2xl font-bold text-white">
                    {(() => { const sec = (totals && totals.total) || 0; return formatSecondsHm(sec); })()}
                  </div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Billable</div>
                  <div className="text-2xl font-bold text-white">
                    {(() => { const sec = (totals && totals.billable) || 0; return formatSecondsHm(sec); })()}
                  </div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Non-billable</div>
                  <div className="text-2xl font-bold text-white">
                    {(() => { const sec = (totals && totals.nonbill) || 0; return formatSecondsHm(sec); })()}
                  </div>
                </div>
              </div>
              {projectBudget && (
                <div className="mt-4 bg-surface-light p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-semibold text-gray-400">Budget Status</div>
                      <div className="text-lg font-bold text-white mt-1">₹{projectBudget}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Remaining</div>
                      <div className="text-lg font-bold text-cyan mt-1">
                        ₹{(() => {
                          const budget = Number(projectBudget) || 0;
                          const billableSec = (totals && totals.billable) || 0;
                          const spent = (billableSec / 3600) * 0; // Rate would need to be added
                          return (budget - spent).toFixed(2);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Remaining Tasks Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Project Tasks</h2>
              <div className="bg-surface-light p-4 rounded-lg">
                <div className="text-sm font-semibold text-gray-400 mb-2">Remaining Tasks</div>
                <textarea
                  rows="6"
                  placeholder="List remaining tasks for this project..."
                  className="w-full bg-surface text-gray-200 placeholder-gray-500 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface resize-none"
                />
                <div className="mt-3 text-xs text-gray-400">
                  Track pending tasks, milestones, or action items for this project
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSummaryPage;
