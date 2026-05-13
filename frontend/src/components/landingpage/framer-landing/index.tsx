import Navbar from './Navbar';
import Hero from './Hero';
import Features from './Features';
import ToolsCarousel from './ToolsCarousel';
import StatsMarquee from './StatsMarquee';
import MediaSection from './MediaSection';
import Results from './Results';
import Pricing from './Pricing';
import CTAGradient from './CTAGradient';
import Footer from './Footer';

const FramerLanding = () => {
  return (
    <div className="dark min-h-screen bg-black overflow-x-hidden" data-theme="dark" style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif", colorScheme: 'dark' }}>
      <style>{`
        @keyframes landing-grad-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .landing-grad-text {
          background: linear-gradient(90deg, #573CFF 0%, #7B61FF 22%, #A78BFA 45%, #fb923c 70%, #f97316 88%, #573CFF 100%);
          background-size: 220% 220%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: landing-grad-flow 12s ease-in-out infinite;
        }
        @keyframes hero-sync-spin { to { transform: rotate(360deg); } }
        @keyframes hero-sync-core-pulse {
          0%, 100% { opacity: 0.75; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.12); }
        }
        .hero-sync-shell {
          position: relative;
          display: inline-flex;
          border-radius: 9999px;
          padding: 2px;
          overflow: hidden;
          flex-shrink: 0;
          filter: drop-shadow(0 0 14px rgba(87, 60, 255, 0.45));
          transition: filter 0.35s ease;
        }
        .hero-sync-shell:hover {
          filter: drop-shadow(0 0 22px rgba(87, 60, 255, 0.65)) drop-shadow(0 0 34px rgba(251, 146, 60, 0.3));
        }
        .hero-sync-spin-track {
          position: absolute;
          inset: -60%;
          background: conic-gradient(from 0deg, #573CFF, #7B61FF, #A78BFA, #fb923c, #f97316, #573CFF);
          animation: hero-sync-spin 3.8s linear infinite;
        }
        .hero-sync-shell:hover .hero-sync-spin-track { animation-duration: 2.2s; }
        .hero-sync-halo {
          position: absolute;
          inset: -45%;
          border-radius: 9999px;
          opacity: 0.35;
          transition: opacity 0.4s ease;
          background: conic-gradient(from 120deg, rgba(87, 60, 255, 0.95), rgba(251, 146, 60, 0.45), rgba(167, 139, 250, 0.85), rgba(87, 60, 255, 0.95));
          animation: hero-sync-spin 2.2s linear infinite reverse;
          filter: blur(16px);
          pointer-events: none;
        }
        .hero-sync-shell:hover .hero-sync-halo { opacity: 0.8; }
        .hero-sync-spark {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          opacity: 0.25;
          transition: opacity 0.35s ease;
          background: radial-gradient(circle at 50% 35%, rgba(255,255,255,0.4) 0%, transparent 42%);
          pointer-events: none;
          z-index: 2;
          animation: hero-sync-core-pulse 2s ease-in-out infinite;
        }
        .hero-sync-shell:hover .hero-sync-spark { opacity: 0.6; }
        .hero-sync-inner {
          position: relative;
          z-index: 3;
          border-radius: 9999px;
          border: none;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #fff;
          cursor: pointer;
          background: linear-gradient(180deg, #141414 0%, #000000 100%);
          transition: box-shadow 0.35s ease, background 0.35s ease;
          text-shadow: 0 1px 2px rgba(0,0,0,0.45);
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          text-decoration: none;
          white-space: nowrap;
        }
        .hero-sync-inner:hover {
          background:
            radial-gradient(ellipse 100% 80% at 50% 0%, rgba(87, 60, 255, 0.22) 0%, transparent 52%),
            linear-gradient(180deg, #1a1528 0%, #050508 100%);
          box-shadow:
            inset 0 0 28px rgba(123, 97, 255, 0.18),
            inset 0 -12px 32px rgba(251, 146, 60, 0.08),
            0 0 0 1px rgba(167, 139, 250, 0.12);
        }
        .landing-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 200px 200px;
          opacity: 0.18;
          mix-blend-mode: overlay;
          z-index: 1;
        }
        .landing-aurora-accent {
          position: absolute;
          pointer-events: none;
          border-radius: 9999px;
          filter: blur(90px);
          z-index: 0;
        }

        /* ── Optimización móvil (Safari iOS sufre con blur grande + animaciones infinitas) ── */
        @media (max-width: 768px) {
          .landing-grad-text {
            animation: none !important;
            background-position: 0% 50% !important;
          }
          .hero-sync-spin-track,
          .hero-sync-halo,
          .hero-sync-spark { animation: none !important; }
          .hero-sync-shell { filter: drop-shadow(0 0 10px rgba(87, 60, 255, 0.35)) !important; }
          .landing-noise { display: none !important; }
          .landing-aurora-accent {
            filter: blur(40px) !important;
            opacity: 0.6 !important;
          }
        }

        /* Respetar preferencia de reducción de movimiento (iOS y otros) */
        @media (prefers-reduced-motion: reduce) {
          .landing-grad-text,
          .hero-sync-spin-track,
          .hero-sync-halo,
          .hero-sync-spark { animation: none !important; }
        }
      `}</style>
      <Navbar />
      <Hero />
      <div className="relative">
        <div className="landing-aurora-accent" style={{ top: '5%', left: '-10%', width: '40%', height: '40%', background: 'radial-gradient(closest-side, rgba(87,60,255,0.35), transparent 70%)' }} />
        <div className="landing-aurora-accent" style={{ bottom: '-5%', right: '-10%', width: '45%', height: '45%', background: 'radial-gradient(closest-side, rgba(249,115,22,0.22), transparent 70%)' }} />
        <div className="landing-noise" />
        <div className="relative z-[2]">
          <Features />
          <ToolsCarousel />
        </div>
      </div>
      <div className="relative">
        <div className="landing-aurora-accent" style={{ top: '10%', right: '-10%', width: '45%', height: '50%', background: 'radial-gradient(closest-side, rgba(167,139,250,0.3), transparent 70%)' }} />
        <div className="landing-aurora-accent" style={{ bottom: '5%', left: '-10%', width: '40%', height: '45%', background: 'radial-gradient(closest-side, rgba(87,60,255,0.25), transparent 70%)' }} />
        <div className="landing-noise" />
        <div className="relative z-[2]">
          <StatsMarquee />
          <MediaSection />
          <Results />
        </div>
      </div>
      <div className="relative">
        <div className="landing-aurora-accent" style={{ top: '5%', left: '20%', width: '50%', height: '50%', background: 'radial-gradient(closest-side, rgba(123,97,255,0.28), transparent 70%)' }} />
        <div className="landing-aurora-accent" style={{ bottom: '10%', right: '-10%', width: '45%', height: '50%', background: 'radial-gradient(closest-side, rgba(249,115,22,0.22), transparent 70%)' }} />
        <div className="landing-noise" />
        <div className="relative z-[2]">
          <Pricing />
          <CTAGradient />
        </div>
      </div>
      <div className="relative">
        <div className="landing-aurora-accent" style={{ top: '15%', left: '10%', width: '55%', height: '55%', background: 'radial-gradient(closest-side, rgba(87,60,255,0.3), transparent 70%)' }} />
        <div className="landing-noise" />
        <div className="relative z-[2]">
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default FramerLanding;
