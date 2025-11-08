import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DashboardPage.module.css';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('http://localhost:4000/api/user/data', { method: 'GET', credentials: 'include' });
        const json = await res.json();
        if (!mounted) return;
        if (!json || !json.success || !json.userData) {
          navigate('/login');
          return;
        }
        setUser(json.userData);

        // fetch projects the user can access (created or member)
        const pRes = await fetch('http://localhost:4000/api/projects', { credentials: 'include' });
        if (pRes.ok) {
          const pjson = await pRes.json();
          if (mounted) setProjects(Array.isArray(pjson) ? pjson : []);
        } else {
          if (mounted) setProjects([]);
        }
      } catch (err) {
        console.error('profile fetch error', err);
        navigate('/login');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!user) return null;

  // tasks the person is leading: tasks inside projects they created
  const userId = String(user._id || user.id || '');
  const projectsCreated = projects.filter(p => {
    if (!p) return false;
    const cid = p.createdBy && (p.createdBy._id || p.createdBy);
    return cid && String(cid) === userId;
  });
  const tasksLeading = projectsCreated.reduce((acc, p) => {
    const tasks = Array.isArray(p.tasks) ? p.tasks.map(t => ({ ...t, projectName: p.ProjectName || p.name || '' })) : [];
    return acc.concat(tasks);
  }, []);

  // tasks the manager (user) is part of = tasks assigned to them across projects
  const tasksAssigned = projects.reduce((acc, p) => {
    const tasks = Array.isArray(p.tasks) ? p.tasks.filter(t => {
      if (!t) return false;
      // assignee may be populated object or string
      const a = t.assignedTo || t.assignee || t.assigneeName || '';
      if (!a) return false;
      if (typeof a === 'object') return String(a._id || a.username || a.email || '').toLowerCase() === String(userId).toLowerCase() || String(a.username || '').toLowerCase() === String(user.username || '').toLowerCase();
      return String(a).toLowerCase() === String(user.username || user.email || userId).toLowerCase();
    }).map(t => ({ ...t, projectName: p.ProjectName || p.name || '' })) : [];
    return acc.concat(tasks);
  }, []);

  return (
    <div style={{ padding: 24 }} className={styles.dashboardBg}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Profile</h2>
        <div>
          <button onClick={() => navigate(-1)} className={styles.back}>← Back</button>
          <button onClick={() => navigate('/forgot-password')} style={{ marginLeft: 8 }} className={styles.filterButton}>Change Password</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
          <h3>Account</h3>
          <p><strong>Name:</strong> {user.name || user.fullName || '-'}</p>
          <p><strong>Username:</strong> {user.username || '-'}</p>
          <p><strong>Email:</strong> {user.email || '-'}</p>
        </div>

        <div>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <h3>Tasks you're leading</h3>
            {tasksLeading && tasksLeading.length > 0 ? (
              <ul>
                {tasksLeading.map((t, i) => (
                  <li key={t._id || t._clientId || i} style={{ marginBottom: 8 }}>
                    <strong>{t.title || t.name || 'Untitled'}</strong> — <em>{t.projectName}</em>
                    <div style={{ fontSize: 12 }}>{t.status || 'todo'} {t.dueDate ? ` • due ${new Date(t.dueDate).toLocaleString()}` : ''}</div>
                  </li>
                ))}
              </ul>
            ) : <div className={styles.italic}>No tasks found</div>}
          </div>

          <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
            <h3>Tasks you're assigned to</h3>
            {tasksAssigned && tasksAssigned.length > 0 ? (
              <ul>
                {tasksAssigned.map((t, i) => (
                  <li key={t._id || t._clientId || i} style={{ marginBottom: 8 }}>
                    <strong>{t.title || t.name || 'Untitled'}</strong> — <em>{t.projectName}</em>
                    <div style={{ fontSize: 12 }}>{t.status || 'todo'} {t.dueDate ? ` • due ${new Date(t.dueDate).toLocaleString()}` : ''}</div>
                  </li>
                ))}
              </ul>
            ) : <div className={styles.italic}>No assigned tasks</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
