// src/components/MainButton.jsx
import React from 'react';

const MainButton = (props) => {
  return (
    <button
      type={props.type || 'submit'} // 1. Added type prop (defaults to "submit")
      disabled={props.disabled}    // 2. Added disabled prop
      onClick={props.onClick}      // 3. Added onClick prop
      className="
        group cursor-pointer
        relative overflow-hidden 
        w-full bg-[#18d4d1] text-[#131212] font-bold py-2 px-5 rounded-lg
        tracking-light transition-all duration-300 ease-in-out 
        hover:translate-y-0.5
        disabled:opacity-50 disabled:cursor-not-allowed /* 4. Added disabled styles */
      "
    >
      <span className="
          absolute inset-0 
          -translate-x-full 
          -skew-x-12 
          bg-gradient-to-r from-transparent via-white/50 to-transparent
          transition-transform duration-500 ease-in-out
          group-hover:translate-x-full 
      ">
      </span>
      <span className="relative z-10">
        {props.txt}
      </span>
    </button>
  );
}

export default MainButton;