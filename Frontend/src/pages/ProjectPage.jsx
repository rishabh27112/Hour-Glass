import React, { useState } from 'react';
import PropTypes from 'prop-types';
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
  // Find project by server _id or client-side _clientId or by numeric index (older/legacy routes)
  let project = projects.find(p => String(p._id) === id || String(p._clientId) === id);
  let projectIndex = projects.findIndex(p => String(p._id) === id || String(p._clientId) === id);
  // If not found, check if the route param is a numeric index used by ManagerDashboard
  if ((!project || projectIndex === -1) && id != null) {
    const maybeIndex = Number(id);
    if (!Number.isNaN(maybeIndex) && Number.isInteger(maybeIndex) && maybeIndex >= 0 && maybeIndex < projects.length) {
      projectIndex = maybeIndex;
      project = projects[maybeIndex];
    }
  }

  const saveProjects = (updatedProjects) => {
    sessionStorage.setItem('hg_projects', JSON.stringify(updatedProjects));
  };

  // derive a cleaned employees list for rendering and operations
  const getCleanedEmployees = () => {
    if (!project) return [];
    if (project.members && Array.isArray(project.members)) {
      return project.members
        .map((m) => {
          if (!m) return '';
          if (typeof m === 'string') return m.trim();
          return (m.username || m.name || '').toString().trim();
        })
        .filter((s) => s !== '');
    }
    if (Array.isArray(project.employees)) {
      return project.employees
        .map((e) => (e == null ? '' : String(e)))
        .map((s) => s.trim())
        .filter((s) => s !== '');
    }
    return [];
  };
  const cleanedEmployees = getCleanedEmployees();

  const handleAddMember = async (identifier) => {
    // identifier may be a username (string) or an object { username, email, _id }
    const username = typeof identifier === 'string' ? identifier : (identifier.username || identifier.email || identifier._id);

    // If project has a server _id, call backend to add member so it's persisted
    if (project && project._id) {
      try {
        const res = await fetch(`/api/projects/${project._id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username })
        });
        const updated = await res.json();
        // API returns populated project; merge into sessionStorage and state
        setProjects((prev) => {
          const clone = [...prev];
          const idx = clone.findIndex(p => String(p._id) === String(project._id));
          if (idx !== -1) clone[idx] = updated;
          try { saveProjects(clone); } catch (e) { console.error('saveProjects failed', e); }
          return clone;
        });
      } catch (err) {
        console.error('Error adding member', err);
      }
      return;
    }

    // Otherwise this is an optimistic/local project: update employees list locally
    setProjects((prev) => {
      const newProjects = [...prev];
      const p = newProjects[projectIndex] ? { ...newProjects[projectIndex] } : { employees: [] };
      const current = p.employees && Array.isArray(p.employees)
        ? p.employees.map((e) => (e == null ? '' : String(e))).map((s) => s.trim()).filter((s) => s !== '')
        : [];
      p.employees = [...current, username];
      newProjects[projectIndex] = p;
      try { saveProjects(newProjects); } catch (err) { console.error('saveProjects failed', err); }
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
        idxToRemove = current.indexOf(name);
      }
      if (idxToRemove === -1) idxToRemove = index;
      if (idxToRemove < 0 || idxToRemove >= current.length) {
        // nothing to remove
        return prev;
      }
      const updated = [...current.slice(0, idxToRemove), ...current.slice(idxToRemove + 1)];
      p.employees = updated;
      newProjects[projectIndex] = p;
      try { saveProjects(newProjects); } catch (err) { console.error('saveProjects failed', err); }
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
                      <tr key={task._id || task.id || `${task.title || task.name || 'task'}-${idx}`}>
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
    const [searchBy, setSearchBy] = useState('email'); // 'email' or 'username'
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const toggleMenu = () => setShowMenu((s) => !s);

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
      setResults([]);
      setQuery('');
      setError('');
    };

    const doSearch = async () => {
      const q = query.trim();
      if (!q) return setError('Enter a search term');
      setLoading(true);
      setError('');
      try {
  // server mounts user routes at /api/user
  const url = searchBy === 'email' ? `/api/user/search?email=${encodeURIComponent(q)}` : `/api/user/search?username=${encodeURIComponent(q)}`;
        const res = await fetch(url, { credentials: 'include' });
        const json = await res.json();
        if (res.ok) {
          setResults(json.users || []);
        } else {
          setError((json && json.message) || 'Search failed');
          setResults([]);
        }
      } catch (err) {
        console.error('search error', err);
        setError('Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const handleAddFromResult = async (user) => {
      // call parent handler to add member (it will decide whether to call backend)
      await onAdd(user.username || user.email || user._id);
      // refresh local view
      doneEditing();
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <label>
                <input type="radio" checked={searchBy === 'email'} onChange={() => setSearchBy('email')} /> Email
              </label>
              <label>
                <input type="radio" checked={searchBy === 'username'} onChange={() => setSearchBy('username')} /> Username
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={searchBy === 'email' ? 'Search by email' : 'Search by username'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={styles.inputSmall}
              />
              <button className={styles.addButton} onClick={doSearch} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
              <button className={styles.doneButton} onClick={doneEditing}>Done</button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div style={{ marginTop: 8 }}>
              {results.length > 0 ? (
                <table className={styles.table}>
                  <thead>
                    <tr><th>Name</th><th>Username</th><th>Email</th><th></th></tr>
                  </thead>
                  <tbody>
                    {results.map((u) => (
                      <tr key={u._id || u.email || u.username}>
                        <td>{u.name || '-'}</td>
                        <td>{u.username || '-'}</td>
                        <td>{u.email || '-'}</td>
                        <td><button onClick={() => handleAddFromResult(u)}>Add</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ marginTop: 8, color: '#666' }}>No results</div>
              )}
            </div>
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

  EditMembers.propTypes = {
    project: PropTypes.object,
    onAdd: PropTypes.func.isRequired,
    currentMode: PropTypes.string,
    setCurrentMode: PropTypes.func.isRequired,
  };

export default ProjectPage;