// src/pages/TaskPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../config/api';
import buildHeaders from '../../config/fetcher';
import { 
  RiArrowLeftLine, RiCloseLine, RiBrainLine, RiStopCircleLine 
} from 'react-icons/ri';

// --- Native time tracker helpers (All logic is 100% preserved) ---
const getTimeTracker = () => (globalThis && globalThis.TimeTracker) ? globalThis.TimeTracker : null;

function startNativeTrackerForTask(project, task, taskId, currentUser) {
  console.log('[TaskPage] startNativeTrackerForTask called:', { project: project?._id, taskId });
  const tt = getTimeTracker();
  console.log('[TaskPage] TimeTracker available:', !!tt);
  if (!tt || typeof tt.start !== 'function') {
    console.warn('[TaskPage] TimeTracker.start not available');
    return;
  }
  try {
    try {
      const webToken = (globalThis.localStorage && globalThis.localStorage.getItem('token')) || (globalThis.sessionStorage && globalThis.sessionStorage.getItem('token')) || '';
      if (webToken && typeof tt.setAuthToken === 'function') {
        console.log('[TaskPage] Setting auth token');
        tt.setAuthToken(webToken);
      }
    } catch {}
    const projId = (project && project._id) ? String(project._id) : '';
    // Use task title from startTimer call
    // const taskTitle = (task && (task.title || task.name)) || 'Task';
    const userStr = (currentUser && (currentUser.username || currentUser.email || currentUser._id || currentUser.name)) || '';
    console.log('[TaskPage] Calling TimeTracker.start with:', { user: userStr, project: projId, taskId });
    // Pass task title and ID separately
    tt.start(String(userStr), String(projId), String(taskId), 200); 
    console.log('[TaskPage] TimeTracker.start completed');
  } catch (e) {
    console.error('[TaskPage] TimeTracker.start failed:', e);
  }
}

function stopNativeTrackerAndFlush() {
  console.log('[TaskPage] stopNativeTrackerAndFlush called');
  const tt = getTimeTracker();
  console.log('[TaskPage] TimeTracker available for stop:', !!tt);
  if (!tt) {
    console.warn('[TaskPage] TimeTracker not available');
    return;
  }
  try {
    if (typeof tt.stop === 'function') {
      console.log('[TaskPage] Calling TimeTracker.stop');
      tt.stop();
    }
    if (typeof tt.sendData === 'function') {
      console.log('[TaskPage] Calling TimeTracker.sendData');
      tt.sendData();
    }
    console.log('[TaskPage] TimeTracker stopped and flushed');
  } catch (e) {
    console.error('[TaskPage] TimeTracker.stop/sendData failed:', e);
  }
}
// --- End of native helpers ---

export default function TaskPage() {
  console.log('[TaskPage] Mounted. Params:', window.location.hash, window.location.pathname, window.location.search);
  const { projectId, taskId } = useParams();
  console.log('[TaskPage] useParams:', { projectId, taskId });
  const navigate = useNavigate();
  // Build Authorization header from stored token (fallback when cookie not present)
  const getAuthHeaders = (extra = {}) => {
    try {
      const webToken = (globalThis.localStorage && globalThis.localStorage.getItem('token')) || (globalThis.sessionStorage && globalThis.sessionStorage.getItem('token')) || '';
      const hdrs = { ...extra };
      if (webToken) hdrs['Authorization'] = `Bearer ${webToken}`;
      return hdrs;
    } catch (e) { return { ...extra }; }
  };
  const [project, setProject] = useState(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  // Timer state (milliseconds)
  const [baseMs, setBaseMs] = useState(0); // accumulated time when timer is stopped
  const [runningSince, setRunningSince] = useState(null); // timestamp (ms) when timer was started
  const [displayMs, setDisplayMs] = useState(0);
  const intervalRef = useRef(null);
  const storageKey = `hg_task_timer_${projectId}_${taskId}`;
  const [timeEntries, setTimeEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState('');
  // Track whether we have ever completed a load so we don't blank the table during polling
  const [hasInitialEntriesLoaded, setHasInitialEntriesLoaded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [showTimeLapse, setShowTimeLapse] = useState(false);
  const [expandedApps, setExpandedApps] = useState({});
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [showBrainstormDialog, setShowBrainstormDialog] = useState(false);
  const [brainstormDescription, setBrainstormDescription] = useState('');
  const [brainstormDisplayMs, setBrainstormDisplayMs] = useState(0);
  const brainstormIntervalRef = useRef(null);
  const brainstormStorageKey = `hg_brainstorm_${projectId}_${taskId}`;

  // Get current user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/data`, { method: 'GET', credentials: 'include', headers: getAuthHeaders() });
        const json = await res.json();
        if (!mounted) return;
        if (!json || !json.success || !json.userData) {
          try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) {}
          try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) {}
          navigate('/login');
        } else {
          setCurrentUser(json.userData);
        }
      } catch (err) {
        try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) {}
        try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) {}
        navigate('/login');
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!projectId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, { credentials: 'include', headers: buildHeaders() });
        if (!mounted) return;
        if (res.ok) {
          const p = await res.json();
          setProject(p);
          const found = (p.tasks || []).find(t => String(t._id) === String(taskId) || String(t._clientId) === String(taskId));
          setTask(found || null);
        } else {
          console.error('Failed to fetch project for task page', res.status);
        }
      } catch (err) {
        console.error('Task page fetch error', err);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId, taskId]);

  // initialize timer state when task loads
  useEffect(()=>{
    if (!task) return;
    
    const initial = Number(task.timeSpent) || 0;
    setBaseMs(initial);
    
    // set assignee to current logged-in user if not assigned
    try {
      const rawUser = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser);
        const userDisplay = parsedUser?.username || parsedUser?.name || parsedUser?.email || parsedUser?._id || null;
        if (userDisplay && (!task.assignee || task.assignee === '')) {
          setTask(prev => prev ? { ...prev, assignee: userDisplay } : prev);
        }
      }
    } catch (err) {
      console.warn('Could not parse current user from storage', err);
    }
    
    // try to load persisted running state for this task
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.runningSince) {
          console.log('[TaskPage] Restoring running timer from sessionStorage', { runningSince: parsed.runningSince });
          setRunningSince(parsed.runningSince);
          
          // Check if native tracker is still running
          const tt = (globalThis && globalThis.TimeTracker) ? globalThis.TimeTracker : null;
          if (tt && typeof tt.status === 'function') {
            tt.status().then(status => {
              console.log('[TaskPage] Native tracker status on restore:', status);
              // If tracker stopped but timer was running, restart it
              if (!status || !status.running) {
                console.log('[TaskPage] Restarting native tracker after page navigation');
                if (typeof tt.start === 'function') {
                  const token = (globalThis.localStorage && globalThis.localStorage.getItem('token')) || (globalThis.sessionStorage && globalThis.sessionStorage.getItem('token')) || '';
                  if (token && typeof tt.setAuthToken === 'function') {
                    tt.setAuthToken(token);
                  }
                  const pId = project && project._id ? String(project._id) : String(projectId || '');
                  tt.start('', pId, String(taskId), 200).then(res => {
                    console.log('[TaskPage] Native tracker restarted:', res);
                  });
                }
              }
            }).catch(err => console.warn('[TaskPage] Failed to check tracker status:', err));
          }
        }
        // if accumulated stored (optional), prefer it
        if (parsed && typeof parsed.accumulated === 'number') {
          setBaseMs(parsed.accumulated);
        }
      }
    } catch (e) {
      console.warn('Could not parse persisted timer state', e);
    }
  }, [task, storageKey, project, projectId, taskId]);

  // Restore brainstorming state if present and keep a separate visible timer ticking
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(brainstormStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.runningSince) {
          setIsBrainstorming(true);
          const startedAt = Number(parsed.runningSince);
          // start ticking display timer
          if (brainstormIntervalRef.current) clearInterval(brainstormIntervalRef.current);
          const tick = () => setBrainstormDisplayMs(Date.now() - startedAt);
          tick();
          brainstormIntervalRef.current = setInterval(tick, 1000);
        }
        if (parsed && typeof parsed.description === 'string') {
          setBrainstormDescription(parsed.description);
        }
      }
    } catch (e) {
      console.debug('Brainstorm restore failed', e);
    }
    return () => {
      if (brainstormIntervalRef.current) {
        clearInterval(brainstormIntervalRef.current);
        brainstormIntervalRef.current = null;
      }
    };
  }, [brainstormStorageKey]);

  // Centralized fetch for time entries (used for polling and refresh after posts)
  const fetchEntries = React.useCallback(async () => {
    if (!task) return;
    setEntriesLoading(true);
    setEntriesError('');
    try {
      // Use the new project-specific endpoint that filters by user role
      const url = `${API_BASE_URL}/api/time-entries/project/${encodeURIComponent(projectId)}?taskId=${encodeURIComponent(taskId)}`;
      const res = await fetch(url, { credentials: 'include', headers: buildHeaders() });
      if (res.ok) {
        const data = await res.json();
        console.debug('[TaskPage] fetchEntries response', { data });
        
        // Handle different response formats based on user role
        if (data.isManager) {
          // Manager view: show summary but for task view, only show current task's logs
          const allTaskEntries = [];
          if (data.employeeStats) {
            for (const empStat of data.employeeStats) {
              allTaskEntries.push(...(empStat.entries || []));
            }
          }
          setTimeEntries(allTaskEntries);
        } else {
          // Employee view: only their own entries
          setTimeEntries(data.entries || []);
        }
        // Mark that at least one load has completed successfully
        if (!hasInitialEntriesLoaded) setHasInitialEntriesLoaded(true);
      } else {
        console.error('Failed to load time entries', res.status);
        setEntriesError('Failed to load usage logs');
        // Even on error after first render, avoid flicker
        if (!hasInitialEntriesLoaded && (timeEntries || []).length > 0) {
          setHasInitialEntriesLoaded(true);
        }
      }
    } catch (err) {
      console.error('load entries error', err);
      setEntriesError('Failed to load usage logs');
      if (!hasInitialEntriesLoaded && (timeEntries || []).length > 0) {
        setHasInitialEntriesLoaded(true);
      }
    } finally {
      setEntriesLoading(false);
    }
  }, [task, projectId, taskId, hasInitialEntriesLoaded, timeEntries]);

  // Helper to post a brainstorm entry to backend and refresh entries
  const postBrainstormEntry = async (startMs, endMs, description) => {
    try {
      const payload = {
        appointment: {
          apptitle: description && description.trim() ? `Brainstorming: ${description.trim()}` : 'Brainstorming',
          appname: 'Brainstorming',
          startTime: new Date(startMs).toISOString(),
          endTime: new Date(endMs).toISOString(),
          duration: Math.max(0, Math.round((endMs - startMs) / 1000))
        },
        projectId: project && project._id ? String(project._id) : String(projectId || ''),
        description: String(taskId)
      };
      const res = await fetch(`${API_BASE_URL}/api/time-entries`, {
        method: 'POST',
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      // Log server response for debugging
      try {
        const body = await res.clone().text();
        console.debug('[TaskPage] POST /api/time-entries response status', res.status, 'body:', body);
      } catch (e) { console.debug('[TaskPage] Failed to read POST response body', e); }
      if (!res.ok) {
        const txt = await res.text();
        console.warn('Failed to store brainstorming entry', res.status, txt);
      }
      // Refresh entries table using centralized fetch
      try { await fetchEntries(); } catch (e) { console.debug('refresh after post failed', e); }
    } catch (err) {
      console.error('Error posting brainstorming entry', err);
    }
  };

  // Polling effect for live updates
  useEffect(() => {
    if (!task) return;
    fetchEntries();
    const poll = setInterval(fetchEntries, 5000);
    return () => { clearInterval(poll); };
  }, [task, fetchEntries]);

  // manage interval to update visible timer
  useEffect(() => {
    // clear previous
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    function tick() {
      if (runningSince) {
        setDisplayMs(baseMs + (Date.now() - runningSince));
      } else {
        setDisplayMs(baseMs);
      }
    }
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runningSince, baseMs]);

  const startTimerInternal = async () => {
    if (runningSince) return; // already running
    const now = Date.now();
    setRunningSince(now);
    // persist
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ runningSince: now, accumulated: baseMs }));
    } catch (e) { console.warn('Failed to persist running state', e); }

    // Check if task has billable time and update status to in-progress if currently todo
    const hasRecordedTime = baseMs > 0;
    const currentStatus = task?.status || 'todo';
    if (currentStatus === 'todo' && hasRecordedTime && project?._id && task?._id) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/projects/${project._id}/tasks/${task._id}/status`, {
          method: 'PATCH',
          credentials: 'include',
          headers: buildHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: 'in-progress' })
        });
        if (res.ok) {
          const updatedProject = await res.json();
          setProject(updatedProject);
          const updatedTask = (updatedProject.tasks || []).find(t => String(t._id) === String(taskId) || String(t.clientId) === String(taskId));
          if (updatedTask) {
            setTask(updatedTask);
          }
          console.log('Task status updated to in-progress');
        }
      } catch (err) {
        console.error('Failed to update task status:', err);
      }
    }

    // Start native tracker if available
    console.log('[TaskPage] Starting native tracker...');
    try {
      const tt = (globalThis && globalThis.TimeTracker) ? globalThis.TimeTracker : null;
      console.log('[TaskPage] TimeTracker available:', !!tt);
      if (tt && typeof tt.start === 'function') {
        const token = (globalThis.localStorage && globalThis.localStorage.getItem('token')) || (globalThis.sessionStorage && globalThis.sessionStorage.getItem('token')) || '';
        if (token && typeof tt.setAuthToken === 'function') {
          console.log('[TaskPage] Setting auth token');
          tt.setAuthToken(token);
        }
        const pId = project && project._id ? String(project._id) : String(projectId || '');
        console.log('[TaskPage] Calling TimeTracker.start with:', { project: pId, taskId });
        const startRes = await tt.start('', pId, String(taskId), 200);
        console.log('[TaskPage] TimeTracker.start returned:', startRes);
        if (!startRes || startRes.ok === false) {
          console.warn('[TaskPage] Native tracker reported failure to start', startRes);
        }
        // if the preload exposes a status helper, query it and log
        if (typeof tt.status === 'function') {
          const s = await tt.status();
          console.log('[TaskPage] TimeTracker.status:', s);
        }
        console.log('[TaskPage] TimeTracker.start called successfully');
      } else {
        console.warn('[TaskPage] TimeTracker.start not available');
      }
    } catch (err) { 
      console.error('[TaskPage] Native tracker start failed:', err); 
    }
  };

  const stopTimerInternal = () => {
    if (!runningSince) return;
    const now = Date.now();
    const delta = now - runningSince;
    const newBase = baseMs + delta;
    setBaseMs(newBase);
    setRunningSince(null);
    // update task local state so UI reflects new timeSpent
    setTask(prev => prev ? { ...prev, timeSpent: newBase } : prev);
    // cleanup persisted running state but keep accumulated value
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ accumulated: newBase }));
    } catch (e) { console.warn('Failed to persist accumulated time', e); }

    // Stop native tracker and flush
    console.log('[TaskPage] Stopping native tracker...');
    try {
      const tt = (globalThis && globalThis.TimeTracker) ? globalThis.TimeTracker : null;
      console.log('[TaskPage] TimeTracker available for stop:', !!tt);
      if (tt && typeof tt.stop === 'function') {
        console.log('[TaskPage] Calling TimeTracker.stop');
        tt.stop();
        if (typeof tt.sendData === 'function') {
          console.log('[TaskPage] Calling TimeTracker.sendData');
          tt.sendData();
        }
        console.log('[TaskPage] TimeTracker stopped and data sent');
      } else {
        console.warn('[TaskPage] TimeTracker.stop not available');
      }
    } catch (err) { 
      console.error('[TaskPage] Native tracker stop failed:', err); 
    }
  };

  const formatMs = ms => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const s = total % 60;
    const m = Math.floor(total / 60) % 60;
    const h = Math.floor(total / 3600);
    const pad = v => String(v).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  // Show date along with time for start/end cells
  const formatDateTime = (isoLike) => {
    if (!isoLike) return '-';
    const d = new Date(isoLike);
    // Keep it simple and locale-aware: date + time
    const datePart = d.toLocaleDateString();
    const timePart = d.toLocaleTimeString();
    return `${datePart} ${timePart}`;
  };

  // Group time entries by app name
  const groupedEntries = React.useMemo(() => {
    const groups = {};
    let uniqueKeyCounter = 0; // Counter for unique keys
    // Defensive logging of incoming timeEntries
    try { console.debug('[TaskPage] grouping timeEntries count', Array.isArray(timeEntries) ? timeEntries.length : 0); } catch(e){}
    // Flatten appointments array from each TimeEntry
    for (const entry of (timeEntries || [])) {
      const apts = entry && entry.appointments && Array.isArray(entry.appointments) ? entry.appointments : [];
      for (const apt of apts) {
        const appName = apt && apt.appname ? apt.appname : 'Unknown';
        if (!groups[appName]) groups[appName] = [];
        const intervals = apt && apt.timeIntervals && Array.isArray(apt.timeIntervals) ? apt.timeIntervals : [];
        if (intervals.length === 0) {
          // keep the group present but log why there are zero sessions for this appointment
          console.debug('[TaskPage] appointment has no intervals', { project: entry.project, apptitle: apt.apptitle, appname: appName, taskId: apt.taskId });
        }
        for (const interval of intervals) {
          groups[appName].push({
            _id: `${entry._id}_${uniqueKeyCounter++}`,
            appointment: {
              apptitle: apt.apptitle,
              appname: apt.appname,
              taskId: apt.taskId,
              startTime: interval.startTime,
              endTime: interval.endTime,
              duration: interval.duration,
              isBillable: apt.isBillable,
              suggestedCategory: apt.suggestedCategory
            }
          });
        }
      }
    }
    console.debug('[TaskPage] groupedEntries keys and counts', Object.keys(groups).reduce((acc,k)=>{acc[k]=groups[k].length; return acc;},{ }));
    return groups;
  }, [timeEntries]);

  // Calculate time breakdown by category
  const timeBreakdown = React.useMemo(() => {
    let billable = 0;
    let nonBillable = 0;
    let ambiguous = 0;
    
    for (const entries of Object.values(groupedEntries)) {
      for (const entry of entries) {
        const duration = entry.appointment?.duration || 0;
        if (entry.appointment?.isBillable) {
          billable += duration;
        } else if (entry.appointment?.suggestedCategory === 'non-billable') {
          nonBillable += duration;
        } else {
          ambiguous += duration;
        }
      }
    }
    
    return { billable, nonBillable, ambiguous, total: billable + nonBillable + ambiguous };
  }, [groupedEntries]);

  const toggleApp = (appName) => {
    setExpandedApps(prev => ({
      ...prev,
      [appName]: !prev[appName]
    }));
  };

  const calculateTotalDuration = (entries) => {
    return entries.reduce((sum, e) => sum + (e.appointment?.duration || 0), 0);
  };

  const assigneeDisplay = (() => {
    if (!task) return null;
    const a = task.assignee || task.assignedTo || task.assigneeName;
    if (!a) return null;
    // if it's an object, prefer username, then name, then _id
    if (typeof a === 'object') {
      return a.username || a.name || (a._id ? String(a._id) : String(a));
    }
    // primitive (string/number)
    return String(a);
  })();

  // Permission checks: only the assigned member may start/stop timers.
  const userIdentifiers = currentUser ? [currentUser.username, currentUser.email, currentUser._id].filter(Boolean).map((s) => String(s).toLowerCase()) : [];
  const isAssigned = userIdentifiers.length > 0 && userIdentifiers.includes(String(assigneeDisplay || '').toLowerCase());
  const isManagerFlag = currentUser && (currentUser.role === 'manager' || currentUser.isManager === true);
  const canStartStop = Boolean(isAssigned);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-brand-bg text-gray-200">
      <p>Loading...</p>
    </div>
  );
  
  if (!project || !task) return (
    <div className="h-screen flex flex-col items-center justify-center bg-brand-bg text-gray-200 p-4">
      <h2 className="text-2xl font-bold text-white mb-4">{!project ? 'Project not found' : 'Task not found'}</h2>
      <button
        onClick={() => navigate(-1)}
        className="group flex items-center justify-center gap-2 border border-cyan text-cyan font-semibold py-2 px-5 rounded-lg hover:bg-cyan hover:text-brand-bg transition-all duration-300"
      >
        <RiArrowLeftLine className="text-xl transition-transform duration-300 group-hover:-translate-x-1" />
        <span>Back</span>
      </button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-brand-bg text-gray-200 p-4 md:p-8">
      {/* === MODIFICATION: Width changed to max-w-7xl === */}
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
          <h2 className="text-3xl font-bold text-white text-center truncate">
            {task.title || task.name || 'Untitled task'}
          </h2>
          <div className="w-28"></div> {/* Spacer to balance header */}
        </div>

        {/* === MODIFICATION: Main Content is now a Grid === */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          
          {/* === Left Column (Sidebar) === */}
          <div className="lg:col-span-1 space-y-6 lg:overflow-y-auto pb-4">
            <div className="bg-surface rounded-lg shadow-md p-6">
              <h3 className="text-2xl font-semibold text-white mb-4">Task Details</h3>
              <dl className="space-y-4">
                <div className="flex flex-col sm:flex-row">
                  <dt className="w-32 flex-shrink-0 font-semibold text-gray-400">Project</dt>
                  <dd className="text-gray-200">{project.ProjectName || project.name}</dd>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <dt className="w-32 flex-shrink-0 font-semibold text-gray-400">Status</dt>
                  <dd className="text-gray-200 capitalize">{task.status || 'todo'}</dd>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <dt className="w-32 flex-shrink-0 font-semibold text-gray-400">Assignee</dt>
                  <dd className="text-gray-200">{assigneeDisplay || 'Unassigned'}</dd>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <dt className="w-32 flex-shrink-0 font-semibold text-gray-400">Due</dt>
                  <dd className="text-gray-200">{task.dueDate ? new Date(task.dueDate).toLocaleString() : '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-surface rounded-lg shadow-md p-6">
              <h3 className="text-2xl font-semibold text-white mb-4">Timer</h3>
              <div className="text-5xl font-bold text-white mb-4">{formatMs(displayMs)}</div>
              <div className="flex flex-wrap gap-4 items-center mb-4">
                <button
                  onClick={startTimerInternal}
                  disabled={!!runningSince || !canStartStop}
                  title={canStartStop ? 'Start timer' : 'Only the assigned member can start this timer'}
                  className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start
                </button>
                <button
                  onClick={stopTimerInternal}
                  disabled={!runningSince || !canStartStop}
                  title={canStartStop ? 'Stop timer' : 'Only the assigned member can stop this timer'}
                  className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Stop
                </button>
                {runningSince ? (
                  <span className="text-green-400 animate-pulse">Running…</span>
                ) : (
                  <span className="text-gray-400">Paused</span>
                )}
              </div>
              {!canStartStop && (
                <div className="text-sm text-gray-400 mt-1">
                  {isManagerFlag
                    ? 'Managers cannot start/stop timers — only the assigned member may.'
                    : 'Only the assigned member may start/stop this timer.'}
                </div>
              )}
              
              <div className="border-t border-surface-light pt-4 mt-6">
                <h4 className="text-xl font-semibold text-white mb-3">Billing</h4>
                <dl className="space-y-3">
                  <div className="flex flex-col sm:flex-row">
                    <dt className="w-48 flex-shrink-0 font-semibold text-gray-400">Billable Rate (per Hour)</dt>
                    <dd className="text-gray-200">{task.billableRate ? `₹${task.billableRate.toFixed(2)}` : 'Not specified'}</dd>
                  </div>
                  <div className="flex flex-col sm:flex-row">
                    <dt className="w-48 flex-shrink-0 font-semibold text-gray-400">Total Amount</dt>
                    <dd className="text-2xl font-bold text-cyan">{task.billableRate && displayMs > 0 ? `₹${(task.billableRate * (displayMs / 3600000)).toFixed(2)}` : '—'}</dd>
                  </div>
                </dl>
              </div>
              
              <div className="border-t border-surface-light pt-4 mt-6">
                <h4 className="text-xl font-semibold text-white mb-3">Description</h4>
                <p className="text-gray-300 prose prose-invert">{task.description || task.desc || task.body || 'No description'}</p>
              </div>
            </div>
          </div>
          
          {/* === Right Column (Main Content) === */}
          <div className="lg:col-span-2 space-y-6 lg:overflow-y-auto pb-4">
            {summary && (
              <div className="bg-surface-light border border-surface rounded-lg p-6">
                <h4 className="text-xl font-semibold text-white mt-0 mb-3">Summary — Total Time per App/Tab</h4>
                <ul className="list-disc pl-5 space-y-2">
                  {summary.map(item => (
                    <li key={item.key}>
                      <span className="font-semibold text-gray-200">{item.key}</span>: <span className="text-gray-300">{item.pretty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-surface rounded-lg shadow-md p-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                <h3 className="text-2xl font-semibold text-white m-0 flex items-center gap-3">
                  Usage Logs
                  {entriesLoading && hasInitialEntriesLoaded ? (
                    <span className="text-xs text-gray-400">Refreshing…</span>
                  ) : null}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowBrainstormDialog(true)}
                    disabled={isBrainstorming}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 shadow-md transition-all duration-200 ease-in-out  disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Start brainstorming session"
                  >
                    <RiBrainLine />
                    Start Brainstorming
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (brainstormIntervalRef.current) {
                          clearInterval(brainstormIntervalRef.current);
                          brainstormIntervalRef.current = null;
                        }
                        const now = Date.now();
                        let startMs = now;
                        try {
                          const raw = sessionStorage.getItem(brainstormStorageKey);
                          if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed && parsed.runningSince) startMs = Number(parsed.runningSince);
                          }
                        } catch (e) {
                          console.debug('Brainstorm stop: parse storage failed', e);
                        }
                        sessionStorage.removeItem(brainstormStorageKey);
                        setIsBrainstorming(false);
                        setBrainstormDisplayMs(0);
                        console.log('[TaskPage] Brainstorming stopped. Posting entry.');
                        await postBrainstormEntry(startMs, now, brainstormDescription);
                        if (brainstormDescription) {
                          alert(`Brainstorming session ended!\n\nDescription: ${brainstormDescription}`);
                        }
                      } finally {
                        setBrainstormDescription('');
                      }
                    }}
                    disabled={!isBrainstorming}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold text-gray-800 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-500 hover:to-yellow-400 shadow-md transition-all duration-200 ease-in-out  disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Stop brainstorming session"
                  >
                    <RiStopCircleLine />
                    Stop {isBrainstorming ? `(${formatMs(brainstormDisplayMs)})` : ''}
                  </button>
                  <button 
                    onClick={() => setShowTimeLapse(!showTimeLapse)} 
                    className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors text-sm"
                  >
                    {showTimeLapse ? 'Hide Time Lapse' : 'Show Time Lapse'}
                  </button>
                </div>
              </div>

              {showTimeLapse && (
                <>
                    {entriesLoading && !hasInitialEntriesLoaded ? (
                    <div className="text-gray-400">Loading usage logs…</div>
                  ) : entriesError ? (
                    <div className="text-red-500">{entriesError}</div>
                  ) : (
                      <div className="border border-surface-light rounded-lg overflow-auto">
                        {/* Time Breakdown Summary */}
                        {timeBreakdown.total > 0 && (
                          <div className="p-4 border-b border-surface bg-surface/40">
                            <div className="text-sm font-semibold text-white mb-2">Time Breakdown</div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                              <div className="bg-green-900/30 border border-green-700 rounded p-2">
                                <div className="text-green-400 font-semibold">Billable</div>
                                <div className="text-white text-lg">{formatMs(timeBreakdown.billable * 1000)}</div>
                              </div>
                              <div className="bg-red-900/30 border border-red-700 rounded p-2">
                                <div className="text-red-400 font-semibold">Non-Billable</div>
                                <div className="text-white text-lg">{formatMs(timeBreakdown.nonBillable * 1000)}</div>
                              </div>
                              <div className="bg-yellow-900/30 border border-yellow-700 rounded p-2">
                                <div className="text-yellow-400 font-semibold">Ambiguous</div>
                                <div className="text-white text-lg">{formatMs(timeBreakdown.ambiguous * 1000)}</div>
                              </div>
                              <div className="bg-blue-900/30 border border-blue-700 rounded p-2">
                                <div className="text-blue-400 font-semibold">Total</div>
                                <div className="text-white text-lg">{formatMs(timeBreakdown.total * 1000)}</div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                      {timeEntries && timeEntries.length > 0 ? (
                        <div className="space-y-4 p-4">
                          {Object.entries(groupedEntries).map(([appName, entries]) => {
                            const isExpanded = expandedApps[appName];
                            const totalDuration = calculateTotalDuration(entries);
                            return (
                              <div key={appName} className="bg-surface-light rounded-lg overflow-hidden border border-surface">
                                <div 
                                  onClick={() => toggleApp(appName)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleApp(appName); }}
                                  role="button"
                                  tabIndex={0}
                                  className="p-3 bg-surface cursor-pointer flex justify-between items-center"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-cyan text-lg">{isExpanded ? '▼' : '▶'}</span>
                                    <span className="font-semibold text-white">{appName}</span>
                                    <span className="text-xs text-gray-400">
                                      ({entries.length} session{entries.length !== 1 ? 's' : ''})
                                    </span>
                                  </div>
                                  <span className="text-sm text-gray-300">
                                    Total: {formatMs(totalDuration * 1000)}
                                  </span>
                                </div>
                                
                                {isExpanded && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-[700px]">
                                      <thead className="border-b border-surface">
                                        <tr>
                                          <th className="p-2 text-xs text-gray-400">Title</th>
                                          <th className="p-2 text-xs text-gray-400">Category</th>
                                          <th className="p-2 text-xs text-gray-400">Start Time</th>
                                          <th className="p-2 text-xs text-gray-400">End Time</th>
                                          <th className="p-2 text-xs text-gray-400">Duration</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {entries.map((e) => {
                                          const isBillable = e.appointment?.isBillable;
                                          const category = e.appointment?.suggestedCategory;
                                          let categoryBadge;
                                          if (isBillable) {
                                            categoryBadge = <span className="text-xs px-2 py-1 rounded bg-green-900/50 text-green-400 border border-green-700">Billable</span>;
                                          } else if (category === 'non-billable') {
                                            categoryBadge = <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 border border-red-700">Non-Billable</span>;
                                          } else {
                                            categoryBadge = <span className="text-xs px-2 py-1 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700">Ambiguous</span>;
                                          }
                                          
                                          return (
                                            <tr key={e._id} className="border-b border-surface">
                                              <td className="p-2 text-sm text-gray-300 truncate max-w-xs">{e.appointment?.apptitle || '-'}</td>
                                              <td className="p-2 text-sm">{categoryBadge}</td>
                                              <td className="p-2 text-sm text-gray-300">{e.appointment?.startTime ? formatDateTime(e.appointment.startTime) : '-'}</td>
                                              <td className="p-2 text-sm text-gray-300">{e.appointment?.endTime ? formatDateTime(e.appointment.endTime) : '-'}</td>
                                              <td className="p-2 text-sm text-gray-300">{e.appointment?.duration != null ? formatMs(e.appointment.duration * 1000) : '-'}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-gray-500 italic">No usage logs for this task.</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Brainstorming Dialog (Now Dark Mode) */}
      {showBrainstormDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface-light rounded-lg shadow-xl w-full max-w-lg p-6 relative">
            <button 
              onClick={() => {
                setShowBrainstormDialog(false);
                setBrainstormDescription('');
              }}
              className="absolute top-3 right-4 text-gray-400 hover:text-white text-2xl"
            >
              <RiCloseLine />
            </button>
            <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
              <RiBrainLine /> Start Brainstorming Session
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Describe what you plan to brainstorm about:
            </p>
            <textarea
              value={brainstormDescription}
              onChange={(e) => setBrainstormDescription(e.target.value)}
              placeholder="e.g., Exploring new features for the dashboard, brainstorming UI improvements, planning architecture changes..."
              className="w-full bg-surface text-gray-200 placeholder-gray-400 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface min-h-[120px] resize-vertical"
            />
            <div className="flex gap-2 justify-end mt-6">
              <button 
                onClick={() => {
                  setShowBrainstormDialog(false);
                  setBrainstormDescription('');
                }}
                className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const desc = brainstormDescription.trim();
                  if (!desc) {
                    alert('Please enter a description for your brainstorming session');
                    return;
                  }
                  const startedAt = Date.now();
                  // Persist state for recovery
                  sessionStorage.setItem(
                    brainstormStorageKey,
                    JSON.stringify({ runningSince: startedAt, description: desc })
                  );
                  // Start ticking immediately
                  if (brainstormIntervalRef.current) clearInterval(brainstormIntervalRef.current);
                  const tick = () => setBrainstormDisplayMs(Date.now() - startedAt);
                  tick();
                  brainstormIntervalRef.current = setInterval(tick, 1000);
                  setIsBrainstorming(true);
                  setShowBrainstormDialog(false);
                  console.log('[TaskPage] Brainstorming started with description:', desc);
                }}
                className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 shadow-md transition-all"
              >
                Start Brainstorming
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PropTypes are 100% preserved
TaskPage.propTypes = {
  // These are inferred from useParams() but good to be explicit if you were passing props
  // projectId: PropTypes.string,
  // taskId: PropTypes.string,
};