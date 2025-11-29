// src/pages/AI_Summary_Page.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import ManagerSummaryPanel from './ManagerSummaryPanel';
import buildHeaders from '../../config/fetcher';
import API_BASE_URL from '../../config/api';
import { formatSecondsHm } from '../../utils/time';

const normalizeMemberRates = (rawRates) => {
  if (!rawRates) return {};
  if (rawRates instanceof Map) {
    const normalized = {};
    rawRates.forEach((value, key) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) normalized[String(key)] = numeric;
    });
    return normalized;
  }
  if (typeof rawRates === 'object') {
    return Object.entries(rawRates).reduce((acc, [key, value]) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) acc[String(key)] = numeric;
      return acc;
    }, {});
  }
  return {};
};

const collectMemberIdentifiers = (member) => {
  if (!member || typeof member !== 'object') return [];
  return [member._id, member.id, member.memberId, member.username, member.email, member.name, member.displayName]
    .filter(Boolean)
    .map((val) => String(val).trim().toLowerCase());
};

const resolveMemberRateKey = (members, identifier, rates) => {
  const normalizedTarget = (identifier || '').trim().toLowerCase();
  if (!normalizedTarget) return null;
  for (const member of members || []) {
    const identifiers = collectMemberIdentifiers(member);
    if (identifiers.includes(normalizedTarget)) {
      const key = member && (member._id || member.id || member.memberId);
      if (key) return String(key);
    }
  }
  if (rates && typeof rates === 'object') {
    const matchKey = Object.keys(rates).find((key) => key.toLowerCase() === normalizedTarget);
    if (matchKey) return matchKey;
  }
  return null;
};

const AISummaryPage = () => {
  const { projectId, memberId } = useParams();
  const navigate = useNavigate();
  const decodedMemberIdentifier = useMemo(() => decodeURIComponent(memberId || '').trim(), [memberId]);

  const [loading, setLoading] = useState(true);
  const [memberName, setMemberName] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const [ratePerHour, setRatePerHour] = useState(0);
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [linkedBillableSeconds, setLinkedBillableSeconds] = useState(null); // from TaskPage if provided
  const [canEditRate, setCanEditRate] = useState(false);
  const [memberRateKey, setMemberRateKey] = useState(null);
  const [rateSaveError, setRateSaveError] = useState('');
  const [isSavingRate, setIsSavingRate] = useState(false);

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

        // Fetch project details
        const projectRes = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
          method: 'GET',
          credentials: 'include',
          headers: buildHeaders()
        });
        const projectData = await projectRes.json();
        if (!mounted) return;
        
        if (projectRes.ok && projectData) {
          // Check if current user is manager/creator
          if (userData && userData.userData) {
            const user = userData.userData;
            
            // Check if user is project creator
            let isCreator = false;
            if (projectData.createdBy) {
              const creatorId = typeof projectData.createdBy === 'object' 
                ? (projectData.createdBy.username || projectData.createdBy.email || projectData.createdBy._id)
                : String(projectData.createdBy);
              
              const userId = user.username || user.email || user._id;
              isCreator = String(creatorId).toLowerCase() === String(userId).toLowerCase();
            }
            
            setCanEditRate(isCreator);
          }

          const normalizedRates = normalizeMemberRates(projectData.memberRates);
          const resolvedKey = resolveMemberRateKey(projectData.members || [], decodedMemberIdentifier, normalizedRates);
          setMemberRateKey(resolvedKey);
          if (resolvedKey && normalizedRates[resolvedKey] !== undefined) {
            setRatePerHour(normalizedRates[resolvedKey]);
          }
        }
      } catch (err) {
        console.error('Error fetching user/project data:', err);
        if (mounted) {
          setCanEditRate(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [projectId, decodedMemberIdentifier]);

  const persistMemberRate = useCallback(async (nextRate) => {
    if (!canEditRate || !memberRateKey || !projectId) return;
    setIsSavingRate(true);
    setRateSaveError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/member-rates`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildHeaders() },
        body: JSON.stringify({ memberId: memberRateKey, rate: nextRate }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const message = errorBody.msg || errorBody.error || 'Failed to save rate';
        throw new Error(message);
      }
      setRateSaveError('');
    } catch (err) {
      console.error('Failed to persist member rate', err);
      setRateSaveError(err.message || 'Unable to save rate');
    } finally {
      setIsSavingRate(false);
    }
  }, [canEditRate, memberRateKey, projectId]);

  useEffect(() => {
    setMemberName(decodedMemberIdentifier || '');
    let mounted = true; // Define mounted here
    (async () => {
      setLoading(true);
      setFetchError('');
      const name = decodedMemberIdentifier || '';
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
  }, [decodedMemberIdentifier, projectId]);
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

  const brainstormingStats = React.useMemo(() => {
    let totalSeconds = 0;
    const sessionIds = new Set();
    let classification = '';

    for (const row of flattened || []) {
      const name = (row.appname || '').toLowerCase();
      const title = (row.apptitle || '').toLowerCase();
      const isBrainstorm = name.includes('brainstorm') || title.includes('brainstorm');
      if (!isBrainstorm) continue;

      const duration = Number(row.duration) || 0;
      totalSeconds += duration;
      sessionIds.add(row.id);

      if (!classification) {
        if (row.isBillable) classification = 'billable';
        else if ((row.suggestedCategory || '').toLowerCase().includes('non')) classification = 'non-billable';
        else classification = 'ambiguous';
      }
    }

    const toHours = (seconds) => Math.round(((seconds / 3600) || 0) * 100) / 100;
    const category = classification || 'ambiguous';
    let classificationAccent = 'text-amber-300';
    if (category === 'billable') classificationAccent = 'text-emerald-300';
    else if (category === 'non-billable') classificationAccent = 'text-rose-300';
    return {
      totalSeconds,
      totalHours: toHours(totalSeconds),
      sessionCount: sessionIds.size,
      classification: category,
      classificationAccent
    };
  }, [flattened]);

  const brainstormingSessionLabel = React.useMemo(() => {
    if (brainstormingStats.sessionCount > 0) {
      const suffix = brainstormingStats.sessionCount === 1 ? '' : 's';
      return `Derived from ${brainstormingStats.sessionCount} logged session${suffix}`;
    }
    return 'No brainstorming sessions logged yet';
  }, [brainstormingStats.sessionCount]);

  const brainstormAvgPerDay = React.useMemo(() => {
    const dayCount = Math.max(1, hoursPerDay.length || 1);
    return Math.round(((brainstormingStats.totalHours || 0) / dayCount) * 100) / 100;
  }, [brainstormingStats.totalHours, hoursPerDay]);

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

  // Compute total billable hours per day from flattened intervals
  const billablePerDay = React.useMemo(() => {
    const dayMap = {};
    for (const iv of flattened || []) {
      if (!iv || !iv.startTime || !iv.isBillable) continue;
      const d = new Date(iv.startTime);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = (dayMap[key] || 0) + (Number(iv.duration) || 0);
    }
    // Convert to array of {date, hours, seconds} sorted by date
    return Object.keys(dayMap)
      .sort()
      .map((date) => {
        const seconds = Number(dayMap[date] || 0);
        const hours = Math.round(((seconds / 3600) || 0) * 100) / 100;
        return { date, hours, seconds };
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
            AI Summary for {memberName}
          </h1>
          <div className="w-28"></div> {/* Spacer to balance header */}
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
            
            {/* Billable per-day Bar Chart */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Billable hours per day</h2>
              {(() => {
                // Build from computed billablePerDay to ensure bars when data exists
                const filtered = (billablePerDay || []).filter((d) => (d.hours || 0) > 0);
                if (filtered.length === 0) {
                  return (
                    <div className="bg-surface-light p-6 rounded-lg text-center text-gray-400">
                      No billable activity in the selected period
                    </div>
                  );
                }

                const maxH = Math.max(1, ...filtered.map((d) => d.hours));
                return (
                  <div className="bg-surface-light p-4 rounded-lg">
                    <div className="flex gap-3 items-end p-3 overflow-x-auto min-h-[240px]">
                      {filtered.map((d) => (
                        <div key={d.date} className="flex flex-col items-center flex-shrink-0 w-12">
                          <div className="text-xs font-medium text-cyan mb-1">{d.hours.toFixed(1)}h</div>
                          <div
                            title={`${d.hours.toFixed(2)} hours`}
                            style={{ height: `${(d.hours / maxH) * 180}px` }}
                            className="w-8 bg-gradient-to-t from-teal-500 to-teal-600 rounded-md"
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
                                {app.sessions.length} session{app.sessions.length === 1 ? '' : 's'}
                              </div>
                              
                              {/* Hours label */}
                              <div className="text-xs font-medium text-cyan mb-1">
                                {hours.toFixed(1)}h
                              </div>
                              
                              {/* Bar */}
                              <div 
                                className={`w-full ${barColor} rounded-t-md hover:brightness-110 transition-all duration-200 cursor-pointer`}
                                style={{ height: `${heightPx}px` }}
                                title={`${app.appname}: ${formatSecondsHm(app.totalDuration)} (${app.sessions.length} session${app.sessions.length === 1 ? '' : 's'})`}
                              />
                              
                              {/* App name label (fixed height keeps bars aligned) */}
                              <div className="mt-2 w-full min-h-[36px] flex items-start justify-center px-1">
                                <div className="text-xs text-gray-300 text-center break-words w-full line-clamp-2">
                                  {app.appname}
                                </div>
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
                    if (!canEditRate) return; // Only project manager (creator) can edit
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setRateSaveError('');
                      setRatePerHour(val === '' ? 0 : Number(val) || 0);
                    }
                  }} 
                  onBlur={(e) => {
                    if (!canEditRate) return; // Only project manager (creator) can edit
                    const val = e.target.value;
                    const normalized = val === '' || val === '.' ? 0 : Number(val) || 0;
                    setRatePerHour(normalized);
                    if (memberRateKey) {
                      persistMemberRate(normalized);
                    }
                  }}
                  placeholder="0"
                  disabled={!canEditRate}
                  title={canEditRate ? "Enter rate per hour" : "Only the project manager can edit the rate"}
                  className={`w-full py-2 px-3 rounded-lg border ${
                    canEditRate 
                      ? 'bg-surface text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan border-surface cursor-text' 
                      : 'bg-surface/50 text-gray-400 border-surface-light cursor-not-allowed opacity-60'
                  }`}
                />
                <div className="mt-1 text-xs text-gray-400">
                  {canEditRate ? 'Only you (project manager) can adjust this rate.' : 'Editable by the project manager who created this project.'}
                </div>
                {rateSaveError && (
                  <div className="mt-1 text-xs text-red-400">{rateSaveError}</div>
                )}
                {!rateSaveError && isSavingRate && (
                  <div className="mt-1 text-xs text-gray-400">Saving rate…</div>
                )}
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
                <div className="mt-2 text-3xl font-bold text-white">
                  {brainstormingStats.totalHours.toFixed(2)} hrs
                </div>
                <div className="mt-1 text-sm text-gray-400">{brainstormingSessionLabel}</div>
                <div className="mt-3 text-gray-300">
                  <strong>Avg/day:</strong> {brainstormAvgPerDay.toFixed(2)} hrs
                </div>
                <div className="mt-3 text-gray-300">
                  <strong>Classification:</strong>{' '}
                  <span className={`${brainstormingStats.classificationAccent} font-semibold uppercase tracking-wide`}>
                    {brainstormingStats.classification}
                  </span>
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