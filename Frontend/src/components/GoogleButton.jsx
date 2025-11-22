// src/components/GoogleButton.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import API_BASE_URL from '../config/api';

// Open OAuth in a popup and capture `auth_token` when backend redirects
// to the frontend (e.g. /dashboard?auth_token=...). Persist token and
// fetch `/api/user/data`, then store user and navigate to dashboard.
const GoogleButton = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogle = (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const url = `${API_BASE_URL}/api/auth/google`;
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2.5;
    const features = `popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;

    const popup = window.open(url, 'hg_google_oauth', features);
    if (!popup) {
      setLoading(false);
      alert('Could not open popup. Please allow popups for this site or try again.');
      return;
    }

    // Listen for message from popup when OAuth completes
    const handleMessage = async (event) => {
      // Verify message origin for security (must be same origin)
      const currentOrigin = window.location.origin;
      if (event.origin !== currentOrigin) {
        return;
      }

      if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.token) {
        const token = event.data.token;
        
        // Clean up
        window.removeEventListener('message', handleMessage);
        
        // Persist token
        try {
          localStorage.setItem('token', token);
          sessionStorage.setItem('token', token);
        } catch (e) {
          console.warn('Failed to store token', e);
        }

        // Fetch user data
        let userData = null;
        try {
          const res = await fetch(`${API_BASE_URL}/api/user/data`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json().catch(() => ({}));
          if (data && data.success && (data.user || data.userData)) {
            userData = data.user || data.userData;
            try { 
              localStorage.setItem('user', JSON.stringify(userData));
              sessionStorage.setItem('user', JSON.stringify(userData));
            } catch (e) {
              console.warn('Failed to store user data', e);
            }
          }
        } catch (e) {
          console.warn('Failed to fetch user after Google login', e);
        }

        setLoading(false);
        
        // Navigate to dashboard after storing user data
        navigate('/dashboard');
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback: Check if popup closed without completing auth
    const checkClosed = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setLoading(false);
        }
      } catch (e) {
        // Silently handle COOP errors
      }
    }, 1000);
  };

  return (
    <button
      onClick={handleGoogle}
      disabled={loading}
      className="cursor-pointer w-full py-[9px] px-4 rounded-lg bg-[#2f2e2e] text-white font-semibold 
                 flex items-center justify-center gap-3 transition-all hover:bg-[#3b3b3b] disabled:opacity-60"
    >
      <FcGoogle className="text-2xl" />
      <span>{loading ? 'Signing in...' : 'Sign up with Google'}</span>
    </button>
  );
};

export default GoogleButton;