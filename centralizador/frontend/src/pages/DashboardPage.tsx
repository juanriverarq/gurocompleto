import { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatCurrency, formatNumber } from '../lib/utils';
import {
  FileText,
  Users,
  Link2,
  Wallet,
  HandCoins,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

interface DashboardData {
  overview: {
    totalPolicies: number;
    activePolicies: number;
    totalClients: number;
    totalConnections: number;
    activeConnections: number;
    expiringPolicies: number;
  };
  cartera: {
    pendingPaymentsCount: number;
    pendingPaymentsAmount: number;
    pendingCommissionsCount: number;
    pendingCommissionsAmount: number;
  };
  policiesByInsurer: Array<{
    insurer: { slug: string; name: string };
    count: number;
    totalAmount: number;
    commissionAmount: number;
  }>;
  recentSyncs: Array<{
    id: string;
    syncType: string;
    status: string;
    itemsSynced: number;
    startedAt: string;
    completedAt: string;
    connection: { insurer: { slug: string; name: string } };
  }>;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No se pudo cargar el dashboard</p>
        <button onClick={fetchDashboard} className="mt-2 text-primary hover:underline text-sm">Reintentar</button>
      </div>
    );
  }

  const stats = [
    { label: 'Pólizas Activas', value: formatNumber(data.overview.activePolicies), icon: FileText, color: 'bg-blue-50 text-blue-600' },
    { label: 'Clientes', value: formatNumber(data.overview.totalClients), icon: Users, color: 'bg-green-50 text-green-600' },
    { label: 'Conexiones Activas', value: `${data.overview.activeConnections}/${data.overview.totalConnections}`, icon: Link2, color: 'bg-purple-50 text-purple-600' },
    { label: 'Por Cobrar', value: formatCurrency(data.cartera.pendingPaymentsAmount), icon: Wallet, color: 'bg-orange-50 text-orange-600' },
    { label: 'Comisiones Pendientes', value: formatCurrency(data.cartera.pendingCommissionsAmount), icon: HandCoins, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Por Vencer (30d)', value: formatNumber(data.overview.expiringPolicies), icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Resumen general de tu cartera de seguros</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Policies by Insurer */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Pólizas por Aseguradora
          </h2>
          {data.policiesByInsurer.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">Sin datos. Conecta una aseguradora para comenzar.</p>
          ) : (
            <div className="space-y-3">
              {data.policiesByInsurer.map((item) => (
                <div key={item.insurer.slug} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.insurer.name}</p>
                    <p className="text-xs text-gray-500">{item.count} pólizas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.totalAmount)}</p>
                    <p className="text-xs text-green-600">Comisión: {formatCurrency(item.commissionAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Syncs */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sincronizaciones Recientes
          </h2>
          {data.recentSyncs.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">Sin sincronizaciones aún</p>
          ) : (
            <div className="space-y-3">
              {data.recentSyncs.map((sync) => (
                <div key={sync.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sync.connection.insurer.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(sync.startedAt).toLocaleDateString('es-CO')} — {sync.itemsSynced} items
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    sync.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    sync.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {sync.status === 'COMPLETED' ? 'Completado' : sync.status === 'RUNNING' ? 'En progreso' : 'Error'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
