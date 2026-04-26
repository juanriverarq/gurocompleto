import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getPageMetadata } from '../../config/pageMetadata';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import logoSura from '../../assets/images/logoscompanias/sura.png';
import logoBolivar from '../../assets/images/logoscompanias/bolivar.png';
import logoEstado from '../../assets/images/logoscompanias/estado.png';
import logoHdi from '../../assets/images/logoscompanias/hdi.png';
import logoEquidad from '../../assets/images/logoscompanias/equidad.png';
import logoAxa from '../../assets/images/logoscompanias/axa.png';
import logoGuroFull from '../../assets/images/logos/Logo.svg';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

/* ── Isometric Hub Diagram (Notion/Linear style) ── */
const INSURERS_ISO = [
  { logo: logoSura, name: 'SURA' },
  { logo: logoBolivar, name: 'Bolívar' },
  { logo: logoEstado, name: 'Estado' },
  { logo: logoHdi, name: 'HDI' },
  { logo: logoEquidad, name: 'Equidad' },
  { logo: logoAxa, name: 'AXA' },
];

const STREAMS = [
  { label: 'Pólizas', icon: 'solar:shield-check-bold-duotone', color: '#818cf8' },
  { label: 'Clientes', icon: 'solar:users-group-rounded-bold-duotone', color: '#2dd4bf' },
  { label: 'Cartera', icon: 'solar:wallet-bold-duotone', color: '#fbbf24' },
  { label: 'Comisiones', icon: 'solar:dollar-minimalistic-bold-duotone', color: '#c084fc' },
];

const HubConnectionDiagram = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-[400px]">
      {/* Isometric scene wrapper */}
      <div className="relative w-full max-w-[460px]" style={{ perspective: '800px' }}>

        {/* ── Row 1: Insurer blocks ── */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {INSURERS_ISO.map((ins) => (
            <div key={ins.name} className="group relative">
              {/* 3D block */}
              <div
                className="w-[72px] h-[72px] rounded-xl bg-white border border-white/20 flex items-center justify-center overflow-hidden transition-all duration-300 hover:border-white/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#573CFF]/10"
                style={{ transform: 'rotateX(2deg)' }}
              >
                <img src={ins.logo} alt={ins.name} className="w-12 h-12 object-contain" />
              </div>
              {/* Label below */}
              <p className="text-[9px] text-white/40 font-medium text-center mt-1.5">{ins.name}</p>
            </div>
          ))}
        </div>

        {/* ── Bridges: animated vertical lines from insurers to Guro ── */}
        <div className="flex justify-center mb-1">
          <div className="relative w-[300px] h-[40px]">
            <svg className="w-full h-full" viewBox="0 0 300 40" fill="none">
              <defs>
                <linearGradient id="br" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#573CFF" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              {/* 4 vertical bridge lines */}
              {[42, 114, 186, 258].map((x, i) => (
                <g key={i}>
                  <line x1={x} y1="0" x2={150} y2="38" stroke="url(#br)" strokeWidth="1" opacity="0.4" />
                  {/* Animated dot traveling down */}
                  <circle r="2" fill="#a78bfa" opacity="0.8">
                    <animateMotion dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" path={`M ${x} 0 L 150 38`} />
                  </circle>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* ── Center: Guro block (larger, prominent) ── */}
        <div className="flex justify-center mb-1">
          <div className="relative">
            {/* Subtle glow behind */}
            <div className="absolute -inset-4 rounded-2xl bg-[#573CFF]/10 blur-2xl" />
            <div
              className="relative w-[140px] h-[56px] rounded-xl bg-white/[0.06] backdrop-blur-md border border-[#573CFF]/40 flex items-center justify-center gap-2 shadow-xl shadow-[#573CFF]/10"
              style={{ transform: 'rotateX(2deg)' }}
            >
              <img src={logoGuroFull} alt="Guro" className="h-7 object-contain brightness-0 invert" />
            </div>
            {/* Real-time badge */}
            <div className="flex justify-center mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                En tiempo real
              </span>
            </div>
          </div>
        </div>

        {/* ── Bridges: Guro to streams ── */}
        <div className="flex justify-center mb-1">
          <div className="relative w-[340px] h-[36px]">
            <svg className="w-full h-full" viewBox="0 0 340 36" fill="none">
              <defs>
                <linearGradient id="bs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#573CFF" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              {[38, 118, 200, 302].map((x, i) => (
                <g key={i}>
                  <line x1={170} y1="0" x2={x} y2="34" stroke="url(#bs)" strokeWidth="1" opacity="0.4" />
                  <circle r="2" fill={STREAMS[i].color} opacity="0.8">
                    <animateMotion dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" path={`M 170 0 L ${x} 34`} />
                  </circle>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* ── Row 3: Data stream blocks ── */}
        <div className="flex items-start justify-center gap-2.5">
          {STREAMS.map((s) => (
            <div key={s.label} className="group">
              <div
                className="w-[78px] rounded-xl bg-white/[0.05] backdrop-blur-sm border border-white/15 p-2.5 flex flex-col items-center gap-1.5 transition-all duration-300 hover:border-white/30 hover:-translate-y-1"
                style={{ transform: 'rotateX(2deg)' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                  <Icon icon={s.icon} width={17} style={{ color: s.color }} />
                </div>
                <span className="text-[10px] font-semibold text-white/70 whitespace-nowrap">{s.label}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

/* ── Step data ── */
const STEPS = [
  {
    id: 'connect',
    number: '01',
    title: 'Conecta tus compañías',
    description: 'Vincula las aseguradoras con las que trabajas. Guro se conecta directamente a sus portales para traer toda tu información.',
    icon: 'solar:plug-circle-bold-duotone',
    color: 'indigo',
    gradient: 'from-indigo-500 to-violet-600',
    bgLight: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderLight: 'border-indigo-200/60 dark:border-indigo-500/15',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    features: [
      { label: 'SURA', icon: 'solar:shield-check-bold' },
      { label: 'Bolívar', icon: 'solar:shield-check-bold' },
      { label: 'Allianz', icon: 'solar:shield-check-bold' },
      { label: 'SoftSeguros', icon: 'solar:database-bold' },
      { label: '+ Más', icon: 'solar:add-circle-bold' },
    ],
    cta: 'Conectar compañías',
    href: '/apps/integraciones/apis-aseguradoras',
  },
  {
    id: 'sync',
    number: '02',
    title: 'Sincroniza tu data',
    description: 'Pólizas, clientes, cartera, comisiones y siniestros — todo se importa automáticamente y se mantiene actualizado.',
    icon: 'solar:refresh-circle-bold-duotone',
    color: 'teal',
    gradient: 'from-teal-500 to-emerald-600',
    bgLight: 'bg-teal-50 dark:bg-teal-500/10',
    borderLight: 'border-teal-200/60 dark:border-teal-500/15',
    iconColor: 'text-teal-600 dark:text-teal-400',
    features: [
      { label: 'Pólizas', icon: 'solar:document-bold' },
      { label: 'Clientes', icon: 'solar:users-group-rounded-bold' },
      { label: 'Cartera', icon: 'solar:wallet-bold' },
      { label: 'Comisiones', icon: 'solar:dollar-minimalistic-bold' },
      { label: 'Siniestros', icon: 'solar:danger-triangle-bold' },
    ],
    cta: 'Ver mis datos',
    href: '/apps/seguros/polizas',
  },
  {
    id: 'operate',
    number: '03',
    title: 'Opera desde un solo lugar',
    description: 'Gestiona toda tu operación de seguros: renueva, cobra, comunica con clientes y analiza tu negocio — todo centralizado.',
    icon: 'solar:command-bold-duotone',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    bgLight: 'bg-violet-50 dark:bg-violet-500/10',
    borderLight: 'border-violet-200/60 dark:border-violet-500/15',
    iconColor: 'text-violet-600 dark:text-violet-400',
    features: [
      { label: 'WhatsApp', icon: 'solar:chat-round-dots-bold' },
      { label: 'Renovaciones', icon: 'solar:restart-bold' },
      { label: 'Facturación', icon: 'solar:bill-list-bold' },
      { label: 'IA', icon: 'solar:stars-minimalistic-bold' },
      { label: 'Reportes', icon: 'solar:chart-2-bold' },
    ],
    cta: 'Ir al Dashboard',
    href: '/apps/dashboard',
  },
];

const QUICK_ACTIONS = [
  { title: 'Inicio rápido', sub: 'Accesos directos y herramientas', icon: 'solar:home-smile-bold-duotone', href: '/apps/inicio', ic: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { title: 'Dashboard', sub: 'Métricas y análisis', icon: 'solar:graph-up-bold-duotone', href: '/apps/dashboard', ic: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
  { title: 'Pólizas', sub: 'Gestión de seguros', icon: 'solar:shield-check-bold-duotone', href: '/apps/seguros/polizas', ic: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
  { title: 'WhatsApp', sub: 'Comunicación y chatbot', icon: 'solar:chat-round-dots-bold-duotone', href: '/apps/whatsapp/inbox', ic: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-500/10' },
];

const GuroHub = () => {
  const nav = useNavigate();
  const { usuarioSaas, tenant } = useUnifiedAuth();
  const metadata = getPageMetadata('dashboard3');
  usePageMeta(metadata);
  const [expandedStep, setExpandedStep] = useState<string | null>('connect');

  const name = useMemo(() => {
    if (usuarioSaas?.nombre) return usuarioSaas.nombre.split(' ').slice(0, 2).join(' ');
    if (tenant?.nombre) return tenant.nombre;
    return '';
  }, [usuarioSaas, tenant]);

  const agencyName = tenant?.branding?.nombre_comercial || tenant?.nombre || '';

  return (
    <div className="w-full">
      <EmailVerificationBanner />

      {/* ── Greeting ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-[-0.02em]">
          {getGreeting()}, {name}
        </h1>
        {agencyName && (
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{agencyName}</p>
        )}
      </div>

      {/* ── Hero banner ── */}
      <div
        className="relative overflow-hidden rounded-2xl mb-8"
        style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 40%, #222283 70%, #573CFF 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noise%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noise)%27/%3E%3C/svg%3E")' }} />
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#573CFF]/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-[1] flex flex-col lg:flex-row items-stretch">
          {/* Left: Text content */}
          <div className="flex-1 px-7 py-8 lg:px-10 lg:py-10 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/80 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Hub Centralizador
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#573CFF]/30 text-white/70 backdrop-blur-sm">
                Nuevo
              </span>
            </div>

            <h2 className="text-[26px] lg:text-[32px] font-bold text-white mb-2 leading-tight tracking-[-0.02em]">
              Tu operación de seguros,<br className="hidden sm:block" /> centralizada en Guro
            </h2>
            <p className="text-white/60 text-sm lg:text-[15px] max-w-xl leading-relaxed mb-6">
              Conecta tus compañías de seguros y trae toda tu data — pólizas, clientes, cartera y comisiones — a un solo lugar. Opera, renueva, cobra y comunica sin saltar entre portales.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => nav('/apps/integraciones/apis-aseguradoras')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0d0d0d] text-[13px] font-bold hover:bg-white/90 transition-colors"
              >
                <Icon icon="solar:plug-circle-bold" width={16} />
                Conectar compañías
              </button>
              <button
                onClick={() => nav('/apps/dashboard')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white text-[13px] font-semibold hover:bg-white/15 transition-colors backdrop-blur-sm"
              >
                Ir al Dashboard
                <Icon icon="solar:arrow-right-linear" width={14} />
              </button>
            </div>
          </div>

          {/* Right: Connection diagram */}
          <div className="hidden lg:block flex-1 max-w-[520px] py-4 pr-8">
            <HubConnectionDiagram />
          </div>
        </div>
      </div>

      {/* ── Steps section ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
            <Icon icon="solar:route-bold-duotone" width={16} className="text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Cómo funciona</h3>
        </div>

        <div className="space-y-3">
          {STEPS.map((step) => {
            const isExpanded = expandedStep === step.id;
            return (
              <div
                key={step.id}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? `${step.borderLight} bg-white dark:bg-white/[0.03] shadow-sm`
                    : 'border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/10'
                }`}
              >
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full flex items-center gap-4 p-5 text-left"
                >
                  <div className={`w-11 h-11 rounded-xl ${step.bgLight} flex items-center justify-center flex-shrink-0`}>
                    <Icon icon={step.icon} width={22} className={step.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider">{step.number}</span>
                      <h4 className="text-[14px] font-semibold text-gray-900 dark:text-white">{step.title}</h4>
                    </div>
                    {!isExpanded && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{step.description}</p>
                    )}
                  </div>
                  <Icon
                    icon="solar:alt-arrow-down-linear"
                    width={16}
                    className={`text-gray-400 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-4 pl-[60px]">
                      {step.description}
                    </p>

                    {/* Feature chips */}
                    <div className="flex flex-wrap gap-2 mb-4 pl-[60px]">
                      {step.features.map((feat) => (
                        <span
                          key={feat.label}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium ${step.bgLight} ${step.iconColor}`}
                        >
                          <Icon icon={feat.icon} width={13} />
                          {feat.label}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="pl-[60px]">
                      <button
                        onClick={(e) => { e.stopPropagation(); nav(step.href); }}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${step.gradient} text-white text-[12px] font-bold hover:opacity-90 transition-opacity shadow-sm`}
                      >
                        {step.cta}
                        <Icon icon="solar:arrow-right-linear" width={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Connector line visual ── */}
      <div className="flex items-center gap-3 mb-8 px-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Accesos</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />
      </div>

      {/* ── Quick actions grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {QUICK_ACTIONS.map((item) => (
          <button
            key={item.title}
            onClick={() => nav(item.href)}
            className="group flex flex-col gap-3 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/[0.06] p-4 text-left hover:border-gray-300 dark:hover:border-white/10 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
              <Icon icon={item.icon} width={18} className={item.ic} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── What's coming ── */}
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.01] p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:lightbulb-bolt-bold-duotone" width={18} className="text-amber-500" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-gray-900 dark:text-white mb-1">Próximamente</h4>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Cotizador multi-compañía, emisión directa desde Guro, comparador de precios en tiempo real, y más integraciones con portales de aseguradoras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuroHub;
