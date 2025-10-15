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
  const projectIndex = Number(id);
  const project = projects[projectIndex];

  const saveProjects = (updatedProjects) => {
    sessionStorage.setItem('hg_projects', JSON.stringify(updatedProjects));
  };

  // derive a cleaned employees list for rendering and operations
  const cleanedEmployees = project && Array.isArray(project.employees)
    ? project.employees.map((e) => (e == null ? '' : String(e))).map((s) => s.trim()).filter((s) => s !== '')
    : [];

  const handleAddMember = (name) => {
    setProjects((prev) => {
      const newProjects = [...prev];
      const p = newProjects[projectIndex] ? { ...newProjects[projectIndex] } : { employees: [] };
      const current = p.employees && Array.isArray(p.employees)
        ? p.employees.map((e) => (e == null ? '' : String(e))).map((s) => s.trim()).filter((s) => s !== '')
        : [];
      p.employees = [...current, name];
      newProjects[projectIndex] = p;
      try { saveProjects(newProjects); } catch (err) { /* ignore */ }
      return newProjects;
    });
  };

  const handleRemoveMember = (index, name) => {
    setProjects((prev) => {
      const newProjects = [...prev];
      const p = newProjects[projectIndex] ? { ...newProjects[projectIndex] } : { employees: [] };
      // Recompute a normalized employee list
      const current = p.employees && Array.isArray(p.employees)
        ? p.employees.map((e) => (e == null ? '' : String(e))).map((s) => s.trim()).filter((s) => s !== '')
        : [];
      // Try to remove by exact name match first (safer if original array had odd values), else fall back to index
      let idxToRemove = -1;
      if (typeof name === 'string') {
        idxToRemove = current.findIndex((n) => n === name);
      }
      if (idxToRemove === -1) idxToRemove = index;
      if (idxToRemove < 0 || idxToRemove >= current.length) {
        // nothing to remove
        return prev;
      }
      const updated = [...current.slice(0, idxToRemove), ...current.slice(idxToRemove + 1)];
      p.employees = updated;
      newProjects[projectIndex] = p;
      try { saveProjects(newProjects); } catch (err) { /* ignore */ }
      return newProjects;
    });
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
                  {cleanedEmployees.length > 0 ? (
                    cleanedEmployees.map((name, idx) => (
                      <tr key={`${name}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td>{name}</td>
                        <td>
                          {currentMode === 'delete' && <button className={styles.removeButton} onClick={() => handleRemoveMember(idx, name)}>-</button>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className={styles.italic}>No members yet</td>
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