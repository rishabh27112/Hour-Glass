// src/pages/ForgotPasswordPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainButton from '../components/MainButton';
import LoginBg from '../assets/login-bg.png';

const ForgotPasswordPage = () => {
  // --- All backend logic is injected here ---
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email) { setError('Email is required'); return; }
    setLoading(true);
    try {
      const response = await fetch('${API_BASE_URL}/api/auth/send-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (data.success) {
        setOtpSent(true);
        setSuccess('OTP sent to your email.');
      } else {
        setError(data.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Send OTP error');
    }
    setLoading(false);
  };

  // Auto-hide success messages after a short period
  const hideTimerRef = useRef(null);
  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (success) {
      hideTimerRef.current = setTimeout(() => {
        setSuccess('');
      }, 5000);
    }
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [success]);

  // Step 1: Verify OTP (His logic just moves to step 2)
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!otp) { setError('OTP is required'); return; }
    setSuccess('OTP entered. Proceed to reset password.');
    setStep(2);
  };

  // Step 2: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!newPassword || !confirmPassword) {
      setError('All fields are required'); return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match'); return;
    }
    setLoading(true);
    try {
      const response = await fetch('${API_BASE_URL}/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Password reset successful! Redirecting to login...');
        setTimeout(() => navigate('/signin'), 1500); // Use /signin
      } else {
        setError(data.message || 'Reset failed');
      }
    } catch (err) {
      setError('Reset error');
    }
    setLoading(false);
  };
  // --- End of injected logic ---

  return (
    <div style={{ backgroundImage: `url(${LoginBg})` }} className=" tracking-wide flex items-center justify-center min-h-screen bg-cover bg-center relative px-4 py-8">
      <div className="absolute inset-0 bg-black opacity-75"></div>

      <div
        className="
          w-full max-w-md 
          p-6 space-y-4 
          relative z-10
          backdrop-blur-sm
        "
      >
        {/* Header (Dynamic based on step) */}
        <div className="text-center">
          <i className="ri-mail-send-line text-[#18d4d1] text-6xl"></i>
          <h2 className="mt-3 text-2xl font-bold text-white">
            {step === 1 ? 'Reset your password' : 'Set New Password'}
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            {step === 1
              ? "Enter your email and we'll send you a link to reset your password."
              : 'Please enter your new password below.'}
          </p>
        </div>

        {/* --- Step 1: Send/Verify OTP Form --- */}
        {step === 1 && (
          <form className="space-y-4 pt-2" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
            <div>
              <label className="block text-lg font-medium text-gray-200 tracking-wide">
                Email address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={otpSent} // Disables email input after OTP is sent
                />
              </div>
            </div>

            {/* OTP Input (appears after OTP is sent) */}
            {otpSent && (
              <div>
                <label className="block text-sm font-medium text-gray-200 tracking-wide">
                  OTP
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Error & Success Messages */}
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            {success && <div className="text-white text-sm text-center font-medium">{success}</div>}

            <div>
              <MainButton
                txt={loading ? 'Processing...' : otpSent ? 'Verify OTP' : 'Send OTP'}
                disabled={loading}
                type="submit"
              />
            </div>
          </form>
        )}

        {/* --- Step 2: Reset Password Form --- */}
        {step === 2 && (
          <form className="space-y-4 pt-2" onSubmit={handleResetPassword}>
            <div>
              <label className="block text-sm font-medium text-gray-200 tracking-wide">
                New Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 tracking-wide">
                Confirm New Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Error & Success Messages */}
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            {success && <div className="text-white text-sm text-center font-medium">{success}</div>}

            <div>
              <MainButton
                txt={loading ? 'Resetting...' : 'Reset Password'}
                disabled={loading}
                type="submit"
              />
            </div>
          </form>
        )}

        {/* Back to Sign In Link */}
        <div className="text-center text-gray-400">
          <Link to="/signin" className="font-medium underline decoration-[#18d4d1] text-gray-200 hover:text-[#18d4d1] hover:decoration-gray-200">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;