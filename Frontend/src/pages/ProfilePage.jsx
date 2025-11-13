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
    <div style={{ padding: '120px 16px 24px 16px', width: '100%' }} className={styles.dashboardBg}>
      <div style={{ position: 'fixed', top: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 60 }}>
        <h1 style={{ 
          fontSize: '3rem', 
          fontWeight: '700', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: 0,
          padding: '8px 16px',
        }}>
          Profile
        </h1>
      </div>

      {/* Back button fixed on top-left (restored) */}
      <div style={{ position: 'fixed', top: 18, left: 20, zIndex: 70 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#4c51bf',
            color: '#fff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2.5fr 1.5fr', gap: 24, minHeight: 'calc(100vh - 160px)', width: '100%' }}>
        {/* Left column: tasks you're leading */}
        <div>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, height: '100%' }}>
            <h3>Tasks you're leading</h3>
            {tasksLeading && tasksLeading.length > 0 ? (
              <ul>
                {tasksLeading.map((t, i) => (
                  <li key={t._id || t._clientId || i} style={{ marginBottom: 8 }}>
                    <strong>{t.title || t.name || 'Untitled'}</strong>
                    <div style={{ fontSize: 12, marginTop: 4 }}><em>{t.projectName}</em> • {t.status || 'todo'}{t.dueDate ? ` • due ${new Date(t.dueDate).toLocaleDateString()}` : ''}</div>
                  </li>
                ))}
              </ul>
            ) : <div className={styles.italic}>No tasks found</div>}
          </div>
        </div>

        {/* Center column: account info centered */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 8, width: '100%', maxWidth: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
            <h3>Account</h3>
            <p><strong>Name:</strong> {user.name || user.fullName || '-'}</p>
            <p><strong>Username:</strong> {user.username || '-'}</p>
            <p><strong>Email:</strong> {user.email || '-'}</p>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => navigate('/forgot-password')}
                style={{
                  background: '#764ba2',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Right column: tasks you're assigned to */}
        <div>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, height: '100%' }}>
            <h3>Tasks you're assigned to</h3>
            {tasksAssigned && tasksAssigned.length > 0 ? (
              <ul>
                {tasksAssigned.map((t, i) => (
                  <li key={t._id || t._clientId || i} style={{ marginBottom: 8 }}>
                    <strong>{t.title || t.name || 'Untitled'}</strong>
                    <div style={{ fontSize: 12, marginTop: 4 }}><em>{t.projectName}</em> • {t.status || 'todo'}{t.dueDate ? ` • due ${new Date(t.dueDate).toLocaleDateString()}` : ''}</div>
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
