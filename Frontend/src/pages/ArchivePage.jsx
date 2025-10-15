import React, { useEffect, useState } from 'react';
import styles from './ManagerDashboard.module.css';
import { useNavigate } from 'react-router-dom';

const ArchivePage = () => {
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

  const updateProjectAt = (idx, changes) => {
    setProjects((prev) => {
      const copy = prev.map((p) => ({ ...p }));
      if (idx >= 0 && idx < copy.length) {
        copy[idx] = { ...copy[idx], ...changes };
      }
      try {
        sessionStorage.setItem('hg_projects', JSON.stringify(copy));
      } catch (e) {
        // ignore
      }
      return copy;
    });
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
                      <button
                        className={styles.projectLink}
                        onClick={() => {
                          // open project page the same as manager list
                          navigate(/projects/`${project._idx}`);
                        }}
                      >
                        {project.name}
                      </button>
                    </h3>
                    <p>{project.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => updateProjectAt(project._idx, { archived: false })}
                    >
                      Restore
                    </button>
                    <button
                      className={styles.leftButtonDanger}
                      onClick={() => updateProjectAt(project._idx, { deleted: true, archived: false })}
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