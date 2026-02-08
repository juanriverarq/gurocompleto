import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-28 relative overflow-hidden bg-[#fafafa]">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#635BFF]/5 border border-[#635BFF]/15 text-[#635BFF] rounded-full text-sm font-medium mb-8">
            <Icon icon="solar:rocket-bold" className="w-4 h-4" />
            Comienza hoy mismo
          </span>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1a1a2e] mb-6 leading-tight tracking-tight">
            Empieza a transformar
            <br />
            <span className="bg-gradient-to-r from-[#635BFF] via-[#49A5FF] to-[#16CDC7] bg-clip-text text-transparent">
              tu agencia hoy
            </span>
          </h2>

          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-12 font-light">
            Únete a más de 500 agencias que ya gestionan sus seguros con el poder de la IA.
            Prueba gratis por 7 días, sin tarjeta de crédito.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <motion.a
              href="/comenzar"
              className="group px-8 py-4 bg-gradient-to-r from-[#635BFF] to-[#16CDC7] text-white font-semibold rounded-full shadow-2xl shadow-[#635BFF]/25 hover:shadow-[#635BFF]/40 transition-all"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="flex items-center gap-2">
                Comenzar prueba gratis
                <Icon icon="solar:arrow-right-linear" className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.a>
            <motion.a
              href="/contacto"
              className="group px-8 py-4 text-gray-700 hover:text-gray-900 font-medium rounded-full border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all flex items-center gap-2"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon icon="solar:calendar-bold" className="w-5 h-5 text-[#635BFF]" />
              Agendar demo personalizada
            </motion.a>
          </div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6"
          >
            {['Sin tarjeta de crédito', 'Configuración en minutos', 'Soporte incluido', 'Cancela cuando quieras'].map((text) => (
              <div key={text} className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-gray-500">{text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
