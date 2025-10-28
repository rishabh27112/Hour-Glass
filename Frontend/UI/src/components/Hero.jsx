import React from 'react';
import 'remixicon/fonts/remixicon.css'

function Hero() {
    return (
        <div className="relative overflow-hidden pt-12 pb-24 md:pt-24 md:pb-48 bg-[#1b1b1b]">

            {/* Subtle background glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-2/3 bg-[#18d4d1] opacity-5 blur-3xl rounded-full" aria-hidden="true" />

            <div className="container mx-auto px-6 text-center relative z-10">
                {/* Main Headline */}
                <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight max-w-4xl mx-auto">
                    Streamline Your Workday with <span className="text-[#18d4d1]">Effortless Time Tracking</span>
                </h1>

                {/* Sub-headline */}
                <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
                    Track, manage, and optimize your team's time with our intuitive platform.
                </p>

                <div className="mt-12">
                    <button className="w-full sm:w-auto bg-[#18d4d1] text-[#131212] font-bold spac py-3 px-5 rounded-xl hover:bg-[#14a3a1] transition-colors duration-200 tracking-light">
                        <div className='flex items-center gap-2'>
                            <span className='text-xl'> Start tracking for free</span>
                            <span className=''>
                                <i class="ri-arrow-right-line text-xl bg-white rounded-2xl p-1 hover:bg-gray-300"></i>
                            </span>
                        </div>
                    </button>
                </div>

                {/* Dashboard Image Placeholder */}
                <div className="mt-20 md:mt-32 relative">
                    <div className="bg-[#2c2c2c] p-8 rounded-2xl shadow-2xl border border-[#3a3a3a]">
                        <p className="text-gray-400">
                            <span className="font-bold text-[#18d4d1]">Placeholder for your dashboard screenshot.</span>
                        </p>
                        {/* <img src="/path/to/your/dashboard-screenshot.png" alt="TrackMe Dashboard" className="w-full h-auto rounded-xl" /> */}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Hero;