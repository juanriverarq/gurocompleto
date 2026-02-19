import { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getPageMetadata } from '../../config/pageMetadata';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import SetupWizard from '../../components/SetupWizard/SetupWizard';
import saraPng from '../../assets/images/sara.png';
import polizasImg from '../../assets/images/4.png';
import whatsappImg from '../../assets/images/3.png';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

const Inicio = () => {
  const nav = useNavigate();
  const { usuarioSaas, tenant } = useUnifiedAuth();
  const metadata = getPageMetadata('dashboard3');
  usePageMeta(metadata);

  const name = useMemo(() => {
    if (usuarioSaas?.nombre) return usuarioSaas.nombre.split(' ')[0];
    if (tenant?.nombre) return tenant.nombre;
    return '';
  }, [usuarioSaas, tenant]);

  const agencyName = tenant?.branding?.nombre_comercial || tenant?.nombre || '';

  return (
    <div>
      <EmailVerificationBanner />

      {/* ── Greeting ── */}
      <div className="pt-2 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {getGreeting()}{name ? `, ${name}` : ''} 👋
        </h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          {agencyName ? `${agencyName} · ` : ''}Tu espacio de trabajo inteligente
        </p>
      </div>

      {/* ── Setup Wizard (onboarding steps for new users) ── */}
      <SetupWizard />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HERO — Brand gradient with animated shimmer                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes hero-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .hero-animated-bg {
          background-size: 200% 200%;
          animation: hero-shimmer 16s ease-in-out infinite;
        }
      `}</style>
      <button
        onClick={() => nav('/apps/marketing/creador-contenido')}
        className="hero-animated-bg group w-full relative overflow-hidden rounded-3xl p-0 text-left transition-all hover:shadow-2xl hover:shadow-[#222283]/30 active:scale-[0.995] mb-6"
        style={{ backgroundImage: 'linear-gradient(135deg, #222283, #573CFF, #a25dae, #fa8e5b, #a25dae, #222283)' }}
      >
        <div className="flex items-center">
          <div className="flex-1 p-8 lg:p-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-sm mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Guro Studio
            </span>
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2 leading-tight">
              Crea contenido visual<br />con inteligencia artificial
            </h2>
            <p className="text-sm text-white/70 max-w-md leading-relaxed mb-6">
              Diseña piezas gráficas para redes sociales adaptadas a tu marca en segundos. Sin necesidad de ser diseñador.
            </p>
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-white text-[#222283] text-sm font-bold group-hover:bg-white/95 transition-colors shadow-lg shadow-black/10">
              Empezar a crear
              <Icon icon="solar:arrow-right-linear" width={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
          <div className="hidden lg:block relative w-[320px] h-[260px] mr-6 flex-shrink-0">
            <img
              src="https://img.freepik.com/free-photo/young-woman-working-laptop-computer-sitting-desk_1303-30069.jpg?semt=ais_hybrid&w=740"
              alt=""
              className="w-full h-full object-cover object-top rounded-2xl opacity-90 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#a25dae]/50 rounded-2xl" />
          </div>
        </div>
      </button>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TOOLS GRID — clean cards, no gradient backgrounds             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Pólizas */}
        <button
          onClick={() => nav('/apps/seguros/polizas')}
          className="group col-span-2 rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/[0.06] text-left hover:border-[#573CFF]/30 dark:hover:border-[#573CFF]/30 transition-all hover:shadow-lg dark:hover:shadow-none active:scale-[0.99] overflow-hidden min-h-[120px]"
        >
          <div className="flex items-center">
            <div className="w-28 h-28 flex-shrink-0">
              <img src={polizasImg} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 py-6 px-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-0.5">Pólizas</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">Gestiona, renueva y emite pólizas de todos los ramos</p>
            </div>
            <div className="pr-4">
              <Icon icon="solar:arrow-right-linear" width={16} className="text-gray-300 dark:text-gray-600 group-hover:text-[#573CFF] transition-colors" />
            </div>
          </div>
        </button>

        {/* WhatsApp */}
        <button
          onClick={() => nav('/apps/whatsapp/inbox')}
          className="group col-span-2 rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/[0.06] text-left hover:border-[#16CDC7]/30 dark:hover:border-[#16CDC7]/30 transition-all hover:shadow-lg dark:hover:shadow-none active:scale-[0.99] overflow-hidden min-h-[120px]"
        >
          <div className="flex items-center">
            <div className="w-28 h-28 flex-shrink-0">
              <img src={whatsappImg} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 py-6 px-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-0.5">WhatsApp Inbox</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">Atiende clientes, envía campañas y automatiza respuestas</p>
            </div>
            <div className="pr-4">
              <Icon icon="solar:arrow-right-linear" width={16} className="text-gray-300 dark:text-gray-600 group-hover:text-[#16CDC7] transition-colors" />
            </div>
          </div>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* QUICK ACCESS — diverse but harmonious colors                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { title: 'Clientes', sub: 'Tu cartera', icon: 'solar:users-group-two-rounded-bold-duotone', href: '/apps/seguros/clientes', color: 'text-[#573CFF]', bg: 'bg-[#573CFF]/10 dark:bg-[#573CFF]/20' },
          { title: 'Embudo', sub: 'Pipeline de ventas', icon: 'solar:chart-2-bold-duotone', href: '/apps/saas/sales-funnel', color: 'text-[#16CDC7]', bg: 'bg-[#16CDC7]/10 dark:bg-[#16CDC7]/20' },
          { title: 'Cartera', sub: 'Cobros y pagos', icon: 'solar:wallet-bold-duotone', href: '/apps/cartera/clientes', color: 'text-[#fa8e5b]', bg: 'bg-[#fa8e5b]/10 dark:bg-[#fa8e5b]/20' },
          { title: 'Dashboard', sub: 'Métricas', icon: 'solar:graph-up-bold-duotone', href: '/apps/dashboard', color: 'text-[#a25dae]', bg: 'bg-[#a25dae]/10 dark:bg-[#a25dae]/20' },
        ].map((item) => (
          <button
            key={item.title}
            onClick={() => nav(item.href)}
            className="group rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/[0.06] p-4 text-left hover:border-gray-300 dark:hover:border-white/[0.12] transition-all hover:shadow-md dark:hover:shadow-none active:scale-[0.98]"
          >
            <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
              <Icon icon={item.icon} width={20} className={item.color} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{item.sub}</p>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ASISTENTE IA — dark banner with brand accent                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <button
        onClick={() => nav('/apps/ia/asistente')}
        className="group w-full relative overflow-hidden rounded-2xl bg-[#0d0d1a] dark:bg-white/[0.04] border border-[#222283]/30 dark:border-white/[0.08] p-0 text-left transition-all hover:border-[#573CFF]/40 dark:hover:border-[#573CFF]/30 mb-10 active:scale-[0.995]"
      >
        <div className="flex items-center">
          <div className="flex-1 p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#a25dae]/20 flex items-center justify-center">
                <Icon icon="solar:cpu-bolt-bold-duotone" width={18} className="text-[#a25dae]" />
              </div>
              <span className="text-xs font-bold text-[#a25dae] uppercase tracking-wider">Asistente IA</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">
              Pregúntale lo que necesites
            </h3>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-4">
              Consulta sobre pólizas, clientes, renovaciones o cualquier dato de tu agencia. Tu asistente siempre disponible.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a25dae]/10 border border-[#a25dae]/20 text-[#a25dae] text-xs font-semibold group-hover:bg-[#a25dae]/20 transition-colors">
              <Icon icon="solar:chat-round-dots-bold" width={14} />
              Abrir asistente
            </div>
          </div>
          <div className="hidden lg:block absolute bottom-0 right-[-8px] w-[260px] h-[230px] pointer-events-none">
            <div className="absolute -right-6 -bottom-4 w-40 h-40 rounded-full bg-[#573CFF]/25 blur-2xl" />
            <div className="absolute right-10 bottom-6 w-28 h-28 rounded-full bg-[#16CDC7]/20 blur-2xl" />
            <div className="absolute -right-2 top-4 w-24 h-24 rounded-full bg-[#fa8e5b]/20 blur-2xl" />
            <img
              src={saraPng}
              alt=""
              className="w-full h-full object-contain object-bottom-right"
            />
          </div>
        </div>
        {/* Subtle brand gradient line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#222283] via-[#a25dae] to-[#fa8e5b] opacity-40" />
      </button>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EXPLORAR — varied gradient icon pills                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Explorar herramientas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: 'Call Center IA', sub: 'Automatiza llamadas con inteligencia artificial', icon: 'solar:phone-calling-rounded-bold-duotone', href: '/apps/voice-ai/dashboard', gradient: 'from-[#222283] to-[#573CFF]' },
            { title: 'Email Marketing', sub: 'Campañas de correo profesionales', icon: 'solar:letter-bold-duotone', href: '/apps/marketing/plantillas', gradient: 'from-[#a25dae] to-[#fa8e5b]' },
            { title: 'Mini Web', sub: 'Tu página para captar clientes', icon: 'solar:smartphone-2-bold-duotone', href: '/apps/marketing/mini-web', gradient: 'from-[#0d4f4f] to-[#16CDC7]' },
          ].map((item) => (
            <button
              key={item.title}
              onClick={() => nav(item.href)}
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/[0.06] p-5 text-left hover:border-gray-300 dark:hover:border-white/[0.12] transition-all hover:shadow-md dark:hover:shadow-none active:scale-[0.98]"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-3 shadow-lg shadow-black/10`}>
                <Icon icon={item.icon} width={20} className="text-white" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">{item.title}</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">{item.sub}</p>
              <Icon icon="solar:arrow-right-up-linear" width={14} className="absolute top-5 right-5 text-gray-300 dark:text-gray-600 group-hover:text-[#573CFF] transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Inicio;
