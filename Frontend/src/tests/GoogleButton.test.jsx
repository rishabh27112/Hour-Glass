import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import GoogleButton from '../components/GoogleButton'; // Check this path matches your folder structure
import * as router from 'react-router-dom';

// 1. Mock React Router
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// 2. Mock API Config
vi.mock('../config/api', () => ({
  default: 'http://mock-api.com',
}));

describe('GoogleButton Component', () => {
  // Setup generic mocks for window functions
  // THESE DEFINITIONS MUST BE HERE FOR THE TESTS TO SEE THEM
  const openMock = vi.fn();
  const alertMock = vi.fn();
  const fetchMock = vi.fn();
  const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset window mocks
    window.open = openMock;
    window.alert = alertMock;
    global.fetch = fetchMock;
    
    // Mock localStorage and sessionStorage
    Storage.prototype.setItem = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers(); // Ensure timers are reset
  });

  it('renders correctly with initial state', () => {
    render(<GoogleButton />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Sign up with Google')).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('handles popup blocked scenario (window.open returns null)', () => {
    openMock.mockReturnValue(null); // Simulate blocked popup

    render(<GoogleButton />);
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Should alert user
    expect(alertMock).toHaveBeenCalledWith(
      expect.stringContaining('Could not open popup')
    );
    // Loading should reset (button enabled again)
    expect(button).not.toBeDisabled();
  });

  it('prevents multiple clicks while loading', () => {
    // Return a dummy popup object so it doesn't fail immediately
    openMock.mockReturnValue({ closed: false });
    
    render(<GoogleButton />);
    const button = screen.getByRole('button');
    
    // First click
    fireEvent.click(button);
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    
    // Second click
    fireEvent.click(button);
    
    // window.open should still only be called once
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  // --- FIXED TEST CASE START ---
  it('handles manual popup close via setInterval', () => {
    vi.useFakeTimers();
    const popupMock = { closed: false };
    openMock.mockReturnValue(popupMock);

    render(<GoogleButton />);
    fireEvent.click(screen.getByRole('button'));

    // Verify loading state
    expect(screen.getByText('Signing in...')).toBeInTheDocument();

    // Simulate user closing the popup
    popupMock.closed = true;

    // Fast-forward time to trigger the setInterval check
    // We use act() to process the state update immediately
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Loading should stop immediately
    expect(screen.getByText('Sign up with Google')).toBeInTheDocument();
  });
  // --- FIXED TEST CASE END ---

  it('ignores messages from different origins', () => {
    openMock.mockReturnValue({ closed: false });
    render(<GoogleButton />);
    fireEvent.click(screen.getByRole('button'));

    // Dispatch event from wrong origin
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'http://evil-site.com',
        data: { type: 'GOOGLE_AUTH_SUCCESS', token: '123' }
      }));
    });

    // Should NOT call fetch or navigate
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('successfully authenticates, stores data, and navigates (Happy Path)', async () => {
    openMock.mockReturnValue({ closed: false });
    
    // Mock successful user fetch
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ success: true, user: { id: 1, name: 'Test User' } }),
    });

    render(<GoogleButton />);
    fireEvent.click(screen.getByRole('button'));

    // Simulate valid message from backend
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin, // Must match current jsdom origin
        data: { type: 'GOOGLE_AUTH_SUCCESS', token: 'mock-jwt-token' }
      }));
    });

    await waitFor(() => {
      // 1. Check Token Storage
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'mock-jwt-token');
      expect(sessionStorage.setItem).toHaveBeenCalledWith('token', 'mock-jwt-token');
      
      // 2. Check User Fetch
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/data'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-jwt-token' }
        })
      );

      // 3. Check User Data Storage
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify({ id: 1, name: 'Test User' }));
      
      // 4. Check Navigation
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
      
      // 5. Loading reset
      expect(screen.queryByText('Signing in...')).not.toBeInTheDocument();
    });
  });

  it('handles storage errors gracefully (Try/Catch blocks)', async () => {
    openMock.mockReturnValue({ closed: false });
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ success: true, userData: { id: 1 } }), // using userData variant
    });

    // Make setItem throw error to test the catch blocks
    Storage.prototype.setItem = vi.fn(() => { throw new Error('Storage full'); });

    render(<GoogleButton />);
    fireEvent.click(screen.getByRole('button'));

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'GOOGLE_AUTH_SUCCESS', token: 'token' }
      }));
    });

    await waitFor(() => {
      // Should still navigate even if storage fails
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
      // Should have logged warnings
      expect(consoleWarnMock).toHaveBeenCalled();
    });
  });

  it('handles fetch user failure gracefully', async () => {
    openMock.mockReturnValue({ closed: false });
    
    // Mock fetch failure
    fetchMock.mockRejectedValue(new Error('Network Error'));

    render(<GoogleButton />);
    fireEvent.click(screen.getByRole('button'));

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'GOOGLE_AUTH_SUCCESS', token: 'token' }
      }));
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
      expect(consoleWarnMock).toHaveBeenCalledWith(
        'Failed to fetch user after Google login', 
        expect.any(Error)
      );
    });
  });
});