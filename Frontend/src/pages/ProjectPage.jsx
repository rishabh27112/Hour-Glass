import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './ProjectPage.module.css';
import EditMembers from './ProjectPage/EditMembers.jsx';
import TasksPanel from './ProjectPage/TasksPanel.jsx';

const ProjectPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Auth check: redirect to login if not authenticated and store current user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('http://localhost:4000/api/user/data', { method: 'GET', credentials: 'include' });
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

  // For now we'll read projects from sessionStorage (set by ManagerDashboard)
  const raw = sessionStorage.getItem('hg_projects');
  const initialProjects = raw ? JSON.parse(raw) : [];
  // read current user from storage (login writes to sessionStorage or localStorage)
  const [projects, setProjects] = useState(initialProjects);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const rawUser = sessionStorage.getItem('user') || localStorage.getItem('user');
      return rawUser ? JSON.parse(rawUser) : null;
    } catch (e) {
      return null;
    }
  });
  const currentUserId = currentUser?.email || currentUser?.username || currentUser?._id || currentUser?.name || null;
  const [currentMode, setCurrentMode] = useState(null); // 'add' or 'delete'
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dialogSearchBy, setDialogSearchBy] = useState('email');
  const [dialogQuery, setDialogQuery] = useState('');
  const [dialogResults, setDialogResults] = useState([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigned, setTaskAssigned] = useState(currentUserId || '');
  const [taskStatus, setTaskStatus] = useState('todo');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssignee, setTaskAssignee] = useState(currentUserId || '');
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [showTaskFilter, setShowTaskFilter] = useState(false);
  const [filterMember, setFilterMember] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  // timer state: activeTimer { taskId, startedAt }
  const rawTimer = sessionStorage.getItem('hg_activeTimer');
  const initialActiveTimer = rawTimer ? JSON.parse(rawTimer) : null;
  const [activeTimer, setActiveTimer] = useState(initialActiveTimer);
  const [timerNow, setTimerNow] = useState(Date.now());

  const getTaskKey = (task, idx) => (task && (task._id || task._clientId)) || `task-${idx}`;

  const formatDuration = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!activeTimer) return undefined;
    const t = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeTimer]);

  const persistActiveTimer = (timer) => {
    if (timer) sessionStorage.setItem('hg_activeTimer', JSON.stringify(timer));
    else sessionStorage.removeItem('hg_activeTimer');
  };

  const pauseTimer = (taskId) => {
    if (!activeTimer || !activeTimer.taskId) return;
    const elapsed = Date.now() - activeTimer.startedAt;
    // add elapsed to the task's timeSpent
    setProjects((prev) => {
      const copy = [...prev];
      const p = copy[projectIndex] ? { ...copy[projectIndex] } : null;
      if (!p) return prev;
      const tasks = Array.isArray(p.tasks) ? p.tasks.map((t) => ({ ...t })) : [];
      const idx = tasks.findIndex((t, i) => getTaskKey(t, i) === taskId);
      if (idx !== -1) {
        const existing = tasks[idx];
        const prevMs = existing.timeSpent || 0;
        tasks[idx] = { ...existing, timeSpent: prevMs + elapsed };
        p.tasks = tasks;
        copy[projectIndex] = p;
        try { saveProjects(copy); } catch (e) { console.error('saveProjects failed', e); }
      }
      return copy;
    });
    setActiveTimer(null);
    persistActiveTimer(null);
  };

  const startTimer = (taskId) => {
    // if another timer is active, pause it first
    if (activeTimer && activeTimer.taskId && activeTimer.taskId !== taskId) {
      pauseTimer(activeTimer.taskId);
    }
    const timer = { taskId, startedAt: Date.now() };
    setActiveTimer(timer);
    persistActiveTimer(timer);
  };
  
  // Handler to submit Add Task (extracted from inline handler)
  const handleAddTaskSubmit = async () => {
    const title = (taskTitle || '').trim();
    if (!title) { setTaskError('Title is required'); return; }
    setTaskLoading(true); setTaskError('');
    try {
      // validate assignee must be a project member (if provided)
      if (taskAssignee && (!cleanedEmployees || !cleanedEmployees.includes(taskAssignee))) {
        setTaskError('Assignee must be a member of this project');
        return;
      }
      // server-backed project
      if (project && project._id) {
        // Build payload matching server schema: title, description, assignee, dueDate, status
        const payload = {
          title,
          description: taskDescription || undefined,
          assignee: taskAssignee || undefined,
          dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
          status: taskStatus,
        };
        const res = await fetch(`/api/projects/${project._id}/tasks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (res.ok) {
          // API returns updated project; normalize to the UI shape before setting state
          const normalized = {
            _id: json._id || json.id,
            name: json.ProjectName || json.name || '',
            description: json.Description || json.description || '',
            members: json.members || [],
            tasks: json.tasks || [],
            status: json.status || 'active',
            archived: json.status === 'archived',
            deleted: json.status === 'deleted',
          };
          setProjects((prev) => {
            const clone = [...prev];
            const idx = clone.findIndex(p => String(p._id) === String(project._id));
            if (idx !== -1) clone[idx] = normalized;
            try { saveProjects(clone); } catch (e) { console.error('saveProjects failed', e); }
            return clone;
          });
          setShowAddTaskDialog(false);
          setTaskTitle(''); setTaskAssigned(''); setTaskStatus('todo');
        } else {
          console.error('add task failed', res.status, json);
          setTaskError((json && json.message) || 'Failed to add task');
        }
      } else {
        // local optimistic project
        setProjects((prev) => {
          const newProjects = [...prev];
          const p = newProjects[projectIndex] ? { ...newProjects[projectIndex] } : { tasks: [] };
          const current = Array.isArray(p.tasks) ? p.tasks.slice() : [];
          const newTask = {
            _clientId: `task-${Date.now()}`,
            title,
            description: taskDescription || '',
            assignee: taskAssignee || currentUserId || taskAssigned || '',
            dueDate: taskDueDate || null,
            status: taskStatus,
            createdAt: new Date().toISOString(),
          };
          p.tasks = [...current, newTask];
          newProjects[projectIndex] = p;
          try { saveProjects(newProjects); } catch (e) { console.error('saveProjects failed', e); }
          return newProjects;
        });
        setShowAddTaskDialog(false);
        setTaskTitle(''); setTaskAssigned(''); setTaskStatus('todo');
      }
    } catch (err) {
      console.error('add task error', err);
      setTaskError('Failed to add task');
    } finally { setTaskLoading(false); }
  };
  // Find project by server _id or client-side _clientId or by numeric index (older/legacy routes)
  let project = projects.find(p => String(p._id) === id || String(p._clientId) === id);
  let projectIndex = projects.findIndex(p => String(p._id) === id || String(p._clientId) === id);
  // If not found, check if the route param is a numeric index used by ManagerDashboard
  if ((!project || projectIndex === -1) && id != null) {
    const maybeIndex = Number(id);
    if (!Number.isNaN(maybeIndex) && Number.isInteger(maybeIndex) && maybeIndex >= 0 && maybeIndex < projects.length) {
      projectIndex = maybeIndex;
      project = projects[maybeIndex];
    }
  }

  // If we couldn't find a project locally, or it is server-backed but missing tasks, fetch the single project from server
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      // Determine which id to fetch: prefer the server-backed project's _id (if present),
      // otherwise fall back to the route `id` only when it looks like an ObjectId.
      let fetchId = null;
      if (project && project._id) fetchId = project._id;
      else if (/^[0-9a-fA-F]{24}$/.test(String(id))) fetchId = id;
      // Nothing to fetch from the server for non-server-backed client projects
      if (!fetchId) return;
      try {
        const res = await fetch(`/api/projects/${fetchId}`, { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) {
          const p = await res.json();
          const normalized = [{
            _id: p._id,
            name: p.ProjectName || p.name || '',
            description: p.Description || p.description || '',
            members: p.members || [],
            createdBy: p.createdBy || null,
            tasks: p.tasks || [],
            status: p.status || 'active',
            archived: p.status === 'archived',
            deleted: p.status === 'deleted',
          }];
          setProjects(normalized);
          try { sessionStorage.setItem('hg_projects', JSON.stringify(normalized)); } catch (e) { console.warn('sessionStorage set failed', e); }
        } else {
          console.error('Failed to fetch project', res.status);
        }
      } catch (err) {
        console.error('fetch project error', err);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // determine whether the current user is the creator of this project
  const isCreator = (() => {
    if (!project || !currentUser) return false;
    const creatorId = (project.createdBy && (project.createdBy._id || project.createdBy)) || project.createdById || project.owner || null;
    const currentId = currentUser._id || currentUser.id || null;
    return creatorId && currentId && String(creatorId) === String(currentId);
  })();

  const saveProjects = (updatedProjects) => {
    sessionStorage.setItem('hg_projects', JSON.stringify(updatedProjects));
  };

  // derive a cleaned employees list for rendering and operations
  const getCleanedEmployees = () => {
    if (!project) return [];
    if (project.members && Array.isArray(project.members)) {
      return project.members
        .map((m) => {
          if (!m) return '';
          if (typeof m === 'string') return m.trim();
          // member may be a populated user object or an ObjectId-like object
          // prefer username or name, otherwise fall back to the id string
          const maybe = m.username || m.name || m._id || m.id || m.toString();
          return (maybe || '').toString().trim();
        })
        .filter((s) => s !== '');
    }
    if (Array.isArray(project.employees)) {
      return project.employees
        .map((e) => (e == null ? '' : String(e)))
        .map((s) => s.trim())
        .filter((s) => s !== '');
    }
    return [];
  };
  const cleanedEmployees = getCleanedEmployees();

  // build member rows for rendering (use structured members when available)
  const memberRows = (() => {
    const list = (project && project.members && Array.isArray(project.members)) ? project.members : cleanedEmployees || [];
    return list.map((m, idx) => {
      const displayName = (m && typeof m === 'object') ? (m.username || m.name || String(m)) : String(m);
      const usernameForApi = (m && typeof m === 'object') ? (m.username || '') : String(m);
      return (
        <tr key={`${displayName}-${idx}`}>
          <td>{idx + 1}</td>
          <td>{displayName}</td>
          <td>
            <button className={styles.deleteButton} onClick={() => handleDeleteMember(usernameForApi || displayName)} title="Remove member">🗑</button>
            {currentMode === 'delete' && isCreator && (
              <button className={styles.removeButton} onClick={() => handleRemoveMember(idx, displayName)} style={{ marginLeft: 8 }}>-</button>
            )}
          </td>
        </tr>
      );
    });
  })();

  const handleAddMember = async (identifier) => {
    // identifier may be a username (string) or an object { username, email, _id }
    // Build payload: prefer email if identifier contains '@', else username or userId
    const buildPayload = (id) => {
      const payload = {};
      if (typeof id === 'string') {
        if (id.includes('@')) payload.email = id;
        else if (/^[0-9a-fA-F]{24}$/.test(id)) payload.userId = id;
        else payload.username = id;
      } else if (id && typeof id === 'object') {
        if (id.email) payload.email = id.email;
        else if (id._id) payload.userId = id._id;
        else if (id.username) payload.username = id.username;
      }
      return payload;
    };

    // Helper: produce a display string for local-only projects when we can't contact server
    const identifierToDisplay = (id) => {
      if (!id) return '';
      if (typeof id === 'string') return id;
      if (id && typeof id === 'object') return id.username || id.email || id._id || '';
      return String(id);
    };

    // If project has a server _id, call backend to add member so it's persisted
    if (project && project._id) {
      try {
        const payload = buildPayload(identifier);
        const res = await fetch(`/api/projects/${project._id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        const updated = await res.json();
        if (res.ok) {
          // API returns populated project; normalize into the client shape we use and merge into state
          const normalize = (p) => ({
            _id: p._id,
            name: p.ProjectName || p.name || '',
            description: p.Description || p.description || '',
            members: p.members || [],
            tasks: p.tasks || [],
            status: p.status || 'active',
            archived: p.status === 'archived',
            deleted: p.status === 'deleted',
          });
          const normalized = normalize(updated);
          setProjects((prev) => {
            const clone = [...prev];
            const idx = clone.findIndex(p => String(p._id) === String(project._id));
            if (idx >= 0) clone[idx] = normalized;
            else clone.unshift(normalized);
            try { saveProjects(clone); } catch (e) { console.error('saveProjects failed', e); }
            return clone;
          });
        } else {
          console.error('add member failed', res.status, updated);
          // bubble up minimal error state (UI shows console for now)
        }
      } catch (err) {
        console.error('Error adding member', err);
      }
      return;
    }

    // Otherwise this is an optimistic/local project: update employees list locally
    setProjects((prev) => {
      const newProjects = [...prev];
      const p = newProjects[projectIndex] ? { ...newProjects[projectIndex] } : { employees: [] };
      const current = p.employees && Array.isArray(p.employees)
        ? p.employees.map((e) => (e == null ? '' : String(e))).map((s) => s.trim()).filter((s) => s !== '')
        : [];
      const display = identifierToDisplay(identifier);
      p.employees = [...current, display];
      newProjects[projectIndex] = p;
      try { saveProjects(newProjects); } catch (err) { console.error('saveProjects failed', err); }
      return newProjects;
    });
  };

  const handleRemoveMember = (index, name) => {
    setProjects((prev) => {
      const newProjects = [...prev];
      const p = newProjects[projectIndex] ? { ...newProjects[projectIndex] } : { employees: [] };
      // Recompute a normalized employee list
      const current = p.employees && Array.isArray(p.employees)
        ? p.employees.map((e) => (e == null ? '' : String(e))).map((s) => s.trim()).filter((s) => s !== '')
        : [];
      // Try to remove by exact name match first (safer if original array had odd values), else fall back to index
      let idxToRemove = -1;
      if (typeof name === 'string') {
        idxToRemove = current.indexOf(name);
      }
      if (idxToRemove === -1) idxToRemove = index;
      if (idxToRemove < 0 || idxToRemove >= current.length) {
        // nothing to remove
        return prev;
      }
      const updated = [...current.slice(0, idxToRemove), ...current.slice(idxToRemove + 1)];
      p.employees = updated;
      newProjects[projectIndex] = p;
      try { saveProjects(newProjects); } catch (err) { console.error('saveProjects failed', err); }
      return newProjects;
    });
  };

  // Delete a member: if project has a server-side _id, call DELETE endpoint
  const handleDeleteMember = async (name) => {
    if (!name) return;
  const ok = globalThis.confirm(`Remove member "${name}" from project?`);
    if (!ok) return;

    // If server-backed project, call API
    if (project && project._id) {
      try {
        const res = await fetch(`/api/projects/${project._id}/members/${encodeURIComponent(name)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const json = await res.json();
        if (res.ok) {
          // API returns populated project; normalize and merge into session
          const normalized = {
            _id: json._id || json.id,
            name: json.ProjectName || json.name || '',
            description: json.Description || json.description || '',
            members: json.members || [],
            tasks: json.tasks || [],
            status: json.status || 'active',
            archived: json.status === 'archived',
            deleted: json.status === 'deleted',
          };
          setProjects((prev) => {
            const clone = [...prev];
            const idx = clone.findIndex(p => String(p._id) === String(project._id));
            if (idx !== -1) clone[idx] = normalized;
            try { saveProjects(clone); } catch (e) { console.error('saveProjects failed', e); }
            return clone;
          });
        } else {
          console.error('delete member failed', res.status, json);
          alert((json && json.msg) || 'Failed to remove member');
        }
      } catch (err) {
        console.error('delete member error', err);
        alert('Failed to remove member');
      }
      return;
    }

    // fallback: local removal for client-only projects
    // try to find name index in cleanedEmployees
    const idx = cleanedEmployees.indexOf(name);
    if (idx !== -1) handleRemoveMember(idx, name);
  };

  if (!project) {
    return (
      <div className={styles.container}>
        <h2>Project not found</h2>
        <button onClick={() => navigate(-1)}>Go back</button>
      </div>
    );  
  }

  // prepare filtered tasks list according to filterMember / filterStatus
  const allTasks = Array.isArray(project.tasks) ? project.tasks : [];
  const getTaskAssigneeString = (t) => {
    const a = t.assignedTo || t.assignee || t.assigneeName || '';
    if (!a) return '';
    if (typeof a === 'string') return a;
    if (typeof a === 'object') return a.username || a.name || a._id || String(a) || '';
    return String(a);
  };
  const tasksToShow = allTasks.filter((t) => {
    if (filterMember) {
      const asg = getTaskAssigneeString(t);
      if (asg !== filterMember) return false;
    }
    if (filterStatus) {
      if ((t.status || 'todo') !== filterStatus) return false;
    }
    return true;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.back}>← Back</button>
        <h2>{project.name}</h2>
      </div>
      {/* Active timer bar */}
      {activeTimer && (() => {
        // find task object
        const t = (project.tasks || []).find((task, i) => getTaskKey(task, i) === activeTimer.taskId);
        const base = (t && (t.timeSpent || 0)) || 0;
        const elapsed = base + (Date.now() - activeTimer.startedAt);
        return (
          <div style={{ background: '#222', color: '#fff', padding: '8px 12px', borderRadius: 6, margin: '12px 0' }}>
            <strong>Timer</strong>: {t ? t.title : '(task)'} — {formatDuration(elapsed)}
            <button style={{ marginLeft: 12 }} onClick={() => pauseTimer(activeTimer.taskId)}>Pause</button>
          </div>
        );
      })()}
      <div className={styles.body}>
        <h3>Description</h3>
        <p>{project.description}</p>

        <div className={styles.grid}>
          <div className={styles.leftPanel}>
            <div className={styles.teamSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Team Members</h3>
                <button
                  type="button"
                  onClick={() => setShowAddDialog(true)}
                  className={styles.addMemberVisible}
                >
                  + Add Member
                </button>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows && memberRows.length > 0 ? (
                    memberRows
                  ) : (
                    <tr>
                      <td colSpan={3} className={styles.italic}>No members yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {/* compute creator status and pass currentUser so EditMembers can enable/disable actions */}
              <EditMembers
                project={project}
                onAdd={handleAddMember}
                currentMode={currentMode}
                setCurrentMode={setCurrentMode}
                onOpenAddDialog={() => setShowAddDialog(true)}
                currentUser={currentUser}
                isCreator={isCreator}
              />
              {showAddDialog && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                  <div style={{ width: 720, maxWidth: '95%', background: '#fff', borderRadius: 8, padding: 16 }}>
                    <h3>Add Member</h3>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="radio" checked={dialogSearchBy === 'email'} onChange={() => setDialogSearchBy('email')} /> Email
                      </label>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="radio" checked={dialogSearchBy === 'username'} onChange={() => setDialogSearchBy('username')} /> Username
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder={dialogSearchBy === 'email' ? 'Search by email' : 'Search by username'}
                        value={dialogQuery}
                        onChange={(e) => setDialogQuery(e.target.value)}
                        style={{ flex: 1, padding: '8px 10px' }}
                      />
                      <button onClick={async () => {
                        const q = dialogQuery.trim();
                        setDialogLoading(true);
                        setDialogError('');
                        try {
                          let url = '';
                          if (!q) url = `/api/user/search?limit=10`;
                          else if (dialogSearchBy === 'email') url = `/api/user/search?email=${encodeURIComponent(q)}`;
                          else url = `/api/user/search?username=${encodeURIComponent(q)}`;
                          const res = await fetch(url, { credentials: 'include' });
                          const json = await res.json();
                          if (res.ok) setDialogResults(json.users || []);
                          else { setDialogError((json && json.message) || 'Search failed'); setDialogResults([]); }
                        } catch (err) {
                          console.error('dialog search error', err);
                          setDialogError('Search failed');
                          setDialogResults([]);
                        } finally { setDialogLoading(false); }
                      }} disabled={dialogLoading}>{dialogLoading ? 'Searching...' : 'Search'}</button>
                      <button onClick={() => { setShowAddDialog(false); setDialogResults([]); setDialogQuery(''); setDialogError(''); }}>Cancel</button>
                    </div>
                    {dialogError && <div style={{ color: 'red', marginTop: 8 }}>{dialogError}</div>}
                    <div style={{ marginTop: 12 }}>
                      {dialogResults.length > 0 ? (
                        <table className={styles.table} style={{ width: '100%' }}>
                          <thead>
                            <tr><th>Name</th><th>Username</th><th>Email</th><th></th></tr>
                          </thead>
                          <tbody>
                            {dialogResults.map((u) => (
                              <tr key={u._id || u.email || u.username}>
                                <td>{u.name || '-'}</td>
                                <td>{u.username || '-'}</td>
                                <td>{u.email || '-'}</td>
                                <td><button onClick={async () => {
                                  await handleAddMember(u.username || u.email || u._id);
                                  setShowAddDialog(false);
                                  setDialogResults([]);
                                  setDialogQuery('');
                                  setDialogError('');
                                }}>Add</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ marginTop: 8, color: '#666' }}>No results</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <TasksPanel
            tasksToShow={tasksToShow}
            getTaskKey={getTaskKey}
            activeTimer={activeTimer}
            pauseTimer={pauseTimer}
            startTimer={startTimer}
            showTaskFilter={showTaskFilter}
            setShowTaskFilter={setShowTaskFilter}
            filterMember={filterMember}
            setFilterMember={setFilterMember}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            cleanedEmployees={cleanedEmployees}
            projectId={project && (project._id || project._clientId) }
            setShowAddTaskDialog={setShowAddTaskDialog}
            showAddTaskDialog={showAddTaskDialog}
            taskTitle={taskTitle}
            setTaskTitle={setTaskTitle}
            taskDescription={taskDescription}
            setTaskDescription={setTaskDescription}
            taskAssignee={taskAssignee}
            setTaskAssignee={setTaskAssignee}
            taskDueDate={taskDueDate}
            setTaskDueDate={setTaskDueDate}
            taskError={taskError}
            taskLoading={taskLoading}
            handleAddTaskSubmit={handleAddTaskSubmit}
            setTaskLoading={setTaskLoading}
            setTaskError={setTaskError}
            setTaskAssigned={setTaskAssigned}
            setTaskStatus={setTaskStatus}
            taskStatus={taskStatus}
          >
          </TasksPanel>
        </div>
      </div>
    </div>
  );
};

  // EditMembers component is provided by ./ProjectPage/EditMembers.jsx

export default ProjectPage;