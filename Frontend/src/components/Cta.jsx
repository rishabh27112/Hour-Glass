import React from 'react';

function Cta() {
  return (
    <div className="bg-[#1b1b1b] py-20 sm:py-28">
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white max-w-2xl mx-auto">
          Start tracking your time for <span className="text-[#18d4d1]">free</span>
        </h2>
        <p className="mt-6 text-lg text-gray-300 max-w-xl mx-auto">
          Join over 5 million users. No credit card required.
        </p>
        <a
          href="/signup"
          className="mt-10 inline-block bg-[#18d4d1] text-[#1b1b1b] font-bold py-4 px-10 text-lg rounded-lg shadow-lg hover:bg-[#a6f2f0] transition duration-300"
        >
          Start Your Free Trial
        </a>
      </div>
    </div>
  );
}

export default Cta;