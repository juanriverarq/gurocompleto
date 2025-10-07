import React, { useState, useEffect } from 'react';
import { useUnifiedAuth } from '../../../context/UnifiedAuthContext';
import { saasApi } from '../../../services/saasApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../../components/shadcn-ui/Default-Ui/select';
import { 
  Icon as IconifyIcon 
} from '@iconify/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

interface DashboardMetrics {
  clientes: {
    total: number;
    activos: number;
    prospectos: number;
    nuevos_mes: number;
  };
  polizas: {
    total: number;
    activas: number;
    vencen_30_dias: number;
    prima_total: number;
  };
  usuarios: {
    total: number;
    activos: number;
    conectados_hoy: number;
  };
  comisiones: {
    mes_actual: number;
    mes_anterior: number;
    pendientes: number;
  };
}

const Dashboard: React.FC = () => {
  const { usuarioSaas, tenant, hasPermission } = useUnifiedAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [clientesChart, setClientesChart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [primasChart, setPrimasChart] = useState<any[]>([]);
  const [contactAlerts, setContactAlerts] = useState<{ totalAnalizados: number; sinCelular: number; celularInvalido: number }>({
    totalAnalizados: 0,
    sinCelular: 0,
    celularInvalido: 0,
  });

  const canViewMetrics = hasPermission('dashboard', 'ver_metricas_generales') || 
                        hasPermission('dashboard', 'ver_metricas_propias');

  useEffect(() => {
    if (canViewMetrics) {
      loadDashboardData();
    }
  }, [canViewMetrics, chartPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsResponse, clientesResponse, primasResponse] = await Promise.all([
        saasApi.getDashboardMetrics(),
        saasApi.getClientesChart(chartPeriod),
        saasApi.getPrimasChart(chartPeriod)
      ]);

      if (metricsResponse.success && metricsResponse.data) {
        setMetrics(metricsResponse.data);
      }

      if (clientesResponse.success && clientesResponse.data && clientesResponse.data.labels) {
        const data = clientesResponse.data;
        setClientesChart(data.labels.map((label, index) => ({
          name: label,
          value: data.data[index] || 0
        })));
      }

      if (primasResponse.success && primasResponse.data && primasResponse.data.labels) {
        const data = primasResponse.data;
        setPrimasChart(data.labels.map((label, index) => ({
          name: label,
          value: data.data[index] || 0
        })));
      }

      // Cargar y analizar clientes para alertas de contacto (siempre validar celular)
      try {
        const clientsAllResponse = await saasApi.getClientesAll();
        const list: any[] = clientsAllResponse && clientsAllResponse.success && Array.isArray(clientsAllResponse.data)
          ? (clientsAllResponse.data as any[])
          : [];

        const extractCell = (c: any): string => {
          // Intentar campos comunes de celular
          return (
            (c && (c.celular || c.celular_principal || c.mobile_phone || c.telefono_celular)) ||
            (c?.persona && (c.persona.celular || c.persona.celular_principal)) ||
            ''
          );
        };

        const isValidCellPhone = (phone: string): boolean => {
          if (!phone) return false;
          const normalized = String(phone).trim();
          // Validación genérica (7-15 dígitos permitiendo espacios y símbolos comunes)
          const phoneRegex = /^[0-9\s\-\(\)]{7,15}$/;
          return phoneRegex.test(normalized);
        };

        let total = 0;
        let sinCel = 0;
        let invalido = 0;
        for (const c of list) {
          const cell = String(extractCell(c) || '').trim();
          total += 1;
          if (!cell) {
            sinCel += 1;
          } else if (!isValidCellPhone(cell)) {
            invalido += 1;
          }
        }
        setContactAlerts({ totalAnalizados: total, sinCelular: sinCel, celularInvalido: invalido });
      } catch (e) {
        // No bloquear el dashboard si falla esta parte
        setContactAlerts({ totalAnalizados: 0, sinCelular: 0, celularInvalido: 0 });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };


  if (!canViewMetrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin permisos</h2>
          <p className="text-gray-600">No tienes permisos para ver el dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {getGreeting()}, {usuarioSaas?.nombre}
          </h1>
          <p className="text-gray-600 mt-1">
            Bienvenido a {tenant?.branding.nombre_comercial || tenant?.nombre}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={chartPeriod} onValueChange={(value: any) => setChartPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="year">Año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadDashboardData}>
            <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Clientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <IconifyIcon icon="solar:users-group-two-rounded-bold" className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.clientes.total || 0}</div>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
              <span>Activos: {metrics?.clientes.activos || 0}</span>
              <span>Prospectos: {metrics?.clientes.prospectos || 0}</span>
            </div>
            <div className="text-xs text-green-600 mt-1">
              +{metrics?.clientes.nuevos_mes || 0} este mes
            </div>
          </CardContent>
        </Card>

        {/* Pólizas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pólizas</CardTitle>
            <IconifyIcon icon="solar:document-text-bold" className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.polizas.total || 0}</div>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
              <span>Activas: {metrics?.polizas.activas || 0}</span>
              <span>Vencen: {metrics?.polizas.vencen_30_dias || 0}</span>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {formatCurrency(metrics?.polizas.prima_total || 0)} en primas
            </div>
          </CardContent>
        </Card>

        {/* Usuarios */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipo</CardTitle>
            <IconifyIcon icon="solar:user-bold" className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.usuarios.total || 0}</div>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
              <span>Activos: {metrics?.usuarios.activos || 0}</span>
              <span>Conectados: {metrics?.usuarios.conectados_hoy || 0}</span>
            </div>
            <div className="text-xs text-purple-600 mt-1">
              {Math.round(((metrics?.usuarios.conectados_hoy || 0) / (metrics?.usuarios.total || 1)) * 100)}% conectados hoy
            </div>
          </CardContent>
        </Card>

        {/* Comisiones */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisiones</CardTitle>
            <IconifyIcon icon="solar:dollar-minimalistic-bold" className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.comisiones.mes_actual || 0)}
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Mes anterior: {formatCurrency(metrics?.comisiones.mes_anterior || 0)}
            </div>
            <div className="text-xs text-yellow-600 mt-1">
              {formatCurrency(metrics?.comisiones.pendientes || 0)} pendientes
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolución de Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:chart-2-bold" className="h-5 w-5 text-blue-600" />
              Evolución de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={clientesChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Primas por Mes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:bill-list-bold" className="h-5 w-5 text-green-600" />
              Primas por periodo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={primasChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Widgets adicionales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actividad Reciente */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:clock-circle-bold" className="h-5 w-5 text-orange-600" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <IconifyIcon icon="solar:user-plus-bold" className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Nuevo cliente registrado</p>
                  <p className="text-xs text-gray-600">Juan Pérez - hace 2 horas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <IconifyIcon icon="solar:document-add-bold" className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Nueva póliza emitida</p>
                  <p className="text-xs text-gray-600">Seguro de Vida - hace 4 horas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <IconifyIcon icon="solar:bell-bing-bold" className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Póliza próxima a vencer</p>
                  <p className="text-xs text-gray-600">Vence en 5 días - María García</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accesos Rápidos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:widget-bold" className="h-5 w-5 text-purple-600" />
              Accesos Rápidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <IconifyIcon icon="solar:user-plus-bold" className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <IconifyIcon icon="solar:document-add-bold" className="h-4 w-4 mr-2" />
                Nueva Póliza
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <IconifyIcon icon="solar:chart-2-bold" className="h-4 w-4 mr-2" />
                Reportes
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <IconifyIcon icon="solar:settings-bold" className="h-4 w-4 mr-2" />
                Configuración
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas y Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconifyIcon icon="solar:bell-bold" className="h-5 w-5 text-red-600" />
            Alertas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:danger-circle-bold" className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Pólizas Vencidas</span>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {metrics?.polizas.vencen_30_dias || 0}
              </p>
              <p className="text-sm text-red-600">Requieren renovación</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:clock-circle-bold" className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">Comisiones Pendientes</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(metrics?.comisiones.pendientes || 0)}
              </p>
              <p className="text-sm text-yellow-600">Por cobrar</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:user-check-bold" className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">Prospectos Activos</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {metrics?.clientes.prospectos || 0}
              </p>
              <p className="text-sm text-blue-600">Requieren seguimiento</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas IA de Contacto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconifyIcon icon="solar:cpu-bolt-bold" className="h-5 w-5 text-blue-600" />
            Alertas IA de Contacto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:phone-bold" className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">Clientes analizados</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{contactAlerts.totalAnalizados}</p>
              <p className="text-sm text-blue-600">Fuente: /saas/clientes/all</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:phone-cross-bold" className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Sin celular</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{contactAlerts.sinCelular}</p>
              <p className="text-sm text-red-600">Requieren datos</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:phone-outgoing-bold" className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">Celular inválido</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{contactAlerts.celularInvalido}</p>
              <p className="text-sm text-yellow-600">Validación de formato</p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => { window.location.href = '/apps/seguros/clientes'; }}>
              Ir a clientes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard; 