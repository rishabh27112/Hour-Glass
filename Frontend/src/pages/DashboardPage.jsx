
import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);
  const [user, setUser] = React.useState(null);
  const navigate = useNavigate();

  // Check authentication on mount
  // Check authentication on mount using cookie-based session on the server
  React.useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/auth/is-auth', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!mounted) return;
        if (!data.success) {
          navigate('/');
          return;
        }
        // Authenticated via cookie; fetch user data from server
        const userRes = await fetch('http://localhost:4000/api/user/data', {
          method: 'GET',
          credentials: 'include',
        });
        const userData = await userRes.json();
        if (!mounted) return;
        if (userData && userData.success && userData.user) {
          setUser(userData.user);
        } else if (userData && userData.user) {
          setUser(userData.user);
        } else {
          // Fallback: try reading from local/session storage
          const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
          const token = storage.getItem('token');
          const storedUser = storage.getItem('user');
          if (token && storedUser) {
            try { setUser(JSON.parse(storedUser)); } catch (err) { navigate('/'); }
          } else {
            navigate('/');
          }
        }
      } catch (err) {
        navigate('/');
      }
    };
    checkAuth();
    return () => { mounted = false; };
  }, [navigate]);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className={styles.dashboardBg}>
      <div className={styles.dashboardCard}>
        <div className={styles.profileSection}>
          <div className={styles.logoSection}>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subtitle}>Your productivity at a glance</p>
          </div>
          {user && (
            <div className={styles.profileName} style={{marginTop: 8, fontWeight: 'bold', fontSize: 18}}>
              Welcome, {user.name || user.fullName || 'User'}
            </div>
          )}
        </div>

        <div className={styles.navbarWithProfile}>
          <nav className={styles.navbar}>
            <a href="#dashboard" className={styles.navLinkActive}>Dashboard</a>
            <a href="#report" className={styles.navLink}>Report</a>
            <a href="#calendar" className={styles.navLink}>Calendar</a>
            <a href="#projects" className={styles.navLink}>Projects</a>
            <div
              className={styles.profileDropdownWrapper}
              ref={dropdownRef}
              tabIndex={0}
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}
              onClick={() => setDropdownOpen((open) => !open)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              <span className={styles.profileText}>{user ? (user.name || user.fullName || 'Profile') : 'Profile'}</span>
              {dropdownOpen && (
                <div className={styles.profileDropdownMenu}>
                  <button className={styles.profileDropdownItem} onClick={handleLogout}>Logout</button>
                <button className={styles.profileDropdownItem} disabled>Settings</button>
              </div>
            )}
          </div>
          </nav>
          
        </div>

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
