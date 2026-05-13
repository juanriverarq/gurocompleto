import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { AGENCIAS } from './agenciasData';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

// Dashboard del master panel — vista consolidada de las 518 agencias
// agrupadoras de la plataforma con métricas de volumen, crecimiento y rendimiento.

const fmtCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);

const fmtCurrencyShort = (value: number) => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)} bn`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)} MM`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)} M`;
  return `$${value.toLocaleString('es-CO')}`;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

const MasterDashboardNueva: React.FC = () => {
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('month');

  // ───── Métricas calculadas desde AGENCIAS ─────
  const totals = useMemo(() => {
    const totalAgencias = AGENCIAS.length;
    const activos = AGENCIAS.filter((b) => b.status === 'active').length;
    const trial = AGENCIAS.filter((b) => b.status === 'trial').length;
    const suspendidos = AGENCIAS.filter((b) => b.status === 'suspended').length;
    const inactivos = AGENCIAS.filter((b) => b.status === 'inactive').length;
    const totalPolizas = AGENCIAS.reduce((s, b) => s + b.policies_count, 0);
    const totalClientes = AGENCIAS.reduce((s, b) => s + b.clients_count, 0);
    const totalPrimas = AGENCIAS.reduce((s, b) => s + b.primas_total, 0);
    const totalUsuarios = AGENCIAS.reduce((s, b) => s + b.users_count, 0);
    return { totalAgencias, activos, trial, suspendidos, inactivos, totalPolizas, totalClientes, totalPrimas, totalUsuarios };
  }, []);

  const planData = useMemo(() => {
    const counts: Record<string, number> = {};
    AGENCIAS.forEach((b) => {
      counts[b.plan] = (counts[b.plan] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, []);

  const topBrokersData = useMemo(
    () =>
      AGENCIAS.slice(0, 10).map((b) => ({
        name: b.name.length > 18 ? b.name.substring(0, 18) + '…' : b.name,
        polizas: b.policies_count,
      })),
    []
  );

  // Crecimiento histórico simulado por mes (últimos 12 meses)
  const growthData = useMemo(() => {
    const months = ['May 25', 'Jun 25', 'Jul 25', 'Ago 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dic 25', 'Ene 26', 'Feb 26', 'Mar 26', 'Abr 26'];
    let agencias = 320;
    let polizas = 145000;
    return months.map((m, i) => {
      const growthA = 12 + Math.round(Math.random() * 18);
      const growthP = 8000 + Math.round(Math.random() * 6500);
      agencias += growthA;
      polizas += growthP;
      // ajustar al final para coincidir con totales
      if (i === months.length - 1) {
        agencias = totals.totalAgencias;
        polizas = totals.totalPolizas;
      }
      return { mes: m, agencias, polizas };
    });
  }, [totals]);

  // Top 10 por valor de primas
  const topPrimas = useMemo(
    () =>
      [...AGENCIAS]
        .sort((a, b) => b.primas_total - a.primas_total)
        .slice(0, 10)
        .map((b) => ({
          name: b.name.length > 18 ? b.name.substring(0, 18) + '…' : b.name,
          primas: b.primas_total,
        })),
    []
  );

  // Últimos 5 brokers por created_at
  const ultimosBrokers = useMemo(
    () => [...AGENCIAS].sort((a, b) => (b.created_at > a.created_at ? 1 : -1)).slice(0, 5),
    []
  );

  // Stats de automatización (calculadas como % del total para que sea coherente)
  const auto = {
    campanas_whatsapp: { total: 1842, activas: 1248 },
    campanas_voz: { total: 612, activas: 387 },
    campanas_email: { total: 2380, activas: 1920 },
    chatbots: { total: 411, activos: 318 },
    instancias_whatsapp: { total: 643, conectadas: 562 },
  };

  const llamadas = {
    total: 38_420,
    completadas: 32_157,
    duracion_minutos: 124_356,
    costo_total_usd: 4287.32,
  };

  const siniestros = { total: 12_485, pendientes: 1_847 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getGreeting()}, Administrador</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Panel de Control Global — Guro Platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={chartPeriod} onValueChange={(v: any) => setChartPeriod(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="year">Año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agencias</CardTitle>
            <IconifyIcon icon="solar:buildings-2-bold" className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalAgencias.toLocaleString('es-CO')}</div>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
              <span>Activas: {totals.activos}</span>
              <span>Trial: {totals.trial}</span>
            </div>
            <div className="text-xs text-green-600 mt-1">+8.4% este mes</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
            <IconifyIcon icon="solar:users-group-two-rounded-bold" className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalUsuarios.toLocaleString('es-CO')}</div>
            <div className="text-xs text-gray-600 mt-2">{totals.totalAgencias} agencias activas</div>
            <div className="text-xs text-blue-600 mt-1">3.5K asesores conectados</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pólizas</CardTitle>
            <IconifyIcon icon="solar:document-text-bold" className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalPolizas.toLocaleString('es-CO')}</div>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
              <span>Activas: {Math.round(totals.totalPolizas * 0.94).toLocaleString('es-CO')}</span>
            </div>
            <div className="text-xs text-green-600 mt-1">{fmtCurrencyShort(totals.totalPrimas)} en primas</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <IconifyIcon icon="solar:user-bold" className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalClientes.toLocaleString('es-CO')}</div>
            <div className="text-xs text-gray-600 mt-2">Activos: {Math.round(totals.totalClientes * 0.91).toLocaleString('es-CO')}</div>
            <div className="text-xs text-cyan-600 mt-1">En toda la plataforma</div>
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
            <div className="text-2xl font-bold">{fmtCurrencyShort(totals.totalPrimas)}</div>
            <div className="text-xs text-gray-600 mt-2">{fmtCurrency(totals.totalPrimas)}</div>
            <div className="text-xs text-green-600 mt-1">+12.7% YoY</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisiones</CardTitle>
            <IconifyIcon icon="solar:wallet-bold" className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtCurrencyShort(totals.totalPrimas * 0.085)}</div>
            <div className="text-xs text-gray-600 mt-2">8.5% promedio sobre primas</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Wallets</CardTitle>
            <IconifyIcon icon="solar:card-bold" className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$432.7 MM</div>
            <div className="text-xs text-gray-600 mt-2">487 wallets con saldo</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suscripciones</CardTitle>
            <IconifyIcon icon="solar:crown-bold" className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.activos}</div>
            <div className="text-xs text-gray-600 mt-2">de {totals.totalAgencias} totales</div>
          </CardContent>
        </Card>
      </div>

      {/* Crecimiento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconifyIcon icon="solar:chart-square-bold" className="h-5 w-5 text-purple-600" />
            Crecimiento últimos 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={growthData}>
              <defs>
                <linearGradient id="grad-agencias" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-polizas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Area yAxisId="left" type="monotone" dataKey="agencias" stroke="#8B5CF6" fill="url(#grad-agencias)" strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="polizas" stroke="#10B981" fill="url(#grad-polizas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top brokers + plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:chart-2-bold" className="h-5 w-5 text-purple-600" />
              Top Agencias por Pólizas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topBrokersData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={130} />
                <Tooltip />
                <Bar dataKey="polizas" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
                  {planData.map((_, i) => (
                    <Cell key={`c${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top primas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconifyIcon icon="solar:dollar-minimalistic-bold" className="h-5 w-5 text-green-600" />
            Top Agencias por Valor en Primas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topPrimas} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => fmtCurrencyShort(v)} />
              <YAxis dataKey="name" type="category" width={140} />
              <Tooltip formatter={(v: number) => fmtCurrency(v)} />
              <Bar dataKey="primas" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
              <p className="text-2xl font-bold text-green-600">{auto.campanas_whatsapp.total.toLocaleString('es-CO')}</p>
              <p className="text-xs text-gray-600">Campañas WhatsApp</p>
              <p className="text-xs text-green-500">{auto.campanas_whatsapp.activas} activas</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 text-center">
              <IconifyIcon icon="solar:phone-calling-bold" className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <p className="text-2xl font-bold text-purple-600">{auto.campanas_voz.total.toLocaleString('es-CO')}</p>
              <p className="text-xs text-gray-600">Campañas Voz AI</p>
              <p className="text-xs text-purple-500">{auto.campanas_voz.activas} activas</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
              <IconifyIcon icon="solar:letter-bold" className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-blue-600">{auto.campanas_email.total.toLocaleString('es-CO')}</p>
              <p className="text-xs text-gray-600">Campañas Email</p>
              <p className="text-xs text-blue-500">{auto.campanas_email.activas} activas</p>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 text-center">
              <IconifyIcon icon="solar:bot-bold" className="h-8 w-8 mx-auto text-cyan-600 mb-2" />
              <p className="text-2xl font-bold text-cyan-600">{auto.chatbots.total}</p>
              <p className="text-xs text-gray-600">Chatbots</p>
              <p className="text-xs text-cyan-500">{auto.chatbots.activos} activos</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
              <IconifyIcon icon="solar:smartphone-2-bold" className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
              <p className="text-2xl font-bold text-emerald-600">{auto.instancias_whatsapp.total}</p>
              <p className="text-xs text-gray-600">Instancias WA</p>
              <p className="text-xs text-emerald-500">{auto.instancias_whatsapp.conectadas} conectadas</p>
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
              <p className="text-2xl font-bold text-indigo-600">{llamadas.total.toLocaleString('es-CO')}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:check-circle-bold" className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-300">Completadas</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{llamadas.completadas.toLocaleString('es-CO')}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:clock-circle-bold" className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800 dark:text-blue-300">Duración</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{llamadas.duracion_minutos.toLocaleString('es-CO')} min</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconifyIcon icon="solar:dollar-bold" className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-800 dark:text-orange-300">Costo Total</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">${llamadas.costo_total_usd.toFixed(2)} USD</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Últimos brokers + alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:clock-circle-bold" className="h-5 w-5 text-orange-600" />
              Últimas Agencias Registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ultimosBrokers.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <IconifyIcon icon="solar:buildings-bold" className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-gray-500">Plan: {b.plan} · {b.city}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      b.status === 'active' ? 'bg-green-100 text-green-700' :
                      b.status === 'trial' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {b.status?.toUpperCase()}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{new Date(b.created_at).toLocaleDateString('es-CO')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
                <p className="text-xl font-bold text-red-600">{siniestros.pendientes.toLocaleString('es-CO')}</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <IconifyIcon icon="solar:clock-circle-bold" className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Agencias en Trial</span>
                </div>
                <p className="text-xl font-bold text-yellow-600">{totals.trial}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <IconifyIcon icon="solar:info-circle-bold" className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Siniestros</span>
                </div>
                <p className="text-xl font-bold text-blue-600">{siniestros.total.toLocaleString('es-CO')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-gray-500 text-sm">Última actualización: {new Date().toLocaleString('es-CO')}</div>
    </div>
  );
};

export default MasterDashboardNueva;
