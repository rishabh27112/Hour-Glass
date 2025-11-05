// src/components/GoogleButton.jsx
import React from 'react';
import { FcGoogle } from 'react-icons/fc';

const GoogleButton = () => {
  return (
    <a
      href="http://localhost:4000/api/auth/google" // 1. Changed to <a> tag with href
      className="cursor-pointer w-full py-[9px] px-4 rounded-lg bg-[#2f2e2e] text-white font-semibold 
                 flex items-center justify-center gap-3 transition-all hover:bg-[#3b3b3b]"
    >
      <FcGoogle className="text-2xl" />
      <span>Sign up with Google</span> {/* 2. Changed text to "Sign up" */}
    </a>
  );
}

export default GoogleButton;