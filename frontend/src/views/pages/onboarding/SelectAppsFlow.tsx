import { useState, useMemo, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useLocation, useNavigate } from 'react-router';
import { MODULES, ModuleKey, BillingPeriod, calculateTotals, numberFormat } from 'src/components/landingpage/pricing-calculator/modules';
import LogoSvg from 'src/assets/images/logos/Logo.svg';

// Definir categorías de aplicaciones para el flujo de selección
type AppCategory = {
  id: string;
  name: string;
  apps: typeof MODULES;
};

// Organizar módulos por categorías
const getAppCategories = (): AppCategory[] => {
  const operaciones = MODULES.filter(m => 
    ['clientes', 'polizas', 'siniestros', 'renovaciones', 'automoviles', 'seguimiento'].includes(m.key)
  );
  
  const ventas = MODULES.filter(m => 
    ['crm', 'cartera', 'comisiones', 'reportes'].includes(m.key)
  );
  
  const marketing = MODULES.filter(m => 
    ['whatsapp', 'email', 'miniweb', 'marca_blanca', 'sitio_web'].includes(m.key)
  );
  
  const inteligenciaArtificial = MODULES.filter(m => 
    ['ia_chatbot', 'ia_chatbot_sura', 'ia_callcenter', 'ia_predicciones', 'ia_ventas_cruzadas', 'lector_pdf_ia'].includes(m.key)
  );
  
  const finanzas = MODULES.filter(m => 
    ['facturacion_electronica', 'nomina_electronica'].includes(m.key)
  );
  
  const extras = MODULES.filter(m => 
    ['documentos', 'app_movil'].includes(m.key)
  );

  return [
    { id: 'operaciones', name: 'Operaciones', apps: operaciones },
    { id: 'ventas', name: 'Ventas', apps: ventas },
    { id: 'marketing', name: 'Marketing', apps: marketing },
    { id: 'ia', name: 'Inteligencia Artificial', apps: inteligenciaArtificial },
    { id: 'finanzas', name: 'Finanzas', apps: finanzas },
    { id: 'extras', name: 'Extras', apps: extras },
  ];
};

const SURA_LOGO_URL =
  'https://www.sura.co/documents/43501/0/Logo-SURA-blanco+1.svg/8937a328-d03b-7aa7-79bd-a5308a3931b3?version=1.0&t=1704405886717';

const SelectAppsFlow = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSuraFlow = location.pathname.startsWith('/sura');
  const basePath = isSuraFlow ? '/sura' : '/comenzar';
  // Preseleccionar módulos obligatorios
  const mandatoryKeys = useMemo(() => MODULES.filter((m) => m.mandatory).map((m) => m.key), []);
  
  // Inicializar con módulos obligatorios, luego cargar de localStorage
  const [selectedApps, setSelectedApps] = useState<Set<ModuleKey>>(() => {
    // Intentar cargar de localStorage primero
    const saved = localStorage.getItem('guro_selected_apps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ModuleKey[];
        const set = new Set<ModuleKey>(parsed);
        // Asegurar que los obligatorios estén incluidos
        MODULES.filter((m) => m.mandatory).forEach((m) => set.add(m.key));
        return set;
      } catch {
        // Si falla el parse, usar solo los obligatorios
      }
    }
    return new Set(MODULES.filter((m) => m.mandatory).map((m) => m.key));
  });
  
  // Cargar también periodo, usuarios y almacenamiento de localStorage
  const [period, setPeriod] = useState<BillingPeriod>(() => {
    const saved = localStorage.getItem('guro_pricing_selection');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.period || 'monthly';
      } catch {}
    }
    return 'monthly';
  });
  
  const [users, setUsers] = useState<number>(() => {
    const saved = localStorage.getItem('guro_pricing_selection');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.users || 1;
      } catch {}
    }
    return 1;
  });
  
  const [storageGB, setStorageGB] = useState<number>(() => {
    const saved = localStorage.getItem('guro_pricing_selection');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.storageGB || 10;
      } catch {}
    }
    return 10;
  });
  
  const categories = useMemo(() => getAppCategories(), []);

  // Garantizar que los obligatorios siempre estén presentes
  useEffect(() => {
    setSelectedApps((prev) => {
      const next = new Set(prev);
      mandatoryKeys.forEach((k) => next.add(k));
      return next;
    });
  }, [mandatoryKeys]);

  // Si se cambia a mensual, deseleccionar módulos solo-anual
  useMemo(() => {
    if (period === 'monthly') {
      setSelectedApps((prev) => {
        const next = new Set(prev);
        MODULES.filter((m) => m.annualOnly).forEach((m) => next.delete(m.key));
        return next;
      });
    }
  }, [period]);

  // Calcular totales
  const totals = useMemo(() => calculateTotals(selectedApps, users, period), [selectedApps, users, period]);

  // Calcular almacenamiento extra (10GB incluidos)
  const extraGB = Math.max(storageGB - 10, 0);
  const storageMonthly = extraGB * 2000;
  const storageAnnualBefore = storageMonthly * 12;
  const storageAnnualAfter = Math.round(storageAnnualBefore * 0.75);

  // Total anual SIN descuento del 12% (para flujo Sura que solo aplica 30%)
  const annualBeforeDiscount = useMemo(() => {
    if (period === 'annual') {
      return (totals as any).subtotalAnnual + (totals as any).discountAnnual + storageAnnualBefore;
    }
    return 0;
  }, [totals, period, storageAnnualBefore]);

  // Total final (con descuento 12% para flujo normal, sin descuento para Sura)
  const totalFinal = useMemo(() => {
    if (period === 'monthly') {
      return (totals as any).subtotalMonthly + storageMonthly;
    } else {
      // En flujo Sura, usar precio sin descuento 12% (solo aplicará 30% Sura)
      if (isSuraFlow) {
        return annualBeforeDiscount;
      }
      return (totals as any).subtotalAnnual + storageAnnualAfter;
    }
  }, [totals, period, storageMonthly, storageAnnualAfter, isSuraFlow, annualBeforeDiscount]);

  const toggleApp = (key: ModuleKey) => {
    const mod = MODULES.find((m) => m.key === key);
    if (mod?.mandatory) return; // no se puede desactivar obligatorios
    const disabledAnnualOnly = period === 'monthly' && !!mod?.annualOnly;
    if (disabledAnnualOnly) return;
    
    setSelectedApps(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectedModules = useMemo(() => {
    return MODULES.filter(m => selectedApps.has(m.key));
  }, [selectedApps]);

  // Descuento Sura (30% adicional solo en plan anual)
  const suraDiscount = isSuraFlow && period === 'annual' ? 0.30 : 0;
  const suraDiscountAmount = Math.round(totalFinal * suraDiscount);
  const totalWithSuraDiscount = totalFinal - suraDiscountAmount;

  const handleContinue = () => {
    // Guardar selección en localStorage (igual que /precios)
    const payload = { 
      users, 
      modules: Array.from(selectedApps), 
      totals, 
      storageGB, 
      period,
      // Guardar info del cupón Sura si aplica
      suraCoupon: isSuraFlow ? { code: 'SURA30', discount: 0.30, discountAmount: suraDiscountAmount } : null,
    };
    localStorage.setItem('guro_pricing_selection', JSON.stringify(payload));
    localStorage.setItem('guro_selected_apps', JSON.stringify(Array.from(selectedApps)));
    // Guardar flag de flujo Sura para mantenerlo en el registro
    if (isSuraFlow) {
      localStorage.setItem('guro_sura_flow', '1');
    } else {
      localStorage.removeItem('guro_sura_flow');
    }
    // Navegar al registro
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
        @keyframes onb-aurora-2 {
          0%, 100% { transform: translate3d(6%, 10%, 0) scale(1); }
          50% { transform: translate3d(-10%, -4%, 0) scale(1.12); }
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
        @keyframes onb-sync-spin { to { transform: rotate(360deg); } }
        .onb-sync-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          border-radius: 9999px;
          padding: 2px;
          overflow: hidden;
          filter: drop-shadow(0 0 14px rgba(87, 60, 255, 0.45));
          transition: filter 0.35s ease;
          cursor: pointer;
          border: none;
        }
        .onb-sync-btn:hover { filter: drop-shadow(0 0 22px rgba(87, 60, 255, 0.65)) drop-shadow(0 0 34px rgba(251, 146, 60, 0.3)); }
        .onb-sync-btn .onb-sync-track {
          position: absolute;
          inset: -60%;
          background: conic-gradient(from 0deg, #573CFF, #7B61FF, #A78BFA, #fb923c, #f97316, #573CFF);
          animation: onb-sync-spin 3.8s linear infinite;
        }
        .onb-sync-btn:hover .onb-sync-track { animation-duration: 2.2s; }
        .onb-sync-btn .onb-sync-inner {
          position: relative;
          z-index: 2;
          border-radius: 9999px;
          color: #fff;
          background: linear-gradient(180deg, #141414 0%, #000000 100%);
          transition: box-shadow 0.35s ease, background 0.35s ease;
          text-shadow: 0 1px 2px rgba(0,0,0,0.45);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          white-space: nowrap;
          width: 100%;
          height: 100%;
        }
        .onb-sync-btn:hover .onb-sync-inner {
          background:
            radial-gradient(ellipse 100% 80% at 50% 0%, rgba(87, 60, 255, 0.22) 0%, transparent 52%),
            linear-gradient(180deg, #1a1528 0%, #050508 100%);
          box-shadow:
            inset 0 0 28px rgba(123, 97, 255, 0.18),
            inset 0 -12px 32px rgba(251, 146, 60, 0.08),
            0 0 0 1px rgba(167, 139, 250, 0.12);
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
        /* Labels del onboarding siempre claros — gana al global label { color: #111827 } */
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

      {/* Noise grano — textura tipo landing */}
      <div
        className="pointer-events-none fixed inset-0 z-[3]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.4,
          mixBlendMode: 'overlay',
        }}
      />
      {/* Segunda capa de grano más fino */}
      <div
        className="pointer-events-none fixed inset-0 z-[3]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n2)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '140px 140px',
          opacity: 0.18,
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
                <img
                  src={SURA_LOGO_URL}
                  alt="Logo SURA"
                  className="h-12 md:h-16 w-auto"
                />
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
            <span className="text-white">Arma tu plan </span>
            <span className="onb-grad-text">a la medida</span>
          </h1>
          <p className="text-white/50 text-base max-w-lg mx-auto">
            Selecciona las aplicaciones que necesitas. Puedes cambiarlas en cualquier momento.
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

        {/* Bloque explicativo — cómo funciona el modelo de precios */}
        <div className="mb-10 rounded-2xl border border-white/10 p-5 sm:p-6 backdrop-blur-md bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-white/10 border border-white/15 flex items-center justify-center">
              <Icon icon="solar:info-circle-bold" className="text-white/70 text-xs" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em]">Cómo funcionan los precios</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Suscripción */}
            <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#573CFF]/15 border border-[#573CFF]/25">
                  <Icon icon="solar:card-bold" className="text-[#A78BFA] text-base" />
                </span>
                <span className="text-xs font-bold text-white">1. Suscripción</span>
              </div>
              <p className="text-[12px] text-white/60 leading-relaxed">
                Pagas una cuota fija por las apps y usuarios que elijas. Puedes cambiar tu plan cuando quieras.
              </p>
            </div>

            {/* 2. Incluido */}
            <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25">
                  <Icon icon="solar:gift-bold" className="text-emerald-300 text-base" />
                </span>
                <span className="text-xs font-bold text-white">2. Cuota base gratis</span>
              </div>
              <p className="text-[12px] text-white/60 leading-relaxed">
                Cada app de consumo incluye un volumen mensual sin costo extra. Ideal para empezar.
              </p>
            </div>

            {/* 3. Consumo wallet */}
            <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25">
                  <Icon icon="solar:wallet-2-bold" className="text-amber-300 text-base" />
                </span>
                <span className="text-xs font-bold text-white">3. Consumo extra</span>
              </div>
              <p className="text-[12px] text-white/60 leading-relaxed">
                ¿Necesitas más? Recargas tu <span className="text-white font-medium">wallet</span> y pagas solo lo que uses. Sin contratos ni sorpresas.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Grid de aplicaciones */}
          <div className="lg:col-span-3 space-y-10">
            {/* Included apps — always active */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-[#573CFF]/20 border border-[#573CFF]/30 flex items-center justify-center">
                  <Icon icon="solar:check-circle-bold" className="text-[#A78BFA] text-xs" />
                </div>
                <h2 className="text-xs font-bold text-white uppercase tracking-[0.15em]">
                  Incluido en tu plan
                </h2>
                <span className="text-[10px] text-white/40 font-medium ml-1">— Sin costo adicional</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {MODULES.filter(m => m.mandatory && !m.consumptionBased).map(app => (
                  <div
                    key={app.key}
                    className="flex items-center gap-3 p-4 rounded-xl border border-[#573CFF]/25 bg-[#573CFF]/[0.07] backdrop-blur-sm"
                  >
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${app.color}`}>
                      <Icon icon={app.icon} className="text-lg text-gray-800" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-white text-sm block truncate">{app.name}</span>
                      <span className="text-[11px] text-white/50 truncate block">{app.description}</span>
                    </div>
                    <Icon icon="solar:check-circle-bold" className="text-[#A78BFA] text-lg flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Consumption-based */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Icon icon="solar:bolt-bold" className="text-amber-300 text-xs" />
                </div>
                <h2 className="text-xs font-bold text-white uppercase tracking-[0.15em]">
                  Incluido — Pago por uso
                </h2>
                <span className="text-[10px] text-white/40 font-medium ml-1">— Cuota base gratis, pagas solo lo que uses</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {MODULES.filter(m => m.mandatory && m.consumptionBased).map(app => (
                  <div
                    key={app.key}
                    className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] backdrop-blur-sm"
                  >
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${app.color}`}>
                      <Icon icon={app.icon} className="text-lg text-gray-800" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-white text-sm block truncate">{app.name}</span>
                      <span className="text-[11px] text-white/50 truncate block">{app.description}</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-semibold border border-amber-500/30 flex-shrink-0">Por uso</span>
                  </div>
                ))}
              </div>

              {/* Tarifas de consumo */}
              <div
                className="mt-5 rounded-xl border border-amber-500/15 backdrop-blur-md overflow-hidden"
                style={{
                  background:
                    'radial-gradient(140% 140% at 0% 0%, rgba(245, 158, 11, 0.08) 0%, transparent 55%), rgba(10,10,15,0.55)',
                }}
              >
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <Icon icon="solar:dollar-minimalistic-bold" className="text-amber-300" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em]">Tarifas de consumo</h3>
                  <span className="text-[10px] text-white/40 font-medium">— precios referenciales COP</span>
                </div>

                {/* WhatsApp rates */}
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="logos:whatsapp-icon" className="text-base" />
                    <span className="text-[12px] font-bold text-white">WhatsApp Marketing · tarifas Meta</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                      <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Marketing</p>
                      <p className="text-white font-bold">~$158 <span className="text-white/40 font-normal">/ conv.</span></p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                      <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Utilidad</p>
                      <p className="text-white font-bold">~$55 <span className="text-white/40 font-normal">/ conv.</span></p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                      <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Autenticación</p>
                      <p className="text-white font-bold">~$37 <span className="text-white/40 font-normal">/ conv.</span></p>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/40 mt-2">
                    1 conversación = ventana de 24h con el mismo contacto. Todo envío se factura por consumo y se descuenta de tu Wallet.
                  </p>
                </div>

                {/* Otras tarifas — apps incluidas con cuota base */}
                <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Asistente IA</p>
                    <p className="text-emerald-300 font-bold">Incluido</p>
                    <p className="text-[10px] text-emerald-300 font-medium">✓ 1,000 conv./mes · Extra desde Wallet</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Call Center IA</p>
                    <p className="text-white font-bold">~$420 <span className="text-white/40 font-normal">/ minuto</span></p>
                    <p className="text-[10px] text-emerald-300 font-medium">✓ Incluye 60 min/mes</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Email Marketing</p>
                    <p className="text-white font-bold">~$12 <span className="text-white/40 font-normal">/ envío</span></p>
                    <p className="text-[10px] text-emerald-300 font-medium">✓ Incluye 2,000/mes</p>
                  </div>
                </div>

                {/* Wallet nota */}
                <div className="px-4 py-3 border-t border-white/5 bg-amber-500/[0.04] flex items-start gap-2">
                  <Icon icon="solar:wallet-2-bold" className="text-amber-300 text-base flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Cuando superas la cuota base, el consumo se descuenta de tu <span className="text-white font-semibold">Wallet Guro</span>.
                    Recargas cuando quieras desde el dashboard. Sin contratos ni sorpresas.
                  </p>
                </div>
              </div>
            </div>

            {/* Optional apps — user can select/deselect */}
            {categories.map(category => {
              const optionalApps = category.apps.filter(a => !a.mandatory);
              if (optionalApps.length === 0) return null;
              const selectedInCat = optionalApps.filter(a => selectedApps.has(a.key)).length;
              return (
                <div key={category.id}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-md bg-white/10 border border-white/15 flex items-center justify-center">
                      <Icon icon="solar:add-circle-bold" className="text-white/60 text-xs" />
                    </div>
                    <h2 className="text-xs font-bold text-white uppercase tracking-[0.15em]">
                      {category.name}
                    </h2>
                    {selectedInCat > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#573CFF]/20 text-[#A78BFA] font-bold border border-[#573CFF]/30">
                        {selectedInCat}/{optionalApps.length}
                      </span>
                    )}
                    <span className="text-[10px] text-white/40 font-medium ml-1">— Selecciona los que necesites</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {optionalApps.map(app => {
                      const isSelected = selectedApps.has(app.key);
                      const disabledAnnualOnly = period === 'monthly' && !!app.annualOnly;

                      return (
                        <button
                          key={app.key}
                          onClick={() => toggleApp(app.key)}
                          disabled={disabledAnnualOnly}
                          className={`
                            relative flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 text-left backdrop-blur-sm
                            ${isSelected
                              ? 'border-[#A78BFA]/50 bg-[#573CFF]/[0.12] shadow-[0_0_24px_-8px_rgba(167,139,250,0.4)] ring-1 ring-[#A78BFA]/20'
                              : 'border-white/10 bg-white/[0.03] hover:border-[#A78BFA]/30 hover:bg-white/[0.06]'
                            }
                            ${disabledAnnualOnly ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          {/* Toggle circle */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                            isSelected ? 'border-[#A78BFA] bg-[#573CFF]' : 'border-white/25'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${app.color} flex-shrink-0`}>
                                <Icon icon={app.icon} className="text-base text-gray-800" />
                              </span>
                              <div className="min-w-0">
                                <span className="font-semibold text-white text-sm block leading-tight truncate">{app.name}</span>
                                <span className="text-[11px] text-white/50 leading-tight block truncate">{app.description}</span>
                              </div>
                            </div>

                            {/* Price tag */}
                            <div className="mt-2.5 flex items-center gap-1.5">
                              <span className={`text-xs font-bold ${isSelected ? 'text-[#A78BFA]' : 'text-white/55'}`}>
                                {(() => {
                                  if (app.annualOnly) {
                                    if (period === 'annual' && app.annualPrice && app.annualPrice > 0)
                                      return `${numberFormat(app.annualPrice)}/año`;
                                    return 'Solo plan anual';
                                  }
                                  if (period === 'monthly') return `${numberFormat(app.pricePerUser)}/mes`;
                                  return `${numberFormat(app.pricePerUser * 12)}/año`;
                                })()}
                              </span>
                              {app.consumptionBased && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-semibold border border-amber-500/30">+ uso</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Configuración de usuarios y almacenamiento */}
            <div
              className="onb-dark-form p-5 rounded-2xl border border-white/10 backdrop-blur-md"
              style={{
                background:
                  'radial-gradient(120% 120% at 0% 0%, rgba(87, 60, 255, 0.08) 0%, transparent 50%), rgba(10, 10, 15, 0.55)',
              }}
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded-md bg-white/10 border border-white/15 flex items-center justify-center">
                  <Icon icon="solar:settings-bold" className="text-white/60 text-xs" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em]">Configuración</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-semibold mb-2 block text-white/90">Usuarios</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUsers((v) => Math.max(1, v - 1))}
                      className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white font-medium transition"
                    >
                      <Icon icon="solar:minus-circle-linear" className="text-lg" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={users}
                      onChange={(e) => setUsers(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 text-center border border-white/15 rounded-xl py-2 text-sm bg-white/5 text-white font-semibold focus:border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none"
                    />
                    <button
                      onClick={() => setUsers((v) => v + 1)}
                      className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white font-medium transition"
                    >
                      <Icon icon="solar:add-circle-linear" className="text-lg" />
                    </button>
                  </div>
                  <p className="text-[11px] text-white/40 mt-1.5">El primer usuario está incluido sin costo</p>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block text-white/90">Almacenamiento (GB)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStorageGB((v) => Math.max(10, v - 1))}
                      className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white font-medium transition"
                    >
                      <Icon icon="solar:minus-circle-linear" className="text-lg" />
                    </button>
                    <input
                      type="number"
                      min={10}
                      value={storageGB}
                      onChange={(e) => setStorageGB(Math.max(10, Number(e.target.value) || 10))}
                      className="w-16 text-center border border-white/15 rounded-xl py-2 text-sm bg-white/5 text-white font-semibold focus:border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none"
                    />
                    <button
                      onClick={() => setStorageGB((v) => v + 1)}
                      className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white font-medium transition"
                    >
                      <Icon icon="solar:add-circle-linear" className="text-lg" />
                    </button>
                  </div>
                  <p className="text-[11px] text-white/40 mt-1.5">10 GB incluidos en tu plan</p>
                </div>
              </div>
            </div>
          </div>

          {/* Panel lateral - Resumen */}
          <div className="lg:col-span-1">
            <div
              className="lg:sticky lg:top-24 rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
              style={{
                background:
                  'radial-gradient(120% 120% at 0% 0%, rgba(87, 60, 255, 0.14) 0%, transparent 50%), radial-gradient(120% 120% at 100% 100%, rgba(251, 146, 60, 0.08) 0%, transparent 50%), rgba(10, 10, 15, 0.72)',
                boxShadow: '0 20px 60px -15px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.05)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Resumen</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                  {selectedModules.length} apps
                </span>
              </div>

              {/* Included apps */}
              <div className="mb-3">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Incluido</p>
                <div className="space-y-1.5">
                  {selectedModules.filter(a => a.mandatory).map(app => (
                    <div key={app.key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${app.color} flex-shrink-0`}>
                          <Icon icon={app.icon} className="text-[10px] text-gray-800" />
                        </span>
                        <span className="text-[11px] font-medium text-white/90 truncate">{app.name}</span>
                      </div>
                      <span className="text-[10px] text-[#A78BFA] font-semibold flex-shrink-0">Gratis</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paid apps */}
              {selectedModules.filter(a => !a.mandatory).length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Adicionales</p>
                  <div className="space-y-1.5">
                    {selectedModules.filter(a => !a.mandatory).map(app => (
                      <div key={app.key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${app.color} flex-shrink-0`}>
                            <Icon icon={app.icon} className="text-[10px] text-gray-800" />
                          </span>
                          <span className="text-[11px] font-medium text-white/90 truncate">{app.name}</span>
                        </div>
                        <span className="text-[10px] text-white/60 font-medium flex-shrink-0">
                          {app.annualOnly
                            ? (app.annualPrice ? numberFormat(app.annualPrice) : '-')
                            : (period === 'monthly' ? numberFormat(app.pricePerUser) : numberFormat(app.pricePerUser * 12))
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Desglose de precios */}
              <div className="border-t border-white/10 pt-3 mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">Base plataforma</span>
                  <span className="font-medium text-white/90">
                    {period === 'monthly'
                      ? numberFormat((totals as any).baseMonthly)
                      : numberFormat((totals as any).baseAnnual)
                    }
                  </span>
                </div>
                {(totals as any).users.billableUsers > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/50">
                      Usuarios ({(totals as any).users.billableUsers} × {numberFormat((totals as any).users.perUserMonthly)})
                    </span>
                    <span className="font-medium text-white/90">
                      {period === 'monthly'
                        ? numberFormat((totals as any).users.usersMonthly)
                        : numberFormat((totals as any).users.usersAnnualTotal)
                      }
                    </span>
                  </div>
                )}
                {extraGB > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Almacenamiento extra ({extraGB} GB)</span>
                    <span className="font-medium text-white/90">
                      {period === 'monthly' ? numberFormat(storageMonthly) : numberFormat(storageAnnualBefore)}
                    </span>
                  </div>
                )}
                {period === 'annual' && !isSuraFlow && (
                  <div className="flex justify-between text-emerald-300">
                    <span>Descuento 12%</span>
                    <span>-{numberFormat((totals as any).discountAnnual + (storageAnnualBefore - storageAnnualAfter))}</span>
                  </div>
                )}
                {isSuraFlow && period === 'annual' && suraDiscountAmount > 0 && (
                  <div className="flex justify-between text-[#00A1E4] font-medium">
                    <span>Cupón SURA30 (-30%)</span>
                    <span>-{numberFormat(suraDiscountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-sm items-baseline">
                  <span className="text-white">Total {period === 'monthly' ? 'mensual' : 'anual'}</span>
                  <span className={`text-lg ${isSuraFlow && period === 'annual' ? 'text-[#00A1E4]' : 'onb-grad-text'}`}>
                    {numberFormat(isSuraFlow && period === 'annual' ? totalWithSuraDiscount : totalFinal)}
                  </span>
                </div>
                {isSuraFlow && period === 'annual' && (
                  <div className="text-[10px] text-white/40 line-through text-right">
                    Antes: {numberFormat(totalFinal)}
                  </div>
                )}
              </div>

              {/* Info de prueba */}
              <div className="rounded-xl p-3 mb-4 border border-[#A78BFA]/25 bg-[#573CFF]/[0.1] backdrop-blur-sm">
                <div className="flex items-start gap-2">
                  <Icon icon="solar:gift-bold" className="text-[#A78BFA] text-lg flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-[#A78BFA] font-semibold">Prueba gratuita de 7 días</p>
                    <p className="text-xs text-white/60 mt-1">No necesitas tarjeta de crédito.</p>
                    <p className="text-[10px] text-white/40 mt-1.5">
                      Precio {period === 'monthly' ? 'mensual' : 'anual'} una vez finalizada la prueba.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón continuar — estilo hero de la landing */}
              <button
                type="button"
                onClick={handleContinue}
                className="onb-sync-btn w-full h-[52px]"
                style={{ letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '12px', fontWeight: 700 }}
              >
                <span className="onb-sync-track" />
                <span className="onb-sync-inner">
                  <span>Continuar</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </span>
              </button>

              <p className="text-[10px] text-white/40 mt-3 text-center">
                Precios en COP. Servicio exento de IVA.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sticky bar (mobile) — total + botón continuar para acceso rápido */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-black/80 backdrop-blur-2xl p-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Total {period === 'monthly' ? 'mensual' : 'anual'}</p>
            <p className={`text-lg font-bold truncate ${isSuraFlow && period === 'annual' ? 'text-[#00A1E4]' : 'onb-grad-text'}`}>
              {numberFormat(isSuraFlow && period === 'annual' ? totalWithSuraDiscount : totalFinal)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            className="onb-sync-btn h-[44px] px-5 flex-shrink-0"
            style={{ letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}
          >
            <span className="onb-sync-track" />
            <span className="onb-sync-inner px-4">
              Continuar
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectAppsFlow;
