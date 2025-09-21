import React from 'react';
import { Link } from 'react-router-dom';
import styles from './ForgotPasswordPage.module.css';

const ForgotPasswordPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2>Forgot Password</h2>
          <p>Enter your email to receive a password reset link.</p>
        </div>
        <form className={styles.form}>
          <div className={styles.inputGroup}>
            <input type="email" id="email" placeholder="Enter your email" className={styles.input} />
          </div>
          <button type="submit" className={styles.primaryButton}>Send Reset Link</button>
        </form>
        <div className={styles.footer}>
          <Link to="/login" className={styles.loginLink}>Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;