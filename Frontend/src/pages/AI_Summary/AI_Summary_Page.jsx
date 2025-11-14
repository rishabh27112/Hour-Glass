// src/pages/AI_Summary_Page.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';

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

  // --- All Logic is 100% Preserved ---
  const formatHours = (h) => {
    const totalMinutes = Math.round((Number(h) || 0) * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return `${hh} h ${mm} m`;
  };

  useEffect(() => {
    setMemberName(decodeURIComponent(memberId || ''));
    let mounted = true; // Define mounted here
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
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId, projectId]);
  // --- End of Preserved Logic ---


  // --- Loading State ---
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-brand-bg text-gray-200">
      <p>Loading...</p>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-brand-bg text-gray-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center justify-center gap-2 border border-cyan text-cyan font-semibold py-2 px-5 rounded-lg hover:bg-cyan hover:text-brand-bg transition-all duration-300 w-auto"
          >
            <RiArrowLeftLine className="text-xl transition-transform duration-300 group-hover:-translate-x-1" />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold text-center  text-white ">
            ✨ AI Summary for {memberName}
          </h1>
          <div className="w-28"></div> {/* Spacer to balance header */}
        </div>

        {/* Error Message */}
        {fetchError && (
          <div className="flex-shrink-0 bg-red-800/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4">
            {fetchError}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
          
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6 lg:overflow-y-auto pb-4 pr-2">
            
            {/* Histogram Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Hours per day</h2>
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

                const maxH = Math.max(1, ...dataToShow.map((d) => d.hours)); // Ensure maxH is at least 1
                return (
                  <div className="bg-surface-light p-4 rounded-lg">
                    <div className="flex gap-3 items-end p-3 overflow-x-auto min-h-[240px]">
                      {dataToShow.map((d) => (
                        <div key={d.date} className="flex flex-col items-center flex-shrink-0 w-10">
                          <div className="text-xs font-medium text-cyan mb-1">{d.hours.toFixed(1)}</div>
                          <div 
                            title={`${d.hours.toFixed(2)} hours`} 
                            style={{ height: `${(d.hours / maxH) * 160}px` }}
                            // === MODIFICATION: Changed gradient to teal for better contrast ===
                            className="w-7 bg-gradient-to-t from-teal-400 to-teal-600 rounded-md"
                          />
                          <div className="text-xs text-gray-400 mt-2 transform -rotate-45 whitespace-nowrap">{d.date.slice(5)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* App Averages Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Avg time per application</h2>
              <div className="mt-4">
                <button 
                  className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors text-sm"
                  onClick={() => {
                    const input = globalThis.prompt('Paste app JSON array (e.g. [{"app":"YouTube","hours":3.58}])');
                    if (!input) return;
                    try {
                      const parsed = JSON.parse(input || '[]');
                      if (Array.isArray(parsed)) {
                        setAppsAvg(parsed.map(p => ({ app: p.app || p.name || 'unknown', hours: Math.round((Number(p.hours) || 0) * 100) / 100 })));
                      } else setAppsAvg([]);
                    } catch (err) { console.warn('Invalid app JSON', err); setAppsAvg([]); alert('Invalid JSON'); }
                  }}>
                  Load App Data
                </button>
              </div>
              <div className="mt-4">
                {appsAvg.length === 0 ? (
                  <div className="text-gray-500 italic">No app-level data loaded.</div>
                ) : (
                  <table className="w-full">
                    <tbody>
                      {appsAvg.map((a) => (
                        <tr key={a.app} className="border-b border-surface-light">
                          <td className="py-2 text-gray-200">{a.app}</td>
                          <td className="py-2 text-cyan font-semibold text-right">{formatHours(a.hours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-6 lg:overflow-y-auto pb-4 pr-2">
            
            {/* Summary & Payment Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Total hours</div>
                  <div className="text-2xl font-bold text-white">{Math.round((hoursPerDay.reduce((s, d) => s + (Number(d.hours) || 0), 0)) * 100) / 100}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Billable hours</div>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={billableHours} 
                    onChange={(e) => setBillableHours(Number(e.target.value || 0))} 
                    className="w-full bg-surface text-gray-200 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface mt-1"
                  />
                </div>
              </div>

              <div className="bg-surface-light p-4 rounded-lg">
                <div className="mb-2 font-semibold text-gray-300">Rate per hour (INR)</div>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={ratePerHour} 
                  onChange={(e) => setRatePerHour(Number(e.target.value || 0))} 
                  className="w-full bg-surface text-gray-200 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface"
                />
                <div className="mt-4 text-xl font-bold text-white">
                  Total payment: <span className="text-cyan">₹{Math.round((billableHours * ratePerHour) * 100) / 100}</span>
                </div>
              </div>
            </section>

            {/* Averages Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Average Hours Per Day</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Total</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    const days = Math.max(1, hoursPerDay.length || 1);
                    const total = hoursPerDay.reduce((s, d) => s + (Number(d.hours) || 0), 0);
                    return Math.round((total / days) * 100) / 100;
                  })()}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Billable</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    const days = Math.max(1, hoursPerDay.length || 1);
                    return Math.round(((billableHours || 0) / days) * 100) / 100;
                  })()}</div>
                </div>
                <div className="bg-surface-light p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-400">Non-billable</div>
                  <div className="text-2xl font-bold text-white">{(() => {
                    const days = Math.max(1, hoursPerDay.length || 1);
                    const total = hoursPerDay.reduce((s, d) => s + (Number(d.hours) || 0), 0);
                    const non = Math.max(0, total - (billableHours || 0));
                    return Math.round((non / days) * 100) / 100;
                  })()}</div>
                </div>
              </div>
            </section>

            {/* Brainstorming Section */}
            <section className="bg-surface rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Brainstorming</h2>
              <div className="bg-surface-light p-4 rounded-lg">
                <div className="text-sm font-semibold text-gray-400">Total brainstorm hours</div>
                <input 
                  type="number" 
                  min="0"
                  className="w-full bg-surface text-gray-200 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan border border-surface mt-1" 
                  value={brainstormTotal} 
                  onChange={(e) => setBrainstormTotal(Number(e.target.value || 0))} 
                />
                <div className="mt-3 text-gray-300">
                  <strong>Avg/day:</strong> {(() => {
                    const days = Math.max(1, hoursPerDay.length || 1);
                    return Math.round(((brainstormTotal || 0) / days) * 100) / 100;
                  })()}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISummaryPage;