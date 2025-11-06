// src/pages/ForgotPasswordPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import MainButton from '../components/MainButton';

const ForgotPasswordPage = () => {
    return (
        <div className=" tracking-wide flex items-center justify-center min-h-screen bg-[url('/login-bg.png')] bg-cover bg-center relative px-4">
            <div className="absolute inset-0 bg-black opacity-75"></div>

            <div
                className="
          w-100 max-w-md 
          p-6 space-y-4 
          relative z-10
           shadow-5xl 
          backdrop-blur-xs
         
        "
            >
                {/* Header */}
                <div className="text-center">
                    <i className="ri-mail-send-line text-[#18d4d1] text-6xl"></i>
                    <h2 className="mt-3 text-2xl font-bold text-white">
                        Reset your password
                    </h2>
                    <p className="mt-2 text-sm text-gray-300">
                        Enter your email and we'll send you a link to reset your password.
                    </p>
                </div>

                {/* Form */}
                <form className="space-y-4 pt-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-200 tracking-wide">
                            Email address
                        </label>
                        <div className="mt-1">
                            <input
                                type="email"
                                required
                                className="w-full bg-[#3a3a3a]/80 text-gray-200 placeholder-gray-400 py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18d4d1] border border-[#3a3a3a] font-medium"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <MainButton txt='Send Reset Link' />
                    </div>
                </form>

                {/* Back to Sign In Link */}
                <div className="text-center text-gray-400">
                    <Link to="/signin" className="font-medium underline decoration-[#18d4d1] text-gray-200 hover:text-[#18d4d1] hover:decoration-gray-200">
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;