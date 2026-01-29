import React, { useState, useEffect } from 'react';
import { Badge, Card, Spinner, Select } from 'flowbite-react';
import { Icon } from '@iconify/react';
import chatbotService from '../../../../services/chatbotService';

interface ChatbotAnalyticsPanelProps {
  chatbotId: number;
  chatbotName: string;
}

interface SessionData {
  id: number;
  contact_phone: string;
  status: string;
  current_flow_id: number | null;
  current_node_id: number | null;
  variables: Record<string, any>;
  started_at: string;
  last_activity_at: string;
  flow?: { name: string };
  node?: { name: string; node_type: string };
}

interface AnalyticsData {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  transferred_sessions: number;
  expired_sessions: number;
  avg_session_duration_minutes: number;
  sessions_today: number;
  sessions_this_week: number;
  node_stats: { node_id: number; node_name: string; node_type: string; visits: number; drop_offs: number }[];
  recent_sessions: SessionData[];
}

const ChatbotAnalyticsPanel: React.FC<ChatbotAnalyticsPanelProps> = ({ chatbotId, chatbotName }) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [chatbotId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await chatbotService.getChatbotAnalytics(chatbotId, timeRange);
      setAnalytics(data);
      setError(null);
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError('No se pudieron cargar las estadísticas');
      // Datos de ejemplo si falla la API
      setAnalytics({
        total_sessions: 0,
        active_sessions: 0,
        completed_sessions: 0,
        transferred_sessions: 0,
        expired_sessions: 0,
        avg_session_duration_minutes: 0,
        sessions_today: 0,
        sessions_this_week: 0,
        node_stats: [],
        recent_sessions: []
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'info';
      case 'waiting_input': return 'warning';
      case 'completed': return 'success';
      case 'transferred': return 'purple';
      case 'expired': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Activa';
      case 'waiting_input': return 'Esperando respuesta';
      case 'completed': return 'Completada';
      case 'transferred': return 'Transferida';
      case 'expired': return 'Expirada';
      default: return status;
    }
  };

  const formatPhone = (phone: string) => {
    if (phone.length > 10) {
      return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
    }
    return phone;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)} h`;
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon icon="solar:chart-2-bold" className="text-blue-500" width={24} />
            Análisis de {chatbotName}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Estadísticas y comportamiento de las conversaciones
          </p>
        </div>
        <Select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="w-40"
        >
          <option value="today">Hoy</option>
          <option value="week">Esta semana</option>
          <option value="month">Este mes</option>
          <option value="all">Todo el tiempo</option>
        </Select>
      </div>

      {error && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">{error}</p>
        </div>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Icon icon="solar:chat-round-dots-bold" className="text-blue-600" width={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.total_sessions || 0}
              </p>
              <p className="text-xs text-gray-500">Sesiones totales</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Icon icon="solar:play-circle-bold" className="text-green-600" width={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.active_sessions || 0}
              </p>
              <p className="text-xs text-gray-500">Sesiones activas</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Icon icon="solar:check-circle-bold" className="text-purple-600" width={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.completed_sessions || 0}
              </p>
              <p className="text-xs text-gray-500">Completadas</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
              <Icon icon="solar:user-hand-up-bold" className="text-orange-600" width={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.transferred_sessions || 0}
              </p>
              <p className="text-xs text-gray-500">Transferidas</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Estadísticas por nodo */}
      {analytics?.node_stats && analytics.node_stats.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Icon icon="solar:diagram-up-bold" className="text-blue-500" width={20} />
            Rendimiento por paso
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Paso</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Tipo</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Visitas</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Abandonos</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">% Continuación</th>
                </tr>
              </thead>
              <tbody>
                {analytics.node_stats.map((node, idx) => {
                  const continuationRate = node.visits > 0 
                    ? Math.round(((node.visits - node.drop_offs) / node.visits) * 100) 
                    : 0;
                  return (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">
                        {node.node_name || `Nodo ${node.node_id}`}
                      </td>
                      <td className="py-2 px-3">
                        <Badge color="gray" size="sm">{node.node_type}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                        {node.visits}
                      </td>
                      <td className="py-2 px-3 text-right text-red-600">
                        {node.drop_offs}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-medium ${continuationRate >= 70 ? 'text-green-600' : continuationRate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {continuationRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sesiones recientes */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Icon icon="solar:history-bold" className="text-blue-500" width={20} />
          Sesiones recientes
        </h3>
        
        {analytics?.recent_sessions && analytics.recent_sessions.length > 0 ? (
          <div className="space-y-3">
            {analytics.recent_sessions.map((session) => (
              <div 
                key={session.id} 
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:phone-bold" className="text-gray-400" width={16} />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatPhone(session.contact_phone)}
                    </span>
                  </div>
                  <Badge color={getStatusColor(session.status)} size="sm">
                    {getStatusLabel(session.status)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {session.flow && (
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:diagram-up-bold" width={14} />
                      {session.flow.name}
                    </span>
                  )}
                  {session.node && (
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:widget-bold" width={14} />
                      {session.node.name || session.node.node_type}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:clock-circle-bold" width={14} />
                    {formatTime(session.last_activity_at)}
                  </span>
                </div>

                {/* Variables capturadas */}
                {session.variables && Object.keys(session.variables).filter(k => !k.startsWith('_')).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Datos capturados:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(session.variables)
                        .filter(([key]) => !key.startsWith('_'))
                        .slice(0, 5)
                        .map(([key, value]) => (
                          <Badge key={key} color="gray" size="xs">
                            {key}: {String(value).slice(0, 20)}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Icon icon="solar:chat-round-dots-bold-duotone" className="mx-auto mb-2 opacity-50" width={48} />
            <p>No hay sesiones recientes</p>
            <p className="text-sm">Las conversaciones aparecerán aquí cuando los usuarios interactúen con el chatbot</p>
          </div>
        )}
      </Card>

      {/* Métricas adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Icon icon="solar:clock-circle-bold" className="text-gray-600" width={20} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {analytics?.avg_session_duration_minutes || 0} min
              </p>
              <p className="text-xs text-gray-500">Duración promedio</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Icon icon="solar:calendar-bold" className="text-gray-600" width={20} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {analytics?.sessions_today || 0}
              </p>
              <p className="text-xs text-gray-500">Sesiones hoy</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Icon icon="solar:close-circle-bold" className="text-gray-600" width={20} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {analytics?.expired_sessions || 0}
              </p>
              <p className="text-xs text-gray-500">Sesiones expiradas</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChatbotAnalyticsPanel;
