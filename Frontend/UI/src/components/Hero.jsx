import React from 'react';
import 'remixicon/fonts/remixicon.css'
import { Link } from 'react-router-dom';
const Hero = () => {
    return (
        <div className="relative overflow-hidden pt-12 pb-24 md:pt-24 md:pb-48 bg-[#1b1b1b]">

            {/* Subtle background glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-2/3 bg-[#18d4d1] opacity-5 blur-3xl rounded-full" aria-hidden="true" />

            <div className="container mx-auto px-6 text-center relative z-10">
                {/* Main Headline */}
                <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight max-w-4xl mx-auto tracking-light">
                    Streamline Your Workday with <span className="text-[#18d4d1]">Effortless Time Tracking</span>
                </h1>

                {/* Sub-headline */}
                <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
                    Track, manage, and optimize your team's time with our intuitive platform.
                </p>
                <Link to='signin'>
                <div className="mt-12">
                    <button
                    
                        className="cursor-pointer group w-full sm:w-auto bg-[#18d4d1] text-[#131212] font-bold py-3 px-5 rounded-xl tracking-light
                        transition-all duration-300 ease-in-out
                        hover:bg-white
                        hover:translate-y-0.5
                        hover:shadow-lg hover:shadow-[#1b1b1b]/50"
                    >
                        <div className='flex items-center gap-2 '>
                            <span className='text-xl font-semibold tracking-wide'> Start tracking for free</span>
                            <span className=''>
                                <i class="ri-arrow-right-line text-xl bg-white rounded-2xl p-1.5 group-hover:bg-[#18d4d1]
                                 transition-all duration-300 ease-in-out
                                "></i>
                            </span>
                        </div>
                    </button>
                </div>
                </Link>

                {/* Dashboard Image Placeholder */}
                <div className="mt-20 md:mt-32 relative">
                    <div className="bg-[#2c2c2c] p-8 rounded-2xl shadow-2xl border border-[#3a3a3a]">
                        <p className="text-gray-400">
                            <span className="font-bold text-[#18d4d1]">Placeholder for dashboard screenshots.</span>
                        </p>
                        {/* <img src="/path/to/your/dashboard-screenshot.png" alt="TrackMe Dashboard" className="w-full h-auto rounded-xl" /> */}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Hero;