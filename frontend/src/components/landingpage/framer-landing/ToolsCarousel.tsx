import { motion } from 'framer-motion';
import { useState } from 'react';
import { Icon } from '@iconify/react';

/* ── Tool data with icons, descriptions & feature highlights ── */

const tools = [
  {
    title: 'Gestión de Pólizas',
    icon: 'solar:document-bold-duotone',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    desc: 'Administra el ciclo completo de cada póliza: emisión, endosos, anexos y renovación automática. Centraliza toda la información en un solo lugar.',
    features: [
      { icon: 'solar:shield-check-bold', text: 'Emisión y endosos en minutos' },
      { icon: 'solar:calendar-bold', text: 'Alertas de vencimiento automáticas' },
      { icon: 'solar:chart-2-bold', text: 'Dashboard de primas y estados' },
    ],
  },
  {
    title: 'CRM de Clientes',
    icon: 'solar:users-group-two-rounded-bold-duotone',
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
    desc: 'Base de datos inteligente con historial completo, segmentación avanzada y seguimiento de cada interacción con tus clientes y prospectos.',
    features: [
      { icon: 'solar:user-id-bold', text: 'Ficha 360° por cliente' },
      { icon: 'solar:tag-bold', text: 'Segmentación y etiquetas' },
      { icon: 'solar:history-bold', text: 'Historial de interacciones' },
    ],
  },
  {
    title: 'Asistente IA 24/7',
    icon: 'solar:cpu-bolt-bold-duotone',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
    desc: 'Asistente inteligente que responde consultas sobre pólizas, clientes, cartera y reportes en lenguaje natural. Disponible las 24 horas.',
    features: [
      { icon: 'solar:chat-round-dots-bold', text: 'Consultas en lenguaje natural' },
      { icon: 'solar:database-bold', text: 'Acceso a toda tu información' },
      { icon: 'solar:export-bold', text: 'Exporta reportes al instante' },
    ],
  },
  {
    title: 'Call Center con IA',
    icon: 'solar:phone-calling-bold-duotone',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    desc: 'Agentes de voz con IA que realizan llamadas automáticas para cobros, recordatorios de vencimiento y seguimiento de renovaciones.',
    features: [
      { icon: 'solar:robot-bold', text: 'Agentes IA personalizables' },
      { icon: 'solar:phone-bold', text: 'Llamadas masivas automáticas' },
      { icon: 'solar:chart-bold', text: 'Métricas de éxito en tiempo real' },
    ],
  },
  {
    title: 'Reportes y Dashboards',
    icon: 'solar:chart-square-bold-duotone',
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
    desc: 'Visualiza KPIs clave de tu agencia en tiempo real: producción, siniestralidad, cartera, comisiones y rendimiento del equipo.',
    features: [
      { icon: 'solar:graph-up-bold', text: 'KPIs en tiempo real' },
      { icon: 'solar:filter-bold', text: 'Filtros por periodo y ramo' },
      { icon: 'solar:file-download-bold', text: 'Exportación a Excel y PDF' },
    ],
  },
  {
    title: 'Lector PDF con IA',
    icon: 'solar:file-text-bold-duotone',
    iconColor: 'text-red-500',
    iconBg: 'bg-red-50',
    desc: 'Sube pólizas en PDF y la IA extrae automáticamente todos los datos: asegurado, prima, vigencia, coberturas y más. Sin digitación manual.',
    features: [
      { icon: 'solar:cloud-upload-bold', text: 'Carga masiva de documentos' },
      { icon: 'solar:cpu-bolt-bold', text: 'Extracción con IA (95%+ precisión)' },
      { icon: 'solar:check-circle-bold', text: 'Validación y auditoría automática' },
    ],
  },
  {
    title: 'WhatsApp Marketing',
    icon: 'solar:chat-round-dots-bold-duotone',
    iconColor: 'text-green-500',
    iconBg: 'bg-green-50',
    desc: 'Automatiza conversaciones, crea chatbots de venta cruzada y lanza campañas masivas por WhatsApp Business con plantillas personalizadas.',
    features: [
      { icon: 'solar:letter-bold', text: 'Campañas masivas con plantillas' },
      { icon: 'solar:robot-bold', text: 'Chatbots de venta cruzada' },
      { icon: 'solar:graph-up-bold', text: 'Métricas de apertura y respuesta' },
    ],
  },
  {
    title: 'Gestión de Cartera',
    icon: 'solar:wallet-bold-duotone',
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-50',
    desc: 'Controla cobros, pagos a aseguradoras y comisiones. Visualiza morosidad, genera estados de cuenta y registra recaudos en un solo clic.',
    features: [
      { icon: 'solar:dollar-minimalistic-bold', text: 'Control de cobros y pagos' },
      { icon: 'solar:clock-circle-bold', text: 'Alertas de morosidad' },
      { icon: 'solar:document-text-bold', text: 'Estados de cuenta automáticos' },
    ],
  },
  {
    title: 'Embudo de Ventas',
    icon: 'solar:sort-from-top-to-bottom-bold-duotone',
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-50',
    desc: 'Pipeline visual con etapas personalizables, lead scoring y seguimiento de cada oportunidad desde el primer contacto hasta el cierre.',
    features: [
      { icon: 'solar:tuning-2-bold', text: 'Etapas 100% personalizables' },
      { icon: 'solar:fire-bold', text: 'Lead scoring automático' },
      { icon: 'solar:users-group-rounded-bold', text: 'Asignación por agente' },
    ],
  },
  {
    title: 'Gestión de Siniestros',
    icon: 'solar:danger-triangle-bold-duotone',
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    desc: 'Registra, da seguimiento y valida reclamaciones con control de SLA. Priorización automática y notificaciones a cada parte involucrada.',
    features: [
      { icon: 'solar:flag-bold', text: 'Priorización por severidad' },
      { icon: 'solar:clock-circle-bold', text: 'Control de SLA y tiempos' },
      { icon: 'solar:bell-bold', text: 'Notificaciones automáticas' },
    ],
  },
  {
    title: 'Control de Renovaciones',
    icon: 'solar:refresh-circle-bold-duotone',
    iconColor: 'text-cyan-600',
    iconBg: 'bg-cyan-50',
    desc: 'Alertas automáticas de vencimientos, flujos de contacto y renovación con seguimiento de cada póliza próxima a expirar.',
    features: [
      { icon: 'solar:bell-bing-bold', text: 'Alertas 30, 15 y 7 días antes' },
      { icon: 'solar:phone-bold', text: 'Flujos de contacto automáticos' },
      { icon: 'solar:chart-bold', text: 'Tasa de renovación en tiempo real' },
    ],
  },
  {
    title: 'Comisiones Automáticas',
    icon: 'solar:dollar-minimalistic-bold-duotone',
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-50',
    desc: 'Cálculo automático de comisiones por póliza, liquidación por vendedor, anticipos y ajustes. Sin hojas de cálculo ni errores manuales.',
    features: [
      { icon: 'solar:calculator-bold', text: 'Cálculo automático por póliza' },
      { icon: 'solar:user-check-bold', text: 'Liquidación por vendedor' },
      { icon: 'solar:hand-money-bold', text: 'Anticipos y ajustes integrados' },
    ],
  },
];

const ToolCard = ({ tool }: { tool: typeof tools[0] }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex-shrink-0"
      style={{ width: 'clamp(220px, calc((100vw - 40px) / 1.3), calc((100vw - 100px) / 5))' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="bg-white/5 border border-white/10 backdrop-blur-md rounded-[24px] p-5 sm:p-6 shadow-xl shadow-black/40 cursor-pointer h-full flex flex-col transition-all duration-300 hover:border-[#573CFF]/40"
        style={{ transform: hovered ? 'translateY(-6px)' : 'translateY(0)' }}
      >
        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#573CFF]/15 border border-[#573CFF]/30 flex items-center justify-center mb-4 transition-transform duration-300"
          style={{ transform: hovered ? 'scale(1.1)' : 'scale(1)' }}
        >
          <Icon icon={tool.icon} className="w-6 h-6 text-[#573CFF]" />
        </div>

        {/* Title */}
        <h3
          className="text-white font-bold text-[17px] leading-tight mb-2"
          style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
        >
          {tool.title}
        </h3>

        {/* Description */}
        <p className="text-[13px] text-white/50 leading-relaxed mb-4 flex-1">
          {tool.desc}
        </p>

        {/* Feature highlights */}
        <div className="space-y-2">
          {tool.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Icon icon={f.icon} className="w-3 h-3 text-[#573CFF]" />
              </div>
              <span className="text-[12px] text-white/60 leading-snug">{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ToolsCarousel = () => {
  const items = [...tools, ...tools];

  return (
    <section
      id="herramientas"
      className="relative overflow-hidden bg-transparent"
    >
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(87,60,255,0.15) 0%, transparent 60%)',
        }}
      />
      <div className="relative py-16 sm:py-24">
        <div className="text-center px-5 mb-10 sm:mb-20">
          <h2
            className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white leading-[1.1] tracking-[-0.02em]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
          >
            El conjunto de herramientas completo
            <span className="hidden sm:inline"><br /></span>{' '}
            <span className="landing-grad-text">para agencias de seguros modernas</span>
          </h2>
        </div>

        {/* Cards carousel */}
        <div className="pb-16 sm:pb-24">
          <motion.div
            className="flex gap-4 sm:gap-5"
            animate={{ x: ['0%', '-70%'] }}
            transition={{
              x: {
                duration: 50,
                repeat: Infinity,
                ease: 'linear',
              },
            }}
            style={{ width: 'max-content' }}
          >
            {items.map((tool, index) => (
              <ToolCard key={`${tool.title}-${index}`} tool={tool} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ToolsCarousel;
