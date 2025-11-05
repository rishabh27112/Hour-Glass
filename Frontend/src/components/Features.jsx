import React, { useState } from 'react';
import { FiClock, FiDollarSign, FiBarChart2 } from 'react-icons/fi';

const featuresData = [
  { id: 'tracking', title: 'Effortless Time Tracking', icon: <FiClock />, description: 'One-click start/stop timers. Track time from your browser, desktop, or mobile.' },
  { id: 'billing', title: 'Project Billing', icon: <FiDollarSign />, description: 'Set billable rates and see at a glance how much you\'ve earned.' },
  { id: 'reporting', title: 'Powerful Reporting', icon: <FiBarChart2 />, description: 'See where your time is going. Filter and break down your data by project, client, or task.' },
];

function Features() {
  const [activeTab, setActiveTab] = useState(featuresData[0].id);
  const activeFeature = featuresData.find(f => f.id === activeTab);

  return (
    <div className="py-20 sm:py-28 bg-[#1b1b1b]">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white">All your time, in one place</h2>
          <p className="mt-4 text-lg text-gray-300">One tool to track, manage, and report on your team's time.</p>
        </div>

        {/* --- CHANGE IS ON THIS LINE --- */}
        <div className="mt-12 flex flex-wrap justify-center border-b border-[#3a3a3a] space-x-4 pb-2">
          {featuresData.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 px-1 font-semibold text-lg
                ${activeTab === tab.id
                  ? 'text-[#18d4d1] border-b-2 border-[#18d4d1]'
                  : 'text-gray-400 hover:text-gray-200'
                }
              `}
            >
              {tab.icon}
              <span>{tab.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="text-left">
            <h3 className="text-2xl font-bold text-white mb-4">{activeFeature.title}</h3>
            <p className="text-lg text-gray-300">{activeFeature.description}</p>
            <a href="#" className="mt-6 inline-block text-[#18d4d1] font-semibold hover:text-[#a6f2f0]">
              Learn more &rarr;
            </a>
          </div>

          <div className="bg-[#2c2c2c] p-4 rounded-lg shadow-2xl border border-[#3a3a3a]">
            <div className="w-full h-80 bg-[#3a3a3a] rounded flex items-center justify-center">
              <p className="text-gray-400">Image for: {activeFeature.title}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Features;