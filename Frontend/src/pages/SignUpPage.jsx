import React, { useState } from 'react';
import styles from './SignUpPage.module.css';

const SignUpPage = () => {
  const [user, setUser] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prevUser) => ({
      ...prevUser,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form Submitted:', user);
    // Send 'user' object to backend
    try{
      const response = await fetch('http://localhost:4000/api/auth/register', {
        method:'POST',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: user.fullName,  // match backend field "name"
          email: user.email,
          password: user.password
        })
      });
      console.log(response);
    } catch (error) {
      console.log('regiter', error);
    }
  };

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

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                name="fullName"
                placeholder="Full name"
                className={styles.input}
                value={user.fullName}
                onChange={handleChange}
              />
            </div>
            <div className={styles.inputGroup}>
              <input
                type="email"
                name="email"
                placeholder="Email address"
                className={styles.input}
                value={user.email}
                onChange={handleChange}
              />
            </div>
            <div className={styles.inputGroup}>
              <input
                type="password"
                name="password"
                placeholder="Password"
                className={styles.input}
                value={user.password}
                onChange={handleChange}
              />
            </div>
            <div className={styles.inputGroup}>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm password"
                className={styles.input}
                value={user.confirmPassword}
                onChange={handleChange}
              />
            </div>

            <button type="submit" className={styles.primaryButton}>
              🚀 Create Account
            </button>
          </form>

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
