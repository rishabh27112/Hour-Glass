// src/App.jsx
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';

function HomePage() {
  return (
    <div className="antialiased tracking-wide">
      <Navbar />
      <Hero />
      <HowItWorks />

    </div>
  );
}

export default HomePage;