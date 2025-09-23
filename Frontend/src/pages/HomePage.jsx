import React from 'react';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

const HomePage = () => 
{
  return (
    <div className={styles.homeContainer}>
      <header className={styles.homeHeader}>
        <h1>Welcome to Hour-Glass</h1>
        <p>Your ultimate time tracking solution</p>
      </header>

      <main className={styles.homeMain}>
        <section className={styles.authSection}>
          <h2>Get Started</h2>
          <div className={styles.loginContainer}>
            <Link to="/login" className={styles.button}>Login</Link>
          </div>
          <div className={styles.signupContainer}>
            <Link to="/signup" className={styles.button}>Sign Up</Link>
          </div>
        </section>

        <section className={styles.detailsSection}>
          <h2>About Hour-Glass</h2>
          <p>Hour-Glass helps you track your time, manage tasks, and boost productivity. Whether you're working on projects, managing a team, or simply tracking your daily activities, Hour-Glass has got you covered.</p>
        </section>
      </main>

      <footer className={styles.homeFooter}>
        <p>&copy; 2025 Hour-Glass. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;