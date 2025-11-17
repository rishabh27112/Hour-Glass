import React from 'react';
import PropTypes from 'prop-types';

const ManagerSummaryPanel = ({ data }) => {
  if (!data) return null;

  // Normalize different shapes returned by POST vs GET
  let managerText = '';
  let reports = [];
  let date = null;
  let managerUsername = '';

  if (data.summary && data.summary.reports) {
    // GET /ai-summary/manager -> { ok: true, summary: { ... } }
    const s = data.summary;
    managerText = s.summary || s.managerSummary || '';
    reports = s.reports || [];
    date = s.date;
    managerUsername = s.managerUsername || '';
  } else if (data.managerSummary || data.reports) {
    // POST /daily-summary/manager -> { ok: true, managerSummary, reportsCount }
    managerText = data.managerSummary || '';
    reports = data.reports || [];
    date = data.date || null;
    managerUsername = data.managerUsername || '';
  } else {
    // fallback: try to treat `data` as the summary object itself
    managerText = data.summary || data.managerSummary || '';
    reports = data.reports || [];
    date = data.date || null;
    managerUsername = data.managerUsername || '';
  }

  const prettyDate = date ? (new Date(date)).toLocaleString() : null;

  return (
    <div className="bg-surface rounded-lg shadow-md p-4 text-gray-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-400">Manager</div>
          <div className="text-lg font-semibold text-white">{managerUsername || 'Manager'}</div>
          {prettyDate && <div className="text-xs text-gray-400 mt-1">{prettyDate}</div>}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Reports</div>
          <div className="text-lg font-semibold text-white">{reports.length}</div>
        </div>
      </div>

      <div className="mt-4 bg-surface-light p-4 rounded-md">
        <div className="text-sm text-gray-300 font-semibold mb-2">Summary</div>
        {managerText ? (
          <div className="whitespace-pre-wrap text-sm text-gray-100">{managerText}</div>
        ) : (
          <div className="text-gray-500 italic">No summary text returned from server.</div>
        )}
      </div>

      <div className="mt-4">
        <div className="text-sm text-gray-300 font-semibold mb-2">Member Reports</div>
        {reports.length === 0 ? (
          <div className="text-gray-500 italic">No member reports available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reports.map((r, idx) => (
              <div key={r.username || idx} className="bg-gray-800/40 p-3 rounded-md border border-surface-light">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{r.username || r.user || 'unknown'}</div>
                    <div className="text-xs text-gray-400">Items: {r.itemsCount ?? (r.items ? r.items.length : 0)}</div>
                  </div>
                  <div className="text-xs text-gray-300">{r.itemsCount > 0 ? `${r.itemsCount} activities` : 'No activity'}</div>
                </div>
                <div className="mt-2 text-sm text-gray-200 whitespace-pre-wrap">{r.summary || 'No recorded activity.'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerSummaryPanel;

ManagerSummaryPanel.propTypes = {
  data: PropTypes.oneOfType([PropTypes.object, PropTypes.array])
};