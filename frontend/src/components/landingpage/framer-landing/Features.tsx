import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';
import SyncButton from './SyncButton';

type Variant = 'centraliza' | 'cotiza' | 'canal' | 'renueva';

const features: Array<{
  badge: string;
  badgeIcon: string;
  color: string;
  title: string;
  bullets: string[];
  variant: Variant;
}> = [
  {
    badge: 'CENTRALIZA',
    badgeIcon: 'solar:database-bold',
    color: '#573CFF',
    title: 'Pólizas y clientes en un solo repositorio vivo — no más Excels ni carpetas sueltas',
    bullets: [
      'Toda la cartera de clientes, pólizas y documentos en un único lugar accesible para tu equipo',
      'Historial completo por cliente: pólizas activas, vencidas, siniestros y pagos',
      'Tu agencia deja de depender de hojas de cálculo y archivos dispersos',
    ],
    variant: 'centraliza',
  },
  {
    badge: 'COTIZA Y EXPIDE',
    badgeIcon: 'solar:document-add-bold',
    color: '#573CFF',
    title: 'Cotiza, emite y expide directamente conectado con las aseguradoras',
    bullets: [
      'Cotizaciones en minutos desde Guro — sin abrir portales de cada compañía',
      'Expedición y emisión sincronizada con la aseguradora, sin recapturar datos',
      'Un solo flujo de venta para toda tu operación, desde la cotización hasta la póliza emitida',
    ],
    variant: 'cotiza',
  },
  {
    badge: 'CANAL ASEGURADORAS',
    badgeIcon: 'solar:link-bold',
    color: '#573CFF',
    title: 'El canal que conecta tu agencia con las compañías de seguros',
    bullets: [
      'Una sola integración para sincronizar pólizas, cartera y comisiones de todas tus aseguradoras',
      'Información unificada y actualizada en tiempo real — sin exportar, importar ni conciliar a mano',
      'Centralizas en Guro lo que hoy tienes repartido en 10 portales distintos',
    ],
    variant: 'canal',
  },
  {
    badge: 'RENUEVA Y RETIENE',
    badgeIcon: 'solar:refresh-bold',
    color: '#573CFF',
    title: 'Renovaciones, cartera y seguimiento automatizados sobre la misma base de datos',
    bullets: [
      'Alertas de vencimiento y renovación conectadas a la póliza real sincronizada con la aseguradora',
      'Cartera por cliente y por compañía en tiempo real: quién pagó, quién debe y cuánto falta',
      'WhatsApp, chatbot y llamadas IA que trabajan sobre la misma información centralizada',
    ],
    variant: 'renueva',
  },
];

const FeatureIllustration = ({ variant }: { variant: Variant }) => {
  const common = (
    <defs>
      <linearGradient id={`fg-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#573CFF" />
        <stop offset="50%" stopColor="#A78BFA" />
        <stop offset="100%" stopColor="#f97316" />
      </linearGradient>
      <linearGradient id={`fg-${variant}-soft`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(167,139,250,0.25)" />
        <stop offset="100%" stopColor="rgba(87,60,255,0.05)" />
      </linearGradient>
    </defs>
  );

  if (variant === 'centraliza') {
    return (
      <svg viewBox="0 0 400 400" className="w-full h-full">
        {common}
        <rect width="400" height="400" fill="#0a0a0f" />
        {[0, 1, 2, 3].map((i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.6 }}
          >
            <rect x={60} y={70 + i * 58} width={280} height={46} rx={12} fill={`url(#fg-${variant}-soft)`} stroke="rgba(167,139,250,0.22)" />
            <circle cx={85} cy={93 + i * 58} r={10} fill={`url(#fg-${variant})`} />
            <rect x={108} y={86 + i * 58} width={120} height={6} rx={3} fill="rgba(255,255,255,0.75)" />
            <rect x={108} y={98 + i * 58} width={70} height={5} rx={2.5} fill="rgba(255,255,255,0.35)" />
            <rect x={268} y={88 + i * 58} width={56} height={12} rx={6} fill="rgba(87,60,255,0.3)" stroke="rgba(167,139,250,0.4)" />
          </motion.g>
        ))}
        <motion.circle
          cx={340} cy={70} r={28}
          fill={`url(#fg-${variant})`}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <text x={340} y={76} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">4</text>
      </svg>
    );
  }

  if (variant === 'cotiza') {
    return (
      <svg viewBox="0 0 400 400" className="w-full h-full">
        {common}
        <rect width="400" height="400" fill="#0a0a0f" />
        <motion.g
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <rect x={80} y={55} width={240} height={310} rx={18} fill={`url(#fg-${variant}-soft)`} stroke="rgba(167,139,250,0.25)" />
          <rect x={100} y={80} width={140} height={10} rx={5} fill="rgba(255,255,255,0.85)" />
          <rect x={100} y={98} width={90} height={6} rx={3} fill="rgba(255,255,255,0.35)" />
          <line x1={100} y1={128} x2={300} y2={128} stroke="rgba(167,139,250,0.18)" />
          {[0, 1, 2, 3].map((i) => (
            <motion.g
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
            >
              <circle cx={115} cy={152 + i * 32} r={8} fill={`url(#fg-${variant})`} />
              <path d={`M ${111} ${152 + i * 32} l 3 3 l 6 -6`} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <rect x={134} y={146 + i * 32} width={150} height={6} rx={3} fill="rgba(255,255,255,0.6)" />
              <rect x={134} y={158 + i * 32} width={90} height={4} rx={2} fill="rgba(255,255,255,0.25)" />
            </motion.g>
          ))}
          <motion.rect
            x={110} y={300} width={180} height={38} rx={10}
            fill={`url(#fg-${variant})`}
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
          <text x={200} y={324} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" letterSpacing="1">EXPEDIR PÓLIZA</text>
        </motion.g>
      </svg>
    );
  }

  if (variant === 'canal') {
    const spokes = [
      { x: 80, y: 90 },
      { x: 320, y: 90 },
      { x: 60, y: 220 },
      { x: 340, y: 220 },
      { x: 140, y: 340 },
      { x: 260, y: 340 },
    ];
    return (
      <svg viewBox="0 0 400 400" className="w-full h-full">
        {common}
        <rect width="400" height="400" fill="#0a0a0f" />
        {spokes.map((s, i) => (
          <motion.line
            key={i}
            x1={200} y1={200} x2={s.x} y2={s.y}
            stroke={`url(#fg-${variant})`}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.8 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
          />
        ))}
        {spokes.map((s, i) => (
          <motion.g
            key={`node-${i}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
          >
            <circle cx={s.x} cy={s.y} r={24} fill="rgba(10,10,15,1)" stroke="rgba(167,139,250,0.4)" strokeWidth={1.5} />
            <circle cx={s.x} cy={s.y} r={8} fill={`url(#fg-${variant})`} />
          </motion.g>
        ))}
        <motion.g
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '200px 200px' }}
        >
          <circle cx={200} cy={200} r={58} fill="rgba(87,60,255,0.12)" stroke={`url(#fg-${variant})`} strokeWidth={1.5} />
          <circle cx={200} cy={200} r={38} fill={`url(#fg-${variant})`} />
          <text x={200} y={206} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800" letterSpacing="2">GURO</text>
        </motion.g>
      </svg>
    );
  }

  // renueva
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full">
      {common}
      <rect width="400" height="400" fill="#0a0a0f" />
      {/* Calendar card */}
      <motion.g
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <rect x={50} y={70} width={220} height={260} rx={16} fill={`url(#fg-renueva-soft)`} stroke="rgba(167,139,250,0.22)" />
        <rect x={50} y={70} width={220} height={46} rx={16} fill="rgba(87,60,255,0.35)" />
        <text x={160} y={100} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" letterSpacing="2">RENOVACIONES</text>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const active = i === 4;
          return (
            <g key={i}>
              <rect
                x={66 + col * 68}
                y={140 + row * 60}
                width={56} height={48} rx={8}
                fill={active ? `url(#fg-renueva)` : 'rgba(167,139,250,0.1)'}
                stroke={active ? 'none' : 'rgba(167,139,250,0.2)'}
              />
              <text
                x={94 + col * 68}
                y={170 + row * 60}
                textAnchor="middle"
                fill={active ? '#fff' : 'rgba(255,255,255,0.6)'}
                fontSize="15"
                fontWeight={active ? '700' : '500'}
              >
                {12 + i}
              </text>
            </g>
          );
        })}
      </motion.g>
      {/* Notification card */}
      <motion.g
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
      >
        <rect x={260} y={140} width={120} height={70} rx={12} fill="rgba(10,10,15,0.9)" stroke="rgba(167,139,250,0.4)" />
        <circle cx={280} cy={162} r={8} fill={`url(#fg-renueva)`} />
        <path d="M 276 162 l 3 3 l 6 -6" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x={296} y={156} width={72} height={5} rx={2.5} fill="rgba(255,255,255,0.8)" />
        <rect x={296} y={168} width={50} height={4} rx={2} fill="rgba(255,255,255,0.4)" />
        <rect x={272} y={184} width={96} height={16} rx={5} fill="rgba(87,60,255,0.3)" />
        <text x={320} y={195} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" letterSpacing="1">WHATSAPP</text>
      </motion.g>
      <motion.g
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <rect x={260} y={230} width={120} height={70} rx={12} fill="rgba(10,10,15,0.9)" stroke="rgba(167,139,250,0.4)" />
        <circle cx={280} cy={252} r={8} fill={`url(#fg-renueva)`} />
        <rect x={296} y={246} width={60} height={5} rx={2.5} fill="rgba(255,255,255,0.8)" />
        <rect x={296} y={258} width={44} height={4} rx={2} fill="rgba(255,255,255,0.4)" />
        <rect x={272} y={274} width={96} height={16} rx={5} fill="rgba(249,115,22,0.3)" />
        <text x={320} y={285} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" letterSpacing="1">VENCE HOY</text>
      </motion.g>
    </svg>
  );
};

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
          className="relative bg-white/5 rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-square border border-white/10"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.4 }}
        >
          <FeatureIllustration variant={feat.variant} />
          {/* Subtle gradient overlay */}
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: isEven
                ? 'linear-gradient(135deg, rgba(87,60,255,0.18) 0%, transparent 60%)'
                : 'linear-gradient(225deg, rgba(87,60,255,0.18) 0%, transparent 60%)',
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
          className="text-2xl sm:text-[1.75rem] lg:text-[2rem] font-bold text-white leading-[1.15] tracking-tight mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
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
              className="flex items-start gap-3 text-[15px] text-white/60 leading-relaxed"
              initial={{ opacity: 0, x: -15 }}
              animate={isBlockInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.4 + bi * 0.1 }}
            >
              <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#573CFF]" />
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
          <SyncButton href="/comenzar" size="sm">Comenzar</SyncButton>
        </motion.div>
      </div>
    </motion.div>
  );
};

const Features = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} id="caracteristicas" className="py-20 sm:py-28 bg-transparent">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 sm:mb-24"
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white leading-[1.1] tracking-[-0.02em] mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
          >
            Un solo software para operar
            <span className="hidden sm:inline"><br /></span>{' '}
            <span className="landing-grad-text">toda tu agencia de seguros</span>
          </h2>
          <p className="text-[1.25rem] sm:text-[1.5rem] lg:text-[1.75rem] font-bold text-white/40 max-w-2xl mx-auto leading-[1.2] tracking-[-0.01em]">
            Guro conecta tu agencia con las aseguradoras y centraliza pólizas, clientes, cotizaciones y renovaciones en un único lugar.
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
          <SyncButton href="/comenzar" size="lg">Crear tu agencia</SyncButton>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
