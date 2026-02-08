import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const Teams = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const teams = [
    { icon: 'solar:users-group-two-rounded-bold-duotone', title: 'Ventas', description: 'Automatiza seguimiento de leads y cierra más pólizas.', color: '#635BFF' },
    { icon: 'solar:shield-check-bold-duotone', title: 'Operaciones', description: 'Gestiona pólizas, siniestros y renovaciones sin esfuerzo.', color: '#16CDC7' },
    { icon: 'solar:chart-square-bold-duotone', title: 'Dirección', description: 'Dashboards en tiempo real y reportes ejecutivos.', color: '#FF6692' },
    { icon: 'solar:cpu-bolt-bold-duotone', title: 'Soporte', description: 'Chatbot IA que atiende clientes 24/7 por WhatsApp.', color: '#49A5FF' },
  ];

  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-[#1a1a2e] leading-[1.1] tracking-[-0.02em] mb-4">
            Cómo Guro ayuda a equipos reales{' '}
            <span className="inline-flex items-center align-middle">
              <span className="inline-flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-[#635BFF] border-2 border-white" />
                <div className="w-8 h-8 rounded-full bg-[#16CDC7] border-2 border-white" />
              </span>
            </span>
          </h2>
        </motion.div>

        {/* Team cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {teams.map((team, index) => (
            <motion.div
              key={team.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
              className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all cursor-pointer"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: `${team.color}15` }}
              >
                <Icon icon={team.icon} className="w-6 h-6" style={{ color: team.color }} />
              </div>
              <h3 className="text-lg font-bold text-[#1a1a2e] mb-2">{team.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{team.description}</p>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: team.color }}>
                <span>Ver más</span>
                <Icon icon="solar:arrow-right-linear" className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Teams;
