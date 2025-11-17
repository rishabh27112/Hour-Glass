// src/pages/ProjectPage/TasksPanel.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { RiFilterLine, RiAddLine, RiCloseLine } from 'react-icons/ri';

export default function TasksPanel(props) {
  const {
    tasksToShow,
    getTaskKey,
    activeTimer,
    pauseTimer,
    startTimer,
    showTaskFilter,
    setShowTaskFilter,
    filterMember,
    setFilterMember,
    filterStatus,
    setFilterStatus,
    cleanedEmployees,
    setShowAddTaskDialog,
    showAddTaskDialog,
    taskTitle,
    setTaskTitle,
    taskDescription,
    setTaskDescription,
    taskAssignee,
    setTaskAssignee,
    taskDueDate,
    setTaskDueDate,
    taskError,
    taskLoading,
    handleAddTaskSubmit,
    setTaskError,
    setTaskAssigned,
    setTaskStatus,
    currentUser,
    isCreator,
  } = props;

  const handleCancel = () => {
    setShowAddTaskDialog(false);
    setTaskTitle('');
    if (setTaskAssignee) setTaskAssignee('');
    if (setTaskAssigned) setTaskAssigned('');
    if (setTaskStatus) setTaskStatus('todo');
    setTaskError('');
    if (setTaskDescription) setTaskDescription('');
    if (setTaskDueDate) setTaskDueDate('');
  };

  // Permission check for Add Task button
  const canAddTask = isCreator || (currentUser && (currentUser.role === 'manager' || currentUser.isManager === true));

  return (
    // === MODIFICATION: Root div is now a full-height flex column ===
    <div className="bg-surface rounded-lg shadow-md p-6 h-full flex flex-col min-h-0">
      {/* === MODIFICATION: Header area is static (won't shrink) === */}
      <div className="flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-semibold text-white">Active Tasks</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex items-center gap-1 border border-cyan text-cyan font-semibold py-1 px-3 rounded-lg text-sm hover:bg-cyan hover:text-brand-bg transition-colors"
              onClick={() => setShowTaskFilter((s) => !s)}
            >
              <RiFilterLine />
              Filter
            </button>
            {canAddTask && (
              <button
                type="button"
                className="flex items-center gap-1 bg-cyan text-brand-bg font-bold py-1 px-3 rounded-lg text-sm hover:bg-cyan-dark transition-colors"
                onClick={() => setShowAddTaskDialog(true)}
              >
                <RiAddLine />
                Add Task
              </button>
            )}
          </div>
        </div>
        
        {showTaskFilter && (
          <div className="bg-surface-light rounded-lg p-4 my-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <label className="flex flex-col gap-1 text-sm text-gray-300 w-full md:w-auto">
                Member
                <select
                  value={filterMember}
                  onChange={(e) => setFilterMember(e.target.value)}
                  className="bg-surface border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-cyan focus:border-cyan"
                >
                  <option value="">All</option>
                  {cleanedEmployees && cleanedEmployees.map((m, i) => (
                    <option key={`${m}-${i}`} value={m}>{m}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-gray-300 w-full md:w-auto">
                Status
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-surface border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-cyan focus:border-cyan"
                >
                  <option value="">All</option>
                  <option value="todo">To do</option>
                  <option value="in-progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </label>

              <div className="flex gap-2 ml-auto pt-4 md:pt-0">
                <button 
                  onClick={() => { setFilterMember(''); setFilterStatus(''); setShowTaskFilter(false); }}
                  className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm hover:bg-gray-500 transition-colors"
                >
                  Clear
                </button>
                <button 
                  onClick={() => setShowTaskFilter(false)}
                  className="bg-cyan text-brand-bg font-semibold py-2 px-4 rounded-lg text-sm hover:bg-cyan-dark transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* === MODIFICATION: This div wraps the table and scrolls === */}
      <div className="flex-1 overflow-y-auto pr-2 min-h-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-light">
              <th className="py-2 px-1 text-gray-400 font-semibold w-10"></th>
              <th className="py-2 px-1 text-gray-400 font-semibold w-10">#</th>
              <th className="py-2 px-1 text-gray-400 font-semibold">Task</th>
              <th className="py-2 px-1 text-gray-400 font-semibold">Assigned</th>
              <th className="py-2 px-1 text-gray-400 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
              {(tasksToShow && tasksToShow.length > 0) ? (
              tasksToShow.map((task, idx) => {
                const tid = getTaskKey(task, idx);
                const isActive = activeTimer && activeTimer.taskId === tid;
                
                const assigneeData = task.assignedTo || task.assignee || task.assigneeName;
                const displayedAssigned = assigneeData 
                  ? (typeof assigneeData === 'object' 
                      ? (assigneeData.username || assigneeData.name || assigneeData._id || '-')
                      : String(assigneeData))
                  : '-';
                
                const userIdentifiers = currentUser ? [currentUser.username, currentUser.email, currentUser._id].filter(Boolean).map((s) => String(s).toLowerCase()) : [];
                const isAssigned = userIdentifiers.length > 0 && userIdentifiers.includes(String(displayedAssigned).toLowerCase());
                const isManagerFlag = currentUser && (currentUser.role === 'manager' || currentUser.isManager === true);
                // New policy:
                // - Only the assigned member may START/PAUSE the timer for a task.
                // - Project creator or manager may OPEN/view the task but cannot start/pause timers.
                const canStartStop = Boolean(isAssigned);
                const canOpen = Boolean(isAssigned || isManagerFlag || isCreator);

                // Determine displayed status: if task is still "todo" but has recorded time
                // or is currently running, show "in-progress" for that task only.
                const rawStatus = task.status || 'todo';
                const hasRecordedTime = (task.timeSpent && Number(task.timeSpent) > 0) || (task.time && Number(task.time) > 0);
                const isCurrentlyActive = isActive;
                const displayStatus = (rawStatus === 'todo' && (hasRecordedTime || isCurrentlyActive)) ? 'in-progress' : rawStatus;

                return (
                  <tr key={tid} className="border-b border-surface-light">
                    <td className="py-3 px-1">
                      <button 
                        onClick={() => isActive ? pauseTimer(tid) : startTimer(tid)} 
                        disabled={!canStartStop}
                        title={canStartStop ? (isActive ? "Pause timer" : "Start timer") : "Only the assigned member can start/stop this timer"}
                        className={`
                          text-2xl transition-colors
                          ${!canStartStop && 'opacity-30 cursor-not-allowed'}
                          ${isActive 
                            ? 'text-yellow-400 hover:text-yellow-300' 
                            : 'text-cyan hover:text-cyan-dark'
                          }
                        `}
                      >
                        {isActive ? '⏸' : '▶'}
                      </button>
                    </td>
                    <td className="py-3 px-1 text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-1">
                      {canOpen ? (
                        <Link 
                          to={`/projects/${props.projectId || ''}/tasks/${tid}`} 
                          className="text-gray-200 font-medium hover:text-cyan transition-colors"
                        >
                          {task.title || task.name || 'Untitled task'}
                        </Link>
                      ) : (
                        <span
                          title="Only project creator or assigned member can open this task"
                          className="text-gray-400 font-medium cursor-not-allowed"
                        >
                          {task.title || task.name || 'Untitled task'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-1 text-gray-300">{displayedAssigned}</td>
                    <td className="py-3 px-1 text-gray-300">{displayStatus}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500 italic">No active tasks found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddTaskDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface-light rounded-lg shadow-xl w-full max-w-2xl p-6 relative">
            <button 
              onClick={handleCancel}
              className="absolute top-3 right-4 text-gray-400 hover:text-white text-2xl"
            >
              <RiCloseLine />
            </button>
            <h3 className="text-2xl font-bold text-white mb-6">Add New Task</h3>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Task title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full bg-surface text-gray-200 placeholder-gray-400 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light"
              />
              <textarea
                placeholder="Description (optional)"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="w-full bg-surface text-gray-200 placeholder-gray-400 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light min-h-[80px]"
              />
              <label className="flex flex-col gap-1 text-sm text-gray-300">
                Assign to member
                <select
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  className="w-full bg-surface text-gray-200 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light"
                >
                  {cleanedEmployees && cleanedEmployees.length > 0 ? (
                    cleanedEmployees.map((m, i) => (
                      <option key={`${m}-${i}`} value={m}>{m}</option>
                    ))
                  ) : (
                    <option value="">No members</option>
                  )}
                  <option value="">Unassigned</option>
                </select>
              </label>
              
              <div className="flex flex-col md:flex-row gap-4">
                <label className="flex flex-col gap-1 text-sm text-gray-300 flex-1">
                  Due date (optional)
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-surface text-gray-200 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface-light"
                  />
                </label>
                <div className="flex flex-col gap-1 text-sm text-gray-300 flex-1">
                  Status
                  <input
                    type="text"
                    readOnly
                    value="To do (default)"
                    className="w-full bg-surface/50 text-gray-400 py-2 px-4 rounded-lg border border-surface-light"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 justify-end mt-4">
                <button 
                  onClick={handleCancel}
                  className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={taskLoading}
                  onClick={handleAddTaskSubmit}
                  className="bg-cyan text-brand-bg font-semibold py-2 px-4 rounded-lg text-sm hover:bg-cyan-dark transition-colors disabled:opacity-50"
                >
                  {taskLoading ? 'Adding...' : 'Add Task'}
                </button>
              </div>
              {taskError && <div className="text-red-500 text-sm text-right">{taskError}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PropTypes are preserved exactly from your original code
TasksPanel.propTypes = {
  tasksToShow: PropTypes.array,
  getTaskKey: PropTypes.func.isRequired,
  activeTimer: PropTypes.object,
  pauseTimer: PropTypes.func.isRequired,
  startTimer: PropTypes.func.isRequired,
  showTaskFilter: PropTypes.bool,
  setShowTaskFilter: PropTypes.func.isRequired,
  filterMember: PropTypes.string,
  setFilterMember: PropTypes.func.isRequired,
  filterStatus: PropTypes.string,
  setFilterStatus: PropTypes.func.isRequired,
  cleanedEmployees: PropTypes.array,
  setShowAddTaskDialog: PropTypes.func.isRequired,
  showAddTaskDialog: PropTypes.bool,
  taskTitle: PropTypes.string,
  setTaskTitle: PropTypes.func.isRequired,
  taskDescription: PropTypes.string,
  setTaskDescription: PropTypes.func.isRequired,
  taskAssignee: PropTypes.string,
  setTaskAssignee: PropTypes.func.isRequired,
  taskDueDate: PropTypes.string,
  setTaskDueDate: PropTypes.func.isRequired,
  taskError: PropTypes.string,
  taskLoading: PropTypes.bool,
  handleAddTaskSubmit: PropTypes.func.isRequired,
  setTaskError: PropTypes.func.isRequired,
  setTaskAssigned: PropTypes.func,
  setTaskStatus: PropTypes.func,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  currentUser: PropTypes.object,
  isCreator: PropTypes.bool,
};