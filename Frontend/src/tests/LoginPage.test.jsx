import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';

// --- MOCKS ---

// 1. Mock the Router hook to track navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// 2. Mock child components to isolate page logic
vi.mock('../components/MainButton', () => ({
  default: ({ txt, disabled }) => (
    <button type="submit" disabled={disabled}>
      {txt}
    </button>
  ),
}));

vi.mock('../components/Logo', () => ({
  default: () => <div data-testid="logo-mock">Logo</div>,
}));

vi.mock('../components/GoogleButton', () => ({
  default: () => <div data-testid="google-btn-mock">Google Button</div>,
}));

// 3. Mock image assets to prevent build/test errors
vi.mock('../assets/login-bg.png', () => ({ default: 'test-file-stub' }));

// 4. Mock the API Config
vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));

describe('LoginPage Component', () => {
  // Helper to render with Router context (needed for Links)
  const renderComponent = () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
  };

  // Helper to fill form (reusable)
  const fillForm = (email = 'test@example.com', password = 'password123') => {
    fireEvent.change(screen.getByPlaceholderText(/Email or username/i), { target: { value: email } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
  };

  // Setup and Teardown
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = vi.fn();
    // Mock storage
    Storage.prototype.setItem = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the login form and elements correctly', () => {
    renderComponent();

    expect(screen.getByText(/Sign in to Hour Glass/i)).toBeInTheDocument();
    expect(screen.getByTestId('logo-mock')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Email or username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
  });

  it('updates state when user types in inputs', () => {
    renderComponent();
    fillForm('testuser', 'mysecretpass');

    const emailInput = screen.getByPlaceholderText(/Email or username/i);
    const passwordInput = screen.getByPlaceholderText('••••••••');

    expect(emailInput.value).toBe('testuser');
    expect(passwordInput.value).toBe('mysecretpass');
  });

  it('handles successful login (Default: Session Storage)', async () => {
    renderComponent();

    // Mock successful API response
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ success: true, token: 'fake-token', user: { id: 1 } }),
    });

    fillForm(); // Fill inputs to satisfy 'required'
    
    // Click Login
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitBtn);

    // Check Loading State (Button text changes)
    expect(screen.getByRole('button')).toHaveTextContent('Signing in...');
    expect(screen.getByRole('button')).toBeDisabled();

    await waitFor(() => {
      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith(
        'http://mock-api.com/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ identifier: 'test@example.com', password: 'password123' }),
        })
      );

      // Verify Session Storage was used (Remember Me is false by default)
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('token', 'fake-token');
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify({ id: 1 }));
      
      // Verify Navigation
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles successful login with "Remember Me" (Local Storage)', async () => {
    renderComponent();

    global.fetch.mockResolvedValueOnce({
      json: async () => ({ success: true, token: 'fake-token', user: { id: 1 } }),
    });

    fillForm();

    // Check "Remember Me"
    const rememberMeCheckbox = screen.getByRole('checkbox');
    fireEvent.click(rememberMeCheckbox);
    expect(rememberMeCheckbox).toBeChecked();

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      // Verify Local Storage was used
      expect(window.localStorage.setItem).toHaveBeenCalledWith('token', 'fake-token');
    });
  });

  it('handles API failure (success: false)', async () => {
    renderComponent();

    // Mock failed response
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ success: false, message: 'Invalid credentials' }),
    });

    fillForm(); // Must fill inputs to trigger submit
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      // Check if error message is displayed
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      // Ensure no navigation happened
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('handles Network Errors (fetch throws)', async () => {
    renderComponent();

    // Mock network error
    global.fetch.mockRejectedValueOnce(new Error('Server offline'));

    fillForm(); // Must fill inputs to trigger submit
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Server offline/i)).toBeInTheDocument();
    });
  });
});