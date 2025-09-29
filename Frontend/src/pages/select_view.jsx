import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './select_view.module.css'; // Optional: Add styles in a CSS module

const SelectView = () => {
  const navigate = useNavigate();

  const handleEmployeeClick = () => {
    navigate('/employee-dashboard'); // Redirect to the Employee Dashboard
  };

  const handleManagerClick = () => {
    navigate('/ManagerDashboard'); // Redirect to the Manager Dashboard
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>How are you joining?</h1>
      <p className={styles.subtitle}>Please select your role to proceed:</p>
      <div className={styles.buttonContainer}>
        <button className={styles.button} onClick={handleEmployeeClick}>
          Join as Employee
        </button>
        <button className={styles.button} onClick={handleManagerClick}>
          Join as Project Manager
        </button>
      </div>
    </div>
  );
};

export default SelectView;