import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SignUpPage from '../pages/SignUpPage';

// --- MOCKS ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../components/MainButton', () => ({
  default: ({ txt, disabled, onClick, type }) => (
    <button type={type || 'button'} disabled={disabled} onClick={onClick}>
      {txt}
    </button>
  ),
}));

vi.mock('../components/Logo', () => ({ default: () => <div>Logo</div> }));
vi.mock('../components/GoogleButton', () => ({ default: () => <div>Google Button</div> }));
vi.mock('../assets/login-bg.png', () => ({ default: 'test-file-stub' }));
vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));

describe('SignUpPage Component', () => {
  const renderComponent = () => {
    render(
      <BrowserRouter>
        <SignUpPage />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Using real timers with extended timeout for stability
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- STEP 1 TESTS ---

  it('renders Step 1 (Email Verification) initially', () => {
    renderComponent();
    expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('sends OTP successfully and shows OTP input', async () => {
    renderComponent();
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ success: true, message: 'OTP sent' }),
      status: 200,
    });

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByText('OTP sent to your email.')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••')).toBeInTheDocument();
    });
  });

  it('handles Send OTP failure', async () => {
    renderComponent();
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ success: false, message: 'Email already exists' }),
      status: 400,
    });

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'bad@test.com' } });
    fireEvent.click(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });

  it('resends OTP successfully', async () => {
    renderComponent();
    // 1. Send OTP
    global.fetch.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send OTP'));
    await waitFor(() => expect(screen.getByText('Resend OTP')).toBeInTheDocument());

    // 2. Resend
    global.fetch.mockResolvedValueOnce({ json: async () => ({ success: true, message: 'OTP Resent' }) });
    fireEvent.click(screen.getByText('Resend OTP'));
    await waitFor(() => expect(screen.getByText('OTP Resent')).toBeInTheDocument());
  });

  it('verifies OTP and transitions to Step 2', async () => {
    renderComponent();
    // 1. Send
    global.fetch.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send OTP'));
    await waitFor(() => expect(screen.getByPlaceholderText('••••••')).toBeInTheDocument());

    // 2. Verify
    global.fetch.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify OTP'));

    await waitFor(() => expect(screen.getByText('OTP verified! Continue registration.')).toBeInTheDocument());

    // Wait for the natural 1s delay
    await waitFor(() => {
      expect(screen.getByText('Create Your Account')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  // --- STEP 2 TESTS ---

  describe('Step 2: Registration', () => {
    // Helper to get to Step 2
    const goToStep2 = async () => {
      renderComponent();
      // Mock Send OTP
      global.fetch.mockResolvedValueOnce({ json: async () => ({ success: true }) });
      fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'valid@test.com' } });
      fireEvent.click(screen.getByText('Send OTP'));
      await waitFor(() => screen.getByPlaceholderText('••••••'));

      // Mock Verify OTP
      global.fetch.mockResolvedValueOnce({ json: async () => ({ success: true }) });
      fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: '123456' } });
      fireEvent.click(screen.getByText('Verify OTP'));
      
      await waitFor(() => screen.getByText('OTP verified! Continue registration.'));
      
      // Wait for transition
      await waitFor(() => {
        expect(screen.getByText('Create Your Account')).toBeInTheDocument();
      }, { timeout: 3000 });
    };

    it('validates empty fields', async () => {
      await goToStep2();
      
      const submitBtn = screen.getByText('Create Account');
      const form = submitBtn.closest('form');
      
      fireEvent.submit(form);
      
      expect(screen.getByText('All fields are required')).toBeInTheDocument();
    }, 15000);

    it('validates username regex', async () => {
      await goToStep2();
      
      // Capture inputs
      const [passwordInput, confirmPasswordInput] = screen.getAllByPlaceholderText('••••••••');
      
      fireEvent.change(screen.getByPlaceholderText('Your full name'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., john_doe_123'), { target: { value: 'BAD NAME' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'pass' } });
      
      fireEvent.click(screen.getByText('Create Account'));
      expect(screen.getByText(/Username must be 3-20 chars/i)).toBeInTheDocument();
    }, 15000);

    it('validates password mismatch', async () => {
      await goToStep2();

      const [passwordInput, confirmPasswordInput] = screen.getAllByPlaceholderText('••••••••');

      fireEvent.change(screen.getByPlaceholderText('Your full name'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., john_doe_123'), { target: { value: 'john_doe' } });
      fireEvent.change(passwordInput, { target: { value: 'A' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'B' } });

      fireEvent.click(screen.getByText('Create Account'));
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    }, 15000);

    it('handles successful registration', async () => {
      await goToStep2();

      global.fetch.mockResolvedValueOnce({ json: async () => ({ success: true }) });

      const [passwordInput, confirmPasswordInput] = screen.getAllByPlaceholderText('••••••••');

      fireEvent.change(screen.getByPlaceholderText('Your full name'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., john_doe_123'), { target: { value: 'john_doe' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(screen.getByText('Registration successful! Redirecting to login...')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Wait for the 1.5s redirection delay
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      }, { timeout: 3000 });
    }, 15000);

    it('handles registration API error', async () => {
      await goToStep2();

      global.fetch.mockResolvedValueOnce({ 
          json: async () => ({ success: false, message: 'Username taken' }) 
      });

      const [passwordInput, confirmPasswordInput] = screen.getAllByPlaceholderText('••••••••');

      fireEvent.change(screen.getByPlaceholderText('Your full name'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., john_doe_123'), { target: { value: 'john_doe' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(screen.getByText('Username taken')).toBeInTheDocument();
      }, { timeout: 3000 });
    }, 15000);
  });
});