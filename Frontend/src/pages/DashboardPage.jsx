import React, { useState } from 'react';
import styles from './DashboardPage.module.css';

const stats = [
  {
    icon: <span className={styles.statIconBg} style={{background: 'linear-gradient(135deg,#ffecd2 0%,#fcb69f 100%)'}}>⏰</span>,
    title: 'Total Hours',
    value: 42
  },
  {
    icon: <span className={styles.statIconBg} style={{background: 'linear-gradient(135deg,#d4fc79 0%,#96e6a1 100%)'}}>📅</span>,
    title: 'Active Days',
    value: 15
  },
  {
    icon: <span className={styles.statIconBg} style={{background: 'linear-gradient(135deg,#a1c4fd 0%,#c2e9fb 100%)'}}>✅</span>,
    title: 'Tasks Completed',
    value: 8
  }
];

const DashboardPage = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className={styles.dashboardBg}>
      <div className={styles.dashboardCard}>
        <div className={styles.logoSection}>
          <div className={styles.logo}>⏰</div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Your productivity at a glance</p>
        </div>

        <nav className={styles.navbar}>
         
          <a href="#dashboard" className={styles.navLinkActive}>Dashboard</a>
          <a href="#report" className={styles.navLink}>Report</a>
          <a href="#calendar" className={styles.navLink}>Calendar</a>
          <a href="#projects" className={styles.navLink}>Projects</a>
           <div className={styles.profileDropdown} onClick={toggleDropdown}>
            <span className={styles.profileName}>Profile</span>
            {isDropdownOpen && (
              <ul className={styles.dropdownMenu}>
                <li><a href="#settings">Settings</a></li>
                <li><a href="#logout">Logout</a></li>
              </ul>
            )}
          </div>
        </nav>

        <section className={styles.statsSection}>
          {stats.map((stat, idx) => (
            <div className={styles.statCard} key={stat.title}>
              {stat.icon}
              <div className={styles.statTitle}>{stat.title}</div>
              <div className={styles.statValue}>{stat.value}</div>
            </div>
          ))}
        </section>

        <section className={styles.insightsSection}>
          <h2>Insights</h2>
          <div className={styles.chartsContainer}>
            <div className={styles.chartPlaceholder}>
              <span className={styles.chartIcon}>📊</span>
              <span>Pie Chart</span>
            </div>
            <div className={styles.chartPlaceholder}>
              <span className={styles.chartIcon}>📈</span>
              <span>Graph</span>
            </div>
          </div>
        </section>

        <section className={styles.appsSection}>
          <h2>Most Used Apps</h2>
          <ul className={styles.appsList}>
            <li><span className={styles.appIcon} style={{background: '#e0e7ff', color: '#6c63ff'}}>Slack</span></li>
            <li><span className={styles.appIcon} style={{background: '#ffe0e7', color: '#ff6f91'}}>VS Code</span></li>
            <li><span className={styles.appIcon} style={{background: '#e0fff4', color: '#00b894'}}>Chrome</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
