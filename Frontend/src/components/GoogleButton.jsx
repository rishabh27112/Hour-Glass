// src/components/GoogleButton.jsx
import React from 'react';
import { FcGoogle } from 'react-icons/fc';
import API_BASE_URL from '../config/api';

const GoogleButton = () => {
  return (
    <a
      href={`${API_BASE_URL}/api/auth/google`}
      className="cursor-pointer w-full py-[9px] px-4 rounded-lg bg-[#2f2e2e] text-white font-semibold 
                 flex items-center justify-center gap-3 transition-all hover:bg-[#3b3b3b]"
    >
      <FcGoogle className="text-2xl" />
      <span>Sign up with Google</span> 
    </a>
  );
}

export default GoogleButton;