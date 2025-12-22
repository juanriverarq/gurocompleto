import { useState, useMemo, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { MODULES, calculateTotals, numberFormat, ModuleKey, BillingPeriod } from 'src/components/landingpage/pricing-calculator/modules';

const UpgradePlan = () => {
  const { tenant, trialEndsAt } = useUnifiedAuth();
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [users, setUsers] = useState(1);
  const [selectedModules, setSelectedModules] = useState<Set<ModuleKey>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Cargar módulos del broker (features)
  useEffect(() => {
    if (tenant) {
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
  }, [tenant]);

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
    // TODO: Integrar con pasarela de pago
    setTimeout(() => {
      alert('Redirigiendo a pasarela de pago...');
      setIsLoading(false);
    }, 1000);
  };

  const trialExpired = trialEndsAt ? new Date(trialEndsAt) < new Date() : false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-darkgray py-8 px-4 font-['Manrope',sans-serif]">
      <div className="max-w-6xl mx-auto">
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
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                      -20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Usuarios */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Cantidad de usuarios
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setUsers(Math.max(1, users - 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-darkgray hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition"
                  >
                    <Icon icon="solar:minus-linear" />
                  </button>
                  <input
                    type="number"
                    value={users}
                    onChange={(e) => setUsers(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center px-3 py-2 rounded-lg border border-gray-200 dark:border-darkborder bg-white dark:bg-darkgray text-dark dark:text-white font-semibold"
                  />
                  <button
                    onClick={() => setUsers(users + 1)}
                    className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-darkgray hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition"
                  >
                    <Icon icon="solar:add-linear" />
                  </button>
                </div>
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
                
                <div className="border-t border-gray-100 dark:border-darkborder pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="font-medium text-dark dark:text-white">
                      {numberFormat((totals as any).subtotal)}
                    </span>
                  </div>
                  {period === 'annual' && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Descuento anual (20%)</span>
                      <span>-{numberFormat((totals as any).subtotal * 0.2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gray-50 dark:bg-darkgray rounded-xl p-4 mb-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total {period === 'monthly' ? 'mensual' : 'anual'}</p>
                    <p className="text-2xl font-bold text-dark dark:text-white">
                      {numberFormat((totals as any).total)}
                    </p>
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
            ¿Tienes preguntas? <a href="mailto:soporte@guro.com" className="text-primary hover:underline">Contáctanos</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlan;
