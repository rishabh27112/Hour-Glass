// src/pages/ProjectPage.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TasksPanel from './ProjectPage/TasksPanel.jsx';
import TimeLogsPanel from './ProjectPage/TimeLogsPanel.jsx';
import { 
  RiArrowLeftLine, RiUserAddLine, RiCloseLine, RiSearchLine, RiDeleteBinLine 
} from 'react-icons/ri';

// --- Native time tracker helpers (All logic is 100% preserved) ---
const getTimeTracker = () => (globalThis && globalThis.TimeTracker) ? globalThis.TimeTracker : null;

function startNativeTrackerForTask(project, task, taskId, currentUser) {
  console.log('[ProjectPage] startNativeTrackerForTask called:', { project: project?._id, taskId });
  const tt = getTimeTracker();
  console.log('[ProjectPage] TimeTracker available:', !!tt);
  if (!tt || typeof tt.start !== 'function') {
    console.warn('[ProjectPage] TimeTracker.start not available');
    return;
  }
  try {
    try {
      const webToken = (globalThis.localStorage && globalThis.localStorage.getItem('token')) || (globalThis.sessionStorage && globalThis.sessionStorage.getItem('token')) || '';
      if (webToken && typeof tt.setAuthToken === 'function') {
        console.log('[ProjectPage] Setting auth token');
        tt.setAuthToken(webToken);
      }
    } catch {}
    const projId = (project && project._id) ? String(project._id) : '';
    // Use task title from startTimer call
    // const taskTitle = (task && (task.title || task.name)) || 'Task';
    const userStr = (currentUser && (currentUser.username || currentUser.email || currentUser._id || currentUser.name)) || '';
    console.log('[ProjectPage] Calling TimeTracker.start with:', { user: userStr, project: projId, taskId });
    // Pass task title and ID separately
    tt.start(String(userStr), String(projId), String(taskId), 200); 
    console.log('[ProjectPage] TimeTracker.start completed');
  } catch (e) {
    console.error('[ProjectPage] TimeTracker.start failed:', e);
  }
}

function stopNativeTrackerAndFlush() {
  console.log('[ProjectPage] stopNativeTrackerAndFlush called');
  const tt = getTimeTracker();
  console.log('[ProjectPage] TimeTracker available for stop:', !!tt);
  if (!tt) {
    console.warn('[ProjectPage] TimeTracker not available');
    return;
  }
  try {
    if (typeof tt.stop === 'function') {
      console.log('[ProjectPage] Calling TimeTracker.stop');
      tt.stop();
    }
    if (typeof tt.sendData === 'function') {
      console.log('[ProjectPage] Calling TimeTracker.sendData');
      tt.sendData();
    }
    console.log('[ProjectPage] TimeTracker stopped and flushed');
  } catch (e) {
    console.error('[ProjectPage] TimeTracker.stop/sendData failed:', e);
  }
}
// --- End of native helpers ---

const ProjectPage = () => {
  // --- All state and logic is 100% preserved ---
  const { id } = useParams();
  const navigate = useNavigate();
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
          navigate('/signin');
        } else {
          setCurrentUser(json.userData);
        }
      } catch (err) {
        try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) {}
        try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) {}
        navigate('/signin');
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);
  const raw = sessionStorage.getItem('hg_projects');
  const initialProjects = raw ? JSON.parse(raw) : [];
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
  const [currentMode, setCurrentMode] = useState(null);
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
    const starter = activeTimer.startedBy || null;
    // Only the user who started the timer may pause/stop it. Managers/project owners are no longer allowed to stop others' timers.
    if (starter) {
      const isStarter = currentUser && (
        (currentUser.username && String(starter).toLowerCase() === String(currentUser.username).toLowerCase())
        || (currentUser.email && String(starter).toLowerCase() === String(currentUser.email).toLowerCase())
        || (currentUser._id && String(starter).toLowerCase() === String(currentUser._id).toLowerCase())
      );
      if (!isStarter) {
        console.debug('pauseTimer blocked - not starter', { starter, currentUser });
        alert(`Only ${starter} can stop this timer`);
        return;
      }
    }
    const elapsed = Date.now() - activeTimer.startedAt;
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
    
    // Use the new helper function
    stopNativeTrackerAndFlush();

    setActiveTimer(null);
    persistActiveTimer(null);
  };
  const startTimer = async (taskId) => {
    const p = projects[projectIndex] ? { ...projects[projectIndex] } : null;
    if (!p) return;
    const tasks = Array.isArray(p.tasks) ? p.tasks : [];
    const idx = tasks.findIndex((t, i) => getTaskKey(t, i) === taskId);
    if (idx === -1) return;
    const task = tasks[idx];
    let assignee = '';
    const pickFromObj = (obj) => (obj && (obj.username || obj.email || obj.name || obj._id)) || '';
    if (task.assignedTo) {
      assignee = typeof task.assignedTo === 'object' ? pickFromObj(task.assignedTo) : String(task.assignedTo);
    } else if (task.assignee) {
      assignee = typeof task.assignee === 'object' ? pickFromObj(task.assignee) : String(task.assignee);
    } else if (task.assigneeName) {
      assignee = String(task.assigneeName);
    }
    assignee = (assignee || '').trim();
    // Enforce: if a task has an assignee, only that assigned user may start the timer.
    if (assignee) {
      const matchesAssignee = currentUser && (
        (currentUser.username && String(currentUser.username).toLowerCase() === assignee.toLowerCase())
        || (currentUser.email && String(currentUser.email).toLowerCase() === assignee.toLowerCase())
        || (currentUser._id && String(currentUser._id).toLowerCase() === assignee.toLowerCase())
      );
      if (!matchesAssignee) {
        alert('Only the assigned member can start this task timer');
        return;
      }
    }
    if (activeTimer && activeTimer.taskId && activeTimer.taskId !== taskId) {
      pauseTimer(activeTimer.taskId);
    }
    const timer = { taskId, startedAt: Date.now(), startedBy: (currentUser && currentUser.username) || null };
    setActiveTimer(timer);
    persistActiveTimer(timer);
    
    // Check if task has billable time and update status to in-progress if currently todo
    const hasRecordedTime = (task.timeSpent && Number(task.timeSpent) > 0) || (task.time && Number(task.time) > 0);
    const currentStatus = task.status || 'todo';
    if (currentStatus === 'todo' && hasRecordedTime) {
      try {
        const actualTaskId = task._id || task._clientId;
        if (actualTaskId && p._id) {
          const res = await fetch(`/api/projects/${p._id}/tasks/${actualTaskId}/status`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in-progress' })
          });
          if (res.ok) {
            const updatedProject = await res.json();
            setProjects((prev) => {
              const copy = [...prev];
              copy[projectIndex] = updatedProject;
              try { saveProjects(copy); } catch (e) { console.error('saveProjects failed', e); }
              return copy;
            });
            console.log('Task status updated to in-progress');
          }
        }
      } catch (err) {
        console.error('Failed to update task status:', err);
      }
    }
    
    // Use the new helper function
    startNativeTrackerForTask(p, task, taskId, currentUser);
  };
  const handleAddTaskSubmit = async () => {
    const title = (taskTitle || '').trim();
    if (!title) { setTaskError('Title is required'); return; }
    setTaskLoading(true); setTaskError('');
    try {
      const normalizedEmployees = (cleanedEmployees || []).map((s) => String(s).trim().toLowerCase());
      const normalizedAssignee = taskAssignee ? String(taskAssignee).trim().toLowerCase() : '';
      if (taskAssignee && (!normalizedEmployees.length || !normalizedEmployees.includes(normalizedAssignee))) {
        setTaskError('Assignee must be a member of this project');
        setTaskLoading(false); // Stop loading on validation error
        return;
      }
      if (project && project._id) {
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
          const returned = json || {};
          const existingMembers = Array.isArray(project && project.members) ? project.members.slice() : [];
          const returnedMembers = Array.isArray(returned.members) ? returned.members.slice() : null;
          let members = returnedMembers !== null ? returnedMembers : existingMembers;
          const extractOwnerId = (owner) => {
            if (!owner) return null;
            if (typeof owner === 'object') return owner.username || owner.email || owner._id || null;
            return String(owner);
          };
          const ownerId = extractOwnerId(returned.createdBy) || extractOwnerId(project && project.createdBy) || extractOwnerId(project && (project.createdByUsername || project.owner || project.ownerUsername)) || (currentUser && (currentUser.username || currentUser.email || currentUser._id)) || null;
          if (ownerId) {
            const present = members.some((m) => {
              if (!m) return false;
              if (typeof m === 'object') return String(m.username || m.email || m._id || '').toLowerCase() === String(ownerId).toLowerCase();
              return String(m).toLowerCase() === String(ownerId).toLowerCase();
            });
            if (!present) members.unshift(ownerId);
          }
          const normalized = {
            _id: returned._id || returned.id || project._id,
            name: returned.ProjectName || returned.name || project.name || '',
            description: returned.Description || returned.description || project.description || '',
            members,
            createdBy: returned.createdBy || project.createdBy || null,
            tasks: Array.isArray(returned.tasks) ? returned.tasks.slice() : (Array.isArray(project && project.tasks) ? project.tasks.slice() : []),
            status: returned.status || project.status || 'active',
            archived: (returned.status || project.status) === 'archived',
            deleted: (returned.status || project.status) === 'deleted',
          };
          setProjects((prev) => {
            const clone = [...prev];
            const idx = clone.findIndex(p => String(p._id) === String(project._id));
            if (idx !== -1) clone[idx] = { ...clone[idx], ...normalized };
            try { saveProjects(clone); } catch (e) { console.error('saveProjects failed', e); }
            return clone;
          });
          setShowAddTaskDialog(false);
          setTaskTitle(''); setTaskAssigned(''); setTaskAssignee(''); setTaskStatus('todo'); setTaskDescription(''); setTaskDueDate('');
        } else {
          console.error('add task failed', res.status, json);
          setTaskError((json && json.message) || 'Failed to add task');
        }
      } else {
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
        setTaskTitle(''); setTaskAssigned(''); setTaskAssignee(''); setTaskStatus('todo'); setTaskDescription(''); setTaskDueDate('');
      }
    } catch (err) {
      console.error('add task error', err);
      setTaskError('Failed to add task');
    } finally { setTaskLoading(false); }
  };
  let project = projects.find(p => String(p._id) === id || String(p._clientId) === id);
  let projectIndex = projects.findIndex(p => String(p._id) === id || String(p._clientId) === id);
  if ((!project || projectIndex === -1) && id != null) {
    const maybeIndex = Number(id);
    if (!Number.isNaN(maybeIndex) && Number.isInteger(maybeIndex) && maybeIndex >= 0 && maybeIndex < projects.length) {
      projectIndex = maybeIndex;
      project = projects[maybeIndex];
    }
  }
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      let fetchId = null;
      if (project && project._id) fetchId = project._id;
      else if (/^[0-9a-fA-F]{24}$/.test(String(id))) fetchId = id;
      if (!fetchId) return;
      try {
        const res = await fetch(`/api/projects/${fetchId}`, { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) {
            const p = await res.json();
            const rawMembers = Array.isArray(p.members) ? p.members.slice() : [];
            const extractOwnerId = (owner) => {
              if (!owner) return null;
              if (typeof owner === 'object') return owner.username || owner.email || owner._id || null;
              return String(owner);
            };
            const ownerId = extractOwnerId(p.createdBy) || extractOwnerId(p.createdByUsername) || extractOwnerId(p.owner) || extractOwnerId(p.ownerUsername) || extractOwnerId(p.createdById) || null;
            if (ownerId) {
              const present = rawMembers.some((m) => {
                if (!m) return false;
                if (typeof m === 'object') {
                  return String(m.username || m.email || m._id || '').toLowerCase() === String(ownerId).toLowerCase();
                }
                return String(m).toLowerCase() === String(ownerId).toLowerCase();
              });
              if (!present) rawMembers.unshift(ownerId);
            }
            const normalized = [{
              _id: p._id,
              name: p.ProjectName || p.name || '',
              description: p.Description || p.description || '',
              members: rawMembers,
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

  const isCreator = (() => {
    if (!project || !currentUser) return false;
    let projectCreators = [];
    if (project.createdBy) {
      if (typeof project.createdBy === 'object') {
        projectCreators = projectCreators.concat([
          String(project.createdBy._id || ''),
          String(project.createdBy.username || ''),
          String(project.createdBy.email || ''),
          String(project.createdBy.name || ''),
        ]);
      } else {
        projectCreators.push(String(project.createdBy));
      }
    }
    for (const k of ['createdById', 'createdByUsername', 'createdByEmail', 'owner', 'ownerUsername', 'ownerEmail']) {
      if (project[k]) projectCreators.push(String(project[k]));
    }
    const userIds = [currentUser._id, currentUser.id, currentUser.username, currentUser.email, currentUser.name]
      .filter(Boolean)
      .map(String);
    if (projectCreators.length === 0 || userIds.length === 0) return false;
    const loweredCreators = new Set(projectCreators.map((s) => String(s).toLowerCase()));
    return userIds.some((u) => loweredCreators.has(String(u).toLowerCase()));
  })();

  const openAddMember = (open = true) => {
    if (open === false) { setShowAddDialog(false); return; }
    const isManagerFlag = currentUser && (currentUser.role === 'manager' || currentUser.isManager === true);
    
    // --- BUG FIX: Simplified 'openAddMember' permission check ---
    // The old check was complex and redundant. This is simpler.
    if (!(isCreator || isManagerFlag)) {
      alert('You are not permitted to add members');
      return;
    }
    setShowAddDialog(true);
  };
  
  const openAddTask = (open = true) => {
    if (open === false) { setShowAddTaskDialog(false); return; }
    // Manager/creator check
    const isManagerFlag = currentUser && (currentUser.role === 'manager' || currentUser.isManager === true);
    if (!isCreator && !isManagerFlag) { 
      alert('You are not permitted to add tasks'); 
      return; 
    }
    
    const candidates = [];
    if (currentUser) {
      if (currentUser.username) candidates.push(String(currentUser.username));
      if (currentUser.email) candidates.push(String(currentUser.email));
      if (currentUser._id) candidates.push(String(currentUser._id));
      if (currentUser.name) candidates.push(String(currentUser.name));
    }
    const normalizedEmployees = (cleanedEmployees || []).map((s) => String(s).trim());
    let chosen = '';
    for (const c of candidates) {
      if (!c) continue;
      const match = normalizedEmployees.find((e) => e && String(e).toLowerCase() === String(c).toLowerCase());
      if (match) { chosen = match; break; }
    }
    if (!chosen && candidates.length > 0) chosen = String(candidates[0]);
    setTaskAssignee(chosen || '');
    setTaskAssigned(chosen || '');
    setShowAddTaskDialog(true);
  };
  const projectOwnerNormalized = (() => {
    if (!project) return null;
    if (project.createdBy) {
      if (typeof project.createdBy === 'object') {
        return project.createdBy.username || project.createdBy.email || project.createdBy._id || null;
      }
      return String(project.createdBy);
    }
    return project.createdByUsername || project.createdByEmail || project.owner || project.ownerUsername || project.createdByName || null;
  })();
  const saveProjects = (updatedProjects) => {
    sessionStorage.setItem('hg_projects', JSON.stringify(updatedProjects));
  };
  const getCleanedEmployees = () => {
    if (!project) return [];
    if (project.members && Array.isArray(project.members)) {
      return project.members
        .map((m) => {
          if (!m) return '';
          if (typeof m === 'string') return m.trim();
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
  
  // --- Updated JSX for memberRows with AI Button---
  const memberRows = (() => {
    const list = (project && project.members && Array.isArray(project.members)) ? project.members : cleanedEmployees || [];
    return list.map((m, idx) => {
      const displayName = (m && typeof m === 'object') ? (m.username || m.name || String(m)) : String(m);
      const usernameForApi = (m && typeof m === 'object') ? (m.username || m.email || m._id) : String(m);
      
      // Permission check for delete button
      const isManagerFlag = currentUser && (currentUser.role === 'manager' || currentUser.isManager === true);
      const canDelete = isCreator || isManagerFlag;

      return (
        <tr key={`${displayName}-${idx}`} className="border-b border-surface-light">
          <td className="py-3 px-1 text-gray-400 text-sm w-8">{idx + 1}</td>
          <td className="py-3 px-1 text-gray-200 font-medium">{displayName}</td>
          <td className="py-3 px-1">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('AI Summary clicked for member:', displayName);
                  const projId = project?._id || project?.id || 'unknown';
                  navigate(`/ai-summary/${projId}/${encodeURIComponent(displayName)}`);
                  // This alert is from your original code, preserved perfectly
                  alert(`AI Summary for ${displayName}\n\nThis feature will provide AI-generated insights about this member's:\n- Time tracking patterns\n- Task completion rates\n- Productivity metrics\n- Work hours distribution`);
                }}
                title="Generate AI Summary"
                className="
                  flex items-center gap-1 py-1 px-2 rounded-md text-xs font-semibold text-white
                  bg-gradient-to-r from-indigo-500 to-purple-600
                  shadow-md transition-all duration-200 ease-in-out
                  hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30
                "
              >
                <span>✨</span>
                <span>AI</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const projId = project?._id || project?.id || id || '';
                  const uname = usernameForApi || displayName || '';
                  // Open the Usage Logs (EmployeeDashboard) for this project and member
                  navigate(`/employee-dashboard?projectId=${projId}&username=${encodeURIComponent(uname)}`);
                }}
                title="Open Usage Logs"
                className="flex items-center gap-1 py-1 px-2 rounded-md text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500"
              >
                <span>⏱</span>
                <span>Usage</span>
              </button>
              {canDelete && (
                <button 
                  className="text-red-500 hover:text-red-400 text-lg p-1" 
                  onClick={() => handleDeleteMember(usernameForApi || displayName)} 
                  title="Remove member"
                >
                  <RiDeleteBinLine />
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    });
  })();

  // --- BUG FIX: Fixed 'handleAddMember' logic ---
  const handleAddMember = async (identifier) => {
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
    const identifierToDisplay = (id) => {
      if (!id) return '';
      if (typeof id === 'string') return id;
      if (id && typeof id === 'object') return id.username || id.email || id._id || '';
      return String(id);
    };
    if (project && project._id) {
      try {
        const payload = buildPayload(identifier);
        const res = await fetch(`/api/projects/${project._id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        const updatedProjectFromServer = await res.json();
        if (res.ok) {
          // This function now correctly normalizes the full project
          // object returned from the server.
          const normalizeProject = (p) => {
            const extractOwnerId = (owner) => {
              if (!owner) return null;
              if (typeof owner === 'object') return owner.username || owner.email || owner._id || null;
              return String(owner);
            };
            const ownerId = extractOwnerId(p.createdBy) || (project && extractOwnerId(project.createdBy)) || null;
            const rawMembers = Array.isArray(p.members) ? p.members.slice() : [];
            if (ownerId) {
              const present = rawMembers.some((m) => {
                if (!m) return false;
                if (typeof m === 'object') return String(m.username || m.email || m._id || '').toLowerCase() === String(ownerId).toLowerCase();
                return String(m).toLowerCase() === String(ownerId).toLowerCase();
              });
              if (!present) rawMembers.unshift(ownerId);
            }
            return {
              _id: p._id,
              name: p.ProjectName || p.name || '',
              description: p.Description || p.description || '',
              members: rawMembers,
              tasks: p.tasks || [],
              status: p.status || 'active',
              archived: p.status === 'archived',
              deleted: p.status === 'deleted',
              createdBy: p.createdBy || (project && project.createdBy) || null,
            };
          };
          
          const normalized = normalizeProject(updatedProjectFromServer);
          
          setProjects((prev) => {
            const clone = [...prev];
            const idx = clone.findIndex(p => String(p._id) === String(project._id));
            if (idx >= 0) {
              clone[idx] = normalized; 
            } else {
              clone.unshift(normalized);
            }
            try { saveProjects(clone); } catch (e) { console.error('saveProjects failed', e); }
            return clone;
          });
        } else {
          console.error('add member failed', res.status, updatedProjectFromServer);
        }
      } catch (err) {
        console.error('Error adding member', err);
      }
      return;
    }
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
      // Use 'members' array if it exists, otherwise fall back to 'employees'
      const listKey = p.members ? 'members' : 'employees';
      
      const current = p[listKey] && Array.isArray(p[listKey])
        ? p[listKey].map((e) => {
            if (!e) return '';
            if (typeof e === 'string') return e.trim();
            return (e.username || e.name || e._id || e.id || e.toString() || '').toString().trim();
          }).filter(s => s !== '')
        : [];

      let idxToRemove = -1;
      if (typeof name === 'string') {
         // Find by name in the *cleaned* list
        idxToRemove = current.indexOf(name);
      }
      
      // Fallback to original index if name not found (less reliable)
      if (idxToRemove === -1) idxToRemove = index;

      if (idxToRemove < 0 || idxToRemove >= p[listKey].length) {
        return prev; // Index out of bounds
      }
      
      const updated = [...p[listKey].slice(0, idxToRemove), ...p[listKey].slice(idxToRemove + 1)];
      p[listKey] = updated;
      
      newProjects[projectIndex] = p;
      try { saveProjects(newProjects); } catch (err) { console.error('saveProjects failed', err); }
      return newProjects;
    });
  };

  // --- BUG FIX: Fixed 'handleDeleteMember' logic ---
  const handleDeleteMember = async (name) => {
    if (!name) return;
    const ok = globalThis.confirm(`Remove member "${name}" from project?`);
    if (!ok) return;
    if (project && project._id) {
      try {
        const res = await fetch(`/api/projects/${project._id}/members/${encodeURIComponent(name)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const updatedProjectFromServer = await res.json();
        if (res.ok) {
          // Re-use the same robust normalization logic
          const normalizeProject = (p) => {
            const extractOwnerId = (owner) => {
              if (!owner) return null;
              if (typeof owner === 'object') return owner.username || owner.email || owner._id || null;
              return String(owner);
            };
            // Use the *current* project's createdBy as a fallback
            const ownerId = extractOwnerId(p.createdBy) || (project && extractOwnerId(project.createdBy)) || null;
            const rawMembers = Array.isArray(p.members) ? p.members.slice() : [];
            if (ownerId) {
              const present = rawMembers.some((m) => {
                if (!m) return false;
                if (typeof m === 'object') return String(m.username || m.email || m._id || '').toLowerCase() === String(ownerId).toLowerCase();
                return String(m).toLowerCase() === String(ownerId).toLowerCase();
              });
              if (!present) rawMembers.unshift(ownerId);
            }
            return {
              _id: p._id,
              name: p.ProjectName || p.name || '',
              description: p.Description || p.description || '',
              members: rawMembers,
              tasks: p.tasks || [],
              status: p.status || 'active',
              archived: p.status === 'archived',
              deleted: p.status === 'deleted',
              createdBy: p.createdBy || (project && project.createdBy) || null,
            };
          };
          
          const normalized = normalizeProject(updatedProjectFromServer);

          setProjects((prev) => {
            const clone = [...prev];
            const idx = clone.findIndex(p => String(p._id) === String(project._id));
            if (idx !== -1) clone[idx] = normalized;
            try { saveProjects(clone); } catch (e) { console.error('saveProjects failed', e); }
            return clone;
          });
        } else {
          console.error('delete member failed', res.status, updatedProjectFromServer);
          alert((updatedProjectFromServer && updatedProjectFromServer.msg) || 'Failed to remove member');
        }
      } catch (err) {
        console.error('delete member error', err);
        alert('Failed to remove member');
      }
      return;
    }
    // Fallback for local-only project
    const idx = cleanedEmployees.indexOf(name);
    if (idx !== -1) handleRemoveMember(idx, name);
  };
  
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg text-gray-200 p-4">
        <h2 className="text-2xl font-bold text-white mb-4">Project not found</h2>
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center justify-center gap-2 border border-cyan text-cyan font-semibold py-2 px-5 rounded-lg hover:bg-cyan hover:text-brand-bg transition-all duration-300"
        >
          <RiArrowLeftLine className="text-xl transition-transform duration-300 group-hover:-translate-x-2" />
          <span>Back</span>
        </button>
      </div>
    );
  }
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

  // --- Added debounce logic for modal search ---
  const dialogDebounceRef = useRef(null);
  const doModalSearch = async () => {
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
  };

  // This useEffect triggers the search-as-you-type
  useEffect(() => {
    if (!showAddDialog) return; // Only run when modal is open
    if (dialogDebounceRef.current) clearTimeout(dialogDebounceRef.current);
    setDialogLoading(true); // Show loading spinner immediately
    dialogDebounceRef.current = setTimeout(() => {
      doModalSearch();
    }, 300); // 300ms debounce
    return () => clearTimeout(dialogDebounceRef.current);
  }, [dialogQuery, dialogSearchBy, showAddDialog]);
  

  // --- Start of Redesigned JSX ---
  return (
    // === Root container: Full height, no scroll ===
    <div className="h-screen flex flex-col overflow-hidden bg-brand-bg text-gray-200 p-4 md:p-8">
      {/* === Inner container: Manages header and content grid === */}
      <div className="max-w-7xl mx-auto flex-1 flex flex-col overflow-hidden w-full">
        
        {/* === Header: Static height, contains buttons === */}
        <div className="flex-shrink-0 flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <div className="flex-1">
            <button
              onClick={() => navigate(-1)}
              className="
                group flex items-center justify-center gap-2 
                border border-cyan text-cyan font-semibold 
                py-2 px-5 rounded-lg 
                hover:bg-cyan hover:text-brand-bg 
                transition-all duration-300 
                w-auto
              "
            >
              <RiArrowLeftLine className="text-xl transition-transform duration-300 group-hover:-translate-x-1" />
              <span>Back</span>
            </button>
          </div>
          <h2 className="text-3xl font-bold text-white text-center flex-1">{project.name}</h2>
          
          <div className="flex-1 flex justify-end gap-2">
            <button 
              type="button" 
              className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors text-sm"
              onClick={() => { alert('AI Summary feature coming soon!'); }}
            >
              AI Summary
            </button>
            <button 
              type="button" 
              className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors text-sm"
              onClick={() => { alert('Report generation feature coming soon!'); }}
            >
              Generate Report
            </button>
          </div>
        </div>

        {/* Active Timer Bar */}
        {activeTimer && (() => {
          const t = (project.tasks || []).find((task, i) => getTaskKey(task, i) === activeTimer.taskId);
          const base = (t && (t.timeSpent || 0)) || 0;
          const elapsed = base + (Date.now() - activeTimer.startedAt);
          const starter = (activeTimer && activeTimer.startedBy) || null;
          const isStarter = starter && currentUser && (
            (currentUser.username && String(starter).toLowerCase() === String(currentUser.username).toLowerCase())
            || (currentUser.email && String(starter).toLowerCase() === String(currentUser.email).toLowerCase())
            || (currentUser._id && String(starter).toLowerCase() === String(currentUser._id).toLowerCase())
          );
          // Only the starter may see/control the active timer bar now.
          if (!isStarter) return null;

          return (
            // === Timer Bar: Static height ===
            <div className="flex-shrink-0 bg-cyan text-brand-bg font-bold p-3 rounded-lg my-4 flex flex-col md:flex-row justify-between md:items-center gap-2 shadow-lg animate-pulse-fast">
              <span className="text-lg truncate">
                Active Timer: {t ? t.title : '(task)'} — {formatDuration(elapsed)}
              </span>
              <button 
                onClick={() => pauseTimer(activeTimer.taskId)}
                className="bg-brand-bg/20 text-white font-semibold py-2 px-4 rounded-lg hover:bg-brand-bg/40 transition-colors flex-shrink-0"
              >
                Pause
              </button>
            </div>
          );
        })()}

        {/* === Main Content Grid: Fills remaining space, min-h-0 is a key flexbox fix === */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          
          {/* === Left Column: Does NOT scroll on its own === */}
          <div className="lg:col-span-1 space-y-6 flex flex-col min-h-0">
            <div className="bg-surface rounded-lg shadow-md p-6 flex-shrink-0">
              <h3 className="text-2xl font-semibold text-white mb-2">Description</h3>
              <p className="text-gray-400 break-words max-h-48 overflow-y-auto">{project.description || "No description provided."}</p>
            </div>

            {/* === Team Members Box: Fills remaining space in left column, scrolls internally === */}
            <div className="bg-surface rounded-lg shadow-md p-6 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-2xl font-semibold text-white">Team Members</h3>
                {(isCreator || (currentUser && (currentUser.role === 'manager' || currentUser.isManager === true))) && (
                  <button
                    type="button"
                    onClick={() => openAddMember(true)}
                    className="bg-cyan text-brand-bg font-bold py-1 px-3 rounded-lg text-sm flex items-center gap-1 hover:bg-cyan-dark transition-colors"
                  >
                    <RiUserAddLine />
                    Add
                  </button>
                )}
              </div>
              
              {/* === This internal div scrolls === */}
              <div className="overflow-y-auto pr-2">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-light">
                      <th className="py-2 px-1 text-gray-400 font-semibold w-8">#</th>
                      <th className="py-2 px-1 text-gray-400 font-semibold">Name</th>
                      <th className="py-2 px-1 text-gray-400 font-semibold text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberRows && memberRows.length > 0 ? (
                      memberRows
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-gray-500 italic">No members yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* === Right Column: Scrolls internally === */}
          <div className="lg:col-span-2 space-y-6 lg:overflow-y-auto pb-4">
            {/* Tasks Panel */}
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
              setShowAddTaskDialog={openAddTask}
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
              currentUser={currentUser}
              projectOwner={projectOwnerNormalized}
              isCreator={isCreator} // Pass isCreator to TasksPanel
            />
            
            {/* Time Logs Panel */}
            <TimeLogsPanel 
              projectId={project && (project._id || project._clientId)}
              currentUser={currentUser}
              isManager={isCreator || (currentUser && (currentUser.role === 'manager' || currentUser.isManager === true))}
            />
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface-light rounded-lg shadow-xl w-full max-w-2xl p-6 relative">
            <button 
              onClick={() => { setShowAddDialog(false); setDialogResults([]); setDialogQuery(''); setDialogError(''); }}
              className="absolute top-3 right-4 text-gray-400 hover:text-white text-2xl"
            >
              <RiCloseLine />
            </button>
            <h3 className="text-2xl font-bold text-white mb-4">Add Member</h3>
            
            <div className="flex gap-4 items-center mb-4">
              <label className="text-sm text-gray-300 flex items-center gap-1 cursor-pointer">
                <input type="radio" name="searchBy" checked={dialogSearchBy === 'email'} onChange={() => setDialogSearchBy('email')} className="bg-surface border-gray-500 text-cyan focus:ring-cyan"/> Email
              </label>
              <label className="text-sm text-gray-300 flex items-center gap-1 cursor-pointer">
                <input type="radio" name="searchBy" checked={dialogSearchBy === 'username'} onChange={() => setDialogSearchBy('username')} className="bg-surface border-gray-500 text-cyan focus:ring-cyan"/> Username
              </label>
            </div>
            
            <div className="relative flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={dialogSearchBy === 'email' ? 'Search by email' : 'Search by username'}
                  value={dialogQuery}
                  onChange={(e) => setDialogQuery(e.target.value)}
                  className="w-full bg-surface text-gray-200 placeholder-gray-400 py-2 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light"
                />
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <button 
                onClick={() => { setShowAddDialog(false); setDialogResults([]); setDialogQuery(''); setDialogError(''); }}
                className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm w-full md:w-auto hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>

            {dialogError && <div className="text-red-500 text-sm mt-3">{dialogError}</div>}
            
            <div className="mt-4 max-h-64 overflow-y-auto">
              {dialogLoading && <div className="text-gray-400 text-sm">Searching...</div>}
              {!dialogLoading && dialogResults.length > 0 ? (
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="border-b border-surface">
                    <tr>
                      <th className="py-2 text-gray-400 font-semibold">Name</th>
                      <th className="py-2 text-gray-400 font-semibold">Username</th>
                      <th className="py-2 text-gray-400 font-semibold">Email</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dialogResults.map((u) => (
                      <tr key={u._id || u.email || u.username} className="border-b border-surface">
                        <td className="py-2">{u.name || '-'}</td>
                        <td className="py-2">{u.username || '-'}</td>
                        <td className="py-2">{u.email || '-'}</td>
                        <td>
                          <button 
                            className="bg-cyan text-brand-bg font-semibold py-1 px-3 rounded-md text-sm hover:bg-cyan-dark transition-colors"
                            onClick={async () => {
                              await handleAddMember(u.username || u.email || u._id);
                              setShowAddDialog(false);
                              setDialogResults([]);
                              setDialogQuery('');
                              setDialogError('');
                            }}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                !dialogLoading && <div className="mt-4 text-gray-500 text-sm">{dialogQuery ? 'No results found.' : 'Search for users to add.'}</div>
              )}
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default ProjectPage;