import React from 'react';
import useRealtimeMetrics from '../../hooks/useRealtimeMetrics';

const RealtimeMetricsTest: React.FC = () => {
  const { metrics, isLoading, error, isConnected, refreshMetrics } = useRealtimeMetrics();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Test de Métricas en Tiempo Real</h1>
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
          </div>
          <button
            onClick={refreshMetrics}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Cargando...' : 'Refrescar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800">Error:</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Metrics */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Métricas de WhatsApp</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Estado:</span>
              <span className={`font-medium ${
                metrics.whatsapp.connection_status === 'connected' ? 'text-green-600' : 'text-red-600'
              }`}>
                {metrics.whatsapp.connection_status}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Teléfono:</span>
              <span className="font-medium">{metrics.whatsapp.phone_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Mensajes Enviados:</span>
              <span className="font-bold text-blue-600">{metrics.whatsapp.messages_sent}</span>
            </div>
            <div className="flex justify-between">
              <span>Mensajes Entregados:</span>
              <span className="font-bold text-green-600">{metrics.whatsapp.messages_delivered}</span>
            </div>
            <div className="flex justify-between">
              <span>Mensajes Leídos:</span>
              <span className="font-bold text-purple-600">{metrics.whatsapp.messages_read}</span>
            </div>
            <div className="flex justify-between">
              <span>Mensajes Fallidos:</span>
              <span className="font-bold text-red-600">{metrics.whatsapp.messages_failed}</span>
            </div>
            <div className="flex justify-between">
              <span>Tasa de Éxito:</span>
              <span className="font-bold text-indigo-600">{metrics.whatsapp.success_rate}%</span>
            </div>
            <div className="flex justify-between">
              <span>Tasa de Lectura:</span>
              <span className="font-bold text-orange-600">{metrics.whatsapp.read_rate}%</span>
            </div>
          </div>
        </div>

        {/* Campaign Metrics */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Métricas de Campañas</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Total Campañas:</span>
              <span className="font-bold text-blue-600">{metrics.campaigns.total_campaigns}</span>
            </div>
            <div className="flex justify-between">
              <span>Campañas Activas:</span>
              <span className="font-bold text-green-600">{metrics.campaigns.active_campaigns}</span>
            </div>
            <div className="flex justify-between">
              <span>Campañas Completadas:</span>
              <span className="font-bold text-gray-600">{metrics.campaigns.completed_campaigns}</span>
            </div>
            <div className="flex justify-between">
              <span>Campañas Pausadas:</span>
              <span className="font-bold text-yellow-600">{metrics.campaigns.paused_campaigns}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Mensajes Enviados:</span>
              <span className="font-bold text-blue-600">{metrics.campaigns.total_messages_sent}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Mensajes Entregados:</span>
              <span className="font-bold text-green-600">{metrics.campaigns.total_messages_delivered}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Mensajes Leídos:</span>
              <span className="font-bold text-purple-600">{metrics.campaigns.total_messages_read}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Mensajes Fallidos:</span>
              <span className="font-bold text-red-600">{metrics.campaigns.total_messages_failed}</span>
            </div>
            <div className="flex justify-between">
              <span>Tasa de Entrega General:</span>
              <span className="font-bold text-indigo-600">{metrics.campaigns.overall_delivery_rate}%</span>
            </div>
            <div className="flex justify-between">
              <span>Tasa de Lectura General:</span>
              <span className="font-bold text-orange-600">{metrics.campaigns.overall_read_rate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Campaign Progress */}
      {metrics.campaigns.active_campaign_progress.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Progreso de Campañas Activas</h2>
          <div className="space-y-4">
            {metrics.campaigns.active_campaign_progress.map((campaign) => (
              <div key={campaign.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{campaign.name}</span>
                  <span className="text-sm text-gray-500">
                    {campaign.sent}/{campaign.total} ({campaign.progress}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${campaign.progress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  Estado: <span className="font-medium">{campaign.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Última actualización: {new Date(metrics.last_updated).toLocaleString()}
      </div>
    </div>
  );
};

export default RealtimeMetricsTest;