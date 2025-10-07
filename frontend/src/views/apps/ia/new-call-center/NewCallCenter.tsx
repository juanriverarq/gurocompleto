
import React, { useState, useEffect } from 'react';
import { Button } from 'flowbite-react';
import Chart from 'react-apexcharts';
import {
  IconPhone,
  IconPhoneCall,
  IconActivity,
  IconClock,
  IconCircleCheck,
  IconX,
  IconPlayerPlay,
  IconPlayerPause,
  IconRobot,
  IconUser,
  IconTrendingUp,
  IconFilter,
  IconSearch,
  IconPlus,
  IconEdit,
  IconEye,
  IconTarget,
  IconGauge,
  IconSettings,
  IconBrain,
  IconChartBar,
  IconChartPie,
  IconClockHour4
} from '@tabler/icons-react';
import { Badge } from 'src/components/shadcn-ui/Default-Ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/shadcn-ui/Default-Ui/tabs';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Card, CardHeader, CardTitle, CardContent } from 'src/components/shadcn-ui/Default-Ui/card';

interface CallRecord {
  id: string;
  contactName: string;
  phoneNumber: string;
  agentType: 'sofia_insurance' | 'juan_ai' | 'generic';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  duration: number;
  timestamp: Date;
  outcome: 'success' | 'no_answer' | 'busy' | 'failed';
  notes?: string;
}

interface Agent {
  id: string;
  name: string;
  type: 'sofia_insurance' | 'juan_ai' | 'generic';
  description: string;
  voice: string;
  isActive: boolean;
  callsHandled: number;
  successRate: number;
  avgDuration: number;
}

interface CallStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  successRate: number;
  avgDuration: number;
  callsPerHour: number;
}

const NewCallCenter: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<CallStats>({
    totalCalls: 1526,
    activeCalls: 12,
    completedCalls: 1254,
    successRate: 86.5,
    avgDuration: 245,
    callsPerHour: 48
  });
  const [isSystemActive, setIsSystemActive] = useState(true);
  const [newCallForm, setNewCallForm] = useState({
    contactName: '',
    phoneNumber: '',
    agentType: 'generic' as const,
    scheduledTime: '',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    initializeMockData();
  }, []);

  const initializeMockData = () => {
    const mockAgents: Agent[] = [
      { id: '1', name: 'Sofía - Agente de Seguros', type: 'sofia_insurance', description: 'Especialista en seguros y cobranzas', voice: 'Marcela Colombia Girl', isActive: true, callsHandled: 45, successRate: 78.5, avgDuration: 180 },
      { id: '2', name: 'Juan - Informador IA', type: 'juan_ai', description: 'Mensaje específico sobre proyecto de IA', voice: 'Marcela Colombia Girl', isActive: true, callsHandled: 23, successRate: 95.2, avgDuration: 90 },
      { id: '3', name: 'Agente Genérico', type: 'generic', description: 'Asistente de propósito general', voice: 'Rachel', isActive: true, callsHandled: 67, successRate: 82.1, avgDuration: 150 }
    ];
    const mockCallRecords: CallRecord[] = [
      { id: '1', contactName: 'Juan Rivera', phoneNumber: '+573001234567', agentType: 'sofia_insurance', status: 'completed', duration: 165, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), outcome: 'success', notes: 'Cliente interesado' },
      { id: '2', contactName: 'María González', phoneNumber: '+573009876543', agentType: 'generic', status: 'in_progress', duration: 45, timestamp: new Date(Date.now() - 30 * 60 * 1000), outcome: 'success' },
      { id: '3', contactName: 'Carlos Mendez', phoneNumber: '+573005551234', agentType: 'juan_ai', status: 'pending', duration: 0, timestamp: new Date(Date.now() + 15 * 60 * 1000), outcome: 'success' }
    ];
    setAgents(mockAgents);
    setCallRecords(mockCallRecords);
  };

  const handleMakeCall = async () => {
    // Logic to make a call
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'success': return <IconCircleCheck className="w-4 h-4 text-green-600" />;
      case 'no_answer': return <IconPhoneCall className="w-4 h-4 text-yellow-600" />;
      case 'busy': return <IconPhone className="w-4 h-4 text-orange-600" />;
      case 'failed': return <IconX className="w-4 h-4 text-red-600" />;
      default: return <IconClock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'sofia_insurance': return <IconRobot className="w-5 h-5 text-purple-600" />;
      case 'juan_ai': return <IconBrain className="w-5 h-5 text-blue-600" />;
      case 'generic': return <IconUser className="w-5 h-5 text-gray-600" />;
      default: return <IconRobot className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredCallRecords = callRecords.filter(call => {
    const matchesSearch = call.contactName.toLowerCase().includes(searchTerm.toLowerCase()) || call.phoneNumber.includes(searchTerm);
    const matchesFilter = filterStatus === 'all' || call.status === filterStatus;
    return matchesSearch && matchesFilter;
  });
  
  const optionsdonutchart: any = {
    chart: {
      id: 'donut-chart',
      fontFamily: 'inherit',
      foreColor: '#adb0bb',
      toolbar: { show: false },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          background: 'transparent',
        },
      },
    },
    labels: ['Exitosas', 'No contestan', 'Ocupado', 'Fallidas'],
    colors: ['#22c55e', '#f59e0b', '#f97316', '#ef4444'],
    tooltip: {
      theme: 'dark',
      fillSeriesColor: false,
    },
  };
  const seriesdonutchart: any = [75, 15, 7, 3];


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Call Center IA (Nueva)</h1>
          <p className="text-gray-600">Sistema de llamadas automatizadas con agentes inteligentes</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={() => setIsSystemActive(!isSystemActive)} className="flex items-center space-x-2">
            {isSystemActive ? <IconPlayerPause className="w-4 h-4" /> : <IconPlayerPlay className="w-4 h-4" />}
            <span>{isSystemActive ? 'Pausar Sistema' : 'Activar Sistema'}</span>
          </Button>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isSystemActive ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">{isSystemActive ? 'Sistema Activo' : 'Sistema Inactivo'}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Llamadas</p><p className="text-2xl font-bold text-gray-900">{stats.totalCalls}</p></div><IconPhone className="w-8 h-8 text-blue-600" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Llamadas Activas</p><p className="text-2xl font-bold text-green-600">{stats.activeCalls}</p></div><IconActivity className="w-8 h-8 text-green-600" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Completadas</p><p className="text-2xl font-bold text-purple-600">{stats.completedCalls}</p></div><IconCircleCheck className="w-8 h-8 text-purple-600" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Tasa de Éxito</p><p className="text-2xl font-bold text-orange-600">{stats.successRate.toFixed(1)}%</p></div><IconTarget className="w-8 h-8 text-orange-600" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Duración Promedio</p><p className="text-2xl font-bold text-cyan-600">{formatDuration(stats.avgDuration)}</p></div><IconClockHour4 className="w-8 h-8 text-cyan-600" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Llamadas/Hora</p><p className="text-2xl font-bold text-pink-600">{stats.callsPerHour}</p></div><IconGauge className="w-8 h-8 text-pink-600" /></div></CardContent></Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="new-call">Nueva Llamada</TabsTrigger>
          <TabsTrigger value="call-history">Historial</TabsTrigger>
          <TabsTrigger value="agents">Agentes</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
           <Card>
              <CardHeader><CardTitle className="flex items-center space-x-2"><IconTrendingUp className="w-5 h-5" /><span>Banner de Bienvenida</span></CardTitle></CardHeader>
              <CardContent>
                <div className="p-4 bg-blue-100 rounded-lg">
                  <h2 className="text-xl font-bold">Bienvenido al nuevo Call Center IA!</h2>
                  <p>Explora las nuevas funcionalidades y mejora la gestión de tus llamadas.</p>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="flex items-center space-x-2"><IconPhoneCall className="w-5 h-5" /><span>Llamadas Activas</span></CardTitle></CardHeader>
                    <CardContent>
                        {/* Active calls list */}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center space-x-2"><IconClock className="w-5 h-5" /><span>Llamadas Pendientes</span></CardTitle></CardHeader>
                    <CardContent>
                        {/* Pending calls list */}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="new-call" className="space-y-6">
            <Card>
                <CardHeader><CardTitle className="flex items-center space-x-2"><IconPlus className="w-5 h-5" /><span>Programar Nueva Llamada</span></CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {/* New call form */}
                </CardContent>
            </Card>
        </TabsContent>
        
        <TabsContent value="call-history" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center space-x-2"><IconClock className="w-5 h-5" /><span>Historial de Llamadas</span></CardTitle></CardHeader>
            <CardContent>
              {/* Call history list */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center space-x-2"><IconRobot className="w-5 h-5" /><span>Gestión de Agentes IA</span></CardTitle></CardHeader>
            <CardContent>
              {/* Agent list */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center space-x-2"><IconChartBar className="w-5 h-5" /><span>Rendimiento por Agente</span></CardTitle></CardHeader>
              <CardContent>
                <Chart options={optionsdonutchart} series={[1,2,3]} type="bar" height="300" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center space-x-2"><IconChartPie className="w-5 h-5" /><span>Distribución de Resultados</span></CardTitle></CardHeader>
              <CardContent>
                 <Chart options={optionsdonutchart} series={seriesdonutchart} type="donut" height="300" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NewCallCenter;

