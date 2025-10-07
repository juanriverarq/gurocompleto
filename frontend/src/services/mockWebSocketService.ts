import { WhatsAppMetrics, CampaignMetrics, RealtimeMetrics } from '../hooks/useRealtimeMetrics';

// Servicio mock para simular WebSocket durante desarrollo
class MockWebSocketService {
  private listeners: Map<string, (data: any) => void> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private isConnected = false;

  // Datos mock iniciales
  private mockData: RealtimeMetrics = {
    whatsapp: {
      connection_status: 'connected',
      phone_number: '+57 300 123 4567',
      messages_sent: 1250,
      messages_delivered: 1180,
      messages_read: 890,
      messages_failed: 70,
      last_activity: new Date().toISOString()
    },
    campaigns: {
      total_campaigns: 15,
      active_campaigns: 3,
      completed_campaigns: 10,
      paused_campaigns: 2,
      total_messages_sent: 5420,
      total_messages_delivered: 5100,
      total_messages_read: 3850,
      total_messages_failed: 320,
      overall_delivery_rate: 94,
      overall_read_rate: 75,
      active_campaign_progress: [
        {
          id: 1,
          name: 'Promoción Enero 2024',
          progress: 65,
          sent: 650,
          total: 1000,
          status: 'active'
        },
        {
          id: 2,
          name: 'Recordatorio Pólizas',
          progress: 30,
          sent: 150,
          total: 500,
          status: 'active'
        },
        {
          id: 3,
          name: 'Seguimiento Clientes',
          progress: 85,
          sent: 340,
          total: 400,
          status: 'active'
        }
      ]
    },
    last_updated: new Date().toISOString()
  };

  connect(): Promise<void> {
    return new Promise((resolve) => {
      console.log('🔌 Mock WebSocket conectando...');
      
      setTimeout(() => {
        this.isConnected = true;
        console.log('✅ Mock WebSocket conectado');
        
        // Enviar datos iniciales
        this.emitEvent('metrics_update', this.mockData);
        
        // Simular actualizaciones periódicas
        this.startPeriodicUpdates();
        
        resolve();
      }, 1000);
    });
  }

  disconnect(): void {
    console.log('🔌 Mock WebSocket desconectando...');
    this.isConnected = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.listeners.clear();
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    this.listeners.set(event, callback);
    
    // Si ya estamos conectados, enviar datos inmediatamente
    if (this.isConnected) {
      if (event === 'metrics_update') {
        callback(this.mockData);
      } else if (event === 'whatsapp_metrics') {
        callback(this.mockData.whatsapp);
      } else if (event === 'campaign_metrics') {
        callback(this.mockData.campaigns);
      }
    }
    
    // Retornar función de cleanup
    return () => {
      this.listeners.delete(event);
    };
  }

  send(message: any): void {
    if (!this.isConnected) {
      console.warn('⚠️ Mock WebSocket no está conectado');
      return;
    }

    console.log('📤 Mock WebSocket enviando:', message);

    // Simular respuestas a diferentes tipos de mensajes
    if (message.type === 'request_metrics') {
      setTimeout(() => {
        this.emitEvent('metrics_update', this.mockData);
      }, 500);
    } else if (message.type === 'subscribe_campaign') {
      console.log(`📊 Suscrito a campaña ${message.data.campaign_id}`);
    } else if (message.type === 'ping') {
      this.emitEvent('pong', {});
    }
  }

  getConnectionState(): boolean {
    return this.isConnected;
  }

  private startPeriodicUpdates(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.interval = setInterval(() => {
      if (!this.isConnected) return;

      // Simular cambios en los datos
      this.updateMockData();
      
      // Emitir actualizaciones
      this.emitEvent('metrics_update', this.mockData);
      
      // Ocasionalmente emitir eventos específicos
      if (Math.random() > 0.7) {
        this.emitEvent('whatsapp_metrics', this.mockData.whatsapp);
      }
      
      if (Math.random() > 0.8) {
        this.emitEvent('campaign_metrics', this.mockData.campaigns);
      }
      
    }, 5000); // Actualizar cada 5 segundos
  }

  private updateMockData(): void {
    const now = new Date().toISOString();
    
    // Simular incrementos en mensajes
    if (Math.random() > 0.6) {
      const increment = Math.floor(Math.random() * 5) + 1;
      this.mockData.whatsapp.messages_sent += increment;
      this.mockData.campaigns.total_messages_sent += increment;
      
      // Simular entregas (90% de éxito)
      const delivered = Math.floor(increment * 0.9);
      this.mockData.whatsapp.messages_delivered += delivered;
      this.mockData.campaigns.total_messages_delivered += delivered;
      
      // Simular lecturas (70% de los entregados)
      const read = Math.floor(delivered * 0.7);
      this.mockData.whatsapp.messages_read += read;
      this.mockData.campaigns.total_messages_read += read;
      
      // Simular fallos
      const failed = increment - delivered;
      this.mockData.whatsapp.messages_failed += failed;
      this.mockData.campaigns.total_messages_failed += failed;
    }

    // Actualizar tasas
    this.mockData.campaigns.overall_delivery_rate = Math.round(
      (this.mockData.campaigns.total_messages_delivered / this.mockData.campaigns.total_messages_sent) * 100
    );
    
    this.mockData.campaigns.overall_read_rate = Math.round(
      (this.mockData.campaigns.total_messages_read / this.mockData.campaigns.total_messages_delivered) * 100
    );

    // Simular progreso de campañas activas
    this.mockData.campaigns.active_campaign_progress.forEach(campaign => {
      if (campaign.progress < 100 && Math.random() > 0.7) {
        const increment = Math.floor(Math.random() * 10) + 1;
        campaign.sent = Math.min(campaign.sent + increment, campaign.total);
        campaign.progress = Math.round((campaign.sent / campaign.total) * 100);
        
        if (campaign.progress >= 100) {
          campaign.status = 'completed';
        }
      }
    });

    // Actualizar timestamp
    this.mockData.last_updated = now;
    this.mockData.whatsapp.last_activity = now;
  }

  private emitEvent(event: string, data: any): void {
    const listener = this.listeners.get(event);
    if (listener) {
      listener(data);
    }
  }
}

// Singleton instance
export const mockWebSocketService = new MockWebSocketService();
export default mockWebSocketService;