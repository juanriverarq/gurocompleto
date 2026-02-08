import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const stats = [
  { value: '3x', label: 'Más rápido procesando pólizas' },
  { value: '97%', label: 'Retención de clientes' },
  { value: '500+', label: 'Agencias activas' },
  { value: '1M+', label: 'Pólizas gestionadas' },
  { value: '45%', label: 'Más conversión de leads' },
  { value: '90%', label: 'Menos tareas manuales' },
];

const StatsMarquee = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const doubled = [...stats, ...stats];

  return (
    <section ref={ref} className="py-14 sm:py-28 bg-white overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
        animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-12 sm:mb-16 px-4"
      >
        <h2
          className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-[#0d0d0d] leading-[1.1] tracking-[-0.02em]"
          style={{ fontFamily: "'General Sans', sans-serif" }}
        >
          Resultados Reales
        </h2>
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
              className="flex-shrink-0 bg-[#f5f5f5] rounded-2xl px-8 sm:px-14 py-6 sm:py-10 text-center min-w-[160px] sm:min-w-[240px] hover:bg-[#573CFF]/5 transition-colors duration-300"
              whileHover={{ scale: 1.05, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="text-4xl sm:text-5xl font-bold text-[#573CFF] tracking-tight mb-1"
                style={{ fontFamily: "'General Sans', sans-serif" }}
              >
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default StatsMarquee;
