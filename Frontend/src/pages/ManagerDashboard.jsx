import React, { useState } from 'react';
import styles from './ManagerDashboard.module.css';

const ManagerDashboard = () => {
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [employees, setEmployees] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]); // State to store project details

  const handleAddProjectClick = () => {
    setIsAddingProject(!isAddingProject);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError('Project name is required.');
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
    <div className={styles.dashboardContainer}>
      <div className={styles.leftContainer}>
        <h2>Left Container</h2>
        <p>Content for the left container...</p>
      </div>

      <div className={styles.middleContainer}>
        <header className={styles.header}>
          <h1 className={styles.title}>Manager Dashboard</h1>
          <button className={styles.addProjectButton} onClick={handleAddProjectClick}>
            + Add Project
          </button>
        </header>

        {isAddingProject && (
          <div className={styles.projectFormContainer}>
            <form className={styles.projectForm} onSubmit={handleSubmit}>
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

        <div className={styles.content}>
          <h2>Projects</h2>
          {projects.length > 0 ? (
            <ul className={styles.projectList}>
              {projects.map((project, index) => (
                <li key={index} className={styles.projectItem}>
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                  <p><strong>Employees:</strong> {project.employees.join(', ')}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No projects added yet.</p>
          )}
        </div>
      </div>

      <div className={styles.rightContainer}>
        <h2>Right Container</h2>
        <p>Content for the right container...</p>
      </div>
    </div>
  );
};

export default ManagerDashboard;