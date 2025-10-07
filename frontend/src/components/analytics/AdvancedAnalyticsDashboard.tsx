import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Badge } from 'src/components/shadcn-ui/Default-Ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/shadcn-ui/Default-Ui/tabs';
import campaignService from 'src/services/campaignService';
import whatsappMicroservice from 'src/services/whatsappMicroservice';

// Componentes de gráficos
import RealtimeMetricsChart from 'src/components/analytics/charts/RealtimeMetricsChart';
import CampaignPerformanceChart from 'src/components/analytics/charts/CampaignPerformanceChart';
import DeliveryRateChart from 'src/components/analytics/charts/DeliveryRateChart';
import MessageTimelineChart from 'src/components/analytics/charts/MessageTimelineChart';

interface AdvancedAnalyticsDashboardProps {
  className?: string;
}

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({ className }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);
  const [campaignStats, setCampaignStats] = useState<any>(null);
  const [whatsappStats, setWhatsappStats] = useState<any>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [campaignResult, whatsappStatsResult, whatsappStatusResult] = await Promise.all([
        campaignService.getCampaignStats(),
        whatsappMicroservice.getStats(),
        whatsappMicroservice.getConnectionStatus()
      ]);

      if (campaignResult.success) {
        setCampaignStats(campaignResult.stats);
      }
      
      setWhatsappStats(whatsappStatsResult);
      setWhatsappStatus(whatsappStatusResult);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Datos derivados para gráficos
  const dashboardData = {
    totalMessages: campaignStats?.total_messages_sent || 0,
    deliveryRate: campaignStats?.overall_delivery_rate || 0,
    readRate: whatsappStats?.read_rate || 0,
    activeCampaigns: campaignStats?.active_campaigns || 0,
    whatsappStatus: whatsappStatus?.status || 'disconnected',
    lastUpdate: new Date().toISOString()
  };

  const timeRangeOptions = [
    { value: '1h', label: 'Última Hora' },
    { value: '24h', label: 'Últimas 24h' },
    { value: '7d', label: 'Últimos 7 días' },
    { value: '30d', label: 'Últimos 30 días' }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Avanzado</h1>
          <p className="text-gray-600">Dashboard completo con métricas en tiempo real</p>
        </div>
        
        <div className="flex items-center gap-3">

          {/* Selector de rango de tiempo */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="px-3 py-1 border rounded text-sm"
          >
            {timeRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Refresh manual */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalyticsData}
            disabled={loading}
          >
            <Icon
              icon={loading ? "solar:refresh-bold animate-spin" : "solar:refresh-bold"}
              className="w-4 h-4"
            />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Mensajes Totales</p>
                <p className="text-2xl font-bold text-blue-600">{dashboardData.totalMessages.toLocaleString()}</p>
              </div>
              <Icon icon="solar:chat-square-code-bold" className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasa de Entrega</p>
                <p className="text-2xl font-bold text-green-600">{dashboardData.deliveryRate}%</p>
              </div>
              <Icon icon="solar:check-circle-bold" className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasa de Lectura</p>
                <p className="text-2xl font-bold text-purple-600">{dashboardData.readRate}%</p>
              </div>
              <Icon icon="solar:eye-bold" className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Campañas Activas</p>
                <p className="text-2xl font-bold text-orange-600">{dashboardData.activeCampaigns}</p>
              </div>
              <Icon icon="solar:rocket-bold" className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
          <TabsTrigger value="delivery">Entregas</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon icon="solar:chart-2-bold" className="w-5 h-5" />
                  Métricas en Tiempo Real
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Icon icon="solar:chart-2-bold" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Gráficos disponibles cuando se implemente WebSocket</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon icon="solar:pie-chart-2-bold" className="w-5 h-5" />
                  Distribución de Estados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Icon icon="solar:pie-chart-2-bold" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Distribución disponible cuando se implemente backend</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="solar:rocket-bold" className="w-5 h-5" />
                Rendimiento de Campañas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Icon icon="solar:rocket-bold" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Rendimiento disponible cuando haya campañas activas</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="solar:chart-square-bold" className="w-5 h-5" />
                Análisis de Entregas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Icon icon="solar:chart-square-bold" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Análisis detallado disponible con datos reales</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="solar:clock-circle-bold" className="w-5 h-5" />
                Timeline de Mensajes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Icon icon="solar:clock-circle-bold" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Timeline disponible con historial real</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Estado de conexión y última actualización */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  dashboardData.whatsappStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-sm font-medium">
                  WhatsApp: {dashboardData.whatsappStatus === 'connected' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Icon icon="solar:clock-circle-bold" className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Última actualización: {new Date(dashboardData.lastUpdate).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;