// src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import 'remixicon/fonts/remixicon.css'
import Logo from './Logo';
function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#1b1b1b] border-b border-[#3a3a3a] ">
      <div className=" mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center space-x-2">
         <Logo/>
          <span className="text-white text-3xl font-bold  shadow-cyan-400">Hour Glass</span>
        </div>


        <div className="hidden md:flex items-center space-x-6">
          <Link to="/" className="text-gray-300 font-bold text-xl hover:text-[#18d4d1] px-3 py-1 rounded-md hover:bg-[#2c2c2c] transition-colors duration-200">Home</Link>
          <a href="#" className="text-gray-300 font-bold text-xl hover:text-[#18d4d1] px-3 py-1 rounded-md hover:bg-[#2c2c2c] transition-colors duration-200">About Us</a>
          <Link
            to="/signin"
            className="ml-4 border border-[#18d4d1] text-[#18d4d1] font-semibold text-xl py-2 px-5 rounded-lg 
                       hover:bg-[#18d4d1] hover:translate-y-0.5 hover:text-[#1b1b1b] transition-all duration-200"
          >
            Sign In
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center">
          <button onClick={() => setIsOpen(!isOpen)} className="text-gray-300 focus:outline-none">
            {isOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu (Matches the solid theme) */}
      {isOpen && (
        <div className="md:hidden bg-[#1b1b1b] absolute top-full left-0 w-full shadow-lg py-4 border-b border-[#3a3a3a]">
          <div className="flex flex-col items-center space-y-4">
            <a href="#" className="text-gray-300 hover:text-[#18d4d1]">Home</a>
            <a href="#" className="text-gray-300 hover:text-[#18d4d1]">About Us</a>
            <Link to="/signin"
              className="border border-[#18d4d1] text-[#18d4d1] font-semibold py-2 px-5 rounded-lg 
                         hover:bg-[#18d4d1] hover:text-[#1b1b1b] transition-all duration-300 w-fit"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;