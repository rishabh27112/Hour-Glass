import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from '../pages/ProfilePage';

// --- MOCKS ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));
vi.mock('../config/fetcher', () => ({ default: () => ({ Authorization: 'Bearer test-token' }) }));

vi.mock('react-icons/ri', () => ({
  RiArrowLeftLine: () => <span data-testid="icon-back">BackIcon</span>,
}));

// --- CONSTANTS ---
const MOCK_USER = { 
  name: 'John Doe', 
  username: 'jdoe', 
  email: 'john@example.com' 
};

describe('ProfilePage Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock Storage
    Storage.prototype.removeItem = vi.fn();
    Storage.prototype.getItem = vi.fn();

    // Default Happy Path Fetch
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/user/data')) {
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ success: true, userData: MOCK_USER }) 
        });
      }
      return Promise.resolve({ ok: true });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', async () => {
    // Use a promise that never resolves immediately to check loading state
    global.fetch = vi.fn(() => new Promise(() => {})); 
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('fetches and displays user profile data successfully', async () => {
    renderComponent();

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check Header
    expect(screen.getByText('Profile')).toBeInTheDocument();

    // Check User Data
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jdoe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('navigates back when Back button is clicked', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Profile')).toBeInTheDocument());

    const backBtn = screen.getByText('Back').closest('button');
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('navigates to forgot-password when Change Password is clicked', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Profile')).toBeInTheDocument());

    const changePassBtn = screen.getByText('Change Password');
    fireEvent.click(changePassBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
  });

  it('redirects to login and clears tokens on Auth Failure (API success: false)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }) // Auth failure response
    });

    renderComponent();

    await waitFor(() => {
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to login and clears tokens on Network Error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    renderComponent();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('profile fetch error', expect.anything());
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('handles Storage errors gracefully during cleanup (Catch block coverage)', async () => {
    // Force fetch to fail so it triggers the cleanup block
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    // Make removeItem throw an error to test the try/catch block inside the component
    Storage.prototype.removeItem = vi.fn(() => { throw new Error('Storage Access Denied'); });

    renderComponent();

    // The component should NOT crash; it should still try to navigate
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
  
  it('handles Storage errors gracefully during Auth Failure cleanup', async () => {
    // Force Auth Failure response
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false }) 
    });

    // Make removeItem throw to cover the catch block in the success:false branch
    Storage.prototype.removeItem = vi.fn(() => { throw new Error('Storage Access Denied'); });

    renderComponent();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});