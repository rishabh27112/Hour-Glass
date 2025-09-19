import React from 'react';
import { Link } from 'react-router-dom';
import styles from './SignUpPage.module.css';

const SignUpPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logoSection}>
          <div className={styles.logo}>⏰</div>
          <h1 className={styles.title}>Time Tracker</h1>
          <p className={styles.subtitle}>Start tracking your productivity today ✨</p>
        </div>
        
        <div className={styles.card}>
          <div className={styles.header}>
            <h2>Create your account</h2>
            <p>Join thousands of users tracking their time efficiently 🚀</p>
          </div>
          
          <form className={styles.form}>
            <div className={styles.inputGroup}>
              <input type="text" placeholder="Full name" className={styles.input} />
            </div>
            <div className={styles.inputGroup}>
              <input type="email" placeholder="Email address" className={styles.input} />
            </div>
            <div className={styles.inputGroup}>
              <input type="password" placeholder="Password" className={styles.input} />
            </div>
            <div className={styles.inputGroup}>
              <input type="password" placeholder="Confirm password" className={styles.input} />
            </div>
            
            <button type="submit" className={styles.primaryButton}>
              🚀 Create Account
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
            <span>Already have an account? </span>
            <Link to="/login" className={styles.loginLink}>Sign in here</Link>
          </div>
          
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