import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const Hero = () => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden min-h-screen flex flex-col">
      {/* ===== Background image — parallax zoom on scroll ===== */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          scale: bgScale,
          opacity: bgOpacity,
        }}
      />

      {/* Grain noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[5] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.18,
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
          style={{ fontFamily: "'General Sans', sans-serif" }}
        >
          Gestiona tu agencia de seguros con el poder de la IA
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-[1.1rem] sm:text-[1.5rem] md:text-[1.75rem] lg:text-[2rem] font-bold text-white/50 max-w-[750px] mx-auto mb-3 leading-[1.15] tracking-[-0.01em]"
        >
          Automatiza pólizas, siniestros, renovaciones y ventas.{' '}
          Todo en una plataforma inteligente diseñada para agentes de seguros.
        </motion.p>

        {/* Italic note */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-sm text-white/40 italic mb-12"
        >
          (sí, es realmente así de simple)
        </motion.p>

        {/* CTA Button — black with purple icon that expands on hover */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center mb-8"
        >
          <a
            href="/comenzar"
            className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[56px] shadow-2xl shadow-black/30 overflow-hidden"
          >
            {/* Purple bg that expands from left on hover */}
            <span className="absolute inset-y-0 left-0 w-[56px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
            {/* Icon — always visible */}
            <span className="relative z-10 flex items-center justify-center w-[56px] h-full flex-shrink-0">
              <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-white" />
            </span>
            {/* Text — fades out on hover */}
            <span className="relative z-10 pl-2 pr-6 text-[11px] sm:text-xs font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
              Crea tu primer agencia gratis
            </span>
          </a>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-white/50"
        >
          <div className="flex items-center gap-1.5">
            <Icon icon="solar:clock-circle-bold" className="w-4 h-4 text-white/50" />
            <span>7 días gratis — sin tarjeta de crédito</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon icon="solar:star-bold" className="w-4 h-4 text-white/50" />
            <span>4.9 de 5 en Google</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom fade to white for next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 z-[6] bg-gradient-to-t from-white to-transparent" />
    </section>
  );
};

export default Hero;
