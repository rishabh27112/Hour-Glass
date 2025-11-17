import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../../config/api';
import buildHeaders from '../../config/fetcher';
import { useParams, useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import ManagerSummaryPanel from './ManagerSummaryPanel';

const AISummaryPage=()=>{
  const {projectId,memberId}=useParams();
  const navigate=useNavigate();

  const [loading, setLoading]=useState(true);
  const [memberName, setMemberName]=useState('');
  const [hoursPerDay, setHoursPerDay]=useState([]);
  const [fetchError, setFetchError]=useState('');
  const [billableHours, setBillableHours]=useState(0);
  const [ratePerHour, setRatePerHour]=useState(0);
  const [brainstormTotal, setBrainstormTotal]=useState(0);
  const [appsAvg, setAppsAvg]=useState([]);
  const [entries, setEntries] = useState([]);
  const [isManager, setIsManager] = useState(false);
  const [aiMatches, setAiMatches] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [filterApp, setFilterApp] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'billable' | 'non-billable' | 'ambiguous'
  const [expandedApps, setExpandedApps] = useState({}); // Track which apps are expanded

  // --- All Logic is 100% Preserved ---
  const formatHours = (h) => {
    const totalMinutes = Math.round((Number(h) || 0) * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return `${hh} h ${mm} m`;
  };

  useEffect(() => {
    setMemberName(decodeURIComponent(memberId || ''));
    let mounted = true; // Define mounted here
    (async () => {
      setLoading(true);
      setFetchError('');
      const name = decodeURIComponent(memberId || '');
      try {
        // Use existing server route that returns project-level entries.
        const url = `/api/time-entries/project/${encodeURIComponent(projectId)}`;
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFetchError(data && data.msg ? data.msg : (data && data.error) ? data.error : `Server returned ${res.status}`);
          setHoursPerDay([]);
        } else {
          // set manager flag if server indicated manager view
          setIsManager(!!data.isManager);
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
          const arr = Object.keys(buckets).map((date) => {
            const seconds = Number(buckets[date] || 0);
            const hours = Math.round(((seconds / 3600) || 0) * 100) / 100; // hours with 2 decimal places
            return { date, hours, seconds };
          });
          setHoursPerDay(arr);
          
          // Note: billableHours will be set by the useEffect that syncs with totals.billable
          // Don't set it here to avoid incorrect initial value
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
      const res = await fetch('/api/time-entries/daily-summary/manager', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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
      const url = `/api/time-entries/ai-summary/manager/${encodeURIComponent(projectId)}${q}`;
      const res = await fetch(url, { credentials: 'include' });
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

  // Flatten intervals and compute app-level groupings from `entries`
  const { flattened, groups, totals } = React.useMemo(() => {
    const flat = [];
    const appGroups = {};
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

          if (!appGroups[appname]) appGroups[appname] = { intervals: [], total: 0 };
          appGroups[appname].intervals.push(row);
          appGroups[appname].total += dur;
        }
      }
    }

    return { flattened: flat, groups: appGroups, totals: { billable, nonbill, ambiguous, total } };
  }, [entries]);

  const fmt = (s) => {
    const hrs = Math.floor(s/3600), mins = Math.floor((s%3600)/60), sec = Math.floor(s%60);
    return `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  // Format an ISO timestamp (or other date string) as local YYYY-MM-DD HH:MM:SS
  const formatDateTime = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d)) return '-';
      const YYYY = d.getFullYear();
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const DD = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
    } catch (e) {
      return '-';
    }
  };

  // Sync billableHours state from computed totals (seconds -> hours) - always auto-update
  useEffect(() => {
    try {
      const computedHours = Math.round(((totals && totals.billable) || 0) / 3600 * 100) / 100;
      setBillableHours(computedHours);
    } catch (e) {
      console.warn('Error syncing computed billable hours', e);
    }
  }, [totals && totals.billable]);

  // Update an interval's classification by id (updates appointment-level flags)
  // Persists a classification rule via PATCH /api/classification-rules/:appName when the user is a manager
  const updateIntervalClassification = async (rowId, newClass) => {
    // newClass: 'billable' | 'non-billable' | 'ambiguous'
    const updated = (entries || []).map((entry) => {
      const username = entry.username || entry.user || entry.owner || '';
      const appts = Array.isArray(entry.appointments) ? entry.appointments.map((apt) => {
        const apptitle = apt.apptitle || apt.appname || 'Session';
        const appname = apt.appname || apptitle || 'Unknown';
        const intervals = Array.isArray(apt.timeIntervals) ? apt.timeIntervals.map((iv) => {
          const id = `${entry._id || entry.id || username}_${appname}_${iv.startTime || ''}_${iv.endTime || ''}`;
          if (id === rowId) {
            // mutate appointment-level flags
            if (newClass === 'billable') {
              apt.isBillable = true;
              apt.suggestedCategory = 'billable';
            } else if (newClass === 'non-billable') {
              apt.isBillable = false;
              apt.suggestedCategory = 'non-billable';
            } else {
              apt.isBillable = false;
              apt.suggestedCategory = 'ambiguous';
            }
          }
          return iv;
        }) : apt.timeIntervals;
        // ensure we keep the same object shape
        return { ...apt, timeIntervals: intervals };
      }) : entry.appointments;
      return { ...entry, appointments: appts };
    });

    // Update UI immediately
    setEntries(updated);

    // Only attempt to persist if current viewer is manager
    if (!isManager) return;

    // Find app name for this interval to use in classification rule API
    let appForRule = null;
    try {
      for (const entry of updated) {
        const username = entry.username || entry.user || entry.owner || '';
        const appts = Array.isArray(entry.appointments) ? entry.appointments : [];
        for (const apt of appts) {
          const appname = apt.appname || apt.apptitle || 'Unknown';
          const intervals = Array.isArray(apt.timeIntervals) ? apt.timeIntervals : [];
          for (const iv of intervals) {
            const id = `${entry._id || entry.id || username}_${appname}_${iv.startTime || ''}_${iv.endTime || ''}`;
            if (id === rowId) { appForRule = appname; break; }
          }
          if (appForRule) break;
        }
        if (appForRule) break;
      }
    } catch (err) {
      console.warn('Failed to locate app for rule persistence', err);
    }

    if (!appForRule) return;

    try {
      const res = await fetch(`/api/classification-rules/${encodeURIComponent(appForRule)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification: newClass })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data && (data.msg || data.error) ? (data.msg || data.error) : `Server returned ${res.status}`;
        // Surface an immediate alert so manager knows persistence failed (e.g., not verified)
        alert(`Failed to persist classification rule: ${msg}`);
        console.warn('classification rule persist failed', data);
      } else {
        console.log('classification rule persisted', data);
      }
    } catch (err) {
      console.error('Failed to persist classification rule', err);
      alert('Failed to persist classification change');
    }
  };


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

        {/* Manager Summary Controls */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 mb-4">
          <label htmlFor="ai-summary-date" className="text-sm text-gray-300">Date:</label>
          <input
            id="ai-summary-date"
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
            
            {/* Histogram Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Hours per day</h2>
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
                      {dataToShow.map((d) => (
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

            {/* App Averages Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Avg time per application</h2>
              <div className="mt-4">
                {Object.keys(groups).length === 0 ? (
                  <>
                    <div className="mb-3">
                      <button 
                        className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors text-sm"
                        onClick={() => {
                          const input = globalThis.prompt('Paste app JSON array (e.g. [{"app":"YouTube","hours":3.58}])');
                          if (!input) return;
                          try {
                            const parsed = JSON.parse(input || '[]');
                            if (Array.isArray(parsed)) {
                              setAppsAvg(parsed.map(p => ({ app: p.app || p.name || 'unknown', hours: Math.round((Number(p.hours) || 0) * 100) / 100 })));
                            } else setAppsAvg([]);
                          } catch (err) { console.warn('Invalid app JSON', err); setAppsAvg([]); alert('Invalid JSON'); }
                        }}>
                        Load App Data
                      </button>
                    </div>
                    <div>
                      {appsAvg.length === 0 ? (
                        <div className="text-gray-500 italic">No app-level data loaded.</div>
                      ) : (
                        <table className="w-full">
                          <tbody>
                            {appsAvg.map((a) => (
                              <tr key={a.app} className="border-b border-surface-light">
                                <td className="py-2 text-gray-200">{a.app}</td>
                                <td className="py-2 text-cyan font-semibold text-right">{formatHours(a.hours)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    {/* Filters */}
                    <div className="mb-4 flex flex-wrap gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-300">App:</label>
                        <select 
                          value={filterApp} 
                          onChange={(e) => setFilterApp(e.target.value)}
                          className="bg-surface text-gray-200 py-1 px-3 rounded border border-surface-light text-sm"
                        >
                          <option value="">All Apps</option>
                          {Object.keys(groups).sort().map(app => (
                            <option key={app} value={app}>{app}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-300">Status:</label>
                        <select 
                          value={filterStatus} 
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="bg-surface text-gray-200 py-1 px-3 rounded border border-surface-light text-sm"
                        >
                          <option value="all">All Status</option>
                          <option value="billable">Billable</option>
                          <option value="non-billable">Non-Billable</option>
                          <option value="ambiguous">Ambiguous</option>
                        </select>
                      </div>
                      <button 
                        onClick={() => { setFilterApp(''); setFilterStatus('all'); }}
                        className="text-sm bg-surface-light hover:bg-surface px-3 py-1 rounded text-gray-300"
                      >
                        Clear Filters
                      </button>
                    </div>

                    {/* Fixed Table Structure with Collapsible Apps */}
                    <div className="bg-surface rounded border border-surface-light overflow-x-auto">
                      <table className="w-full min-w-[900px]">
                        <thead className="bg-surface-light border-b border-surface">
                          <tr>
                            <th className="text-left py-3 px-3 text-sm font-semibold text-gray-300 w-[180px]">App Name</th>
                            <th className="text-left py-3 px-3 text-sm font-semibold text-gray-300">Title</th>
                            <th className="text-left py-3 px-3 text-sm font-semibold text-gray-300 w-[180px]">Time</th>
                            <th className="text-center py-3 px-3 text-sm font-semibold text-gray-300 w-[110px]">Status</th>
                            <th className="text-center py-3 px-3 text-sm font-semibold text-gray-300 w-[100px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group intervals by app and apply filters
                            const filteredGroups = {};
                            Object.entries(groups).forEach(([app, info]) => {
                              const filteredIntervals = info.intervals.filter(iv => {
                                let cls;
                                if (iv.isBillable) cls = 'billable';
                                else if ((iv.suggestedCategory || '').toLowerCase().startsWith('non')) cls = 'non-billable';
                                else cls = 'ambiguous';

                                // Apply filters
                                if (filterApp && app !== filterApp) return false;
                                if (filterStatus !== 'all' && cls !== filterStatus) return false;
                                return true;
                              });

                              if (filteredIntervals.length > 0) {
                                filteredGroups[app] = { ...info, intervals: filteredIntervals };
                              }
                            });

                            if (Object.keys(filteredGroups).length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="py-6 text-center text-gray-500 italic">
                                    No sessions match the current filters
                                  </td>
                                </tr>
                              );
                            }

                            const rows = [];
                            Object.entries(filteredGroups).forEach(([app, info]) => {
                              const isExpanded = expandedApps[app] !== false; // Default expanded
                              const totalDur = info.intervals.reduce((sum, iv) => sum + (iv.duration || 0), 0);
                              
                              // App header row (collapsible)
                              rows.push(
                                <tr 
                                  key={`header-${app}`} 
                                  className="bg-surface-light border-b border-surface cursor-pointer hover:bg-surface"
                                  onClick={() => setExpandedApps(prev => ({ ...prev, [app]: !isExpanded }))}
                                >
                                  <td colSpan={5} className="py-3 px-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-cyan text-lg">{isExpanded ? '▼' : '▶'}</span>
                                        <span className="font-semibold text-white" title={app}>{app}</span>
                                        <span className="text-xs text-gray-400">({info.intervals.length} session{info.intervals.length !== 1 ? 's' : ''})</span>
                                      </div>
                                      <span className="text-sm text-gray-300">
                                        Total: {(() => {
                                          const hrs = Math.floor(totalDur/3600);
                                          const mins = Math.floor((totalDur%3600)/60);
                                          const secs = Math.floor(totalDur%60);
                                          return `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
                                        })()}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );

                              // Session rows (only if expanded)
                              if (isExpanded) {
                                info.intervals.forEach(iv => {
                                  let cls;
                                  if (iv.isBillable) cls = 'billable';
                                  else if ((iv.suggestedCategory || '').toLowerCase().startsWith('non')) cls = 'non-billable';
                                  else cls = 'ambiguous';

                                  let badgeClass = 'bg-yellow-700 text-black';
                                  let badgeLabel = 'Ambiguous';
                                  if (cls === 'billable') { badgeClass = 'bg-green-700 text-white'; badgeLabel = 'Billable'; }
                                  else if (cls === 'non-billable') { badgeClass = 'bg-red-700 text-white'; badgeLabel = 'Non-billable'; }

                                  rows.push(
                                    <tr key={iv.id} className="border-b border-surface-light hover:bg-surface/50">
                                      <td className="py-2 px-3 pl-12 text-sm">
                                        <div className="text-gray-400 text-xs">↳</div>
                                      </td>
                                      <td className="py-2 px-3 text-sm">
                                        <div className="truncate max-w-[300px] min-w-0 text-gray-200" title={iv.apptitle}>{iv.apptitle}</div>
                                      </td>
                                      <td className="py-2 px-3 text-xs text-gray-400">
                                        {formatDateTime(iv.startTime)} → {formatDateTime(iv.endTime)}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        <div className={`inline-block text-xs px-2 py-1 rounded ${badgeClass}`}>
                                          {badgeLabel}
                                        </div>
                                      </td>
                                      <td className="py-2 px-3">
                                        <div className="flex items-center justify-center gap-1">
                                          {isManager ? (
                                            <>
                                              <button title="Mark Billable" onClick={() => updateIntervalClassification(iv.id, 'billable')} className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded font-semibold text-white">B</button>
                                              <button title="Mark Non-billable" onClick={() => updateIntervalClassification(iv.id, 'non-billable')} className="text-xs bg-red-600 hover:bg-red-500 px-2 py-1 rounded font-semibold text-white">N</button>
                                              <button title="Mark Ambiguous" onClick={() => updateIntervalClassification(iv.id, 'ambiguous')} className="text-xs bg-yellow-500 hover:bg-yellow-400 px-2 py-1 rounded font-semibold text-black">A</button>
                                            </>
                                          ) : (
                                            <>
                                              <button disabled title="Only managers can change classification" className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded opacity-50 cursor-not-allowed">B</button>
                                              <button disabled title="Only managers can change classification" className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded opacity-50 cursor-not-allowed">N</button>
                                              <button disabled title="Only managers can change classification" className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded opacity-50 cursor-not-allowed">A</button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                });
                              }
                            });

                            return rows;
                          })()}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 text-sm text-gray-400">
                      Showing {(() => {
                        let count = 0;
                        Object.entries(groups).forEach(([app, info]) => {
                          info.intervals.forEach(iv => {
                            let cls;
                            if (iv.isBillable) cls = 'billable';
                            else if ((iv.suggestedCategory || '').toLowerCase().startsWith('non')) cls = 'non-billable';
                            else cls = 'ambiguous';
                            if (filterApp && app !== filterApp) return;
                            if (filterStatus !== 'all' && cls !== filterStatus) return;
                            count++;
                          });
                        });
                        return count;
                      })()} of {flattened.length} sessions • {Object.keys(groups).length} apps
                    </div>
                  </div>
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
                    const totalSec = (totals && totals.total) || 0;
                    const hrs = Math.floor(totalSec / 3600);
                    const mins = Math.floor((totalSec % 3600) / 60);
                    return `${hrs}h ${mins}m`;
                  })()}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Billable hours</div>
                  <div className="text-2xl font-bold text-white mt-2">{(() => {
                    const billableSec = (totals && totals.billable) || 0;
                    const hrs = Math.floor(billableSec / 3600);
                    const mins = Math.floor((billableSec % 3600) / 60);
                    return `${hrs}h ${mins}m`;
                  })()}</div>
                  <div className="mt-2 text-xs text-gray-400">
                    Auto-updated from billable sessions
                  </div>
                </div>
              </div>

              <div className="bg-surface-light p-4 rounded-lg">
                <div className="mb-2 font-semibold text-gray-300">Rate per hour (INR)</div>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={ratePerHour} 
                  onChange={(e) => setRatePerHour(Number(e.target.value || 0))} 
                  className="w-full bg-surface text-gray-200 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface"
                />
                <div className="mt-4 text-xl font-bold text-white">
                  Total payment: <span className="text-cyan">₹{Math.round((billableHours * ratePerHour) * 100) / 100}</span>
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
                    const days = Math.max(1, hoursPerDay.length || 1);
                    const total = hoursPerDay.reduce((s, d) => s + (Number(d.hours) || 0), 0);
                    return Math.round((total / days) * 100) / 100;
                  })()}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Billable</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    const days = Math.max(1, hoursPerDay.length || 1);
                    return Math.round(((billableHours || 0) / days) * 100) / 100;
                  })()}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Non-billable</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    const days = Math.max(1, hoursPerDay.length || 1);
                    const total = hoursPerDay.reduce((s, d) => s + (Number(d.hours) || 0), 0);
                    const non = Math.max(0, total - (billableHours || 0));
                    return Math.round((non / days) * 100) / 100;
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