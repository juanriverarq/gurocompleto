import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Progress, Spinner, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import api from '../../../config/api';
import { MODULES } from '../../../components/landingpage/pricing-calculator/modules';

interface SubscriptionData {
  subscription: {
    id: number;
    status: string;
    period: string;
    users_count: number;
    storage_gb: number;
    modules: string[];
    totals: any;
    starts_at: string;
    current_period_end: string;
    canceled_at: string | null;
    created_at: string;
  } | null;
  broker: {
    id: number;
    name: string;
    plan: string;
    status: string;
    trial_ends_at: string;
    subscription_ends_at: string | null;
    max_users: number;
    max_clients: number;
    max_policies: number;
    features: string[];
  } | null;
  is_in_trial: boolean;
  trial_days_remaining: number;
}

interface UsageData {
  users: { used: number; limit: number; percentage: number };
  clients: { used: number; limit: number; percentage: number };
  policies: { used: number; limit: number; percentage: number };
  storage: { used_bytes: number; used_mb: number; used_gb: number; limit_gb: number; file_count: number; percentage: number };
  subscription?: {
    period: string;
    status: string;
    users_count: number;
    storage_gb: number;
    current_period_end: string | null;
  } | null;
}

const MiSuscripcion: React.FC = () => {
  const navigate = useNavigate();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [subResponse, usageResponse] = await Promise.all([
        api.get('/saas/billing/subscription'),
        api.get('/saas/billing/usage')
      ]);

      if (subResponse.data.success) {
        setSubscriptionData(subResponse.data.data);
      } else {
        setError(subResponse.data.message || 'Error al cargar suscripción');
      }

      if (usageResponse.data.success) {
        setUsageData(usageResponse.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching subscription data:', err);
      setError(err?.response?.data?.message || 'Error al cargar datos de suscripción');
    } finally {
      setLoading(false);
    }
  };

  const getPlanDetails = (plan: string) => {
    const plans: Record<string, { name: string; color: string; icon: string }> = {
      starter: {
        name: 'Starter',
        color: 'gray',
        icon: 'solar:shield-bold-duotone'
      },
      professional: {
        name: 'Profesional',
        color: 'info',
        icon: 'solar:rocket-bold-duotone'
      },
      business: {
        name: 'Business',
        color: 'purple',
        icon: 'solar:buildings-bold-duotone'
      },
      custom: {
        name: 'A tu medida',
        color: 'purple',
        icon: 'solar:crown-bold-duotone'
      }
    };
    return plans[plan] || plans.starter;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const broker = subscriptionData?.broker;
  const subscription = subscriptionData?.subscription;
  const planDetails = getPlanDetails(broker?.plan || 'starter');
  const isInTrial = subscriptionData?.is_in_trial || false;
  const trialDaysRemaining = subscriptionData?.trial_days_remaining || 0;

  // Módulos activos: usar features del broker (asignados en el plan)
  const activeFeatures = useMemo(() => {
    const keys = broker?.features || subscription?.modules || [];
    return MODULES.filter(m => keys.includes(m.key));
  }, [broker?.features, subscription?.modules]);

  const inactiveFeatures = useMemo(() => {
    const keys = broker?.features || subscription?.modules || [];
    return MODULES.filter(m => !keys.includes(m.key));
  }, [broker?.features, subscription?.modules]);

  const statusLabel = (s: string) => {
    const map: Record<string, { label: string; color: string }> = {
      active: { label: 'Activa', color: 'success' },
      trial: { label: 'Trial', color: 'warning' },
      trial_expired: { label: 'Trial expirado', color: 'failure' },
      suspended: { label: 'Suspendida', color: 'failure' },
      inactive: { label: 'Inactiva', color: 'gray' },
      trialing: { label: 'Trial', color: 'warning' },
      canceled: { label: 'Cancelada', color: 'failure' },
    };
    return map[s] || { label: s, color: 'gray' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert color="failure" className="mb-4">
        <div className="flex items-center gap-3">
          <Icon icon="solar:danger-triangle-bold" height={24} />
          <div>
            <h3 className="font-semibold">Error al cargar suscripción</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
        <Button color="gray" size="sm" onClick={fetchData} className="mt-3">
          Reintentar
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mi Suscripción</h1>
        <Button color="gray" size="sm" onClick={() => navigate('/apps/billing/facturas')}>
          <Icon icon="solar:document-text-bold" className="mr-1" height={16} />
          Facturas
        </Button>
      </div>

      {/* Trial Warning */}
      {isInTrial && trialDaysRemaining <= 5 && (
        <Alert color="warning" className="py-2">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm">
              <strong>Trial:</strong> {trialDaysRemaining} días restantes
            </span>
            <Button color="warning" size="xs">Activar</Button>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plan Card */}
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon icon={planDetails.icon} height={20} className="text-primary" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Plan {planDetails.name}</h2>
              <Badge color={statusLabel(broker?.status || 'trial').color as any} size="sm">
                {statusLabel(broker?.status || 'trial').label}
              </Badge>
              {isInTrial && (
                <Badge color={trialDaysRemaining <= 3 ? 'failure' : 'warning'} size="sm">
                  {trialDaysRemaining} días restantes
                </Badge>
              )}
            </div>
            <Button color="light" size="xs" onClick={() => navigate('/comenzar')}>Cambiar plan</Button>
          </div>

          {/* Plan Features Grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {usageData?.subscription?.users_count || usageData?.users?.limit || 5}
              </p>
              <p className="text-xs text-gray-500">Usuarios</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {usageData?.clients?.limit || broker?.max_clients || 100}
              </p>
              <p className="text-xs text-gray-500">Clientes</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {usageData?.policies?.limit || broker?.max_policies || 500}
              </p>
              <p className="text-xs text-gray-500">Pólizas</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {usageData?.storage?.limit_gb || 10} GB
              </p>
              <p className="text-xs text-gray-500">Almacenamiento</p>
            </div>
          </div>

          {/* Period & Dates */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
            {usageData?.subscription && (
              <Badge color={usageData.subscription.period === 'annual' ? 'success' : 'info'} size="sm">
                {usageData.subscription.period === 'annual' ? 'Anual (-20%)' : 'Mensual'}
              </Badge>
            )}
            {isInTrial && broker?.trial_ends_at && (
              <span>Trial: {formatDate(broker.trial_ends_at)}</span>
            )}
            {subscriptionData?.subscription?.current_period_end && (
              <span>Próx. factura: {formatDate(subscriptionData.subscription.current_period_end)}</span>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Acciones</h3>
          <div className="space-y-2">
            <Button color="light" size="xs" className="w-full justify-start" onClick={() => navigate('/precios')}>
              <Icon icon="solar:stars-bold" className="mr-1" height={14} /> Ver planes
            </Button>
            <Button color="light" size="xs" className="w-full justify-start">
              <Icon icon="solar:card-bold" className="mr-1" height={14} /> Método de pago
            </Button>
            <Button color="light" size="xs" className="w-full justify-start" onClick={() => navigate('/apps/billing/facturas')}>
              <Icon icon="solar:document-text-bold" className="mr-1" height={14} /> Facturas
            </Button>
            <Button color="light" size="xs" className="w-full justify-start">
              <Icon icon="solar:user-plus-bold" className="mr-1" height={14} /> Agregar usuarios
            </Button>
          </div>
        </Card>
      </div>

      {/* Usage Stats */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Uso actual</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">Usuarios</span>
              <span className="text-gray-500">{usageData?.users.used || 0}/{usageData?.users.limit || 5}</span>
            </div>
            <Progress progress={usageData?.users.percentage || 0} size="sm" color="blue" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">Clientes</span>
              <span className="text-gray-500">{usageData?.clients.used || 0}/{usageData?.clients.limit || 100}</span>
            </div>
            <Progress progress={usageData?.clients.percentage || 0} size="sm" color="green" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">Pólizas</span>
              <span className="text-gray-500">{usageData?.policies.used || 0}/{usageData?.policies.limit || 500}</span>
            </div>
            <Progress progress={usageData?.policies.percentage || 0} size="sm" color="purple" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">
                Almacenamiento ({usageData?.storage?.file_count || 0} archivos)
              </span>
              <span className="text-gray-500">
                {(usageData?.storage?.used_mb || 0) >= 1024
                  ? `${(usageData?.storage?.used_gb || 0).toFixed(2)} GB`
                  : `${usageData?.storage?.used_mb || 0} MB`
                } / {usageData?.storage?.limit_gb || 10} GB
              </span>
            </div>
            <Progress
              progress={usageData?.storage?.percentage || 0}
              size="sm"
              color={(usageData?.storage?.percentage || 0) >= 90 ? 'red' : (usageData?.storage?.percentage || 0) >= 70 ? 'yellow' : 'blue'}
            />
          </div>
        </div>
      </Card>

      {/* Subscription Details */}
      {subscription && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Icon icon="solar:calendar-bold-duotone" height={16} className="text-primary" />
            Detalles de la suscripción
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Periodo</p>
              <Badge color={subscription.period === 'annual' ? 'success' : 'info'} size="sm">
                {subscription.period === 'annual' ? 'Anual (-12%)' : 'Mensual'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Inicio</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(subscription.starts_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Próxima factura</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(subscription.current_period_end)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Estado</p>
              <Badge color={statusLabel(subscription.status).color as any} size="sm">
                {statusLabel(subscription.status).label}
              </Badge>
            </div>
            {subscription.totals && (
              <>
                {subscription.totals.subtotalMonthly && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Total mensual</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      ${Number(subscription.totals.subtotalMonthly).toLocaleString('es-CO')} COP
                    </p>
                  </div>
                )}
                {subscription.totals.subtotalAnnual && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Total anual</p>
                    <p className="font-bold text-gray-900 dark:text-white">
                      ${Number(subscription.totals.subtotalAnnual).toLocaleString('es-CO')} COP
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* Active Modules */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon icon="solar:widget-5-bold-duotone" height={16} className="text-primary" />
            Módulos activos ({activeFeatures.length})
          </h3>
          <Button color="light" size="xs" onClick={() => navigate('/comenzar')}>
            <Icon icon="solar:add-circle-linear" className="mr-1" height={14} />
            Agregar módulos
          </Button>
        </div>
        {activeFeatures.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeFeatures.map((mod) => (
              <div
                key={mod.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800"
              >
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Icon icon={mod.icon} className="w-4.5 h-4.5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{mod.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{mod.description}</p>
                </div>
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <Icon icon="solar:widget-5-linear" height={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay módulos asignados</p>
          </div>
        )}
      </Card>

      {/* Inactive Modules */}
      {inactiveFeatures.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
            <Icon icon="solar:lock-keyhole-bold-duotone" height={16} />
            Módulos disponibles ({inactiveFeatures.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {inactiveFeatures.map((mod) => (
              <div
                key={mod.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 opacity-60"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <Icon icon={mod.icon} className="w-4.5 h-4.5 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{mod.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{mod.description}</p>
                </div>
                <Icon icon="solar:lock-keyhole-bold" className="w-4 h-4 text-gray-300 flex-shrink-0 ml-auto" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upgrade CTA - Compact */}
      {(isInTrial || broker?.plan === 'starter') && (
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon icon="solar:rocket-bold-duotone" height={24} className="text-white" />
              <div>
                <h3 className="text-sm font-bold text-white">Desbloquea todo GURO</h3>
                <p className="text-xs text-blue-100">Más usuarios, módulos y funcionalidades avanzadas</p>
              </div>
            </div>
            <Button color="light" size="xs" onClick={() => navigate('/comenzar')}>Cambiar plan</Button>
          </div>
        </Card>
      )}

      {/* Billing Info */}
      <div className="text-center text-xs text-gray-400 pt-2">
        Facturado por <strong>Guro Tecnología S.A.S</strong> · NIT 901290969-2
      </div>
    </div>
  );
};

export default MiSuscripcion;
