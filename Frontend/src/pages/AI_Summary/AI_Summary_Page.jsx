import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './AI_Summary_Page.module.css';

const AISummaryPage = () => {
  const { projectId, memberId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [memberName, setMemberName] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const [billableHours, setBillableHours] = useState(0);
  const [ratePerHour, setRatePerHour] = useState(0);
  const [brainstormTotal, setBrainstormTotal] = useState(0);
  const [appsAvg, setAppsAvg] = useState([]);

  const formatHours = (h) => {
    const totalMinutes = Math.round((Number(h) || 0) * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return `${hh} h ${mm} m`;
  };

  useEffect(() => {
    setMemberName(decodeURIComponent(memberId || ''));
    (async () => {
      setLoading(true);
      setFetchError('');
      const name = decodeURIComponent(memberId || '');
      try {
        const res = await fetch('/api/time-entries/hours-per-day', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, memberUsername: name })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFetchError(data && data.error ? data.error : `Server returned ${res.status}`);
          setHoursPerDay([]);
        } else {
          const arr = Array.isArray(data.data) ? data.data : [];
          setHoursPerDay(arr);
          const total = arr.reduce((s, d) => s + (Number(d.hours) || 0), 0);
          setBillableHours(Math.round(total * 100) / 100);
        }
      } catch (err) {
        setFetchError(String(err));
        setHoursPerDay([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [memberId, projectId]);

  if (loading) return <div className={styles.container}>Loading...</div>;

  return (
    <div className={styles.container}>
      <button onClick={() => navigate(-1)} className={styles.backButton}>← Back to Project</button>
      <h1 className={styles.title}>✨ AI Summary for {memberName}</h1>
      {fetchError && <div style={{ color: 'red', marginBottom: 12 }}>{fetchError}</div>}

      <div className={styles.sections}>
        <section className={styles.section}>
          <h2>Hours per day (histogram)</h2>
          {(() => {
            const dataToShow = hoursPerDay.length === 0 ? (() => {
              const arr = [];
              const now = new Date();
              for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                arr.push({ date: key, hours: Math.round((Math.random() * 6) * 100) / 100 });
              }
              return arr;
            })() : hoursPerDay;

            const maxH = Math.max(...dataToShow.map((d) => d.hours));
            return (
              <div style={{ display: 'flex', gap: 12, alignItems: 'end', padding: '12px 6px', overflowX: 'auto' }}>
                {dataToShow.map((d) => (
                  <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}>
                    <div title={`${d.hours} hours`} style={{ width: 28, height: `${(d.hours / (maxH || 1)) * 160}px`, background: 'linear-gradient(180deg,#667eea,#764ba2)', borderRadius: 6 }} />
                    <div style={{ fontSize: 11, marginTop: 6, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.date.slice(5)}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>

        <section className={styles.section}>
          <div className={styles.summaryRow}>
            <div className={styles.summaryBox}>
              <div className={styles.summaryLabel}>Total hours</div>
              <div className={styles.summaryValue}>{Math.round((hoursPerDay.reduce((s, d) => s + (Number(d.hours) || 0), 0)) * 100) / 100}</div>
            </div>
            <div className={styles.summaryBox}>
              <div className={styles.summaryLabel}>Billable hours</div>
              <input type="number" min="0" step="0.01" value={billableHours} onChange={(e) => setBillableHours(Number(e.target.value || 0))} className={styles.inputSmall} />
            </div>
          </div>

          <div className={styles.paymentBox}>
            <div style={{ marginBottom: 8 }}><strong>Rate per hour (INR)</strong></div>
            <input type="number" min="0" step="0.01" value={ratePerHour} onChange={(e) => setRatePerHour(Number(e.target.value || 0))} className={styles.inputMedium} />
            <div style={{ marginTop: 12 }}><strong>Total payment:</strong> ₹{Math.round((billableHours * ratePerHour) * 100) / 100}</div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Average Hours Per Day</h2>
          <div className={styles.summaryRow}>
            <div className={styles.summaryBox}>
              <div className={styles.summaryLabel}>Total (avg/day)</div>
              <div className={styles.summaryValue}>{(() => {
                const days = Math.max(1, hoursPerDay.length || 1);
                const total = hoursPerDay.reduce((s, d) => s + (Number(d.hours) || 0), 0);
                return Math.round((total / days) * 100) / 100;
              })()}</div>
            </div>
            <div className={styles.summaryBox}>
              <div className={styles.summaryLabel}>Billable (avg/day)</div>
              <div className={styles.summaryValue}>{(() => {
                const days = Math.max(1, hoursPerDay.length || 1);
                return Math.round(((billableHours || 0) / days) * 100) / 100;
              })()}</div>
            </div>
            <div className={styles.summaryBox}>
              <div className={styles.summaryLabel}>Non-billable (avg/day)</div>
              <div className={styles.summaryValue}>{(() => {
                const days = Math.max(1, hoursPerDay.length || 1);
                const total = hoursPerDay.reduce((s, d) => s + (Number(d.hours) || 0), 0);
                const non = Math.max(0, total - (billableHours || 0));
                return Math.round((non / days) * 100) / 100;
              })()}</div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Brainstorming</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className={styles.summaryBox} style={{ minWidth: 220 }}>
              <div className={styles.summaryLabel}>Total brainstorm hours</div>
              <input type="number" className={styles.inputSmall} value={brainstormTotal} onChange={(e) => setBrainstormTotal(Number(e.target.value || 0))} />
              <div style={{ marginTop: 8 }}><strong>Avg/day:</strong> {(() => {
                const days = Math.max(1, hoursPerDay.length || 1);
                return Math.round(((brainstormTotal || 0) / days) * 100) / 100;
              })()}</div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Avg time per application</h2>
          <div style={{ marginTop: 8 }}>
            <button className={styles.cta} onClick={() => {
              const input = globalThis.prompt('Paste app JSON array (e.g. [{"app":"YouTube","hours":3.58}])');
              if (!input) return;
              try {
                const parsed = JSON.parse(input || '[]');
                if (Array.isArray(parsed)) {
                  setAppsAvg(parsed.map(p => ({ app: p.app || p.name || 'unknown', hours: Math.round((Number(p.hours) || 0) * 100) / 100 })));
                } else setAppsAvg([]);
              } catch (err) { console.warn('Invalid app JSON', err); setAppsAvg([]); alert('Invalid JSON'); }
            }}>Load</button>
          </div>
          <div style={{ marginTop: 12 }}>
            {appsAvg.length === 0 ? (
              <div className={styles.italic}>No app-level data loaded.</div>
            ) : (
              <div className={styles.appTable}>
                {appsAvg.map((a) => (
                  <div className={styles.appRow} key={a.app}>
                    <div className={styles.appName}>{a.app}</div>
                    <div className={styles.appAvg}>{formatHours(a.hours)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};

export default AISummaryPage;
