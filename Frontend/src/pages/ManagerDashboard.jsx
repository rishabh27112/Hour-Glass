import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ManagerDashboard.module.css';

const ManagerDashboard = () => {
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [employees, setEmployees] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]); // State to store project details
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [memberSearchBy, setMemberSearchBy] = useState('email'); // 'email' or 'username'
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [addedMembers, setAddedMembers] = useState([]); // users selected to be added to the new project
  const memberDebounceRef = useRef(null);

  // Member search helpers used while creating a project
  const doMemberSearch = async () => {
    const q = (memberQuery || '').trim();
    setMemberLoading(true);
    setMemberError('');
    try {
      let url = '';
  // use relative paths so CRA dev server proxy (configured in package.json) forwards to backend
  if (!q) url = `/api/user/search?limit=10`;
  else if (memberSearchBy === 'email') url = `/api/user/search?email=${encodeURIComponent(q)}`;
  else url = `/api/user/search?username=${encodeURIComponent(q)}`;

      const res = await fetch(url, { credentials: 'include' });
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
    // Avoid duplicates by _id or username/email
    setAddedMembers((prev) => {
      const exists = prev.some(p => (user._id && p._id && p._id === user._id) || (user.username && p.username && p.username === user.username) || (user.email && p.email && p.email === user.email));
      if (exists) return prev;
      return [...prev, user];
    });
    // optionally remove from search results to give quick feedback
    setMemberResults((prev) => prev.filter(r => r._id !== user._id));
  };

  const removeAddedMember = (idx) => {
    setAddedMembers((prev) => [...prev.slice(0, idx), ...prev.slice(idx + 1)]);
  };

  // Autocomplete on the Employees (comma-separated) input: detect current token and search
  const onEmployeesChange = (val) => {
    setEmployees(val);
    // find the token currently being edited (after last comma)
    const parts = val.split(',');
    const last = parts[parts.length - 1].trim();
    if (!last) {
      setMemberResults([]);
      setMemberQuery('');
      return;
    }
    setMemberQuery(last);
    // pick search mode automatically
    setMemberSearchBy(last.includes('@') ? 'email' : 'username');

    // debounce the search
    if (memberDebounceRef.current) clearTimeout(memberDebounceRef.current);
    memberDebounceRef.current = setTimeout(() => {
      doMemberSearch();
    }, 300);
  };

  const selectSuggestionIntoInput = (user) => {
    // Choose display value: prefer username, then email, then id
    const display = user.username || user.email || user._id || '';
    // Replace the last token in employees input with the selected display value
    const parts = employees.split(',');
    parts[parts.length - 1] = ' ' + display; // keep comma separation tidy
    const newVal = parts.map(p => p.trim()).filter(Boolean).join(', ');
    setEmployees(newVal);
    // mark as selected member as well
    handleAddFromResult(user);
    // clear search results
    setMemberResults([]);
    setMemberQuery('');
  };
  const [search, setSearch] = useState('');
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [selectionMode, setSelectionMode] = useState('none'); // 'none' | 'archive' | 'delete'
  const [selected, setSelected] = useState([]); // array of indexes
  const navigate = useNavigate();
  // read current user from storage (login writes to sessionStorage or localStorage)
  const currentUser = React.useMemo(() => {
    try {
      const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, []);

  // derive a set of possible identifiers for the current user (prefer server-fetched profile)
  const getUserIdentifiers = (u) => {
    if (!u) return [];
    return [u._id, u.username, u.email].filter(Boolean).map(String);
  };

  // prefer the freshest profileUser (fetched from server); fall back to stored currentUser
  const currentUserIds = React.useMemo(() => getUserIdentifiers(profileUser || currentUser), [profileUser, currentUser]);

  // Ensure user is authenticated on mount. If not, redirect to login.
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/user/data', {
          method: 'GET',
          credentials: 'include',
        });
        const json = await res.json();
        if (!json || !json.success || !json.userData) {
          try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) {}
          try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) {}
          if (!cancelled) navigate('/login');
        } else {
          // keep local profile in sync
          setProfileUser(json.userData);
        }
      } catch (err) {
        try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) {}
        try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) {}
        if (!cancelled) navigate('/login');
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    // persist projects to sessionStorage so ProjectPage (legacy) can read them,
    // but primary source is server.
    try {
      sessionStorage.setItem('hg_projects', JSON.stringify(projects));
    } catch (e) {
      // ignore
    }
  }, [projects]);

  // Helper to normalize server project -> frontend shape
  const normalizeProject = (p) => {
    return {
      _id: p._id,
      name: p.ProjectName || p.name || '',
      description: p.Description || p.description || '',
      employees: Array.isArray(p.members) ? p.members.map(m => (m && (m.username || m.name) ? (m.username || m.name) : (m._id || ''))) : (p.employees || []),
      archived: (p.status && p.status === 'archived') || false,
  deleted: (p.status === 'deleted'),
      // expose createdBy id for more robust ownership checks
      createdById: p.createdBy && (p.createdBy._id || p.createdBy),
      owner: (p.createdBy && (p.createdBy.username || p.createdBy._id)) || p.owner || null,
      raw: p,
    };
  };

  // Fetch projects from server on mount
  const fetchProjects = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/projects', { credentials: 'include' });
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

    // Must start with an alphabetic letter (A-Z or a-z)
    if (!/^[A-Za-z]/.test(name)) {
      setError('Project name must start with a letter.');
      return;
    }

    // Check for duplicate (case-insensitive)
    const exists = projects.some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setError('A project with this name already exists. Please choose a different name.');
      return;
    }
    // employees input is currently stored locally for legacy behavior; server create only needs name/description

    try {
      const payload = { ProjectName: projectName, Description: projectDescription };
      const res = await fetch('http://localhost:4000/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // try to read the created project from server response
        const created = await res.json().catch(() => null);

        // build a local project object and add it immediately so the UI shows the new project
  const membersArr = (employees || '').split(',').map(s => s.trim()).filter(Boolean);
  const ownerId = (profileUser && (profileUser.username || profileUser.email || profileUser._id)) || (currentUser && (currentUser.username || currentUser.email || currentUser._id)) || null;

        const localProject = {
          _id: (created && created._id) || `local-${Date.now()}`,
          name: (created && (created.ProjectName || created.name)) || projectName,
          description: (created && (created.Description || created.description)) || projectDescription,
          employees: Array.isArray(created && created.members) ? (created.members.map(m => (m && (m.username || m.name) ? (m.username || m.name) : (m._id || '')))) : [...membersArr, ...addedMembers.map(u => (u.username || u.email || u._id || ''))],
          archived: false,
          deleted: false,
          owner: ownerId,
          raw: created || { ProjectName: projectName, Description: projectDescription, members: membersArr, createdBy: ownerId },
        };

        // prepend to projects list for immediate feedback
        setProjects((prev) => {
          const next = [localProject, ...prev];
          try { sessionStorage.setItem('hg_projects', JSON.stringify(next)); } catch (e) {}
          return next;
        });

        alert('Project created successfully');
        setProjectName(''); setProjectDescription(''); setEmployees(''); setIsAddingProject(false);
        // If the server returned a created project id and we have addedMembers, call the members API to persist them
        (async () => {
          try {
            if (created && created._id && Array.isArray(addedMembers) && addedMembers.length > 0) {
              for (const u of addedMembers) {
                const payload = {};
                if (u.email) payload.email = u.email;
                else if (u._id) payload.userId = u._id;
                else if (u.username) payload.username = u.username;
                else continue;
                try {
                  await fetch(`http://localhost:4000/api/projects/${created._id}/members`, {
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
          } finally {
            // refresh list from server to reconcile
            fetchProjects();
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

  return (
    <div className={styles.pageContainer}>
      <div className={styles.taskbarTop}>
        <div className={styles.taskbarTopLeft}>Hour-Glass</div>
          <div className={styles.taskbarTopRight}>
          <div className={styles.profileWrapper}>
            <button
              className={styles.profileButton}
              onClick={async () => {
                // toggle and fetch latest profile from server when opening
                const newVal = !profileOpen;
                setProfileOpen(newVal);
                if (newVal) {
                  try {
                    const res = await fetch('http://localhost:4000/api/user/data', {
                      method: 'GET',
                      credentials: 'include',
                    });
                    const json = await res.json();
                    if (json && json.success && json.userData) {
                      setProfileUser(json.userData);
                      // keep storage in sync
                      try {
                        const storage = sessionStorage.getItem('user') ? sessionStorage : localStorage;
                        storage.setItem('user', JSON.stringify(json.userData));
                      } catch (err) {}
                    }
                  } catch (err) {
                    // ignore fetch errors; fall back to stored user
                  }
                }
              }}
              aria-label="Open profile menu"
            >
              <img src="/Logo/logo.png" alt="profile" className={styles.profileAvatar} />
            </button>
            {profileOpen && (
              <div className={styles.profileMenu} role="menu">
                <div className={styles.profileMenuItem} role="menuitem" style={{cursor:'default'}}>
                  Signed in as <strong style={{marginLeft:6}}>{profileUser?.username || profileUser?.email || profileUser?.name || 'User'}</strong>
                </div>
                <button
                  className={styles.profileMenuItem}
                  role="menuitem"
                  onClick={async () => {
                    try {
                      await fetch('http://localhost:4000/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                      });
                    } catch (err) {
                      // ignore network errors
                    }
                    try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch(e) {}
                    try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch(e) {}
                    navigate('/login');
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.dashboardContainerRow}>
      <div className={`${styles.leftContainer} ${isLeftOpen ? styles.leftOpen : styles.leftClosed}`}>
        <button
          className={styles.leftToggle}
          onClick={() => setIsLeftOpen(!isLeftOpen)}
          aria-label={isLeftOpen ? 'Close left panel' : 'Open left panel'}
        >
          {isLeftOpen ? '◀' : '▶'}
        </button>
        {isLeftOpen ? (
          <div className={styles.leftInner}>
            <h3 className={styles.leftSectionHeader}>Projects you lead</h3>
            {projects.filter((p) => !p.archived && !p.deleted && (p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById))).length > 0 ? (
              <ul className={styles.projectListSidebar}>
                {projects
                  .filter((p) => !p.archived && !p.deleted && (p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById)))
                  .map((project) => {
                    const realIndex = projects.indexOf(project);
                    return (
                      <li key={realIndex} className={styles.projectItemSidebar}>
                        <button
                          className={styles.projectLinkSidebar}
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
              <p className={styles.noProjectsText}>You are not leading any projects yet.</p>
            )}

            <h3 className={styles.leftSectionHeader}>Projects you are part of</h3>
            {projects.filter((p) => !p.archived && !p.deleted && p.employees && currentUserIds.length > 0 && p.employees.some(e => currentUserIds.includes(String(e))) && !((p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById)))).length > 0 ? (
              <ul className={styles.projectListSidebar}>
                {projects
                  .filter((p) => !p.archived && !p.deleted && p.employees && currentUserIds.length > 0 && p.employees.some(e => currentUserIds.includes(String(e))) && !((p.owner || p.createdById) && currentUserIds.includes(String(p.owner || p.createdById))))
                  .map((project) => {
                    const realIndex = projects.indexOf(project);
                    return (
                      <li key={realIndex} className={styles.projectItemSidebar}>
                        <button
                          className={styles.projectLinkSidebar}
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
              <p className={styles.noProjectsText}>You are not part of any projects yet.</p>
            )}
            <div className={styles.leftActions}>
              <button
                className={styles.leftButton}
                onClick={() => navigate('/archive')}
                aria-label="Open archived projects"
              >
                Archive
              </button>
              <button
                className={styles.leftButtonDanger}
                onClick={() => navigate('/bin')}
                aria-label="Open bin (deleted projects)"
              >
                Bin
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.middleContainer}>
        <header className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>

          <div className={styles.searchGroup}>
            <input
              type="text"
              placeholder="Search projects by name..."
              className={styles.searchInput}
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
            <button
              className={styles.clearSearch}
              onClick={() => setSearch('')}
              title="Clear search"
            >
              X
            </button>
          </div>

          <div className={styles.actionGroup}>
            <button className={styles.addProjectButton} onClick={handleAddProjectClick}>
              + Add Project
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => {
                setSelectionMode('archive');
                setSelected([]);
              }}
            >
              Archive
            </button>
            <button
              className={styles.dangerButton}
              onClick={() => {
                setSelectionMode('delete');
                setSelected([]);
              }}
            >
              Delete
            </button>
          </div>

          {/* profile moved to taskbar in right container */}
        </header>

        {isAddingProject && (
          <div className={styles.projectFormContainer}>
            <form className={styles.projectForm} onSubmit={handleSubmit}>
              <button
                type="button"
                className={styles.closeFormButton}
                onClick={() => {
                  setIsAddingProject(false);
                  setError('');
                  setProjectName('');
                  setProjectDescription('');
                  setEmployees('');
                }}
                aria-label="Close add project form"
              >
                ✕
              </button>
              <label className={styles.label}>
                Project Name <span className={styles.required}>*</span>
                <input
                  type="text"
                  className={styles.input}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />
              </label>

              <label className={styles.label}>
                Project Description
                <textarea
                  className={styles.textarea}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </label>

              <label className={styles.label}>
                Employees (comma-separated)
                <input
                  type="text"
                  className={styles.input}
                  value={employees}
                  onChange={(e) => onEmployeesChange(e.target.value)}
                />
              </label>

              {/* Inline suggestions as user types in the Employees field */}
              {memberResults && memberResults.length > 0 && (
                <div style={{ border: '1px solid #eee', padding: 6, borderRadius: 6, marginTop: 6 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>Suggestions</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {memberResults.map((u) => (
                      <li key={u._id || u.email || u.username} style={{ padding: '6px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 13 }}>
                          <div><strong>{u.username || u.name || '-'}</strong></div>
                          <div style={{ fontSize: 12, color: '#666' }}>{u.email || ''}</div>
                        </div>
                        <div>
                          <button type="button" className={styles.smallButton} onClick={() => selectSuggestionIntoInput(u)}>Use</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => setShowMemberPanel((s) => !s)}
                >
                  {showMemberPanel ? 'Close member panel' : 'Add members by search'}
                </button>
                <span style={{ marginLeft: 12, color: '#666' }}>Or enter comma-separated usernames/emails above.</span>
              </div>

              {showMemberPanel && (
                <div style={{ border: '1px solid #eee', padding: 8, marginTop: 8, borderRadius: 6 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13 }}>
                      <input type="radio" checked={memberSearchBy === 'email'} onChange={() => setMemberSearchBy('email')} /> Email
                    </label>
                    <label style={{ fontSize: 13 }}>
                      <input type="radio" checked={memberSearchBy === 'username'} onChange={() => setMemberSearchBy('username')} /> Username
                    </label>
                    <input
                      type="text"
                      placeholder={memberSearchBy === 'email' ? 'Search by email' : 'Search by username'}
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      className={styles.input}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className={styles.smallButton} onClick={doMemberSearch} disabled={memberLoading}>
                      {memberLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  {memberError && <div style={{ color: 'red', marginBottom: 8 }}>{memberError}</div>}

                  <div>
                    {memberResults && memberResults.length > 0 ? (
                      <table className={styles.table} style={{ marginBottom: 8 }}>
                        <thead>
                          <tr><th>Name</th><th>Username</th><th>Email</th><th></th></tr>
                        </thead>
                        <tbody>
                          {memberResults.map((u) => (
                            <tr key={u._id || u.email || u.username}>
                              <td>{u.name || '-'}</td>
                              <td>{u.username || '-'}</td>
                              <td>{u.email || '-'}</td>
                              <td><button type="button" className={styles.smallButton} onClick={() => handleAddFromResult(u)}>Add</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ color: '#666', marginBottom: 8 }}>No results</div>
                    )}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <strong>Selected members:</strong>
                    {addedMembers && addedMembers.length > 0 ? (
                      <ul style={{ marginTop: 6 }}>
                        {addedMembers.map((m, i) => (
                          <li key={m._id || m.username || m.email} style={{ marginBottom: 4 }}>
                            {m.name || m.username || m.email}
                            <button type="button" style={{ marginLeft: 8 }} className={styles.smallButton} onClick={() => removeAddedMember(i)}>Remove</button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ color: '#666', marginTop: 6 }}>No members selected</div>
                    )}
                  </div>
                </div>
              )}

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.submitButton}>
                Add Project
              </button>
            </form>
          </div>
        )}

          <div className={styles.middleScroll}>
          <div className={styles.content}>
          <h2>Projects</h2>
          {selectionMode !== 'none' && (
            <div className={styles.selectionBar}>
              <span>{selectionMode === 'delete' ? 'Delete' : 'Archive'} mode</span>
              <div>
                <button
                  className={styles.confirmButton}
                  onClick={() => {
                    if (selected.length === 0) return;
                    // Perform server-side archive/delete for items that have _id
                    (async () => {
                      const toProcess = selected.slice();
                      let successCount = 0;
                      let failCount = 0;
                      for (const idx of toProcess) {
                        const p = projects[idx];
                        if (!p || !p._id) continue;
                        try {
                          if (selectionMode === 'delete') {
                            const r = await fetch(`http://localhost:4000/api/projects/${p._id}`, { method: 'DELETE', credentials: 'include' });
                            if (r.ok) successCount++; else failCount++;
                          } else {
                            const r = await fetch(`http://localhost:4000/api/projects/${p._id}/archive`, { method: 'PATCH', credentials: 'include' });
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
                  Confirm
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={() => {
                    setSelectionMode('none');
                    setSelected([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {projects.length > 0 ? (
            (() => {
              const filtered = projects
                .filter((p) => !p.archived && !p.deleted)
                .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
              return filtered.length > 0 ? (
                <ul className={styles.projectList}>
                  {filtered.map((project, index) => {
                    const realIndex = projects.indexOf(project);
                    const checked = selected.includes(realIndex);
                    return (
                      <li key={realIndex} className={styles.projectItem}>
                        {selectionMode !== 'none' && (
                          <input
                            type="checkbox"
                            className={styles.projectCheckbox}
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setSelected([...selected, realIndex]);
                              else setSelected(selected.filter((i) => i !== realIndex));
                            }}
                          />
                        )}
                        <div className={styles.projectInfo}>
                          <h3>
                            <button
                              className={styles.projectLink}
                              onClick={() => {
                                // Close any open overlays before navigating to the project page
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
                          <p>{project.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>No projects match your search.</p>
              );
            })()
          ) : (
            <p>No projects added yet.</p>
          )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;