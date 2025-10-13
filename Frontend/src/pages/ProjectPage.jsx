import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './ProjectPage.module.css';

const ProjectPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // For now we'll read projects from sessionStorage (set by ManagerDashboard)
  const raw = sessionStorage.getItem('hg_projects');
  const initialProjects = raw ? JSON.parse(raw) : [];
  const [projects, setProjects] = useState(initialProjects);
  const [currentMode, setCurrentMode] = useState(null); // 'add' or 'delete'
  const project = projects[id];

  const saveProjects = (updatedProjects) => {
    sessionStorage.setItem('hg_projects', JSON.stringify(updatedProjects));
  };

  const handleAddMember = (name) => {
    const updatedProj = { ...project, employees: Array.isArray(project.employees) ? [...project.employees, name] : [name] };
    const newProjects = [...projects];
    newProjects[id] = updatedProj;
    setProjects(newProjects);
    saveProjects(newProjects);
  };

  const handleRemoveMember = (index) => {
    const updatedProj = { ...project, employees: project.employees.filter((_, i) => i !== index) };
    const newProjects = [...projects];
    newProjects[id] = updatedProj;
    setProjects(newProjects);
    saveProjects(newProjects);
  };

  if (!project) {
    return (
      <div className={styles.container}>
        <h2>Project not found</h2>
        <button onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.back}>← Back</button>
        <h2>{project.name}</h2>
      </div>
      <div className={styles.body}>
        <h3>Description</h3>
        <p>{project.description}</p>

        <div className={styles.grid}>
          <div className={styles.leftPanel}>
            <div className={styles.teamSection}>
              <h3>Team Members</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(project.employees && project.employees.length > 0) ? (
                    project.employees.map((name, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{name}</td>
                        <td>
                          {currentMode === 'delete' && <button className={styles.removeButton} onClick={() => handleRemoveMember(idx)}>-</button>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>No team members</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <EditMembers 
                project={project} 
                onAdd={handleAddMember}
                currentMode={currentMode}
                setCurrentMode={setCurrentMode}
              />
            </div>
          </div>

          <div className={styles.rightPanel}>
            <h3>Active Tasks</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Task</th>
                  <th>Assigned</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(project.tasks && project.tasks.length > 0) ? (
                  project.tasks.map((task, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{task.title || task.name || 'Untitled task'}</td>
                      <td>{task.assignedTo || task.assignee || '-'}</td>
                      <td>{task.status || 'active'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No active tasks</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

function EditMembers({ project, onAdd, currentMode, setCurrentMode }) {
  const [showMenu, setShowMenu] = useState(false);
  const [newMember, setNewMember] = useState('');

  const handleAdd = () => {
    const name = newMember.trim();
    if (!name) return;
    onAdd(name);
    setNewMember('');
    setCurrentMode(null);
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const selectAdd = () => {
    setCurrentMode('add');
    setShowMenu(false);
  };

  const selectDelete = () => {
    setCurrentMode('delete');
    setShowMenu(false);
  };

  const doneEditing = () => {
    setCurrentMode(null);
  };

  return (
    <div className={styles.editContainer}>
      <button className={styles.threeDot} onClick={toggleMenu}>⋮</button>
      {showMenu && (
        <div className={styles.dropdown}>
          <button onClick={selectAdd}>Add Member</button>
          <button onClick={selectDelete}>Delete Members</button>
        </div>
      )}
      {currentMode === 'add' && (
        <div className={styles.addPanel}>
          <input
            type="text"
            placeholder="New member name"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            className={styles.inputSmall}
          />
          <button className={styles.addButton} onClick={handleAdd}>Add</button>
          <button className={styles.doneButton} onClick={doneEditing}>Done</button>
        </div>
      )}
      {currentMode === 'delete' && (
        <div className={styles.deletePanel}>
          <p>Click the minus buttons to remove members.</p>
          <button className={styles.doneButton} onClick={doneEditing}>Done</button>
        </div>
      )}
    </div>
  );
}

export default ProjectPage;
