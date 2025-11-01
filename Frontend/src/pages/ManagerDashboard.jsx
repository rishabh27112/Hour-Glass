import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ManagerDashboard.module.css';

const ManagerDashboard = () => {
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [employees, setEmployees] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]); // State to store project details
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

  const currentUserId = currentUser?.email || currentUser?.username || currentUser?._id || null;

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
        // consume body (optional) but we will refresh from server
        await res.json().catch(() => null);
        alert('Project created successfully');
        setProjectName(''); setProjectDescription(''); setEmployees(''); setIsAddingProject(false);
        await fetchProjects();
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
            {projects.filter((p) => !p.archived && !p.deleted && p.owner === currentUserId).length > 0 ? (
              <ul className={styles.projectListSidebar}>
                {projects
                  .filter((p) => !p.archived && !p.deleted && p.owner === currentUserId)
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
            {projects.filter((p) => !p.archived && !p.deleted && p.employees && currentUserId && p.employees.includes(currentUserId) && p.owner !== currentUserId).length > 0 ? (
              <ul className={styles.projectListSidebar}>
                {projects
                  .filter((p) => !p.archived && !p.deleted && p.employees && currentUserId && p.employees.includes(currentUserId) && p.owner !== currentUserId)
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
                  onChange={(e) => setEmployees(e.target.value)}
                />
              </label>

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