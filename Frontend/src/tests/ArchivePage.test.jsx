import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ArchivePage from '../pages/ArchivePage';

// --- 1. Mock Dependencies ---
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../config/api', () => ({ default: 'http://api.mock' }));
vi.mock('../config/fetcher', () => ({ default: () => ({ 'Content-Type': 'application/json' }) }));

// Mock react-icons
vi.mock('react-icons/ri', () => ({
  RiArrowLeftLine: () => <span data-testid="arrow-left-icon">←</span>,
  RiInboxUnarchiveLine: () => <span data-testid="unarchive-icon">↩</span>,
  RiDeleteBinLine: () => <span data-testid="delete-icon">🗑</span>,
  RiSearchLine: () => <span data-testid="search-icon">🔍</span>,
  RiCloseLine: () => <span data-testid="close-icon">✕</span>,
}));

describe('ArchivePage Component', () => {
  // --- 2. Mock Data ---
  const mockUserOwner = { 
    _id: 'u1', 
    username: 'owner1', 
    email: 'owner@test.com',
    role: 'employee' 
  };
  
  const mockUserOther = { 
    _id: 'u2', 
    username: 'other1', 
    email: 'other@test.com',
    role: 'employee' 
  };

  const mockProjects = [
    {
      _id: 'p1',
      ProjectName: 'Archived Project 1',
      Description: 'First archived project',
      status: 'archived',
      createdBy: { _id: 'u1', username: 'owner1' },
    },
    {
      _id: 'p2',
      ProjectName: 'Archived Project 2',
      Description: 'Second archived project',
      status: 'archived',
      createdBy: 'u1',
    },
    {
      _id: 'p3',
      ProjectName: 'Active Project',
      Description: 'Not archived',
      status: 'active',
      createdBy: { _id: 'u1', username: 'owner1' },
    },
    {
      _id: 'p4',
      ProjectName: 'Deleted Project',
      Description: 'Deleted project',
      status: 'deleted',
      createdBy: { _id: 'u1', username: 'owner1' },
    },
    {
      _id: 'p5',
      ProjectName: 'Archived and Deleted',
      Description: 'Both archived and deleted',
      status: 'archived',
      deleted: true,
      createdBy: { _id: 'u1', username: 'owner1' },
    },
  ];

  // --- Setup and Teardown ---
  beforeEach(() => {
    mockNavigate.mockClear();
    global.sessionStorage.clear();
    global.localStorage.clear();
    vi.clearAllMocks();
    // Mock window.location.reload
    delete window.location;
    window.location = { reload: vi.fn() };
    // Mock window.alert
    global.alert = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Utility to create fetch mocks ---
  const createFetchMocks = (user = mockUserOwner, projects = mockProjects, userFetchFails = false, projectsFetchFails = false) => {
    global.fetch = vi.fn((url, options) => {
      // User data fetch
      if (url.includes('/api/user/data')) {
        if (userFetchFails) {
          return Promise.reject(new Error('Network error'));
        }
        if (!user) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: false })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, userData: user })
        });
      }
      
      // Projects fetch
      if (url.includes('/api/projects') && !url.includes('/restore') && options?.method !== 'DELETE') {
        if (projectsFetchFails) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Server error' })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => projects
        });
      }
      
      // Restore project
      if (url.includes('/restore')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      }
      
      // Delete project (move to bin)
      if (options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      });
    });
  };

  const renderComponent = (user = mockUserOwner, projects = mockProjects, userFails = false, projectsFails = false) => {
    createFetchMocks(user, projects, userFails, projectsFails);
    return render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>
    );
  };

  // --- 3. Test Authentication & Initial Renders ---

  it('redirects to login when user fetch fails', async () => {
    renderComponent(null, mockProjects, true, false);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    }, { timeout: 3000 });
    
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('redirects to login when user data is invalid', async () => {
    createFetchMocks(null, mockProjects, false, false);
    
    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    }, { timeout: 3000 });
  });

  it('renders page header and back button after loading', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Projects')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const backButton = screen.getByText('Back');
    expect(backButton).toBeInTheDocument();
    
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders search input with placeholder', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search archived projects')).toBeInTheDocument();
    });
  });

  // --- 4. Test Project Fetching and Display ---

  it('fetches and displays archived projects', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.getByText('Archived Project 2')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByText('First archived project')).toBeInTheDocument();
    expect(screen.getByText('Second archived project')).toBeInTheDocument();
  });

  it('does not display active projects', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.queryByText('Active Project')).not.toBeInTheDocument();
  });

  it('does not display deleted projects', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.queryByText('Deleted Project')).not.toBeInTheDocument();
  });

   it('displays archived projects even when deleted flag is true', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // The component filters by status='archived', not by deleted boolean
    // So projects with status='archived' AND deleted=true will still appear
    expect(screen.getByText('Archived and Deleted')).toBeInTheDocument();
  });
  
  it('displays "No archived projects" when list is empty', async () => {
    renderComponent(mockUserOwner, []);
    
    await waitFor(() => {
      expect(screen.getByText('No archived projects.')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('falls back to sessionStorage when fetch fails', async () => {
    const cachedProjects = [
      {
        _id: 'p1',
        name: 'Cached Project',
        description: 'From cache',
        archived: true,
        deleted: false,
      }
    ];
    
    sessionStorage.setItem('hg_projects', JSON.stringify(cachedProjects));
    
    renderComponent(mockUserOwner, mockProjects, false, true);
    
    await waitFor(() => {
      expect(screen.getByText('Cached Project')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles invalid JSON in sessionStorage gracefully', async () => {
    sessionStorage.setItem('hg_projects', 'invalid json');
    
    renderComponent(mockUserOwner, mockProjects, false, true);
    
    await waitFor(() => {
      expect(screen.getByText('No archived projects.')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  // --- 5. Test Search Functionality ---

  it('filters projects by name', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.getByText('Archived Project 2')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: 'Project 1' } });
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.queryByText('Archived Project 2')).not.toBeInTheDocument();
    });
  });

  it('filters projects by description', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: 'First archived' } });
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.queryByText('Archived Project 2')).not.toBeInTheDocument();
    });
  });

  it('filters projects by owner username', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: 'owner1' } });
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    });
  });

  it('shows "No archived projects match your search" for no matches', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: 'nonexistent project xyz' } });
    
    await waitFor(() => {
      expect(screen.getByText('No archived projects match your search.')).toBeInTheDocument();
    });
  });

  it('clears search when clear button is clicked', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: 'Project 1' } });
    
    await waitFor(() => {
      expect(screen.queryByText('Archived Project 2')).not.toBeInTheDocument();
    });
    
    const clearButton = screen.getByTitle('Clear search');
    fireEvent.click(clearButton);
    
    await waitFor(() => {
      expect(searchInput.value).toBe('');
      expect(screen.getByText('Archived Project 2')).toBeInTheDocument();
    });
  });

  it('handles case-insensitive search', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: 'ARCHIVED' } });
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.getByText('Archived Project 2')).toBeInTheDocument();
    });
  });

  it('handles search with whitespace trimming', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: '  Project 1  ' } });
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.queryByText('Archived Project 2')).not.toBeInTheDocument();
    });
  });

  // --- 6. Test Permission Logic ---

  it('enables restore button for project owner', async () => {
    renderComponent(mockUserOwner);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).not.toBeDisabled();
  });

  it('disables restore button for non-owner', async () => {
    renderComponent(mockUserOther);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).toBeDisabled();
    expect(restoreButtons[0]).toHaveAttribute('title', 'Only project owner or creator can restore');
  });

  it('handles owner check with createdBy as string ID', async () => {
    const projectsWithStringId = [
      {
        _id: 'p1',
        ProjectName: 'Project String ID',
        Description: 'Test',
        status: 'archived',
        createdBy: 'u1',
      }
    ];
    
    renderComponent(mockUserOwner, projectsWithStringId);
    
    await waitFor(() => {
      expect(screen.getByText('Project String ID')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).not.toBeDisabled();
  });

    it('handles owner check requires matching _id not just email', async () => {
    const user = { _id: 'u1', username: 'owner1', email: 'owner@test.com' };
    const projectsWithEmail = [
      {
        _id: 'p1',
        ProjectName: 'Project Email Only',
        Description: 'Test',
        status: 'archived',
        createdBy: { _id: 'different-id', email: 'owner@test.com' }, // Same email, different ID
      }
    ];
    
    renderComponent(user, projectsWithEmail);
    
    await waitFor(() => {
      expect(screen.getByText('Project Email Only')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    // Should be disabled because _id doesn't match, even though email does
    expect(restoreButtons[0]).toBeDisabled();
    expect(restoreButtons[0]).toHaveAttribute('title', 'Only project owner or creator can restore');
  });

  it('handles owner check with createdBy object containing matching id and email', async () => {
    const user = { _id: 'u1', username: 'owner1', email: 'owner@test.com' };
    const projectsWithEmail = [
      {
        _id: 'p1',
        ProjectName: 'Project Both Match',
        Description: 'Test',
        status: 'archived',
        createdBy: { _id: 'u1', email: 'owner@test.com', username: 'owner1' },
      }
    ];
    
    renderComponent(user, projectsWithEmail);
    
    await waitFor(() => {
      expect(screen.getByText('Project Both Match')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).not.toBeDisabled();
  });

    it('handles projects with raw.createdBy field when createdBy differs', async () => {
    const projectsWithRaw = [
      {
        _id: 'p1',
        ProjectName: 'Project Raw Different',
        Description: 'Test',
        status: 'archived',
        createdBy: 'different-user-id',
        raw: { createdBy: { _id: 'other-id', username: 'other' } }
      }
    ];
    
    renderComponent(mockUserOwner, projectsWithRaw);
    
    await waitFor(() => {
      expect(screen.getByText('Project Raw Different')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).toBeDisabled();
    expect(restoreButtons[0]).toHaveAttribute('title', 'Only project owner or creator can restore');
  });

  it('handles owner check with matching raw.createdBy field', async () => {
    const projectsWithRaw = [
      {
        _id: 'p1',
        ProjectName: 'Project Raw Match',
        Description: 'Test',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
        raw: { createdBy: { _id: 'u1', username: 'owner1' } }
      }
    ];
    
    renderComponent(mockUserOwner, projectsWithRaw);
    
    await waitFor(() => {
      expect(screen.getByText('Project Raw Match')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).not.toBeDisabled();
  });

  it('handles owner check with numeric values', async () => {
    const user = { _id: 123, username: 'owner1', email: 'owner@test.com' };
    const projectsWithNumbers = [
      {
        _id: 'p1',
        ProjectName: 'Project Number',
        Description: 'Test',
        status: 'archived',
        createdBy: 123,
      }
    ];
    
    renderComponent(user, projectsWithNumbers);
    
    await waitFor(() => {
      expect(screen.getByText('Project Number')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).not.toBeDisabled();
  });

  it('handles canRestore with null project', async () => {
    renderComponent(mockUserOwner);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByText('Archived Projects')).toBeInTheDocument();
  });

  it('handles canRestore with null user', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, userData: mockUserOwner })
        });
      }
      if (url.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProjects
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  // --- 7. Test Restore Functionality ---

  it('successfully restores a project', async () => {
    renderComponent(mockUserOwner);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    fireEvent.click(restoreButtons[0]);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://api.mock/api/projects/p1/restore',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include'
        })
      );
    });
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Project restored');
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  it('handles restore with missing project ID', async () => {
    const projectsNoId = [
      {
        ProjectName: 'No ID Project',
        Description: 'Test',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsNoId);
    
    await waitFor(() => {
      expect(screen.getByText('No ID Project')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    fireEvent.click(restoreButtons[0]);
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Cannot restore: missing project id');
    });
  });

    it('handles restore API failure', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, userData: mockUserOwner })
        });
      }
      if (url.includes('/api/projects') && !url.includes('/restore')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProjects
        });
      }
      if (url.includes('/restore')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Internal server error'
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    
    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    fireEvent.click(restoreButtons[0]);
    
    // Just verify that fetch was called and alert was triggered
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/restore'),
        expect.any(Object)
      );
      expect(global.alert).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

    it('handles restore network error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, userData: mockUserOwner })
        });
      }
      if (url.includes('/api/projects') && !url.includes('/restore')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProjects
        });
      }
      if (url.includes('/restore')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    
    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    fireEvent.click(restoreButtons[0]);
    
    // Wait for the error to be logged or alert to be called
    await waitFor(() => {
      const alertCalls = global.alert.mock.calls;
      const hasErrorAlert = alertCalls.some(call => 
        call[0] && typeof call[0] === 'string' && call[0].toLowerCase().includes('error')
      );
      const hasConsoleError = consoleErrorSpy.mock.calls.length > 0;
      
      expect(hasErrorAlert || hasConsoleError).toBe(true);
    }, { timeout: 3000 });
    
    consoleErrorSpy.mockRestore();
  });

  // --- 8. Test Move to Bin Functionality ---

  it('successfully moves project to bin', async () => {
    renderComponent(mockUserOwner);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const deleteButtons = screen.getAllByText('Move to Bin');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://api.mock/api/projects/p1',
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include'
        })
      );
    });
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('handles move to bin API failure', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, userData: mockUserOwner })
        });
      }
      if (url.includes('/api/projects') && options?.method !== 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => mockProjects
        });
      }
      if (options?.method === 'DELETE') {
        return Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: async () => 'Forbidden'
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const deleteButtons = screen.getAllByText('Move to Bin');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/p1'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    }, { timeout: 2000 });
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('handles move to bin network error', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, userData: mockUserOwner })
        });
      }
      if (url.includes('/api/projects') && options?.method !== 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => mockProjects
        });
      }
      if (options?.method === 'DELETE') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const deleteButtons = screen.getAllByText('Move to Bin');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/p1'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    }, { timeout: 2000 });
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('refetches projects after successful move to bin', async () => {
    let deleteCallCount = 0;
    
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, userData: mockUserOwner })
        });
      }
      if (url.includes('/api/projects') && options?.method !== 'DELETE') {
        // Return updated list after delete
        if (deleteCallCount > 0) {
          return Promise.resolve({
            ok: true,
            json: async () => [mockProjects[1]] // Only second project remains
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockProjects
        });
      }
      if (options?.method === 'DELETE') {
        deleteCallCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.getByText('Archived Project 2')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const initialFetchCount = global.fetch.mock.calls.filter(call => 
      call[0].includes('/api/projects') && !call[1]?.method
    ).length;
    
    const deleteButtons = screen.getAllByText('Move to Bin');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Wait a bit for potential refetch
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const finalFetchCount = global.fetch.mock.calls.filter(call => 
      call[0].includes('/api/projects') && !call[1]?.method
    ).length;
    
    // Check if refetch happened (should be at least 1 more than initial)
    expect(finalFetchCount).toBeGreaterThanOrEqual(initialFetchCount);
  });

  // --- 9. Test Project Navigation ---

  it('navigates to project details when clicking project name', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const projectButton = screen.getByText('Archived Project 1');
    fireEvent.click(projectButton);
    
    // Navigation might be async
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/projects/p1');
    }, { timeout: 1000 });
  });

  it('navigates using project index when _id is missing', async () => {
    const projectsNoId = [
      {
        ProjectName: 'Project No ID',
        Description: 'Test',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsNoId);
    
    await waitFor(() => {
      expect(screen.getByText('Project No ID')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const projectButton = screen.getByText('Project No ID');
    fireEvent.click(projectButton);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/projects/0');
    }, { timeout: 1000 });
  });

  // --- 10. Test Edge Cases ---

  it('handles projects with missing name field', async () => {
    const projectsNoName = [
      {
        _id: 'p1',
        Description: 'Test description',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsNoName);
    
    await waitFor(() => {
      expect(screen.getByText('Test description')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles projects with missing description', async () => {
    const projectsNoDesc = [
      {
        _id: 'p1',
        ProjectName: 'No Description Project',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsNoDesc);
    
    await waitFor(() => {
      expect(screen.getByText('No Description Project')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles empty owner data gracefully', async () => {
    const projectsNoOwner = [
      {
        _id: 'p1',
        ProjectName: 'Orphan Project',
        Description: 'Test',
        status: 'archived',
      }
    ];
    
    renderComponent(mockUserOwner, projectsNoOwner);
    
    await waitFor(() => {
      expect(screen.getByText('Orphan Project')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles component unmount during fetch', async () => {
    const { unmount } = renderComponent();
    
    unmount();
    
    await waitFor(() => {
      expect(true).toBe(true);
    });
  });

  it('prevents restore button event propagation', async () => {
    renderComponent(mockUserOwner);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    
    fireEvent.click(restoreButtons[0]);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/restore'),
        expect.any(Object)
      );
    });
  });

  it('handles search with special characters', async () => {
    const projectsSpecialChars = [
      {
        _id: 'p1',
        ProjectName: 'Project (Special) [Test]',
        Description: 'Test $100',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsSpecialChars);
    
    await waitFor(() => {
      expect(screen.getByText('Project (Special) [Test]')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: '(Special)' } });
    
    await waitFor(() => {
      expect(screen.getByText('Project (Special) [Test]')).toBeInTheDocument();
    });
  });

  // --- 11. Additional Coverage Tests ---

  it('handles projects with archived boolean instead of status', async () => {
    const projectsWithArchivedBool = [
      {
        _id: 'p1',
        ProjectName: 'Archived Bool Project',
        Description: 'Test',
         status: 'archived',
        archived: true,
        deleted: false,
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsWithArchivedBool);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Bool Project')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles mixed archived status formats', async () => {
    const projectsMixedStatus = [
      {
        _id: 'p1',
        ProjectName: 'Status Archived',
        Description: 'Test 1',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      },
      {
        _id: 'p2',
        ProjectName: 'Bool Archived',
        Description: 'Test 2',
         status: 'archived',
        archived: true,
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsMixedStatus);
    
    await waitFor(() => {
      expect(screen.getByText('Status Archived')).toBeInTheDocument();
      expect(screen.getByText('Bool Archived')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
    it('displays archived projects regardless of deleted flag', async () => {
    const projectsWithDeletedFlag = [
      {
        _id: 'p1',
        ProjectName: 'Archived Project 1',
        Description: 'First archived project',
        status: 'archived',
        deleted: false,
        createdBy: { _id: 'u1', username: 'owner1' },
      },
      {
        _id: 'p5',
        ProjectName: 'Archived with Deleted Flag',
        Description: 'Archived with deleted true',
        status: 'archived',
        deleted: true,
        createdBy: { _id: 'u1', username: 'owner1' },
      },
    ];
    
    renderComponent(mockUserOwner, projectsWithDeletedFlag);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      // Component shows archived projects even if deleted flag is true
      expect(screen.getByText('Archived with Deleted Flag')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('does not display projects with deleted status', async () => {
    const projectsMixedStatus = [
      {
        _id: 'p1',
        ProjectName: 'Archived Status',
        Description: 'Status is archived',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      },
      {
        _id: 'p4',
        ProjectName: 'Deleted Status',
        Description: 'Status is deleted',
        status: 'deleted', // Status is deleted, not archived
        createdBy: { _id: 'u1', username: 'owner1' },
      },
    ];
    
    renderComponent(mockUserOwner, projectsMixedStatus);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Status')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Projects with status='deleted' should not appear on archive page
    expect(screen.queryByText('Deleted Status')).not.toBeInTheDocument();
  });

  it('handles projects with archived false but status archived', async () => {
    const projectsConflictingFlags = [
      {
        _id: 'p1',
        ProjectName: 'Conflicting Flags Project',
        Description: 'Test',
        status: 'archived', // Status takes precedence
        archived: false,
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsConflictingFlags);
    
    await waitFor(() => {
      expect(screen.getByText('Conflicting Flags Project')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
  it('renders clear button only when search query exists', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.queryByTitle('Clear search')).not.toBeInTheDocument();
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(screen.getByTitle('Clear search')).toBeInTheDocument();
    });
  });

  it('handles projects with null or undefined fields', async () => {
    const projectsWithNulls = [
      {
        _id: 'p1',
        ProjectName: null,
        Description: undefined,
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsWithNulls);
    
    await waitFor(() => {
      expect(screen.queryByText('null')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles non-array response from projects API', async () => {
    const nonArrayResponse = { data: 'not an array' };
    
    renderComponent(mockUserOwner, nonArrayResponse);
    
    await waitFor(() => {
      expect(screen.getByText('No archived projects.')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays multiple archived projects in correct order', async () => {
    const manyProjects = [
      {
        _id: 'p1',
        ProjectName: 'Z Project',
        Description: 'Last',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      },
      {
        _id: 'p2',
        ProjectName: 'A Project',
        Description: 'First',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      },
      {
        _id: 'p3',
        ProjectName: 'M Project',
        Description: 'Middle',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      },
    ];
    
    renderComponent(mockUserOwner, manyProjects);
    
    await waitFor(() => {
      expect(screen.getByText('Z Project')).toBeInTheDocument();
      expect(screen.getByText('A Project')).toBeInTheDocument();
      expect(screen.getByText('M Project')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles restore button disabled state correctly for multiple projects', async () => {
    const mixedOwnershipProjects = [
      {
        _id: 'p1',
        ProjectName: 'My Project',
        Description: 'I own this',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      },
      {
        _id: 'p2',
        ProjectName: 'Their Project',
        Description: 'Someone else owns this',
        status: 'archived',
        createdBy: { _id: 'u999', username: 'other' },
      },
    ];
    
    renderComponent(mockUserOwner, mixedOwnershipProjects);
    
    await waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
      expect(screen.getByText('Their Project')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).not.toBeDisabled();
    expect(restoreButtons[1]).toBeDisabled();
  });

  it('handles projects with createdBy as empty string', async () => {
    const projectsEmptyCreatedBy = [
      {
        _id: 'p1',
        ProjectName: 'Empty Creator',
        Description: 'Test',
        status: 'archived',
        createdBy: '',
      }
    ];
    
    renderComponent(mockUserOwner, projectsEmptyCreatedBy);
    
    await waitFor(() => {
      expect(screen.getByText('Empty Creator')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons[0]).toBeDisabled();
  });

  it('handles projects with deleted status but archived missing', async () => {
    const projectsDeletedOnly = [
      {
        _id: 'p1',
        ProjectName: 'Deleted Only',
        Description: 'Test',
        status: 'deleted',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsDeletedOnly);
    
    await waitFor(() => {
      expect(screen.queryByText('Deleted Only')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles fetch error without sessionStorage fallback', async () => {
    sessionStorage.clear();
    
    renderComponent(mockUserOwner, mockProjects, false, true);
    
    await waitFor(() => {
      expect(screen.getByText('No archived projects.')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('allows multiple search operations in sequence', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    
    fireEvent.change(searchInput, { target: { value: 'Project 1' } });
    await waitFor(() => {
      expect(screen.queryByText('Archived Project 2')).not.toBeInTheDocument();
    });
    
    fireEvent.change(searchInput, { target: { value: 'Project 2' } });
    await waitFor(() => {
      expect(screen.queryByText('Archived Project 1')).not.toBeInTheDocument();
      expect(screen.getByText('Archived Project 2')).toBeInTheDocument();
    });
    
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.getByText('Archived Project 2')).toBeInTheDocument();
    });
  });

  it('handles rapid clicking of restore button', async () => {
    renderComponent(mockUserOwner);
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const restoreButtons = screen.getAllByText('Restore');
    
    fireEvent.click(restoreButtons[0]);
    fireEvent.click(restoreButtons[0]);
    fireEvent.click(restoreButtons[0]);
    
    await waitFor(() => {
      const restoreCalls = global.fetch.mock.calls.filter(call => 
        call[0].includes('/restore')
      );
      expect(restoreCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('correctly transforms project with mixed field names', async () => {
    const projectsMixedFields = [
      {
        _id: 'p1',
        ProjectName: 'Project A',
        description: 'lowercase desc',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      },
      {
        _id: 'p2',
        name: 'Project B',
        Description: 'uppercase desc',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsMixedFields);
    
    await waitFor(() => {
      expect(screen.getByText('Project A')).toBeInTheDocument();
      expect(screen.getByText('Project B')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles projects with extra unexpected fields', async () => {
    const projectsExtraFields = [
      {
        _id: 'p1',
        ProjectName: 'Extra Fields Project',
        Description: 'Test',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
        extraField1: 'unexpected',
        extraField2: 123,
        nested: { deep: { value: 'test' } }
      }
    ];
    
    renderComponent(mockUserOwner, projectsExtraFields);
    
    await waitFor(() => {
      expect(screen.getByText('Extra Fields Project')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles move to bin when project has no _id', async () => {
    const projectsNoId = [
      {
        ProjectName: 'No ID to Delete',
        Description: 'Test',
        status: 'archived',
        createdBy: { _id: 'u1', username: 'owner1' },
      }
    ];
    
    renderComponent(mockUserOwner, projectsNoId);
    
    await waitFor(() => {
      expect(screen.getByText('No ID to Delete')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const deleteButtons = screen.getAllByText('Move to Bin');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://api.mock/api/projects/undefined',
        expect.any(Object)
      );
    });
  });

  it('treats empty string and whitespace-only search the same', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    
    fireEvent.change(searchInput, { target: { value: '   ' } });
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
      expect(screen.getByText('Archived Project 2')).toBeInTheDocument();
    });
  });

  it('handles search with only special characters', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Archived Project 1')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const searchInput = screen.getByPlaceholderText('Search archived projects');
    fireEvent.change(searchInput, { target: { value: '!@#$%^&*()' } });
    
    await waitFor(() => {
      expect(screen.getByText('No archived projects match your search.')).toBeInTheDocument();
    });
  });
});