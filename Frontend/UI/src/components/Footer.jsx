import React from 'react';

function Footer() {
  return (
    <div className="bg-[#2c2c2c] border-t border-[#3a3a3a] py-16">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Column 1 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 uppercase">Product</h4>
            <a href="#" className="block text-gray-300 hover:text-[#18d4d1]">Features</a>
            <a href="#" className="block text-gray-300 hover:text-[#18d4d1]">Pricing</a>
          </div>
          
          {/* Column 2 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 uppercase">Company</h4>
            <a href="#" className="block text-gray-300 hover:text-[#18d4d1]">About Us</a>
            <a href="#" className="block text-gray-300 hover:text-[#18d4a1]">Blog</a>
          </div>
          
          {/* Column 3 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 uppercase">Resources</h4>
            <a href="#" className="block text-gray-300 hover:text-[#18d4d1]">Support</a>
            <a href="#" className="block text-gray-300 hover:text-[#18d4d1]">Guides</a>
          </div>
          
          {/* Column 4 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 uppercase">Legal</h4>
            <a href="#" className="block text-gray-300 hover:text-[#18d4d1]">Privacy</a>
            <a href="#" className="block text-gray-300 hover:text-[#18d4d1]">Terms</a>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-[#3a3a3a] text-center text-gray-500">
          © {new Date().getFullYear()} TrackMe, Inc. All rights reserved.
        </div>
      </div>
    </div>
  );
}

export default Footer;