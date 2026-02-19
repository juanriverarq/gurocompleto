import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/shadcn-ui/Default-Ui/select';
import { Icon as IconifyIcon } from '@iconify/react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import masterPanelService, { MasterStats } from '../../services/masterPanelService';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

const MasterDashboardContent: React.FC = () => {
  const [stats, setStats] = useState<MasterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadDashboardData();
  }, [chartPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await masterPanelService.getStats();
      if (response.success) {
        setStats(response.data);
      } else {
        setError('Error al cargar estadísticas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
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

  const planData = stats ? Object.entries(stats.brokers.por_plan).map(([name, value]) => ({
    name: name.toUpperCase(),
    value
  })) : [];

  const topBrokersData = stats?.top_brokers.por_polizas.map(b => ({
    name: b.name.length > 15 ? b.name.substring(0, 15) + '...' : b.name,
    polizas: b.polizas_count
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, Administrador
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Panel de Control Global - Guro Platform
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : stats && (
        <>
          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Brokers */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Brokers</CardTitle>
                <IconifyIcon icon="solar:buildings-2-bold" className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.brokers.total}</div>
                <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                  <span>Activos: {stats.brokers.activos}</span>
                  <span>Trial: {stats.brokers.en_trial}</span>
                </div>
                {stats.brokers.crecimiento_porcentaje !== undefined && (
                  <div className={`text-xs mt-1 ${stats.brokers.crecimiento_porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.brokers.crecimiento_porcentaje >= 0 ? '+' : ''}{stats.brokers.crecimiento_porcentaje}% este mes
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usuarios */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
                <IconifyIcon icon="solar:users-group-two-rounded-bold" className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.usuarios.total}</div>
                <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                  <span>Masters: {stats.usuarios.masters}</span>
                  <span>Admins: {stats.usuarios.admins}</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {stats.usuarios.empleados_total} empleados activos
                </div>
              </CardContent>
            </Card>

            {/* Pólizas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pólizas</CardTitle>
                <IconifyIcon icon="solar:document-text-bold" className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.polizas.total.toLocaleString()}</div>
                <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                  <span>Activas: {stats.polizas.activas.toLocaleString()}</span>
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {formatCurrency(stats.polizas.valor_primas)} en primas
                </div>
              </CardContent>
            </Card>

            {/* Clientes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                <IconifyIcon icon="solar:user-bold" className="h-5 w-5 text-cyan-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.clientes.total.toLocaleString()}</div>
                <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                  <span>Activos: {stats.clientes.activos.toLocaleString()}</span>
                </div>
                <div className="text-xs text-cyan-600 mt-1">
                  En toda la plataforma
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Finanzas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Primas</CardTitle>
                <IconifyIcon icon="solar:dollar-minimalistic-bold" className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.polizas.valor_primas_formato}</div>
                <div className="text-xs text-gray-600 mt-2">Total en pólizas activas</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Comisiones</CardTitle>
                <IconifyIcon icon="solar:wallet-bold" className="h-5 w-5 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.polizas.valor_comisiones_formato}</div>
                <div className="text-xs text-gray-600 mt-2">Total generado</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Wallets</CardTitle>
                <IconifyIcon icon="solar:card-bold" className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.finanzas.saldo_wallets_formato}</div>
                <div className="text-xs text-gray-600 mt-2">{stats.finanzas.wallets_con_saldo} wallets con saldo</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suscripciones</CardTitle>
                <IconifyIcon icon="solar:crown-bold" className="h-5 w-5 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.finanzas.suscripciones_activas}</div>
                <div className="text-xs text-gray-600 mt-2">de {stats.finanzas.suscripciones_total} totales</div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Brokers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:chart-2-bold" className="h-5 w-5 text-purple-600" />
                  Top Brokers por Pólizas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topBrokersData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="polizas" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución por Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:pie-chart-2-bold" className="h-5 w-5 text-blue-600" />
                  Distribución por Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {planData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Automatización */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconifyIcon icon="solar:cpu-bolt-bold" className="h-5 w-5 text-purple-600" />
                Automatización y Campañas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                  <IconifyIcon icon="solar:chat-round-dots-bold" className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <p className="text-2xl font-bold text-green-600">{stats.automatizacion.campanas_whatsapp.total}</p>
                  <p className="text-xs text-gray-600">Campañas WhatsApp</p>
                  <p className="text-xs text-green-500">{stats.automatizacion.campanas_whatsapp.activas} activas</p>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 text-center">
                  <IconifyIcon icon="solar:phone-calling-bold" className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                  <p className="text-2xl font-bold text-purple-600">{stats.automatizacion.campanas_voz.total}</p>
                  <p className="text-xs text-gray-600">Campañas Voz AI</p>
                  <p className="text-xs text-purple-500">{stats.automatizacion.campanas_voz.activas} activas</p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
                  <IconifyIcon icon="solar:letter-bold" className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{stats.automatizacion.campanas_email.total}</p>
                  <p className="text-xs text-gray-600">Campañas Email</p>
                  <p className="text-xs text-blue-500">{stats.automatizacion.campanas_email.activas} activas</p>
                </div>

                <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 text-center">
                  <IconifyIcon icon="solar:bot-bold" className="h-8 w-8 mx-auto text-cyan-600 mb-2" />
                  <p className="text-2xl font-bold text-cyan-600">{stats.automatizacion.chatbots.total}</p>
                  <p className="text-xs text-gray-600">Chatbots</p>
                  <p className="text-xs text-cyan-500">{stats.automatizacion.chatbots.activos} activos</p>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
                  <IconifyIcon icon="solar:smartphone-2-bold" className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
                  <p className="text-2xl font-bold text-emerald-600">{stats.automatizacion.instancias_whatsapp.total}</p>
                  <p className="text-xs text-gray-600">Instancias WA</p>
                  <p className="text-xs text-emerald-500">{stats.automatizacion.instancias_whatsapp.conectadas} conectadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Llamadas Voz AI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconifyIcon icon="solar:phone-bold" className="h-5 w-5 text-indigo-600" />
                Llamadas de Voz AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconifyIcon icon="solar:phone-calling-bold" className="h-5 w-5 text-indigo-600" />
                    <span className="font-medium text-indigo-800 dark:text-indigo-300">Total Llamadas</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-600">{stats.llamadas_voz.total.toLocaleString()}</p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconifyIcon icon="solar:check-circle-bold" className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-300">Completadas</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{stats.llamadas_voz.completadas.toLocaleString()}</p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconifyIcon icon="solar:clock-circle-bold" className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800 dark:text-blue-300">Duración</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{stats.llamadas_voz.duracion_minutos.toLocaleString()} min</p>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconifyIcon icon="solar:dollar-bold" className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800 dark:text-orange-300">Costo Total</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">${stats.llamadas_voz.costo_total_usd.toFixed(2)} USD</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Widgets adicionales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Últimos Brokers */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:clock-circle-bold" className="h-5 w-5 text-orange-600" />
                  Últimos Brokers Registrados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.actividad_reciente.ultimos_brokers.map((broker) => (
                    <div key={broker.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <IconifyIcon icon="solar:buildings-bold" className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="font-medium">{broker.name}</p>
                          <p className="text-xs text-gray-500">Plan: {{ starter: 'Starter', professional: 'Professional', business: 'Business', custom: 'A tu medida' }[broker.plan || ''] || broker.plan || 'Starter'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          broker.status === 'active' ? 'bg-green-100 text-green-700' :
                          broker.status === 'trial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {broker.status?.toUpperCase()}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(broker.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Alertas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:bell-bold" className="h-5 w-5 text-red-600" />
                  Alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <IconifyIcon icon="solar:danger-triangle-bold" className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800 dark:text-red-300">Siniestros Pendientes</span>
                    </div>
                    <p className="text-xl font-bold text-red-600">{stats.siniestros.pendientes}</p>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <IconifyIcon icon="solar:clock-circle-bold" className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Brokers en Trial</span>
                    </div>
                    <p className="text-xl font-bold text-yellow-600">{stats.brokers.en_trial}</p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <IconifyIcon icon="solar:info-circle-bold" className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Siniestros</span>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{stats.siniestros.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-500 text-sm">
            Última actualización: {new Date(stats.timestamp).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
};

export default MasterDashboardContent;
