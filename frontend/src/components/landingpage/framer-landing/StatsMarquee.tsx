import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const stats = [
  { value: '+$500MM', label: 'En pólizas administradas desde Guro' },
  { value: '500+', label: 'Agencias en Latinoamérica' },
  { value: '1M+', label: 'Pólizas administradas' },
  { value: '3x', label: 'Más rápido procesando pólizas' },
  { value: '97%', label: 'Retención de clientes' },
  { value: '45%', label: 'Más conversión de leads' },
  { value: '90%', label: 'Menos tareas manuales' },
];

const StatsMarquee = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const doubled = [...stats, ...stats];

  return (
    <section ref={ref} className="py-14 sm:py-28 bg-transparent overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
        animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-12 sm:mb-16 px-4"
      >
        <h2
          className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white leading-[1.1] tracking-[-0.02em]"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
        >
          Más de <span className="landing-grad-text">500 agencias en Latinoamérica</span> ya operan con Guro
        </h2>
        <p className="mt-4 text-[1.1rem] sm:text-[1.35rem] font-bold text-white/40 max-w-2xl mx-auto leading-[1.2] tracking-[-0.01em]">
          Cifras que respaldan lo que hacemos cada día por las agencias de seguros.
        </p>
      </motion.div>

      {/* Stats marquee — horizontal infinite scroll */}
      <div className="relative">
        <motion.div
          className="flex gap-5 sm:gap-6"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { duration: 30, repeat: Infinity, ease: 'linear' } }}
          style={{ width: 'max-content' }}
        >
          {doubled.map((stat, i) => (
            <motion.div
              key={`${stat.value}-${i}`}
              className="flex-shrink-0 bg-white/5 border border-white/10 rounded-2xl px-8 sm:px-14 py-6 sm:py-10 text-center min-w-[160px] sm:min-w-[240px] hover:bg-[#573CFF]/10 hover:border-[#573CFF]/40 transition-all duration-300"
              whileHover={{ scale: 1.05, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="text-4xl sm:text-5xl font-bold text-[#573CFF] tracking-tight mb-1"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
              >
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-white/60 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default StatsMarquee;
