// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainButton from '../components/MainButton';
import Logo from '../components/Logo';
import { FcGoogle } from 'react-icons/fc';
import LoginBg from '../assets/login-bg.png';
import GoogleButton from '../components/GoogleButton';

const LoginPage = () => {
  // --- All backend logic is injected here ---
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await response.json();
      if (data.success) {
        const storage = rememberMe ? localStorage : sessionStorage;
        if (data.token) storage.setItem('token', data.token);
        if (data.user) storage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Login error');
    }
    setLoading(false);
  };
  // --- End of injected logic ---

  return (
    <div
      style={{ backgroundImage: `url(${LoginBg})` }}
      className="tracking-wide flex items-center justify-center min-h-screen bg-cover bg-center relative px-4"

    >
      <div className="absolute inset-0 bg-black opacity-70"></div>

      <div
        className="
          w-full max-w-md 
          p-6 space-y-4 
          relative z-10
          backdrop-blur-sm
        "
      >

        <div className="text-center">
          <Logo />
          <h2 className="mt-3 text-2xl font-bold text-white">
            Sign in to Hour Glass
          </h2>
        </div>



        <GoogleButton />

        {/* Divider */}
        <div className="flex items-center justify-center my-3">
          <span className="w-full border-t border-[#3a3a3a]"></span>
          <span className="px-4 text-gray-400 bg-transparent text-sm z-10 relative">or</span>
          <span className="w-full border-t border-[#3a3a3a]"></span>
        </div>

        {/* Form (Wired up with onSubmit) */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-lg font-medium text-gray-300">
              Email address
            </label>
            <div className="mt-1">
              <input
                type="text" // Changed to 'text' for email or username
                required
                className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium tracking-wide"
                placeholder="Email or username"
                value={identifier} // Logic injected
                onChange={e => setIdentifier(e.target.value)} // Logic injected
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-lg font-medium text-gray-300">
              Password
            </label>
            <div className="mt-1">
              <input
                type="password"
                required
                className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium tracking-wide"
                placeholder="••••••••"
                value={password} // Logic injected
                onChange={e => setPassword(e.target.value)} // Logic injected
              />
            </div>
          </div>

          {/* Remember Me & Forgot Password (from his logic, styled like your page) */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded bg-[#3a3a3a] border-[#18d4d1] text-[#18d4d1] focus:ring-[#18d4d1]"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-lg font-medium underline decoration-[#18d4d1] text-gray-200 hover:text-[#18d4d1] hover:decoration-gray-200">
              Forgot your password ?
            </Link>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="text-center text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Your MainButton, now with loading logic */}
          <div>
            <MainButton
              txt={loading ? 'Signing in...' : 'Sign In'}
              disabled={loading}
            />
          </div>
        </form>

        {/* Sign Up Link */}
        <div className="text-center text-gray-400 text-lg">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium underline decoration-[#18d4d1] text-gray-200 hover:text-[#18d4d1] hover:decoration-gray-200">
            Sign up for free
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;