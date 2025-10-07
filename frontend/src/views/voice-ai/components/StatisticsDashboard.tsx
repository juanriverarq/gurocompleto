import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Clock,
  Phone,
  Users,
  Target,
  Activity,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  Zap,
  Volume2,
  MessageSquare
} from 'lucide-react';

interface StatisticsData {
  overview: {
    totalCalls: number;
    totalCost: number;
    avgDuration: number;
    successRate: number;
    totalMinutes: number;
    activeAgents: number;
    avgCostPerCall: number;
    conversionRate: number;
  };
  trends: {
    callsGrowth: number;
    costGrowth: number;
    successRateGrowth: number;
    durationGrowth: number;
  };
  dailyStats: Array<{
    date: string;
    calls: number;
    cost: number;
    success: number;
    duration: number;
  }>;
  agentStats: Array<{
    id: string;
    name: string;
    calls: number;
    success: number;
    avgDuration: number;
    cost: number;
    rating: number;
  }>;
  campaignStats: Array<{
    id: string;
    name: string;
    calls: number;
    success: number;
    cost: number;
    roi: number;
  }>;
  sentimentAnalysis: {
    positive: number;
    neutral: number;
    negative: number;
  };
  timeDistribution: Array<{
    hour: number;
    calls: number;
    success: number;
  }>;
  outcomeDistribution: {
    success: number;
    follow_up: number;
    not_interested: number;
    callback: number;
    voicemail: number;
  };
}

const StatisticsDashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('calls');

  useEffect(() => {
    loadStatistics();
  }, [timeRange]);

  const loadStatistics = async () => {
    setIsLoading(true);
    try {
      // Simular datos de estadísticas
      const mockStats: StatisticsData = {
        overview: {
          totalCalls: 1247,
          totalCost: 623.50,
          avgDuration: 245,
          successRate: 78.5,
          totalMinutes: 5125,
          activeAgents: 5,
          avgCostPerCall: 0.50,
          conversionRate: 68.2
        },
        trends: {
          callsGrowth: 15.2,
          costGrowth: 8.7,
          successRateGrowth: 5.1,
          durationGrowth: -2.3
        },
        dailyStats: [
          { date: '2024-01-15', calls: 156, cost: 78.0, success: 122, duration: 38400 },
          { date: '2024-01-16', calls: 189, cost: 94.5, success: 148, duration: 46305 },
          { date: '2024-01-17', calls: 167, cost: 83.5, success: 131, duration: 40915 },
          { date: '2024-01-18', calls: 203, cost: 101.5, success: 159, duration: 49735 },
          { date: '2024-01-19', calls: 178, cost: 89.0, success: 140, duration: 43610 },
          { date: '2024-01-20', calls: 198, cost: 99.0, success: 155, duration: 48510 },
          { date: '2024-01-21', calls: 156, cost: 78.0, success: 123, duration: 38220 }
        ],
        agentStats: [
          { id: 'agent-1', name: 'Sofia Seguros', calls: 345, success: 278, avgDuration: 267, cost: 172.5, rating: 4.8 },
          { id: 'agent-2', name: 'Juan AI', calls: 298, success: 231, avgDuration: 234, cost: 149.0, rating: 4.6 },
          { id: 'agent-3', name: 'María Cobranza', calls: 267, success: 198, avgDuration: 198, cost: 133.5, rating: 4.4 },
          { id: 'agent-4', name: 'Carlos Ventas', calls: 189, success: 156, avgDuration: 289, cost: 94.5, rating: 4.7 },
          { id: 'agent-5', name: 'Ana Soporte', calls: 148, success: 115, avgDuration: 201, cost: 74.0, rating: 4.5 }
        ],
        campaignStats: [
          { id: 'campaign-1', name: 'Renovación de Pólizas Q1', calls: 456, success: 367, cost: 228.0, roi: 245.8 },
          { id: 'campaign-2', name: 'Cobranza Cartera', calls: 389, success: 278, cost: 194.5, roi: 156.7 },
          { id: 'campaign-3', name: 'Seguimiento Siniestros', calls: 234, success: 189, cost: 117.0, roi: 189.3 },
          { id: 'campaign-4', name: 'Nuevos Clientes', calls: 168, success: 145, cost: 84.0, roi: 312.5 }
        ],
        sentimentAnalysis: {
          positive: 62.3,
          neutral: 28.4,
          negative: 9.3
        },
        timeDistribution: [
          { hour: 8, calls: 45, success: 36 },
          { hour: 9, calls: 78, success: 62 },
          { hour: 10, calls: 89, success: 71 },
          { hour: 11, calls: 92, success: 73 },
          { hour: 12, calls: 67, success: 52 },
          { hour: 13, calls: 56, success: 44 },
          { hour: 14, calls: 83, success: 66 },
          { hour: 15, calls: 94, success: 75 },
          { hour: 16, calls: 87, success: 69 },
          { hour: 17, calls: 76, success: 60 },
          { hour: 18, calls: 45, success: 35 }
        ],
        outcomeDistribution: {
          success: 68.2,
          follow_up: 15.8,
          not_interested: 8.9,
          callback: 4.7,
          voicemail: 2.4
        }
      };

      setStatistics(mockStats);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (growth: number) => {
    if (growth > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (growth < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <Activity className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (isLoading || !statistics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Estadísticas y Análisis</h2>
          <p className="text-gray-600">Métricas detalladas de rendimiento y consumo</p>
        </div>
        <div className="flex space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Últimas 24 horas</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={loadStatistics}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
          <Button
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Llamadas</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.overview.totalCalls.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {getTrendIcon(statistics.trends.callsGrowth)}
              <span className={`text-sm ml-1 ${getTrendColor(statistics.trends.callsGrowth)}`}>
                {statistics.trends.callsGrowth > 0 ? '+' : ''}{statistics.trends.callsGrowth.toFixed(1)}% vs período anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Costo Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.overview.totalCost)}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {getTrendIcon(statistics.trends.costGrowth)}
              <span className={`text-sm ml-1 ${getTrendColor(statistics.trends.costGrowth)}`}>
                {statistics.trends.costGrowth > 0 ? '+' : ''}{statistics.trends.costGrowth.toFixed(1)}% vs período anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-gray-900">{formatPercentage(statistics.overview.successRate)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Target className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {getTrendIcon(statistics.trends.successRateGrowth)}
              <span className={`text-sm ml-1 ${getTrendColor(statistics.trends.successRateGrowth)}`}>
                {statistics.trends.successRateGrowth > 0 ? '+' : ''}{statistics.trends.successRateGrowth.toFixed(1)}% vs período anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Duración Promedio</p>
                <p className="text-2xl font-bold text-gray-900">{formatDuration(statistics.overview.avgDuration)}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {getTrendIcon(statistics.trends.durationGrowth)}
              <span className={`text-sm ml-1 ${getTrendColor(statistics.trends.durationGrowth)}`}>
                {statistics.trends.durationGrowth > 0 ? '+' : ''}{statistics.trends.durationGrowth.toFixed(1)}% vs período anterior
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Rendimiento Diario</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statistics.dailyStats.map((day, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">{new Date(day.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <span>{day.calls} llamadas</span>
                    <span className="text-green-600">{day.success} éxitos</span>
                    <span className="text-gray-600">{formatCurrency(day.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sentiment Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Análisis de Sentimiento</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Positivo</span>
                </div>
                <span className="text-sm font-medium">{formatPercentage(statistics.sentimentAnalysis.positive)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${statistics.sentimentAnalysis.positive}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm">Neutral</span>
                </div>
                <span className="text-sm font-medium">{formatPercentage(statistics.sentimentAnalysis.neutral)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full" 
                  style={{ width: `${statistics.sentimentAnalysis.neutral}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm">Negativo</span>
                </div>
                <span className="text-sm font-medium">{formatPercentage(statistics.sentimentAnalysis.negative)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${statistics.sentimentAnalysis.negative}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Rendimiento por Agente</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Agente</th>
                  <th className="text-right p-3">Llamadas</th>
                  <th className="text-right p-3">Éxitos</th>
                  <th className="text-right p-3">Tasa Éxito</th>
                  <th className="text-right p-3">Duración Prom</th>
                  <th className="text-right p-3">Costo</th>
                  <th className="text-right p-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {statistics.agentStats.map((agent) => (
                  <tr key={agent.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-purple-100 rounded-full">
                          <Users className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="font-medium">{agent.name}</span>
                      </div>
                    </td>
                    <td className="text-right p-3">{agent.calls}</td>
                    <td className="text-right p-3 text-green-600">{agent.success}</td>
                    <td className="text-right p-3">{formatPercentage((agent.success / agent.calls) * 100)}</td>
                    <td className="text-right p-3">{formatDuration(agent.avgDuration)}</td>
                    <td className="text-right p-3">{formatCurrency(agent.cost)}</td>
                    <td className="text-right p-3">
                      <div className="flex items-center justify-end space-x-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span>{agent.rating}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Rendimiento por Campaña</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statistics.campaignStats.map((campaign) => (
              <div key={campaign.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{campaign.name}</h3>
                  <span className="text-sm text-green-600 font-medium">ROI: {campaign.roi.toFixed(1)}%</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Llamadas:</span>
                    <span className="font-medium">{campaign.calls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Éxitos:</span>
                    <span className="font-medium text-green-600">{campaign.success}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tasa de éxito:</span>
                    <span className="font-medium">{formatPercentage((campaign.success / campaign.calls) * 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Costo:</span>
                    <span className="font-medium">{formatCurrency(campaign.cost)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Distribución por Horario</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statistics.timeDistribution.map((timeSlot) => (
              <div key={timeSlot.hour} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium w-12">{timeSlot.hour}:00</span>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(timeSlot.calls / 100) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span>{timeSlot.calls} llamadas</span>
                  <span className="text-green-600">{timeSlot.success} éxitos</span>
                  <span className="text-gray-600">{formatPercentage((timeSlot.success / timeSlot.calls) * 100)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Outcome Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Distribución de Resultados</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(statistics.outcomeDistribution).map(([outcome, percentage]) => (
              <div key={outcome} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatPercentage(percentage)}
                </div>
                <div className="text-sm text-gray-600 capitalize">
                  {outcome.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatisticsDashboard; 