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
  const [memberRates, setMemberRates] = useState({});
  const [projectMembers, setProjectMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [project, setProject] = useState(null);
  const [isManager, setIsManager] = useState(false);
  const [tasks, setTasks] = useState([]);

  // Fetch current user and check permissions
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const userRes = await fetch(`${API_BASE_URL}/api/user/data`, {
          method: 'GET',
          credentials: 'include',
          headers: buildHeaders()
        });
        const userData = await userRes.json();
        if (!mounted) return;
        
        if (userData && userData.success && userData.userData) {
          setCurrentUser(userData.userData);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

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

  // Fetch project members and determine manager status
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`, { credentials: 'include', headers: buildHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !mounted) return;
        
        const members = data.members || [];
        const projectTasks = data.tasks || [];
        if (mounted) {
          setProject(data);
          setProjectMembers(members);
          setTasks(projectTasks);
          
          // Check if current user is manager or project creator
          if (currentUser && data) {
            const isManagerFlag = currentUser.role === 'manager' || currentUser.isManager === true;
            
            let isCreator = false;
            if (data.createdBy) {
              const creatorId = typeof data.createdBy === 'object' 
                ? (data.createdBy.username || data.createdBy.email || data.createdBy._id)
                : String(data.createdBy);
              
              const userId = currentUser.username || currentUser.email || currentUser._id;
              isCreator = String(creatorId).toLowerCase() === String(userId).toLowerCase();
            }
            
            setIsManager(isManagerFlag || isCreator);
          }
          
          // Initialize rates for new members
          setMemberRates(prev => {
            const updated = { ...prev };
            members.forEach(m => {
              const key = m.username || m.email || m._id || '';
              if (key && !updated[key]) {
                updated[key] = 0;
              }
            });
            return updated;
          });
        }
      } catch (err) {
        console.error('Error fetching project members:', err);
      }
    })();
    return () => { mounted = false; };
  }, [projectId, currentUser]);

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
    
    // First, add all project members
    for (const member of projectMembers || []) {
      const key = member.username || member.email || member._id || '';
      if (key && !memberMap[key]) {
        memberMap[key] = { 
          username: member.username || member.email || member.name || key,
          displayName: member.name || member.username || member.email || key,
          billableSeconds: 0 
        };
      }
    }
    
    // Then, add billable hours from time entries
    for (const iv of flattened || []) {
      const username = iv.username || 'Unknown';
      if (!memberMap[username]) {
        memberMap[username] = { username, displayName: username, billableSeconds: 0 };
      }
      if (iv.isBillable) {
        memberMap[username].billableSeconds += iv.duration || 0;
      }
    }
    return Object.values(memberMap).sort((a, b) => b.billableSeconds - a.billableSeconds);
  }, [flattened, projectMembers]);

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

        {/* Manager Summary Controls (date selector removed) */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 mb-4">
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
            <section className="bg-surface rounded-lg shadow-md p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-white">Member Payment</h2>
                {/* Default Rate/hour input removed */}
                <div className="flex items-center gap-2">
                  {/* Default Rate/hour input removed */}
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
                        const rate = memberRates[member.username] || 0;
                        const totalPay = hours * rate;
                        return (
                          <tr key={member.username} className="border-b border-surface-light hover:bg-surface-light transition-colors">
                            <td className="py-3 px-4 text-white font-medium">{member.displayName || member.username}</td>
                            <td className="py-3 px-4 text-cyan text-right">{hours.toFixed(2)} hrs</td>
                            <td className="py-3 px-4 text-gray-300 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={rate}
                                onChange={(e) => {
                                  if (!isManager) return;
                                  const newRate = Number(e.target.value || 0);
                                  setMemberRates(prev => ({
                                    ...prev,
                                    [member.username]: newRate
                                  }));
                                }}
                                placeholder="0"
                                disabled={!isManager}
                                title={isManager ? "Enter hourly rate" : "Only managers can edit rates"}
                                className={`w-20 py-1 px-2 rounded border text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                  isManager
                                    ? 'bg-surface text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan border-surface-light cursor-text'
                                    : 'bg-surface/50 text-gray-400 placeholder-gray-500 border-surface-light cursor-not-allowed opacity-60'
                                }`}
                              />
                            </td>
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
                </table>
              </div>
              
              {/* Grand Total Box at Bottom Right */}
              {memberPaymentData && memberPaymentData.length > 0 && (
                <div className="mt-6 flex flex-col items-end gap-3">
                  <div className="bg-cyan text-brand-bg rounded-lg shadow-lg p-4 min-w-[200px]">
                    <div className="text-sm font-semibold mb-1">Grand Total</div>
                    <div className="text-3xl font-bold">
                      ₹{(() => {
                        return memberPaymentData.reduce((sum, m) => {
                          const hours = m.billableSeconds / 3600;
                          const rate = memberRates[m.username] || 0;
                          return sum + (hours * rate);
                        }, 0).toFixed(2);
                      })()}
                    </div>
                  </div>
                  {projectBudget && Number(projectBudget) > 0 && (
                    <div className="bg-surface-light text-gray-200 rounded-lg shadow-lg p-4 min-w-[200px] border border-surface">
                      <div className="text-sm font-semibold mb-1">Remaining Budget</div>
                      <div className="text-2xl font-bold text-cyan">
                        ₹{(() => {
                          const budget = Number(projectBudget) || 0;
                          const grandTotal = memberPaymentData.reduce((sum, m) => {
                            const hours = m.billableSeconds / 3600;
                            const rate = memberRates[m.username] || 0;
                            return sum + (hours * rate);
                          }, 0);
                          const remaining = budget - grandTotal;
                          return remaining.toFixed(2);
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                    onChange={(e) => {
                      if (!isManager) return;
                      setProjectBudget(e.target.value);
                    }}
                    placeholder="Enter project budget"
                    disabled={!isManager}
                    title={isManager ? "Enter project budget" : "Only managers can edit budget"}
                    className={`w-full py-2 px-3 rounded-lg border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      isManager
                        ? 'bg-surface-light text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan border-surface cursor-text'
                        : 'bg-surface-light/50 text-gray-400 placeholder-gray-500 border-surface-light cursor-not-allowed opacity-60'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={projectStartDate}
                      onChange={(e) => {
                        if (!isManager) return;
                        setProjectStartDate(e.target.value);
                      }}
                      disabled={!isManager}
                      title={isManager ? "Set project start date" : "Only managers can edit dates"}
                      className={`w-full py-2 px-3 rounded-lg border ${
                        isManager
                          ? 'bg-surface-light text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan border-surface cursor-text'
                          : 'bg-surface-light/50 text-gray-400 border-surface-light cursor-not-allowed opacity-60'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">End Date</label>
                    <input
                      type="date"
                      value={projectEndDate}
                      onChange={(e) => {
                        if (!isManager) return;
                        setProjectEndDate(e.target.value);
                      }}
                      disabled={!isManager}
                      title={isManager ? "Set project end date" : "Only managers can edit dates"}
                      className={`w-full py-2 px-3 rounded-lg border ${
                        isManager
                          ? 'bg-surface-light text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan border-surface cursor-text'
                          : 'bg-surface-light/50 text-gray-400 border-surface-light cursor-not-allowed opacity-60'
                      }`}
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
              {/* Budget Status box removed as requested */}
            </section>

            {/* Remaining Tasks Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Remaining Tasks</h2>
              <div className="space-y-2">
                {(() => {
                  const incompleteTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'completed');
                  
                  if (incompleteTasks.length === 0) {
                    return (
                      <div className="bg-surface-light p-4 rounded-lg text-center text-gray-400">
                        No remaining tasks
                      </div>
                    );
                  }
                  
                  return incompleteTasks.map((task, index) => {
                    const assigneeName = (() => {
                      if (!task.assignedTo && !task.assignee) return 'Unassigned';
                      const assignee = task.assignedTo || task.assignee;
                      if (typeof assignee === 'object') {
                        return assignee.username || assignee.email || assignee.name || 'Unassigned';
                      }
                      return String(assignee);
                    })();
                    
                    const statusColor = {
                      'todo': 'bg-gray-500',
                      'in-progress': 'bg-yellow-500',
                      'review': 'bg-blue-500',
                    }[task.status] || 'bg-gray-500';
                    
                    const statusLabel = {
                      'todo': 'To Do',
                      'in-progress': 'In Progress',
                      'review': 'Review',
                    }[task.status] || task.status || 'To Do';
                    
                    return (
                      <div key={task._id || index} className="bg-surface-light p-4 rounded-lg hover:bg-surface transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-base mb-1 truncate">
                              {task.title || task.name || 'Untitled Task'}
                            </h3>
                            {task.description && (
                              <p className="text-gray-400 text-sm mb-2 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <span className="font-semibold">Assigned:</span> {assigneeName}
                              </span>
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <span className="font-semibold">Due:</span> {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`${statusColor} text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSummaryPage;
