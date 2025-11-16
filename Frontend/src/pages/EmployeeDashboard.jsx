import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';

// Usage Logs (project-scoped) — opened from Project page. Reads `projectId` and optional `username` from query.
const EmployeeDashboard = () => {
  const location = useLocation();
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const projectId = qs.get('projectId');
  const usernameParam = qs.get('username'); // optional: manager clicking an employee

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState([]);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (!projectId) return;
    let active = true;

    const parseUserFromStorage = () => {
      try {
        const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error('parse user failed', e);
        return null;
      }
    };

    const extractSelfEntriesFromManagerResp = (json) => {
      if (!json || !Array.isArray(json.employeeStats)) return [];
      const target = usernameParam || parseUserFromStorage()?.username;
      if (!target) return [];
      const found = json.employeeStats.find(e => e.username === target || e._id === target);
      return (found && Array.isArray(found.entries)) ? found.entries : [];
    };

    const load = async () => {
      setLoading(true); setError('');
      try {
        // fetch project info (optional) and entries
        const [projRes, timeRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { credentials: 'include' }),
          fetch(`/api/time-entries/project/${projectId}`, { credentials: 'include' })
        ]);

        const projJson = await projRes.json().catch(() => null);
        if (active && projJson) setProjectName(projJson.name || projJson.ProjectName || 'Project');

        const timeJson = await timeRes.json().catch(() => ({}));

        if (!timeRes.ok) {
          setError(timeJson.msg || timeJson.error || 'Failed to load time entries');
          setEntries([]);
          return;
        }

        // If route returned isManager true, it includes employeeStats. If usernameParam present, filter for that employee.
        if (timeJson.isManager === true) {
          const filtered = usernameParam ? extractSelfEntriesFromManagerResp(timeJson) : extractSelfEntriesFromManagerResp(timeJson) || [];
          setEntries(filtered || []);
          return;
        }

        // For employees, route returns { isManager: false, entries: [...] }
        if (timeJson.isManager === false) {
          setEntries(timeJson.entries || []);
          return;
        }

        // Fallback: if timeJson.entries exists, use it
        setEntries(timeJson.entries || []);
      } catch (err) {
        console.error('Load Usage Logs failed', err);
        setError('Network error');
        setEntries([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [projectId, usernameParam]);

  // Flatten intervals and compute categorizations
  const { flattened, groups, totals } = useMemo(() => {
    const flat = [];
    const appGroups = {};
    let billable = 0, nonbill = 0, ambiguous = 0, total = 0;

    for (const entry of entries || []) {
      const username = entry.username || entry.user || entry.owner || '';
      const appointments = Array.isArray(entry.appointments) ? entry.appointments : [];
      for (const apt of appointments) {
        const apptitle = apt.apptitle || apt.appname || 'Session';
        const appname = apt.appname || apptitle || 'Unknown';
        const isBillable = !!apt.isBillable;
        const suggested = apt.suggestedCategory || apt.suggested || 'ambiguous';
        const intervals = Array.isArray(apt.timeIntervals) ? apt.timeIntervals : [];
        for (const iv of intervals) {
          const dur = Number(iv.duration) || 0;
          const row = {
            id: `${entry._id || entry.id || username}_${appname}_${iv.startTime || ''}_${iv.endTime || ''}`,
            username,
            apptitle,
            appname,
            startTime: iv.startTime,
            endTime: iv.endTime,
            duration: dur,
            isBillable,
            suggestedCategory: suggested
          };
          flat.push(row);

          // totals
          total += dur;
          if (isBillable) billable += dur;
          else if (suggested === 'non-billable' || suggested === 'nonbillable') nonbill += dur;
          else ambiguous += dur;

          // grouping
          if (!appGroups[appname]) appGroups[appname] = { intervals: [], total: 0 };
          appGroups[appname].intervals.push(row);
          appGroups[appname].total += dur;
        }
      }
    }

    return { flattened: flat, groups: appGroups, totals: { billable, nonbill, ambiguous, total } };
  }, [entries]);

  const fmt = (s) => {
    const hrs = Math.floor(s/3600), mins = Math.floor((s%3600)/60), sec = Math.floor(s%60);
    return `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Usage Logs</h2>
        <p className="text-sm text-gray-400 mt-2">Open this page from a Project page. Missing <code>projectId</code> in URL.</p>
        <Link to="/projects" className="text-cyan mt-3 inline-block">Go to Projects</Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Usage Logs</h1>
          <div className="text-sm text-gray-400">{projectName} {usernameParam ? `— ${usernameParam}` : ''}</div>
        </div>
      </header>

      <section className="mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded bg-green-900/10">
            <div className="text-xs text-green-300">Billable</div>
            <div className="text-xl font-mono mt-2">{fmt(totals.billable)}</div>
          </div>
          <div className="p-4 border rounded bg-red-900/10">
            <div className="text-xs text-red-300">Non-Billable</div>
            <div className="text-xl font-mono mt-2">{fmt(totals.nonbill)}</div>
          </div>
          <div className="p-4 border rounded bg-yellow-900/10">
            <div className="text-xs text-yellow-300">Ambiguous</div>
            <div className="text-xl font-mono mt-2">{fmt(totals.ambiguous)}</div>
          </div>
          <div className="p-4 border rounded bg-blue-900/10">
            <div className="text-xs text-blue-300">Total</div>
            <div className="text-xl font-mono mt-2">{fmt(totals.total)}</div>
          </div>
        </div>
      </section>

      <section className="mb-4">
        <div className="text-sm text-gray-300 mb-2">All intervals (flattened): {flattened.length}</div>
        <div className="bg-surface p-4 rounded border">
          {loading && <div className="text-sm text-gray-400">Loading…</div>}
          {error && <div className="text-sm text-red-400">{error}</div>}

          {!loading && !error && (
            <div className="flex gap-6">
              <div className="flex-1">
                <ul className="space-y-2 text-sm text-gray-300">
                  {flattened.slice(0, 8).map((iv) => (
                    <li key={iv.id} className="flex justify-between items-center">
                      <div className="truncate max-w-[420px]">{iv.apptitle} — {iv.appname}</div>
                      <div className="text-xs text-gray-400">{iv.startTime ? new Date(iv.startTime).toLocaleString() : '-'} → {iv.endTime ? new Date(iv.endTime).toLocaleTimeString() : '-'}</div>
                    </li>
                  ))}
                  {flattened.length === 0 && <li className="text-xs text-gray-500 italic">No intervals recorded</li>}
                </ul>
              </div>
              <div className="w-48 text-right text-sm text-gray-300">
                {flattened.slice(0,8).map(iv => (
                  <div key={iv.id} className="mb-2">{fmt(iv.duration)}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="bg-surface p-4 rounded border">
          {Object.entries(groups).length === 0 && <div className="text-xs text-gray-500 italic">No app sessions to show</div>}
          {Object.entries(groups).map(([app, info]) => (
            <div key={app} className="border-b last:border-b-0 py-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-cyan-600 rounded flex items-center justify-center text-white">▶</div>
                  <div className="text-sm font-semibold text-white">{app}</div>
                  <div className="text-xs text-gray-400">({info.intervals.length} sessions)</div>
                </div>
                <div className="text-xs text-gray-400 mt-2">{info.intervals.slice(0,3).map(iv => (
                  <div key={iv.id} className="flex items-center gap-3">
                    <div className="truncate max-w-[420px]">{iv.apptitle}</div>
                    <div className="text-[11px] text-gray-500">{iv.startTime ? new Date(iv.startTime).toLocaleTimeString() : '-'} → {iv.endTime ? new Date(iv.endTime).toLocaleTimeString() : '-'}</div>
                  </div>
                ))}</div>
              </div>
              <div className="text-sm text-gray-300">Total: {fmt(info.total)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default EmployeeDashboard;