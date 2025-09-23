import React from 'react';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';
import logoIcon from '../Logo/main_logo.png';

const HomePage = () => {
  return (
    <div className={styles.pageContainer}>
      {/* Section 1: Navigation Bar */}
      <nav className={styles.navbar}>
        <div className={styles.navLogo}>
          <Link to="/">
            <i class="fa-solid fa-hourglass-half"></i>
            <span>HourGlass</span>
          </Link>
        </div>
        <div className={styles.navAuth}>
          <Link to="/login" className={styles.buttonSecondary}>Login</Link>
          <Link to="/signup" className={styles.buttonPrimary}>Sign Up</Link>
        </div>
      </nav>

      {/* Section 2: Hero Welcome Area */}
      <header className={styles.heroSection}>
        <h1>Welcome to HourGlass</h1>
        <p>Your ultimate time tracking solution</p>
        <div className={styles.heroButtons}>
          {/* Main call to action can be here */}
          <Link to="/signup" className={styles.buttonPrimary}>Get Started</Link>
        </div>
      </header>

      {/* Section 3: Main Content */}
      <main className={styles.mainContent}>
        <section className={styles.aboutSection}>
          <h2>About HourGlass</h2>
          <p>
            HourGlass helps you track your time, manage tasks, and boost productivity.
            Whether you're working on projects, managing a team, or simply tracking your daily activities,
            HourGlass has got you covered.
          </p>
        </section>
      </main>

      {/* Section 4: Footer */}
      <footer className={styles.footer}>
        <p>&copy; 2025 HourGlass. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;