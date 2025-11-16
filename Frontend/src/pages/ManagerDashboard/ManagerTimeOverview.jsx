// src/pages/ManagerDashboard/ManagerTimeOverview.jsx
import React, { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';

function formatSeconds(sec) {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${hrs}h ${mins}m ${rem}s`;
}

const ManagerTimeOverview = ({ ownedProjects }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [projectFilter, setProjectFilter] = useState('all');
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const fetchOverview = async (projId) => {
    setLoading(true); setError('');
    try {
      const url = projId && projId !== 'all' ? `/api/time-entries/manager/overview?projectId=${encodeURIComponent(projId)}` : '/api/time-entries/manager/overview';
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setData(json.overview);
      } else if (res.ok) {
        // legacy format if ok not provided
        setData(json.overview || null);
      } else {
        setError(json.error || json.msg || 'Failed to load overview');
        setData(null);
      }
    } catch (err) {
      setError('Network error while loading overview');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(projectFilter === 'all' ? null : projectFilter); }, [projectFilter]);

  const summaryCards = useMemo(() => {
    if (!data || !data.summary) return [];
    const { totalBillable, totalNonBillable, totalAmbiguous, totalTime } = data.summary;
    return [
      { label: 'Billable', value: totalBillable, color: 'green', bg: 'bg-green-900/30', border: 'border-green-700' },
      { label: 'Non-Billable', value: totalNonBillable, color: 'red', bg: 'bg-red-900/30', border: 'border-red-700' },
      { label: 'Ambiguous', value: totalAmbiguous, color: 'yellow', bg: 'bg-yellow-900/30', border: 'border-yellow-700' },
      { label: 'Total', value: totalTime, color: 'blue', bg: 'bg-blue-900/30', border: 'border-blue-700' }
    ];
  }, [data]);

  const ownedOptions = useMemo(() => ownedProjects.map(p => ({ id: p._id, name: p.name || p.ProjectName || 'Unnamed' })), [ownedProjects]);

  if (loading && !data) {
    return <div className="p-4 bg-surface-light rounded-lg">Loading overview...</div>;
  }
  if (error) {
    return <div className="p-4 bg-surface-light rounded-lg text-red-400 text-sm">{error}</div>;
  }
  if (!data) {
    return <div className="p-4 bg-surface-light rounded-lg text-gray-400 text-sm">No overview available.</div>;
  }

  return (
    <div className="bg-surface rounded-lg p-4 shadow-md mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-white">Team Time Overview</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Project Filter</label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-surface-light text-gray-200 text-sm rounded-md px-3 py-1 border border-surface-light focus:outline-none focus:ring-2 focus:ring-cyan"
          >
            <option value="all">All Owned Projects</option>
            {ownedOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {summaryCards.map(c => (
          <div key={c.label} className={`${c.bg} ${c.border} border rounded-lg p-3`}> 
            <div className={`text-${c.color}-400 text-xs font-semibold`}>{c.label}</div>
            <div className="text-white text-lg font-bold mt-1">{formatSeconds(c.value)}</div>
          </div>
        ))}
      </div>

      {/* Employee Table */}
      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-light text-gray-400">
              <th className="py-2 px-2">Employee</th>
              <th className="py-2 px-2">Billable</th>
              <th className="py-2 px-2">Non-Billable</th>
              <th className="py-2 px-2">Ambiguous</th>
              <th className="py-2 px-2">Total</th>
              <th className="py-2 px-2">Projects</th>
            </tr>
          </thead>
          <tbody>
            {data.employees && data.employees.length > 0 ? (
              data.employees.map(emp => {
                const isExpanded = expandedEmployee === emp.username;
                return (
                  <React.Fragment key={emp.username}>
                    <tr className="border-b border-surface hover:bg-surface-light/60 transition-colors">
                      <td className="py-2 px-2 text-gray-200 font-medium">
                        <button
                          className="text-cyan hover:text-cyan-light"
                          onClick={() => setExpandedEmployee(isExpanded ? null : emp.username)}
                        >
                          {isExpanded ? '▼' : '▶'} {emp.username}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-green-400">{formatSeconds(emp.billable)}</td>
                      <td className="py-2 px-2 text-red-400">{formatSeconds(emp.nonBillable)}</td>
                      <td className="py-2 px-2 text-yellow-400">{formatSeconds(emp.ambiguous)}</td>
                      <td className="py-2 px-2 text-white font-semibold">{formatSeconds(emp.totalTime)}</td>
                      <td className="py-2 px-2 text-gray-300">{emp.projects.length}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-surface-light/30">
                        <td colSpan={6} className="p-2">
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {emp.projects.map(pr => (
                              <div key={pr.projectId} className="border border-surface rounded-md p-2 text-xs">
                                <div className="font-semibold text-gray-200 truncate" title={pr.name}>{pr.name}</div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  <span className="px-2 py-0.5 rounded bg-green-900/40 text-green-400">{formatSeconds(pr.billable)} Billable</span>
                                  <span className="px-2 py-0.5 rounded bg-red-900/40 text-red-400">{formatSeconds(pr.nonBillable)} Non</span>
                                  <span className="px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-400">{formatSeconds(pr.ambiguous)} Ambig</span>
                                </div>
                                <div className="mt-1 text-gray-300">Total: {formatSeconds(pr.totalTime)}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr><td colSpan={6} className="py-4 text-center text-gray-500 italic">No employee data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

ManagerTimeOverview.propTypes = {
  ownedProjects: PropTypes.array.isRequired
};

export default ManagerTimeOverview;
