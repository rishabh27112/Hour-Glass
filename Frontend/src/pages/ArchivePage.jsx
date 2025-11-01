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
          createdById: p.createdBy && (p.createdBy._id || p.createdBy),
        })) : []);
      } catch (err) {
        console.error('archive fetch error', err);
        try { const raw = sessionStorage.getItem('hg_projects'); setProjects(raw ? JSON.parse(raw) : []); } catch (e) { setProjects([]); }
      }
    };

    fetchProjects();
  }, []);

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
                    <div style={{ display: 'flex', gap: 8 }}>
                      {profileUser && String(profileUser._id) === String(project.createdById) ? (
                        <button
                          className={styles.secondaryButton}
                          onClick={async () => {
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
                                // update state by refetching list (keeps shape mapping consistent)
                                alert('Project restored');
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
                                  } else {
                                    const body = await res2.text().catch(() => '');
                                    console.error('refresh after restore failed', res2.status, body);
                                  }
                                } catch (err) {
                                  console.error('refresh after restore failed', err);
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
                        <button className={styles.secondaryButton} disabled title="Only project owner can restore">Restore</button>
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