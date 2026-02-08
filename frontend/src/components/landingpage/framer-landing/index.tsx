import Navbar from './Navbar';
import Hero from './Hero';
import LogoStrip from './LogoStrip';
import Features from './Features';
import ToolsCarousel from './ToolsCarousel';
import StatsMarquee from './StatsMarquee';
import Results from './Results';
import Pricing from './Pricing';
import CTAGradient from './CTAGradient';
import Testimonials from './Testimonials';
import Footer from './Footer';

const FramerLanding = () => {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden" style={{ fontFamily: "'General Sans', sans-serif" }}>
      <Navbar />
      <Hero />
      <LogoStrip />
      <Features />
      <ToolsCarousel />
      <StatsMarquee />
      <Results />
      <Pricing />
      <CTAGradient />
      <div
        style={{
          backgroundImage: 'url(https://framerusercontent.com/images/hwuS8TidtTCFW9uCzecWzF4NiU.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          transform: 'scaleY(-1)',
        }}
      >
        <div style={{ transform: 'scaleY(-1)' }}>
          <Testimonials />
          <div className="h-0 sm:h-[50vh]" />
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default FramerLanding;
