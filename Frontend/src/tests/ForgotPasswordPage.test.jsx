import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';

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

vi.mock('../assets/login-bg.png', () => ({ default: 'test-file-stub' }));
vi.mock('../config/api', () => ({ default: 'http://mock-api.com' }));

describe('ForgotPasswordPage Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Using Real Timers to ensure stability with fetch/waitFor
    vi.useRealTimers();
    
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    global.fetch = vi.fn((url) => {
      if (url.includes('/send-reset-otp')) return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      if (url.includes('/reset-password')) return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- STEP 1: EMAIL & OTP ---

  it('renders Step 1 initially', () => {
    renderComponent();
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByText('Send OTP')).toBeInTheDocument();
  });

  it('validates empty email', () => {
    renderComponent();
    
    // FIX: Find form and fire submit directly to bypass HTML5 'required' validation
    // allowing the React handler to run and set the error state.
    const submitBtn = screen.getByText('Send OTP');
    const form = submitBtn.closest('form');
    fireEvent.submit(form);

    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('sends OTP successfully and transitions UI', async () => {
    renderComponent();
    
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByText('Send OTP'));

    expect(screen.getByText('Processing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/send-reset-otp'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@test.com' })
        })
      );
      expect(screen.getByText('OTP sent to your email.')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter OTP')).toBeInTheDocument();
      expect(screen.getByText('Verify OTP')).toBeInTheDocument();
    });
  });

  it('handles Send OTP API failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'User not found' })
    });

    renderComponent();
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'unknown@test.com' } });
    fireEvent.click(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });

  it('handles Verify OTP validation (empty OTP)', async () => {
    renderComponent();
    // Transition to OTP state
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByText('Send OTP'));
    await waitFor(() => screen.getByText('Verify OTP'));

    // FIX: Bypass HTML5 validation for OTP input
    const submitBtn = screen.getByText('Verify OTP');
    const form = submitBtn.closest('form');
    fireEvent.submit(form);

    expect(screen.getByText('OTP is required')).toBeInTheDocument();
  });

  it('verifies OTP and moves to Step 2', async () => {
    renderComponent();
    
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByText('Send OTP'));
    await waitFor(() => screen.getByPlaceholderText('Enter OTP'));

    fireEvent.change(screen.getByPlaceholderText('Enter OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify OTP'));

    await waitFor(() => {
      expect(screen.getByText('Set New Password')).toBeInTheDocument();
      expect(screen.getByText('Confirm New Password')).toBeInTheDocument();
    });
  });

  // --- STEP 2: RESET PASSWORD ---

  describe('Step 2: Reset Logic', () => {
    const goToStep2 = async () => {
      renderComponent();
      fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@test.com' } });
      fireEvent.click(screen.getByText('Send OTP'));
      await waitFor(() => screen.getByPlaceholderText('Enter OTP'));
      fireEvent.change(screen.getByPlaceholderText('Enter OTP'), { target: { value: '123456' } });
      fireEvent.click(screen.getByText('Verify OTP'));
      await waitFor(() => screen.getByText('Set New Password'));
    };

    it('validates empty password fields', async () => {
      await goToStep2();
      
      // FIX: Bypass HTML5 validation for empty password fields
      const submitBtn = screen.getByText('Reset Password');
      const form = submitBtn.closest('form');
      fireEvent.submit(form);

      expect(screen.getByText('All fields are required')).toBeInTheDocument();
    });

    it('validates password mismatch', async () => {
      await goToStep2();
      
      const inputs = screen.getAllByPlaceholderText('••••••••');
      fireEvent.change(inputs[0], { target: { value: 'pass123' } });
      fireEvent.change(inputs[1], { target: { value: 'passXYZ' } });
      
      fireEvent.click(screen.getByText('Reset Password'));
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    it('resets password successfully and redirects', async () => {
      await goToStep2();

      const inputs = screen.getAllByPlaceholderText('••••••••');
      fireEvent.change(inputs[0], { target: { value: 'newpass123' } });
      fireEvent.change(inputs[1], { target: { value: 'newpass123' } });

      fireEvent.click(screen.getByText('Reset Password'));

      await waitFor(() => {
        expect(screen.getByText('Resetting...')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/reset-password'),
          expect.anything()
        );
        expect(screen.getByText(/Password reset successful/)).toBeInTheDocument();
      });

      // Wait for redirection
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      }, { timeout: 3000 });
    });

    it('handles Reset API failure', async () => {
      await goToStep2();

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: 'Weak password' })
      });

      const inputs = screen.getAllByPlaceholderText('••••••••');
      fireEvent.change(inputs[0], { target: { value: '123' } });
      fireEvent.change(inputs[1], { target: { value: '123' } });

      fireEvent.click(screen.getByText('Reset Password'));

      await waitFor(() => {
        expect(screen.getByText('Weak password')).toBeInTheDocument();
      });
    });

    it('handles Network Error during reset', async () => {
      await goToStep2();
      global.fetch.mockRejectedValueOnce(new Error('Network Error'));

      const inputs = screen.getAllByPlaceholderText('••••••••');
      fireEvent.change(inputs[0], { target: { value: 'pass' } });
      fireEvent.change(inputs[1], { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Reset Password'));

      await waitFor(() => {
        expect(screen.getByText('Reset error')).toBeInTheDocument();
      });
    });
  });

  // --- AUTO-HIDE TIMER TEST ---

  it('auto-hides success message after 5 seconds', async () => {
    renderComponent();
    
    // 1. Trigger Success Message
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByText('Send OTP'));

    // 2. Wait for it to appear
    await waitFor(() => {
      expect(screen.getByText('OTP sent to your email.')).toBeInTheDocument();
    });

    // 3. Use a Promise-based delay to simulate real time passing for the test
    // This works better than FakeTimers when mixed with real fetch promises
    await new Promise((r) => setTimeout(r, 5100));

    // 4. Verify it's gone
    // We use waitFor here just in case the state update is pending in the event loop
    await waitFor(() => {
        expect(screen.queryByText('OTP sent to your email.')).not.toBeInTheDocument();
    });
  }, 10000); // Test timeout
});