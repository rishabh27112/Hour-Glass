import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskPage from '../pages/Tasks/TaskPage';

// --- Mocks ---
vi.mock('../../config/api', () => ({ default: 'http://api.mock' }));
vi.mock('../../config/fetcher', () => ({ default: () => ({ 'Content-Type': 'application/json' }) }));

// Mock Navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('TaskPage Component', () => {
  const mockProjectId = 'p1';
  const mockTaskId = 't1';
  
  // Base Data Mocks
  const mockUser = { _id: 'u1', username: 'tester', role: 'employee' };
  const mockManager = { _id: 'm1', username: 'manager', role: 'manager' };
  const mockProject = { _id: 'p1', name: 'Test Project', tasks: [{ _id: 't1', title: 'Test Task', status: 'todo', assignee: 'tester' }] };
  
  // TimeTracker Mock
  const mockTimeTracker = {
    start: vi.fn(),
    stop: vi.fn(),
    sendData: vi.fn(),
    status: vi.fn().mockResolvedValue({ running: false }),
    setAuthToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window interactions
    global.window.scrollTo = vi.fn();
    global.window.alert = vi.fn();
    
    // Setup Global Fetch Mock
    global.fetch = vi.fn((url, options) => {
      // 1. User Data
      if (url.includes('/api/user/data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, userData: mockUser }),
        });
      }
      // 2. Project Data
      if (url.includes('/api/projects/p1')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProject,
        });
      }
      // 3. Time Entries (GET)
      if (url.includes('/api/time-entries/project')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ 
            isManager: false, 
            entries: [
              { 
                _id: 'e1', 
                appointments: [
                  { 
                    appname: 'VS Code', 
                    apptitle: 'Coding',
                    duration: 60, 
                    timeIntervals: [{ startTime: '2023-01-01T10:00:00Z', endTime: '2023-01-01T10:01:00Z', duration: 60 }] 
                  } 
                ]
              }
            ] 
          }),
        });
      }
      // 4. Brainstorm Entries (GET)
      if (url.includes('/api/brainstorm') && options?.method !== 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entries: [] }),
        });
      }
      // 5. Update Status (PATCH)
      if (url.includes('/status')) {
        const updatedTask = { ...mockProject.tasks[0], status: 'in-progress' };
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...mockProject, tasks: [updatedTask] }),
        });
      }
      // 6. Classification Rules (PATCH)
      if (url.includes('/api/classification-rules')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    // Setup Storage Mocks
    const storageStore = {};
    global.sessionStorage = {
      getItem: (key) => storageStore[key] || null,
      setItem: (key, val) => { storageStore[key] = val; },
      removeItem: (key) => { delete storageStore[key]; },
    };
    global.localStorage = {
      getItem: () => 'mock-token',
      setItem: () => {},
      removeItem: () => {},
    };

    global.window.TimeTracker = mockTimeTracker;
    global.TimeTracker = mockTimeTracker;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete global.window.TimeTracker;
    delete global.TimeTracker;
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={[`/task/${mockProjectId}/${mockTaskId}`]}>
        <Routes>
          <Route path="/task/:projectId/:taskId" element={<TaskPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders loading state initially then task details', async () => {
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  it('redirects to login if user fetch fails', async () => {
    global.fetch.mockImplementationOnce((url) => {
      if (url.includes('/api/user/data')) return Promise.reject('Auth failed');
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderComponent();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('handles "Project not found" or "Task not found"', async () => {
    global.fetch.mockImplementation((url) => {
        if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: mockUser }) });
        return Promise.resolve({ ok: false, status: 404 });
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Project not found')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // --- Timer Logic Tests ---

  it('starts the timer when Start is clicked (assigned user)', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Test Task'));

    const startBtn = screen.getByText('Start');
    expect(startBtn).toBeEnabled();

    fireEvent.click(startBtn);

    await waitFor(() => {
        expect(screen.getByText('Running…')).toBeInTheDocument();
    });

    expect(mockTimeTracker.start).toHaveBeenCalledWith(
        expect.any(String),
        mockProjectId,
        mockTaskId, 
        200
    );
  });

  
  // --- Manager Permissions ---

  it('disables start/stop for managers', async () => {
    global.fetch.mockImplementation((url) => {
        if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: mockManager }) });
        if (url.includes('/api/projects')) return Promise.resolve({ ok: true, json: async () => mockProject });
        return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderComponent();
    await waitFor(() => screen.getByText('Test Task'));

    const startBtn = screen.getByText('Start');
    expect(startBtn).toBeDisabled();
    expect(screen.getByText(/Managers cannot start\/stop timers/i)).toBeInTheDocument();
  });



  // --- Time Lapse / Usage Logs ---

  it('toggles time lapse view and renders entries', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Test Task'));

    const toggleBtn = screen.getByText('Show Time Lapse');
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Hide Time Lapse')).toBeInTheDocument();
    
    await waitFor(() => {
        const elements = screen.getAllByText('VS Code');
        expect(elements.length).toBeGreaterThan(0);
    });

    const vsCodeElements = screen.getAllByText('VS Code');
    fireEvent.click(vsCodeElements[0]);

    const durationElements = screen.getAllByText('00:01:00');
    expect(durationElements.length).toBeGreaterThan(0);
  });

  it('allows managers to update classification', async () => {
    global.fetch.mockImplementation((url) => {
        if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: mockManager }) });
        if (url.includes('/api/projects')) return Promise.resolve({ ok: true, json: async () => mockProject });
        if (url.includes('/api/classification-rules')) return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
        
        if (url.includes('/api/time-entries')) {
          return Promise.resolve({ 
            ok: true, 
            json: async () => ({ 
              isManager: true, 
              employeeStats: [{ 
                entries: [{ 
                  _id: 'e1', 
                  appointments: [{ 
                    appname: 'Game', 
                    apptitle: 'Game Window',
                    duration: 100,
                    timeIntervals: [{ startTime: '2023-01-01T10:00:00Z', endTime: '2023-01-01T10:01:00Z', duration: 100 }]
                  }] 
                }] 
              }] 
            }) 
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderComponent();
    await waitFor(() => screen.getByText('Test Task'));
    
    fireEvent.click(screen.getByText('Show Time Lapse'));
    
    await waitFor(() => {
        const gameElements = screen.getAllByText('Game');
        expect(gameElements.length).toBeGreaterThan(0);
    });
    
    const billableBtns = screen.getAllByTitle('Mark as Billable');
    fireEvent.click(billableBtns[0]);

    expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/classification-rules/Game'),
        expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"classification":"billable"') })
    );

    await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('is now classified as billable'));
    });
  });

  // --- AI Summary Navigation ---

  it('navigates to AI summary with correct state', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Test Task'));

    const aiBtn = screen.getByText('Open AI Summary for Assignee');
    fireEvent.click(aiBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
        `/ai-summary/${mockProjectId}/tester`,
        expect.objectContaining({ state: expect.any(Object) })
    );
  });
});