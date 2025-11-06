import React, { useEffect, useState } from 'react';
import styles from './ManagerDashboard.module.css';
import { useNavigate } from 'react-router-dom';

const ArchivePage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [profileUser, setProfileUser] = useState(null);

  // Auth check: redirect to login if unauthenticated
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('http://localhost:4000/api/user/data', { method: 'GET', credentials: 'include' });
        const json = await res.json();
        if (!mounted) return;
        if (!json || !json.success || !json.userData) {
          sessionStorage.removeItem('user'); sessionStorage.removeItem('token');
          localStorage.removeItem('user'); localStorage.removeItem('token');
          navigate('/login');
        } else {
          setProfileUser(json.userData);
        }
      } catch (err) {
        sessionStorage.removeItem('user'); sessionStorage.removeItem('token');
        localStorage.removeItem('user'); localStorage.removeItem('token');
        navigate('/login');
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/projects', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed');
        const arr = await res.json();
        setProjects(Array.isArray(arr) ? arr.map(p => ({
          _id: p._id,
          name: p.ProjectName || p.name,
          description: p.Description || p.description,
          archived: p.status === 'archived',
          deleted: p.status === 'deleted',
          // keep createdById for backward compatibility
          createdById: p.createdBy && (p.createdBy._id || p.createdBy),
          // also expose an "owner" field similar to ManagerDashboard.normalizeProject
          owner: (p.createdBy && (p.createdBy.username || p.createdBy._id)) || p.owner || null,
        })) : []);
      } catch (err) {
        console.error('archive fetch error', err);
        try { const raw = sessionStorage.getItem('hg_projects'); setProjects(raw ? JSON.parse(raw) : []); } catch (e) { setProjects([]); }
      }
    };

    fetchProjects();
  }, []);

  // derive a convenient currentUserId that may be an email, username or _id
  const currentUserId = profileUser && (profileUser.email || profileUser.username || profileUser._id || null);

  // helper: gather possible owner identifiers from a project (handles object or string shapes)
  const getProjectOwners = (p) => {
    const out = new Set();
    if (!p) return out;
    const pushVal = (v) => {
      if (!v && v !== 0) return;
      if (typeof v === 'string' || typeof v === 'number') out.add(String(v));
      else if (typeof v === 'object') {
        if (v._id) out.add(String(v._id));
        if (v.username) out.add(String(v.username));
        if (v.email) out.add(String(v.email));
      }
    };
    pushVal(p.createdById);
    pushVal(p.owner);
    // legacy: if raw createdBy exists on raw project object
    if (p.raw && p.raw.createdBy) pushVal(p.raw.createdBy);
    return out;
  };

  const canRestore = (project) => {
    if (!profileUser || !project) {
      console.log('canRestore: No user or project', { profileUser, project });
      return false;
    }
    const userIds = [profileUser._id, profileUser.username, profileUser.email].filter(Boolean).map(String);
    const owners = Array.from(getProjectOwners(project));
    const result = userIds.some((u) => owners.includes(u));
    console.log('canRestore check:', { userIds, owners, result, project: project.name });
    return result;
  };

  // helper kept for legacy but not used since app fetches from server
  const updateProjectAt = (idx, changes) => {
    // intentionally no-op for server-backed mode
  };

  const archivedList = projects
    .map((p, idx) => ({ ...p, _idx: idx }))
    .filter((p) => p.archived && !p.deleted);

  return (
    <div className={styles.pageContainer} style={{ padding: 24 }}>
      <div className={styles.header}>
        <h1 className={styles.title}>Archived Projects</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate(-1)} className={styles.secondaryButton}>Back</button>
        </div>
      </div>

      <div className={styles.middleScroll}>
        <div className={styles.content}>
          {archivedList.length === 0 ? (
            <p>No archived projects.</p>
          ) : (
            <ul className={styles.projectList}>
              {archivedList.map((project) => (
                <li key={project._idx} className={styles.projectItem}>
                  <div className={styles.projectInfo} style={{ textAlign: 'left' }}>
                    <h3>
                      <button className={styles.projectLink} onClick={() => navigate(`/projects/${project._id || project._idx}`)}>
                        {project.name}
                      </button>
                    </h3>
                    <p>{project.description}</p>
                  </div>
                    <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
                      {canRestore(project) ? (
                        <button
                          className={styles.secondaryButton}
                          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // restore archive via server (robust: handle missing id, log body on error)
                            try {
                              const id = project._id;
                              if (!id) {
                                alert('Cannot restore: missing project id');
                                console.error('Restore called but project has no _id', project);
                                return;
                              }

                              const r = await fetch(`http://localhost:4000/api/projects/${id}/restore`, {
                                method: 'PATCH',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({}), // send empty JSON so some servers accept PATCH without preflight issues
                              });

                              if (r.ok) {
                                // simple refresh: reload the page so the archived list updates
                                alert('Project restored');
                                try {
                                  // use a full reload to ensure server data is re-fetched
                                  window.location.reload();
                                } catch (err) {
                                  // fallback: update state by refetching projects
                                  try {
                                    const res2 = await fetch('http://localhost:4000/api/projects', { credentials: 'include' });
                                    if (res2.ok) {
                                      const arr = await res2.json();
                                      setProjects(Array.isArray(arr) ? arr.map(p => ({
                                        _id: p._id,
                                        name: p.ProjectName || p.name,
                                        description: p.Description || p.description,
                                        archived: p.status === 'archived',
                                        deleted: p.status === 'deleted',
                                        createdById: p.createdBy && (p.createdBy._id || p.createdBy),
                                      })) : []);
                                    }
                                  } catch (e) { /* ignore fallback errors */ }
                                }
                              } else {
                                // attempt to read json then text for better error message
                                let body = '';
                                try { body = await r.json(); } catch (e) { body = await r.text().catch(() => ''); }
                                console.error('Restore failed', r.status, body);
                                alert('Restore failed: ' + r.status + ' ' + (typeof body === 'string' ? body : JSON.stringify(body)));
                              }
                            } catch (err) {
                              console.error('Restore error', err);
                              alert('Restore error - see console');
                            }
                          }}
                        >
                          Restore
                        </button>
                      ) : (
                        <button className={styles.secondaryButton} disabled title="Only project owner or creator can restore">Restore</button>
                      )}
                      <button
                        className={styles.leftButtonDanger}
                        onClick={async () => {
                          try {
                            const r = await fetch(`http://localhost:4000/api/projects/${project._id}`, { method: 'DELETE', credentials: 'include' });
                            if (r.ok) {
                              alert('Moved to Bin');
                              // refresh
                              const res2 = await fetch('http://localhost:4000/api/projects', { credentials: 'include' });
                              if (res2.ok) {
                                const arr = await res2.json();
                                setProjects(Array.isArray(arr) ? arr.map(p => ({
                                  _id: p._id,
                                  name: p.ProjectName || p.name,
                                  description: p.Description || p.description,
                                  archived: p.status === 'archived',
                                  deleted: p.status === 'deleted',
                                  createdById: p.createdBy && (p.createdBy._id || p.createdBy),
                                })) : []);
                              }
                            } else {
                              const body = await r.text().catch(() => '');
                              console.error('Move to bin failed', r.status, body);
                              alert('Move to bin failed: ' + r.status + ' ' + body);
                            }
                          } catch (err) { console.error('Move to bin error', err); alert('Move to bin error'); }
                        }}
                      >
                        Move to Bin
                      </button>
                    </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchivePage;