import { useState, useMemo, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { MODULES, calculateTotals, numberFormat, ModuleKey, BillingPeriod } from 'src/components/landingpage/pricing-calculator/modules';
import api from 'src/config/api';

const SURA_LOGO_URL =
  'https://www.sura.co/documents/43501/0/Logo-SURA-blanco+1.svg/8937a328-d03b-7aa7-79bd-a5308a3931b3?version=1.0&t=1704405886717';

const UpgradePlan = () => {
  const { tenant, trialEndsAt } = useUnifiedAuth();
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [users, setUsers] = useState(1);
  const [storageGB, setStorageGB] = useState(10);
  const [selectedModules, setSelectedModules] = useState<Set<ModuleKey>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<any>(null);
  const [loadingIntent, setLoadingIntent] = useState(true);

  // Cargar subscription_intent pendiente del usuario
  useEffect(() => {
    const loadPendingIntent = async () => {
      try {
        const resp = await api.get('/billing/status');
        const data = resp.data?.data || {};
        if (data.pending_intent) {
          setPendingIntent(data.pending_intent);
          // Cargar datos del intent
          const intent = data.pending_intent;
          if (intent.period) setPeriod(intent.period);
          if (intent.users_count) setUsers(intent.users_count);
          if (intent.storage_gb) setStorageGB(intent.storage_gb);
          if (intent.modules && Array.isArray(intent.modules)) {
            setSelectedModules(new Set(intent.modules as ModuleKey[]));
          }
        }
      } catch (e) {
        console.error('Error loading pending intent:', e);
      } finally {
        setLoadingIntent(false);
      }
    };
    loadPendingIntent();
  }, []);

  // Cargar módulos del broker (features) si no hay intent pendiente
  useEffect(() => {
    if (!loadingIntent && !pendingIntent && tenant) {
      const t = tenant as any;
      const features = t.features || [];
      if (features.length > 0) {
        setSelectedModules(new Set(features as ModuleKey[]));
      } else {
        // Si no hay features, seleccionar los obligatorios
        const mandatory = MODULES.filter(m => m.mandatory).map(m => m.key);
        setSelectedModules(new Set(mandatory));
      }
      // Establecer usuarios basado en max_users del broker
      if (t.max_users) {
        setUsers(t.max_users);
      }
    }
  }, [tenant, loadingIntent, pendingIntent]);

  // Detectar cupón Sura
  const suraCoupon = pendingIntent?.coupon;
  const hasSuraCoupon = suraCoupon?.code === 'SURA30';

  // Calcular totales
  const totals = useMemo(() => calculateTotals(selectedModules, users, period), [selectedModules, users, period]);

  // Módulos seleccionados con info
  const selectedModulesInfo = useMemo(() => {
    return MODULES.filter(m => selectedModules.has(m.key));
  }, [selectedModules]);

  // Módulos adicionales disponibles
  const availableModules = useMemo(() => {
    return MODULES.filter(m => !selectedModules.has(m.key) && !m.mandatory);
  }, [selectedModules]);

  const toggleModule = (key: ModuleKey) => {
    const mod = MODULES.find(m => m.key === key);
    if (mod?.mandatory) return;
    
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      // Si hay cambios respecto al intent original, actualizar el intent primero
      if (!pendingIntent) {
        // Crear nuevo intent si no existe
        await api.post('/pricing/subscription-intents', {
          users,
          period,
          storageGB: 10,
          modules: Array.from(selectedModules),
          totals,
          source: 'upgrade_plan',
        });
      }
      
      // Obtener link de checkout de Wompi
      const resp = await api.post('/billing/checkout-link', {});
      const url = resp.data?.data?.checkout_url;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No se pudo generar link de pago');
      }
    } catch (e: any) {
      console.error('Error al procesar pago:', e);
      alert(e?.response?.data?.message || e?.message || 'Error al procesar el pago. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const trialExpired = trialEndsAt ? new Date(trialEndsAt) < new Date() : false;

  // Calcular almacenamiento extra (10GB incluidos)
  const extraGB = Math.max(storageGB - 10, 0);
  const storageMonthly = extraGB * 2000;
  const storageAnnualBefore = storageMonthly * 12;
  const storageAnnualAfter = Math.round(storageAnnualBefore * 0.88); // 12% descuento

  // Calcular totales con descuento Sura (30% solo en plan anual, sin el 12%)
  const subtotalWithDiscount = (totals as any).subtotalAnnual ?? 0;
  const discountAnnual = (totals as any).discountAnnual ?? 0;
  const subtotalBeforeDiscount = subtotalWithDiscount + discountAnnual + storageAnnualBefore;
  
  const subtotal = period === 'monthly' 
    ? ((totals as any).subtotalMonthly ?? 0) + storageMonthly
    : hasSuraCoupon ? subtotalBeforeDiscount : (subtotalWithDiscount + storageAnnualAfter);
  
  const suraDiscountAmount = hasSuraCoupon && period === 'annual' ? Math.round(subtotal * 0.30) : 0;
  const totalFinal = subtotal - suraDiscountAmount;

  if (loadingIntent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-darkgray py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <Icon icon="svg-spinners:ring-resize" className="text-4xl text-primary mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando tu plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-darkgray py-8 px-4 font-['Manrope',sans-serif]">
      <div className="max-w-6xl mx-auto">
        {/* Banner Sura */}
        {hasSuraCoupon && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#0033A0] to-[#00A1E4] p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={SURA_LOGO_URL}
                  alt="Logo SURA"
                  className="h-10 w-auto"
                />
                <div className="h-8 w-px bg-white/30 hidden sm:block" />
                <div>
                  <p className="text-white/80 text-xs font-medium">Convenio exclusivo</p>
                  <h2 className="text-white text-lg font-bold">SURA + Guro</h2>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                <span className="text-white text-sm font-bold">30% OFF</span>
                <span className="text-white/90 text-xs">aplicado</span>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          {trialExpired ? (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium mb-4">
                <Icon icon="solar:clock-circle-bold" className="text-lg" />
                Tu periodo de prueba ha finalizado
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-dark dark:text-white mb-3">
                Activa tu suscripción
              </h1>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                Continúa usando Guro sin interrupciones. Elige el plan que mejor se adapte a tu negocio.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl font-bold text-dark dark:text-white mb-3">
                Planes y Precios
              </h1>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                Personaliza tu plan según las necesidades de tu agencia.
              </p>
            </>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Panel izquierdo - Configuración */}
          <div className="lg:col-span-2 space-y-6">
            {/* Toggle Mensual/Anual */}
            <div className="bg-white dark:bg-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-darkborder">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-dark dark:text-white">Periodo de facturación</h2>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-darkgray rounded-lg p-1">
                  <button
                    onClick={() => setPeriod('monthly')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      period === 'monthly'
                        ? 'bg-white dark:bg-dark text-primary shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-dark dark:hover:text-white'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    onClick={() => setPeriod('annual')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                      period === 'annual'
                        ? 'bg-white dark:bg-dark text-primary shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-dark dark:hover:text-white'
                    }`}
                  >
                    Anual
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      hasSuraCoupon 
                        ? 'bg-[#00A1E4]/10 text-[#0033A0]' 
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}>
                      {hasSuraCoupon ? '-30%' : '-12%'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Usuarios */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Cantidad de usuarios
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setUsers(Math.max(1, users - 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-darkgray hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition text-dark dark:text-white text-xl font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={users}
                    onChange={(e) => setUsers(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center px-3 py-2 rounded-lg border border-gray-200 dark:border-darkborder bg-white dark:bg-darkgray text-dark dark:text-white font-semibold"
                  />
                  <button
                    onClick={() => setUsers(users + 1)}
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-darkgray hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition text-dark dark:text-white text-xl font-bold"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">1er usuario gratis</p>
              </div>

              {/* Almacenamiento */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Almacenamiento (GB)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStorageGB(Math.max(10, storageGB - 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-darkgray hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition text-dark dark:text-white text-xl font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={storageGB}
                    onChange={(e) => setStorageGB(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-20 text-center px-3 py-2 rounded-lg border border-gray-200 dark:border-darkborder bg-white dark:bg-darkgray text-dark dark:text-white font-semibold"
                  />
                  <button
                    onClick={() => setStorageGB(storageGB + 1)}
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-darkgray hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition text-dark dark:text-white text-xl font-bold"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">10 GB incluidos</p>
              </div>
            </div>

            {/* Módulos seleccionados */}
            <div className="bg-white dark:bg-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-darkborder">
              <h2 className="text-lg font-semibold text-dark dark:text-white mb-4">
                Tus aplicaciones seleccionadas
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {selectedModulesInfo.map((mod) => (
                  <div
                    key={mod.key}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      mod.mandatory
                        ? 'bg-gray-50 dark:bg-darkgray border-gray-200 dark:border-darkborder'
                        : 'bg-primary/5 border-primary/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${mod.color} flex items-center justify-center`}>
                      <Icon icon={mod.icon} className="text-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark dark:text-white text-sm truncate">{mod.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {mod.mandatory ? 'Incluido' : numberFormat(mod.pricePerUser) + '/usuario'}
                      </p>
                    </div>
                    {!mod.mandatory && (
                      <button
                        onClick={() => toggleModule(mod.key)}
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        <Icon icon="solar:close-circle-linear" className="text-xl" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Agregar más módulos */}
            {availableModules.length > 0 && (
              <div className="bg-white dark:bg-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-darkborder">
                <h2 className="text-lg font-semibold text-dark dark:text-white mb-4">
                  Agregar más aplicaciones
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {availableModules.slice(0, 6).map((mod) => (
                    <button
                      key={mod.key}
                      onClick={() => toggleModule(mod.key)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-darkborder hover:border-primary/50 hover:bg-primary/5 transition text-left"
                    >
                      <div className={`w-10 h-10 rounded-lg ${mod.color} flex items-center justify-center`}>
                        <Icon icon={mod.icon} className="text-xl" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-dark dark:text-white text-sm truncate">{mod.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          +{numberFormat(mod.pricePerUser)}/usuario
                        </p>
                      </div>
                      <Icon icon="solar:add-circle-linear" className="text-xl text-primary" />
                    </button>
                  ))}
                </div>
                {availableModules.length > 6 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
                    Y {availableModules.length - 6} aplicaciones más disponibles
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Panel derecho - Resumen */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-darkborder sticky top-24">
              <h2 className="text-lg font-semibold text-dark dark:text-white mb-4">Resumen</h2>
              
              {/* Detalles */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Usuarios</span>
                  <span className="font-medium text-dark dark:text-white">{users}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Aplicaciones</span>
                  <span className="font-medium text-dark dark:text-white">{selectedModules.size}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Periodo</span>
                  <span className="font-medium text-dark dark:text-white">
                    {period === 'monthly' ? 'Mensual' : 'Anual'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Almacenamiento</span>
                  <span className="font-medium text-dark dark:text-white">{storageGB} GB</span>
                </div>
                
                <div className="border-t border-gray-100 dark:border-darkborder pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Base plataforma</span>
                    <span className="font-medium text-dark dark:text-white">
                      {numberFormat(period === 'monthly' ? (totals as any).baseMonthly : (totals as any).baseAnnual)}
                    </span>
                  </div>
                  {(totals as any).users?.billableUsers > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Usuarios ({(totals as any).users.billableUsers} × {numberFormat((totals as any).users.perUserMonthly)})
                      </span>
                      <span className="font-medium text-dark dark:text-white">
                        {numberFormat(period === 'monthly' ? (totals as any).users.usersMonthly : (totals as any).users.usersAnnualTotal)}
                      </span>
                    </div>
                  )}
                  {extraGB > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Almacenamiento extra ({extraGB} GB)</span>
                      <span className="font-medium text-dark dark:text-white">
                        {numberFormat(period === 'monthly' ? storageMonthly : storageAnnualBefore)}
                      </span>
                    </div>
                  )}
                  {period === 'annual' && !hasSuraCoupon && discountAnnual > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Descuento anual (12%)</span>
                      <span>-{numberFormat(discountAnnual + (storageAnnualBefore - storageAnnualAfter))}</span>
                    </div>
                  )}
                  {hasSuraCoupon && period === 'annual' && suraDiscountAmount > 0 && (
                    <div className="flex justify-between text-sm text-[#00A1E4] font-medium">
                      <span>Cupón SURA30 (-30%)</span>
                      <span>-{numberFormat(suraDiscountAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total */}
              <div className={`rounded-xl p-4 mb-6 ${hasSuraCoupon ? 'bg-gradient-to-r from-[#0033A0]/10 to-[#00A1E4]/10' : 'bg-gray-50 dark:bg-darkgray'}`}>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total {period === 'monthly' ? 'mensual' : 'anual'}</p>
                    <p className={`text-2xl font-bold ${hasSuraCoupon ? 'text-[#00A1E4]' : 'text-dark dark:text-white'}`}>
                      {numberFormat(totalFinal)}
                    </p>
                    {hasSuraCoupon && period === 'annual' && (
                      <p className="text-xs text-gray-400 line-through">
                        Antes: {numberFormat(subtotal)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">COP/{period === 'monthly' ? 'mes' : 'año'}</p>
                </div>
              </div>

              {/* Botón de suscripción */}
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Icon icon="svg-spinners:ring-resize" className="text-lg" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:card-bold" className="text-lg" />
                    Activar suscripción
                  </>
                )}
              </button>

              {/* Info adicional */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Icon icon="solar:shield-check-bold" className="text-green-500" />
                  Pago seguro con encriptación SSL
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Icon icon="solar:restart-bold" className="text-blue-500" />
                  Cancela cuando quieras
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Icon icon="solar:chat-round-dots-bold" className="text-purple-500" />
                  Soporte incluido
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ o info adicional */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ¿Tienes preguntas? <a href="mailto:soporte@guro.co" className="text-primary hover:underline">Contáctanos</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlan;
