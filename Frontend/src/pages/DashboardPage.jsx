import React from 'react';
import styles from './DashboardPage.module.css';

const NewDashboardPage = () => {
  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div className={styles.logo}>HourGlass</div>
        <nav className={styles.navbar}>
          <a href="#dashboard" className={styles.navLink}>Dashboard</a>
          <a href="#report" className={styles.navLink}>Report</a>
          <a href="#calendar" className={styles.navLink}>Calendar</a>
          <a href="#projects" className={styles.navLink}>Projects</a>
          <div className={styles.profileMenu}>
            <span>Profile ▾</span>
            <div className={styles.dropdownMenu}>
              <a href="#settings" className={styles.dropdownItem}>Settings</a>
              <a href="#logout" className={styles.dropdownItem}>Logout</a>
            </div>
          </div>
        </nav>
      </header>
      <main className={styles.mainContent}>
        <section className={styles.statsSection}>
          <div className={styles.card}>
            <div className={styles.cardIcon}>⏰</div>
            <div>
              <div className={styles.cardTitle}>Total Hours</div>
              <div className={styles.cardValue}>42</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>📅</div>
            <div>
              <div className={styles.cardTitle}>Active Days</div>
              <div className={styles.cardValue}>15</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>✅</div>
            <div>
              <div className={styles.cardTitle}>Tasks Completed</div>
              <div className={styles.cardValue}>8</div>
            </div>
          </div>
        </section>
        <section className={styles.insightsSection}>
          <h2>Insights</h2>
          <div className={styles.chartsContainer}>
            <div className={styles.pieChart}>Pie Chart Placeholder</div>
            <div className={styles.graph}>Graph Placeholder</div>
          </div>
        </section>
        <section className={styles.appsSection}>
          <h2>Most Used Apps</h2>
          <ul className={styles.appsList}>
            <li>Slack</li>
            <li>VS Code</li>
            <li>Chrome</li>
          </ul>
        </section>
      </main>
    </div>
  );
};

export default NewDashboardPage;
