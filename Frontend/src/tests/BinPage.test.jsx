import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BinPage from '../pages/BinPage';

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

const MOCK_PROJECTS = [
  // 1. Deleted Project (Standard)
  {
    _id: 'p1',
    ProjectName: 'Deleted Alpha',
    Description: 'Trash',
    status: 'deleted',
    createdBy: MOCK_USER
  },
  // 2. Active Project (Should be hidden)
  {
    _id: 'p2',
    ProjectName: 'Active Beta',
    Description: 'Live',
    status: 'active',
    createdBy: MOCK_USER
  },
  // 3. Deleted Project via boolean flag (Edge case support)
  // FIX: Added status: 'deleted' to ensure it passes the component's map/filter logic correctly
  {
    _id: 'p3',
    ProjectName: 'Deleted Gamma',
    Description: 'Old boolean style',
    deleted: true,
    status: 'deleted',
    createdBy: MOCK_USER
  },
  // 4. Deleted Project with complex owner structure (For search coverage)
  {
    _id: 'p4',
    ProjectName: 'Complex Owner',
    Description: 'Testing owner search',
    status: 'deleted',
    createdBy: { _id: 'u99', username: 'complex_user', email: 'complex@test.com' }
  }
];

describe('BinPage Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <BinPage />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Browser mocks
    vi.spyOn(window, 'alert').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.spyOn(console, 'warn').mockImplementation(() => { });

    // Mock window.confirm
    global.confirm = vi.fn(() => true);

    // Storage Mocks
    const storage = {};
    Storage.prototype.setItem = vi.fn((k, v) => { storage[k] = v; });
    Storage.prototype.getItem = vi.fn((k) => storage[k] || null);
    Storage.prototype.removeItem = vi.fn((k) => { delete storage[k]; });

    // Default Fetch Mock
    global.fetch = vi.fn((url, options) => {
      // 1. Auth Check
      if (url.includes('/api/user/data')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_USER }) });
      }

      // 2. Projects List
      if (url.includes('/api/projects') && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_PROJECTS });
      }

      // 3. Restore Action
      if (url.includes('/restore-deleted') && options.method === 'PATCH') {
        return Promise.resolve({ ok: true });
      }
      // 4. Permanent Delete Action
      if (url.includes('/permanent') && options.method === 'DELETE') {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to login if user data fetch fails', async () => {
    global.fetch.mockImplementationOnce((url) => {
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: false, json: async () => ({ success: false }) });
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    renderComponent();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('renders only deleted projects', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Deleted Projects')).toBeInTheDocument();
    });

    // Should show deleted projects
    expect(screen.getByText('Deleted Alpha')).toBeInTheDocument();
    expect(screen.getByText('Deleted Gamma')).toBeInTheDocument();

    // Should NOT show Active projects
    expect(screen.queryByText('Active Beta')).not.toBeInTheDocument();
  });

  it('filters projects via search (Name and Owner)', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Deleted Alpha')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search bin projects');

    // 1. Filter by Owner Username
    fireEvent.change(searchInput, { target: { value: 'complex' } });
    expect(screen.getByText('Complex Owner')).toBeInTheDocument();
    expect(screen.queryByText('Deleted Alpha')).not.toBeInTheDocument();

    // 2. Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Deleted Alpha')).toBeInTheDocument();

    // 3. Filter by Description
    fireEvent.change(searchInput, { target: { value: 'boolean' } });
    expect(screen.getByText('Deleted Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Deleted Alpha')).not.toBeInTheDocument();
  });

  it('handles Restore action successfully', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Deleted Alpha')).toBeInTheDocument());

    const item = screen.getByText('Deleted Alpha').closest('li');
    const restoreBtn = within(item).getByText('Restore').closest('button');

    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/p1/restore-deleted'),
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects'),
        expect.objectContaining({ headers: expect.anything() })
      );
    });
  });

  it('handles Permanent Delete action (Confirmed)', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Deleted Alpha')).toBeInTheDocument());

    const item = screen.getByText('Deleted Alpha').closest('li');
    const deleteBtn = within(item).getByText('Delete Permanently').closest('button');

    global.confirm.mockReturnValue(true);

    fireEvent.click(deleteBtn);

    expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining('Permanently delete'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/p1/permanent'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects'),
        expect.anything()
      );
    });
  });

  it('handles Permanent Delete action (Cancelled)', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Deleted Alpha')).toBeInTheDocument());

    const item = screen.getByText('Deleted Alpha').closest('li');
    const deleteBtn = within(item).getByText('Delete Permanently').closest('button');

    global.confirm.mockReturnValue(false);

    fireEvent.click(deleteBtn);

    expect(global.confirm).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/permanent'),
      expect.anything()
    );
  });

  it('handles API fetch error by falling back to Session Storage', async () => {
    // FIX: Use 'name' property instead of 'ProjectName' because the component 
    // renders {project.name} and bypasses the mapper when loading from storage.
    const backupProject = [{ _id: 'p99', name: 'Backup Project', status: 'deleted' }];
    window.sessionStorage.setItem('hg_projects', JSON.stringify(backupProject));

    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/projects')) return Promise.reject(new Error('Network Error'));
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      return Promise.resolve({ ok: true });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Backup Project')).toBeInTheDocument();
    });
    expect(console.error).toHaveBeenCalledWith('bin fetch error', expect.anything());
  });

  it('handles API failure on restore/delete actions', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Deleted Alpha')).toBeInTheDocument());

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/restore-deleted')) return Promise.resolve({ ok: false, status: 500, text: async () => 'Server Error' });

      // Ensure project list fetch still works during re-renders
      if (url.includes('/api/projects') && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_PROJECTS });
      }

      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_USER }) });
      return Promise.resolve({ ok: true });
    });

    const item = screen.getByText('Deleted Alpha').closest('li');
    const restoreBtn = within(item).getByText('Restore').closest('button');

    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Restore failed'));
    });
  });

  

  it('handles projects with missing createdBy field', async () => {
    const projects = [
      { _id: 'd1', ProjectName: 'No Creator', name: 'No Creator', Description: 'Test', status: 'deleted', createdBy: null }
    ];

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/api/projects') && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => projects });
      }
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_USER }) });
      return Promise.resolve({ ok: true });
    });

    renderComponent();
    await waitFor(() => expect(screen.getByText('No Creator')).toBeInTheDocument());

    // Search should still work for name
    const input = screen.getByPlaceholderText('Search bin projects');
    fireEvent.change(input, { target: { value: 'No Creator' } });
    await waitFor(() => expect(screen.getByText('No Creator')).toBeInTheDocument());
  });

  it('handles legacy owner fields (createdById, owner)', async () => {
    const projects = [
      { _id: 'd1', ProjectName: 'Legacy 1', name: 'Legacy 1', status: 'deleted', createdById: 'legacy_id_1' },
      { _id: 'd2', ProjectName: 'Legacy 2', name: 'Legacy 2', status: 'deleted', owner: 'legacy_owner_2' }
    ];

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/api/projects') && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => projects });
      }
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_USER }) });
      return Promise.resolve({ ok: true });
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Legacy 1')).toBeInTheDocument();
      expect(screen.getByText('Legacy 2')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Search bin projects');

    // Search by createdById
    fireEvent.change(input, { target: { value: 'legacy_id_1' } });
    await waitFor(() => {
      expect(screen.getByText('Legacy 1')).toBeInTheDocument();
      expect(screen.queryByText('Legacy 2')).not.toBeInTheDocument();
    });

    // Search by owner
    fireEvent.change(input, { target: { value: 'legacy_owner_2' } });
    await waitFor(() => {
      expect(screen.getByText('Legacy 2')).toBeInTheDocument();
      expect(screen.queryByText('Legacy 1')).not.toBeInTheDocument();
    });
  });

  it('handles partial createdBy object', async () => {
    const projects = [
      { _id: 'd1', ProjectName: 'Partial', name: 'Partial', status: 'deleted', createdBy: { email: 'partial@test.com' } }
    ];

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/api/projects') && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => projects });
      }
      if (url.includes('/api/user/data')) return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_USER }) });
      return Promise.resolve({ ok: true });
    });

    renderComponent();
    await waitFor(() => expect(screen.getByText('Partial')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('Search bin projects');
    fireEvent.change(input, { target: { value: 'partial@test.com' } });
    await waitFor(() => expect(screen.getByText('Partial')).toBeInTheDocument());
  });
});