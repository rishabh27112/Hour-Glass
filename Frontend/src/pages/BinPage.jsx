import React, { useEffect, useState } from 'react';
import styles from './ManagerDashboard.module.css';
import { useNavigate } from 'react-router-dom';

const BinPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

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
    fetchProjects();
  }, []);

  // Fetch projects from server and set state (also used after actions to refresh)
  async function fetchProjects() {
    try {
      const res = await fetch('http://localhost:4000/api/projects', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch projects');
      const arr = await res.json();
      setProjects(Array.isArray(arr) ? arr.map(p => ({
        _id: p._id,
        name: p.ProjectName || p.name,
        description: p.Description || p.description,
        archived: p.status === 'archived',
        deleted: p.status === 'deleted',
        raw: p,
      })) : []);
    } catch (err) {
      console.error('bin fetch error', err);
      try {
        const raw = sessionStorage.getItem('hg_projects');
        setProjects(raw ? JSON.parse(raw) : []);
      } catch (e) {
        console.warn('sessionStorage read/parse failed', e);
        setProjects([]);
      }
    }
  }

  const deletedList = projects.filter((p) => (
    (p && p.deleted === true) ||
    (p && p.status === 'deleted') ||
    (p && p.raw && p.raw.status === 'deleted')
  ));

  return (
    <div className={styles.pageContainer} style={{ padding: 24 }}>
      <div className={styles.header}>
        <h1 className={styles.title}>Bin (Deleted Projects)</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate(-1)} className={styles.secondaryButton}>Back</button>
        </div>
      </div>
      <div className={styles.middleScroll}>
        <div className={styles.content}>
          {deletedList.length === 0 ? (
            <p>No deleted projects.</p>
          ) : (
            <ul className={styles.projectList}>
                  {deletedList.map((project) => (
                <li key={project._id} className={styles.projectItem}>
                  <div className={styles.projectInfo} style={{ textAlign: 'left' }}>
                    <h3>
                      <button
                        className={styles.projectLink}
                        onClick={() => navigate(`/projects/${project._id}`)}
                      >
                        {project.name}
                      </button>
                    </h3>
                    <p>{project.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={styles.secondaryButton}
                      onClick={async () => {
                        try {
                          const r = await fetch(`http://localhost:4000/api/projects/${project._id}/restore-deleted`, { method: 'PATCH', credentials: 'include' });
                          if (r.ok) {
                            // refresh from server to get canonical state
                            await fetchProjects();
                          } else {
                            const body = await r.text().catch(() => '');
                            alert('Restore failed: ' + r.status + ' ' + body);
                          }
                        } catch (err) { console.error(err); alert('Restore error'); }
                      }}
                    >
                      Restore
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={async () => {
                        if (!globalThis.confirm('Permanently delete this project? This cannot be undone.')) return;
                        try {
                          const r = await fetch(`http://localhost:4000/api/projects/${project._id}/permanent`, { method: 'DELETE', credentials: 'include' });
                          if (r.ok) {
                            // refresh canonical list
                            await fetchProjects();
                          } else {
                            const body = await r.text().catch(() => '');
                            alert('Permanent delete failed: ' + r.status + ' ' + body);
                          }
                        } catch (err) { console.error(err); alert('Permanent delete error'); }
                      }}
                    >
                      Delete Permanently
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

export default BinPage;