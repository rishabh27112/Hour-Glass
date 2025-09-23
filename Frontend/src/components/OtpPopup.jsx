import React from 'react';

const OtpPopup = ({ open, otp, setOtp, onSubmit, onClose, error, success, extra }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 8, minWidth: 320, boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>
        <h2 style={{marginBottom: 16}}>Enter OTP</h2>
        <input
          type="text"
          value={otp}
          onChange={e => setOtp(e.target.value)}
          maxLength={6}
          style={{ fontSize: 20, letterSpacing: 8, textAlign: 'center', width: '100%', padding: 8, marginBottom: 16 }}
          placeholder="6-digit OTP"
        />
        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 8 }}>{success}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onSubmit} style={{ flex: 1, background: '#007bff', color: '#fff', border: 'none', padding: 10, borderRadius: 4, fontWeight: 600 }}>Verify</button>
          <button onClick={onClose} style={{ flex: 1, background: '#eee', color: '#333', border: 'none', padding: 10, borderRadius: 4 }}>Cancel</button>
        </div>
        {extra}
      </div>
    </div>
  );
};

export default OtpPopup;
