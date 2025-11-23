import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AISummaryPage from '../pages/AI_Summary/AI_Summary_Page';

// --- MOCKS ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: { billableSeconds: 3600 } }), // Mock state passed from TaskPage
    useParams: () => ({ projectId: 'p1', memberId: 'test_user' }),
  };
});

vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));
vi.mock('../config/fetcher', () => ({ default: () => ({ Authorization: 'Bearer test-token' }) }));
vi.mock('../../utils/time', () => ({
  formatSecondsHm: (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
}));


vi.mock('../pages/AI_Summary/ManagerSummaryPanel', () => ({
  default: ({ data }) => (
    <div data-testid="manager-summary-panel">
      Mock Summary Panel
      {data && <pre>{JSON.stringify(data)}</pre>}
    </div>
  ),
}));

vi.mock('react-icons/ri', () => ({
  RiArrowLeftLine: () => <span>ArrowLeft</span>,
}));

// --- CONSTANTS ---
const MOCK_MANAGER = { _id: 'u1', username: 'manager_mike', role: 'manager' };
const MOCK_EMPLOYEE = { _id: 'u2', username: 'test_user', role: 'employee' };

const MOCK_PROJECT = { 
  _id: 'p1', 
  name: 'Alpha Project', 
  createdBy: MOCK_MANAGER 
};

const MOCK_ENTRIES_MANAGER_VIEW = {
  isManager: true,
  employeeStats: [
    {
      username: 'test_user',
      entries: [
        {
          _id: 'e1',
          username: 'test_user',
          appointments: [
            {
              appname: 'VS Code',
              isBillable: true,
              timeIntervals: [{ startTime: new Date().toISOString(), duration: 7200 }] // 2h billable
            },
            {
              appname: 'Netflix',
              suggestedCategory: 'non-billable',
              timeIntervals: [{ startTime: new Date().toISOString(), duration: 1800 }] // 0.5h non-billable
            }
          ]
        }
      ]
    }
  ]
};

const MOCK_AI_SUMMARY_DATA = { summary: { reports: [] }, message: 'AI generated' };

describe('AISummaryPage Component', () => {
  
  const renderComponent = (projectId = 'p1', memberId = 'test_user') => {
    return render(
      <MemoryRouter initialEntries={[`/ai-summary/${projectId}/${memberId}`]}>
        <Routes>
          <Route path="/ai-summary/:projectId/:memberId" element={<AISummaryPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Default Fetch Mock
    global.fetch = vi.fn((url, options) => {
      // User Data
      if (url.includes('/api/user/data')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_MANAGER }) });
      }
      // Project Data
      if (url.includes('/api/projects/')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      }
      // Time Entries
      if (url.includes('/api/time-entries/project/')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_ENTRIES_MANAGER_VIEW });
      }
      // AI Summary POST
      if (url.includes('/daily-summary/manager') && options.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => MOCK_AI_SUMMARY_DATA });
      }
      // AI Summary GET
      if (url.includes('/ai-summary/manager')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_AI_SUMMARY_DATA });
      }

      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- TESTS ---

  it('renders loading state initially', async () => {
    // Delay fetch to check loading state
    global.fetch = vi.fn(() => new Promise(() => {}));
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders page content with user data', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/AI Summary for test_user/)).toBeInTheDocument();
    expect(screen.getByText('1h 0m')).toBeInTheDocument(); 
    expect(screen.getByText('From task (linked)')).toBeInTheDocument();
  });

  it('calculates and displays application usage', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('VS Code')).toBeInTheDocument();
    });

    expect(screen.getByText('2.0h')).toBeInTheDocument();
    
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText('0.5h')).toBeInTheDocument();
  });

  it('handles generating daily summary (POST)', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Generate Daily Summary'));

    const btn = screen.getByText('Generate Daily Summary');
    fireEvent.click(btn);

    expect(screen.getByText('Working... contacting server')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/daily-summary/manager'),
        expect.objectContaining({ method: 'POST' })
      );
   
      expect(screen.getByTestId('manager-summary-panel')).toBeInTheDocument();
    });
  });

  it('handles loading AI summary (GET)', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Load AI Summary'));

    const btn = screen.getByText('Load AI Summary');
    fireEvent.click(btn);

    expect(screen.getByText('Working... contacting server')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai-summary/manager'),
        expect.anything()
      );

      expect(screen.getByTestId('manager-summary-panel')).toBeInTheDocument();
    });
  });

  it('handles API errors for AI summary', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Load AI Summary'));

    // Mock error response
    global.fetch.mockImplementation((url) => {
      if (url.includes('/ai-summary/manager')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'AI Service Down' }) });
      }
      // Keep other calls working so page loads
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_MANAGER }) });
      if (url.includes('/api/projects/')) return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      if (url.includes('/api/time-entries/project/')) return Promise.resolve({ ok: true, json: async () => MOCK_ENTRIES_MANAGER_VIEW });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    fireEvent.click(screen.getByText('Load AI Summary'));

    await waitFor(() => {
      expect(screen.getByText('AI Service Down')).toBeInTheDocument();
    });
  });

  it('allows manager to edit rate per hour and calculates payment', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Rate per hour (INR)'));

    const input = screen.getByPlaceholderText('0');
    expect(input.value).toBe('0');

    fireEvent.change(input, { target: { value: '100' } });
    expect(input.value).toBe('100');

    await waitFor(() => {
      expect(screen.getByText('₹100')).toBeInTheDocument();
    });
  });

  it('prevents non-manager from editing rate', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_EMPLOYEE }) });
      if (url.includes('/api/projects/')) return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      if (url.includes('/api/time-entries/project/')) return Promise.resolve({ ok: true, json: async () => MOCK_ENTRIES_MANAGER_VIEW });
      return Promise.resolve({ ok: true });
    });

    renderComponent();
    await waitFor(() => screen.getByText('Rate per hour (INR)'));

    const input = screen.getByPlaceholderText('0');
    expect(input).toBeDisabled();
  });

  it('allows editing brainstorm hours', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Brainstorming'));

    const brainstormInput = screen.getByRole('spinbutton');
    
    fireEvent.change(brainstormInput, { target: { value: '5' } });
    expect(brainstormInput.value).toBe('5');
    
    expect(screen.getByText(/Avg\/day:/)).toBeInTheDocument();
  });

  it('handles fetch error for time entries', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/time-entries/project/')) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({ msg: 'No entries found' }) });
      }
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_MANAGER }) });
      if (url.includes('/api/projects/')) return Promise.resolve({ ok: true, json: async () => MOCK_PROJECT });
      return Promise.resolve({ ok: true });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No entries found')).toBeInTheDocument();
    });
  });

  it('navigates back', async () => {
    renderComponent();
    await waitFor(() => screen.getByText('Back')); // "Back" is now unique to the button

    fireEvent.click(screen.getByText('Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});