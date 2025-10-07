import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Badge } from 'src/components/shadcn-ui/Default-Ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/shadcn-ui/Default-Ui/tabs';
import { 
  Bot, 
  Phone, 
  BarChart3, 
  History, 
  Settings, 
  Users, 
  TrendingUp,
  Activity,
  DollarSign,
  Calendar,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  Download,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  PhoneCall,
  Mic,
  Volume2,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';

// Importar componentes que crearemos
import AgentsManagement from './components/AgentsManagement';
import CampaignsManagement from './components/CampaignsManagement';
import CallHistory from './components/CallHistory';
import StatisticsDashboard from './components/StatisticsDashboard';
import VoiceSettings from './components/VoiceSettings';
import CallInstructions from './components/CallInstructions';

// Importar servicios
import { 
  getConversationalAgents, 
  getPhoneCallsList, 
  getVoiceList,
  createPhoneCall,
  getPhoneCallTranscript 
} from '../../services/elevenLabsService';

interface DashboardStats {
  totalCalls: number;
  activeCampaigns: number;
  successRate: number;
  totalCost: number;
  avgDuration: string;
  activeAgents: number;
  monthlyUsage: number;
  conversionRate: number;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  color: string;
}

const ElevenLabsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalCalls: 0,
    activeCampaigns: 0,
    successRate: 0,
    totalCost: 0,
    avgDuration: '0:00',
    activeAgents: 0,
    monthlyUsage: 0,
    conversionRate: 0
  });
  
  const [recentCalls, setRecentCalls] = useState([]);
  const [agents, setAgents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  // Cargar datos iniciales
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Cargar datos en paralelo
      const [agentsData, callsData] = await Promise.all([
        getConversationalAgents().catch(() => []),
        getPhoneCallsList({ limit: 10 }).catch(() => [])
      ]);

      setAgents(agentsData || []);
      setRecentCalls(callsData || []);

      // Calcular estadísticas
      const stats = calculateDashboardStats(agentsData, callsData);
      setDashboardStats(stats);

    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDashboardStats = (agentsData: any[], callsData: any[]): DashboardStats => {
    const totalCalls = callsData.length;
    const successfulCalls = callsData.filter(call => call.status === 'completed').length;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
    
    // Calcular costos (ejemplo: $0.05 por minuto)
    const totalMinutes = callsData.reduce((acc, call) => acc + (call.duration || 0), 0);
    const totalCost = totalMinutes * 0.05;
    
    const avgDuration = totalCalls > 0 ? 
      Math.floor(totalMinutes / totalCalls) : 0;
    
    return {
      totalCalls,
      activeCampaigns: 3, // Ejemplo
      successRate: Math.round(successRate),
      totalCost,
      avgDuration: `${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')}`,
      activeAgents: agentsData.length,
      monthlyUsage: totalMinutes,
      conversionRate: 68 // Ejemplo
    };
  };

  const quickActions: QuickAction[] = [
    {
      id: 'new-campaign',
      title: 'Nueva Campaña',
      description: 'Crear campaña de llamadas',
      icon: <Plus className="w-5 h-5" />,
      action: () => setActiveTab('campaigns'),
      color: 'bg-blue-500'
    },
    {
      id: 'test-call',
      title: 'Llamada de Prueba',
      description: 'Probar agente de voz',
      icon: <PhoneCall className="w-5 h-5" />,
      action: () => handleTestCall(),
      color: 'bg-green-500'
    },
    {
      id: 'view-analytics',
      title: 'Ver Analíticas',
      description: 'Estadísticas detalladas',
      icon: <BarChart3 className="w-5 h-5" />,
      action: () => setActiveTab('statistics'),
      color: 'bg-purple-500'
    },
    {
      id: 'manage-agents',
      title: 'Gestionar Agentes',
      description: 'Configurar agentes de voz',
      icon: <Bot className="w-5 h-5" />,
      action: () => setActiveTab('agents'),
      color: 'bg-orange-500'
    }
  ];

  const handleTestCall = async () => {
    // Implementar llamada de prueba
  };

  const refreshData = () => {
    loadDashboardData();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ElevenLabs Dashboard</h1>
          <p className="text-gray-600 mt-1">Gestión completa de agentes de voz y campañas telefónicas</p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={refreshData}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
          <Button className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Llamadas</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalCalls}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+12% vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardStats.successRate}%</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+5% vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Costo Total</p>
                <p className="text-2xl font-bold text-gray-900">${dashboardStats.totalCost.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-gray-600">Duración promedio: {dashboardStats.avgDuration}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Agentes Activos</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardStats.activeAgents}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Bot className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <Activity className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-sm text-blue-600">Todos operativos</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PlayCircle className="w-5 h-5" />
            <span>Acciones Rápidas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <div
                key={action.id}
                onClick={action.action}
                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${action.color} text-white`}>
                    {action.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{action.title}</h3>
                    <p className="text-sm text-gray-600">{action.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center space-x-2">
            <Bot className="w-4 h-4" />
            <span>Agentes</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>Campañas</span>
          </TabsTrigger>
          <TabsTrigger value="calls" className="flex items-center space-x-2">
            <History className="w-4 h-4" />
            <span>Historial</span>
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Estadísticas</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Configuración</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Llamadas Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentCalls.slice(0, 5).map((call: any, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-full">
                          <Phone className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">+57 300 123 4567</p>
                          <p className="text-sm text-gray-600">Hace 2 horas</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-600">
                        Completada
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agentes Más Activos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agents.slice(0, 5).map((agent: any, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 rounded-full">
                          <Bot className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{agent.name || `Agente ${index + 1}`}</p>
                          <p className="text-sm text-gray-600">125 llamadas hoy</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-600">
                        Activo
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <AgentsManagement />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsManagement />
        </TabsContent>

        <TabsContent value="calls">
          <CallHistory />
        </TabsContent>

        <TabsContent value="statistics">
          <StatisticsDashboard />
        </TabsContent>

        <TabsContent value="settings">
          <VoiceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ElevenLabsDashboard; 