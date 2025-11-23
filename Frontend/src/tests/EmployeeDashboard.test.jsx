import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import EmployeeDashboard from '../pages/EmployeeDashboard';

// --- MOCKS ---

vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));
vi.mock('../config/fetcher', () => ({ default: () => ({ Authorization: 'Bearer test-token' }) }));

// Mock Link to avoid Router errors outside of a router context
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ to, children }) => <a href={to}>{children}</a>,
  };
});

// --- CONSTANTS ---
const MOCK_PROJECT = { name: 'Super Project' };

const MOCK_ENTRIES_EMPLOYEE = {
  isManager: false,
  entries: [
    {
      username: 'emp1',
      appointments: [
        {
          appname: 'VS Code',
          isBillable: true,
          timeIntervals: [{ startTime: '2023-01-01T10:00:00', endTime: '2023-01-01T11:00:00', duration: 3600 }]
        },
        {
          appname: 'Slack',
          suggested: 'non-billable',
          timeIntervals: [{ startTime: '2023-01-01T11:00:00', endTime: '2023-01-01T11:30:00', duration: 1800 }]
        }
      ]
    }
  ]
};

const MOCK_ENTRIES_MANAGER = {
  isManager: true,
  employeeStats: [
    {
      username: 'target_user',
      entries: [
        {
          username: 'target_user',
          appointments: [
            {
              appname: 'Chrome',
              timeIntervals: [{ duration: 7200 }] // 2 hours ambiguous
            }
          ]
        }
      ]
    },
    {
      username: 'other_user',
      entries: []
    }
  ]
};

describe('EmployeeDashboard Component', () => {
  
  const renderWithRouter = (query = '') => {
    return render(
      <MemoryRouter initialEntries={[`/dashboard${query}`]}>
        <Routes>
          <Route path="/dashboard" element={<EmployeeDashboard />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock Storage - Default Valid User
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'user') return JSON.stringify({ username: 'current_user' });
      return null;
    });

    // Default Fetch Mock (Happy Path - Employee View)
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/projects/')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      }
      if (url.includes('/api/time-entries/')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_ENTRIES_EMPLOYEE });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders missing projectId state if no query param provided', () => {
    renderWithRouter('');
    
    expect(screen.getByText('Usage Logs')).toBeInTheDocument();
    expect(screen.getByText(/Missing/)).toBeInTheDocument();
    expect(screen.getByText('Go to Projects')).toBeInTheDocument();
  });

  it('loads data and renders Employee View correctly', async () => {
    renderWithRouter('?projectId=123');

    expect(screen.getByText('Loading…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Super Project')).toBeInTheDocument();
      
      // Check for stats
      expect(screen.getAllByText('01:00:00').length).toBeGreaterThan(0);
      expect(screen.getAllByText('00:30:00').length).toBeGreaterThan(0);
      expect(screen.getAllByText('01:30:00').length).toBeGreaterThan(0);
    });

    // FIX: Use getAllByText because apps might appear in list AND summary
    expect(screen.getAllByText(/VS Code/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Slack/).length).toBeGreaterThan(0);
  });

  it('handles Manager View filtering via URL username param', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/projects/')) return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      if (url.includes('/time-entries/')) return Promise.resolve({ ok: true, json: async () => MOCK_ENTRIES_MANAGER });
      return Promise.resolve({ ok: true });
    });

    renderWithRouter('?projectId=123&username=target_user');

    await waitFor(() => {
      expect(screen.getByText('Super Project — target_user')).toBeInTheDocument();
    });

    const timeEls = screen.getAllByText('02:00:00');
    expect(timeEls.length).toBeGreaterThan(0);
    
    // FIX: Use getAllByText for Chrome
    expect(screen.getAllByText(/Chrome/).length).toBeGreaterThan(0);
  });

  it('handles Manager View falling back to session user', async () => {
    const mockWithCurrentUser = {
      ...MOCK_ENTRIES_MANAGER,
      employeeStats: [
        ...MOCK_ENTRIES_MANAGER.employeeStats,
        {
          username: 'current_user',
          entries: [{ appointments: [{ appname: 'Self App', timeIntervals: [{ duration: 60 }] }] }]
        }
      ]
    };

    global.fetch.mockImplementation((url) => {
      if (url.includes('/projects/')) return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      if (url.includes('/time-entries/')) return Promise.resolve({ ok: true, json: async () => mockWithCurrentUser });
      return Promise.resolve({ ok: true });
    });

    renderWithRouter('?projectId=123');

    await waitFor(() => {
      const appEls = screen.getAllByText(/Self App/);
      expect(appEls.length).toBeGreaterThan(0);
      
      const timeEls = screen.getAllByText('00:01:00');
      expect(timeEls.length).toBeGreaterThan(0);
    });
  });

  it('handles empty data gracefully', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/projects/')) return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      return Promise.resolve({ ok: true, json: async () => ({ isManager: false, entries: [] }) });
    });

    renderWithRouter('?projectId=123');

    await waitFor(() => {
      expect(screen.getByText('All intervals (flattened): 0')).toBeInTheDocument();
      expect(screen.getByText('No intervals recorded')).toBeInTheDocument();
      expect(screen.getByText('No app sessions to show')).toBeInTheDocument();
    });
  });

  it('handles API errors', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/time-entries/')) {
        return Promise.resolve({ 
          ok: false, 
          json: async () => ({ msg: 'Server Error' }) 
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderWithRouter('?projectId=123');

    await waitFor(() => {
      expect(screen.getByText('Server Error')).toBeInTheDocument();
    });
  });

  it('handles Network errors (fetch throws)', async () => {
    global.fetch.mockRejectedValue(new Error('Network Down'));

    renderWithRouter('?projectId=123');

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('handles corrupted user storage gracefully', async () => {
    Storage.prototype.getItem = vi.fn(() => 'INVALID_JSON');
    
    global.fetch.mockImplementation((url) => {
      if (url.includes('/projects/')) return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      if (url.includes('/time-entries/')) return Promise.resolve({ ok: true, json: async () => MOCK_ENTRIES_MANAGER });
      return Promise.resolve({ ok: true });
    });

    renderWithRouter('?projectId=123');
    
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('parse user failed', expect.anything());
    });
  });
});