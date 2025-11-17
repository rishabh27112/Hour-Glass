// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // --- Simplified Logic: Only fetch user data ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('${API_BASE_URL}/api/user/data', { method: 'GET', credentials: 'include' });
        const json = await res.json();
        if (!mounted) return;
        if (!json || !json.success || !json.userData) {
          navigate('/signin'); // Matched to other pages
          return;
        }
        setUser(json.userData);
      } catch (err) {
        console.error('profile fetch error', err);
        navigate('/signin'); // Matched to other pages
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);
  // --- End of Simplified Logic ---

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-brand-bg text-gray-200">
      Loading...
    </div>
  );
  if (!user) return null;

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
          {/* === MODIFICATION: Changed to solid text-cyan === */}
          <h1 className="text-4xl font-bold text-white">
            Profile
          </h1>
          <div className="w-28"></div> {/* Spacer to balance header */}
        </div>

        {/* === MODIFICATION: Main content area now centers the single card === */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          
          {/* Center Column: Account Info */}
          <div className="bg-surface rounded-lg shadow-md p-8 w-full max-w-lg text-center">
            <h3 className="text-2xl font-semibold text-white mb-6">Account</h3>
            
            <dl className="space-y-4 text-left">
              <div className="flex">
                <dt className="w-32 font-semibold text-gray-400">Name</dt>
                <dd className="text-gray-200">{user.name || user.fullName || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 font-semibold text-gray-400">Username</dt>
                <dd className="text-gray-200">{user.username || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 font-semibold text-gray-400">Email</dt>
                <dd className="text-gray-200">{user.email || '-'}</dd>
              </div>
            </dl>

            <div className="mt-8">
              <button
                onClick={() => navigate('/forgot-password')}
                className="bg-cyan text-brand-bg font-bold py-2 px-4 rounded-lg shadow-lg hover:bg-cyan-dark transition-colors text-sm"
              >
                Change Password
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;