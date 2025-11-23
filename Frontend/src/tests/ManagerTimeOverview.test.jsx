import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ManagerTimeOverview from '../pages/ManagerDashboard/ManagerTimeOverview';

// --- MOCKS ---

vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));
vi.mock('../config/fetcher', () => ({ default: () => ({ Authorization: 'Bearer test-token' }) }));
// Fix import path to be relative to this test file
vi.mock('../utils/time', () => ({
  formatSecondsHm: (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
}));

// --- CONSTANTS ---
const MOCK_PROJECTS = [
  { _id: 'p1', name: 'Alpha Project' },
  { _id: 'p2', name: 'Beta Project' }
];

const MOCK_OVERVIEW_DATA = {
  ok: true,
  overview: {
    summary: {
      totalBillable: 3600, // 1h
      totalNonBillable: 1800, // 30m
      totalAmbiguous: 900, // 15m
      totalTime: 6300 // 1h 45m
    },
    employees: [
      {
        username: 'Alice',
        billable: 3600,
        nonBillable: 0,
        ambiguous: 0,
        totalTime: 3600,
        projects: [
          { 
            projectId: 'p1', 
            name: 'Alpha Project', 
            billable: 3600, 
            nonBillable: 0, 
            ambiguous: 0, 
            totalTime: 3600 
          }
        ]
      },
      {
        username: 'Bob',
        billable: 0,
        nonBillable: 1800,
        ambiguous: 900,
        totalTime: 2700,
        projects: []
      }
    ]
  }
};

describe('ManagerTimeOverview Component', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = vi.fn((url) => {
      if (url.includes('/manager/overview')) {
        return Promise.resolve({ 
          ok: true, 
          json: async () => MOCK_OVERVIEW_DATA 
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}));
    render(<ManagerTimeOverview ownedProjects={MOCK_PROJECTS} />);
    expect(screen.getByText('Loading overview...')).toBeInTheDocument();
  });

  it('fetches data and renders summary cards correctly', async () => {
    render(<ManagerTimeOverview ownedProjects={MOCK_PROJECTS} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading overview...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Team Time Overview')).toBeInTheDocument();

    // Check Summary Cards
    
    // FIX: "1h 0m" appears in Summary Card AND Alice's Row. Use getAllByText.
    expect(screen.getAllByText(/1h 0m/).length).toBeGreaterThan(0); 
    
    // FIX: "0h 30m 0s" (1800s) appears in Summary Card AND Bob's Row. Use getAllByText.
    expect(screen.getAllByText('0h 30m 0s').length).toBeGreaterThan(0);
    
    // "0h 15m 0s" appears in Summary Card AND Bob's Row.
    expect(screen.getAllByText('0h 15m 0s').length).toBeGreaterThan(0);
    
    // "1h 45m 0s" is unique to Total Summary card in this mock data set (Alice=1h, Bob=45m)
    expect(screen.getByText('1h 45m 0s')).toBeInTheDocument();
  });

  it('renders employee table correctly', async () => {
    render(<ManagerTimeOverview ownedProjects={MOCK_PROJECTS} />);

    await waitFor(() => {
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
      expect(screen.getByText(/Bob/)).toBeInTheDocument();
    });

    // Check Bob's stats specifically in his row to ensure table data is correct
    const bobRow = screen.getByText(/Bob/).closest('tr');
    expect(within(bobRow).getByText('0h 0m')).toBeInTheDocument(); // Billable column
    expect(within(bobRow).getByText('0h 30m 0s')).toBeInTheDocument(); // Non-Billable column
  });

  it('handles expanding employee details', async () => {
    render(<ManagerTimeOverview ownedProjects={MOCK_PROJECTS} />);

    await waitFor(() => {
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
    });

    // FIX: Do NOT check for "Alpha Project" text here because it ALWAYS exists
    // in the "Project Filter" dropdown at the top of the page.
    // Instead, check for text that ONLY appears in the expanded card, e.g., "1h 0m Billable".
    expect(screen.queryByText(/1h 0m Billable/)).not.toBeInTheDocument();

    // Click to expand Alice
    const expandBtn = screen.getByText(/Alice/);
    fireEvent.click(expandBtn);

    // Now the detail card should be visible
    // We can check for the project name here because it's valid to be in the document
    // but checking the specific stats confirms the card rendered.
    expect(screen.getByText(/1h 0m Billable/)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(expandBtn);
    
    // Verify it disappears
    expect(screen.queryByText(/1h 0m Billable/)).not.toBeInTheDocument();
  });

  it('handles filtering by project', async () => {
    render(<ManagerTimeOverview ownedProjects={MOCK_PROJECTS} />);

    await waitFor(() => {
      expect(screen.getByText('Team Time Overview')).toBeInTheDocument();
    });

    // Initial call (no filter)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/time-entries\/manager\/overview$/),
      expect.anything()
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'p1' } });

    // Second call with query param
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('projectId=p1'),
        expect.anything()
      );
    });
  });

  it('handles API errors', async () => {
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'Server Error' }) })
    );

    render(<ManagerTimeOverview ownedProjects={MOCK_PROJECTS} />);

    await waitFor(() => {
      expect(screen.getByText('Server Error')).toBeInTheDocument();
    });
  });

  it('handles Network errors', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    render(<ManagerTimeOverview ownedProjects={MOCK_PROJECTS} />);

    await waitFor(() => {
      expect(screen.getByText('Network error while loading overview')).toBeInTheDocument();
    });
  });

  it('handles empty data / no overview available', async () => {
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({ ok: true, json: async () => ({ overview: null }) })
    );

    render(<ManagerTimeOverview ownedProjects={MOCK_PROJECTS} />);

    await waitFor(() => {
      expect(screen.getByText('No overview available.')).toBeInTheDocument();
    });
  });
});