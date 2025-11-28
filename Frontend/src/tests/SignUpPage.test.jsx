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
    return render(
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
    const { container } = renderComponent();
    expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    
    // Ensure Step 2 elements are NOT present
    expect(screen.queryByText('Create Your Account')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Your full name')).not.toBeInTheDocument();

    // Check background image style
    const bgContainer = screen.getByText('Verify Your Email').closest('.min-h-screen');
    expect(bgContainer).toHaveStyle(`background-image: url(test-file-stub)`);

    // Check Send OTP button is disabled initially (email is empty)
    const sendOtpBtn = screen.getByRole('button', { name: /Send OTP/i });
    expect(sendOtpBtn).toBeDisabled();

    // Check error/success message containers are NOT present (kills && -> ||)
    expect(container.getElementsByClassName('text-red-400').length).toBe(0);
    expect(container.getElementsByClassName('text-green-400').length).toBe(0);
  });

  it('sends OTP successfully and shows OTP input', async () => {
    renderComponent();
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ success: true, message: 'OTP sent' }),
      status: 200,
    });

    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    const sendOtpBtn = screen.getByText('Send OTP');
    
    // Check button text before click
    expect(sendOtpBtn).toHaveTextContent('Send OTP');
    
    fireEvent.click(sendOtpBtn);

    // Check loading state
    expect(screen.getByRole('button', { name: /Sending OTP.../i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sending OTP.../i })).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('OTP sent to your email.')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••')).toBeInTheDocument();
    });
    
    // Ensure error message is NOT present
    expect(screen.queryByText('Failed to send OTP')).not.toBeInTheDocument();
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
    
    // Ensure success message is NOT present
    expect(screen.queryByText('OTP sent to your email.')).not.toBeInTheDocument();
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
    
    const resendBtn = screen.getByText('Resend OTP');
    fireEvent.click(resendBtn);
    
    // Check loading text
    expect(screen.getByText('Resending...')).toBeInTheDocument();
    
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

    // Ensure Step 1 elements are gone
    expect(screen.queryByText('Verify Your Email')).not.toBeInTheDocument();
    expect(screen.queryByText('Send OTP')).not.toBeInTheDocument();
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
      fireEvent.change(screen.getByPlaceholderText('e.g., john_doe_123'), { target: { value: '  john_doe  ' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Create Account'));

      // Verify fetch arguments strictly
      expect(global.fetch).toHaveBeenCalledWith(
        'http://mock-api.com/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'John Doe',
            email: 'valid@test.com',
            username: 'john_doe', // lowercased and trimmed
            password: 'pass'
          })
        })
      );

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