import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SignUpPage.module.css';

const SignUpPage = () => {
  const navigate = useNavigate();
  // Two-step registration state
  const [step, setStep] = useState(1); // 1: email/otp, 2: registration
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [form, setForm] = useState({ fullName: '', password: '', confirmPassword: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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
    if (!form.fullName || !form.password || !form.confirmPassword) {
      setFormError('All fields are required');
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
          password: form.password
        })
      });
      const data = await response.json();
      if (data.success) {
        setFormSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setFormError(data.message || 'Registration failed');
      }
    } catch (error) {
      setFormError('Registration error');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logoSection}>
          <div className={styles.logo}> <i class="fa-solid fa-hourglass-half"></i></div>
          <h1 className={styles.title}>Hour Glass</h1>
          <p className={styles.subtitle}>Start tracking your productivity today </p>
        </div>
        <div className={styles.card}>
          <div className={styles.header}>
            <h2>Create your account</h2>
            <p>Join thousands of users tracking their time efficiently </p>
          </div>
          {step === 1 && (
            <>
              <div className={styles.inputGroup}>
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  className={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={otpSent}
                />
              </div>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSendOtp}
                disabled={otpLoading || !email || otpSent}
                style={{ marginBottom: 12 }}
              >
                {otpLoading ? 'Sending OTP...' : 'Send OTP'}
              </button>
              {otpSent && (
                <>
                  <div className={styles.inputGroup}>
                    <input
                      type="text"
                      name="otp"
                      placeholder="Enter OTP"
                      className={styles.input}
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      maxLength={6}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleVerifyOtp}
                    disabled={!otp}
                  >Verify OTP</button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleResendOtp}
                    disabled={resendLoading}
                    style={{ marginLeft: 8 }}
                  >{resendLoading ? 'Resending...' : 'Resend OTP'}</button>
                  {resendMsg && <div style={{ color: 'green', marginTop: 8 }}>{resendMsg}</div>}
                </>
              )}
              {otpError && <div style={{ color: 'red', marginTop: 8 }}>{otpError}</div>}
              {otpSuccess && <div style={{ color: 'green', marginTop: 8 }}>{otpSuccess}</div>}
            </>
          )}
          {step === 2 && (
            <form className={styles.form} onSubmit={handleRegister}>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Full name"
                  className={styles.input}
                  value={form.fullName}
                  onChange={handleFormChange}
                />
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  className={styles.input}
                  value={form.password}
                  onChange={handleFormChange}
                />
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm password"
                  className={styles.input}
                  value={form.confirmPassword}
                  onChange={handleFormChange}
                />
              </div>
              <button type="submit" className={styles.primaryButton}>Register</button>
              {formError && <div style={{ color: 'red', marginTop: 8 }}>{formError}</div>}
              {formSuccess && <div style={{ color: 'green', marginTop: 8 }}>{formSuccess}</div>}
            </form>
          )}
          <div className={styles.terms}>
            <span>By signing up, you agree to our </span>
            <a href="#" className={styles.link}>Terms of Service</a>
            <span> and </span>
            <a href="#" className={styles.link}>Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
