import React from 'react';
import { FiPlayCircle, FiBarChart2, FiFileText } from 'react-icons/fi';

const steps = [
  { icon: <FiPlayCircle className="h-10 w-10 text-[#18d4d1]" />, title: '1. Start Your Timer' },
  { icon: <FiBarChart2 className="h-10 w-10 text-[#18d4d1]" />, title: '2. Visualize Your Day' },
  { icon: <FiFileText className="h-10 w-10 text-[#18d4d1]" />, title: '3. Generate Reports' },
];

function HowItWorks() {
  return (
    <div className="bg-[#1b1b1b] py-20 sm:py-28">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white">Get started in 3 simple steps</h2>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((step) => (
            <div key={step.title} className="bg-[#2c2c2c] p-8 rounded-xl shadow-lg border border-[#3a3a3a] text-center">
              <div className="flex items-center justify-center h-20 w-20 rounded-full bg-[#3a3a3a] mx-auto mb-6">
                {step.icon}
              </div>
              <h3 className="text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-base text-gray-300">A short description of this simple step goes here.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HowItWorks;