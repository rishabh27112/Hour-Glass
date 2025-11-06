// src/pages/LoginPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import MainButton from '../components/MainButton';
import Logo from '../components/Logo';
import GoogleButton from '../components/GoogleButton';

const LoginPage = () => {
  return (
    <div className="tracking-wide flex items-center justify-center min-h-screen bg-[url('/login-bg.png')] bg-cover bg-center relative px-4">
      <div className="absolute inset-0 bg-black opacity-70"></div>

      <div
        className="
          w-full max-w-md 
          p-6 space-y-4 
          relative z-10
          backdrop-blur-xs
        "
      >
        {/* Header */}
        <div className="text-center">
          <Logo />
          <h2 className="mt-3 text-2xl font-bold text-white">
            Sign in to Hour Glass
          </h2>
        </div>

        {/* Social Login */}
        <GoogleButton />

        {/* Divider */}
        <div className="flex items-center justify-center my-3">
          <span className="w-full border-t border-[#3a3a3a]"></span>
          <span className="px-4 text-gray-400 bg-transparent text-sm z-10 relative">or</span>
          <span className="w-full border-t border-[#3a3a3a]"></span>
        </div>

        {/* Form */}
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Email address
            </label>
            <div className="mt-1">
              <input
                type="email"
                required
                className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium tracking-wide"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <div className="mt-1">
              <input
                type="password"
                required
                className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium tracking-wide"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <Link to="/forgot-password" className="font-medium underline decoration-[#18d4d1] text-gray-200 hover:text-[#18d4d1] hover:decoration-gray-200">
              Forgot your password ?
            </Link>
          </div>

          <div>
            <MainButton txt='Sign In' />
          </div>
        </form>

        {/* Sign Up Link */}
        <div className="text-center text-gray-400">
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