import React from 'react';
import styles from './DashboardPage.module.css';

const DashboardPage = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoPlaceholder}> {/* Placeholder for logo */}
          <p>LOGO</p>
        </div>
        <h1>Hourglass Dashboard</h1>
      </header>
      <main className={styles.main}>
        <section className={styles.profileSection}> {/* Profile Section */}
          <h2>Profile</h2>
          <p>Manage your personal information and preferences.</p>
        </section>
        <section className={styles.settingsSection}> {/* Settings Section */}
          <h2>Settings</h2>
          <p>Adjust your account and application settings.</p>
        </section>
        <section className={styles.timeTrackingSection}> {/* Time Tracking Section */}
          <h2>Time Tracking</h2>
          <p>Track your time efficiently with AI recommendations.</p>
        </section>
        <div className={styles.taskPlaceholder}> {/* Placeholder for tracked tasks */}
          <h3>Tracked Tasks</h3>
          <p>No tasks tracked yet. Start tracking now!</p>
        </div>
      </main>
      <button className={styles.logoutButton}>Log Out</button>
    </div>
  );
};

export default DashboardPage;