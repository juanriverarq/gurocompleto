import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const AISection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const aiFeatures = [
    { icon: 'solar:cpu-bolt-bold-duotone', title: 'Asistente IA 24/7', description: 'Chatbot inteligente para ventas y soporte automático que nunca duerme.', stat: '1,000', statLabel: 'conversaciones/mes' },
    { icon: 'solar:phone-calling-rounded-bold-duotone', title: 'Call Center con IA', description: 'Agentes de voz para llamadas entrantes y salientes con IA avanzada.', stat: '60', statLabel: 'minutos incluidos/mes' },
    { icon: 'solar:document-text-bold-duotone', title: 'Lector PDF con IA', description: 'Extrae datos de pólizas y documentos automáticamente.', stat: '100', statLabel: 'documentos/mes' },
    { icon: 'solar:chart-square-bold-duotone', title: 'Predicciones IA', description: 'Anticipa renovaciones y detecta riesgo de fuga de clientes.', stat: '95%', statLabel: 'precisión' },
    { icon: 'solar:graph-up-bold-duotone', title: 'Ventas Cruzadas IA', description: 'Recomendaciones automáticas de productos para cada cliente.', stat: '+45%', statLabel: 'conversión' },
  ];

  return (
    <section ref={ref} id="ia" className="py-28 relative overflow-hidden bg-white">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#635BFF]/5 border border-[#635BFF]/15 text-[#635BFF] rounded-full text-sm font-medium mb-6">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' as const }}>
              <Icon icon="solar:cpu-bolt-bold-duotone" className="w-4 h-4" />
            </motion.div>
            Potenciado por Inteligencia Artificial
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-[#1a1a2e] mb-6 tracking-tight">
            El poder de la IA
            <br />
            <span className="bg-gradient-to-r from-[#635BFF] via-[#49A5FF] to-[#16CDC7] bg-clip-text text-transparent">
              trabajando para ti
            </span>
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto font-light">
            Automatiza tareas repetitivas, predice comportamientos y ofrece una
            experiencia excepcional a tus clientes con nuestra IA avanzada.
          </p>
        </motion.div>

        {/* AI Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[#635BFF] to-[#16CDC7] opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500 blur-xl" />

              <div className="relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#635BFF]/30 shadow-sm hover:shadow-md transition-all h-full">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#635BFF] to-[#16CDC7] rounded-xl blur-lg opacity-40" />
                  <div className="relative w-14 h-14 bg-gradient-to-br from-[#635BFF] to-[#16CDC7] rounded-xl flex items-center justify-center shadow-lg shadow-[#635BFF]/30">
                    <Icon icon={feature.icon} className="w-7 h-7 text-white" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[#1a1a2e] mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{feature.description}</p>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-[#635BFF] to-[#16CDC7] bg-clip-text text-transparent">
                      {feature.stat}
                    </span>
                    <span className="text-xs text-gray-400">{feature.statLabel}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {[
            { value: '3x', label: 'Más rápido procesando leads' },
            { value: '80%', label: 'Menos tiempo en tareas manuales' },
            { value: '24/7', label: 'Disponibilidad del asistente' },
            { value: '+45%', label: 'Aumento en conversión' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl md:text-5xl font-bold text-[#1a1a2e] mb-2">
                {stat.value}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-center mt-16"
        >
          <motion.a
            href="/comenzar"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#635BFF] to-[#16CDC7] text-white font-semibold rounded-full shadow-2xl shadow-[#635BFF]/25 hover:shadow-[#635BFF]/40 transition-all"
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <Icon icon="solar:cpu-bolt-bold-duotone" className="w-5 h-5" />
            Probar la IA gratis
            <Icon icon="solar:arrow-right-linear" className="w-5 h-5" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};

export default AISection;
