import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

import imgPolizas from 'src/assets/images/nuevapoliza.png';
import imgCartera from 'src/assets/images/renova.png';
import imgCallcenter from 'src/assets/images/Callcenter.png';
import imgWhatsapp from 'src/assets/images/tools/whatsapp.jpg';

const features = [
  {
    badge: 'GESTIONA',
    badgeIcon: 'solar:shield-check-bold',
    color: '#573CFF',
    title: 'Deja de perder clientes por falta de seguimiento',
    bullets: [
      'Toda la información de tus clientes, pólizas y siniestros en un solo clic',
      'Historial completo para cerrar más ventas y retener clientes',
      'Documentos organizados y accesibles sin buscar en carpetas',
    ],
    image: imgPolizas,
  },
  {
    badge: 'CARTERA',
    badgeIcon: 'solar:wallet-bold',
    color: '#573CFF',
    title: 'Recupera el dinero que pierdes cada mes en renovaciones olvidadas',
    bullets: [
      'Alertas automáticas antes de que venza una póliza — nunca más pierdas una renovación',
      'Control de cartera en tiempo real: quién pagó, quién debe y cuánto falta',
      'Comisiones liquidadas al instante sin errores manuales',
    ],
    image: imgCartera,
  },
  {
    badge: 'LLAMADAS IA',
    badgeIcon: 'solar:phone-calling-bold',
    color: '#573CFF',
    title: 'Tu equipo de cobro trabaja 24/7 — sin contratar a nadie más',
    bullets: [
      'Llamadas automáticas con IA que cobran, recuerdan y hacen seguimiento por ti',
      'Cada llamada transcrita y resumida — sabes exactamente qué pasó',
      'Solo escala a un humano cuando realmente se necesita',
    ],
    image: imgCallcenter,
  },
  {
    badge: 'CHATBOT',
    badgeIcon: 'solar:chat-round-dots-bold',
    color: '#573CFF',
    title: 'Automatiza cada conversación y convierte chats en ventas',
    bullets: [
      'Chatbots inteligentes que atienden, califican y hacen seguimiento sin intervención humana',
      'Venta cruzada automática: detecta oportunidades y sugiere productos al cliente correcto',
      'Campañas masivas por WhatsApp que reactivan cartera y generan cierres mientras duermes',
    ],
    image: imgWhatsapp,
  },
];

const FeatureBlock = ({ feat, index }: { feat: typeof features[0]; index: number }) => {
  const blockRef = useRef(null);
  const isBlockInView = useInView(blockRef, { once: true, margin: '-80px' });
  const isEven = index % 2 === 0;

  return (
    <motion.div
      ref={blockRef}
      initial={{ opacity: 0, y: 60 }}
      animate={isBlockInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-10 lg:gap-16`}
    >
      {/* Feature image with hover zoom */}
      <motion.div
        className="w-full lg:w-[55%] flex-shrink-0"
        initial={{ opacity: 0, x: isEven ? -40 : 40 }}
        animate={isBlockInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="relative bg-[#f5f5f5] rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-square border border-gray-100"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.4 }}
        >
          <img
            src={feat.image}
            alt={feat.title}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            loading="lazy"
          />
          {/* Subtle gradient overlay */}
          <div
            className="absolute inset-0 z-10"
            style={{
              background: isEven
                ? 'linear-gradient(135deg, rgba(87,60,255,0.06) 0%, transparent 60%)'
                : 'linear-gradient(225deg, rgba(87,60,255,0.06) 0%, transparent 60%)',
            }}
          />
        </motion.div>
      </motion.div>

      {/* Text content with staggered reveals */}
      <div className="w-full lg:w-[45%]">
        {/* Badge */}
        <motion.div
          className="flex items-center gap-2 mb-5"
          initial={{ opacity: 0, x: -20 }}
          animate={isBlockInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: feat.color }}
          >
            <Icon icon={feat.badgeIcon} className="w-3.5 h-3.5 text-white" />
          </div>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ color: feat.color }}
          >
            {feat.badge}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h3
          className="text-2xl sm:text-[1.75rem] lg:text-[2rem] font-bold text-[#0d0d0d] leading-[1.15] tracking-tight mb-6"
          style={{ fontFamily: "'General Sans', sans-serif" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isBlockInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {feat.title}
        </motion.h3>

        {/* Bullets — staggered */}
        <ul className="space-y-3">
          {feat.bullets.map((b, bi) => (
            <motion.li
              key={b}
              className="flex items-start gap-3 text-[15px] text-gray-600 leading-relaxed"
              initial={{ opacity: 0, x: -15 }}
              animate={isBlockInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.4 + bi * 0.1 }}
            >
              <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#0d0d0d]" />
              {b}
            </motion.li>
          ))}
        </ul>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isBlockInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-8"
        >
          <a
            href="/comenzar"
            className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[48px] overflow-hidden"
          >
            <span className="absolute inset-y-0 left-0 w-[48px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
            <span className="relative z-10 flex items-center justify-center w-[48px] h-full flex-shrink-0">
              <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-white" />
            </span>
            <span className="relative z-10 pl-2 pr-5 text-[10px] sm:text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
              Comienza gratis
            </span>
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
};

const Features = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} id="caracteristicas" className="py-20 sm:py-28 bg-white">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 sm:mb-24"
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-[#0d0d0d] leading-[1.1] tracking-[-0.02em] mb-4"
            style={{ fontFamily: "'General Sans', sans-serif" }}
          >
            ¿Cansado de hojas de Excel, procesos
            <span className="hidden sm:inline"><br /></span>{' '}
            manuales y perder renovaciones?
          </h2>
          <p className="text-[1.25rem] sm:text-[1.5rem] lg:text-[1.75rem] font-bold text-gray-400 max-w-2xl mx-auto leading-[1.2] tracking-[-0.01em]">
            Guro centraliza toda tu operación en una plataforma inteligente que trabaja 24/7 por ti.
          </p>
        </motion.div>

        {/* Feature blocks — alternating layout */}
        <div className="space-y-20 sm:space-y-32">
          {features.map((feat, index) => (
            <FeatureBlock key={feat.badge} feat={feat} index={index} />
          ))}
        </div>

        {/* Bottom CTA — like Creatify */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex justify-center mt-20 sm:mt-28"
        >
          <a
            href="/comenzar"
            className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[56px] shadow-2xl shadow-black/20 overflow-hidden"
          >
            <span className="absolute inset-y-0 left-0 w-[56px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
            <span className="relative z-10 flex items-center justify-center w-[56px] h-full flex-shrink-0">
              <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-white" />
            </span>
            <span className="relative z-10 pl-2 pr-6 text-[11px] sm:text-xs font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
              Crea tu primer agencia gratis
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
