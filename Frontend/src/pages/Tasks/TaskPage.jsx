// src/pages/TaskPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  // Timer state (milliseconds)
  const [baseMs, setBaseMs] = useState(0); // accumulated time when timer is stopped
  const [runningSince, setRunningSince] = useState(null); // timestamp (ms) when timer was started
  const [displayMs, setDisplayMs] = useState(0);
  const intervalRef = useRef(null);
  const storageKey = `hg_task_timer_${projectId}_${taskId}`;
  const [timeEntries, setTimeEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState('');
  const [summary, setSummary] = useState(null);
  const [showTimeLapse, setShowTimeLapse] = useState(false);
  const [expandedApps, setExpandedApps] = useState({});
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [showBrainstormDialog, setShowBrainstormDialog] = useState(false);
  const [brainstormDescription, setBrainstormDescription] = useState('');
  const [brainstormDisplayMs, setBrainstormDisplayMs] = useState(0);
  const brainstormIntervalRef = useRef(null);
  const brainstormStorageKey = `hg_brainstorm_${projectId}_${taskId}`;

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
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
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn('Failed to store brainstorming entry', res.status, txt);
      }
      // Refresh entries table
      try {
        const url = `http://localhost:4000/api/time-entries?projectId=${encodeURIComponent(projectId)}&task=${encodeURIComponent(taskId)}`;
        const r2 = await fetch(url, { credentials: 'include' });
        if (r2.ok) {
          const arr = await r2.json();
          setTimeEntries(Array.isArray(arr) ? arr : []);
        }
      } catch {}
    } catch (err) {
      console.error('Error posting brainstorming entry', err);
    }
  };

  // Separate effect for fetching time entries with polling
  useEffect(() => {
    if (!task) return;
    
    // fetch related time entries for this task
    const fetchEntries = async () => {
      setEntriesLoading(true);
      setEntriesError('');
      try {
        const url = `http://localhost:4000/api/time-entries?projectId=${encodeURIComponent(projectId)}&task=${encodeURIComponent(taskId)}`;
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          const arr = await res.json();
          setTimeEntries(Array.isArray(arr) ? arr : []);
        } else {
          console.error('Failed to load time entries', res.status);
          setEntriesError('Failed to load usage logs');
        }
      } catch (err) {
        console.error('load entries error', err);
        setEntriesError('Failed to load usage logs');
      } finally { setEntriesLoading(false); }
    };
    
    fetchEntries();
    // poll every 5s for live updates while on this page
    const poll = setInterval(fetchEntries, 5000);
    return () => { clearInterval(poll); };
  }, [task, projectId, taskId]);

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
    // Flatten appointments array from each TimeEntry
    timeEntries.forEach(entry => {
      if (entry.appointments && Array.isArray(entry.appointments)) {
        entry.appointments.forEach(apt => {
          const appName = apt.appname || 'Unknown';
          if (!groups[appName]) {
            groups[appName] = [];
          }
          // Create flat entry for each time interval
          apt.timeIntervals.forEach(interval => {
            groups[appName].push({
              _id: `${entry._id}_${uniqueKeyCounter++}`, // Generate unique key
              appointment: {
                apptitle: apt.apptitle,
                appname: apt.appname,
                taskId: apt.taskId,
                startTime: interval.startTime,
                endTime: interval.endTime,
                duration: interval.duration
              }
            });
          });
        });
      }
    });
    return groups;
  }, [timeEntries]);

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
                  disabled={!!runningSince}
                  className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start
                </button>
                <button
                  onClick={stopTimerInternal}
                  disabled={!runningSince}
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
                <h3 className="text-2xl font-semibold text-white m-0">Usage Logs</h3>
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
                  {entriesLoading ? (
                    <div className="text-gray-400">Loading usage logs…</div>
                  ) : entriesError ? (
                    <div className="text-red-500">{entriesError}</div>
                  ) : (
                    <div className="border border-surface-light rounded-lg max-h-96 overflow-auto">
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
                                    <table className="w-full text-left min-w-[600px]">
                                      <thead className="border-b border-surface">
                                        <tr>
                                          <th className="p-2 text-xs text-gray-400">Title</th>
                                          <th className="p-2 text-xs text-gray-400">Start Time</th>
                                          <th className="p-2 text-xs text-gray-400">End Time</th>
                                          <th className="p-2 text-xs text-gray-400">Duration</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {entries.map((e) => (
                                          <tr key={e._id} className="border-b border-surface">
                                            <td className="p-2 text-sm text-gray-300 truncate max-w-xs">{e.appointment?.apptitle || '-'}</td>
                                            <td className="p-2 text-sm text-gray-300">{e.appointment?.startTime ? formatDateTime(e.appointment.startTime) : '-'}</td>
                                            <td className="p-2 text-sm text-gray-300">{e.appointment?.endTime ? formatDateTime(e.appointment.endTime) : '-'}</td>
                                            <td className="p-2 text-sm text-gray-300">{e.appointment?.duration != null ? formatMs(e.appointment.duration * 1000) : '-'}</td>
                                          </tr>
                                        ))}
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