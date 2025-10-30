import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Badge } from 'src/components/shadcn-ui/Default-Ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/shadcn-ui/Default-Ui/select';
import { Textarea } from 'src/components/shadcn-ui/Default-Ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'src/components/shadcn-ui/Default-Ui/dialog';
import { 
  Calendar, 
  Clock, 
  Play, 
  Pause,
  Square,
  Plus,
  Edit,
  Trash2,
  Users,
  Target,
  TrendingUp,
  BarChart3,
  Settings,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Filter,
  Search,
  Eye,
  FileText,
  Send
} from 'lucide-react';
import voiceCampaignService, { VoiceCampaignTriggerInput } from 'src/services/voiceCampaignService';
import { getCustomAgents } from 'src/services/voiceAgentsService';

interface Campaign {
  id: string;
  name: string;
  description: string;
  agentId: string;
  agentName: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  phoneNumbers: string[];
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  settings: {
    maxRetries: number;
    retryDelay: number;
    callTimeout: number;
    simultaneousCalls: number;
    workingHours: {
      start: string;
      end: string;
      days: string[];
    };
  };
  statistics: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    successRate: number;
    avgDuration: number;
    totalCost: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface CampaignFormData {
  name: string;
  description: string;
  agentId: string;
  phoneNumbers: string;
  scheduledAt: string;
  priority: 'low' | 'medium' | 'high';
  maxRetries: number;
  simultaneousCalls: number;
}

const CampaignsManagement: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    agentId: '',
    phoneNumbers: '',
    scheduledAt: '',
    priority: 'medium',
    maxRetries: 3,
    simultaneousCalls: 5
  });

  // UI local para Disparadores
  const [triggersConfig, setTriggersConfig] = useState({
    types: {
      new_client: false,
      new_policy: false,
      policy_expiry: false,
      new_lead: false,
      new_siniestro: false,
    },
    window: { start: '08:00', end: '18:00', tz: 'America/Bogota', days: 'mon,tue,wed,thu,fri' },
    limits: { daily_quota: 100, dedup_days: 7 },
    expiry: { before_days: '7,3,1', after_days: '1' }, // solo aplica a policy_expiry
    mapping: { phone_field: 'celular_principal' }
  });

  // Agentes personalizados centralizados
  const [availableAgents, setAvailableAgents] = useState<{ id: string; name: string; type: string }[]>([]);

  // Cargar datos iniciales
  useEffect(() => {
    loadCampaigns();
    getCustomAgents().then((list) => setAvailableAgents(list));
  }, []);

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      // TODO: Integrar con API real de campañas cuando esté disponible
      // Por ahora, mostrar lista vacía para mostrar solo datos reales
      const realCampaigns: Campaign[] = [];
      
      
      // En el futuro, esto sería una llamada real a la API:
      // const campaigns = await getCampaignsList();
      
      setCampaigns(realCampaigns);
      
    } catch (error) {
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      const phoneNumbersArray = formData.phoneNumbers
        .split('\n')
        .map(num => num.trim())
        .filter(num => num.length > 0);

      if (!formData.name || !formData.agentId || phoneNumbersArray.length === 0) {
        alert('Completa nombre, agente y al menos un número de teléfono');
        return;
      }

      // Construir contacts para backend (usa "phone")
      const contacts = phoneNumbersArray.map((p, idx) => ({
        name: `Contacto ${idx + 1}`,
        phone: p
      }));

      // Construir triggers desde la UI
      const parseCsvNums = (s: string): number[] =>
        (s || '')
          .split(',')
          .map(x => x.trim())
          .filter(x => x !== '')
          .map(x => parseInt(x, 10))
          .filter(n => !Number.isNaN(n));

      const windowDays = (triggersConfig.window.days || '')
        .split(',')
        .map(d => d.trim().toLowerCase())
        .filter(Boolean);

      const baseTrigger: Omit<VoiceCampaignTriggerInput, 'type'> = {
        enabled: true,
        window_config: {
          start: triggersConfig.window.start,
          end: triggersConfig.window.end,
          tz: triggersConfig.window.tz,
          days: windowDays.length ? windowDays : ['mon','tue','wed','thu','fri']
        },
        limits: {
          daily_quota: Number(triggersConfig.limits.daily_quota) || 0,
          dedup_days: Number(triggersConfig.limits.dedup_days) || 0
        },
        mapping: {
          phone_field: triggersConfig.mapping.phone_field || 'celular_principal'
        }
      };

      const triggers: VoiceCampaignTriggerInput[] = [];
      (Object.keys(triggersConfig.types) as Array<keyof typeof triggersConfig.types>).forEach((key) => {
        if (triggersConfig.types[key]) {
          if (key === 'policy_expiry') {
            triggers.push({
              type: 'policy_expiry',
              ...baseTrigger,
              expiry_offsets: {
                before_days: parseCsvNums(triggersConfig.expiry.before_days),
                after_days: parseCsvNums(triggersConfig.expiry.after_days)
              }
            });
          } else {
            triggers.push({ type: key as any, ...baseTrigger });
          }
        }
      });

      const payload: any = {
        name: formData.name,
        description: formData.description,
        voice_message_template: `Hola {{customer_name}}, te llama tu asesora sobre ${formData.name}.`,
        contacts,
        agent_name: availableAgents.find(a => a.id === formData.agentId)?.name || undefined,
        elevenlabs_agent_id: formData.agentId,
        settings: {
          working_hours: {
            start: '09:00',
            end: '18:00',
            days: ['monday','tuesday','wednesday','thursday','friday']
          },
          post_call_tools: {
            collect: {},
            whatsapp: { enabled: true }
          }
        },
        // Enviar triggers si hay alguno habilitado
        ...(triggers.length > 0 ? { triggers } : {})
      };

      const result = await voiceCampaignService.createImmediateVoiceCampaign(payload);

      if (result.success) {
        // Refrescar UI local (opcional, hasta que el listado real esté integrado)
        setIsCreateModalOpen(false);
        resetForm();
        // Opcional: feedback visual
        alert('Campaña creada. Si configuraste disparadores, quedaron guardados en la campaña.');
      } else {
        alert(result.message || 'Error al crear campaña');
      }
    } catch (error: any) {
      alert(`Error al crear la campaña: ${error?.message || 'desconocido'}`);
    }
  };

  const handleStartCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.map(campaign => 
      campaign.id === campaignId 
        ? { ...campaign, status: 'running' as const, startedAt: new Date() }
        : campaign
    ));
  };

  const handlePauseCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.map(campaign => 
      campaign.id === campaignId 
        ? { ...campaign, status: 'paused' as const }
        : campaign
    ));
  };

  const handleStopCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.map(campaign => 
      campaign.id === campaignId 
        ? { ...campaign, status: 'cancelled' as const }
        : campaign
    ));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      agentId: '',
      phoneNumbers: '',
      scheduledAt: '',
      priority: 'medium',
      maxRetries: 3,
      simultaneousCalls: 5
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'border border-gray-400 text-gray-600 bg-transparent';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4" />;
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Stats agregados (alineados al diseño general)
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => ['running', 'scheduled', 'paused'].includes(c.status)).length;
  const totalCalls = campaigns.reduce((sum, c) => sum + (c.statistics?.totalCalls || 0), 0);
  const completedCalls = campaigns.reduce((sum, c) => sum + (c.statistics?.completedCalls || 0), 0);
  const totalCost = campaigns.reduce((sum, c) => sum + (c.statistics?.totalCost || 0), 0);
  const avgSuccess = campaigns.length > 0
    ? Math.round(
        campaigns.reduce((sum, c) => sum + (c.statistics?.successRate || 0), 0) / campaigns.length
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Campañas</h2>
          <p className="text-gray-600">Crea y gestiona campañas de llamadas telefónicas</p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={loadCampaigns}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Campaña</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar campañas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="scheduled">Programada</SelectItem>
            <SelectItem value="running">En ejecución</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats superiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Campañas activas</p>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
              </div>
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total llamadas</p>
                <p className="text-2xl font-bold">{totalCalls}</p>
              </div>
              <Phone className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Éxito promedio</p>
                <p className="text-2xl font-bold">{avgSuccess}%</p>
              </div>
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Costo total</p>
                <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
              </div>
              <Target className="w-6 h-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 && campaigns.length === 0 && !isLoading ? (
        <Card className="p-12">
          <div className="text-center">
            <Calendar className="w-20 h-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-600 mb-3">
              Sin campañas configuradas
            </h3>
            <p className="text-gray-500 mb-6 max-w-lg mx-auto">
              No hay campañas de llamadas en el sistema. Las campañas permiten automatizar llamadas masivas a múltiples contactos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Campaña
              </Button>
              <Button 
                variant="outline"
                onClick={() => loadCampaigns()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </div>
        </Card>
      ) : filteredCampaigns.length === 0 && campaigns.length > 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No se encontraron campañas que coincidan con los filtros</p>
          <Button onClick={() => {
            setSearchTerm('');
            setStatusFilter('all');
          }} variant="outline" className="mt-3">
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-600">
                    <th className="px-4 py-3">Campaña</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Prioridad</th>
                    <th className="px-4 py-3">Agente</th>
                    <th className="px-4 py-3">Contactos</th>
                    <th className="px-4 py-3">Programada</th>
                    <th className="px-4 py-3">Avance</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCampaigns.map((c) => {
                    const total = c.statistics.totalCalls || 0;
                    const done = c.statistics.completedCalls || 0;
                    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{c.name}</div>
                          <div className="text-gray-500 truncate max-w-xs">{c.description}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(c.status)}`}>
                            {getStatusIcon(c.status)}
                            {c.status === 'completed' ? 'FINALIZADA' : c.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getPriorityColor(c.priority)}`}>{c.priority.toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3">{c.agentName || '-'}</td>
                        <td className="px-4 py-3">{c.phoneNumbers.length}</td>
                        <td className="px-4 py-3">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : '-'}</td>
                        <td className="px-4 py-3 w-56">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                            <span className="text-gray-700 tabular-nums w-10 text-right">{percent}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {c.status !== 'completed' && (c.status === 'draft' || c.status === 'scheduled') ? (
                              <Button size="sm" onClick={() => handleStartCampaign(c.id)} className="flex items-center gap-1">
                                <Play className="w-4 h-4" /> Iniciar
                              </Button>
                            ) : c.status === 'running' ? (
                              <Button size="sm" variant="outline" onClick={() => handlePauseCampaign(c.id)} className="flex items-center gap-1">
                                <Pause className="w-4 h-4" /> Pausar
                              </Button>
                            ) : c.status === 'paused' ? (
                              <Button size="sm" onClick={() => handleStartCampaign(c.id)} className="flex items-center gap-1">
                                <Play className="w-4 h-4" /> Reanudar
                              </Button>
                            ) : null}
                            {(c.status === 'running' || c.status === 'paused') && c.status !== 'completed' && (
                              <Button size="sm" variant="destructive" onClick={() => handleStopCampaign(c.id)} className="flex items-center gap-1">
                                <Square className="w-4 h-4" /> Detener
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => { setSelectedCampaign(c); setIsEditModalOpen(true); }} className="flex items-center gap-1">
                              <Eye className="w-4 h-4" /> Ver
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Campaign Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nueva Campaña</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Campaña
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Renovación de Pólizas Q1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agente de Voz
                </label>
                <Select
                  value={formData.agentId}
                  onValueChange={(value) => setFormData({...formData, agentId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
                placeholder="Describe el propósito de esta campaña..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Números de Teléfono (uno por línea)
              </label>
              <Textarea
                value={formData.phoneNumbers}
                onChange={(e) => setFormData({...formData, phoneNumbers: e.target.value})}
                rows={6}
                placeholder={`+57 300 123 4567\n+57 300 123 4568\n+57 300 123 4569`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha y Hora
                </label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({...formData, scheduledAt: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridad
                </label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({...formData, priority: value as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Llamadas Simultáneas
                </label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.simultaneousCalls}
                  onChange={(e) => setFormData({...formData, simultaneousCalls: parseInt(e.target.value)})}
                />
              </div>
            </div>

            {/* Disparadores (Triggers) */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-3">Disparadores (Opcional)</h3>

              {/* Tipos */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {[
                  { key: 'new_client', label: 'Nuevo Cliente' },
                  { key: 'new_policy', label: 'Nueva Póliza' },
                  { key: 'policy_expiry', label: 'Vencimiento de Póliza' },
                  { key: 'new_lead', label: 'Nuevo Lead' },
                  { key: 'new_siniestro', label: 'Nuevo Siniestro' },
                ].map(t => (
                  <label key={t.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(triggersConfig.types as any)[t.key]}
                      onChange={(e) =>
                        setTriggersConfig(prev => ({
                          ...prev,
                          types: { ...prev.types, [t.key]: e.target.checked }
                        }))
                      }
                    />
                    {t.label}
                  </label>
                ))}
              </div>

              {/* Ventana / Límites */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Inicio (HH:mm)</label>
                  <Input
                    value={triggersConfig.window.start}
                    onChange={(e) => setTriggersConfig(prev => ({ ...prev, window: { ...prev.window, start: e.target.value } }))}
                    placeholder="08:00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Fin (HH:mm)</label>
                  <Input
                    value={triggersConfig.window.end}
                    onChange={(e) => setTriggersConfig(prev => ({ ...prev, window: { ...prev.window, end: e.target.value } }))}
                    placeholder="18:00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Zona Horaria</label>
                  <Input
                    value={triggersConfig.window.tz}
                    onChange={(e) => setTriggersConfig(prev => ({ ...prev, window: { ...prev.window, tz: e.target.value } }))}
                    placeholder="America/Bogota"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Días activos (CSV mon,tue,...)</label>
                  <Input
                    value={triggersConfig.window.days}
                    onChange={(e) => setTriggersConfig(prev => ({ ...prev, window: { ...prev.window, days: e.target.value } }))}
                    placeholder="mon,tue,wed,thu,fri"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Cupo diario</label>
                  <Input
                    type="number"
                    value={Number(triggersConfig.limits.daily_quota)}
                    onChange={(e) => setTriggersConfig(prev => ({ ...prev, limits: { ...prev.limits, daily_quota: Number(e.target.value) } }))}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Deduplicación (días)</label>
                  <Input
                    type="number"
                    value={Number(triggersConfig.limits.dedup_days)}
                    onChange={(e) => setTriggersConfig(prev => ({ ...prev, limits: { ...prev.limits, dedup_days: Number(e.target.value) } }))}
                    placeholder="7"
                  />
                </div>
              </div>

              {/* Solo policy_expiry */}
              {triggersConfig.types.policy_expiry && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Antes de vencer (días CSV)</label>
                    <Input
                      value={triggersConfig.expiry.before_days}
                      onChange={(e) => setTriggersConfig(prev => ({ ...prev, expiry: { ...prev.expiry, before_days: e.target.value } }))}
                      placeholder="7,3,1,0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Después de vencer (días CSV)</label>
                    <Input
                      value={triggersConfig.expiry.after_days}
                      onChange={(e) => setTriggersConfig(prev => ({ ...prev, expiry: { ...prev.expiry, after_days: e.target.value } }))}
                      placeholder="1"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Campo de teléfono principal</label>
                  <Input
                    value={triggersConfig.mapping.phone_field}
                    onChange={(e) => setTriggersConfig(prev => ({ ...prev, mapping: { ...prev.mapping, phone_field: e.target.value } }))}
                    placeholder="celular_principal"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCampaign}
                disabled={!formData.name || !formData.agentId || !formData.phoneNumbers}
                className="flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Crear Campaña</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de Campaña: {selectedCampaign?.name}</DialogTitle>
          </DialogHeader>
          
          {selectedCampaign && (
            <div className="space-y-6">
              {/* Campaign Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Llamadas</p>
                        <p className="text-2xl font-bold">{selectedCampaign.statistics.totalCalls}</p>
                      </div>
                      <Phone className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Tasa de Éxito</p>
                        <p className="text-2xl font-bold text-green-600">{selectedCampaign.statistics.successRate}%</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Costo Total</p>
                        <p className="text-2xl font-bold">${selectedCampaign.statistics.totalCost.toFixed(2)}</p>
                      </div>
                      <Target className="w-8 h-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Duración Prom</p>
                        <p className="text-2xl font-bold">{formatDuration(selectedCampaign.statistics.avgDuration)}</p>
                      </div>
                      <Clock className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Phone Numbers List */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Números de Teléfono ({selectedCampaign.phoneNumbers.length})</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {selectedCampaign.phoneNumbers.map((phone, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span>{phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Configuración</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm"><strong>Máximo reintentos:</strong> {selectedCampaign.settings.maxRetries}</p>
                    <p className="text-sm"><strong>Timeout de llamada:</strong> {selectedCampaign.settings.callTimeout}s</p>
                    <p className="text-sm"><strong>Llamadas simultáneas:</strong> {selectedCampaign.settings.simultaneousCalls}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm"><strong>Horario:</strong> {selectedCampaign.settings.workingHours.start} - {selectedCampaign.settings.workingHours.end}</p>
                    <p className="text-sm"><strong>Días:</strong> {selectedCampaign.settings.workingHours.days.join(', ')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignsManagement; 