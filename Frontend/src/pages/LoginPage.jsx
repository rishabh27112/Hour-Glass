import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logoSection}>
          <div className={styles.logo}>⏰</div>
          <h1 className={styles.title}>Time Tracker</h1>
          <p className={styles.subtitle}>Track your productivity with precision ✨</p>
        </div>
        
        <div className={styles.card}>
          <div className={styles.header}>
            <h2>Welcome back</h2>
            <p>Sign in to your account to continue tracking 🚀</p>
          </div>
          
          <form className={styles.form}>
            <div className={styles.inputGroup}>
              <input type="email" placeholder="Enter your email" className={styles.input} />
            </div>
            <div className={styles.inputGroup}>
              <input type="password" placeholder="Enter your password" className={styles.input} />
            </div>
            
            <div className={styles.options}>
              <label className={styles.checkbox}>
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
            </div>
            
            <button type="submit" className={styles.primaryButton}>
              ✨ Sign in
            </button>
          </form>
          
          <div className={styles.divider}>
            <span>OR CONTINUE WITH</span>
          </div>
          
          <button className={styles.googleButton}>
            <span className={styles.googleIcon}>🔗</span>
            Continue with Google
          </button>
          
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