import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../ProjectPage.module.css';

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
        taskId: String(taskId)
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
        const url = `/api/time-entries/flat?projectId=${encodeURIComponent(projectId)}&taskId=${encodeURIComponent(taskId)}`;
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
    
    // fetch related time entries for this task (flattened by intervals)
    const fetchEntries = async () => {
      setEntriesLoading(true);
      setEntriesError('');
      try {
        const url = `/api/time-entries/flat?projectId=${encodeURIComponent(projectId)}&taskId=${encodeURIComponent(taskId)}`;
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

  const startTimer = async () => {
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

  const stopTimer = () => {
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
    timeEntries.forEach(entry => {
      const appName = entry.appointment?.appname || 'Unknown';
      if (!groups[appName]) {
        groups[appName] = [];
      }
      groups[appName].push(entry);
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

  if (loading) return <div className={styles.container}><p>Loading...</p></div>;
  if (!project) return <div className={styles.container}><p>Project not found</p><button onClick={() => navigate(-1)}>Go back</button></div>;
  if (!task) return <div className={styles.container}><p>Task not found</p><button onClick={() => navigate(-1)}>Go back</button></div>;
  // prepare safe display strings for possibly-object fields to avoid rendering objects directly
  const assigneeDisplay = (() => {
    const a = task.assignee || task.assignedTo || task.assigneeName;
    if (!a) return null;
    // if it's an object, prefer username, then name, then _id
    if (typeof a === 'object') {
      return a.username || a.name || (a._id ? String(a._id) : String(a));
    }
    // primitive (string/number)
    return String(a);
  })();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.back}>← Back</button>
        <h2>{task.title || task.name || 'Untitled task'}</h2>
      </div>
      <div className={styles.body}>
        <p><strong>Project:</strong> {project.ProjectName || project.name}</p>
        <p><strong>Status:</strong> {task.status || 'todo'}</p>
  <p><strong>Assignee:</strong> {assigneeDisplay || 'Unassigned'}</p>
        <p><strong>Due:</strong> {task.dueDate ? new Date(task.dueDate).toLocaleString() : '—'}</p>
        <p>
          <strong>Time spent:</strong> {formatMs(displayMs)}
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button onClick={startTimer} disabled={!!runningSince} className={styles.cta}>Start</button>
          <button onClick={stopTimer} disabled={!runningSince} className={styles.cta}>Stop</button>
          {runningSince ? <small style={{ color: '#666' }}>Running…</small> : <small style={{ color: '#666' }}>Paused</small>}
        </div>
        <h3>Description</h3>
        <p>{task.description || task.desc || task.body || 'No description'}</p>
        <p><strong>Billable Rate in INR (per Hour):</strong> {task.billableRate ? `$${task.billableRate.toFixed(2)}` : 'Not specified'}</p>
        <p><strong>Total amount to be paid:</strong> {task.billableRate && task.timeSpent ? `$${(task.billableRate * (task.timeSpent / 3600000)).toFixed(2)}` : '—'}</p>

        {summary && (
          <div style={{ border: '1px solid #e6f4ea', background: '#f7fffb', padding: 12, borderRadius: 6, marginBottom: 12 }}>
            <h4 style={{ marginTop: 0 }}>Summary — total time per App/Tab</h4>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {summary.map(item => (
                <li key={item.key} style={{ marginBottom: 6 }}>
                  <strong>{item.key}</strong>: {item.pretty}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Usage logs</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={() => {
                setShowBrainstormDialog(true);
                console.log('[TaskPage] Opening brainstorming dialog');
              }}
              disabled={isBrainstorming}
              style={{
                background: isBrainstorming ? '#ccc' : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isBrainstorming ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                boxShadow: isBrainstorming ? 'none' : '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Start brainstorming session"
            >
              <span>💡</span>
              <span>Start Brainstorming</span>
            </button>
            <button 
              onClick={async () => {
                try {
                  // Stop ticking
                  if (brainstormIntervalRef.current) {
                    clearInterval(brainstormIntervalRef.current);
                    brainstormIntervalRef.current = null;
                  }
                  // Determine start and end
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
                  // Clear storage/state
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
              style={{
                background: !isBrainstorming ? '#ccc' : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: !isBrainstorming ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                boxShadow: !isBrainstorming ? 'none' : '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Stop brainstorming session"
            >
              <span>🛑</span>
              <span>Stop Brainstorming</span>
            </button>
            <button 
              onClick={() => setShowTimeLapse(!showTimeLapse)} 
              className={styles.cta}
              style={{ fontSize: '14px', padding: '6px 12px' }}
            >
              {showTimeLapse ? 'Hide Time Lapse' : 'Show Time Lapse'}
            </button>
          </div>
        </div>

        {showTimeLapse && (
          <>
            {entriesLoading ? (
              <div>Loading usage logs…</div>
            ) : entriesError ? (
              <div style={{ color: 'red' }}>{entriesError}</div>
            ) : (
              <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>
                {timeEntries && timeEntries.length > 0 ? (
                  <div>
                    {Object.entries(groupedEntries).map(([appName, entries]) => {
                      const isExpanded = expandedApps[appName];
                      const totalDuration = calculateTotalDuration(entries);
                      return (
                        <div key={appName} style={{ marginBottom: 16, border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
                          {/* App Header - Clickable to expand/collapse */}
                          <div 
                            onClick={() => toggleApp(appName)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleApp(appName); }}
                            role="button"
                            tabIndex={0}
                            style={{ 
                              padding: '12px', 
                              background: '#f8f9fa', 
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontWeight: 'bold',
                              borderBottom: isExpanded ? '1px solid #e0e0e0' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '16px' }}>{isExpanded ? '▼' : '▶'}</span>
                              <span>{appName}</span>
                              <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                                ({entries.length} session{entries.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <span style={{ fontSize: '14px', color: '#555', fontWeight: 'normal' }}>
                              Total: {formatMs(totalDuration * 1000)}
                            </span>
                          </div>
                          
                          {/* Expanded Time Intervals */}
                          {isExpanded && (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                                  <th style={{ padding: '8px', fontSize: '12px', color: '#666' }}>Title</th>
                                  <th style={{ padding: '8px', fontSize: '12px', color: '#666' }}>Start Time</th>
                                  <th style={{ padding: '8px', fontSize: '12px', color: '#666' }}>End Time</th>
                                  <th style={{ padding: '8px', fontSize: '12px', color: '#666' }}>Duration</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entries.map((e) => (
                                  <tr key={e._id} style={{ borderBottom: '1px solid #f6f6f6' }}>
                                    <td style={{ padding: '8px', fontSize: '13px' }}>{e.appointment?.apptitle || '-'}</td>
                                    <td style={{ padding: '8px', fontSize: '13px' }}>{e.appointment?.startTime ? formatDateTime(e.appointment.startTime) : '-'}</td>
                                    <td style={{ padding: '8px', fontSize: '13px' }}>{e.appointment?.endTime ? formatDateTime(e.appointment.endTime) : '-'}</td>
                                    <td style={{ padding: '8px', fontSize: '13px' }}>{e.appointment?.duration != null ? formatMs(e.appointment.duration * 1000) : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.italic}>No usage logs for this task.</div>
                )}
              </div>
            )}
          </>
        )}

        {/* Brainstorming Dialog */}
        {showBrainstormDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#333' }}>
                💡 Start Brainstorming Session
              </h3>
              <p style={{ marginBottom: '16px', color: '#666', fontSize: '14px' }}>
                Describe what you plan to brainstorm about:
              </p>
              <textarea
                value={brainstormDescription}
                onChange={(e) => setBrainstormDescription(e.target.value)}
                placeholder="e.g., Exploring new features for the dashboard, brainstorming UI improvements, planning architecture changes..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  marginBottom: '20px'
                }}
              />
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowBrainstormDialog(false);
                    setBrainstormDescription('');
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#666',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
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
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  Start Brainstorming
                </button>
              </div>
            </div>
          </div>
        )}
       
      </div>
    </div>
  );
}
