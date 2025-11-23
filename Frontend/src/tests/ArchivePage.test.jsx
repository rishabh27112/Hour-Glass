import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ArchivePage from '../pages/ArchivePage';

// --- MOCKS ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  };
});

vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));
vi.mock('../config/fetcher', () => ({ default: () => ({ Authorization: 'Bearer test-token' }) }));

vi.mock('react-icons/ri', () => ({
  RiArrowLeftLine: () => <span>BackIcon</span>,
  RiInboxUnarchiveLine: () => <span>UnarchiveIcon</span>,
  RiDeleteBinLine: () => <span>BinIcon</span>,
  RiSearchLine: () => <span>SearchIcon</span>,
  RiCloseLine: () => <span>CloseIcon</span>,
}));

// --- CONSTANTS ---
const MOCK_USER = { _id: 'u1', username: 'owner_alice', email: 'alice@test.com' };
const MOCK_OTHER_USER = { _id: 'u2', username: 'viewer_bob', email: 'bob@test.com' };

const MOCK_PROJECTS = [
  // 1. Archived Project (Should appear)
  { 
    _id: 'p1', 
    ProjectName: 'Old Project', 
    Description: 'Archived Stuff', 
    status: 'archived', 
    createdBy: MOCK_USER, 
    owner: MOCK_USER 
  },
  // 2. Active Project (Should NOT appear)
  { 
    _id: 'p2', 
    ProjectName: 'Active Project', 
    Description: 'Current Stuff', 
    status: 'active', 
    createdBy: MOCK_USER 
  },
  // 3. Deleted Project (Should NOT appear)
  { 
    _id: 'p3', 
    ProjectName: 'Deleted Project', 
    Description: 'Gone', 
    status: 'deleted', 
    createdBy: MOCK_USER 
  },
  // 4. Archived Project owned by someone else (Testing permissions)
  { 
    _id: 'p4', 
    ProjectName: 'Others Archive', 
    Description: 'Not mine', 
    status: 'archived', 
    createdBy: MOCK_OTHER_USER,
    owner: MOCK_OTHER_USER
  }
];

describe('ArchivePage Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ArchivePage />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Browser mocks
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock window.location.reload for Restore action
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: vi.fn() }
    });

    // Storage Mocks
    Storage.prototype.removeItem = vi.fn();
    Storage.prototype.getItem = vi.fn();

    // Default Fetch Mock (Happy Path)
    global.fetch = vi.fn((url, options) => {
      // 1. Auth Check
      if (url.includes('/api/user/data')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_USER }) });
      }
      // 2. Projects List
      if (url.includes('/api/projects') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({ ok: true, json: async () => MOCK_PROJECTS });
      }
      // 3. Restore Action
      if (url.includes('/restore') && options.method === 'PATCH') {
        return Promise.resolve({ ok: true });
      }
      // 4. Delete Action
      if (options && options.method === 'DELETE') {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to login if user data fetch fails', async () => {
    // Override fetch to fail auth
    global.fetch.mockImplementationOnce((url) => {
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: false, json: async () => ({ success: false }) });
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    renderComponent();

    await waitFor(() => {
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('renders only archived projects', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Archived Projects')).toBeInTheDocument();
    });

    // Should show 'Old Project'
    expect(screen.getByText('Old Project')).toBeInTheDocument();
    expect(screen.getByText('Archived Stuff')).toBeInTheDocument();

    // Should NOT show Active or Deleted projects
    expect(screen.queryByText('Active Project')).not.toBeInTheDocument();
    expect(screen.queryByText('Deleted Project')).not.toBeInTheDocument();
  });

  it('filters projects via search', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Old Project')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search archived projects');
    
    // Filter to show "Others Archive"
    fireEvent.change(searchInput, { target: { value: 'Others' } });
    
    expect(screen.getByText('Others Archive')).toBeInTheDocument();
    expect(screen.queryByText('Old Project')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Old Project')).toBeInTheDocument();
  });

  it('enables "Restore" button only for owners', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Old Project')).toBeInTheDocument());

    // MOCK_USER owns "Old Project", so Restore should be enabled (clickable)
    // Finding the specific Restore button for "Old Project"
    const oldProjectItem = screen.getByText('Old Project').closest('li');
    const oldRestoreBtn = within(oldProjectItem).getByText('Restore').closest('button');
    expect(oldRestoreBtn).not.toBeDisabled();

    // MOCK_USER does NOT own "Others Archive", so Restore should be disabled
    const othersProjectItem = screen.getByText('Others Archive').closest('li');
    const othersRestoreBtn = within(othersProjectItem).getByText('Restore').closest('button');
    expect(othersRestoreBtn).toBeDisabled();
  });

  it('handles Restore action successfully', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Old Project')).toBeInTheDocument());

    const oldProjectItem = screen.getByText('Old Project').closest('li');
    const restoreBtn = within(oldProjectItem).getByText('Restore').closest('button');

    fireEvent.click(restoreBtn);

    await waitFor(() => {
      // Check API call
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/p1/restore'),
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(window.alert).toHaveBeenCalledWith('Project restored');
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  it('handles Move to Bin action successfully', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Old Project')).toBeInTheDocument());

    const oldProjectItem = screen.getByText('Old Project').closest('li');
    const deleteBtn = within(oldProjectItem).getByText('Move to Bin').closest('button');

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      // 1. DELETE API call
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/p1'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(window.alert).toHaveBeenCalledWith('Moved to Bin');
      
      // 2. Refetch projects (The component calls fetch projects again after delete)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects'),
        expect.anything()
      );
    });
  });
});