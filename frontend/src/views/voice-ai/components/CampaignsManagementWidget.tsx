import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../../components/shadcn-ui/Default-Ui/input';
import { TextInput, Dropdown, Spinner, Tabs } from 'flowbite-react';
import { Badge } from '../../../components/shadcn-ui/Default-Ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/shadcn-ui/Default-Ui/select';
import { Textarea } from '../../../components/shadcn-ui/Default-Ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/shadcn-ui/Default-Ui/dialog';
import { Label } from '../../../components/shadcn-ui/Default-Ui/label';
import { Icon } from '@iconify/react';
import { IconDots } from '@tabler/icons-react';
import CampaignWizard from '../../../components/campaign/CampaignWizard';
import DynamicFieldsConfig from '../../../components/voice-ai/DynamicFieldsConfig';
import DecisionPoliciesConfig from '../../../components/voice-ai/DecisionPoliciesConfig';
import CollectedDataDisplay from '../../../components/voice-ai/CollectedDataDisplay';
import {
  getConversationalAgents
} from '../../../services/elevenLabsService';
import { getConversationAudio } from '../../../services/elevenLabsService';
import { Cliente, clienteService } from '../../../services/clienteService';
import voiceCampaignService, {
  VoiceCampaign,
  VoiceCampaignStats,
  CreateVoiceCampaignRequest
} from '../../../services/voiceCampaignService';
import whatsappInstanceService from '../../../services/whatsappInstanceService';

// Interfaces para configuración dinámica
interface CustomField {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  required: boolean;
  instruction?: string;
  pattern?: string;
  validation?: {
    min_digits?: number;
    max_digits?: number;
    min_age?: number;
    max_age?: number;
  };
}

interface CollectConfig {
  email?: { enabled: boolean; type: string; required: boolean };
  document_id?: { enabled: boolean; type: string; required: boolean };
  address?: { enabled: boolean; type: string; required: boolean };
}

interface DecisionCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

interface DecisionAction {
  action: string;
  parameters: Record<string, any>;
}

interface DecisionPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: DecisionCondition[];
  actions: DecisionAction[];
}

interface ElevenLabsAgent {
  id: string;
  name: string;
  type: string;
  description: string;
  voiceId: string;
  voiceName: string;
  language: string;
  systemPrompt: string;
  greeting: string;
  isActive: boolean;
}

const CampaignsManagementWidget: React.FC = () => {
// Estados principales
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [agents, setAgents] = useState<ElevenLabsAgent[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<VoiceCampaignStats | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<VoiceCampaign | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  // Mapa con costo total por campaña (calculado desde conversaciones reales cuando no viene en estadísticas)
  const [campaignCostTotals, setCampaignCostTotals] = useState<Record<number, number>>({});
  const [loadingCampaignCosts, setLoadingCampaignCosts] = useState<Record<number, boolean>>({});
  
  // Estados de modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  
  // Estados para edición y eliminación
  const [campaignToEdit, setCampaignToEdit] = useState<VoiceCampaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<VoiceCampaign | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agentId: '',
    type: 'immediate' as const,
    priority: 'medium' as const,
    selectedTargets: [] as string[],
    scheduledAt: '',
    maxRetries: 3,
    simultaneousCalls: 5,
    callTimeout: 300,
    customPrompt: '',
    useCustomGreeting: false,
    customGreeting: '',
    postCallTools: {
      collect: {
        email: { enabled: false, type: 'email', required: false },
        document_id: { enabled: false, type: 'document_id', required: false },
        address: { enabled: false, type: 'address', required: false },
      },
      customFields: [],
      whatsapp: {
        enabled: false,
        instance_id: '',
        template: 'Hola {customer_name}, te compartimos tu enlace de pago: {payment_link}',
      },
      decisionPolicies: []
    }
  });
  const [waInstances, setWaInstances] = useState<Array<{ id?: number; instance_id: string; status?: string }>>([]);

  // Función para manejar la creación desde el wizard
  const handleWizardCampaignCreate = async (campaignData: any) => {
    console.log('🎯 [WIZARD] Creando campaña desde wizard:', campaignData);
    console.log('🔍 [WIZARD] Campaign type detected:', campaignData?.type);

    // Si el propio Wizard ya hizo el POST exitosamente, evitamos doble envío
    if (campaignData?.created_by_wizard) {
      console.log('✅ [WIZARD] Campaign already created by wizard, skipping duplicate POST');
      alert('Campaña creada exitosamente');
      setShowWizard(false);
      await loadCampaigns();
      await loadStats();
      return;
    }
    
    try {
      let response;

      // Normalizar bandera de inmediatez
      const isImmediate = campaignData?.type === 'immediate' || (!campaignData?.scheduled_date && !campaignData?.scheduledDate);

      // Siempre usar campaña inmediata desde el CampaignWizard (por diseño actual)
      if (isImmediate) {
        console.log('🚀 [WIZARD] Creating immediate campaign...');
        response = await voiceCampaignService.createImmediateVoiceCampaign(campaignData);
      } else {
        console.log('📅 [WIZARD] Creating scheduled campaign...');
        response = await voiceCampaignService.createScheduledVoiceCampaign(campaignData);
      }

      if (response.success) {
        console.log('✅ [WIZARD] Campaign created successfully');
        alert(response.message);
        setShowWizard(false);
        // Recargar la lista de campañas
        await loadCampaigns();
        await loadStats();
      } else {
        console.error('❌ [WIZARD] Failed to create campaign:', response.message);
        alert(response.message);
      }
    } catch (error) {
      console.error('❌ [WIZARD] Error creating campaign from wizard:', error);
      alert('Error al crear la campaña desde el wizard: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadAgents(),
        loadClients(),
        loadCampaigns(),
        loadStats(),
        loadWhatsAppInstances()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWhatsAppInstances = async () => {
    try {
      const resp = await whatsappInstanceService.getInstances();
      if (resp.success && Array.isArray(resp.data)) {
        setWaInstances(resp.data.map((i: any) => ({ id: i.id, instance_id: i.instance_id, status: i.status })));
      } else {
        setWaInstances([]);
      }
    } catch (e) {
      setWaInstances([]);
    }
  };

  const loadAgents = async () => {
    try {
      const agentsData = await getConversationalAgents();
      if (Array.isArray(agentsData)) {
        setAgents(agentsData);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      setAgents([]);
    }
  };

  const loadClients = async () => {
    try {
      const response = await clienteService.getAllClientes();
      if (response.success && response.data) {
        const activeClients = response.data.filter(client => 
          client.celular_principal && 
          (client.estado === 'activo' || client.estado === 'prospecto')
        );
        setClients(activeClients);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
    }
  };

  const loadCampaigns = async () => {
    try {
      console.log('🔄 [CAMPAIGNS] Loading voice campaigns...');
      const response = await voiceCampaignService.getVoiceCampaigns();
      
      if (response.success) {
        console.log('✅ [CAMPAIGNS] Voice campaigns loaded:', response.campaigns);
        setCampaigns(response.campaigns);
      } else {
        console.error('❌ [CAMPAIGNS] Failed to load campaigns');
        setCampaigns([]);
      }
    } catch (error) {
      console.error('❌ [CAMPAIGNS] Error loading campaigns:', error);
      setCampaigns([]);
    }
  };

  // Cargar costos por campaña desde el historial híbrido cuando no venga en estadísticas
  useEffect(() => {
    const loadCostsForCampaigns = async () => {
      const idsToLoad = campaigns
        .filter(c => typeof (c as any).statistics?.total_cost !== 'number' && campaignCostTotals[c.id] === undefined)
        .map(c => c.id);

      if (idsToLoad.length === 0) return;

      // Procesar en serie para evitar saturar
      for (const id of idsToLoad) {
        try {
          setLoadingCampaignCosts(prev => ({ ...prev, [id]: true }));
          const result = await voiceCampaignService.getHybridCallHistory({ campaign_id: id, limit: 1000 });
          if (result.success && Array.isArray(result.calls)) {
            const total = result.calls.reduce((sum: number, call: any) => {
              const costs = call?.costs;
              if (costs && (typeof costs.total_with_markup_cop === 'number' || typeof costs.total_cop === 'number')) {
                return sum + (Number(costs.total_with_markup_cop ?? costs.total_cop) || 0);
              }
              return sum;
            }, 0);
            setCampaignCostTotals(prev => ({ ...prev, [id]: total }));
          } else {
            setCampaignCostTotals(prev => ({ ...prev, [id]: 0 }));
          }
        } catch {
          setCampaignCostTotals(prev => ({ ...prev, [id]: 0 }));
        } finally {
          setLoadingCampaignCosts(prev => ({ ...prev, [id]: false }));
        }
      }
    };

    if (campaigns.length > 0) {
      loadCostsForCampaigns();
    }
  }, [campaigns]);

  const loadStats = async () => {
    try {
      console.log('📊 [CAMPAIGNS] Loading voice campaign stats...');
      const response = await voiceCampaignService.getVoiceCampaignStats();
      
      if (response.success && response.stats) {
        console.log('✅ [CAMPAIGNS] Stats loaded:', response.stats);
        setStats(response.stats);
      } else {
        console.error('❌ [CAMPAIGNS] Failed to load stats');
        setStats(null);
      }
    } catch (error) {
      console.error('❌ [CAMPAIGNS] Error loading stats:', error);
      setStats(null);
    }
  };

  const runWithLoading = async (id: number, type: string, fn: () => Promise<void>) => {
    setActionLoading(prev => ({ ...prev, [id]: type }));
    try {
      await fn();
    } finally {
      setActionLoading(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const handleCreateCampaign = async () => {
    try {
      const selectedAgent = agents.find(agent => agent.id === formData.agentId);
      if (!selectedAgent) {
        throw new Error('Agent not found');
      }

      const selectedClients = clients.filter(client => formData.selectedTargets.includes(client.id!));
      
      if (selectedClients.length === 0) {
        // Silenciar alert: simplemente no crear si no hay clientes
        return;
      }

      const contacts = selectedClients.map(client => ({
        name: `${client.nombre} ${client.apellidos}`,
        phone_number: client.celular_principal,
        custom_data: {
          client_id: client.id,
          email: client.email_principal,
          city: client.ciudad,
          occupation: 'No especificado',
          first_name: client.nombre,
          last_name: client.apellidos,
          full_name: `${client.nombre} ${client.apellidos}`,
          phone_number: client.celular_principal,
          alternative_phone: '',
          address: 'No especificado',
          neighborhood: 'No especificado',
          company_name: 'Tu Empresa de Seguros',
          registration_date: client.created_at,
          policy_number: `POL-${client.id}-2024`,
          policy_expiration_date: '2024-12-31',
          monthly_payment: 85000,
          coverage_amount: 50000000,
          debt_amount: 255000,
          payment_due_date: '2024-08-15',
          client_status: client.estado,
          preferred_time_to_call: 'mañana',
          communication_language: 'español',
          lead_source: 'unknown',
          last_contact_date: client.updated_at
        }
      }));

      const campaignRequest: CreateVoiceCampaignRequest = {
        name: formData.name,
        description: formData.description,
        agent_id: formData.agentId,
        type: formData.type,
        priority: formData.priority,
        scheduled_at: formData.scheduledAt || undefined,
        contacts: contacts,
        settings: {
          max_retries: formData.maxRetries,
          retry_delay: 300,
          call_timeout: formData.callTimeout,
          simultaneous_calls: formData.simultaneousCalls,
          working_hours: {
            start: '09:00',
            end: '18:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          },
          post_call_tools: {
            collect: {
              // Convertir el formato nuevo al formato esperado por el backend
              ...Object.fromEntries(
                Object.entries(formData.postCallTools.collect).map(([key, config]) => [
                  key,
                  typeof config === 'object' ? config : { enabled: config, type: key, required: false }
                ])
              ),
              // Agregar campos personalizados
              ...Object.fromEntries(
                (formData.postCallTools.customFields as CustomField[])
                  .filter(field => field.enabled && field.name)
                  .map(field => [
                    field.name.toLowerCase().replace(/\s+/g, '_'),
                    {
                      enabled: field.enabled,
                      type: field.type,
                      required: field.required,
                      instruction: field.instruction,
                      pattern: field.pattern
                    }
                  ])
              )
            },
            whatsapp: formData.postCallTools.whatsapp,
            decision_policies: formData.postCallTools.decisionPolicies
          }
        }
      };

      console.log('🚀 [CREATE CAMPAIGN] Creating voice campaign:', campaignRequest);

      const response = formData.type === 'immediate'
        ? await voiceCampaignService.createImmediateVoiceCampaign(campaignRequest)
        : await voiceCampaignService.createScheduledVoiceCampaign(campaignRequest);

      if (response.success) {
        console.log('✅ [CREATE CAMPAIGN] Campaign created successfully');
        setIsCreateModalOpen(false);
        resetForm();
        // Recargar la lista de campañas
        await loadCampaigns();
        await loadStats();
      } else {
        console.error('❌ [CREATE CAMPAIGN] Failed to create campaign:', response.message);
      }
      
    } catch (error) {
      console.error('❌ [CREATE CAMPAIGN] Error creating campaign:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      agentId: '',
      type: 'immediate',
      priority: 'medium',
      selectedTargets: [],
      scheduledAt: '',
      maxRetries: 3,
      simultaneousCalls: 5,
      callTimeout: 300,
      customPrompt: '',
      useCustomGreeting: false,
      customGreeting: '',
      postCallTools: {
        collect: {
          email: { enabled: false, type: 'email', required: false },
          document_id: { enabled: false, type: 'document_id', required: false },
          address: { enabled: false, type: 'address', required: false }
        },
        customFields: [],
        whatsapp: { enabled: false, instance_id: '', template: 'Hola {customer_name}, te compartimos tu enlace de pago: {payment_link}' },
        decisionPolicies: []
      }
    });
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (campaign.agent_name && campaign.agent_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || campaign.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // (handleEditCampaign ya no se usa; se mantiene lógica de edición en inline handlers)

  // Función para actualizar una campaña
  const handleUpdateCampaign = async (updatedData: Partial<any>) => {
    if (!campaignToEdit) return;

    try {
      console.log('🔊 [UPDATE CAMPAIGN] Updating campaign:', campaignToEdit.id, updatedData);

      const response = await voiceCampaignService.updateVoiceCampaign(campaignToEdit.id, updatedData);

      if (response.success) {
        console.log('✅ [UPDATE CAMPAIGN] Campaign updated successfully');
        setIsEditModalOpen(false);
        setCampaignToEdit(null);
        
        // Recargar la lista de campañas
        await loadCampaigns();
        await loadStats();
      } else {
        console.error('❌ [UPDATE CAMPAIGN] Failed to update campaign:', response.message);
        alert(response.message || 'Error al actualizar la campaña');
      }
    } catch (error) {
      console.error('❌ [UPDATE CAMPAIGN] Error updating campaign:', error);
      alert('Error al actualizar la campaña: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  // (handleDeleteCampaign ya no se usa; se invoca setCampaignToDelete en handlers de UI)

  // Función para confirmar la eliminación
  const handleConfirmDelete = async () => {
    if (!campaignToDelete) return;

    try {
      setIsDeleting(true);
      console.log('🔊 [DELETE CAMPAIGN] Deleting campaign:', campaignToDelete.id);

      const response = await voiceCampaignService.deleteVoiceCampaign(campaignToDelete.id);

      if (response.success) {
        console.log('✅ [DELETE CAMPAIGN] Campaign deleted successfully');
        setIsDeleteModalOpen(false);
        setCampaignToDelete(null);
        
        // Recargar la lista de campañas
        await loadCampaigns();
        await loadStats();
      } else {
        console.error('❌ [DELETE CAMPAIGN] Failed to delete campaign:', response.message);
        alert(response.message || 'Error al eliminar la campaña');
      }
    } catch (error) {
      console.error('❌ [DELETE CAMPAIGN] Error deleting campaign:', error);
      alert('Error al eliminar la campaña: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'running': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Cargando campañas...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Campañas</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Crea y gestiona campañas de llamadas automáticas usando agentes de IA
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Botón principal para wizard */}
          <Button 
            onClick={() => setShowWizard(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
          >
            <Icon icon="solar:magic-stick-3-bold" className="w-4 h-4 mr-2" />
            Nueva Campaña
          </Button>
        </div>
      </div>

      {/* Modal del CampaignWizard */}
      {showWizard && (
        <CampaignWizard
          onComplete={handleWizardCampaignCreate}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar campañas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
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
              
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Campañas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_campaigns || campaigns.length}</p>
              </div>
              <Icon icon="solar:target-bold-duotone" className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Activas</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.active_campaigns || campaigns.filter(c => c.status === 'running').length}
                </p>
              </div>
              <Icon icon="solar:play-circle-bold-duotone" className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Programadas</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats?.scheduled_campaigns || campaigns.filter(c => c.status === 'scheduled').length}
                </p>
              </div>
              <Icon icon="solar:calendar-bold-duotone" className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completadas</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats?.completed_campaigns || campaigns.filter(c => c.status === 'completed').length}
                </p>
              </div>
              <Icon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Lista de campañas unificada en tabla */}
      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Icon icon="solar:target-outline" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay campañas</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                ? 'No se encontraron campañas que coincidan con los filtros'
                : 'Comienza creando tu primera campaña de llamadas automáticas'}
            </p>
            {!searchTerm && statusFilter === 'all' && priorityFilter === 'all' && (
              <Button onClick={() => setShowWizard(true)} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg">
                <Icon icon="solar:magic-stick-3-bold" className="w-4 h-4 mr-2" />
                Crear Primera Campaña
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr className="text-left text-gray-600 dark:text-gray-300">
                    <th className="px-4 py-3">Campaña</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Agente</th>
                    <th className="px-4 py-3">Contactos</th>
                    <th className="px-4 py-3">Programada</th>
                    <th className="px-4 py-3">Costo total</th>
                    <th className="px-4 py-3">Avance</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCampaigns.map((c) => {
                    const s: any = (c as any).stats || (c as any).statistics || {};
                    const totalContacts = Number(s.total_targets ?? s.total_contacts ?? (c as any).contacts?.length ?? 0);
                    const completed = Number(s.calls_successful ?? s.completed_calls ?? 0);
                    const failed = Number(s.calls_failed ?? 0);
                    // Contadores adicionales si existen; si no, 0
                    const noAnswer = Number(s.no_answer_calls ?? 0);
                    const busy = Number(s.busy_calls ?? 0);
                    const cancelled = Number(s.cancelled_calls ?? 0);
                    const processed = completed + failed + noAnswer + busy + cancelled;
                    const percent = totalContacts > 0
                      ? Math.round((processed / totalContacts) * 100)
                      : ((c as any).status === 'completed' ? 100 : 0);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                          <div className="text-gray-500 dark:text-gray-400 truncate max-w-xs">{c.description}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(c.status)}`}>
                            {/* Icono de estado simplificado (colores en badge) */}
                            {(c.status === 'running') && <Icon icon="solar:play-bold" className="w-3.5 h-3.5" />}
                            {(c.status === 'scheduled') && <Icon icon="solar:calendar-bold" className="w-3.5 h-3.5" />}
                            {(c.status === 'paused') && <Icon icon="solar:pause-bold" className="w-3.5 h-3.5" />}
                            {(c.status === 'completed') && <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" />}
                            {(c.status === 'cancelled') && <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />}
                            {c.status === 'completed' ? 'FINALIZADA' : (c.status || '').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">{(c as any).agent_name || '-'}</td>
                        <td className="px-4 py-3">{s.total_contacts || s.total_targets || (c as any).contacts?.length || 0}</td>
                        <td className="px-4 py-3">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : (c as any).scheduledAt ? new Date((c as any).scheduledAt).toLocaleString() : '-'}</td>
                        <td className="px-4 py-3">{
                          (() => {
                            const statsObj: any = (c as any).statistics || (c as any).stats || {};
                            const rawStatCop = statsObj?.total_cost_cop;
                            const rawStatUsd = statsObj?.total_cost;
                            const statFromStats =
                              (typeof rawStatCop === 'number' && isFinite(rawStatCop))
                                ? rawStatCop
                                : ((typeof rawStatUsd === 'number' && isFinite(rawStatUsd)) ? rawStatUsd * 4500 : undefined);
                            const fallbackCost = campaignCostTotals[c.id];
                            const loading = loadingCampaignCosts[c.id];
                            const value = (typeof statFromStats === 'number' && isFinite(statFromStats))
                              ? statFromStats
                              : (typeof fallbackCost === 'number' && isFinite(fallbackCost) ? fallbackCost : 0);
                            return (
                              <div className="flex items-center gap-2">
                                <Icon icon="solar:dollar-minimalistic-bold" className="w-4 h-4 text-green-600 dark:text-green-400" />
                                {loading ? (
                                  <span className="text-gray-500 dark:text-gray-400">Calculando…</span>
                                ) : (
                                  <span className="tabular-nums font-medium text-gray-900 dark:text-white">
                                    {`COP ${Number(value).toFixed(2)}`}
                                  </span>
                                )}
                              </div>
                            );
                          })()
                        }</td>
                        <td className="px-4 py-3 w-56">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                            <span className="text-gray-700 dark:text-gray-300 tabular-nums w-10 text-right">{percent}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Dropdown
                              label=""
                              dismissOnClick={false}
                              renderTrigger={() => (
                                <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                  <IconDots size={22} />
                                </span>
                              )}
                            >
                              <Dropdown.Item className="flex gap-3" onClick={() => { setSelectedCampaign(c); setIsViewModalOpen(true); }}>
                                <Icon icon="solar:eye-bold-duotone" height={18} /> Ver detalles
                              </Dropdown.Item>
                              {(c.status === 'draft' || c.status === 'scheduled') && (
                                <Dropdown.Item className="flex gap-3" onClick={async () => {
                                  await runWithLoading(c.id, 'start', async () => {
                                    const r = await voiceCampaignService.executeVoiceCampaign(c.id);
                                    if (r.success) await loadCampaigns();
                                  });
                                }}>
                                  {actionLoading[c.id] === 'start' ? <Spinner size="sm" /> : <Icon icon="solar:play-bold-duotone" height={18} />} Iniciar
                                </Dropdown.Item>
                              )}
                              {c.status === 'running' && (
                                <Dropdown.Item className="flex gap-3" onClick={async () => {
                                  await runWithLoading(c.id, 'pause', async () => {
                                    const r = await voiceCampaignService.toggleVoiceCampaign(c.id);
                                    if (r.success) await loadCampaigns();
                                  });
                                }}>
                                  {actionLoading[c.id] === 'pause' ? <Spinner size="sm" /> : <Icon icon="solar:pause-bold-duotone" height={18} />} Pausar
                                </Dropdown.Item>
                              )}
                              {c.status === 'paused' && (
                                <Dropdown.Item className="flex gap-3" onClick={async () => {
                                  await runWithLoading(c.id, 'resume', async () => {
                                    const r = await voiceCampaignService.executeVoiceCampaign(c.id);
                                    if (r.success) await loadCampaigns();
                                  });
                                }}>
                                  {actionLoading[c.id] === 'resume' ? <Spinner size="sm" /> : <Icon icon="solar:play-bold-duotone" height={18} />} Reanudar
                                </Dropdown.Item>
                              )}
                              {(c.status === 'running' || c.status === 'paused') && (
                                <Dropdown.Item className="flex gap-3" onClick={async () => {
                                  await runWithLoading(c.id, 'stop', async () => {
                                    const r = await voiceCampaignService.toggleVoiceCampaign(c.id);
                                    if (r.success) await loadCampaigns();
                                  });
                                }}>
                                  {actionLoading[c.id] === 'stop' ? <Spinner size="sm" /> : <Icon icon="solar:stop-bold-duotone" height={18} />} Detener
                                </Dropdown.Item>
                              )}
                              <Dropdown.Item className="flex gap-3" onClick={() => { setCampaignToEdit(c); setIsEditModalOpen(true); }}>
                                <Icon icon="solar:pen-bold-duotone" height={18} /> Editar
                              </Dropdown.Item>
                              <Dropdown.Item className="flex gap-3" onClick={() => { setCampaignToDelete(c); setIsDeleteModalOpen(true); }}>
                                <Icon icon="solar:trash-bin-trash-bold" height={18} /> Eliminar
                              </Dropdown.Item>
                            </Dropdown>
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

      {/* Modal de vista detallada */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de Campaña: {selectedCampaign?.name}</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <CampaignDetailView campaign={selectedCampaign} />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de edición de campaña */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Campaña: {campaignToEdit?.name}</DialogTitle>
          </DialogHeader>
          {campaignToEdit && (
            <CampaignEditForm 
              campaign={campaignToEdit}
              onSave={handleUpdateCampaign}
              onCancel={() => {
                setIsEditModalOpen(false);
                setCampaignToEdit(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-600" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          {campaignToDelete && (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                ¿Estás seguro de que deseas eliminar la campaña{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  "{campaignToDelete.name}"
                </span>?
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">Esta acción no se puede deshacer</p>
                    <p>Se eliminarán todos los datos asociados incluyendo:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>Historial de llamadas</li>
                      <li>Estadísticas de ejecución</li>
                      <li>Configuración de la campaña</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setCampaignToDelete(null);
                  }}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? (
                    <>
                      <Icon icon="solar:refresh-circle-outline" className="w-4 h-4 mr-2 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" />
                      Eliminar Campaña
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// (Formulario eliminado - funcionalidad movida al CampaignWizard)

// Componente para vista detallada de campaña
const CampaignDetailView: React.FC<{ campaign: VoiceCampaign }> = ({ campaign }) => {
  // Normalizar origen de estadísticas
  const statsRaw: any = (campaign as any).statistics || (campaign as any).stats || {};
  const totalContacts = Number(statsRaw.total_contacts ?? statsRaw.total_targets ?? campaign.contacts?.length ?? 0);
  const completed = Number(statsRaw.completed_calls ?? statsRaw.calls_successful ?? 0);
  const failed = Number(statsRaw.failed_calls ?? statsRaw.calls_failed ?? 0);
  const noAnswer = Number(statsRaw.no_answer_calls ?? 0);
  const busy = Number(statsRaw.busy_calls ?? 0);
  const cancelled = Number(statsRaw.cancelled_calls ?? 0);
  const processedTerm = completed + failed + noAnswer + busy + cancelled;
  const successRate = Number(
    typeof statsRaw.success_rate === 'number'
      ? Math.round(statsRaw.success_rate)
      : (totalContacts > 0 ? Math.round((completed / totalContacts) * 100) : 0)
  );
  const avgDurationSeconds = Number(statsRaw.avg_duration ?? statsRaw.average_duration_seconds ?? 0);
  const [contactCalls, setContactCalls] = useState<Array<any>>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState<boolean>(false);
  const [selectedContactCall, setSelectedContactCall] = useState<any>(null);

  // Audio state for contact call details
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  useEffect(() => {
    const loadContactCalls = async () => {
      setIsLoadingContacts(true);
      try {
        const result = await voiceCampaignService.getHybridCallHistory({ campaign_id: campaign.id, limit: 100 });
        if (result.success && Array.isArray(result.calls)) {
          const mapStatus = (backendStatus: string): string => {
            const s = (backendStatus || '').toLowerCase();
            if (['completed', 'done', 'success'].includes(s)) return 'completed';
            if (['in_progress', 'in-progress', 'processing', 'running', 'answered'].includes(s)) return 'in_progress';
            if (['pending', 'queued', 'initiated', 'ringing'].includes(s)) return 'pending';
            if (['failed', 'error'].includes(s)) return 'failed';
            if (s === 'no_answer') return 'no_answer';
            if (s === 'busy') return 'busy';
            if (s === 'cancelled') return 'cancelled';
            return 'failed';
          };

          const calls = result.calls.map((call: any) => {
            const elStatus = call?.elevenlabs?.raw?.status || call?.elevenlabs_status || call?.elevenlabs_metadata?.status || call.status;
            const status = mapStatus(elStatus);
            const duration = call?.duration_seconds || call?.elevenlabs_metadata?.call_duration_secs || 0;
            const costs = call?.costs || {};
                    const costTotal = typeof costs.total_with_markup_cop === 'number'
              ? costs.total_with_markup_cop
              : (typeof costs.total_cop === 'number' ? costs.total_cop : 0);
            return {
              id: call.id,
              name: call.recipient_name || 'Sin nombre',
              phone: call.recipient_phone || call.phone || 'N/A',
              status,
              duration,
              cost_total: costTotal,
              conversation_id: call.elevenlabs_conversation_id ? String(call.elevenlabs_conversation_id) : undefined,
              raw: call
            };
          });
          setContactCalls(calls);
        } else {
          setContactCalls([]);
        }
      } catch (e) {
        setContactCalls([]);
      } finally {
        setIsLoadingContacts(false);
      }
    };
    loadContactCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const getContactStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'no_answer':
      case 'busy':
      case 'cancelled':
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: 'Completada',
      failed: 'Fallida',
      in_progress: 'En progreso',
      pending: 'Pendiente',
      no_answer: 'Sin respuesta',
      busy: 'Ocupado',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const cleanupAudio = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    } catch {}
    setIsPlayingAudio(false);
    setIsLoadingAudio(false);
    setAudioDuration(0);
    setCurrentTime(0);
    setAudioUrl(null);
    audioRef.current = null;
  };

  const openCallDetail = async (call: any) => {
    setSelectedContactCall(call);
    setIsCallModalOpen(true);
    cleanupAudio();
    if (call?.conversation_id) {
      try {
        setIsLoadingAudio(true);
        const url = await getConversationAudio(call.conversation_id);
        if (url) {
          const audio = new Audio(url);
          audio.preload = 'metadata';
          audio.addEventListener('loadedmetadata', () => setAudioDuration(audio.duration));
          audio.addEventListener('timeupdate', () => {
            if (!isSeekingRef.current) setCurrentTime(audio.currentTime);
          });
          audio.addEventListener('ended', () => setIsPlayingAudio(false));
          audioRef.current = audio;
          setAudioUrl(url);
        }
      } catch {}
      finally {
        setIsLoadingAudio(false);
      }
    }
  };

  const togglePlayPause = async () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      await audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const setSeekByClientX = (clientX: number) => {
    if (!audioRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = ratio * (audioDuration || audioRef.current.duration || 0);
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent) => {
    isSeekingRef.current = true;
    setSeekByClientX(e.clientX);
    const onMove = (ev: MouseEvent) => setSeekByClientX(ev.clientX);
    const onUp = () => {
      isSeekingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Limpieza al desmontar el componente de detalle para evitar audio colgante
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  
  return (
    <div className="space-y-6">
      {/* Header con información básica */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalContacts}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Contactos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {completed}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completadas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {failed}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Fallidas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {successRate}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Tasa de Éxito</div>
          </div>
        </div>
      </div>

      {/* Información de la campaña */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detalles generales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="solar:document-text-bold" className="w-5 h-5 text-blue-600" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Estado</Label>
                <div className="mt-1">
                  <Badge className={`${campaign.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 
                    campaign.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                    campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'}`}>
                    {campaign.status === 'draft' && 'Borrador'}
                    {campaign.status === 'scheduled' && 'Programada'}
                    {campaign.status === 'running' && 'Activa'}
                    {campaign.status === 'paused' && 'Pausada'}
                    {campaign.status === 'completed' && 'Completada'}
                    {campaign.status === 'cancelled' && 'Cancelada'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Prioridad</Label>
                <div className="mt-1">
                  <Badge className={`${campaign.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                    campaign.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                    'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'}`}>
                    {campaign.priority === 'high' && 'Alta'}
                    {campaign.priority === 'medium' && 'Media'}
                    {campaign.priority === 'low' && 'Baja'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Descripción</Label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {campaign.description || 'Sin descripción'}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Agente Asignado</Label>
              <div className="mt-1 flex items-center gap-2">
                <Icon icon="solar:user-speak-rounded-bold" className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {campaign.agent_name || 'Sin asignar'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Creada</Label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </p>
              </div>
              {campaign.completed_at && (
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Completada</Label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {new Date(campaign.completed_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas detalladas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="solar:chart-square-bold" className="w-5 h-5 text-green-600" />
              Estadísticas Detalladas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Llamadas pendientes</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {Math.max(0, totalContacts - processedTerm)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Duración promedio</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {(() => {
                    const avgFromCalls = contactCalls.length > 0
                      ? Math.round(contactCalls.reduce((s, c) => s + (Number(c.duration) || 0), 0) / contactCalls.length)
                      : 0;
                    const val = avgDurationSeconds > 0 ? Math.round(avgDurationSeconds) : avgFromCalls;
                    return val > 0 ? `${val}s` : 'N/A';
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Costo total</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {(() => {
                    const sumCalls = contactCalls.reduce((s, c) => s + (Number(c.cost_total) || 0), 0);
                    const total = typeof (statsRaw as any).total_cost_cop === 'number' ? Number((statsRaw as any).total_cost_cop) : sumCalls;
                    return `COP ${total.toFixed(2)}`;
                  })()}
                </span>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Progreso</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {totalContacts > 0 ? Math.round((processedTerm / totalContacts) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${totalContacts > 0 ? (processedTerm / totalContacts) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultados por contacto - basado en conversaciones reales */}
              {campaign.status === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="solar:users-group-two-rounded-bold" className="w-5 h-5 text-purple-600" />
              Resultados por Contacto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {isLoadingContacts ? (
                <div className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">Cargando conversaciones reales...</div>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Contacto</th>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Teléfono</th>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Estado</th>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Duración</th>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Costo total</th>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {contactCalls.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500 dark:text-gray-400">Sin conversaciones registradas para esta campaña</td>
                    </tr>
                  ) : (
                    contactCalls.slice(0, 10).map((c) => (
                      <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 text-gray-900 dark:text-white">{c.name}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{c.phone}</td>
                        <td className="py-2">
                          <Badge className={`text-xs ${getContactStatusBadgeClasses(c.status)}`}>{getStatusLabel(c.status)}</Badge>
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{formatDuration(c.duration)}</td>
                      <td className="py-2 text-gray-900 dark:text-white">{`COP ${(Number(c.cost_total) || 0).toFixed(2)}`}</td>
                      <td className="py-2">
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openCallDetail(c)}>
                            Ver detalles
                          </Button>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
              )}
              {contactCalls.length > 10 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Mostrando 10 de {contactCalls.length} contactos
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de detalle de llamada por contacto */}
      <Dialog open={isCallModalOpen} onOpenChange={(open) => {
        if (!open) {
          cleanupAudio();
          setIsCallModalOpen(false);
          setSelectedContactCall(null);
        } else {
          setIsCallModalOpen(true);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Detalle de Conversación {selectedContactCall ? `— ${selectedContactCall.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedContactCall && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-900 dark:text-white font-medium">{selectedContactCall.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{selectedContactCall.phone}</div>
                  </div>
                  <Badge className={`${getContactStatusBadgeClasses(selectedContactCall.status)} text-xs`}>{getStatusLabel(selectedContactCall.status)}</Badge>
                </div>
                <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">Duración: {formatDuration(selectedContactCall.duration)}</div>
              </div>
            )}

            {/* Datos recolectados (si existen) - Componente mejorado */}
            {selectedContactCall?.raw?.call_metadata?.collected_data && (
              <CollectedDataDisplay
                collectedData={selectedContactCall.raw.call_metadata.collected_data}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              />
            )}

            {(selectedContactCall?.conversation_id) && (
              <div className="rounded-lg p-4 border bg-white border-gray-200 text-gray-900 dark:bg-gray-900 dark:border-gray-700 dark:text-white">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={togglePlayPause}
                    disabled={isLoadingAudio || !audioRef.current}
                    className="rounded-full w-10 h-10 flex items-center justify-center p-0 transition-all duration-200 shadow-md bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                  >
                    {isLoadingAudio ? (
                      <span className="animate-pulse text-xs">···</span>
                    ) : isPlayingAudio ? (
                      <Icon icon="solar:pause-bold" className="w-5 h-5" />
                    ) : (
                      <Icon icon="solar:play-bold" className="w-5 h-5 ml-0.5" />
                    )}
                  </Button>

                  <div className="flex-1 flex flex-col">
                    <div
                      ref={progressBarRef}
                      onMouseDown={handleProgressBarMouseDown}
                      className={`w-full h-2 rounded-full relative ${!audioRef.current ? 'opacity-50' : 'cursor-pointer'} bg-gray-200 dark:bg-gray-700`}
                    >
                      <div
                        className="absolute top-0 left-0 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${Math.min(100, Math.max(0, (currentTime / Math.max(1, audioDuration || 1)) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-gray-600 dark:text-gray-300">
                      <span>{formatDuration(Math.floor(currentTime))}</span>
                      <span>{formatDuration(Math.floor(audioDuration))}</span>
                    </div>
                  </div>
                </div>
                {!audioRef.current && !isLoadingAudio && (
                  <div className="text-xs text-gray-500 mt-2">Pulsa reproducir para cargar el audio</div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Componente para edición de campaña
const CampaignEditForm: React.FC<{
  campaign: VoiceCampaign;
  onSave: (data: any) => void;
  onCancel: () => void;
}> = ({ campaign, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: campaign.name || '',
    description: campaign.description || '',
    agent_name: campaign.agent_name || '',
    priority: campaign.priority || 'medium',
    voice_message_template: (campaign as any).voice_message_template || '',
  });

  const handleSubmit = () => {
    // Validar campos requeridos
    if (!formData.name.trim()) {
      alert('El nombre de la campaña es requerido');
      return;
    }

    if (!formData.voice_message_template.trim()) {
      alert('El mensaje de voz es requerido');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {/* Nombre de la campaña */}
        <div>
          <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Nombre de la Campaña *
          </Label>
          <TextInput
            id="edit-name"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Campaña de Renovaciones Q4"
            className="mt-1"
          />
        </div>

        {/* Descripción */}
        <div>
          <Label htmlFor="edit-description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Descripción
          </Label>
          <Textarea
            id="edit-description"
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe el propósito de esta campaña..."
            rows={3}
            className="mt-1"
          />
        </div>

        {/* Nombre del agente */}
        <div>
          <Label htmlFor="edit-agent-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Nombre del Agente
          </Label>
          <TextInput
            id="edit-agent-name"
            value={formData.agent_name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, agent_name: e.target.value })}
            placeholder="Ej: María González"
            className="mt-1"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Este es el nombre con el que se presentará el agente en las llamadas
          </p>
        </div>

        {/* Prioridad */}
        <div>
          <Label htmlFor="edit-priority" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Prioridad
          </Label>
          <Select
            value={formData.priority}
            onValueChange={(value: 'low' | 'medium' | 'high') => setFormData({ ...formData, priority: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Seleccionar prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baja</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mensaje de voz */}
        <div>
          <Label htmlFor="edit-message" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Mensaje de Voz *
          </Label>
          <Textarea
            id="edit-message"
            value={formData.voice_message_template}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, voice_message_template: e.target.value })}
            placeholder="Escriba el mensaje que el agente dirá en las llamadas..."
            rows={6}
            className="mt-1"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Puede usar variables como {'{customer_name}'}, {'{policy_number}'}, etc.
          </p>
        </div>
      </div>

      {/* Estado de la campaña */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Estado actual: {campaign.status === 'draft' ? 'Borrador' : 
                            campaign.status === 'scheduled' ? 'Programada' :
                            campaign.status === 'running' ? 'Activa' :
                            campaign.status === 'paused' ? 'Pausada' :
                            campaign.status === 'completed' ? 'Completada' : 'Cancelada'}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {campaign.status === 'running' ? 'La campaña se está ejecutando actualmente' :
               campaign.status === 'completed' ? 'Esta campaña ya ha sido completada' :
               'Puedes modificar la configuración de esta campaña'}
            </p>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Icon icon="solar:floppy-disk-bold" className="w-4 h-4 mr-2" />
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
};

export default CampaignsManagementWidget;
