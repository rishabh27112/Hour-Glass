// src/pages/SignUpPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainButton from '../components/MainButton';
import Logo from '../components/Logo';
import GoogleButton from '../components/GoogleButton';
import LoginBg from '../assets/login-bg.png';

const SignUpPage = () => {
  // --- All backend logic is injected here ---
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [form, setForm] = useState({ fullName: '', username: '', password: '', confirmPassword: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const navigate = useNavigate();

  // Step 1: Send OTP
  const handleSendOtp = async () => {
    setOtpError(''); setOtpSuccess(''); setOtpLoading(true); setResendMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (data.success) {
        setOtpSent(true);
        setOtpSuccess('OTP sent to your email.');
      } else {
        setOtpError(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      setOtpError('Send OTP error');
    }
    setOtpLoading(false);
  };

  // Step 1: Resend OTP
  const handleResendOtp = async () => {
    setResendLoading(true); setResendMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      setResendMsg(data.message);
    } catch (error) {
      setResendMsg('Resend OTP error');
    }
    setResendLoading(false);
  };

  // Auto-hide resend/success messages after a short period
  const hideTimerRef = useRef(null);
  useEffect(() => {
    // clear any existing timer when messages change
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    // If there's a resend message or otp success, hide after 5s
    if (resendMsg || otpSuccess) {
      hideTimerRef.current = setTimeout(() => {
        setResendMsg('');
        setOtpSuccess('');
      }, 5000);
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [resendMsg, otpSuccess]);

  // Step 1: Verify OTP
  const handleVerifyOtp = async () => {
    setOtpError(''); setOtpSuccess('');
    try {
      const response = await fetch('http://localhost:4000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await response.json();
      if (data.success) {
        setOtpSuccess('OTP verified! Continue registration.');
        setTimeout(() => setStep(2), 1000);
      } else {
        setOtpError(data.message || 'Invalid OTP');
      }
    } catch (error) {
      setOtpError('OTP verification error');
    }
  };

  // Step 2: Register
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!form.fullName || !form.username || !form.password || !form.confirmPassword) {
      setFormError('All fields are required');
      return;
    }
    const usernameOk = /^[a-z0-9_]{3,20}$/.test(form.username.trim().toLowerCase());
    if (!usernameOk) {
      setFormError('Username must be 3-20 chars, lowercase letters/numbers/underscore only');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    try {
      const response = await fetch('http://localhost:4000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.fullName,
          email,
          username: form.username.trim().toLowerCase(),
          password: form.password
        })
      });
      const data = await response.json();
      if (data.success) {
        setFormSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
          navigate('/signin'); // Changed from /login to /signin
        }, 1500);
      } else {
        setFormError(data.message || 'Registration failed');
      }
    } catch (error) {
      setFormError('Registration error');
    }
  };
  // --- End of injected logic ---

  return (
    <div style={{ backgroundImage: `url(${LoginBg})` }} className="tracking-wide flex items-center justify-center min-h-screen bg-cover bg-center relative px-4 py-8">
      <div className="absolute inset-0 bg-black opacity-70"></div>

      <div
        className="
          w-full max-w-md 
          p-6 space-y-4 
          relative z-10
          backdrop-blur-sm
        "
      >
        {/* Header */}
        <div className="text-center">
          <Logo />
          <h2 className="mt-3 text-2xl font-bold text-white">
            {step === 1 ? 'Verify Your Email' : 'Create Your Account'}
          </h2>
        </div>

        {/* --- Step 1: Email & OTP Verification --- */}
        {step === 1 && (
          <div className="space-y-4">
            <GoogleButton />

            <div className="flex items-center justify-center my-2">
              <span className="w-full border-t border-[#3a3a3a]"></span>
              <span className="px-4 text-gray-400 bg-transparent text-sm z-10 relative">or</span>
              <span className="w-full border-t border-[#3a3a3a]"></span>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-lg font-medium text-gray-300">Email address</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={otpSent}
                />
              </div>
            </div>

            {/* Send OTP Button */}
            {!otpSent && (
              <MainButton
                txt={otpLoading ? 'Sending OTP...' : 'Send OTP'}
                onClick={handleSendOtp}
                disabled={otpLoading || !email}
                type="button"
              />
            )}

            {/* OTP Verification Section */}
            {otpSent && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Enter OTP</label>
                  <div className="mt-1">
                    <input
                      type="text"
                      required
                      className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                      placeholder="••••••"
                      maxLength={6}
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                    />
                  </div>
                </div>
                <MainButton
                  txt="Verify OTP"
                  onClick={handleVerifyOtp}
                  disabled={!otp}
                  type="button"
                />
                <button
                  type="button"
                  className="text-sm font-medium underline decoration-[#18d4d1] text-gray-200 hover:text-[#18d4d1] hover:decoration-gray-200 w-full"
                  onClick={handleResendOtp}
                  disabled={resendLoading}
                >
                  {resendLoading ? 'Resending...' : 'Resend OTP'}
                </button>
                {resendMsg && <div className="text-white text-sm text-center font-medium">{resendMsg}</div>}
              </div>
            )}

            {otpError && <div className="text-red-400 text-sm text-center">{otpError}</div>}
            {otpSuccess && <div className="text-white text-sm text-center font-medium">{otpSuccess}</div>}
          </div>
        )}

        {/* --- Step 2: Registration Form --- */}
        {step === 2 && (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="block text-sm font-medium text-gray-300">Full Name</label>
              <div className="mt-1">
                <input
                  type="text"
                  name="fullName"
                  required
                  className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                  placeholder="Your full name"
                  value={form.fullName}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Username</label>
              <div className="mt-1">
                <input
                  type="text"
                  name="username"
                  required
                  className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                  placeholder="e.g., john_doe_123"
                  value={form.username}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300">Confirm Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            {formError && <div className="text-red-400 text-sm text-center">{formError}</div>}
            {formSuccess && <div className="text-green-400 text-sm text-center">{formSuccess}</div>}

            <div>
              <MainButton txt='Create Account' type="submit" />
            </div>
          </form>
        )}

        {/* Sign In Link */}
        <div className="text-center text-lg text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium underline decoration-[#18d4d1] text-gray-200 hover:text-[#18d4d1] hover:decoration-gray-200">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;