import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const ProblemSolution = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const problems = [
    { icon: 'solar:document-text-linear', text: 'Hojas de Excel interminables' },
    { icon: 'solar:clock-circle-linear', text: 'Procesos manuales que consumen tiempo' },
    { icon: 'solar:bell-off-linear', text: 'Renovaciones perdidas por olvido' },
    { icon: 'solar:chat-unread-linear', text: 'Clientes sin seguimiento adecuado' },
  ];

  const solutions = [
    { icon: 'solar:database-bold-duotone', text: 'Todo centralizado en la nube' },
    { icon: 'solar:cpu-bolt-bold-duotone', text: 'Automatización inteligente con IA' },
    { icon: 'solar:bell-bing-bold-duotone', text: 'Alertas automáticas de vencimientos' },
    { icon: 'solar:chat-round-dots-bold-duotone', text: 'CRM integrado con WhatsApp' },
  ];

  return (
    <section ref={ref} className="py-28 bg-white relative overflow-hidden">
      {/* Grain */}
      {/* Top divider */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Problem Side */}
          <motion.div
            initial={{ opacity: 0, x: -40, filter: 'blur(8px)' }}
            animate={isInView ? { opacity: 1, x: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-500 rounded-full text-sm font-medium mb-6">
              <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
              El problema
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a2e] mb-6 leading-tight">
              ¿Cansado de hojas de Excel, procesos manuales y{' '}
              <span className="text-red-500">perder renovaciones</span>?
            </h2>

            <p className="text-gray-500 text-lg mb-8 font-light">
              La mayoría de agencias de seguros pierden hasta el 30% de sus renovaciones
              por falta de seguimiento y procesos desorganizados.
            </p>

            <div className="space-y-3">
              {problems.map((problem, index) => (
                <motion.div
                  key={problem.text}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.2 + index * 0.08 }}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-red-200 transition-colors"
                >
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon icon={problem.icon} className="w-5 h-5 text-red-500" />
                  </div>
                  <span className="text-gray-700 font-medium">{problem.text}</span>
                  <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-red-300 ml-auto flex-shrink-0" />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Solution Side */}
          <motion.div
            initial={{ opacity: 0, x: 40, filter: 'blur(8px)' }}
            animate={isInView ? { opacity: 1, x: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full text-sm font-medium mb-6">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
              La solución
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a2e] mb-6 leading-tight">
              Guro centraliza toda tu operación en una plataforma que{' '}
              <span className="bg-gradient-to-r from-[#635BFF] via-[#49A5FF] to-[#16CDC7] bg-clip-text text-transparent">
                trabaja 24/7 por ti
              </span>
            </h2>

            <p className="text-gray-500 text-lg mb-8 font-light">
              Una plataforma inteligente que automatiza el trabajo repetitivo y te permite
              enfocarte en lo que realmente importa: vender y atender a tus clientes.
            </p>

            <div className="space-y-3">
              {solutions.map((solution, index) => (
                <motion.div
                  key={solution.text}
                  initial={{ opacity: 0, x: 20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.35 + index * 0.08 }}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-[#635BFF]/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-[#635BFF] to-[#16CDC7] rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#635BFF]/20">
                    <Icon icon={solution.icon} className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-gray-700 font-medium">{solution.text}</span>
                  <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-emerald-500 ml-auto flex-shrink-0" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;
