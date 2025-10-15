import React, { useEffect, useState } from 'react';
import styles from './ManagerDashboard.module.css';
import { useNavigate } from 'react-router-dom';

const BinPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('hg_projects');
      const parsed = raw ? JSON.parse(raw) : [];
      setProjects(parsed);
    } catch (e) {
      setProjects([]);
    }
  }, []);

  const updateProjects = (updater) => {
    setProjects((prev) => {
      const copy = prev.map((p) => ({ ...p }));
      const next = updater(copy);
      try {
        sessionStorage.setItem('hg_projects', JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  const deletedList = projects.map((p, idx) => ({ ...p, _idx: idx })).filter((p) => p.deleted);

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
                <li key={project._idx} className={styles.projectItem}>
                  <div className={styles.projectInfo} style={{ textAlign: 'left' }}>
                    <h3>
                      <button
                        className={styles.projectLink}
                        onClick={() => navigate(/projects/`${project._idx}`)}
                      >
                        {project.name}
                      </button>
                    </h3>
                    <p>{project.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => updateProjects((arr) => {
                        arr[project._idx] = { ...arr[project._idx], deleted: false };
                        return arr;
                      })}
                    >
                      Restore
                    </button>
                    <button
                      className={styles.dangerButton}
                      onClick={() => updateProjects((arr) => arr.filter((_, i) => i !== project._idx))}
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