import { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getPageMetadata } from '../../config/pageMetadata';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import personajeGuro from '../../assets/images/personajeguro.png';
import personajeGuroWa from '../../assets/images/personajegurowhatsapp.png';
import personajeGuroPolizas from '../../assets/images/pesonajeguropolizas.png';

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
    if (usuarioSaas?.nombre) return usuarioSaas.nombre.split(' ').slice(0, 2).join(' ');
    if (tenant?.nombre) return tenant.nombre;
    return '';
  }, [usuarioSaas, tenant]);

  const agencyName = tenant?.branding?.nombre_comercial || tenant?.nombre || '';

  return (
    <div>
      <EmailVerificationBanner />

      {/* ── Greeting ── */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-[-0.02em]">
          {getGreeting()}, {name}
        </h1>
        {agencyName && (
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{agencyName}</p>
        )}
      </div>

      {/* ── Hero — Guro Studio ── */}
      <button
        onClick={() => nav('/apps/marketing/creador-contenido')}
        className="group w-full relative overflow-hidden rounded-2xl text-left transition-all hover:shadow-xl active:scale-[0.998] mb-6"
        style={{ background: 'linear-gradient(135deg, #222283 0%, #573CFF 40%, #a25dae 70%, #fa8e5b 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noise%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noise)%27/%3E%3C/svg%3E")' }} />
        <div className="flex items-center min-h-[200px] relative z-[1]">
          <div className="flex-1 p-7 lg:py-8 lg:pl-9">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-white/90 backdrop-blur-sm mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Guro Studio
            </span>
            <h2 className="text-[21px] lg:text-2xl font-bold text-white mb-1.5 leading-snug">
              Crea, planifica y publica<br className="hidden sm:block" /> contenido para tu marca
            </h2>
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/15 text-white/80">
                <Icon icon="solar:pallete-2-bold" width={12} /> Diseño IA
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/15 text-white/80">
                <Icon icon="solar:calendar-bold" width={12} /> Planificador
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/15 text-white/80">
                <Icon icon="solar:share-circle-bold" width={12} /> Redes sociales
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/15 text-white/80">
                <Icon icon="solar:gallery-bold" width={12} /> Plantillas
              </span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-[#222283] text-[13px] font-bold group-hover:bg-white/90 transition-colors">
              Empezar a crear
              <Icon icon="solar:arrow-right-linear" width={14} />
            </span>
          </div>
          <div className="hidden lg:block relative w-[280px] h-[200px] mr-4 flex-shrink-0">
            <img
              src="https://img.freepik.com/free-photo/young-woman-working-laptop-computer-sitting-desk_1303-30069.jpg?semt=ais_hybrid&w=740"
              alt=""
              className="w-full h-full object-cover object-top rounded-xl opacity-80 group-hover:opacity-90 transition-opacity duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#573CFF]/60 to-transparent rounded-xl" />
          </div>
        </div>
      </button>

      {/* ── Bento grid — main workspace ── */}
      <div className="grid grid-cols-4 lg:grid-cols-12 gap-3 mb-6">

        {/* Pólizas — card with character */}
        <button
          onClick={() => nav('/apps/seguros/polizas')}
          className="group col-span-4 lg:col-span-4 rounded-xl bg-gradient-to-br from-indigo-50 to-sky-50 dark:from-indigo-950/40 dark:to-sky-950/30 border border-indigo-200/60 dark:border-indigo-500/15 p-5 text-left hover:border-indigo-300 dark:hover:border-indigo-400/25 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20 transition-all active:scale-[0.99] relative overflow-visible"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center mb-3.5">
            <Icon icon="solar:shield-check-bold-duotone" width={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white mb-0.5">Pólizas</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-[60%]">Gestiona, renueva y emite pólizas de todos los ramos</p>
          <img
            src={personajeGuroPolizas}
            alt=""
            className="absolute bottom-0 -right-2 w-[150px] h-[207px] object-contain object-bottom opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 pointer-events-none drop-shadow-lg"
          />
        </button>

        {/* WhatsApp — card with character */}
        <button
          onClick={() => nav('/apps/whatsapp/inbox')}
          className="group col-span-4 lg:col-span-4 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/30 border border-teal-200/60 dark:border-teal-500/15 p-5 text-left hover:border-teal-300 dark:hover:border-teal-400/25 hover:shadow-lg hover:shadow-teal-100/50 dark:hover:shadow-teal-900/20 transition-all active:scale-[0.99] relative overflow-visible"
        >
          <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-500/15 flex items-center justify-center mb-3.5">
            <Icon icon="solar:chat-round-dots-bold-duotone" width={20} className="text-teal-600 dark:text-teal-400" />
          </div>
          <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white mb-0.5">WhatsApp & Bot IA</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-[60%]">Inbox, campañas, chatbot inteligente y automatizaciones</p>
          <img
            src={personajeGuroWa}
            alt=""
            className="absolute bottom-0 -right-2 w-[130px] h-[180px] object-contain object-bottom opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 pointer-events-none drop-shadow-lg"
          />
        </button>

        {/* Asistente IA — card with character */}
        <button
          onClick={() => nav('/apps/ia/asistente')}
          className="group col-span-4 lg:col-span-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-200/60 dark:border-indigo-500/15 p-5 text-left hover:border-indigo-300 dark:hover:border-indigo-400/25 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20 transition-all active:scale-[0.99] relative overflow-visible"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center mb-3.5">
            <Icon icon="solar:stars-minimalistic-bold-duotone" width={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white mb-0.5">Asistente IA</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-[65%]">Pregúntale sobre pólizas, clientes o cualquier dato de tu agencia</p>
          <img
            src={personajeGuro}
            alt=""
            className="absolute bottom-0 -right-2 w-[130px] h-[180px] object-contain object-bottom opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 pointer-events-none drop-shadow-lg"
          />
        </button>

        {/* Quick access — 4 compact pills */}
        {[
          { title: 'Clientes', icon: 'solar:users-group-two-rounded-bold-duotone', href: '/apps/seguros/clientes', ic: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10' },
          { title: 'Embudo', icon: 'solar:chart-2-bold-duotone', href: '/apps/saas/sales-funnel', ic: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
          { title: 'Cartera', icon: 'solar:wallet-bold-duotone', href: '/apps/cartera/clientes', ic: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
          { title: 'Dashboard', icon: 'solar:graph-up-bold-duotone', href: '/apps/dashboard', ic: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
        ].map((item) => (
          <button
            key={item.title}
            onClick={() => nav(item.href)}
            className="group col-span-2 lg:col-span-3 flex items-center gap-3 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/[0.06] px-4 py-3 text-left hover:border-gray-300 dark:hover:border-white/10 transition-all active:scale-[0.98]"
          >
            <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon icon={item.icon} width={16} className={item.ic} />
            </div>
            <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{item.title}</span>
          </button>
        ))}
      </div>

      {/* ── More tools ── */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Más herramientas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: 'Call Center IA', sub: 'Automatiza llamadas', icon: 'solar:phone-calling-rounded-bold-duotone', href: '/apps/voice-ai/dashboard', ic: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
            { title: 'Email Marketing', sub: 'Campañas de correo', icon: 'solar:letter-bold-duotone', href: '/apps/marketing/plantillas', ic: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
            { title: 'Mini Web', sub: 'Página de captura', icon: 'solar:smartphone-2-bold-duotone', href: '/apps/marketing/mini-web', ic: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-500/10' },
          ].map((item) => (
            <button
              key={item.title}
              onClick={() => nav(item.href)}
              className="group flex items-center gap-3.5 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/[0.06] p-4 text-left hover:border-gray-300 dark:hover:border-white/10 transition-all active:scale-[0.98]"
            >
              <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon icon={item.icon} width={18} className={item.ic} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Inicio;
