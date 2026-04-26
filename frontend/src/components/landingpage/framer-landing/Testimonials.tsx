import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const Testimonials = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const testimonials = [
    { name: 'Carlos Mendoza', role: 'Director Comercial', company: 'Seguros Alfa', quote: 'Guro transformó completamente nuestra operación. El asistente IA nos ayuda a procesar leads 3x más rápido.' },
    { name: 'María González', role: 'Gerente de Siniestros', company: 'AseguraTodo', quote: 'Reducimos los tiempos de procesamiento de siniestros de días a horas. Los reportes automáticos son una maravilla.' },
    { name: 'Roberto Silva', role: 'CEO', company: 'Protección Integral', quote: 'La personalización y flexibilidad superan cualquier otra solución del mercado. Guro es el futuro.' },
  ];

  return (
    <section ref={ref} id="testimonios" className="py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white leading-[1.1] tracking-[-0.02em] mb-4">
            <span className="landing-grad-text">Confían</span> en nosotros
          </h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Más de 500 agencias de seguros gestionan su operación diaria con Guro.
          </p>
        </motion.div>

        {/* Testimonial cards grid — 3 columns like Creatify */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-7 border border-white/15 hover:border-[#573CFF]/40 transition-colors duration-300"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Icon key={i} icon="solar:star-bold" className="w-4 h-4 text-yellow-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-white text-[15px] leading-relaxed mb-6">
                "{t.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#635BFF] to-[#16CDC7] flex items-center justify-center text-white font-bold text-sm">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  <div className="text-white/50 text-xs">{t.role} · {t.company}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
