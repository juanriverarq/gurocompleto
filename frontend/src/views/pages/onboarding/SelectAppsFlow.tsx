import { useState, useMemo, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useLocation, useNavigate } from 'react-router';
import { MODULES, ModuleKey, BillingPeriod, calculateTotals, numberFormat } from 'src/components/landingpage/pricing-calculator/modules';
import Logo from 'src/layouts/full/shared/logo/Logo';

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
    ['ia_chatbot', 'ia_callcenter', 'ia_predicciones', 'ia_ventas_cruzadas', 'lector_pdf_ia'].includes(m.key)
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
    <div className="min-h-screen bg-white dark:bg-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-dark border-b border-gray-200 dark:border-darkborder">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="text-sm text-gray-500 font-medium">
            Paso 1 de 2
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-10">
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
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-dark dark:text-white mb-3">
            Elige tus <span className="text-primary">Aplicaciones</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-base">
            Acceso gratis e instantáneo. No necesitas tarjeta de crédito.
          </p>
          {/* Toggle de periodo */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className={`text-sm ${period === 'monthly' ? 'font-semibold text-primary' : 'text-gray-500'}`}>
              Mensual
            </span>
            <button
              type="button"
              onClick={() => setPeriod((p) => (p === 'monthly' ? 'annual' : 'monthly'))}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition shadow-sm ${
                period === 'annual' ? 'bg-primary' : 'bg-gray-300'
              }`}
              aria-label="Cambiar periodo de facturación"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                  period === 'annual' ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${period === 'annual' ? 'font-semibold text-primary' : 'text-gray-500'}`}>
              Anual
            </span>
            <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isSuraFlow 
                ? 'text-[#0033A0] bg-[#00A1E4]/10 border border-[#00A1E4]/30' 
                : 'text-green-700 bg-green-50 border border-green-200'
            }`}>
              {isSuraFlow ? '-30%' : '-12%'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Grid de aplicaciones */}
          <div className="lg:col-span-3">
            {categories.map(category => (
              <div key={category.id} className="mb-8">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                  {category.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {category.apps.map(app => {
                    const isSelected = selectedApps.has(app.key);
                    const isMandatory = !!app.mandatory;
                    const disabledAnnualOnly = period === 'monthly' && !!app.annualOnly;
                    
                    return (
                      <button
                        key={app.key}
                        onClick={() => toggleApp(app.key)}
                        disabled={isMandatory || disabledAnnualOnly}
                        className={`
                          relative flex items-center gap-3 p-4 rounded-xl border transition-all duration-200
                          ${isSelected 
                            ? 'border-primary bg-primary/5 shadow-sm' 
                            : 'border-gray-200 dark:border-darkborder bg-white dark:bg-darkgray hover:border-primary/50 hover:shadow-sm'
                          }
                          ${isMandatory ? 'cursor-default' : ''}
                          ${disabledAnnualOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {/* Icono */}
                        <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${app.color}`}>
                          <Icon icon={app.icon} className="text-xl text-gray-700" />
                        </span>
                        
                        {/* Contenido */}
                        <div className="flex-1 text-left">
                          <span className="font-medium text-dark dark:text-white text-sm block">{app.name}</span>
                          {/* Precio y badge consumo */}
                          {!isMandatory && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-primary font-semibold">
                                {(() => {
                                  if (app.annualOnly) {
                                    if (period === 'annual' && app.annualPrice && app.annualPrice > 0)
                                      return `${numberFormat(app.annualPrice)}/año`;
                                    return 'Solo anual';
                                  }
                                  if (period === 'monthly') return `${numberFormat(app.pricePerUser)}/mes`;
                                  return `${numberFormat(app.pricePerUser * 12)}/año`;
                                })()}
                              </span>
                              {app.consumptionBased && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Por consumo</span>
                              )}
                            </div>
                          )}
                          {isMandatory && app.consumptionBased && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Por consumo</span>
                          )}
                        </div>
                        
                        {/* Badge Incluido */}
                        {isMandatory && (
                          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-primary text-white font-semibold">
                            Incluido
                          </span>
                        )}
                        
                        {/* Badge Solo anual */}
                        {disabledAnnualOnly && (
                          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                            Solo anual
                          </span>
                        )}
                        
                        {/* Check indicator */}
                        {isSelected && !isMandatory && (
                          <div className="absolute top-2 right-2">
                            <Icon 
                              icon="solar:check-circle-bold" 
                              className="text-primary text-lg"
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Configuración de usuarios y almacenamiento */}
            <div className="mt-4 p-4 bg-gray-50 dark:bg-darkgray rounded-xl border border-gray-200 dark:border-darkborder">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Configuración</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block text-gray-600 dark:text-gray-400">Usuarios</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUsers((v) => Math.max(1, v - 1))}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-darkborder hover:bg-gray-100 dark:hover:bg-dark flex items-center justify-center"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={users}
                      onChange={(e) => setUsers(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 text-center border border-gray-300 dark:border-darkborder rounded py-1 text-sm bg-white dark:bg-dark"
                    />
                    <button
                      onClick={() => setUsers((v) => v + 1)}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-darkborder hover:bg-gray-100 dark:hover:bg-dark flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">1er usuario gratis</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block text-gray-600 dark:text-gray-400">Almacenamiento (GB)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStorageGB((v) => Math.max(10, v - 1))}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-darkborder hover:bg-gray-100 dark:hover:bg-dark flex items-center justify-center"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={10}
                      value={storageGB}
                      onChange={(e) => setStorageGB(Math.max(10, Number(e.target.value) || 10))}
                      className="w-16 text-center border border-gray-300 dark:border-darkborder rounded py-1 text-sm bg-white dark:bg-dark"
                    />
                    <button
                      onClick={() => setStorageGB((v) => v + 1)}
                      className="w-8 h-8 rounded border border-gray-300 dark:border-darkborder hover:bg-gray-100 dark:hover:bg-dark flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">10 GB incluidos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Panel lateral - Resumen */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white dark:bg-darkgray rounded-xl border border-gray-200 dark:border-darkborder p-5 shadow-sm">
              <h3 className="text-base font-bold text-dark dark:text-white mb-4">
                Resumen
              </h3>
              
              {/* Lista de apps seleccionadas */}
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {selectedModules.map(app => (
                  <div key={app.key} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${app.color}`}>
                        <Icon icon={app.icon} className="text-sm text-gray-700" />
                      </span>
                      <span className="text-xs font-medium text-dark dark:text-white">{app.name}</span>
                    </div>
                    {app.mandatory ? (
                      <span className="text-[10px] text-green-600 font-medium">Incluido</span>
                    ) : (
                      <span className="text-[10px] text-gray-500">
                        {app.annualOnly 
                          ? (app.annualPrice ? numberFormat(app.annualPrice) : '-')
                          : (period === 'monthly' ? numberFormat(app.pricePerUser) : numberFormat(app.pricePerUser * 12))
                        }
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Desglose de precios */}
              <div className="border-t border-gray-200 dark:border-darkborder pt-3 mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Base plataforma</span>
                  <span className="font-medium">
                    {period === 'monthly' 
                      ? numberFormat((totals as any).baseMonthly)
                      : numberFormat((totals as any).baseAnnual)
                    }
                  </span>
                </div>
                {(totals as any).users.billableUsers > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
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
                    <span className="text-gray-600 dark:text-gray-400">Almacenamiento extra ({extraGB} GB)</span>
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
                <div className="border-t border-gray-200 dark:border-darkborder pt-2 flex justify-between font-bold text-sm">
                  <span>Total {period === 'monthly' ? 'mensual' : 'anual'}</span>
                  <span className={isSuraFlow && period === 'annual' ? 'text-[#00A1E4]' : 'text-primary'}>
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
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-4">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  ✅ Prueba gratuita de 7 días
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  No necesitas tarjeta de crédito.
                </p>
                <p className="text-[10px] text-gray-500 mt-2">
                  Precio {period === 'monthly' ? 'mensual' : 'anual'} una vez finalizada la prueba gratuita.
                </p>
              </div>

              {/* Botón continuar */}
              <button
                onClick={handleContinue}
                className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all text-sm bg-secondary hover:bg-secondaryemphasis cursor-pointer"
              >
                Continuar
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
