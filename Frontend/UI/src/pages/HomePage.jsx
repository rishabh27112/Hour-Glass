// src/App.jsx
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import SocialProof from '../components/SocialProof';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import Testimonials from '../components/Testimonials';
import Cta from '../components/Cta';
import Footer from '../components/Footer';

function HomePage() {
    return (
        <div className="antialiased">
            <Navbar />
            <Hero />
            <SocialProof />
            <Features />
            <HowItWorks />
            <Testimonials />
            <Cta />
            <Footer />
        </div>
    );
}

export default HomePage;