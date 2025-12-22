import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Progress, Spinner, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import api from '../../../config/api';

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
  storage: { used_mb: number; limit_gb: number; percentage: number };
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
      basic: {
        name: 'Básico',
        color: 'gray',
        icon: 'solar:shield-bold-duotone'
      },
      professional: {
        name: 'Profesional',
        color: 'info',
        icon: 'solar:rocket-bold-duotone'
      },
      enterprise: {
        name: 'Empresarial',
        color: 'purple',
        icon: 'solar:crown-bold-duotone'
      }
    };
    return plans[plan] || plans.basic;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  const broker = subscriptionData?.broker;
  const planDetails = getPlanDetails(broker?.plan || 'basic');
  const isInTrial = subscriptionData?.is_in_trial || false;
  const trialDaysRemaining = subscriptionData?.trial_days_remaining || 0;

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
              {isInTrial ? (
                <Badge color={trialDaysRemaining <= 3 ? 'failure' : 'warning'} size="sm">Trial</Badge>
              ) : (
                <Badge color="success" size="sm">Activa</Badge>
              )}
            </div>
            {!isInTrial && (
              <Button color="light" size="xs">Cambiar plan</Button>
            )}
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
                {usageData?.subscription?.storage_gb || usageData?.storage?.limit_gb || 5}GB
              </p>
              <p className="text-xs text-gray-500">Storage</p>
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
              <span className="text-gray-600 dark:text-gray-400">Storage</span>
              <span className="text-gray-500">{usageData?.storage.used_mb || 0}MB/{usageData?.storage.limit_gb || 5}GB</span>
            </div>
            <Progress progress={usageData?.storage.percentage || 0} size="sm" color="yellow" />
          </div>
        </div>
      </Card>

      {/* Upgrade CTA - Compact */}
      {(isInTrial || broker?.plan === 'basic') && (
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon icon="solar:rocket-bold-duotone" height={24} className="text-white" />
              <div>
                <h3 className="text-sm font-bold text-white">Desbloquea GURO</h3>
                <p className="text-xs text-blue-100">Más usuarios y funcionalidades</p>
              </div>
            </div>
            <Button color="light" size="xs" onClick={() => navigate('/precios')}>Ver planes</Button>
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
