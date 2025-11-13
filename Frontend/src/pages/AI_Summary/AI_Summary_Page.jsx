import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './AI_Summary_Page.module.css';

const AISummaryPage = () => {
  const { projectId, memberId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [memberName, setMemberName] = useState('');

  useEffect(() => {
    // Decode member name from URL
    setMemberName(decodeURIComponent(memberId));
    setLoading(false);
  }, [memberId]);

  if (loading) {
    return <div className={styles.container}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <button onClick={() => navigate(-1)} className={styles.backButton}>
        ← Back to Project
      </button>
      
      <h1 className={styles.title}>✨ AI Summary for {memberName}</h1>
      
      <div className={styles.sections}>
        <section className={styles.section}>
          <h2>📊 Time Tracking Overview</h2>
          <p>Total hours logged, active vs idle time, peak productivity hours</p>
        </section>
        
        <section className={styles.section}>
          <h2>✅ Task Completion Metrics</h2>
          <p>Completed tasks, task velocity, overdue items</p>
        </section>
        
        <section className={styles.section}>
          <h2>📈 Productivity Insights</h2>
          <p>Most productive apps/activities, focus time analysis</p>
        </section>
        
        <section className={styles.section}>
          <h2>⏰ Work Patterns</h2>
          <p>Work hours distribution, break patterns, session lengths</p>
        </section>
        
        <section className={styles.section}>
          <h2>💡 AI Recommendations</h2>
          <p>Personalized suggestions for improving productivity</p>
        </section>
      </div>
    </div>
  );
};

export default AISummaryPage;