import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';
import SyncButton from './SyncButton';

const heroSeals = [
  {
    title: 'Proveedor autorizado de Meta',
    icon: 'logos:meta-icon',
  },
  {
    title: 'Proveedor autorizado de Sura',
    image: 'https://www.sura.co/documents/1771353/0/Logo-SURA-blanco+1.svg/8937a328-d03b-7aa7-79bd-a5308a3931b3?version=1.0&t=1704405886717',
  },
  ];

const Hero = () => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden min-h-screen flex flex-col bg-[#000000]">
      <style>{`
        @keyframes hero-aurora-1 {
          0%, 100% { transform: translate3d(-8%, -6%, 0) scale(1); }
          33% { transform: translate3d(6%, 4%, 0) scale(1.08); }
          66% { transform: translate3d(-4%, 8%, 0) scale(0.96); }
        }
        @keyframes hero-aurora-2 {
          0%, 100% { transform: translate3d(6%, 10%, 0) scale(1); }
          50% { transform: translate3d(-10%, -4%, 0) scale(1.12); }
        }
        @keyframes hero-aurora-3 {
          0%, 100% { transform: translate3d(10%, -4%, 0) scale(0.95); }
          50% { transform: translate3d(-6%, 6%, 0) scale(1.1); }
        }
        @keyframes hero-grid-drift {
          0% { background-position: 0 0; }
          100% { background-position: 60px 60px; }
        }
      `}</style>

      {/* Deep-space base + aurora blobs */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ scale: bgScale, opacity: bgOpacity }}
      >
        {/* Aurora blob 1 — top-left purple */}
        <div
          className="absolute"
          style={{
            top: '-20%', left: '-15%', width: '75%', height: '85%',
            background: 'radial-gradient(closest-side, rgba(87,60,255,0.95), rgba(87,60,255,0.35) 45%, transparent 70%)',
            filter: 'blur(70px)',
            animation: 'hero-aurora-1 22s ease-in-out infinite',
          }}
        />
        {/* Aurora blob 2 — right orange */}
        <div
          className="absolute"
          style={{
            top: '5%', right: '-20%', width: '80%', height: '90%',
            background: 'radial-gradient(closest-side, rgba(249,115,22,0.75), rgba(251,146,60,0.3) 45%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'hero-aurora-2 26s ease-in-out infinite',
          }}
        />
        {/* Aurora blob 3 — center-bottom violet */}
        <div
          className="absolute"
          style={{
            bottom: '-25%', left: '15%', width: '70%', height: '75%',
            background: 'radial-gradient(closest-side, rgba(167,139,250,0.75), rgba(167,139,250,0.3) 45%, transparent 70%)',
            filter: 'blur(90px)',
            animation: 'hero-aurora-3 30s ease-in-out infinite',
          }}
        />
        {/* Top-right magenta accent */}
        <div
          className="absolute"
          style={{
            top: '-10%', right: '10%', width: '50%', height: '60%',
            background: 'radial-gradient(closest-side, rgba(123,97,255,0.7), transparent 70%)',
            filter: 'blur(65px)',
            animation: 'hero-aurora-1 28s ease-in-out infinite reverse',
          }}
        />
        {/* Extra purple core behind text for punch */}
        <div
          className="absolute"
          style={{
            top: '25%', left: '25%', width: '50%', height: '50%',
            background: 'radial-gradient(closest-side, rgba(87,60,255,0.45), transparent 75%)',
            filter: 'blur(60px)',
            animation: 'hero-aurora-2 20s ease-in-out infinite',
          }}
        />
      </motion.div>

      {/* Futuristic grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.12]"
        style={{
          backgroundImage: 'linear-gradient(rgba(167,139,250,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.35) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          animation: 'hero-grid-drift 18s linear infinite',
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)',
        }}
      />

      {/* Light vignette — darken only edges, keep center colors saturated */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Grain noise overlay — always-on, normal blend so it stays visible over colors */}
      <div
        className="pointer-events-none absolute inset-0 z-[4]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.55,
          mixBlendMode: 'overlay',
        }}
      />
      {/* Second noise layer — finer grain, always visible */}
      <div
        className="pointer-events-none absolute inset-0 z-[4]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n2)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '140px 140px',
          opacity: 0.22,
        }}
      />

      {/* ===== Content ===== */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-[990px] mx-auto px-4 sm:px-6 lg:px-8 pt-32 sm:pt-40 pb-20 sm:pb-28 text-center">
        {/* Giant title — white, bold, tight tracking like Creatify */}
        <motion.h1
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-[2rem] sm:text-[3rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-white leading-[1.05] tracking-[-0.03em] mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
        >
          Toda tu agencia de seguros operando desde un solo lugar
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-[1.1rem] sm:text-[1.5rem] md:text-[1.75rem] lg:text-[2rem] font-bold text-white/50 max-w-[750px] mx-auto mb-3 leading-[1.15] tracking-[-0.01em]"
        >
          Pólizas, clientes, cotizaciones, renovaciones y expedición sincronizadas con tus aseguradoras en tiempo real.
        </motion.p>

        {/* Italic note */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-sm text-white/40 italic mb-12"
        >
          Guro es el canal que conecta tu operación con el mercado.
        </motion.p>

        {/* CTA Button — black with purple icon that expands on hover */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center mb-8"
        >
          <SyncButton href="/comenzar" size="lg">
            Crear tu agencia
          </SyncButton>
        </motion.div>

        {/* Provider seals — oculto si solo queda 1 sello (para no verse desbalanceado) */}
        {heroSeals.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.6 }}
          className="mt-12 sm:mt-14 w-full"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/30 mb-5">
            Respaldado por
          </p>
          <div className="flex flex-nowrap items-center justify-center gap-x-3 sm:gap-x-8 md:gap-x-14">
            {heroSeals.map((seal, i) => (
              <motion.div
                key={seal.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -3, transition: { duration: 0.25 } }}
                className="flex items-center gap-2 sm:gap-3 md:gap-4 group flex-shrink-0"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg sm:rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm flex items-center justify-center p-1.5 sm:p-2.5 group-hover:border-[#A78BFA]/40 group-hover:bg-white/[0.08] transition-all duration-300 flex-shrink-0">
                  {seal.image ? (
                    <img
                      src={seal.image}
                      alt={seal.title}
                      className={`max-w-full max-h-full object-contain ${seal.invert ? 'brightness-0 invert opacity-80' : ''}`}
                      loading="lazy"
                    />
                  ) : (
                    <Icon icon={seal.icon!} className="w-full h-full" />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-[9px] md:text-[10px] uppercase tracking-[0.15em] md:tracking-[0.2em] text-white/40 leading-tight mb-0.5">
                    {seal.title.includes('Proveedor') ? 'Proveedor autorizado' : 'Miembros'}
                  </p>
                  <p className="text-[13px] md:text-[16px] font-semibold text-white/90 leading-tight whitespace-nowrap">
                    {seal.title.replace('Proveedor autorizado de ', '').replace('Miembros de ', '')}
                  </p>
                </div>
                {i < heroSeals.length - 1 && (
                  <span className="hidden md:block h-10 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent ml-6" />
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
        )}
      </div>

      {/* Bottom fade into dark next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 z-[6] bg-gradient-to-t from-black to-transparent" />
    </section>
  );
};

export default Hero;
