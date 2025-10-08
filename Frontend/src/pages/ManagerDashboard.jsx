import React, { useState, useMemo } from 'react';
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
  const [selectionMode, setSelectionMode] = useState('none'); // 'none' | 'archive' | 'delete'
  const [selected, setSelected] = useState([]); // array of indexes

  const handleAddProjectClick = () => {
    setIsAddingProject(!isAddingProject);
    setError('');
  };

  const handleSubmit = (e) => {
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
    const newProject = {
      name: projectName,
      description: projectDescription,
      employees: employees.split(',').map((emp) => emp.trim()),
    };
    setProjects([...projects, newProject]); // Add new project to the list
    setProjectName('');
    setProjectDescription('');
    setEmployees('');
    setIsAddingProject(false);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.taskbarTop}>
        <div className={styles.taskbarTopLeft}>Hour-Glass</div>
        <div className={styles.taskbarTopRight}>
          <div className={styles.profileWrapper}>
            <button
              className={styles.profileButton}
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Open profile menu"
            >
              <img src="/Logo/logo.png" alt="profile" className={styles.profileAvatar} />
            </button>
            {profileOpen && (
              <div className={styles.profileMenu} role="menu">
                <button className={styles.profileMenuItem} role="menuitem">Profile</button>
                <button className={styles.profileMenuItem} role="menuitem">Logout</button>
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
            <h2>Left Container</h2>
            <p>Content for the left container...</p>
          </div>
        ) : null}
      </div>

      <div className={styles.middleContainer}>
        <header className={styles.header}>
          <h1 className={styles.title}>Manager Dashboard</h1>

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
                    if (selectionMode === 'delete') {
                      setProjects(projects.filter((_, idx) => !selected.includes(idx)));
                    } else {
                      // Archive action: currently just remove from list for demo
                      setProjects(projects.filter((_, idx) => !selected.includes(idx)));
                    }
                    setSelectionMode('none');
                    setSelected([]);
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
              const filtered = projects.filter((p) =>
                p.name.toLowerCase().includes(search.trim().toLowerCase())
              );
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
                          <h3>{project.name}</h3>
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