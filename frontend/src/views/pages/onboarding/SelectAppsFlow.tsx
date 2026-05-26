import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useLocation, useNavigate } from 'react-router';
import { ModuleKey, BillingPeriod, MODULES, calculateTotals, numberFormat } from 'src/components/landingpage/pricing-calculator/modules';
import LogoSvg from 'src/assets/images/logos/Logo.svg';

const SURA_LOGO_URL =
  'https://www.sura.co/documents/43501/0/Logo-SURA-blanco+1.svg/8937a328-d03b-7aa7-79bd-a5308a3931b3?version=1.0&t=1704405886717';

const ANNUAL_DISCOUNT = 0.12;

// Precio del usuario adicional sobre el incluido del plan
const EXTRA_USER_MONTHLY = 30000;
const EXTRA_USER_PACK5_MONTHLY = 25000; // si extra >= 5
const PACK_THRESHOLD = 5;

const planFeatures = {
  start: ['Clientes', 'Pólizas', 'Seguimientos', 'Autos', 'Negocios', 'Cartera', 'Comisiones', 'Tareas'],
  business: ['Todo lo de Start', '3 usuarios incluidos', 'Chatbot IA', 'Lector PDF con IA', 'IA de venta cruzada'],
  enterprise: ['Todo lo de Business', '5 usuarios incluidos', 'App móvil', 'Facturación', 'Nómina electrónica', 'IA para llamadas'],
};

const planPresets: Array<{
  name: string;
  description: string;
  price: number;
  users: number;
  storageGB: number;
  modules: ModuleKey[];
  features: string[];
  popular?: boolean;
}> = [
  {
    name: 'START',
    description: 'Ideal para asesores independientes.',
    price: 249000,
    users: 1,
    storageGB: 10,
    modules: ['clientes', 'polizas', 'seguimiento', 'automoviles', 'crm', 'cartera', 'comisiones', 'documentos'],
    features: planFeatures.start,
  },
  {
    name: 'BUSINESS',
    description: 'Ideal para equipos comerciales.',
    price: 480000,
    users: 3,
    storageGB: 30,
    modules: ['clientes', 'polizas', 'seguimiento', 'automoviles', 'crm', 'cartera', 'comisiones', 'documentos', 'ia_chatbot', 'lector_pdf_ia', 'ia_ventas_cruzadas'],
    features: planFeatures.business,
    popular: true,
  },
  {
    name: 'ENTERPRISE',
    description: 'Ideal para empresas y operaciones avanzadas.',
    price: 870000,
    users: 5,
    storageGB: 50,
    modules: ['clientes', 'polizas', 'seguimiento', 'automoviles', 'crm', 'cartera', 'comisiones', 'documentos', 'ia_chatbot', 'lector_pdf_ia', 'ia_ventas_cruzadas', 'app_movil', 'facturacion_electronica', 'nomina_electronica', 'ia_callcenter'],
    features: planFeatures.enterprise,
  },
];

/** Costo mensual extra por usuarios sobre los incluidos. Pack >=5 baja a $25k. */
const extraUsersMonthly = (planUsers: number, totalUsers: number): number => {
  const extra = Math.max(0, totalUsers - planUsers);
  if (extra === 0) return 0;
  const perUser = extra >= PACK_THRESHOLD ? EXTRA_USER_PACK5_MONTHLY : EXTRA_USER_MONTHLY;
  return extra * perUser;
};

const SelectAppsFlow = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSuraFlow = location.pathname.startsWith('/sura');
  const basePath = isSuraFlow ? '/sura' : '/comenzar';

  const [period, setPeriod] = useState<BillingPeriod>(() => {
    const saved = localStorage.getItem('guro_pricing_selection');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.period || 'monthly';
      } catch { /* ignore */ }
    }
    return 'monthly';
  });

  // Usuarios por plan: arranca con el `users` incluido de cada preset.
  const [planUsers, setPlanUsers] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    planPresets.forEach((p) => { m[p.name] = p.users; });
    return m;
  });

  const setUsersFor = (planName: string, value: number) => {
    setPlanUsers((prev) => ({ ...prev, [planName]: Math.max(1, Math.floor(value || 1)) }));
  };

  const handlePlanSelect = (plan: typeof planPresets[number]) => {
    const users = planUsers[plan.name] ?? plan.users;
    const mandatoryKeys = MODULES.filter((m) => m.mandatory).map((m) => m.key);
    const planModules = new Set<ModuleKey>(plan.modules);
    mandatoryKeys.forEach((key) => planModules.add(key));
    const selectedPlanModules = Array.from(planModules);

    const extraMonthly = extraUsersMonthly(plan.users, users);
    const monthlyTotal = plan.price + extraMonthly;
    const annualTotal = Math.round(monthlyTotal * 12 * (1 - ANNUAL_DISCOUNT));

    // totals: lo dejamos compatible con el resto del flujo de pricing.
    // Usamos calculateTotals para tener la misma forma que /precios.
    const totals = calculateTotals(new Set<ModuleKey>(selectedPlanModules), users, period);
    const totalsWithPlanPrice = {
      ...(totals as any),
      planName: plan.name,
      planFixedMonthly: plan.price,
      extraUsersMonthly: extraMonthly,
      subtotalMonthly: monthlyTotal,
      subtotalAnnual: period === 'annual' ? annualTotal : undefined,
      discountAnnual: period === 'annual' ? monthlyTotal * 12 - annualTotal : undefined,
    };

    const payload = {
      users,
      modules: selectedPlanModules,
      totals: totalsWithPlanPrice,
      storageGB: plan.storageGB,
      period,
      planName: plan.name,
      suraCoupon: isSuraFlow ? { code: 'SURA30', discount: 0.30, discountAmount: 0 } : null,
    };
    localStorage.setItem('guro_pricing_selection', JSON.stringify(payload));
    localStorage.setItem('guro_selected_apps', JSON.stringify(selectedPlanModules));
    if (isSuraFlow) {
      localStorage.setItem('guro_sura_flow', '1');
    } else {
      localStorage.removeItem('guro_sura_flow');
    }
    navigate(basePath + '/registro');
  };

  return (
    <div
      className="dark onb-dark-form relative min-h-screen overflow-x-hidden bg-black text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif", colorScheme: 'dark' }}
    >
      {/* Animaciones de la landing — auroras */}
      <style>{`
        @keyframes onb-aurora-1 {
          0%, 100% { transform: translate3d(-8%, -6%, 0) scale(1); }
          33% { transform: translate3d(6%, 4%, 0) scale(1.08); }
          66% { transform: translate3d(-4%, 8%, 0) scale(0.96); }
        }
        @keyframes onb-aurora-3 {
          0%, 100% { transform: translate3d(10%, -4%, 0) scale(0.95); }
          50% { transform: translate3d(-6%, 6%, 0) scale(1.1); }
        }
        @keyframes onb-grad-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .onb-grad-text {
          background: linear-gradient(90deg, #573CFF 0%, #7B61FF 22%, #A78BFA 45%, #fb923c 70%, #f97316 88%, #573CFF 100%);
          background-size: 220% 220%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: onb-grad-flow 12s ease-in-out infinite;
        }
        /* Overrides para inputs dark del onboarding (ganarle al global form input) */
        .onb-dark-form input[type="number"],
        .onb-dark-form input[type="text"],
        .onb-dark-form input[type="email"],
        .onb-dark-form input[type="tel"],
        .onb-dark-form input[type="password"],
        .onb-dark-form input[type="search"],
        form.onb-dark-form input {
          background-color: rgba(255,255,255,0.05) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .onb-dark-form input::placeholder { color: rgba(255,255,255,0.3) !important; }
        .onb-dark-form input:focus {
          background-color: rgba(255,255,255,0.08) !important;
          border-color: rgba(167,139,250,0.55) !important;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.18) !important;
        }
        /* Labels del onboarding siempre claros */
        html .onb-dark-form label,
        html.dark .onb-dark-form label,
        body .onb-dark-form label {
          color: rgba(255, 255, 255, 0.9) !important;
        }
      `}</style>

      {/* Aurora background — suave, solo un toque de línea gráfica */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute"
          style={{
            top: '-30%', left: '-20%', width: '70%', height: '75%',
            background: 'radial-gradient(closest-side, rgba(87,60,255,0.28), rgba(87,60,255,0.08) 50%, transparent 75%)',
            filter: 'blur(100px)',
            animation: 'onb-aurora-1 28s ease-in-out infinite',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: '-20%', right: '-15%', width: '65%', height: '70%',
            background: 'radial-gradient(closest-side, rgba(167,139,250,0.22), rgba(167,139,250,0.05) 50%, transparent 75%)',
            filter: 'blur(110px)',
            animation: 'onb-aurora-3 32s ease-in-out infinite',
          }}
        />
      </div>

      {/* Viñeta muy sutil */}
      <div
        className="pointer-events-none fixed inset-0 z-[2]"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(0,0,0,0.4) 90%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Header */}
      <header className="relative z-10 sticky top-0 backdrop-blur-xl border-b border-white/10 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <img src={LogoSvg} alt="Guro" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
          </a>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-[#573CFF] text-white text-xs font-bold flex items-center justify-center shadow-[0_0_12px_rgba(87,60,255,0.6)]">1</span>
              <span className="text-xs font-semibold text-white hidden sm:inline">Aplicaciones</span>
            </div>
            <div className="w-8 h-px bg-white/20" />
            <div className="flex items-center gap-1.5 opacity-40">
              <span className="w-6 h-6 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-xs font-medium text-white/60 hidden sm:inline">Registro</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 pb-24 sm:pb-10 pt-8 sm:pt-10">
        {/* Banner Sura */}
        {isSuraFlow && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-[#0033A0] to-[#00A1E4] p-6 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <img src={SURA_LOGO_URL} alt="Logo SURA" className="h-12 md:h-16 w-auto" />
                <div className="h-12 w-px bg-white/30 hidden md:block" />
                <div>
                  <p className="text-white/80 text-sm font-medium">Convenio exclusivo</p>
                  <h2 className="text-white text-xl md:text-2xl font-bold">SURA + Guro</h2>
                </div>
              </div>
              <div className="text-center md:text-right">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                  <span className="text-white text-lg md:text-xl font-bold">30% OFF</span>
                  <span className="text-white/90 text-sm">en tu compra anual</span>
                </div>
                <p className="text-white/70 text-xs mt-2">Cupón aplicado automáticamente</p>
              </div>
            </div>
          </div>
        )}

        {/* Badge prueba gratis */}
        {!isSuraFlow && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-medium text-white/70">Prueba gratuita de 7 días · Sin tarjeta</span>
            </div>
          </div>
        )}

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-[3rem] font-bold mb-3 tracking-[-0.03em] leading-[1.05]">
            <span className="text-white">Elige tu plan </span>
            <span className="onb-grad-text">y empieza</span>
          </h1>
          <p className="text-white/50 text-base max-w-lg mx-auto">
            Selecciona el plan y el número de usuarios. Puedes cambiarlo cuando quieras.
          </p>
          {/* Toggle de periodo */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setPeriod('monthly' as BillingPeriod)}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  period === 'monthly' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setPeriod('annual' as BillingPeriod)}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  period === 'annual' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'
                }`}
              >
                Anual
              </button>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              isSuraFlow
                ? 'text-[#00A1E4] bg-[#00A1E4]/10 border-[#00A1E4]/30'
                : 'text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/30'
            }`}>
              {isSuraFlow ? '-30%' : '-12%'}
            </span>
          </div>
        </div>

        <div className="mb-10">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-[#573CFF]/35 bg-[#573CFF]/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">
              Usuario adicional: $30.000
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
              Pack +5 usuarios: $25.000 por usuario
            </span>
          </div>
          <div className="grid lg:grid-cols-3 gap-0 border border-white/10 rounded-3xl overflow-hidden bg-white/[0.02] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            {planPresets.map((plan, index) => {
              const users = planUsers[plan.name] ?? plan.users;
              const extraMonthly = extraUsersMonthly(plan.users, users);
              const monthlyPrice = plan.price + extraMonthly;
              const annualTotal = Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT));
              const annualSavings = monthlyPrice * 12 - annualTotal;
              const extraCount = Math.max(0, users - plan.users);

              return (
                <div
                  key={plan.name}
                  className={`relative p-6 sm:p-7 flex flex-col transition-all duration-300 hover:bg-white/[0.04] ${
                    plan.popular ? 'bg-[#573CFF]/10 ring-1 ring-[#573CFF]/40' : ''
                  } ${index < planPresets.length - 1 ? 'lg:border-r border-b lg:border-b-0 border-white/10' : ''}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    {plan.popular && (
                      <span className="rounded bg-[#573CFF] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
                        Más popular
                      </span>
                    )}
                  </div>
                  <p className="mb-4 text-sm leading-relaxed text-white/50">{plan.description}</p>
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
                      <Icon icon="solar:user-check-rounded-bold-duotone" className="h-4 w-4 text-[#A78BFA]" />
                      {plan.users} {plan.users === 1 ? 'usuario incluido' : 'usuarios incluidos'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60">
                      <Icon icon="solar:database-bold-duotone" className="h-4 w-4 text-white/40" />
                      {plan.storageGB} GB
                    </span>
                  </div>

                  {/* Selector de usuarios para este plan */}
                  <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-white/70">Usuarios</label>
                      <span className="text-[10px] text-white/40">
                        {extraCount > 0
                          ? `+${extraCount} extra · ${numberFormat(extraMonthly)}/mes`
                          : 'Solo incluidos'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setUsersFor(plan.name, Math.max(plan.users, users - 1))}
                        className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
                        aria-label="Quitar usuario"
                      >
                        <Icon icon="solar:minus-circle-linear" className="text-lg" />
                      </button>
                      <input
                        type="number"
                        min={plan.users}
                        value={users}
                        onChange={(e) => setUsersFor(plan.name, Math.max(plan.users, Number(e.target.value) || plan.users))}
                        className="w-full text-center border border-white/15 rounded-xl py-2 text-sm bg-white/5 text-white font-semibold focus:border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setUsersFor(plan.name, users + 1)}
                        className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
                        aria-label="Agregar usuario"
                      >
                        <Icon icon="solar:add-circle-linear" className="text-lg" />
                      </button>
                    </div>
                    <p className="text-[10px] text-white/40 mt-1.5">
                      Mínimo {plan.users}. Cada adicional: {numberFormat(EXTRA_USER_MONTHLY)}/mes
                      {extraCount >= PACK_THRESHOLD && ` (pack +5: ${numberFormat(EXTRA_USER_PACK5_MONTHLY)}/mes c/u)`}
                    </p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                        {period === 'annual' ? numberFormat(annualTotal) : numberFormat(monthlyPrice)}
                      </span>
                      <span className="text-sm font-medium text-white/50">
                        {period === 'annual' ? '/año' : '/mes'}
                      </span>
                    </div>
                    {period === 'annual' && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-white/50">
                          Equivale a {numberFormat(Math.round(annualTotal / 12))}/mes
                        </p>
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                          Ahorras {numberFormat(annualSavings)}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePlanSelect(plan)}
                    className={`mb-6 w-full rounded-xl py-3 text-center text-sm font-bold uppercase tracking-wider transition-colors ${
                      plan.popular
                        ? 'bg-[#573CFF] text-white hover:bg-[#4530cc]'
                        : 'bg-white/10 border border-white/15 text-white hover:bg-white/15'
                    }`}
                  >
                    Elegir plan
                  </button>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#A78BFA]" />
                        <span className="text-sm text-white/80">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectAppsFlow;
