import React from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import styles from '../ProjectPage.module.css';

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
  } = props;

  const handleCancel = () => {
    setShowAddTaskDialog(false);
    setTaskTitle('');
    if (setTaskAssignee) setTaskAssignee('');
    if (setTaskAssigned) setTaskAssigned('');
    if (setTaskStatus) setTaskStatus('todo');
    setTaskError('');
  };

  return (
    <div className={styles.rightPanel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Active Tasks</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={styles.filterButton} onClick={() => setShowTaskFilter((s) => !s)}>Filter</button>
          <button type="button" className={styles.addTaskVisible} onClick={() => setShowAddTaskDialog(true)}>+ Add Task</button>
        </div>
      </div>
      {showTaskFilter && (
        <div style={{ margin: '8px 0', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
              Member
              <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)} style={{ padding: 6 }}>
                <option value="">All</option>
                {cleanedEmployees && cleanedEmployees.map((m, i) => (
                  <option key={`${m}-${i}`} value={m}>{m}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
              Status
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: 6 }}>
                <option value="">All</option>
                <option value="todo">To do</option>
                <option value="in-progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => { setFilterMember(''); setFilterStatus(''); setShowTaskFilter(false); }}>Clear</button>
              <button onClick={() => setShowTaskFilter(false)}>Apply</button>
            </div>
          </div>
        </div>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th></th>
            <th>#</th>
            <th>Task</th>
            <th>Assigned</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
              {(tasksToShow && tasksToShow.length > 0) ? (
            tasksToShow.map((task, idx) => {
              const tid = getTaskKey(task, idx);
              const isActive = activeTimer && activeTimer.taskId === tid;
                  // Normalize assignee display: support string or populated object
                  const resolveAssignee = (a) => {
                    if (!a) return '-';
                    if (typeof a === 'string') return a;
                    if (typeof a === 'object') return a.username || a.name || a._id || '-';
                    return String(a);
                  };
                  const displayedAssigned = resolveAssignee(task.assignedTo || task.assignee || task.assigneeName);
              return (
                <tr key={tid}>
                  <td>
                    {isActive ? (
                      <button onClick={() => pauseTimer(tid)}>⏸</button>
                    ) : (
                      <button onClick={() => startTimer(tid)}>▶</button>
                    )}
                  </td>
                  <td>{idx + 1}</td>
                      <td>
                        {/* link to task page */}
                        <Link to={`/projects/${props.projectId || ''}/tasks/${tid}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          {task.title || task.name || 'Untitled task'}
                        </Link>
                      </td>
                  <td>{displayedAssigned}</td>
                  <td>{task.status || 'todo'}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={5}>No active tasks</td>
            </tr>
          )}
        </tbody>
      </table>

      {showAddTaskDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 640, maxWidth: '95%', background: '#fff', borderRadius: 8, padding: 16 }}>
            <h3>Add Task</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="text" placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} style={{ padding: 8 }} />
              <textarea placeholder="Description (optional)" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} style={{ padding: 8, minHeight: 80 }} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                Assign to member
                <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} style={{ padding: 8 }}>
                  {/* only allow selecting members that are part of this project */}
                  {cleanedEmployees && cleanedEmployees.length > 0 ? (
                    cleanedEmployees.map((m, i) => (
                      <option key={`${m}-${i}`} value={m}>{m}</option>
                    ))
                  ) : (
                    <>
                      <option value="">No members</option>
                      <option value="">All Members</option>
                    </>
                  )}
                  <option value="">Unassigned</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                  Due date
                  <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} style={{ padding: 8 }} />
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12, justifyContent: 'center' }}>
                  <span>Status: To do (default)</span>
                </div>
              </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={handleCancel}>Cancel</button>
                <button disabled={taskLoading} onClick={handleAddTaskSubmit}>
                  {taskLoading ? 'Adding...' : 'Add Task'}
                </button>
              </div>
              {taskError && <div style={{ color: 'red' }}>{taskError}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
};
