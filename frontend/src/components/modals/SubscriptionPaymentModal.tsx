import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import api from '../../config/api';
import { MODULES, ModuleKey, BillingPeriod, calculateTotals, numberFormat, BASE_PLATFORM_FEE } from '../../components/landingpage/pricing-calculator/modules';

interface SubscriptionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'trial_expired' | 'subscription_expired' | 'payment_due';
}

interface PendingIntent {
  id: number;
  period: string;
  users_count: number;
  storage_gb: number;
  modules: string[];
  totals: {
    subtotalMonthly?: number;
    totalAnnualEquivalent?: number;
    total?: number;
  };
}

// Organizar módulos por categorías
const MODULE_CATEGORIES = [
  { 
    id: 'operaciones', 
    name: 'Operaciones', 
    icon: 'solar:settings-bold-duotone',
    keys: ['clientes', 'polizas', 'siniestros', 'renovaciones', 'automoviles', 'seguimiento'] 
  },
  { 
    id: 'ventas', 
    name: 'Ventas', 
    icon: 'solar:chart-bold-duotone',
    keys: ['crm', 'cartera', 'comisiones', 'reportes'] 
  },
  { 
    id: 'marketing', 
    name: 'Marketing', 
    icon: 'solar:megaphone-bold-duotone',
    keys: ['whatsapp', 'email', 'miniweb', 'marca_blanca', 'sitio_web'] 
  },
  { 
    id: 'ia', 
    name: 'Inteligencia Artificial', 
    icon: 'solar:cpu-bolt-bold-duotone',
    keys: ['ia_chatbot', 'ia_callcenter', 'ia_predicciones', 'ia_ventas_cruzadas', 'lector_pdf_ia'] 
  },
  { 
    id: 'finanzas', 
    name: 'Finanzas', 
    icon: 'solar:wallet-bold-duotone',
    keys: ['facturacion_electronica', 'nomina_electronica'] 
  },
  { 
    id: 'extras', 
    name: 'Extras', 
    icon: 'solar:widget-add-bold-duotone',
    keys: ['documentos', 'app_movil'] 
  },
];

const SubscriptionPaymentModal: React.FC<SubscriptionPaymentModalProps> = ({
  isOpen,
  onClose,
  reason,
}) => {
  const { tenant, logout } = useUnifiedAuth();
  const [loading, setLoading] = useState(true);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para modo edición
  const [editMode, setEditMode] = useState(false);
  const [selectedModules, setSelectedModules] = useState<Set<ModuleKey>>(() => {
    // Inicializar con módulos obligatorios
    return new Set(MODULES.filter(m => m.mandatory).map(m => m.key));
  });
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('annual');
  const [savingChanges, setSavingChanges] = useState(false);

  // Módulos obligatorios
  const mandatoryKeys = useMemo(() => MODULES.filter(m => m.mandatory).map(m => m.key), []);

  useEffect(() => {
    if (isOpen) {
      fetchPendingIntent();
    }
  }, [isOpen]);

  const fetchPendingIntent = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/saas/billing/pending-intent');
      if (response.data.success && response.data.data) {
        setPendingIntent(response.data.data);
        // Inicializar estado de edición con los valores actuales
        const modules = response.data.data.modules || [];
        const moduleSet = new Set<ModuleKey>(
          modules.map((m: any) => (typeof m === 'string' ? m : (m.id || m.key || '')) as ModuleKey)
        );
        // Asegurar que los obligatorios estén incluidos
        mandatoryKeys.forEach(k => moduleSet.add(k));
        setSelectedModules(moduleSet);
        setSelectedPeriod((response.data.data.period || 'annual') as BillingPeriod);
      } else {
        // No hay intención pendiente, mostrar modo edición con obligatorios
        setPendingIntent(null);
        setEditMode(true);
        setSelectedModules(new Set(mandatoryKeys));
      }
    } catch (err) {
      console.error('Error fetching pending intent:', err);
      setPendingIntent(null);
      setEditMode(true);
      setSelectedModules(new Set(mandatoryKeys));
    } finally {
      setLoading(false);
    }
  };

  // Calcular totales usando la función del módulo de precios
  const totals = useMemo(() => {
    return calculateTotals(selectedModules, 1, selectedPeriod);
  }, [selectedModules, selectedPeriod]);

  // Obtener el total a mostrar
  const getCalculatedTotal = () => {
    if (selectedPeriod === 'annual') {
      return (totals as any).subtotalAnnual || 0;
    }
    return (totals as any).subtotalMonthly || 0;
  };

  // Toggle módulo (no permitir desactivar obligatorios)
  const toggleModule = (moduleKey: ModuleKey) => {
    const module = MODULES.find(m => m.key === moduleKey);
    if (module?.mandatory) return; // No permitir desactivar obligatorios
    
    // Si es solo anual y estamos en mensual, no permitir
    if (module?.annualOnly && selectedPeriod === 'monthly') return;
    
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleKey)) {
        next.delete(moduleKey);
      } else {
        next.add(moduleKey);
      }
      return next;
    });
  };

  // Cuando cambia a mensual, quitar módulos solo-anual
  useEffect(() => {
    if (selectedPeriod === 'monthly') {
      setSelectedModules(prev => {
        const next = new Set(prev);
        MODULES.filter(m => m.annualOnly).forEach(m => next.delete(m.key));
        return next;
      });
    }
  }, [selectedPeriod]);

  // Guardar cambios y crear nueva intención
  const handleSaveChanges = async () => {
    if (selectedModules.size === 0) {
      setError('Debes seleccionar al menos un módulo');
      return;
    }
    
    setSavingChanges(true);
    setError(null);
    try {
      // Crear nueva intención de suscripción
      const response = await api.post('/subscription-intent', {
        users: 1,
        period: selectedPeriod,
        storageGB: 10,
        modules: Array.from(selectedModules),
        totals: totals,
        source: 'payment_modal',
      });
      
      if (response.data.success) {
        // Recargar la intención
        await fetchPendingIntent();
        setEditMode(false);
      } else {
        setError(response.data.message || 'Error al guardar los cambios');
      }
    } catch (err: any) {
      console.error('Error saving changes:', err);
      setError(err?.response?.data?.message || 'Error al guardar los cambios');
    } finally {
      setSavingChanges(false);
    }
  };

  const getTitle = () => {
    switch (reason) {
      case 'trial_expired':
        return 'Tu período de prueba ha terminado';
      case 'subscription_expired':
        return 'Tu suscripción ha vencido';
      case 'payment_due':
        return 'Pago pendiente';
      default:
        return 'Activa tu suscripción';
    }
  };

  const getDescription = () => {
    const brokerName = (tenant as any)?.nombre || (tenant as any)?.name || 'Tu agencia';
    switch (reason) {
      case 'trial_expired':
        return `${brokerName} ha completado los 7 días de prueba gratuita. Para continuar usando Guro, activa tu plan.`;
      case 'subscription_expired':
        return `La suscripción de ${brokerName} ha vencido. Renueva tu plan para continuar.`;
      case 'payment_due':
        return `Tienes un pago pendiente para ${brokerName}. Completa el pago para continuar.`;
      default:
        return 'Activa tu suscripción para continuar usando Guro.';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTotal = () => {
    if (!pendingIntent?.totals) return 0;
    if (pendingIntent.period === 'annual') {
      return pendingIntent.totals.totalAnnualEquivalent || pendingIntent.totals.total || 0;
    }
    return pendingIntent.totals.subtotalMonthly || pendingIntent.totals.total || 0;
  };

  const handlePayment = async () => {
    if (!pendingIntent) {
      // Redirigir a planes si no hay intención pendiente
      window.location.href = '/apps/billing/planes';
      return;
    }

    setProcessingPayment(true);
    setError(null);
    try {
      // Crear link de pago con Wompi
      const response = await api.post('/billing/checkout-link', {
        intent_id: pendingIntent.id,
      });
      
      if (response.data.success && response.data.data?.checkout_url) {
        // Redirigir a Wompi checkout
        window.location.href = response.data.data.checkout_url;
      } else {
        setError(response.data.message || 'Error al crear el link de pago');
        setProcessingPayment(false);
      }
    } catch (err: any) {
      console.error('Error creating checkout link:', err);
      setError(err?.response?.data?.message || 'Error al procesar el pago. Intenta nuevamente.');
      setProcessingPayment(false);
    }
  };

  const handleSelectPlan = () => {
    // Activar modo edición en lugar de redirigir
    setEditMode(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // Si falla el logout, limpiar manualmente y redirigir
      console.error('Error en logout:', e);
    }
    // Limpiar localStorage y redirigir
    localStorage.clear();
    window.location.replace('/auth/login');
  };

  // No permitir cerrar el modal - es obligatorio
  const handleModalClose = () => {
    // No hacer nada - el modal es obligatorio
  };

  return (
    <Modal
      show={isOpen}
      onClose={handleModalClose}
      size="lg"
      dismissible={false}
      className="font-['Manrope',sans-serif]"
    >
      <Modal.Body className="p-8">
        <div className="text-center">
          {/* Icono */}
          <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
            <Icon 
              icon={reason === 'trial_expired' ? "solar:clock-circle-bold-duotone" : "solar:card-bold-duotone"} 
              className="text-4xl text-amber-500" 
            />
          </div>

          {/* Título */}
          <h2 className="text-2xl font-bold text-dark dark:text-white mb-2">
            {getTitle()}
          </h2>
          
          {/* Descripción */}
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {getDescription()}
          </p>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          )}

          {/* Modo edición - Seleccionar plan */}
          {!loading && editMode && (
            <div className="text-left mb-6">
              <h3 className="font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
                <Icon icon="solar:settings-bold-duotone" className="text-primary" />
                Configura tu plan
              </h3>
              
              {/* Selector de período */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Período de facturación:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPeriod('monthly')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                      selectedPeriod === 'monthly'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-darkgray text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('annual')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                      selectedPeriod === 'annual'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-darkgray text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    Anual <span className="text-xs opacity-80">(12% dto.)</span>
                  </button>
                </div>
              </div>
              
              {/* Selector de módulos por categorías */}
              <div className="mb-4 max-h-[300px] overflow-y-auto pr-1">
                <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Selecciona los módulos:</label>
                {MODULE_CATEGORIES.map((category) => {
                  const categoryModules = MODULES.filter(m => category.keys.includes(m.key));
                  if (categoryModules.length === 0) return null;
                  
                  return (
                    <div key={category.id} className="mb-3">
                      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Icon icon={category.icon} className="text-primary" />
                        {category.name}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {categoryModules.map((module) => {
                          const isSelected = selectedModules.has(module.key);
                          const isMandatory = module.mandatory;
                          const isAnnualOnly = module.annualOnly;
                          const isDisabled = isMandatory || (isAnnualOnly && selectedPeriod === 'monthly');
                          
                          // Calcular precio a mostrar
                          let priceText = '';
                          if (module.consumptionBased) {
                            priceText = 'Por consumo';
                          } else if (module.annualOnly && module.annualPrice) {
                            priceText = `${numberFormat(module.annualPrice)}/año`;
                          } else if (module.pricePerUser > 0) {
                            priceText = `${numberFormat(module.pricePerUser)}/mes`;
                          } else {
                            priceText = 'Incluido';
                          }
                          
                          return (
                            <button
                              key={module.key}
                              onClick={() => !isDisabled && toggleModule(module.key)}
                              disabled={isDisabled}
                              className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition border ${
                                isSelected
                                  ? isMandatory 
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                                    : 'bg-primary/10 border-primary text-primary'
                                  : isDisabled
                                    ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-white dark:bg-darkgray border-gray-200 dark:border-darkborder text-gray-700 dark:text-gray-300 hover:border-primary/50'
                              }`}
                            >
                              <Icon icon={module.icon} className="text-base flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate flex items-center gap-1">
                                  {module.name}
                                  {isMandatory && (
                                    <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1 rounded">
                                      Incluido
                                    </span>
                                  )}
                                  {isAnnualOnly && (
                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 rounded">
                                      Anual
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] opacity-70">{priceText}</div>
                              </div>
                              {isSelected && (
                                <Icon 
                                  icon={isMandatory ? "solar:lock-bold" : "solar:check-circle-bold"} 
                                  className={isMandatory ? "text-green-500" : "text-primary"} 
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Resumen de precio */}
              <div className="bg-gradient-to-br from-primary/5 to-indigo-50 dark:from-primary/10 dark:to-indigo-900/20 border border-primary/20 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-dark dark:text-white">Total a pagar</span>
                  <span className="text-xl font-bold text-primary">
                    {numberFormat(getCalculatedTotal())}
                    <span className="text-xs font-normal text-gray-500">
                      /{selectedPeriod === 'annual' ? 'año' : 'mes'}
                    </span>
                  </span>
                </div>
                {selectedPeriod === 'annual' && (totals as any).discountAnnual > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    Ahorras {numberFormat((totals as any).discountAnnual)} al año (12% dto.)
                  </p>
                )}
                <p className="text-[10px] text-gray-500 mt-1">
                  Incluye plataforma base ({numberFormat(BASE_PLATFORM_FEE)}/mes) + módulos seleccionados
                </p>
              </div>
              
              {/* Botones de acción */}
              <div className="flex gap-2 mt-4">
                {pendingIntent && (
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-gray-100 dark:bg-darkgray text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition"
                  >
                    Cancelar
                  </button>
                )}
                <Button
                  color="primary"
                  className="flex-1"
                  onClick={handleSaveChanges}
                  disabled={savingChanges || selectedModules.size === 0}
                >
                  {savingChanges ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Guardando...
                    </>
                  ) : (
                    'Confirmar selección'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Detalles del plan pendiente */}
          {!loading && !editMode && pendingIntent && (
            <div className="bg-gradient-to-br from-primary/5 to-indigo-50 dark:from-primary/10 dark:to-indigo-900/20 border border-primary/20 rounded-xl p-6 mb-6 text-left">
              <h3 className="font-semibold text-dark dark:text-white mb-4 flex items-center gap-2">
                <Icon icon="solar:document-text-bold-duotone" className="text-primary" />
                Tu plan seleccionado
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Período</span>
                  <span className="font-medium text-dark dark:text-white">
                    {pendingIntent.period === 'annual' ? 'Anual (20% dto.)' : 'Mensual'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Usuarios</span>
                  <span className="font-medium text-dark dark:text-white">
                    {pendingIntent.users_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Almacenamiento</span>
                  <span className="font-medium text-dark dark:text-white">
                    {pendingIntent.storage_gb} GB
                  </span>
                </div>
                
                {/* Módulos seleccionados a detalle */}
                {pendingIntent.modules && pendingIntent.modules.length > 0 && (
                  <div className="pt-3 border-t border-primary/10">
                    <span className="text-gray-600 dark:text-gray-400 block mb-2">Módulos incluidos:</span>
                    <div className="flex flex-wrap gap-2">
                      {pendingIntent.modules.map((module: any, index: number) => {
                        const moduleKey = typeof module === 'string' ? module : (module.id || module.key || '');
                        const moduleNames: Record<string, { name: string; icon: string }> = {
                          'crm': { name: 'CRM', icon: 'solar:users-group-rounded-bold-duotone' },
                          'polizas': { name: 'Pólizas', icon: 'solar:document-bold-duotone' },
                          'cotizador': { name: 'Cotizador', icon: 'solar:calculator-bold-duotone' },
                          'marketing': { name: 'Marketing', icon: 'solar:chart-bold-duotone' },
                          'cobranza': { name: 'Cobranza', icon: 'solar:wallet-bold-duotone' },
                          'reportes': { name: 'Reportes', icon: 'solar:graph-bold-duotone' },
                          'voice_ai': { name: 'Voice AI', icon: 'solar:microphone-bold-duotone' },
                          'whatsapp': { name: 'WhatsApp', icon: 'solar:chat-round-dots-bold-duotone' },
                        };
                        const info = moduleNames[moduleKey] || { name: moduleKey, icon: 'solar:widget-bold-duotone' };
                        return (
                          <span 
                            key={index}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-dark rounded-lg text-xs font-medium text-primary border border-primary/20"
                          >
                            <Icon icon={info.icon} className="text-sm" />
                            {info.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="border-t border-primary/20 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-dark dark:text-white">Total a pagar</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(getTotal())}
                      <span className="text-xs font-normal text-gray-500">
                        /{pendingIntent.period === 'annual' ? 'año' : 'mes'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-6 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Botones - Solo mostrar cuando no estamos en modo edición */}
          {!editMode && (
            <div className="space-y-3">
              {pendingIntent ? (
                <Button
                  color="primary"
                  size="lg"
                  className="w-full"
                  onClick={handlePayment}
                  disabled={processingPayment}
                >
                  {processingPayment ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:card-bold" className="mr-2" />
                      Pagar {formatCurrency(getTotal())}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  color="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleSelectPlan}
                >
                  <Icon icon="solar:widget-add-bold" className="mr-2" />
                  Elegir un plan
                </Button>
              )}
              
              {pendingIntent && (
                <button
                  onClick={handleSelectPlan}
                  className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition"
                >
                  Cambiar plan
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition flex items-center justify-center gap-1"
              >
                <Icon icon="solar:logout-2-linear" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default SubscriptionPaymentModal;
