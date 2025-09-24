import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.success) {
        // Server sets an httpOnly cookie; frontend can't read it directly.
        // We still store token/user returned in response (useful for UI) if present.
        const storage = rememberMe ? localStorage : sessionStorage;
        if (data.token) storage.setItem('token', data.token);
        if (data.user) storage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Login error');
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logoSection}>
          <div className={styles.logo}> <i class="fa-solid fa-hourglass-half"></i></div>
          <h1 className={styles.title}>Time Tracker</h1>
          <p className={styles.subtitle}>Track your productivity with precision </p>
        </div>
        <div className={styles.card}>
          <div className={styles.header}>
            <h2>Welcome back</h2>
            <p>Sign in to your account to continue tracking</p>
          </div>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <input
                type="email"
                placeholder="Enter your email"
                className={styles.input}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <input
                type="password"
                placeholder="Enter your password"
                className={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div className={styles.options}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
            </div>
            <button type="submit" className={styles.primaryButton} disabled={loading}>
              {loading ? 'Signing in...' : ' Sign in'}
            </button>
            <a href="http://localhost:4000/api/auth/google" className={styles.googleButton} style={{marginTop: 12, display: 'block', textAlign: 'center', background: '#fff', color: '#444', border: '1px solid #ccc', borderRadius: 4, padding: '10px 0', textDecoration: 'none', fontWeight: 500}}>
              <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style={{width: 20, marginRight: 8, verticalAlign: 'middle'}} />
              Continue with Google
            </a>
            {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          </form>
          <div className={styles.footer}>
            <span>Don't have an account? </span>
            <Link to="/signup" className={styles.signupLink}>Sign up here</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;