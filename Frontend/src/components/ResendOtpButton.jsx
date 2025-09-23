import React from 'react';

const ResendOtpButton = ({ onResend, disabled, loading }) => (
  <button
    onClick={onResend}
    disabled={disabled || loading}
    style={{
      marginTop: 12,
      background: '#f5f5f5',
      color: '#007bff',
      border: 'none',
      padding: '8px 16px',
      borderRadius: 4,
      fontWeight: 600,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled || loading ? 0.6 : 1
    }}
  >
    {loading ? 'Resending...' : 'Resend OTP'}
  </button>
);

export default ResendOtpButton;
