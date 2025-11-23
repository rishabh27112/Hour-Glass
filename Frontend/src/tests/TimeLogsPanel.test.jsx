import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TimeLogsPanel from '../pages/ProjectPage/TimeLogsPanel';

// Mock Configs
vi.mock('../../config/api', () => ({ default: 'http://api.mock' }));
vi.mock('../../config/fetcher', () => ({ default: () => ({ Authorization: 'Bearer token' }) }));

describe('TimeLogsPanel Component', () => {
  const mockProjectId = 'p123';
  const mockCurrentUser = { username: 'testuser' };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing (returns null) if projectId is missing', () => {
    const { container } = render(<TimeLogsPanel projectId="" />);
    expect(container.firstChild).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders loading state initially', async () => {
    // Mock fetch to never resolve immediately to hold loading state
    global.fetch.mockImplementation(() => new Promise(() => {}));
    
    render(<TimeLogsPanel projectId={mockProjectId} currentUser={mockCurrentUser} />);
    
    expect(screen.getByText('Loading time logs...')).toBeInTheDocument();
  });

  it('handles fetch error (network error)', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    
    render(<TimeLogsPanel projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load time logs')).toBeInTheDocument();
    });
  });

  it('handles fetch error (API error response)', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<TimeLogsPanel projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load time logs')).toBeInTheDocument();
    });
  });

  // --- Employee View Tests ---

  it('renders Employee View correctly with entries', async () => {
    const mockData = {
      isManager: false,
      entries: [{ id: 1, duration: 3600 }],
      summary: {
        billable: 3600,
        nonBillable: 1800,
        ambiguous: 0,
        totalTime: 5400
      }
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    render(<TimeLogsPanel projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('My Time Logs')).toBeInTheDocument();
    });

    // Check summaries (testing formatTime logic for valid numbers)
    // 3600s = 1h
    expect(screen.getByText('1h 0m 0.00s')).toBeInTheDocument(); 
    // 1800s = 0.5h = 30m
    expect(screen.getByText('0h 30m 0.00s')).toBeInTheDocument(); 
    // 5400s = 1.5h = 1h 30m
    expect(screen.getByText('1h 30m 0.00s')).toBeInTheDocument();

    // Check entries pluralization logic
    expect(screen.getByText('1 time entry recorded')).toBeInTheDocument();
  });

  it('renders Employee View with multiple entries (plural check)', async () => {
    const mockData = {
      isManager: false,
      entries: [{}, {}], // 2 entries
      summary: { billable: 0, nonBillable: 0, ambiguous: 0, totalTime: 0 }
    };
    global.fetch.mockResolvedValue({ ok: true, json: async () => mockData });

    render(<TimeLogsPanel projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('2 time entries recorded')).toBeInTheDocument();
    });
  });

  it('renders Employee View with empty entries', async () => {
    const mockData = {
      isManager: false,
      entries: [],
      summary: { billable: 0, nonBillable: 0, ambiguous: 0, totalTime: 0 }
    };
    global.fetch.mockResolvedValue({ ok: true, json: async () => mockData });

    render(<TimeLogsPanel projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('No time logs recorded yet.')).toBeInTheDocument();
    });
  });

  // --- Manager View Tests ---

  it('renders Manager View correctly and handles filtering', async () => {
    const mockData = {
      isManager: true,
      employeeStats: [
        { username: 'user1', totalTime: 3600, billable: 3600, nonBillable: 0, ambiguous: 0 },
        { username: 'user2', totalTime: 7200, billable: 0, nonBillable: 7200, ambiguous: 0 }
      ],
      summary: {
        totalBillable: 3600,
        totalNonBillable: 7200,
        totalAmbiguous: 0,
        totalTime: 10800
      }
    };

    global.fetch.mockResolvedValue({ ok: true, json: async () => mockData });

    render(<TimeLogsPanel projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('Team Time Logs')).toBeInTheDocument();
    });

    // Verify Total Summary
    expect(screen.getByText('3h 0m 0.00s')).toBeInTheDocument(); // 10800s

    // Verify List
    // FIX: Use getByRole('heading') to target the card title specifically. 
    // getByText fails because "user1" also exists in the <select> dropdown options.
    expect(screen.getByRole('heading', { name: 'user1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'user2' })).toBeInTheDocument();

    // Interaction: Filter by user1
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'user1' } });

    // user1 card should be visible
    expect(screen.getByRole('heading', { name: 'user1' })).toBeInTheDocument();
    
    // user2 card should be gone
    // We MUST use queryByRole('heading') here. queryByText('user2') would fail 
    // because "user2" is still present in the dropdown menu.
    expect(screen.queryByRole('heading', { name: 'user2' })).not.toBeInTheDocument();

    // Interaction: Switch back to All
    fireEvent.change(select, { target: { value: 'all' } });
    expect(screen.getByRole('heading', { name: 'user2' })).toBeInTheDocument();
  });

  it('renders Manager View with empty filtered results', async () => {
    // This covers the case where filteredStats.length === 0
    const mockData = {
      isManager: true,
      employeeStats: [], // Empty stats
      summary: { totalBillable: 0, totalNonBillable: 0, totalAmbiguous: 0, totalTime: 0 }
    };
    global.fetch.mockResolvedValue({ ok: true, json: async () => mockData });

    render(<TimeLogsPanel projectId={mockProjectId} />);

    await waitFor(() => {
      expect(screen.getByText('No time logs found for selected employee.')).toBeInTheDocument();
    });
  });

  // --- Fallback & Edge Case Tests ---

  it('renders Fallback view when data structure is unrecognized', async () => {
    // Data exists but doesn't match Manager or Employee structure
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ someOtherData: true }) });
    
    render(<TimeLogsPanel projectId={mockProjectId} />);
    
    await waitFor(() => {
      expect(screen.getByText('No time logs available.')).toBeInTheDocument();
    });
  });

  it('refreshes data periodically (setInterval coverage)', async () => {
    vi.useFakeTimers();
    global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ entries: [], summary: {} })
    });

    render(<TimeLogsPanel projectId={mockProjectId} />);
    
    // 1. Initial fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // 2. Fast forward 30s
    act(() => {
        vi.advanceTimersByTime(30000);
    });

    // 3. Should have fetched again
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
  
  it('formatTime helper handles invalid/missing numbers gracefully', async () => {
      // This forces the formatTime function to handle `undefined` or `NaN`.
      // Logic being tested: const secsStr = (typeof secs === 'number' && !Number.isNaN(secs)) ? ...
      
      const mockData = {
          entries: [],
          summary: {
              billable: undefined, // undefined passed to formatTime
              nonBillable: NaN,    // NaN passed to formatTime
              ambiguous: 'bad',    // String passed (will result in NaN math)
              totalTime: 0
          }
      };
      
      global.fetch.mockResolvedValue({ ok: true, json: async () => mockData });
      render(<TimeLogsPanel projectId={mockProjectId} />);
      
      await waitFor(() => {
         // If input is bad, math results in NaN.
         // formatTime(undefined) -> "NaNh NaNm NaNs"
         // This confirms it renders without crashing.
         const nanElements = screen.getAllByText(/NaN/);
         expect(nanElements.length).toBeGreaterThan(0);
      });
  });
});