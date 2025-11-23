import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ManagerDashboard from '../pages/ManagerDashboard';

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

vi.mock('../components/NavLogo', () => ({ default: () => <div data-testid="nav-logo">Logo</div> }));

vi.mock('react-icons/ri', () => ({
  RiSearchLine: () => <span>SearchIcon</span>,
  RiCloseLine: () => <span>CloseIcon</span>,
  RiAddLine: () => <span>AddIcon</span>,
  RiArchiveLine: () => <span>ArchiveIcon</span>,
  RiDeleteBinLine: () => <span>DeleteIcon</span>,
  RiArrowLeftSLine: () => <span>LeftIcon</span>,
  RiArrowRightSLine: () => <span>RightIcon</span>,
  RiLogoutBoxRLine: () => <span>LogoutIcon</span>,
  RiCheckLine: () => <span>CheckIcon</span>,
  RiBriefcaseLine: () => <span>BriefcaseIcon</span>,
  RiMenuFoldLine: () => <span>FoldIcon</span>,
  RiMenuUnfoldLine: () => <span>UnfoldIcon</span>,
}));

// --- CONSTANTS ---
const MOCK_USER = { _id: 'u1', username: 'manager_john', email: 'john@test.com', name: 'John Manager' };
const MOCK_PROJECTS = [
  { _id: 'p1', ProjectName: 'Alpha Project', Description: 'Desc A', createdBy: MOCK_USER, owner: MOCK_USER, employees: [], status: 'active' },
  { _id: 'p2', ProjectName: 'Beta Project', Description: 'Desc B', createdBy: MOCK_USER, owner: MOCK_USER, employees: [], status: 'active' }
];
const MOCK_NOTIFICATIONS = [
  { _id: 'n1', taskTitle: 'Task Due Soon', sentAt: new Date().toISOString() }
];

describe('ManagerDashboard Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ManagerDashboard />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    Storage.prototype.setItem = vi.fn();
    Storage.prototype.getItem = vi.fn((key) => {
      if (key === 'user') return JSON.stringify(MOCK_USER);
      if (key === 'token') return 'mock-token';
      return null;
    });
    Storage.prototype.removeItem = vi.fn();

    global.fetch = vi.fn((url, options) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, userData: MOCK_USER }) });
      }
      // Allow implicit GET (undefined method)
      if (url.includes('/api/projects') && (!options || !options.method || options.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_PROJECTS });
      }
      if (url.includes('/api/projects') && options && options.method === 'POST') {
        const body = JSON.parse(options.body);
        // Return new project with same owner so it appears in both lists (Sidebar + Main)
        return Promise.resolve({ ok: true, json: async () => ({ ...body, _id: 'new-p-id', createdBy: MOCK_USER }) });
      }
      if (url.includes('/api/user/search')) {
        return Promise.resolve({ ok: true, json: async () => ({ users: [{ _id: 'u2', username: 'worker_jane', email: 'jane@test.com' }] }) });
      }
      if (url.includes('/api/notifications')) {
        return Promise.resolve({ ok: true, json: async () => MOCK_NOTIFICATIONS });
      }
      if (url.includes('/archive') || (options && options.method === 'DELETE')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- TESTS ---

  it('renders dashboard structure and fetches initial data', async () => {
    renderComponent();

    expect(screen.getByText('Hour Glass')).toBeInTheDocument();
    expect(screen.getByTestId('nav-logo')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    await waitFor(() => {
      // Use getAllByText because they appear in sidebar AND main list
      expect(screen.getAllByText('Alpha Project').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Beta Project').length).toBeGreaterThan(0);
    });

    // FIX: MOCK_USER has username 'manager_john', so it renders 'M', not 'U'
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('handles URL auth_token extraction', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?auth_token=google-oauth-token', origin: 'http://localhost', pathname: '/dashboard', hash: '' },
      writable: true
    });
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    renderComponent();

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith('token', 'google-oauth-token');
      expect(replaceStateSpy).toHaveBeenCalled();
    });
  });

  it('opens and closes the Add Project modal', async () => {
    renderComponent();
    const header = screen.getByText('Dashboard').closest('header');
    const addBtn = within(header).getByText('Add Project');
    
    fireEvent.click(addBtn);
    expect(screen.getByText('Project Name')).toBeInTheDocument();
    
    fireEvent.click(screen.getByLabelText('Close add project form'));
    expect(screen.queryByText('Project Name')).not.toBeInTheDocument();
  });

  it('validates Add Project form input', async () => {
    renderComponent();
    const header = screen.getByText('Dashboard').closest('header');
    const addBtn = within(header).getByText('Add Project');
    fireEvent.click(addBtn);
    
    const submitBtn = screen.getByText('Add Project', { selector: 'button[type="submit"] span' }).closest('button');
    const nameInput = screen.getByLabelText(/Project Name/i);
    
    fireEvent.change(nameInput, { target: { value: '123Invalid' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Project name must start with a letter.')).toBeInTheDocument();
    });
  });

  it('successfully creates a project with members', async () => {
    renderComponent();
    const header = screen.getByText('Dashboard').closest('header');
    fireEvent.click(within(header).getByText('Add Project'));

    fireEvent.change(screen.getByLabelText(/Project Name/i), { target: { value: 'New Project Gamma' } });
    fireEvent.change(screen.getByLabelText(/Project Description/i), { target: { value: 'Testing create' } });
    
    const employeesInput = screen.getByLabelText(/Employees/i);
    fireEvent.change(employeesInput, { target: { value: 'jane' } });
    
    await waitFor(() => expect(screen.getByText('worker_jane')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Use'));
    
    const submitBtn = screen.getByText('Add Project', { selector: 'button[type="submit"] span' }).closest('button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Project created successfully');
      expect(screen.getAllByText('New Project Gamma').length).toBeGreaterThan(0);
    });
  });

  it('handles "Add members by search" panel toggle and usage', async () => {
    renderComponent();
    const header = screen.getByText('Dashboard').closest('header');
    fireEvent.click(within(header).getByText('Add Project'));
    
    fireEvent.click(screen.getByText('Add members by search'));

    const searchInput = screen.getByPlaceholderText('Search by email');
    fireEvent.change(searchInput, { target: { value: 'jane@test.com' } });
    fireEvent.click(screen.getByText('Search'));

    // FIX: The email appears in BOTH the suggestion list (if visible) and the table.
    // Scope specifically to the Table to be safe.
    const table = await screen.findByRole('table'); // Wait for table to appear
    expect(within(table).getByText('jane@test.com')).toBeInTheDocument();

    const addBtn = within(table).getByText('Add');
    fireEvent.click(addBtn);

    expect(screen.getByText('Selected members:')).toBeInTheDocument();
    expect(screen.getByText('worker_jane')).toBeInTheDocument();

    // Be specific about the remove button (it's in the Selected Members list, NOT the table)
    const removeBtn = screen.getByText('Remove');
    fireEvent.click(removeBtn);
    expect(screen.queryByText('worker_jane')).not.toBeInTheDocument();
  });

  it('filters project list based on search input', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getAllByText('Alpha Project').length).toBeGreaterThan(0));

    const searchInput = screen.getByPlaceholderText('Search projects');
    fireEvent.change(searchInput, { target: { value: 'Beta' } });

    expect(screen.getAllByText('Beta Project').length).toBe(2);
    expect(screen.getAllByText('Alpha Project').length).toBe(1);

    fireEvent.click(screen.getByTitle('Clear search'));
    expect(screen.getAllByText('Alpha Project').length).toBe(2);
  });

  it('handles Archive selection mode and action', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getAllByText('Alpha Project').length).toBeGreaterThan(0));

    const dashboardTitle = screen.getByText('Dashboard');
    const header = dashboardTitle.closest('header');
    const archiveModeBtn = within(header).getByText('Archive'); 
    fireEvent.click(archiveModeBtn);

    expect(screen.getByText(/item\(s\) selected for archive/i)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/archive'), expect.anything());
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Operation complete'));
    });
  });

  it('handles Notifications toggle and manual trigger', async () => {
    renderComponent();
    
    fireEvent.click(screen.getByText('Notify Deadlines'));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Notification job')));

    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => expect(screen.getByText('Task Due Soon')).toBeInTheDocument());
  });

  it('navigates on Profile menu actions', async () => {
    renderComponent();
    await waitFor(() => screen.getByLabelText('Open profile page'));

    fireEvent.click(screen.getByLabelText('Open profile page'));
    fireEvent.click(screen.getByText('Profile'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');

    fireEvent.click(screen.getByLabelText('Open profile page'));
    fireEvent.click(screen.getByText('Logout'));
    
    await waitFor(() => {
      expect(window.localStorage.removeItem).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('handles User Data fetch failure and redirects', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({ ok: false, json: async () => ({ success: false }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    renderComponent();
    await waitFor(() => {}, { timeout: 1000 });
  });
});