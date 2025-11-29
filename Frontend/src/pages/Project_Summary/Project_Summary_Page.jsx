// src/pages/Project_Summary/Project_Summary_Page.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import ManagerSummaryPanel from '../AI_Summary/ManagerSummaryPanel';
import API_BASE_URL from '../../config/api';
import buildHeaders from '../../config/fetcher';
import { formatSecondsHm } from '../../utils/time';

const normalizeMemberRatesObject = (rawRates) => {
  if (!rawRates || typeof rawRates !== 'object') return {};
  const normalized = {};
  for (const [key, value] of Object.entries(rawRates)) {
    const numeric = Number(value);
    normalized[key] = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  }
  return normalized;
};

const deriveMemberRateKey = (member) => {
  if (!member) return '';
  const id = member._id || member.id || member.memberId;
  if (id) return String(id);
  const fallback = member.username || member.email || member.displayName || member.name;
  return fallback ? String(fallback) : '';
};

const normalizeBudgetInput = (rawValue) => {
  if (rawValue === null || rawValue === undefined) return '';
  const value = String(rawValue);
  if (value === '') return '';
  if (value === '.') return '0.';
  const [integerPartRaw, decimalPartRaw] = value.split('.');
  let integerPart = integerPartRaw.replace(/^0+(?=\d)/, '');
  if (integerPart === '') integerPart = '0';
  if (decimalPartRaw === undefined) return integerPart;
  return `${integerPart}.${decimalPartRaw}`;
};

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
  const [isProjectOwner, setIsProjectOwner] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsSaveError, setDetailsSaveError] = useState('');
  const [dateValidationError, setDateValidationError] = useState('');
  const canGenerateDailySummary = Boolean(isProjectOwner);
  const generateSummaryButtonTitle = canGenerateDailySummary
    ? 'Generate a fresh daily summary for this project.'
    : 'Only the project manager (creator) can generate daily summaries.';

  const saveMemberRate = useCallback(async (memberId, rateValue) => {
    if (!memberId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/member-rates`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildHeaders() },
        body: JSON.stringify({ memberId, rate: rateValue }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const message = errorBody.msg || errorBody.error || 'Failed to update hourly rate';
        throw new Error(message);
      }
      const data = await res.json().catch(() => ({}));
      if (data && data.memberRates) {
        setMemberRates(prev => ({
          ...prev,
          ...normalizeMemberRatesObject(data.memberRates)
        }));
      }
    } catch (err) {
      console.error('Failed to save member rate:', err);
    }
  }, [projectId]);

  const handleRateChange = useCallback((memberEntry, value) => {
    if (!isProjectOwner || !memberEntry || !memberEntry.rateKey) return;
    const parsed = Number(value);
    const numericValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setMemberRates(prev => ({
      ...prev,
      [memberEntry.rateKey]: numericValue,
    }));
    if (memberEntry.memberId) {
      saveMemberRate(memberEntry.memberId, numericValue);
    }
  }, [isProjectOwner, saveMemberRate]);

  const formatDateForInput = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };

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
          const incomingBudget = typeof data.budget === 'number' ? data.budget : null;
          setProjectBudget(incomingBudget !== null ? incomingBudget.toString() : '');
          setProjectStartDate(formatDateForInput(data.startDate || data.createdAt));
          setProjectEndDate(formatDateForInput(data.endDate));
          setDetailsLoaded(true);
          setDetailsDirty(false);
          setDetailsSaveError('');
          const normalizedRates = normalizeMemberRatesObject(data.memberRates);
          for (const member of members) {
            const rateKey = deriveMemberRateKey(member);
            if (rateKey && normalizedRates[rateKey] === undefined) {
              normalizedRates[rateKey] = 0;
            }
          }
          setMemberRates(normalizedRates);
          
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
            setIsProjectOwner(isCreator);
          }
          
          // Initialize rates for new members
        }
      } catch (err) {
        console.error('Error fetching project members:', err);
      }
    })();
    return () => { mounted = false; };
  }, [projectId, currentUser]);

  useEffect(() => {
    if (!detailsLoaded || !detailsDirty || !isProjectOwner) return;
    if (dateValidationError) return;

    let cancelled = false;

    const persistDetails = async () => {
      if (cancelled) return;
      setIsSavingDetails(true);
      setDetailsSaveError('');
      try {
        const numericBudget = Number(projectBudget);
        const payload = {
          budget: Number.isNaN(numericBudget) ? 0 : numericBudget,
          startDate: projectStartDate || null,
          endDate: projectEndDate || null,
        };
        const res = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/details`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildHeaders() },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          const message = errorBody.msg || errorBody.error || 'Failed to save project details';
          throw new Error(message);
        }

        if (!cancelled) {
          setDetailsDirty(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to save project details:', err);
          setDetailsSaveError(err.message || 'Could not save project details. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsSavingDetails(false);
        }
      }
    };

    persistDetails();

    return () => {
      cancelled = true;
    };
  }, [detailsLoaded, detailsDirty, isProjectOwner, projectBudget, projectStartDate, projectEndDate, projectId, dateValidationError]);

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
      const username = entry.userId || entry.username || entry.user || entry.owner || '';
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
    const memberMap = new Map();
    const usernameIndex = new Map();

    const registerMemberEntry = (member) => {
      const rateKey = deriveMemberRateKey(member);
      if (!rateKey) return null;
      if (!memberMap.has(rateKey)) {
        const username = member.username || member.email || member.name || rateKey;
        const resolvedId = member._id || member.id || member.memberId || null;
        const memberId = resolvedId ? String(resolvedId) : null;
        const entry = {
          memberId,
          rateKey,
          username: username || rateKey,
          displayName: member.name || username || rateKey,
          billableSeconds: 0,
        };
        memberMap.set(rateKey, entry);
        if (entry.username) {
          usernameIndex.set(entry.username, rateKey);
        }
      }
      return memberMap.get(rateKey);
    };

    for (const member of projectMembers || []) {
      registerMemberEntry(member);
    }

    for (const iv of flattened || []) {
      const username = iv.username || 'Unknown';
      const mappedKey = usernameIndex.get(username);
      const entry = mappedKey ? memberMap.get(mappedKey) : null;
      if (entry && iv.isBillable) {
        entry.billableSeconds += iv.duration || 0;
      }
    }

    return Array.from(memberMap.values()).sort((a, b) => b.billableSeconds - a.billableSeconds);
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

  const detailsStatusMessage = useMemo(() => {
    if (dateValidationError) return dateValidationError;
    if (detailsSaveError) return detailsSaveError;
    if (isSavingDetails) return 'Saving changes...';
    return 'Changes save automatically';
  }, [dateValidationError, detailsSaveError, isSavingDetails]);

  const shouldShowDetailsStatus = useMemo(() => (
    detailsStatusMessage && detailsStatusMessage !== 'Changes save automatically'
  ), [detailsStatusMessage]);

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
            Project Summary{projectName ? `: ${projectName}` : ''}
          </h1>
          <div className="w-28" />
        </div>

        {/* Manager Summary Controls */}
        <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-3 mb-4">
          <label className="flex items-center gap-2 bg-surface-light text-gray-200 border border-surface rounded-lg px-3 py-2 text-sm">
            <span className="whitespace-nowrap font-semibold">Select Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-0 text-white focus:outline-none cursor-pointer"
              max={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <button
            onClick={() => {
              if (canGenerateDailySummary) {
                postDailySummary(selectedDate);
              }
            }}
            disabled={!canGenerateDailySummary}
            title={generateSummaryButtonTitle}
            className="bg-yellow-500 text-black font-semibold py-2 px-4 rounded-lg hover:brightness-90 disabled:opacity-60 disabled:cursor-not-allowed"
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
                        const rateKey = member.rateKey;
                        const rate = rateKey && memberRates[rateKey] !== undefined ? memberRates[rateKey] : 0;
                        const canEditRate = isProjectOwner && !!member.memberId;
                        const totalPay = hours * rate;
                        return (
                          <tr key={member.rateKey || member.username} className="border-b border-surface-light hover:bg-surface-light transition-colors">
                            <td className="py-3 px-4 text-white font-medium">{member.displayName || member.username}</td>
                            <td className="py-3 px-4 text-cyan text-right">{hours.toFixed(2)} hrs</td>
                            <td className="py-3 px-4 text-gray-300 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={rate}
                                onChange={(e) => handleRateChange(member, e.target.value)}
                                placeholder="0"
                                disabled={!canEditRate}
                                title={canEditRate ? "Enter hourly rate" : 'Rates can only be edited for project members by managers'}
                                className={`w-20 py-1 px-2 rounded border text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                  canEditRate
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
                          const rateKey = m.rateKey;
                          const rate = rateKey && memberRates[rateKey] !== undefined ? memberRates[rateKey] : 0;
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
                            const rateKey = m.rateKey;
                            const rate = rateKey && memberRates[rateKey] !== undefined ? memberRates[rateKey] : 0;
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
                  <label htmlFor="project-budget" className="block text-sm font-semibold text-gray-400 mb-2">Project Budget (INR)</label>
                  <input
                    id="project-budget"
                    type="number"
                    min="0"
                    step="0.01"
                    value={projectBudget}
                    onChange={(e) => {
                      if (!isProjectOwner) return;
                      setProjectBudget(normalizeBudgetInput(e.target.value));
                      if (detailsLoaded) setDetailsDirty(true);
                    }}
                    placeholder="Enter project budget"
                    disabled={!isProjectOwner}
                    title={isProjectOwner ? "Enter project budget" : "Only the project manager (creator) can edit budget"}
                    className={`w-full py-2 px-3 rounded-lg border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      isProjectOwner
                        ? 'bg-surface-light text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan border-surface cursor-text'
                        : 'bg-surface-light/50 text-gray-400 placeholder-gray-500 border-surface-light cursor-not-allowed opacity-60'
                    }`}
                  />
                  {!isProjectOwner && (
                    <p className="text-xs text-gray-500 mt-1">Only the project manager who created this project can change the budget.</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="project-start-date" className="block text-sm font-semibold text-gray-400 mb-2">Start Date</label>
                    <input
                      id="project-start-date"
                      type="date"
                      value={projectStartDate}
                      readOnly
                      disabled
                      title="Project start date is locked after project creation"
                      className="w-full py-2 px-3 rounded-lg border bg-surface-light/50 text-gray-400 border-surface-light cursor-not-allowed opacity-60"
                    />
                  </div>
                  <div>
                    <label htmlFor="project-end-date" className="block text-sm font-semibold text-gray-400 mb-2">End Date</label>
                    <input
                      id="project-end-date"
                      type="date"
                      min={projectStartDate || undefined}
                      value={projectEndDate}
                      onChange={(e) => {
                        if (!isProjectOwner) return;
                        const nextValue = e.target.value;
                        if (!nextValue) {
                          setDateValidationError('');
                          setProjectEndDate('');
                          if (detailsLoaded) setDetailsDirty(true);
                          return;
                        }

                        if (projectStartDate) {
                          const start = new Date(projectStartDate);
                          const end = new Date(nextValue);
                          if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
                            setDateValidationError('End date must be on or after the project start date.');
                            return;
                          }
                        }

                        setDateValidationError('');
                        setProjectEndDate(nextValue);
                        if (detailsLoaded) setDetailsDirty(true);
                      }}
                      disabled={!isProjectOwner}
                      title={isProjectOwner ? "Set project end date" : "Only the project manager (creator) can edit dates"}
                      aria-invalid={Boolean(dateValidationError)}
                      className={`w-full py-2 px-3 rounded-lg border ${
                        isProjectOwner
                          ? 'bg-surface-light text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan border-surface cursor-text'
                          : 'bg-surface-light/50 text-gray-400 border-surface-light cursor-not-allowed opacity-60'
                      }`}
                    />
                    {dateValidationError && (
                      <p className="text-xs text-red-400 mt-1">{dateValidationError}</p>
                    )}
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
                        const pluralSuffix = diffDays === 1 ? '' : 's';
                        return `${diffDays} day${pluralSuffix}`;
                      })()}
                    </div>
                  </div>
                )}
                {isProjectOwner && shouldShowDetailsStatus && (
                  <p className={`text-xs mt-1 ${(detailsSaveError || dateValidationError) ? 'text-red-400' : 'text-gray-500'}`}>
                    {detailsStatusMessage}
                  </p>
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
