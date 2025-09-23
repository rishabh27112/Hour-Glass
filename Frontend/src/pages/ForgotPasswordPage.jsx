import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ForgotPasswordPage.module.css';

const ForgotPasswordPage = () => {
  const [step, setStep] = useState(1); // 1: email/otp, 2: new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
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
      const response = await fetch('http://localhost:4000/api/auth/send-reset-otp', {
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

  // Step 1: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!otp) { setError('OTP is required'); return; }
    setLoading(true);
    // No separate verify endpoint, just allow next step if OTP is correct in reset
    setOtpVerified(true);
    setStep(2);
    setLoading(false);
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
      const response = await fetch('http://localhost:4000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Password reset successful! Redirecting to login...');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setError(data.message || 'Reset failed');
      }
    } catch (err) {
      setError('Reset error');
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2>Forgot Password</h2>
          <p>Reset your password in two steps.</p>
        </div>
        {step === 1 && (
          <>
            <form className={styles.form} onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
              <div className={styles.inputGroup}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={otpSent}
                />
              </div>
              {otpSent && (
                <div className={styles.inputGroup}>
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    className={styles.input}
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                  />
                </div>
              )}
              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? 'Processing...' : otpSent ? 'Verify OTP' : 'Send OTP'}
              </button>
              {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
              {success && <div style={{ color: 'green', marginTop: 8 }}>{success}</div>}
            </form>
          </>
        )}
        {step === 2 && (
          <form className={styles.form} onSubmit={handleResetPassword}>
            <div className={styles.inputGroup}>
              <input
                type="password"
                placeholder="New password"
                className={styles.input}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div className={styles.inputGroup}>
              <input
                type="password"
                placeholder="Confirm new password"
                className={styles.input}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className={styles.primaryButton} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
            {success && <div style={{ color: 'green', marginTop: 8 }}>{success}</div>}
          </form>
        )}
        <div className={styles.footer}>
          <Link to="/login" className={styles.loginLink}>Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;