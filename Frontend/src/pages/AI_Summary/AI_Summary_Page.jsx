// src/pages/AI_Summary_Page.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import ManagerSummaryPanel from './ManagerSummaryPanel';
import buildHeaders from '../../config/fetcher';
import API_BASE_URL from '../../config/api';
import { formatSecondsHm } from '../../utils/time';

const AISummaryPage = () => {
  const { projectId, memberId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [memberName, setMemberName] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const [ratePerHour, setRatePerHour] = useState(0);
  const [brainstormTotal, setBrainstormTotal] = useState(0);
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [linkedBillableSeconds, setLinkedBillableSeconds] = useState(null); // from TaskPage if provided
  const [currentUser, setCurrentUser] = useState(null);
  const [project, setProject] = useState(null);
  const [isManager, setIsManager] = useState(false);

  // Fetch current user and project info
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fetch current user
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

        // Fetch project details
        const projectRes = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
          method: 'GET',
          credentials: 'include',
          headers: buildHeaders()
        });
        const projectData = await projectRes.json();
        if (!mounted) return;
        
        if (projectRes.ok && projectData) {
          setProject(projectData);
          
          // Check if current user is manager/creator
          if (userData && userData.userData) {
            const user = userData.userData;
            const isManagerFlag = user.role === 'manager' || user.isManager === true;
            
            // Check if user is project creator
            let isCreator = false;
            if (projectData.createdBy) {
              const creatorId = typeof projectData.createdBy === 'object' 
                ? (projectData.createdBy.username || projectData.createdBy.email || projectData.createdBy._id)
                : String(projectData.createdBy);
              
              const userId = user.username || user.email || user._id;
              isCreator = String(creatorId).toLowerCase() === String(userId).toLowerCase();
            }
            
            setIsManager(isManagerFlag || isCreator);
          }
        }
      } catch (err) {
        console.error('Error fetching user/project data:', err);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  useEffect(() => {
    setMemberName(decodeURIComponent(memberId || ''));
    let mounted = true; // Define mounted here
    (async () => {
      setLoading(true);
      setFetchError('');
      const name = decodeURIComponent(memberId || '');
      try {
        // Use existing server route that returns project-level entries.
        const url = `${API_BASE_URL}/api/time-entries/project/${encodeURIComponent(projectId)}`;
        const res = await fetch(url, { credentials: 'include', headers: buildHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFetchError(data && data.msg ? data.msg : (data && data.error) ? data.error : `Server returned ${res.status}`);
          setHoursPerDay([]);
        } else {
          // For manager view, server returns `isManager: true` and `employeeStats`.
          let memberEntries = [];
          if (data && data.isManager && Array.isArray(data.employeeStats)) {
            const found = data.employeeStats.find(e => (e.username || '').toLowerCase() === (name || '').toLowerCase());
            if (found && Array.isArray(found.entries)) {
              // `found.entries` contains TimeEntry documents with `appointments` array
              memberEntries = found.entries;
            }
          } else if (Array.isArray(data) || Array.isArray(data.entries)) {
            // fallback: try to use `data.entries` or `data` itself
            memberEntries = Array.isArray(data.entries) ? data.entries : (Array.isArray(data) ? data : []);
          }

          // expose raw entries so other sections (app-level view) can render
          setEntries(memberEntries || []);

          // Build hours per day for the last 7 days (including today)
          const now = new Date();
          const buckets = {};
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            buckets[d.toISOString().slice(0,10)] = 0;
          }

          for (const entry of memberEntries) {
            const appointments = entry.appointments || [];
            for (const apt of appointments) {
              // Only include billable appointments in the per-day histogram
              if (!apt || !apt.isBillable) continue;
              const intervals = apt.timeIntervals || [];
              for (const iv of intervals) {
                const start = iv.startTime ? new Date(iv.startTime) : null;
                if (!start) continue;
                const key = start.toISOString().slice(0,10);
                if (key in buckets) {
                  buckets[key] += Number(iv.duration || 0);
                }
              }
            }
          }

          // `iv.duration` is stored as seconds. Convert to decimal hours for UI display
          const arr = Object.keys(buckets).sort().map((date) => {
            const seconds = Number(buckets[date] || 0);
            const hours = Math.round(((seconds / 3600) || 0) * 100) / 100; // hours with 2 decimal places
            return { date, hours, seconds };
          });
          setHoursPerDay(arr);
        }
      } catch (err) {
        setFetchError(String(err));
        setHoursPerDay([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId, projectId]);
  // --- End of Preserved Logic ---

  // POST manager daily summary
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

  // GET AI summary for manager
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
        // build a quick lookup map from AI summary items for UI hints
        try {
          const map = {};
          const s = data && data.summary ? data.summary : (data || {});
          const reports = s.reports || [];
          for (const r of reports) {
            const items = Array.isArray(r.items) ? r.items : [];
            for (const it of items) {
              try {
                const app = (it.appname || it.apptitle || 'unknown');
                const start = it.start ? (new Date(it.start)).toISOString() : (it.startTime ? (new Date(it.startTime)).toISOString() : '');
                const end = it.end ? (new Date(it.end)).toISOString() : (it.endTime ? (new Date(it.endTime)).toISOString() : '');
                const key = `${app}_${start}_${end}`;
                map[key] = it; // store raw item for hint UI
              } catch (e) {}
            }
          }
          setAiMatches(map);
        } catch (e) {
          console.warn('Failed to build AI matches map', e);
        }
      }
    } catch (err) {
      setAiError(String(err));
      setAiSummary(null);
    } finally {
      setAiLoading(false);
    }
  };

  // Flatten intervals and compute totals from `entries`
  const { flattened, totals } = React.useMemo(() => {
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
          const row = {
            id: `${entry._id || entry.id || username}_${appname}_${iv.startTime || ''}_${iv.endTime || ''}`,
            username,
            apptitle,
            appname,
            startTime: iv.startTime,
            endTime: iv.endTime,
            duration: dur,
            isBillable,
            suggestedCategory: suggested
          };
          flat.push(row);

          total += dur;
          if (isBillable) billable += dur;
          else if (suggested === 'non-billable' || suggested === 'nonbillable') nonbill += dur;
          else ambiguous += dur;
        }
      }
    }

    return { flattened: flat, totals: { billable, nonbill, ambiguous, total } };
  }, [entries]);

  // Compute average hours per day from the time-lapse (session intervals) table for this member
  const avgFromIntervals = React.useMemo(() => {
    try {
      const dayMap = {};
      (flattened || []).forEach((iv) => {
        if (!iv || !iv.startTime) return;
        const d = new Date(iv.startTime);
        if (Number.isNaN(d.getTime())) return;
        const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
        const acc = dayMap[key] || { total: 0, billable: 0, non: 0, ambiguous: 0 };
        const sec = Math.max(0, Number(iv.duration) || 0);
        acc.total += sec;
        if (iv.isBillable) acc.billable += sec;
        else if ((iv.suggestedCategory || '').toLowerCase().startsWith('non')) acc.non += sec;
        else acc.ambiguous += sec;
        dayMap[key] = acc;
      });

      const days = Object.keys(dayMap).length;
      const sums = Object.values(dayMap).reduce(
        (acc, d) => ({
          total: acc.total + d.total,
          billable: acc.billable + d.billable,
          non: acc.non + d.non,
          ambiguous: acc.ambiguous + d.ambiguous,
        }),
        { total: 0, billable: 0, non: 0, ambiguous: 0 }
      );
      const denom = Math.max(1, days);
      return {
        days,
        totalAvgSec: Math.floor(sums.total / denom),
        billableAvgSec: Math.floor(sums.billable / denom),
        nonAvgSec: Math.floor(sums.non / denom),
        ambiguousAvgSec: Math.floor(sums.ambiguous / denom),
      };
    } catch (e) {
      return { days: 0, totalAvgSec: 0, billableAvgSec: 0, nonAvgSec: 0, ambiguousAvgSec: 0 };
    }
  }, [flattened]);

  const location = useLocation();

  // Initialize billable seconds from navigation state (e.g., TaskPage passes values)
  useEffect(() => {
    try {
      const state = location && location.state ? location.state : null;
      if (state && typeof state.billableSeconds === 'number') {
        setLinkedBillableSeconds(state.billableSeconds);
      }
    } catch (e) {
      // ignore
    }
  }, []); // run once on mount

  // Group flattened intervals by app for usage logs
  const appUsageLogs = React.useMemo(() => {
    const appMap = {};
    (flattened || []).forEach((iv) => {
      const app = iv.appname || 'Unknown';
      if (!appMap[app]) {
        appMap[app] = {
          appname: app,
          sessions: [],
          totalDuration: 0,
          isBillable: iv.isBillable,
          suggestedCategory: iv.suggestedCategory
        };
      }
      appMap[app].sessions.push(iv);
      appMap[app].totalDuration += iv.duration || 0;
    });
    
    // Sort by category first (billable, ambiguous, non-billable), then by duration within each category
    return Object.values(appMap).sort((a, b) => {
      // Determine category priority (1=billable, 2=ambiguous, 3=non-billable)
      const getCategoryPriority = (app) => {
        if (app.isBillable) return 1;
        if ((app.suggestedCategory || '').toLowerCase().startsWith('non')) return 3;
        return 2; // ambiguous
      };
      
      const priorityA = getCategoryPriority(a);
      const priorityB = getCategoryPriority(b);
      
      // First sort by category priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Within same category, sort by duration (descending)
      return b.totalDuration - a.totalDuration;
    });
  }, [flattened]);

  // --- Loading State ---
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-brand-bg text-gray-200">
      <p>Loading...</p>
    </div>
  );

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
          <h1 className="text-3xl font-bold text-center  text-white ">
            ✨ AI Summary for {memberName}
          </h1>
          <div className="w-28"></div> {/* Spacer to balance header */}
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
            
            {/* Histogram Section (Billable only) */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Billable hours per day</h2>
              {(() => {
                const dataToShow = hoursPerDay.length === 0 ? (() => {
                  const arr = [];
                  const now = new Date();
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(now.getDate() - i);
                    const key = d.toISOString().slice(0, 10);
                    arr.push({ date: key, hours: Math.round((Math.random() * 6) * 100) / 100 });
                  }
                  return arr;
                })() : hoursPerDay;

                const maxH = Math.max(1, ...dataToShow.map((d) => d.hours)); // Ensure maxH is at least 1
                return (
                  <div className="bg-surface-light p-4 rounded-lg">
                    <div className="flex gap-3 items-end p-3 overflow-x-auto min-h-[240px]">
                      {dataToShow.filter(d => d.hours > 0).map((d) => (
                        <div key={d.date} className="flex flex-col items-center flex-shrink-0 w-10">
                          <div className="text-xs font-medium text-cyan mb-1">{d.hours.toFixed(1)}</div>
                          <div 
                            title={`${d.hours.toFixed(2)} hours`} 
                            style={{ height: `${(d.hours / maxH) * 160}px` }}
                            // === MODIFICATION: Changed gradient to teal for better contrast ===
                            className="w-7 bg-gradient-to-t from-teal-400 to-teal-600 rounded-md"
                          />
                          <div className="text-xs text-gray-400 mt-2 transform -rotate-45 whitespace-nowrap">{d.date.slice(5)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* Application Usage Bar Chart */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Application Usage</h2>
              <div className="bg-surface-light p-4 rounded-lg">
                {appUsageLogs && appUsageLogs.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {/* Chart */}
                    <div className="flex gap-2 items-end justify-start overflow-x-auto pb-2 min-h-[280px]">
                      {(() => {
                        // Calculate max hours for scaling
                        const maxHours = Math.max(1, ...appUsageLogs.map(app => app.totalDuration / 3600));
                        
                        return appUsageLogs.map((app) => {
                          // Determine bar color based on category
                          let barColor = 'bg-yellow-500'; // ambiguous
                          if (app.isBillable) {
                            barColor = 'bg-green-500';
                          } else if ((app.suggestedCategory || '').toLowerCase().startsWith('non')) {
                            barColor = 'bg-red-500';
                          }

                          const hours = app.totalDuration / 3600;
                          const heightPercent = (hours / maxHours) * 100;
                          const heightPx = Math.max(20, (heightPercent / 100) * 200); // min 20px, max 200px

                          return (
                            <div 
                              key={app.appname} 
                              className="flex flex-col items-center flex-shrink-0 min-w-[80px] max-w-[120px]"
                            >
                              {/* Sessions count */}
                              <div className="text-xs text-gray-400 mb-0.5">
                                {app.sessions.length} session{app.sessions.length !== 1 ? 's' : ''}
                              </div>
                              
                              {/* Hours label */}
                              <div className="text-xs font-medium text-cyan mb-1">
                                {hours.toFixed(1)}h
                              </div>
                              
                              {/* Bar */}
                              <div 
                                className={`w-full ${barColor} rounded-t-md hover:brightness-110 transition-all duration-200 cursor-pointer`}
                                style={{ height: `${heightPx}px` }}
                                title={`${app.appname}: ${formatSecondsHm(app.totalDuration)} (${app.sessions.length} session${app.sessions.length !== 1 ? 's' : ''})`}
                              />
                              
                              {/* App name label */}
                              <div className="text-xs text-gray-300 mt-2 text-center break-words w-full line-clamp-2">
                                {app.appname}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 pt-4 border-t border-surface">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-xs text-gray-300">Billable</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span className="text-xs text-gray-300">Non-billable</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span className="text-xs text-gray-300">Ambiguous</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-center py-8">No usage data available</div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-6 lg:overflow-y-auto pb-4 pr-2">
            
            {/* Summary & Payment Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Total hours</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    const totalSeconds = (totals && totals.total) ? totals.total : 0;
                    const h = Math.floor(totalSeconds / 3600);
                    const m = Math.floor((totalSeconds % 3600) / 60);
                    return `${h}h ${m}m`;
                  })()}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Billable hours</div>
                  <div className="text-2xl font-bold text-white mt-2">{(() => {
                    const hasLinked = typeof linkedBillableSeconds === 'number';
                    const sec = hasLinked ? linkedBillableSeconds : ((totals && totals.billable) || 0);
                    return formatSecondsHm(sec);
                  })()}</div>
                  <div className="mt-1 text-xs text-gray-400">{typeof linkedBillableSeconds === 'number' ? 'From task (linked)' : 'Computed from sessions'}</div>
                </div>
              </div>

              <div className="bg-surface-light p-4 rounded-lg">
                <div className="mb-2 font-semibold text-gray-300">Rate per hour (INR)</div>
                <input 
                  type="text" 
                  value={ratePerHour} 
                  onChange={(e) => {
                    if (!isManager) return; // Only managers can edit
                    const val = e.target.value;
                    // Allow empty string, numbers, and decimal point
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setRatePerHour(val === '' ? 0 : Number(val) || 0);
                    }
                  }} 
                  onBlur={(e) => {
                    if (!isManager) return; // Only managers can edit
                    // Clean up the value on blur
                    const val = e.target.value;
                    setRatePerHour(val === '' || val === '.' ? 0 : Number(val) || 0);
                  }}
                  placeholder="0"
                  disabled={!isManager}
                  title={isManager ? "Enter rate per hour" : "Only managers can edit the rate"}
                  className={`w-full py-2 px-3 rounded-lg border ${
                    isManager 
                      ? 'bg-surface text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan border-surface cursor-text' 
                      : 'bg-surface/50 text-gray-400 border-surface-light cursor-not-allowed opacity-60'
                  }`}
                />
                <div className="mt-4 text-xl font-bold text-white">
                  {(() => {
                    const hasLinked = typeof linkedBillableSeconds === 'number';
                    const sec = hasLinked ? linkedBillableSeconds : ((totals && totals.billable) || 0);
                    const hrs = sec / 3600;
                    const amount = Math.round(hrs * ratePerHour * 100) / 100;
                    return (
                      <>Total payment: <span className="text-cyan">₹{amount}</span></>
                    );
                  })()}
                </div>
              </div>
            </section>

            {/* Averages Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Average Hours Per Day</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Total</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    return formatSecondsHm(avgFromIntervals.totalAvgSec);
                  })()}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Billable</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    return formatSecondsHm(avgFromIntervals.billableAvgSec);
                  })()}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Non-billable</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    return formatSecondsHm(avgFromIntervals.nonAvgSec);
                  })()}</div>
                </div>
              </div>
            </section>

            {/* Brainstorming Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Brainstorming</h2>
              <div className="bg-surface-light p-4 rounded-lg">
                <div className="text-sm font-semibold text-gray-400">Total brainstorm hours</div>
                <input 
                  type="number" 
                  min="0"
                  className="w-full bg-surface text-gray-200 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface mt-1" 
                  value={brainstormTotal} 
                  onChange={(e) => setBrainstormTotal(Number(e.target.value || 0))} 
                />
                <div className="mt-3 text-gray-300">
                  <strong>Avg/day:</strong> {(() => {
                    const days = Math.max(1, hoursPerDay.length || 1);
                    return Math.round(((brainstormTotal || 0) / days) * 100) / 100;
                  })()}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISummaryPage;