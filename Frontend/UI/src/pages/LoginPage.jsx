// src/pages/LoginPage.jsx
import React from 'react';
import { SiGoogle } from 'react-icons/si';
import { Link } from 'react-router-dom';

const LoginPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[url('/login-bg.png')] bg-cover bg-center relative px-4">

      <div className="absolute inset-0 bg-black opacity-70"></div>

      <div
        className="
          w-full max-w-md 
          p-6 space-y-4 
          bg-[#2c2c2c] rounded-2xl shadow-xl border border-[#3a3a3a]
          relative z-10
        "
      >
        {/* Header */}
        <div className="text-center">
          <i className="ri-hourglass-line text-[#18d4d1] text-5xl"></i>
          <h2 className="mt-3 text-2xl font-bold text-white ">
            Sign in to Hour Glass
          </h2>
        </div>

        {/* Social Login */}
        <button
          className="w-full py-2.5 px-4 rounded-lg bg-[#3a3a3a] text-white font-semibold 
                     flex items-center justify-center gap-3 transition-all hover:bg-[#4a4a4a]"
        >
          <SiGoogle />
          Sign in with Google
        </button>

        {/* Divider */}
        <div className="flex items-center justify-center my-3">
          <span className="w-full border-t border-[#3a3a3a]"></span>
          <span className="px-4 text-gray-400 bg-[#2c2c2c] -mt-3 text-sm">or</span>
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
                className="w-full bg-[#3a3a3a]  text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a]"
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
                className="w-full bg-[#3a3a3a] text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a]"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="text-sm text-right">
            <Link to="/forgot-password" className="font-medium underline decoration-[#18d4d1] text-gray-200 hover:text-[#18d4d1] hover:decoration-gray-200">
              Forgot your password ?
            </Link>
          </div>

          <div>
            <button
              type="submit"
              className="w-full bg-[#18d4d1] text-[#131212] font-bold py-2.5 px-5 rounded-lg
                         tracking-light transition-all duration-300 ease-in-out hover:bg-[#218784] hover:translate-y-0.5"
            >
              Sign In
            </button>
          </div>
        </form>

        {/* Sign Up Link */}
        <div className="text-center text-gray-400">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium underline decoration-[#18d4d1]  text-gray-200  hover:text-[#18d4d1] hover:decoration-gray-200">
            Sign up for free
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;