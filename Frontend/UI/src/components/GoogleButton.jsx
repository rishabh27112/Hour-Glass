import React from 'react'
import { FcGoogle } from 'react-icons/fc';
const GoogleButton = () => {
    return (
        <button
            className="w-full py-[9px] px-4 rounded-lg bg-[#2f2e2e] text-white font-semibold 
                     flex items-center justify-center gap-3 transition-all hover:bg-[#3b3b3b]"
        >
            <FcGoogle className="" />
            Sign in with Google
        </button>
    )
}

export default GoogleButton