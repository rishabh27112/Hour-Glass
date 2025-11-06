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
  useEffect(() => {
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
          setRunningSince(parsed.runningSince);
        }
        // if accumulated stored (optional), prefer it
        if (parsed && typeof parsed.accumulated === 'number') {
          setBaseMs(parsed.accumulated);
        }
      }
    } catch (e) {
      console.warn('Could not parse persisted timer state', e);
    }
  }, [task]);

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

  const startTimer = () => {
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
        const title = (task && (task.title || task.name)) || 'Task';
        console.log('[TaskPage] Calling TimeTracker.start with:', { project: pId, task: `${title} (${taskId})` });
        tt.start('', pId, `${title} (${taskId})`, 200);
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
        <p>If you want to get further details about your spending of time.</p>
       
      </div>
    </div>
  );
}
