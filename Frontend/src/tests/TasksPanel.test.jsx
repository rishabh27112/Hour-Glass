import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TasksPanel from '../pages/ProjectPage/TasksPanel';

describe('TasksPanel Component', () => {
  // --- Mocks Setup ---
  const mockSetShowTaskFilter = vi.fn();
  const mockSetFilterMember = vi.fn();
  const mockSetFilterStatus = vi.fn();
  const mockSetShowAddTaskDialog = vi.fn();
  const mockSetTaskTitle = vi.fn();
  const mockSetTaskDescription = vi.fn();
  const mockSetTaskAssignee = vi.fn();
  const mockSetTaskDueDate = vi.fn();
  const mockHandleAddTaskSubmit = vi.fn();
  const mockSetTaskError = vi.fn();
  const mockSetTaskAssigned = vi.fn();
  const mockSetTaskStatus = vi.fn();
  const mockGetTaskKey = vi.fn((task, idx) => task.id || `task-${idx}`);

  // Default Props
  const defaultProps = {
    tasksToShow: [],
    getTaskKey: mockGetTaskKey,
    activeTimer: null,
    showTaskFilter: false,
    setShowTaskFilter: mockSetShowTaskFilter,
    filterMember: '',
    setFilterMember: mockSetFilterMember,
    filterStatus: '',
    setFilterStatus: mockSetFilterStatus,
    cleanedEmployees: ['Alice', 'Bob'],
    setShowAddTaskDialog: mockSetShowAddTaskDialog,
    showAddTaskDialog: false,
    taskTitle: '',
    setTaskTitle: mockSetTaskTitle,
    taskDescription: '',
    setTaskDescription: mockSetTaskDescription,
    taskAssignee: '',
    setTaskAssignee: mockSetTaskAssignee,
    taskDueDate: '',
    setTaskDueDate: mockSetTaskDueDate,
    taskError: '',
    taskLoading: false,
    handleAddTaskSubmit: mockHandleAddTaskSubmit,
    setTaskError: mockSetTaskError,
    setTaskAssigned: mockSetTaskAssigned,
    setTaskStatus: mockSetTaskStatus,
    currentUser: { _id: 'u1', role: 'employee', username: 'user1' },
    isCreator: false,
    projectId: 'p1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 1. Rendering Basics ---

  it('renders "No active tasks found" when list is empty', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} tasksToShow={[]} />
      </MemoryRouter>
    );
    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getByText('No active tasks found')).toBeInTheDocument();
  });

  it('renders a list of tasks correctly', () => {
    const tasks = [
      { id: 't1', title: 'Fix Bug', status: 'todo', assignedTo: 'Alice' },
      { id: 't2', name: 'Design API', status: 'in-progress', assignedTo: 'Bob' },
    ];
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} tasksToShow={tasks} />
      </MemoryRouter>
    );

    expect(screen.getByText('Fix Bug')).toBeInTheDocument();
    expect(screen.getByText('Design API')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  // --- 2. Permission Checks (Add Task Button) ---

  it('shows Add Task button for Creator', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} isCreator={true} />
      </MemoryRouter>
    );
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('shows Add Task button for Manager role', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} currentUser={{ role: 'manager' }} />
      </MemoryRouter>
    );
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('shows Add Task button if isManager flag is true', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} currentUser={{ isManager: true }} />
      </MemoryRouter>
    );
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('hides Add Task button for regular employees', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} isCreator={false} currentUser={{ role: 'employee', isManager: false }} />
      </MemoryRouter>
    );
    expect(screen.queryByText('Add Task')).not.toBeInTheDocument();
  });

  // --- 3. Filter Panel Logic ---

  it('toggles filter panel visibility', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} showTaskFilter={false} />
      </MemoryRouter>
    );

    // Using closest button to avoid icon/text issues, but getByText usually works fine
    const filterBtn = screen.getByRole('button', { name: /Filter/i });
    fireEvent.click(filterBtn);
    
    expect(mockSetShowTaskFilter).toHaveBeenCalled();
  });

  it('renders filter options when visible and handles clearing', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} showTaskFilter={true} />
      </MemoryRouter>
    );

    // Check dropdowns using Label Text (Robust Selector)
    const memberSelect = screen.getByLabelText(/Member/i);
    const statusSelect = screen.getByLabelText(/Status/i);

    expect(memberSelect).toBeInTheDocument();
    expect(statusSelect).toBeInTheDocument();

    // Change member
    fireEvent.change(memberSelect, { target: { value: 'Alice' } });
    expect(mockSetFilterMember).toHaveBeenCalledWith('Alice');

    // Change status
    fireEvent.change(statusSelect, { target: { value: 'todo' } });
    expect(mockSetFilterStatus).toHaveBeenCalledWith('todo');

    // Click Clear
    fireEvent.click(screen.getByText('Clear'));
    expect(mockSetFilterMember).toHaveBeenCalledWith('');
    expect(mockSetFilterStatus).toHaveBeenCalledWith('');
    expect(mockSetShowTaskFilter).toHaveBeenCalledWith(false);
  });

  it('handles Apply filter button', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} showTaskFilter={true} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Apply'));
    expect(mockSetShowTaskFilter).toHaveBeenCalledWith(false);
  });

  // --- 4. Add Task Dialog Logic ---

  it('opens dialog and handles input changes', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} showAddTaskDialog={true} />
      </MemoryRouter>
    );

    expect(screen.getByText('Add New Task')).toBeInTheDocument();

    // Title Input
    const titleInput = screen.getByPlaceholderText('Task title');
    fireEvent.change(titleInput, { target: { value: 'New Task' } });
    expect(mockSetTaskTitle).toHaveBeenCalledWith('New Task');

    // Description Input
    const descInput = screen.getByPlaceholderText('Description (optional)');
    fireEvent.change(descInput, { target: { value: 'Details' } });
    expect(mockSetTaskDescription).toHaveBeenCalledWith('Details');

    // Assignee Select - Using Label Text
    const assigneeSelect = screen.getByLabelText(/Assign to member/i);
    fireEvent.change(assigneeSelect, { target: { value: 'Alice' } });
    expect(mockSetTaskAssignee).toHaveBeenCalledWith('Alice');

    // Due Date
    const dateInput = screen.getByLabelText(/Due date/i);
    fireEvent.change(dateInput, { target: { value: '2023-12-31' } });
    expect(mockSetTaskDueDate).toHaveBeenCalledWith('2023-12-31');
  });

  it('handles "No members" case in Add Dialog select', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} showAddTaskDialog={true} cleanedEmployees={[]} />
      </MemoryRouter>
    );
    expect(screen.getByText('No members')).toBeInTheDocument();
  });

  it('submits the new task', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} showAddTaskDialog={true} />
      </MemoryRouter>
    );
    // Be specific about which button
    const addButton = screen.getByRole('button', { name: 'Add Task' });
    fireEvent.click(addButton);
    expect(mockHandleAddTaskSubmit).toHaveBeenCalled();
  });

  it('displays loading state and error messages in dialog', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} showAddTaskDialog={true} taskLoading={true} taskError="Invalid Title" />
      </MemoryRouter>
    );
    expect(screen.getByText('Adding...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
    expect(screen.getByText('Invalid Title')).toBeInTheDocument();
  });

  // --- 5. Handle Cancel / Reset Logic ---

  it('resets all fields when Cancel is clicked', () => {
    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} showAddTaskDialog={true} />
      </MemoryRouter>
    );
    
    // Explicitly find the Cancel button by text. 
    // This is safer than finding by index/role since there are multiple buttons.
    fireEvent.click(screen.getByText('Cancel'));

    expect(mockSetShowAddTaskDialog).toHaveBeenCalledWith(false);
    expect(mockSetTaskTitle).toHaveBeenCalledWith('');
    expect(mockSetTaskAssignee).toHaveBeenCalledWith('');
    expect(mockSetTaskAssigned).toHaveBeenCalledWith('');
    expect(mockSetTaskStatus).toHaveBeenCalledWith('todo');
    expect(mockSetTaskError).toHaveBeenCalledWith('');
    expect(mockSetTaskDescription).toHaveBeenCalledWith('');
    expect(mockSetTaskDueDate).toHaveBeenCalledWith('');
  });

  it('handles Cancel safely when optional setters are missing', () => {
    // We intentionally omit optional setters to test the `if (setFunc)` checks
    const minimalProps = {
      ...defaultProps,
      setTaskAssignee: undefined,
      setTaskAssigned: undefined,
      setTaskStatus: undefined,
      setTaskDescription: undefined,
      setTaskDueDate: undefined,
      showAddTaskDialog: true,
    };

    render(
      <MemoryRouter>
        <TasksPanel {...minimalProps} />
      </MemoryRouter>
    );

    // FIXED: Instead of relying on getAllByRole('button')[0] (which picks the Filter button),
    // we use getByText('Cancel') which is guaranteed to be the button inside the dialog that triggers handleCancel.
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    // Should call the mandatory ones
    expect(mockSetShowAddTaskDialog).toHaveBeenCalledWith(false);
    expect(mockSetTaskTitle).toHaveBeenCalledWith('');
    
    // Should NOT crash due to missing optional setters
  });

  // --- 6. Task Row Logic (Assignee Resolution & Status) ---

  it('resolves assignee names correctly from various object structures', () => {
    const tasks = [
      { id: '1', title: 'Task1', assignedTo: { username: 'User1' } },
      { id: '2', title: 'Task2', assignee: { name: 'User2' } },
      { id: '3', title: 'Task3', assigneeName: { _id: 'User3' } },
      { id: '4', title: 'Task4', assignedTo: 'UserString' },
      { id: '5', title: 'Task5' },
    ];

    render(
      <MemoryRouter>
        <TasksPanel {...defaultProps} tasksToShow={tasks} />
      </MemoryRouter>
    );

    expect(screen.getByText('User1')).toBeInTheDocument();
    expect(screen.getByText('User2')).toBeInTheDocument();
    expect(screen.getByText('User3')).toBeInTheDocument();
    expect(screen.getByText('UserString')).toBeInTheDocument();
    // For null assignee, it usually renders '-'
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('calculates display status correctly (In Progress logic)', () => {
    const tasks = [
      { id: 't1', title: 'Standard Todo', status: 'todo', timeSpent: 0 },
      { id: 't2', title: 'With Time', status: 'todo', timeSpent: 5 },
      { id: 't3', title: 'Active Timer', status: 'todo', timeSpent: 0 },
      { id: 't4', title: 'Done Task', status: 'done', timeSpent: 100 },
    ];

    render(
      <MemoryRouter>
        <TasksPanel 
          {...defaultProps} 
          tasksToShow={tasks} 
          activeTimer={{ taskId: 't3' }} 
        />
      </MemoryRouter>
    );

    const rows = screen.getAllByRole('row');
    // Row 0 is header.
    // t2 (Row 2) should be 'in-progress' due to timeSpent
    expect(rows[2]).toHaveTextContent('in-progress');
    
    // t3 (Row 3) should be 'in-progress' due to activeTimer
    expect(rows[3]).toHaveTextContent('in-progress');

    // t4 (Row 4) should be 'done'
    expect(rows[4]).toHaveTextContent('done');
  });

  // --- 7. Task Row Permissions ---

  it('renders Link for allowed users and Span for others', () => {
    const tasks = [
      { id: 't1', title: 'My Task', assignedTo: 'myself' },
      { id: 't2', title: 'Other Task', assignedTo: 'other' },
    ];
    
    const user = { username: 'myself', role: 'employee' };

    render(
      <MemoryRouter>
        <TasksPanel 
          {...defaultProps} 
          tasksToShow={tasks} 
          currentUser={user} 
          isCreator={false} 
        />
      </MemoryRouter>
    );

    // 'My Task' Link
    const link = screen.getByRole('link', { name: 'My Task' });
    expect(link).toHaveAttribute('href', '/projects/p1/tasks/t1');

    // 'Other Task' Span
    expect(screen.queryByRole('link', { name: 'Other Task' })).not.toBeInTheDocument();
    const span = screen.getByText('Other Task');
    expect(span).toHaveClass('cursor-not-allowed');
  });

  it('renders Link for Manager even if not assigned', () => {
    const tasks = [{ id: 't1', title: 'Someone Elses Task', assignedTo: 'other' }];
    
    render(
      <MemoryRouter>
        <TasksPanel 
          {...defaultProps} 
          tasksToShow={tasks} 
          currentUser={{ role: 'manager' }} 
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Someone Elses Task' })).toBeInTheDocument();
  });
});