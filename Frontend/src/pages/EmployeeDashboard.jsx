import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './EmployeeDashboard.module.css';

const EmployeeDashboard = () => {
  const navigate = useNavigate();

  // Auth check: redirect to login if not authenticated
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('http://localhost:4000/api/user/data', { method: 'GET', credentials: 'include' });
        const json = await res.json();
        if (!mounted) return;
        if (!json || !json.success || !json.userData) {
          try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) {}
          try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) {}
          navigate('/login');
        }
      } catch (err) {
        try { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); } catch (e) {}
        try { localStorage.removeItem('user'); localStorage.removeItem('token'); } catch (e) {}
        navigate('/login');
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  const handleStartTimer = () => {
    if (!isTimerRunning) {
      setIsTimerRunning(true);
      const id = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
      setIntervalId(id);
    }
  };

  const handleStopTimer = () => {
    if (isTimerRunning) {
      setIsTimerRunning(false);
      clearInterval(intervalId);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.leftContainer}>
        <h2>Left Container</h2>
        <p>Content for the left container...</p>
      </div>

      <div className={styles.middleContainer}>
        <header className={styles.header}>
          <h1 className={styles.title}>Employee Dashboard</h1>
        </header>

        <div className={styles.timerContainer}>
          <h2 className={styles.timer}>{formatTime(timer)}</h2>
          <div className={styles.timerButtons}>
            <button
              className={styles.startButton}
              onClick={handleStartTimer}
              disabled={isTimerRunning}
            >
              Start Timer
            </button>
            <button
              className={styles.stopButton}
              onClick={handleStopTimer}
              disabled={!isTimerRunning}
            >
              Stop Timer
            </button>
          </div>
        </div>
      </div>

      <div className={styles.rightContainer}>
        <h2>Right Container</h2>
        <p>Content for the right container...</p>
      </div>
    </div>
  );
};

export default EmployeeDashboard;