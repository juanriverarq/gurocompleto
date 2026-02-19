import React, { useState, useEffect } from 'react';
import { Card, Badge, Spinner, Select, Table, Progress } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from '../../../../layouts/full/shared/breadcrumb/BreadcrumbComp';
import api from 'src/config/api';

interface UserActivity {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  cargo: string;
  departamento: string;
  total_actions: number;
  last_activity: string | null;
  last_action: string | null;
  last_module: string | null;
}

interface DashboardSummary {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  total_actions: number;
  avg_actions_per_user: number;
  period_days: number;
}

interface AuditStats {
  total_actions: number;
  unique_users: number;
  period_days: number;
  actions_by_module: { module: string; total: number }[];
  actions_by_day: { date: string; total: number }[];
  top_users: { user_id: number; user_name: string; user_email: string; total_actions: number }[];
  top_actions: { action: string; total: number }[];
}

interface UserDetail {
  user: {
    id: number;
    nombres: string;
    apellidos: string;
    email: string;
    cargo: string;
    estado: string;
    ultimo_acceso: string | null;
  };
  stats: {
    total_actions: number;
    period_days: number;
    actions_by_module: { module: string; total: number }[];
    actions_by_day: { date: string; total: number }[];
    ips_used: { ip_address: string; total: number; last_used: string }[];
  };
  recent_actions: {
    id: number;
    action: string;
    module: string;
    path: string;
    created_at: string;
    ip_address: string;
    metadata?: {
      poliza_id?: number;
      policy_number?: string;
      cliente_id?: number;
      cliente_nombre?: string;
      siniestro_id?: number;
      update_fields?: string[];
      [key: string]: any;
    };
    request_payload?: any;
  }[];
}

const BCrumb = [
  { to: '/', title: 'Inicio' },
  { to: '/apps/admin/usuarios', title: 'Usuarios' },
  { title: 'Reportes de Actividad' },
];

const ReportesUsuarios: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dashboard data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [employees, setEmployees] = useState<UserActivity[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  
  // User detail
  const [, setSelectedUserId] = useState<number | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const fetchData = async (endpoint: string) => {
    const response = await api.get(endpoint);
    return response.data;
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [dashboardRes, statsRes] = await Promise.all([
        fetchData(`/saas/audit/users-dashboard?days=${days}`),
        fetchData(`/saas/audit/stats?days=${days}`),
      ]);
      
      if (dashboardRes.success) {
        setSummary(dashboardRes.summary);
        setEmployees(dashboardRes.employees);
      }
      if (statsRes.success) {
        setStats(statsRes.stats);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetail = async (userId: number) => {
    try {
      setLoadingUser(true);
      const res = await fetchData(`/saas/audit/user/${userId}?days=${days}`);
      if (res.success) {
        setUserDetail(res);
        setActiveTab('user-detail');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [days]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAction = (action: string | null) => {
    if (!action) return '-';
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActivityLevel = (actions: number, avg: number) => {
    if (actions === 0) return { color: 'gray', label: 'Inactivo' };
    if (actions < avg * 0.5) return { color: 'yellow', label: 'Bajo' };
    if (actions < avg * 1.5) return { color: 'blue', label: 'Normal' };
    return { color: 'green', label: 'Alto' };
  };

  const translateField = (field: string): string => {
    const translations: Record<string, string> = {
      'policy_number': 'número póliza',
      'insured_amount': 'valor asegurado',
      'insurance_company': 'aseguradora',
      'type': 'tipo',
      'product_name': 'producto',
      'premium_amount': 'prima',
      'commission_percentage': '% comisión',
      'commission_amount': 'comisión',
      'payment_frequency': 'periodicidad',
      'issue_date': 'fecha expedición',
      'start_date': 'fecha inicio',
      'end_date': 'fecha fin',
      'status': 'estado',
      'client_id': 'cliente',
      'beneficiary': 'beneficiario',
      'notes': 'notas',
      'coverage': 'cobertura',
      'deductible': 'deducible',
      'created': 'creado',
      'updated': 'actualizado',
      'deleted': 'eliminado',
    };
    return translations[field] || field.replace(/_/g, ' ');
  };

  const formatActionDetails = (action: any) => {
    const details: string[] = [];
    const metadata = action.metadata || {};
    const payload = action.request_payload || {};
    
    // Póliza
    if (metadata.policy_number || payload.numero_poliza) {
      details.push(`Póliza: ${metadata.policy_number || payload.numero_poliza}`);
    }
    if (metadata.poliza_id) {
      details.push(`ID: #${metadata.poliza_id}`);
    }
    
    // Cliente
    if (metadata.cliente_nombre || payload.cliente_nombre) {
      details.push(`Cliente: ${metadata.cliente_nombre || payload.cliente_nombre}`);
    }
    if (metadata.cliente_id || payload.cliente_id) {
      details.push(`Cliente ID: #${metadata.cliente_id || payload.cliente_id}`);
    }
    
    // Siniestro
    if (metadata.siniestro_id) {
      details.push(`Siniestro: #${metadata.siniestro_id}`);
    }
    
    // Aseguradora
    if (payload.aseguradora) {
      details.push(`Aseg: ${payload.aseguradora.substring(0, 20)}...`);
    }
    
    // Campos actualizados - traducidos
    if (metadata.update_fields && metadata.update_fields.length > 0) {
      const translatedFields = metadata.update_fields.map(translateField);
      const fieldsStr = translatedFields.slice(0, 3).join(', ');
      const more = translatedFields.length > 3 ? ` +${translatedFields.length - 3}` : '';
      details.push(`Campos: ${fieldsStr}${more}`);
    }
    
    return details.length > 0 ? details.join(' | ') : '-';
  };

  if (loading) {
    return (
      <>
        <BreadcrumbComp title="Reportes de Actividad" items={BCrumb} />
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Reportes de Actividad de Usuarios" items={BCrumb} />
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Icon icon="solar:calendar-linear" className="text-gray-500" />
              <span className="text-sm text-gray-600">Período:</span>
              <Select value={days} onChange={(e) => setDays(Number(e.target.value))} sizing="sm">
                <option value={7}>Últimos 7 días</option>
                <option value={15}>Últimos 15 días</option>
                <option value={30}>Últimos 30 días</option>
                <option value={60}>Últimos 60 días</option>
                <option value={90}>Últimos 90 días</option>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('dashboard'); setSelectedUserId(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon icon="solar:chart-2-linear" className="inline mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('ranking')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'ranking' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon icon="solar:ranking-linear" className="inline mr-2" />
              Ranking
            </button>
          </div>
        </div>
      </Card>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && summary && (
        <>
          {/* Resumen General */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100">
                  <Icon icon="solar:users-group-rounded-linear" className="text-2xl text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Empleados</p>
                  <p className="text-2xl font-bold">{summary.total_employees}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100">
                  <Icon icon="solar:user-check-linear" className="text-2xl text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Usuarios Activos</p>
                  <p className="text-2xl font-bold">{summary.active_employees}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-gray-100">
                  <Icon icon="solar:user-cross-linear" className="text-2xl text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Sin Actividad</p>
                  <p className="text-2xl font-bold">{summary.inactive_employees}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-purple-100">
                  <Icon icon="solar:bolt-linear" className="text-2xl text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Acciones</p>
                  <p className="text-2xl font-bold">{summary.total_actions.toLocaleString()}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-orange-100">
                  <Icon icon="solar:chart-linear" className="text-2xl text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Promedio/Usuario</p>
                  <p className="text-2xl font-bold">{summary.avg_actions_per_user}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Usuarios */}
            <Card>
              <h5 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="solar:medal-ribbon-star-linear" className="text-yellow-500" />
                Top 10 Usuarios Más Activos
              </h5>
              <div className="space-y-3">
                {stats?.top_users.slice(0, 10).map((user, index) => (
                  <div 
                    key={user.user_id} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => loadUserDetail(user.user_id)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-blue-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{user.user_name}</p>
                      <p className="text-xs text-gray-500">{user.user_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{user.total_actions}</p>
                      <p className="text-xs text-gray-500">acciones</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Acciones por Módulo */}
            <Card>
              <h5 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Icon icon="solar:widget-linear" className="text-blue-500" />
                Actividad por Módulo
              </h5>
              <div className="space-y-3">
                {stats?.actions_by_module.map((mod) => {
                  const maxActions = stats.actions_by_module[0]?.total || 1;
                  const percentage = (mod.total / maxActions) * 100;
                  return (
                    <div key={mod.module} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{mod.module || 'General'}</span>
                        <span className="text-gray-500">{mod.total.toLocaleString()}</span>
                      </div>
                      <Progress progress={percentage} color="blue" size="sm" />
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Tabla de Empleados */}
          <Card>
            <h5 className="text-lg font-semibold mb-4">Actividad de Todos los Empleados</h5>
            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Cargo</th>
                    <th>Acciones</th>
                    <th>Nivel</th>
                    <th>Última Actividad</th>
                    <th>Última Acción</th>
                    <th className="sticky-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const level = getActivityLevel(emp.total_actions, summary.avg_actions_per_user);
                    return (
                      <tr key={emp.id} className="group">
                        <td>
                          <div>
                            <p className="font-medium">{emp.nombres} {emp.apellidos}</p>
                            <p className="text-xs text-gray-500">{emp.email}</p>
                          </div>
                        </td>
                        <td>{emp.cargo || '-'}</td>
                        <td>
                          <span className="font-bold">{emp.total_actions}</span>
                        </td>
                        <td>
                          <Badge color={level.color as any}>{level.label}</Badge>
                        </td>
                        <td className="text-sm">
                          {formatDate(emp.last_activity)}
                        </td>
                        <td className="text-sm">
                          {formatAction(emp.last_action)}
                        </td>
                        <td className="sticky-right">
                          <button
                            onClick={() => loadUserDetail(emp.id)}
                            className="text-primary hover:underline text-sm"
                            disabled={loadingUser}
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Ranking Tab */}
      {activeTab === 'ranking' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h5 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:medal-ribbons-star-linear" className="text-yellow-500" />
              Ranking de Usuarios
            </h5>
            <div className="space-y-2">
              {stats.top_users.map((user, index) => (
                <div 
                  key={user.user_id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => loadUserDetail(user.user_id)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : 
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' : 
                    index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-500' : 
                    'bg-gradient-to-br from-blue-400 to-blue-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{user.user_name}</p>
                    <p className="text-sm text-gray-500">{user.user_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{user.total_actions}</p>
                    <p className="text-xs text-gray-500">acciones</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h5 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:bolt-circle-linear" className="text-purple-500" />
              Acciones Más Frecuentes
            </h5>
            <div className="space-y-3">
              {stats.top_actions.map((action, index) => (
                <div key={action.action} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{formatAction(action.action)}</p>
                  </div>
                  <Badge color="purple">{action.total.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* User Detail Tab */}
      {activeTab === 'user-detail' && userDetail && (
        <div className="space-y-6">
          <button
            onClick={() => { setActiveTab('dashboard'); setSelectedUserId(null); setUserDetail(null); }}
            className="flex items-center gap-2 text-gray-600 hover:text-primary"
          >
            <Icon icon="solar:arrow-left-linear" />
            Volver al Dashboard
          </button>

          {/* Info del Usuario */}
          <Card>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-3xl font-bold">
                {userDetail.user.nombres.charAt(0)}{userDetail.user.apellidos.charAt(0)}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{userDetail.user.nombres} {userDetail.user.apellidos}</h2>
                <p className="text-gray-500">{userDetail.user.email}</p>
                <div className="flex gap-4 mt-2">
                  <Badge color="blue">{userDetail.user.cargo || 'Sin cargo'}</Badge>
                  <Badge color={userDetail.user.estado === 'activo' ? 'green' : 'gray'}>
                    {userDetail.user.estado}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-primary">{userDetail.stats.total_actions}</p>
                <p className="text-gray-500">acciones en {userDetail.stats.period_days} días</p>
                <p className="text-sm text-gray-400 mt-2">
                  Último acceso: {formatDate(userDetail.user.ultimo_acceso)}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actividad por Módulo */}
            <Card>
              <h5 className="text-lg font-semibold mb-4">Actividad por Módulo</h5>
              <div className="space-y-3">
                {userDetail.stats.actions_by_module.map((mod) => {
                  const maxActions = userDetail.stats.actions_by_module[0]?.total || 1;
                  const percentage = (mod.total / maxActions) * 100;
                  return (
                    <div key={mod.module} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{mod.module || 'General'}</span>
                        <span className="text-gray-500">{mod.total}</span>
                      </div>
                      <Progress progress={percentage} color="blue" size="sm" />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* IPs Utilizadas */}
            <Card>
              <h5 className="text-lg font-semibold mb-4">Direcciones IP Utilizadas</h5>
              <div className="space-y-2">
                {userDetail.stats.ips_used.length > 0 ? (
                  userDetail.stats.ips_used.map((ip) => (
                    <div key={ip.ip_address} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:global-linear" className="text-gray-400" />
                        <span className="font-mono text-sm">{ip.ip_address}</span>
                      </div>
                      <div className="text-right text-sm">
                        <span className="text-gray-500">{ip.total} accesos</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No hay datos de IP disponibles</p>
                )}
              </div>
            </Card>
          </div>

          {/* Acciones Recientes */}
          <Card>
            <h5 className="text-lg font-semibold mb-4">Últimas 50 Acciones</h5>
            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Acción</th>
                    <th>Módulo</th>
                    <th>Detalles</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {userDetail.recent_actions.map((action) => (
                    <tr key={action.id} className="group">
                      <td className="text-xs whitespace-nowrap">{formatDate(action.created_at)}</td>
                      <td className="text-sm font-medium">{formatAction(action.action)}</td>
                      <td>
                        <Badge color="gray" size="sm">{action.module || 'General'}</Badge>
                      </td>
                      <td className="text-xs text-gray-600 max-w-md">
                        {formatActionDetails(action)}
                      </td>
                      <td className="text-xs font-mono">{action.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

export default ReportesUsuarios;
