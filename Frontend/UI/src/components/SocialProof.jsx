import React from 'react';
import { SiGoogle, SiAmazon, SiStripe, SiNetflix, SiShopify } from 'react-icons/si';

const logos = [
  { icon: <SiGoogle />, name: 'Google' },
  { icon: <SiAmazon />, name: 'Amazon' },
  { icon: <SiStripe />, name: 'Stripe' },
  { icon: <SiNetflix />, name: 'Netflix' },
  { icon: <SiShopify />, name: 'Shopify' },
];

function SocialProof() {
  return (
    <div className="bg-[#2c2c2c] py-16 sm:py-24">
      <div className="container mx-auto px-6">
        <h3 className="text-center text-lg font-semibold text-gray-400">
          Trusted by the most innovative teams
        </h3>
        
        <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-5 items-center">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex justify-center text-gray-500 transition duration-300 hover:text-gray-200"
            >
              <span className="sr-only">{logo.name}</span>
              <div className="h-10 w-10" aria-hidden="true">
                {React.cloneElement(logo.icon, { className: 'h-full w-full text-5xl' })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SocialProof;