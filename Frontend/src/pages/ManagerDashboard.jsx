// src/pages/ManagerDashboard.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ManagerTimeOverview from './ManagerDashboard/ManagerTimeOverview.jsx';
import { useNavigate, Link } from 'react-router-dom';
import {
  RiSearchLine, RiCloseLine, RiAddLine, RiArchiveLine, RiDeleteBinLine,
  RiArrowLeftSLine, RiArrowRightSLine, RiLogoutBoxRLine, RiCheckLine, RiBriefcaseLine, RiMenuFoldLine, RiMenuUnfoldLine, RiSparkling2Line
} from 'react-icons/ri';
import NavLogo from '../components/NavLogo';
import API_BASE_URL from '../config/api';
import buildHeaders from '../config/fetcher';

const ManagerDashboard = () => {
  // --- All your state and logic remains 100% unchanged ---
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [employees, setEmployees] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [memberSearchBy, setMemberSearchBy] = useState('email');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [addedMembers, setAddedMembers] = useState([]);
  const memberDebounceRef = useRef(null);
  const doMemberSearch = async () => {
    const q = (memberQuery || '').trim();
    setMemberLoading(true);
    setMemberError('');
    try {
      let url = '';
      if (!q) url = `${API_BASE_URL}/api/user/search?limit=10`;
      else if (memberSearchBy === 'email') url = `${API_BASE_URL}/api/user/search?email=${encodeURIComponent(q)}`;
      else url = `${API_BASE_URL}/api/user/search?username=${encodeURIComponent(q)}`;
      const res = await fetch(url, { credentials: 'include', headers: buildHeaders() });
      const json = await res.json().catch(() => ({}));
      console.log('member search response', json);
      if (res.ok) setMemberResults(json.users || []);
      else { setMemberError(json.message || 'Search failed'); setMemberResults([]); }
    } catch (err) {
      console.error('member search error', err);
      setMemberError('Search failed');
      setMemberResults([]);
    } finally {
      setMemberLoading(false);
    }
  };
  const handleAddFromResult = (user) => {
    setAddedMembers((prev) => {
      const exists = prev.some(p => (user._id && p._id && p._id === user._id) || (user.username && p.username && p.username === user.username) || (user.email && p.email && p.email === user.email));
      if (exists) return prev;
      return [...prev, user];
    });
    setMemberResults((prev) => prev.filter(r => r._id !== user._id));
  };
  const removeAddedMember = (idx) => {
    setAddedMembers((prev) => [...prev.slice(0, idx), ...prev.slice(idx + 1)]);
  };
  const onEmployeesChange = (val) => {
    setEmployees(val);
    const parts = val.split(',');
    const last = parts[parts.length - 1].trim();
    if (!last) {
      setMemberResults([]);
      setMemberQuery('');
      return;
    }
    setMemberQuery(last);
    setMemberSearchBy(last.includes('@') ? 'email' : 'username');
    if (memberDebounceRef.current) clearTimeout(memberDebounceRef.current);
    memberDebounceRef.current = setTimeout(() => {
      doMemberSearch();
    }, 300);
  };
  const selectSuggestionIntoInput = (user) => {
    const display = user.username || user.email || user._id || '';
    const parts = employees.split(',');
    parts[parts.length - 1] = ' ' + display;
    const newVal = parts.map(p => p.trim()).filter(Boolean).join(', ');
    setEmployees(newVal);
    handleAddFromResult(user);
    setMemberResults([]);
    setMemberQuery('');
  };
  const [search, setSearch] = useState('');
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const avatarButtonRef = useRef(null);
  const [profileUser, setProfileUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifPollRef = useRef(null);

  // Manual trigger for notification job (calls server test route)
  const handleNotifyDeadlines = async () => {
    try {
      setNotifLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/notifications/test/run-reminders-now`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include'
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(json.msg || 'Notification job executed successfully');
        // after triggering server job, refresh notifications
        fetchNotifications();
        // server job runs asynchronously; refresh a couple more times to pick up created notifications
        setTimeout(fetchNotifications, 1500);
        setTimeout(fetchNotifications, 3500);
      } else {
        alert(json.error || json.message || 'Failed to run notification job');
      }
    } catch (err) {
      alert('Error triggering notifications: ' + (err && err.message ? err.message : err));
    } finally {
      setNotifLoading(false);
    }
  };

  const getCurrentUserId = () => {
    try {
      const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
      const u = raw ? JSON.parse(raw) : null;
      return (profileUser && (profileUser._id || profileUser.id)) || (u && (u._id || u.id)) || null;
    } catch (e) {
      console.warn('getCurrentUserId parse error', e && e.message);
      return (profileUser && (profileUser._id || profileUser.id)) || null;
    }
  };

  const fetchNotifications = async () => {
    const uid = profileUser && (profileUser._id || profileUser.id) ? (profileUser._id || profileUser.id) : getCurrentUserId();
    if (!uid) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/${uid}`, { credentials: 'include' });
      if (!res.ok) return setNotifications([]);
      const arr = await res.json().catch(() => []);
      setNotifications(Array.isArray(arr) ? arr : []);
    } catch (err) {
      console.error('fetchNotifications error', err);
      setNotifications([]);
    }
  };

  // start polling notifications when profileUser is available
  useEffect(() => {
    if (!profileUser) return undefined;
    fetchNotifications();
    notifPollRef.current = setInterval(fetchNotifications, 60 * 1000);
    return () => { if (notifPollRef.current) clearInterval(notifPollRef.current); };
  }, [profileUser]);
  const [selectionMode, setSelectionMode] = useState('none');
  const [selected, setSelected] = useState([]);
  const navigate = useNavigate();
  const currentUser = React.useMemo(() => {
    try {
      const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, []);
  const getUserIdentifiers = (u) => {
    if (!u) return [];
    return [u._id, u.username, u.email].filter(Boolean).map(String);
  };
  const currentUserIds = React.useMemo(() => getUserIdentifiers(profileUser || currentUser), [profileUser, currentUser]);
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/data`, {
          method: 'GET',
          credentials: 'include',
          headers: buildHeaders()
        });
        const json = await res.json();
        if (!json || !json.success || !json.userData) {
          try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) { console.log('Session cleanup error'); }
          try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) { console.log('Local cleanup error'); }
          if (!cancelled) navigate('/login');
        } else {
          setProfileUser(json.userData);
        }
      } catch (err) {
        try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) { console.log('Session cleanup error'); }
        try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) { console.log('Local cleanup error'); }
        if (!cancelled) navigate('/login');
      }
    };
    verify();
    return () => { cancelled = true; };
  }, [navigate]);

  // Close profile menu on outside click or Escape key
  useEffect(() => {
    function handleOutside(e) {
      if (!profileOpen) return;
      if (profileMenuRef.current && profileMenuRef.current.contains(e.target)) return;
      if (avatarButtonRef.current && avatarButtonRef.current.contains(e.target)) return;
      setProfileOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [profileOpen]);
  useEffect(() => {
    try {
      sessionStorage.setItem('hg_projects', JSON.stringify(projects));
    } catch (e) { }
  }, [projects]);
  const normalizeProject = (p) => {
    return {
      _id: p._id,
      name: p.ProjectName || p.name || '',
      description: p.Description || p.description || '',
      employees: Array.isArray(p.members) ? p.members.map(m => (m && (m.username || m.name) ? (m.username || m.name) : (m._id || ''))) : (p.employees || []),
      archived: (p.status && p.status === 'archived') || false,
      deleted: (p.status === 'deleted'),
      createdById: p.createdBy && (p.createdBy._id || p.createdBy),
      owner: (p.createdBy && (p.createdBy.username || p.createdBy._id)) || p.owner || null,
      raw: p,
    };
  };
  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to load projects');
      }
      const arr = await res.json();
      setProjects(Array.isArray(arr) ? arr.map(normalizeProject) : []);
    } catch (err) {
      console.error('fetchProjects error', err);
      setProjects([]);
      alert('Error loading projects from server. See console for details.');
    }
  };
  useEffect(() => {
    fetchProjects();
  }, []);
  const handleAddProjectClick = () => {
    setIsAddingProject(!isAddingProject);
    setError('');
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name) {
      setError('Project name is required.');
      return;
    }
    if (!/^[A-Za-z]/.test(name)) {
      setError('Project name must start with a letter.');
      return;
    }
    const exists = projects.some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setError('A project with this name already exists. Please choose a different name.');
      return;
    }
    try {
      const payload = { ProjectName: projectName, Description: projectDescription };
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json().catch(() => null);
        const membersArr = (employees || '').split(',').map(s => s.trim()).filter(Boolean);
        const ownerId = (profileUser && (profileUser.username || profileUser.email || profileUser._id)) || (currentUser && (currentUser.username || currentUser.email || currentUser._id)) || null;
        const localProject = {
          _id: (created && created._id) || `local-${Date.now()}`,
          name: (created && (created.ProjectName || created.name)) || projectName,
          description: (created && (created.Description || created.description)) || projectDescription,
          employees: membersArr,
          members: (created && created.members) || addedMembers || [],
          archived: false,
          deleted: false,
          owner: ownerId,
          // include a populated createdBy object when possible so downstream pages can match the creator reliably
          createdBy: (created && created.createdBy) || (profileUser || currentUser) || ownerId,
          raw: created || { ProjectName: projectName, Description: projectDescription, members: addedMembers, createdBy: (profileUser || currentUser || ownerId) },
        };
        setProjects((prev) => {
          const next = [localProject, ...prev];
          try { sessionStorage.setItem('hg_projects', JSON.stringify(next)); } catch (e) { }
          return next;
        });
        alert('Project created successfully');
        setProjectName(''); setProjectDescription(''); setEmployees(''); setIsAddingProject(false);
        setAddedMembers([]); // Clear added members

        // Add members in the background without refetching
        (async () => {
          if (created && created._id && Array.isArray(addedMembers) && addedMembers.length > 0) {
            for (const u of addedMembers) {
              const payload = {};
              if (u.email) payload.email = u.email;
              else if (u._id) payload.userId = u._id;
              else if (u.username) payload.username = u.username;
              else continue;
              try {
                await fetch(`${API_BASE_URL}/api/projects/${created._id}/members`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
              } catch (err) {
                console.error('add member during create failed for', u, err);
              }
            }
          }
        })();
      } else {
        const json = await res.json().catch(() => ({}));
        const msg = json.msg || json.message || 'Failed to create project';
        setError(msg);
        alert('Error creating project: ' + msg);
      }
    } catch (err) {
      console.error('create project error', err);
      setError('Network error while creating project');
      alert('Network error while creating project');
    }
  };
  // --- End of logic ---


  // --- Start of Redesigned JSX ---
  return (
    <div className="flex flex-col h-screen bg-brand-bg text-gray-200 tracking-wide">

      {/* Top Navbar */}
      <div className="flex items-center justify-between p-3 bg-brand-bg border-b border-surface-light shadow-md z-30">
        <div className="flex items-center gap-2 text-lg font-bold text-white">
          <NavLogo />
          <Link to='/'> <span>Hour Glass</span></Link>
        </div>
        <div className="relative">
          <div className="hidden md:inline-block mr-3">
            <button
              className="bg-yellow-400 text-black font-semibold py-1 px-3 rounded-md hover:bg-yellow-500 text-sm"
              onClick={handleNotifyDeadlines}
              disabled={notifLoading}
              title="Notify me of upcoming task deadlines"
            >
              {notifLoading ? 'Notifying...' : 'Notify Deadlines'}
            </button>
          </div>
          {/* Notifications bell --- MERGED DESIGN --- */}
          <div className="inline-block mr-3 relative">
            <button
              className="group rounded-full h-9 w-9 flex items-center justify-center text-gray-300 text-xl"
              onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) fetchNotifications(); }}
              aria-label="Notifications"
            >
              <i className="
                  text-yellow-300 ri-notification-3-fill 
                  inline-block group-hover:animate-ring
                "></i>

              {notifications && notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* --- MERGED DROPDOWN DESIGN --- */}
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 max-h-80 flex flex-col bg-surface-light text-gray-200 rounded-lg shadow-xl z-50 border border-surface">

                <div className="flex justify-between items-center px-3 py-2 border-b border-surface">
                  <h3 className="font-semibold text-white">Notifications</h3>
                  <button
                    className="text-gray-400 hover:text-white text-xl"
                    onClick={() => setNotifOpen(false)}
                  >
                    <RiCloseLine />
                  </button>
                </div>

                <div className="overflow-y-auto">
                  {notifications && notifications.length === 0 && (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">No notifications</div>
                  )}
                  {notifications && notifications.map((n) => (
                    <div key={n._id} className="px-3 py-2 border-b border-surface hover:bg-surface transition-colors">
                      <div className="font-medium text-sm text-gray-200">{n.taskTitle || n.message}</div>
                      <div className="text-xs text-gray-400">{(n.sentAt || n.createdAt) ? new Date(n.sentAt || n.createdAt).toLocaleString() : ''}</div>
                    </div>
                  ))}
                </div>

              </div>
            )}
            {/* --- END MERGED DROPDOWN --- */}
          </div>
          <button
            className="rounded-full h-9 w-9 overflow-hidden focus:outline-none 
                        hover:ring-2 hover:ring-offset-2 hover:ring-offset-surface-light hover:ring-cyan"
            ref={avatarButtonRef}
            onClick={() => {
              // Toggle profile menu instead of navigating directly
              setProfileOpen((v) => !v);
            }}
            aria-label="Open profile page"
          >
            <div className="h-9 w-9 bg-surface-light flex items-center justify-center text-cyan text-lg font-bold">
              {profileUser?.username ? profileUser.username.charAt(0).toUpperCase() : 'U'}
            </div>
            {/* <img src="/Logo/logo.png" alt="profile" className="h-full w-full object-cover" /> */}
          </button>

          {profileOpen && (
            <div ref={profileMenuRef} className="absolute right-0 mt-2 w-56 bg-surface-light rounded-lg shadow-xl z-50 py-1" role="menu">
              <div className="block px-4 py-2 text-sm text-gray-400" role="menuitem">
                Signed in as <br />
                <strong className="text-gray-200">{profileUser?.username || profileUser?.email || profileUser?.name || 'User'}</strong>
              </div>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-surface hover:text-white"
                role="menuitem"
                onClick={() => { setProfileOpen(false); navigate('/profile'); }}
              >
                Profile
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-surface hover:text-white"
                role="menuitem"
                onClick={async () => {
                  try {
                    await fetch(`${API_BASE_URL}/api/auth/logout`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: buildHeaders(),
                    });
                  } catch (err) { console.warn('logout failed', err); }
                  try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) { console.log('Session cleanup error'); }
                  try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) { console.log('Local cleanup error'); }
                  setProfileOpen(false);
                  navigate('/login');
                }}
              >
                <RiLogoutBoxRLine className="inline-block mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Collapsible Left Sidebar */}
        <div
          className={`relative bg-surface transition-all duration-300 ease-in-out ${isLeftOpen ? 'w-60' : 'w-16'} z-10`} // w-64 to w-60
          onMouseLeave={() => setIsLeftOpen(false)}
        >

          <div className="p-3 h-full flex flex-col">

            {/* Hamburger Menu Toggle */}
            <button
              className="text-xl text-gray-300 hover:text-cyan mb-3"
              onMouseEnter={() => setIsLeftOpen(true)}
              onClick={() => setIsLeftOpen(!isLeftOpen)}
              aria-label={isLeftOpen ? 'Close left panel' : 'Open left panel'}
            >
              {isLeftOpen ? <RiMenuFoldLine /> : <RiMenuUnfoldLine />}
            </button>


            <div className={`flex-1 flex flex-col min-h-0 ${!isLeftOpen && 'hidden'}`}>

              {/* --- Projects You Lead (Scrollable) --- */}
              <div className="flex-shrink-0">
                <h3 className="mt-3 mb-2 text-sm font-semibold uppercase text-cyan-light">
                  Projects you lead
                </h3>
                <div className="w-full max-h-40 overflow-y-auto">
                  {projects.filter((p) => !p.archived && !p.deleted && (p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById))).length > 0 ? (
                    <ul className="space-y-1">
                      {projects
                        .filter((p) => !p.archived && !p.deleted && (p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById)))
                        .map((project) => {
                          const realIndex = projects.indexOf(project);
                          return (
                            <li key={realIndex}>
                              <button
                                className="block w-full text-left px-3 py-1.5 rounded-md text-gray-300 hover:bg-surface-light hover:text-cyan transition-colors text-sm"
                                onClick={() => {
                                  setIsAddingProject(false);
                                  setProfileOpen(false);
                                  setSelectionMode('none');
                                  setSelected([]);
                                  navigate(`/projects/${project._id || realIndex}`);
                                }}
                              >
                                {project.name}
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  ) : (
                    <p className="px-3 py-1.5 text-xs text-gray-500">You are not leading any projects.</p>
                  )}
                </div>
              </div>

              {/* --- Projects You Are Part Of (Scrollable) --- */}
              <div className="flex-shrink-0 mt-3">
                <h3 className="mb-2 text-sm font-semibold uppercase text-cyan-light">
                  Projects you are part of
                </h3>
                <div className="w-full max-h-40 overflow-y-auto">
                  {projects.filter((p) => !p.archived && !p.deleted && p.employees && currentUserIds.length > 0 && p.employees.some(e => currentUserIds.includes(String(e))) && !((p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById)))).length > 0 ? (
                    <ul className="space-y-1">
                      {projects
                        .filter((p) => !p.archived && !p.deleted && p.employees && currentUserIds.length > 0 && p.employees.some(e => currentUserIds.includes(String(e))) && !((p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById))))
                        .map((project) => {
                          const realIndex = projects.indexOf(project);
                          return (
                            <li key={realIndex}>
                              <button
                                className="block w-full text-left px-3 py-1.5 rounded-md text-gray-300 hover:bg-surface-light hover:text-cyan transition-colors text-sm"
                                onClick={() => {
                                  setIsAddingProject(false);
                                  setProfileOpen(false);
                                  setSelectionMode('none');
                                  setSelected([]);
                                  navigate(`/projects/${project._id || realIndex}`);
                                }}
                              >
                                {project.name}
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  ) : (
                    <p className="px-3 py-1.5 text-xs text-gray-500">You are not part of any projects.</p>
                  )}
                </div>
              </div>

              {/* This 'spacer' div pushes the buttons to the bottom */}
              <div className="flex-1"></div>

              <div className="flex-shrink-0 mt-3 pt-3 border-t border-surface-light space-y-1">
                <button
                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-gray-300 hover:bg-surface-light hover:text-white text-sm"
                  onClick={() => navigate('/archive')}
                  aria-label="Open archived projects"
                >
                  <RiArchiveLine className="text-xl" />
                  <span>Archive</span>
                </button>
                <button
                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-gray-300 hover:bg-surface-light hover:text-red-500 text-sm"
                  onClick={() => navigate('/bin')}
                  aria-label="Open bin (deleted projects)"
                >
                  <RiDeleteBinLine className="text-xl" />
                  <span>Bin</span>
                </button>
              </div>
            </div>

            {/* --- Icon-Only View (Visible when closed) --- */}
            <div className={`flex flex-col items-center space-y-5 mt-6 ${isLeftOpen && 'hidden'}`}>
              <button
                className="relative group text-xl text-gray-300 hover:text-cyan"
                aria-label="Projects"
                onClick={() => setIsLeftOpen(true)}
              >
                <RiBriefcaseLine />
                <span className="
                  absolute left-full top-1/2 -translate-y-1/2 ml-3
                  bg-cyan text-brand-bg text-xs font-semibold px-2 py-0.5 rounded
                  scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100
                  transition-all duration-200 origin-left
                  whitespace-nowrap
                ">
                  Projects
                </span>
              </button>
              <button
                className="relative group text-xl text-gray-300 hover:text-gray-400"
                onClick={() => navigate('/archive')}
                aria-label="Open archived projects"
              >
                <RiArchiveLine />
                <span className="
                  absolute left-full top-1/2 -translate-y-1/2 ml-3
                  bg-gray-200 text-brand-bg text-xs font-semibold px-2 py-0.5 rounded
                  scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100
                  transition-all duration-200 origin-left
                  whitespace-nowrap
                ">
                  Archive
                </span>
              </button>
              <button
                className="relative group text-xl text-gray-300 hover:text-red-500"
                onClick={() => navigate('/bin')}
                aria-label="Open bin (deleted projects)"
              >
                <RiDeleteBinLine />
                <span className="
                  absolute left-full top-1/2 -translate-y-1/2 ml-3
                  bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded
                  scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100
                  transition-all duration-200 origin-left
                  whitespace-nowrap
                ">
                  Bin
                </span>
              </button>
            </div>

          </div>
        </div>

        {/* Middle Content Panel */}
        <div className="flex-1 flex flex-col overflow-hidden relative z-0">

          {/* Middle Header */}
          <header className="flex flex-col md:flex-row items-center justify-between p-3 border-b border-surface-light gap-3">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>

            <div className="relative w-full md:w-auto">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects"
                className="w-full md:w-60 bg-surface text-gray-200 placeholder-gray-400 py-1.5 pl-10 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light text-sm"
                value={search}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearch(v);
                  if (isAddingProject) {
                    setIsAddingProject(false);
                    setError('');
                    setProjectName('');
                    setProjectDescription('');
                    setEmployees('');
                  }
                }}
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  onClick={() => setSearch('')}
                  title="Clear search"
                >
                  <RiCloseLine />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="
                  group cursor-pointer relative overflow-hidden 
                  bg-cyan text-brand-bg font-bold py-1.5 px-4 rounded-lg
                  hover:bg-cyan-dark flex items-center gap-2 text-sm
                "
                onClick={handleAddProjectClick}
              >
                <RiAddLine className="text-lg" />
                Add Project
              </button>
              <button
                className="bg-surface-light text-gray-300 font-semibold py-1.5 px-4 rounded-lg hover:bg-surface flex items-center gap-2 text-sm"
                onClick={() => {
                  setSelectionMode('archive');
                  setSelected([]);
                }}
              >
                <RiArchiveLine />
                Archive
              </button>
              <button
                className="bg-red-600 text-white font-semibold py-1.5 px-4 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
                onClick={() => {
                  setSelectionMode('delete');
                  setSelected([]);
                }}
              >
                <RiDeleteBinLine />
                Delete
              </button>
            </div>
          </header>


          <div className="flex-1 p-3 overflow-y-auto">
            {/* Manager Time Overview (employee-wise aggregated entries) */}
            <ManagerTimeOverview ownedProjects={projects.filter(p => (p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById)))} />


            {isAddingProject && (
              <div className="mb-4 p-4 bg-surface rounded-lg shadow-lg relative">
                <button
                  type="button"
                  className="absolute top-3 right-4 text-gray-500 hover:text-white text-2xl"
                  onClick={() => {
                    setIsAddingProject(false);
                    setError('');
                    setProjectName('');
                    setProjectDescription('');
                    setEmployees('');
                  }}
                  aria-label="Close add project form"
                >
                  <RiCloseLine />
                </button>
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-300 mb-1">
                      Project Name <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="text"
                      className="w-full bg-surface-light text-gray-200 placeholder-gray-400 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm font-medium text-gray-300 mb-1">
                      Project Description
                    </span>
                    <textarea
                      className="w-full bg-surface-light text-gray-200 placeholder-gray-400 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light"
                      rows="3"
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm font-medium text-gray-300 mb-1">
                      Employees (comma-separated)
                    </span>
                    <input
                      type="text"
                      className="w-full bg-surface-light text-gray-200 placeholder-gray-400 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light"
                      value={employees}
                      onChange={(e) => onEmployeesChange(e.target.value)}
                    />
                  </label>

                  {/* Inline suggestions */}
                  {memberResults && memberResults.length > 0 && (
                    <div className="border border-surface-light p-3 rounded-lg mt-2">
                      <h4 className="text-xs text-gray-400 mb-2">Suggestions</h4>
                      <ul className="space-y-2">
                        {memberResults.map((u) => (
                          <li key={u._id || u.email || u.username} className="flex justify-between items-center">
                            <div>
                              <strong className="text-sm text-gray-200">{u.username || u.name || '-'}</strong>
                              <p className="text-xs text-gray-400">{u.email || ''}</p>
                            </div>
                            <button
                              type="button"
                              className="bg-cyan text-brand-bg font-semibold py-1 px-3 rounded-md text-sm"
                              onClick={() => selectSuggestionIntoInput(u)}
                            >
                              Use
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <button
                      type="button"
                      className="text-sm font-medium text-cyan hover:text-cyan-light"
                      onClick={() => setShowMemberPanel((s) => !s)}
                    >
                      {showMemberPanel ? 'Close member panel' : 'Add members by search'}
                    </button>
                    <span className="ml-4 text-sm text-gray-500">Or enter comma-separated usernames/emails above.</span>
                  </div>

                  {/* Full Member Search Panel */}
                  {showMemberPanel && (
                    <div className="border border-surface-light p-4 rounded-lg mt-2">
                      <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
                        <div className="flex gap-4">
                          <label className="text-sm text-gray-300 flex items-center gap-1">
                            <input type="radio" checked={memberSearchBy === 'email'} onChange={() => setMemberSearchBy('email')} className="bg-surface-light border-gray-500 text-cyan focus:ring-cyan" /> Email
                          </label>
                          <label className="text-sm text-gray-300 flex items-center gap-1">
                            <input type="radio" checked={memberSearchBy === 'username'} onChange={() => setMemberSearchBy('username')} className="bg-surface-light border-gray-500 text-cyan focus:ring-cyan" /> Username
                          </label>
                        </div>
                        <input
                          type="text"
                          placeholder={memberSearchBy === 'email' ? 'Search by email' : 'Search by username'}
                          value={memberQuery}
                          onChange={(e) => setMemberQuery(e.target.value)}
                          className="flex-1 w-full bg-surface-light text-gray-200 placeholder-gray-400 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light"
                        />
                        <button
                          type="button"
                          className="bg-cyan text-brand-bg font-semibold py-2 px-4 rounded-md text-sm w-full md:w-auto"
                          onClick={doMemberSearch}
                          disabled={memberLoading}
                        >
                          {memberLoading ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                      {memberError && <div className="text-red-500 mb-4">{memberError}</div>}

                      <div>
                        {memberResults && memberResults.length > 0 ? (
                          <table className="w-full text-left text-sm mb-4 text-gray-300">
                            <thead className="border-b border-surface-light">
                              <tr>
                                <th className="py-2 text-gray-400 font-semibold">Name</th>
                                <th className="py-2 text-gray-400 font-semibold">Username</th>
                                <th className="py-2 text-gray-400 font-semibold">Email</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {memberResults.map((u) => (
                                <tr key={u._id || u.email || u.username} className="border-b border-surface-light">
                                  <td className="py-2">{u.name || '-'}</td>
                                  <td className="py-2">{u.username || '-'}</td>
                                  <td className="py-2">{u.email || '-'}</td>
                                  <td>
                                    <button type="button" className="bg-cyan text-brand-bg font-semibold py-1 px-3 rounded-md text-sm" onClick={() => handleAddFromResult(u)}>Add</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-gray-500 mb-4">No results</div>
                        )}
                      </div>

                      <div className="text-gray-300">
                        <strong className="text-gray-200">Selected members:</strong>
                        {addedMembers && addedMembers.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {addedMembers.map((m, i) => (
                              <li key={m._id || m.username || m.email} className="flex justify-between items-center text-sm">
                                {m.name || m.username || m.email}
                                <button typeF="button" className="bg-red-600 text-white font-semibold py-1 px-2 rounded-md text-xs" onClick={() => removeAddedMember(i)}>Remove</button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-gray-500 mt-2 text-sm">No members selected</div>
                        )}
                      </div>
                    </div>
                  )}

                  {error && <p className="text-red-500 text-center">{error}</p>}

                  <button
                    type="submit"
                    className="
                      group cursor-pointer relative overflow-hidden 
                      w-full bg-cyan text-brand-bg font-bold py-2 px-5 rounded-lg
                      tracking-light transition-all duration-300 ease-in-out 
                      hover:translate-y-0.5
                    "
                  >
                    <span className="relative z-10">Add Project</span>
                  </button>
                </form>
              </div>
            )}

            {/* Selection Bar */}
            {selectionMode !== 'none' && (
              <div className="bg-surface-light p-3 rounded-lg flex flex-col md:flex-row justify-between items-center mb-4 gap-2">
                <span className="font-semibold text-white text-sm"> {/* Added text-sm */}
                  {selected.length} item(s) selected for {selectionMode}
                </span>
                <div className="flex gap-2">
                  <button
                    className="bg-cyan text-brand-bg font-semibold py-1.5 px-3 rounded-md text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selected.length === 0}
                    onClick={() => {
                      if (selected.length === 0) return;
                      (async () => {
                        const toProcess = selected.slice();
                        let successCount = 0;
                        let failCount = 0;
                        for (const idx of toProcess) {
                          const p = projects[idx];
                          if (!p || !p._id) continue;
                          try {
                            if (selectionMode === 'delete') {
                              const r = await fetch(`${API_BASE_URL}/api/projects/${p._id}`, { method: 'DELETE', credentials: 'include' });
                              if (r.ok) successCount++; else failCount++;
                            } else {
                              const r = await fetch(`${API_BASE_URL}/api/projects/${p._id}/archive`, { method: 'PATCH', credentials: 'include' });
                              if (r.ok) successCount++; else failCount++;
                            }
                          } catch (err) { console.error('project action error', err); failCount++; }
                        }
                        await fetchProjects();
                        setSelectionMode('none');
                        setSelected([]);
                        alert(`Operation complete. Success: ${successCount}, Failed: ${failCount}`);
                      })();
                    }}
                  >
                    <RiCheckLine />
                    Confirm
                  </button>
                  <button
                    className="bg-gray-500 text-white font-semibold py-1.5 px-3 rounded-md text-sm flex items-center gap-2"
                    onClick={() => {
                      setSelectionMode('none');
                      setSelected([]);
                    }}
                  >
                    <RiCloseLine />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Project List */}
            <h2 className="text-xl font-bold text-white mb-3">Projects</h2>

            {projects.length > 0 ? (
              (() => {
                const filtered = projects
                  .filter((p) => !p.archived && !p.deleted)
                  .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
                return filtered.length > 0 ? (
                  <ul className="space-y-3">
                    {filtered.map((project, index) => {
                      const realIndex = projects.indexOf(project);
                      const checked = selected.includes(realIndex);
                      return (
                        <li key={realIndex} className="bg-surface rounded-lg shadow-md flex items-center p-3 transition-all hover:shadow-lg hover:border-surface-light border border-transparent">
                          {selectionMode !== 'none' && (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelected([...selected, realIndex]);
                                } else {
                                  setSelected(selected.filter(i => i !== realIndex));
                                }
                              }}
                              className="h-4 w-4 rounded bg-surface-light border-gray-500 text-cyan focus:ring-cyan mr-3"
                            />
                          )}
                          <div className="flex-1">
                            <h3>
                              <button
                                className="text-lg font-semibold text-white hover:text-cyan transition-colors"
                                onClick={() => {
                                  setIsAddingProject(false);
                                  setProfileOpen(false);
                                  setSelectionMode('none');
                                  setSelected([]);
                                  navigate(`/projects/${project._id || realIndex}`);
                                }}
                              >
                                {project.name}
                              </button>
                            </h3>
                            <p className="text-gray-400 mt-1 text-xs">{project.description}</p>
                            <p className="text-xs text-gray-500 mt-2">Owner: {project.owner || 'N/A'}</p>
                          </div>
                         <button
  className="
    ml-4 flex items-center gap-2 rounded-lg border border-cyan 
    py-2 px-4 text-sm font-semibold text-cyan 
    transition-all duration-200 
    hover:bg-cyan hover:text-brand-bg hover:shadow-lg hover:shadow-cyan/10
  "
  onClick={(e) => {
    e.stopPropagation();
    console.log('AI Summary clicked for project:', project.name);
    alert(`AI Summary for ${project.name}\n\nThis feature will provide AI-generated insights...`);
  }}
  title="Generate AI Summary"
>
  <RiSparkling2Line className="text-lg" />
  <span>AI Summary</span>
</button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-gray-400 text-sm">No projects match your search.</p>
                );
              })()
            ) : (
              <p className="text-gray-400 text-sm">No projects added yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;