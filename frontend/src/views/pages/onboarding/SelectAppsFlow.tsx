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
    <div className="min-h-screen bg-[#fafafa]" style={{ fontFamily: "'General Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/">
            <img src={LogoSvg} alt="Guro" className="h-8 w-auto" />
          </a>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-[#573CFF] text-white text-xs font-bold flex items-center justify-center">1</span>
              <span className="text-xs font-semibold text-[#0d0d0d]">Aplicaciones</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className="flex items-center gap-1.5 opacity-40">
              <span className="w-6 h-6 rounded-full bg-gray-300 text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-xs font-medium text-gray-400">Registro</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero gradient banner */}
      {!isSuraFlow && (
        <div className="bg-gradient-to-b from-[#573CFF]/[0.04] to-transparent">
          <div className="max-w-7xl mx-auto px-4 pt-12 pb-2 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-medium text-gray-500">Prueba gratuita de 7 días — Sin tarjeta de crédito</span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pb-10 pt-2">
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

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-[2.75rem] font-bold text-[#0d0d0d] mb-3 tracking-[-0.03em] leading-[1.1]">
            Arma tu plan <span className="text-[#573CFF]">a la medida</span>
          </h1>
          <p className="text-gray-400 text-base max-w-lg mx-auto">
            Selecciona las aplicaciones que necesitas. Puedes cambiarlas en cualquier momento.
          </p>
          {/* Toggle de periodo */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 bg-[#f0f0f0] rounded-full p-1">
              <button
                type="button"
                onClick={() => setPeriod('monthly' as BillingPeriod)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  period === 'monthly' ? 'bg-white text-[#0d0d0d] shadow-sm' : 'text-gray-400'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setPeriod('annual' as BillingPeriod)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  period === 'annual' ? 'bg-white text-[#0d0d0d] shadow-sm' : 'text-gray-400'
                }`}
              >
                Anual
              </button>
            </div>
            <span className={`ml-1 text-xs font-bold px-2.5 py-1 rounded-full ${
              isSuraFlow 
                ? 'text-[#0033A0] bg-[#00A1E4]/10 border border-[#00A1E4]/30' 
                : 'text-[#573CFF] bg-[#573CFF]/10'
            }`}>
              {isSuraFlow ? '-30%' : '-12%'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Grid de aplicaciones */}
          <div className="lg:col-span-3 space-y-10">
            {/* Included apps — always active, no action needed */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-md bg-[#573CFF]/10 flex items-center justify-center">
                  <Icon icon="solar:check-circle-bold" className="text-[#573CFF] text-xs" />
                </div>
                <h2 className="text-xs font-bold text-[#0d0d0d] uppercase tracking-[0.1em]">
                  Incluido en tu plan
                </h2>
                <span className="text-[10px] text-gray-400 font-medium ml-1">— Sin costo adicional</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {MODULES.filter(m => m.mandatory && !m.consumptionBased).map(app => (
                  <div
                    key={app.key}
                    className="flex items-center gap-3 p-4 rounded-xl border border-[#573CFF]/20 bg-[#573CFF]/[0.03]"
                  >
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${app.color}`}>
                      <Icon icon={app.icon} className="text-lg text-gray-700" />
                    </span>
                    <div className="flex-1">
                      <span className="font-medium text-[#0d0d0d] text-sm block">{app.name}</span>
                      <span className="text-[11px] text-gray-400">{app.description}</span>
                    </div>
                    <Icon icon="solar:check-circle-bold" className="text-[#573CFF] text-lg flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Consumption-based — included but pay per use */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center">
                  <Icon icon="solar:bolt-bold" className="text-amber-600 text-xs" />
                </div>
                <h2 className="text-xs font-bold text-[#0d0d0d] uppercase tracking-[0.1em]">
                  Incluido — Pago por uso
                </h2>
                <span className="text-[10px] text-gray-400 font-medium ml-1">— Cuota base gratis, pagas solo lo que uses</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {MODULES.filter(m => m.mandatory && m.consumptionBased).map(app => (
                  <div
                    key={app.key}
                    className="flex items-center gap-3 p-4 rounded-xl border border-amber-200/60 bg-amber-50/30"
                  >
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${app.color}`}>
                      <Icon icon={app.icon} className="text-lg text-gray-700" />
                    </span>
                    <div className="flex-1">
                      <span className="font-medium text-[#0d0d0d] text-sm block">{app.name}</span>
                      <span className="text-[11px] text-gray-400">{app.description}</span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Por uso</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional apps — user can select/deselect */}
            {categories.map(category => {
              const optionalApps = category.apps.filter(a => !a.mandatory);
              if (optionalApps.length === 0) return null;
              return (
                <div key={category.id}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center">
                      <Icon icon="solar:add-circle-bold" className="text-gray-400 text-xs" />
                    </div>
                    <h2 className="text-xs font-bold text-[#0d0d0d] uppercase tracking-[0.1em]">
                      {category.name}
                    </h2>
                    <span className="text-[10px] text-gray-400 font-medium ml-1">— Selecciona los que necesites</span>
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
                            relative flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 text-left
                            ${isSelected 
                              ? 'border-[#573CFF] bg-[#573CFF]/5 shadow-sm ring-1 ring-[#573CFF]/20' 
                              : 'border-gray-200 bg-white hover:border-[#573CFF]/40 hover:shadow-sm'
                            }
                            ${disabledAnnualOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          {/* Toggle circle */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                            isSelected ? 'border-[#573CFF] bg-[#573CFF]' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${app.color}`}>
                                <Icon icon={app.icon} className="text-base text-gray-700" />
                              </span>
                              <div>
                                <span className="font-semibold text-[#0d0d0d] text-sm block leading-tight">{app.name}</span>
                                <span className="text-[11px] text-gray-400 leading-tight">{app.description}</span>
                              </div>
                            </div>
                            
                            {/* Price tag */}
                            <div className="mt-2.5 flex items-center gap-1.5">
                              <span className={`text-xs font-bold ${isSelected ? 'text-[#573CFF]' : 'text-gray-500'}`}>
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
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">+ uso</span>
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
            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center">
                  <Icon icon="solar:settings-bold" className="text-gray-400 text-xs" />
                </div>
                <h3 className="text-xs font-bold text-[#0d0d0d] uppercase tracking-[0.1em]">Configuración</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-semibold mb-2 block text-[#0d0d0d]">Usuarios</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUsers((v) => Math.max(1, v - 1))}
                      className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 font-medium transition"
                    >
                      <Icon icon="solar:minus-circle-linear" className="text-lg" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={users}
                      onChange={(e) => setUsers(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 text-center border border-gray-200 rounded-xl py-2 text-sm bg-white text-[#0d0d0d] font-semibold focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none"
                    />
                    <button
                      onClick={() => setUsers((v) => v + 1)}
                      className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 font-medium transition"
                    >
                      <Icon icon="solar:add-circle-linear" className="text-lg" />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">El primer usuario está incluido sin costo</p>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block text-[#0d0d0d]">Almacenamiento</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStorageGB((v) => Math.max(10, v - 1))}
                      className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 font-medium transition"
                    >
                      <Icon icon="solar:minus-circle-linear" className="text-lg" />
                    </button>
                    <input
                      type="number"
                      min={10}
                      value={storageGB}
                      onChange={(e) => setStorageGB(Math.max(10, Number(e.target.value) || 10))}
                      className="w-16 text-center border border-gray-200 rounded-xl py-2 text-sm bg-white text-[#0d0d0d] font-semibold focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none"
                    />
                    <button
                      onClick={() => setStorageGB((v) => v + 1)}
                      className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 font-medium transition"
                    >
                      <Icon icon="solar:add-circle-linear" className="text-lg" />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">10 GB incluidos en tu plan</p>
                </div>
              </div>
            </div>
          </div>

          {/* Panel lateral - Resumen */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#0d0d0d] mb-4">
                Resumen
              </h3>
              
              {/* Included apps */}
              <div className="mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Incluido</p>
                <div className="space-y-1.5">
                  {selectedModules.filter(a => a.mandatory).map(app => (
                    <div key={app.key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${app.color}`}>
                          <Icon icon={app.icon} className="text-[10px] text-gray-700" />
                        </span>
                        <span className="text-[11px] font-medium text-[#0d0d0d]">{app.name}</span>
                      </div>
                      <span className="text-[10px] text-[#573CFF] font-semibold">Gratis</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paid apps */}
              {selectedModules.filter(a => !a.mandatory).length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Adicionales</p>
                  <div className="space-y-1.5">
                    {selectedModules.filter(a => !a.mandatory).map(app => (
                      <div key={app.key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${app.color}`}>
                            <Icon icon={app.icon} className="text-[10px] text-gray-700" />
                          </span>
                          <span className="text-[11px] font-medium text-[#0d0d0d]">{app.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">
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
              <div className="border-t border-gray-100 pt-3 mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Base plataforma</span>
                  <span className="font-medium">
                    {period === 'monthly' 
                      ? numberFormat((totals as any).baseMonthly)
                      : numberFormat((totals as any).baseAnnual)
                    }
                  </span>
                </div>
                {(totals as any).users.billableUsers > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Usuarios ({(totals as any).users.billableUsers} × {numberFormat((totals as any).users.perUserMonthly)})
                    </span>
                    <span className="font-medium">
                      {period === 'monthly'
                        ? numberFormat((totals as any).users.usersMonthly)
                        : numberFormat((totals as any).users.usersAnnualTotal)
                      }
                    </span>
                  </div>
                )}
                {extraGB > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Almacenamiento extra ({extraGB} GB)</span>
                    <span className="font-medium">
                      {period === 'monthly' ? numberFormat(storageMonthly) : numberFormat(storageAnnualBefore)}
                    </span>
                  </div>
                )}
                {period === 'annual' && !isSuraFlow && (
                  <div className="flex justify-between text-green-600">
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
                <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-sm">
                  <span className="text-[#0d0d0d]">Total {period === 'monthly' ? 'mensual' : 'anual'}</span>
                  <span className={isSuraFlow && period === 'annual' ? 'text-[#00A1E4]' : 'text-[#573CFF]'}>
                    {numberFormat(isSuraFlow && period === 'annual' ? totalWithSuraDiscount : totalFinal)}
                  </span>
                </div>
                {isSuraFlow && period === 'annual' && (
                  <div className="text-[10px] text-gray-400 line-through text-right">
                    Antes: {numberFormat(totalFinal)}
                  </div>
                )}
              </div>

              {/* Info de prueba */}
              <div className="bg-[#573CFF]/5 border border-[#573CFF]/15 rounded-xl p-3 mb-4">
                <p className="text-sm text-[#573CFF] font-semibold">
                  Prueba gratuita de 7 días
                </p>
                <p className="text-xs text-[#573CFF]/70 mt-1">
                  No necesitas tarjeta de crédito.
                </p>
                <p className="text-[10px] text-gray-500 mt-2">
                  Precio {period === 'monthly' ? 'mensual' : 'anual'} una vez finalizada la prueba gratuita.
                </p>
              </div>

              {/* Botón continuar — Hero style */}
              <button
                onClick={handleContinue}
                className="group relative w-full inline-flex items-center justify-center bg-[#0d0d0d] rounded-2xl h-[52px] overflow-hidden cursor-pointer"
              >
                <span className="absolute inset-y-0 left-0 w-[52px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
                <span className="relative z-10 flex items-center justify-center w-[52px] h-full flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </span>
                <span className="relative z-10 pr-6 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
                  Continuar
                </span>
              </button>

              <p className="text-[10px] text-gray-500 mt-3 text-center">
                Precios en COP. Servicio exento de IVA.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectAppsFlow;
