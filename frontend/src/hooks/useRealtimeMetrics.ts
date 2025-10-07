import { useState, useEffect, useCallback } from 'react';
import useWebSocket from './useWebSocket';
import mockWebSocketService from 'src/services/mockWebSocketService';

export interface WhatsAppMetrics {
  connection_status: 'connected' | 'connecting' | 'disconnected' | 'error';
  phone_number?: string;
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  messages_failed: number;
  last_activity?: string;
}

export interface CampaignMetrics {
  total_campaigns: number;
  active_campaigns: number;
  completed_campaigns: number;
  paused_campaigns: number;
  total_messages_sent: number;
  total_messages_delivered: number;
  total_messages_read: number;
  total_messages_failed: number;
  overall_delivery_rate: number;
  overall_read_rate: number;
  active_campaign_progress: Array<{
    id: number;
    name: string;
    progress: number;
    sent: number;
    total: number;
    status: string;
  }>;
}

export interface RealtimeMetrics {
  whatsapp: WhatsAppMetrics;
  campaigns: CampaignMetrics;
  last_updated: string;
}

const DEFAULT_WHATSAPP_METRICS: WhatsAppMetrics = {
  connection_status: 'disconnected',
  messages_sent: 0,
  messages_delivered: 0,
  messages_read: 0,
  messages_failed: 0
};

const DEFAULT_CAMPAIGN_METRICS: CampaignMetrics = {
  total_campaigns: 0,
  active_campaigns: 0,
  completed_campaigns: 0,
  paused_campaigns: 0,
  total_messages_sent: 0,
  total_messages_delivered: 0,
  total_messages_read: 0,
  total_messages_failed: 0,
  overall_delivery_rate: 0,
  overall_read_rate: 0,
  active_campaign_progress: []
};

export const useRealtimeMetrics = () => {
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    whatsapp: DEFAULT_WHATSAPP_METRICS,
    campaigns: DEFAULT_CAMPAIGN_METRICS,
    last_updated: new Date().toISOString()
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // NO usar mock - solo datos reales
  const useMock = false;

  // Configurar WebSocket para producción
  const wsConfig = {
    url: `wss://${window.location.host}/ws/metrics`
  };

  const webSocketHook = useWebSocket(wsConfig);

  // Función para solicitar métricas iniciales
  const requestInitialMetrics = useCallback(() => {
    if (useMock) {
      if (mockWebSocketService.getConnectionState()) {
        mockWebSocketService.send({
          type: 'request_metrics',
          data: { broker_id: localStorage.getItem('broker_id') }
        });
      }
    } else if (webSocketHook.isConnected) {
      webSocketHook.sendMessage({
        type: 'request_metrics',
        data: { broker_id: localStorage.getItem('broker_id') }
      });
    }
  }, [useMock, webSocketHook.isConnected, webSocketHook.sendMessage]);

  // Usar solo WebSocket real - sin mock
  useEffect(() => {
    setIsConnected(webSocketHook.isConnected);
    setIsLoading(false); // No mostrar loading si no hay WebSocket
    
    if (webSocketHook.isConnected) {
      // Suscribirse a eventos reales
      const unsubscribeWhatsApp = webSocketHook.subscribe('whatsapp_metrics', (data: WhatsAppMetrics) => {
        console.log('📊 Métricas WhatsApp actualizadas:', data);
        setMetrics(prev => ({
          ...prev,
          whatsapp: { ...prev.whatsapp, ...data },
          last_updated: new Date().toISOString()
        }));
        setError(null);
      });

      const unsubscribeCampaigns = webSocketHook.subscribe('campaign_metrics', (data: CampaignMetrics) => {
        console.log('📊 Métricas de campañas actualizadas:', data);
        setMetrics(prev => ({
          ...prev,
          campaigns: { ...prev.campaigns, ...data },
          last_updated: new Date().toISOString()
        }));
        setError(null);
      });

      const unsubscribeUpdate = webSocketHook.subscribe('metrics_update', (data: Partial<RealtimeMetrics>) => {
        console.log('📊 Métricas completas actualizadas:', data);
        setMetrics(prev => ({
          whatsapp: { ...prev.whatsapp, ...data.whatsapp },
          campaigns: { ...prev.campaigns, ...data.campaigns },
          last_updated: data.last_updated || new Date().toISOString()
        }));
        setError(null);
      });

      const unsubscribeError = webSocketHook.subscribe('metrics_error', (data: { message: string }) => {
        console.error('❌ Error en métricas:', data.message);
        setError(data.message);
      });

      return () => {
        unsubscribeWhatsApp();
        unsubscribeCampaigns();
        unsubscribeUpdate();
        unsubscribeError();
      };
    }
  }, [webSocketHook.isConnected]);

  // Solicitar métricas iniciales cuando se conecte
  useEffect(() => {
    if (isConnected) {
      requestInitialMetrics();
    }
  }, [isConnected, requestInitialMetrics]);

  // Función para refrescar métricas manualmente
  const refreshMetrics = useCallback(() => {
    if (webSocketHook.isConnected) {
      setError(null);
      requestInitialMetrics();
    }
  }, [requestInitialMetrics, webSocketHook.isConnected]);

  // Función para suscribirse a métricas de una campaña específica
  const subscribeToCampaign = useCallback((campaignId: number) => {
    if (useMock && mockWebSocketService.getConnectionState()) {
      mockWebSocketService.send({
        type: 'subscribe_campaign',
        data: { campaign_id: campaignId }
      });
    } else if (!useMock && webSocketHook.isConnected) {
      webSocketHook.sendMessage({
        type: 'subscribe_campaign',
        data: { campaign_id: campaignId }
      });
    }
  }, [useMock, webSocketHook.isConnected, webSocketHook.sendMessage]);

  // Función para desuscribirse de métricas de una campaña específica
  const unsubscribeFromCampaign = useCallback((campaignId: number) => {
    if (useMock && mockWebSocketService.getConnectionState()) {
      mockWebSocketService.send({
        type: 'unsubscribe_campaign',
        data: { campaign_id: campaignId }
      });
    } else if (!useMock && webSocketHook.isConnected) {
      webSocketHook.sendMessage({
        type: 'unsubscribe_campaign',
        data: { campaign_id: campaignId }
      });
    }
  }, [useMock, webSocketHook.isConnected, webSocketHook.sendMessage]);

  // Calcular métricas derivadas
  const derivedMetrics = {
    whatsapp: {
      ...metrics.whatsapp,
      total_messages: metrics.whatsapp.messages_sent,
      success_rate: metrics.whatsapp.messages_sent > 0 
        ? Math.round((metrics.whatsapp.messages_delivered / metrics.whatsapp.messages_sent) * 100)
        : 0,
      read_rate: metrics.whatsapp.messages_delivered > 0
        ? Math.round((metrics.whatsapp.messages_read / metrics.whatsapp.messages_delivered) * 100)
        : 0
    },
    campaigns: {
      ...metrics.campaigns,
      success_rate: metrics.campaigns.total_messages_sent > 0
        ? Math.round((metrics.campaigns.total_messages_delivered / metrics.campaigns.total_messages_sent) * 100)
        : 0,
      read_rate: metrics.campaigns.total_messages_delivered > 0
        ? Math.round((metrics.campaigns.total_messages_read / metrics.campaigns.total_messages_delivered) * 100)
        : 0
    }
  };

  return {
    metrics: {
      ...metrics,
      whatsapp: derivedMetrics.whatsapp,
      campaigns: derivedMetrics.campaigns
    },
    isLoading,
    error,
    isConnected,
    refreshMetrics,
    subscribeToCampaign,
    unsubscribeFromCampaign
  };
};

export default useRealtimeMetrics;