import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectPage from '../pages/ProjectPage';

// --- MOCKS ---

// 1. Mock Child Components
vi.mock('../pages/ProjectPage/TasksPanel.jsx', () => ({
  default: (props) => (
    <div data-testid="tasks-panel">
      <button onClick={() => props.setShowAddTaskDialog(true)}>Open Add Task Mock</button>
      
      {/* Mock Inputs to control Parent State */}
      <input 
        data-testid="mock-task-title"
        value={props.taskTitle}
        onChange={(e) => props.setTaskTitle(e.target.value)}
      />
      
      <input 
        data-testid="mock-task-assignee"
        value={props.taskAssignee}
        onChange={(e) => props.setTaskAssignee(e.target.value)}
      />

      <button onClick={props.handleAddTaskSubmit}>Submit Task Mock</button>
      
      {/* Display Props for assertions */}
      {props.taskError && <div data-testid="task-error">{props.taskError}</div>}
    </div>
  ),
}));

vi.mock('../pages/ProjectPage/TimeLogsPanel.jsx', () => ({
  default: () => <div data-testid="timelogs-panel">TimeLogs</div>,
}));

// 2. API & Fetcher
vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));
vi.mock('../config/fetcher', () => ({ default: () => ({ Authorization: 'Bearer test-token' }) }));

// 3. Router Mock
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// 4. Icons
vi.mock('react-icons/ri', () => ({
  RiArrowLeftLine: () => <span>ArrowLeft</span>,
  RiUserAddLine: () => <span>IconAddMember</span>,
  RiCloseLine: () => <span>Close</span>,
  RiSearchLine: () => <span>Search</span>,
  RiDeleteBinLine: () => <span>Delete</span>,
}));

// --- CONSTANTS ---
const MOCK_USER = { _id: 'u1', username: 'manager_mike', email: 'mike@test.com', role: 'manager' };
const MOCK_PROJECT = { 
  _id: 'p1', 
  name: 'Alpha Project', 
  description: 'Test Desc', 
  members: [{ _id: 'u1', username: 'manager_mike' }], 
  tasks: [
    { _id: 't1', title: 'Existing Task', status: 'todo', assignedTo: 'manager_mike' }
  ],
  createdBy: MOCK_USER 
};

describe('ProjectPage Component', () => {
  
  const renderComponent = (projectId = 'p1') => {
    return render(
      <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); 
    
    global.TimeTracker = {
      start: vi.fn(),
      stop: vi.fn(),
      sendData: vi.fn(),
      setAuthToken: vi.fn(),
    };

    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.confirm = vi.fn(() => true);

    const storage = {
      'hg_projects': JSON.stringify([MOCK_PROJECT]),
      'user': JSON.stringify(MOCK_USER),
      'token': 'fake-token'
    };
    Storage.prototype.getItem = vi.fn((k) => storage[k] || null);
    Storage.prototype.setItem = vi.fn((k, v) => { storage[k] = v; });
    Storage.prototype.removeItem = vi.fn();

    global.fetch = vi.fn((url, options) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_USER }) });
      }
      if (url.includes('/api/projects/') && (!options || !options.method || options.method === 'GET')) {
        if (url.endsWith('/bad-id')) return Promise.resolve({ ok: false, status: 404 });
        return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      }
      if (url.includes('/tasks') && options.method === 'POST') {
        const body = JSON.parse(options.body);
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ 
            ...MOCK_PROJECT, 
            tasks: [...MOCK_PROJECT.tasks, { ...body, _id: 't-new' }] 
          }) 
        });
      }
      if (url.includes('/members') && options.method === 'POST') {
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ 
            ...MOCK_PROJECT, 
            members: [...MOCK_PROJECT.members, { _id: 'u-new', username: 'new_user' }] 
          }) 
        });
      }
      if (url.includes('/members/') && options.method === 'DELETE') {
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ ...MOCK_PROJECT, members: [] }) 
        });
      }
      if (url.includes('/api/user/search')) {
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ users: [{ _id: 'u99', username: 'searched_user', email: 's@test.com' }] }) 
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- TESTS ---

  it('renders project details and loads initial data', async () => {
    renderComponent('p1');
    await waitFor(() => expect(screen.getByText('Alpha Project')).toBeInTheDocument());
    expect(screen.getByText('Test Desc')).toBeInTheDocument();
    expect(screen.getByTestId('tasks-panel')).toBeInTheDocument();
  });

  it('handles Auth failure redirect', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: false }) });
      return Promise.resolve({ ok: true });
    });

    renderComponent('p1');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('navigates back on button click', async () => {
    renderComponent('p1');
    await waitFor(() => screen.getByText('Alpha Project'));
    
    fireEvent.click(screen.getByText('Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('allows adding a task (Manager/Creator)', async () => {
    renderComponent('p1');
    await waitFor(() => screen.getByText('Alpha Project'));

    const openBtn = screen.getByText('Open Add Task Mock');
    fireEvent.click(openBtn);

    // Set Title
    const titleInput = screen.getByTestId('mock-task-title');
    fireEvent.change(titleInput, { target: { value: 'Brand New Task' } });

    const assigneeInput = screen.getByTestId('mock-task-assignee');
    fireEvent.change(assigneeInput, { target: { value: 'manager_mike' } });

    const submitBtn = screen.getByText('Submit Task Mock');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('prevents duplicate task titles', async () => {
    renderComponent('p1');
    await waitFor(() => screen.getByText('Alpha Project'));

    fireEvent.click(screen.getByText('Open Add Task Mock'));
    
    const titleInput = screen.getByTestId('mock-task-title');
    fireEvent.change(titleInput, { target: { value: 'Existing Task' } });
    
    const submitBtn = screen.getByText('Submit Task Mock');
    fireEvent.click(submitBtn);
    
    await waitFor(() => {
      expect(screen.getByTestId('task-error')).toHaveTextContent('A task with this name already exists');
    });
  });

  it('handles Add Member flow', async () => {
    renderComponent('p1');
    await waitFor(() => screen.getByText('Alpha Project'));

    const addMemberBtn = screen.getByText('IconAddMember').closest('button');
    fireEvent.click(addMemberBtn);

    expect(screen.getByText('Add Member', { selector: 'h3' })).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search by email');
    fireEvent.change(searchInput, { target: { value: 'searched' } });
    
    await new Promise(r => setTimeout(r, 350)); 

    await waitFor(() => {
      expect(screen.getByText('searched_user')).toBeInTheDocument();
    });

    const userRow = screen.getByText('searched_user').closest('tr');
    const addBtn = within(userRow).getByText('Add');
    
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/members'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('handles Remove Member', async () => {
    renderComponent('p1');
    await waitFor(() => screen.getByText('Alpha Project'));

    const deleteBtn = screen.getByTitle('Remove member');
    fireEvent.click(deleteBtn);

    expect(global.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/members/manager_mike'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('handles Active Timer logic (Pause)', async () => {
    const activeTimer = { taskId: 't1', startedAt: Date.now() - 1000, startedBy: 'manager_mike' };
    window.sessionStorage.setItem('hg_activeTimer', JSON.stringify(activeTimer));

    renderComponent('p1');
    await waitFor(() => screen.getByText(/Active Timer:/));

    expect(screen.getByText(/00:01/)).toBeInTheDocument(); 

    fireEvent.click(screen.getByText('Pause'));

    await waitFor(() => {
      expect(global.TimeTracker.stop).toHaveBeenCalled();
      expect(screen.queryByText(/Active Timer:/)).not.toBeInTheDocument();
    });
  });

  it('renders AI Summary button and navigates', async () => {
    renderComponent('p1');
    await waitFor(() => screen.getByText('Alpha Project'));

    const reportBtn = screen.getByText('Report');
    fireEvent.click(reportBtn);

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/ai-summary/p1/'));
  });

  it('handles project not found', async () => {
    renderComponent('bad-id');
    
    await waitFor(() => {
        expect(screen.getByText('Project not found')).toBeInTheDocument();
    });
  });
});