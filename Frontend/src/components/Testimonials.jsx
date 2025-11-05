import React from 'react';

const quotes = [
  { quote: "This is the first time tracker our team has actually used.", author: 'Jane Doe', title: 'Project Manager, Tech Inc.' },
  { quote: "We were able to increase our billing accuracy by 25%.", author: 'John Smith', title: 'Founder, DesignCo' },
  { quote: "As a freelancer, this tool is my single source of truth.", author: 'Alex Johnson', title: 'Freelance Developer' },
];

function Testimonials() {
  return (
    <div className="py-20 sm:py-28 bg-[#2c2c2c]">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white">Don't just take our word for it</h2>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {quotes.map((item) => (
            <div
              key={item.author}
              className="bg-[#1b1b1b] p-8 rounded-xl shadow-lg border border-[#3a3a3a] flex flex-col"
            >
              <div className="grow">
                <p className="text-lg text-gray-300">"{item.quote}"</p>
              </div>
              <div className="mt-6 pt-6 border-t border-[#3a3a3a]">
                <p className="text-base font-semibold text-white">{item.author}</p>
                <p className="text-sm text-[#18d4d1]">{item.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Testimonials;