// src/pages/ProjectPage/TimeLogsPanel.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const TimeLogsPanel = ({ projectId, currentUser, isManager }) => {
  const [timeData, setTimeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');

  useEffect(() => {
    if (!projectId) return;
    
    const fetchTimeLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/time-entries/project/${projectId}`, {
          credentials: 'include'
        });
        
        if (res.ok) {
          const data = await res.json();
          setTimeData(data);
        } else {
          setError('Failed to load time logs');
        }
      } catch (err) {
        console.error('Error fetching time logs:', err);
        setError('Failed to load time logs');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeLogs();
    const interval = setInterval(fetchTimeLogs, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [projectId]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    // Format seconds with two decimal places to avoid long floating-point tails
    const secsStr = (typeof secs === 'number' && !Number.isNaN(secs)) ? secs.toFixed(2) : String(secs);
    return `${hrs}h ${mins}m ${secsStr}s`;
  };

  if (loading && !timeData) {
    return (
      <div className="bg-surface rounded-lg shadow-md p-6">
        <h3 className="text-2xl font-semibold text-white mb-4">Time Logs</h3>
        <p className="text-gray-400">Loading time logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg shadow-md p-6">
        <h3 className="text-2xl font-semibold text-white mb-4">Time Logs</h3>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!timeData) {
    return null;
  }

  // Manager view
  if (timeData.isManager && timeData.employeeStats) {
    const filteredStats = selectedEmployee === 'all' 
      ? timeData.employeeStats 
      : timeData.employeeStats.filter(emp => emp.username === selectedEmployee);

    return (
      <div className="bg-surface rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-semibold text-white">Team Time Logs</h3>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="bg-surface-light border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-cyan focus:border-cyan"
          >
            <option value="all">All Employees</option>
            {timeData.employeeStats.map((emp) => (
              <option key={emp.username} value={emp.username}>
                {emp.username}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        {timeData.summary && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
              <div className="text-green-400 text-sm font-semibold">Total Billable</div>
              <div className="text-white text-xl font-bold">{formatTime(timeData.summary.totalBillable)}</div>
            </div>
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <div className="text-red-400 text-sm font-semibold">Total Non-Billable</div>
              <div className="text-white text-xl font-bold">{formatTime(timeData.summary.totalNonBillable)}</div>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <div className="text-yellow-400 text-sm font-semibold">Total Ambiguous</div>
              <div className="text-white text-xl font-bold">{formatTime(timeData.summary.totalAmbiguous)}</div>
            </div>
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
              <div className="text-blue-400 text-sm font-semibold">Total Time</div>
              <div className="text-white text-xl font-bold">{formatTime(timeData.summary.totalTime)}</div>
            </div>
          </div>
        )}

        {/* Employee Stats */}
        <div className="space-y-4">
          {filteredStats.map((emp) => (
            <div key={emp.username} className="bg-surface-light rounded-lg p-4 border border-surface">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold text-white">{emp.username}</h4>
                <span className="text-gray-400 text-sm">Total: {formatTime(emp.totalTime)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-green-400">Billable:</span>
                  <span className="text-white ml-2">{formatTime(emp.billable)}</span>
                </div>
                <div>
                  <span className="text-red-400">Non-Billable:</span>
                  <span className="text-white ml-2">{formatTime(emp.nonBillable)}</span>
                </div>
                <div>
                  <span className="text-yellow-400">Ambiguous:</span>
                  <span className="text-white ml-2">{formatTime(emp.ambiguous)}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredStats.length === 0 && (
            <p className="text-gray-400 italic">No time logs found for selected employee.</p>
          )}
        </div>
      </div>
    );
  }

  // Employee view
  if (timeData.entries && timeData.summary) {
    return (
      <div className="bg-surface rounded-lg shadow-md p-6">
        <h3 className="text-2xl font-semibold text-white mb-4">My Time Logs</h3>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
            <div className="text-green-400 text-sm font-semibold">Billable</div>
            <div className="text-white text-xl font-bold">{formatTime(timeData.summary.billable)}</div>
          </div>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
            <div className="text-red-400 text-sm font-semibold">Non-Billable</div>
            <div className="text-white text-xl font-bold">{formatTime(timeData.summary.nonBillable)}</div>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
            <div className="text-yellow-400 text-sm font-semibold">Ambiguous</div>
            <div className="text-white text-xl font-bold">{formatTime(timeData.summary.ambiguous)}</div>
          </div>
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
            <div className="text-blue-400 text-sm font-semibold">Total Time</div>
            <div className="text-white text-xl font-bold">{formatTime(timeData.summary.totalTime)}</div>
          </div>
        </div>

        {timeData.entries.length === 0 ? (
          <p className="text-gray-400 italic">No time logs recorded yet.</p>
        ) : (
          <div className="text-sm text-gray-300">
            <p>{timeData.entries.length} time {timeData.entries.length === 1 ? 'entry' : 'entries'} recorded</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg shadow-md p-6">
      <h3 className="text-2xl font-semibold text-white mb-4">Time Logs</h3>
      <p className="text-gray-400">No time logs available.</p>
    </div>
  );
};

TimeLogsPanel.propTypes = {
  projectId: PropTypes.string.isRequired,
  currentUser: PropTypes.object,
  isManager: PropTypes.bool
};

export default TimeLogsPanel;
