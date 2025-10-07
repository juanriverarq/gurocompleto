import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Card, CardHeader, CardTitle, CardContent } from "../shadcn-ui/Default-Ui/card";
import { Button } from "../shadcn-ui/Default-Ui/button";
import { Input } from "../shadcn-ui/Default-Ui/input";
import { Badge } from "../shadcn-ui/Default-Ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../shadcn-ui/Default-Ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../shadcn-ui/Default-Ui/dialog";
import { Alert, AlertDescription } from "../shadcn-ui/Default-Ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../shadcn-ui/Default-Ui/dropdown-menu";
import { useToast } from "../../hooks/use-toast";
import CreateCampaignWizard from "./CreateCampaignWizard";
import campaignService, {
  Campaign,
  CampaignExecution,
  CampaignTemplate
} from "../../services/campaignService";

interface CampaignManagerProps {
  onCampaignCreated?: (campaign: Campaign) => void;
}

const CampaignManager: React.FC<CampaignManagerProps> = ({ onCampaignCreated }) => {
  const { toast } = useToast();

  // Estados principales
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [executions, setExecutions] = useState<CampaignExecution[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'templates' | 'history'>('list');
  // Control de actualización
  const [autoRefresh, setAutoRefresh] = useState(false); // por defecto desactivado
  const pollingRef = React.useRef<{ timer: any; lastKey: string; unchanged: number }>({
    timer: null,
    lastKey: '',
    unchanged: 0
  });

  // Estados de modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Filtros y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
    loadExecutions();
  }, []);

  // Auto-refresh opcional (desactivado por defecto)
  // - Solo si autoRefresh === true y hay campañas en progreso
  // - Reduce frecuencia (15s visible / 60s background)
  // - Backoff si no hay cambios (hasta +30s)
  useEffect(() => {
    if (!autoRefresh) {
      if (pollingRef.current.timer) {
        clearTimeout(pollingRef.current.timer);
      }
      return;
    }

    const inProgress = campaigns.some((c: any) => {
      const s = (c?.status || '').toLowerCase();
      return s === 'sending' || s === 'running' || s === 'pending';
    });
    if (!inProgress) return;

    const snapshot = JSON.stringify(
      campaigns.map((c: any) => ({ id: c?.id, status: (c?.status || '').toLowerCase() }))
    );

    if (pollingRef.current.lastKey === snapshot) {
      pollingRef.current.unchanged = Math.min(pollingRef.current.unchanged + 1, 999);
    } else {
      pollingRef.current.unchanged = 0;
    }
    pollingRef.current.lastKey = snapshot;

    const visible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    const base = visible ? 15000 : 60000; // 15s en foreground, 60s en background
    const extra = Math.min(pollingRef.current.unchanged, 6) * 5000; // +5s por ciclo sin cambios, máx +30s
    const interval = base + extra;

    if (pollingRef.current.timer) {
      clearTimeout(pollingRef.current.timer);
    }
    pollingRef.current.timer = setTimeout(() => {
      loadCampaigns();
    }, interval);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pollingRef.current.unchanged = 0;
        if (autoRefresh) loadCampaigns();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (pollingRef.current.timer) {
        clearTimeout(pollingRef.current.timer);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [campaigns, autoRefresh]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const result = await campaignService.getCampaigns();
      console.log('🔍 [CAMPAIGN MANAGER] Campaign service result:', result);
      
      if (result.success) {
        // ✅ CORREGIDO: Usar result.campaigns en lugar de result.data
        const campaigns = result.campaigns || [];
        setCampaigns(campaigns);
        console.log('🔍 [CAMPAIGN MANAGER] Campaigns loaded:', campaigns.length);
        try {
          const dist = campaigns.reduce((acc: Record<string, number>, c: any) => {
            const s = (c?.status ?? 'unknown') as string;
            acc[s] = (acc[s] || 0) + 1;
            return acc;
          }, {});
          console.log('🔍 [CAMPAIGN MANAGER] Status distribution:', dist);
          console.log('🔍 [CAMPAIGN MANAGER] First 3 statuses:', campaigns.slice(0, 3).map((c: any) => c?.status));
        } catch {}
      } else {
        console.error('🔍 [CAMPAIGN MANAGER] Failed to load campaigns:', result);
        setCampaigns([]);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setCampaigns([]); // Asegurar que no quede undefined
      toast({
        title: "Error",
        description: "No se pudieron cargar las campañas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      // ✅ CORREGIDO: Usar getCampaignTemplates en lugar de getTemplates
      const result = await campaignService.getCampaignTemplates();
      if (result.success) {
        setTemplates(result.templates || []);
        console.log('🔍 [CAMPAIGN MANAGER] Templates loaded:', result.templates?.length || 0);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]); // Fallback vacío
    }
  };

  const loadExecutions = async () => {
    try {
      // ✅ NOTA: getCampaignExecutions requiere campaignId específico
      // Para el historial general, necesitaríamos un endpoint diferente
      // Por ahora, dejamos el array vacío hasta implementar historial general
      setExecutions([]);
      console.log('🔍 [CAMPAIGN MANAGER] Executions: Usando array vacío (requiere campaignId específico)');
    } catch (error) {
      console.error('Error loading executions:', error);
      setExecutions([]);
    }
  };
// Helper: determinar si una campaña puede ejecutarse desde la UI
const canExecute = (c: Campaign): boolean => {
  // No permitir ejecutar desde UI si es campaña programada; debe esperar al scheduler
  if ((c as any)?.campaign_type === 'scheduled') return false;

  // Si tiene fecha programada a futuro, no permitir ejecución manual desde UI
  const schedRaw = (c as any)?.scheduled_date || (c as any)?.next_execution;
  if (schedRaw) {
    const t = new Date(schedRaw as any).getTime();
    if (!isNaN(t) && t > Date.now()) return false;
  }

  const raw = (c as any)?.status as unknown;
  const status = typeof raw === 'string' ? raw.toLowerCase() : undefined;

  // Estados permitidos explícitamente para mostrar "Ejecutar"
  const allowed = new Set([
    'draft',
    'paused',
    // 'scheduled', // Oculto del botón principal: campañas programadas deben esperar su hora
    'pending',
    'created',
    'ready',
    'stopped'
  ]);

  // Estados bloqueados (no se puede ejecutar desde UI)
  // Permitimos 'active' (backend soporta execute-now para activas) y 'failed' para reintentar
  const blocked = new Set([
    'sending',
    'running',
    'completed',
    'cancelled'
  ]);

  // Sin estado: permitir por defecto (defensivo)
  if (!status) return true;

  if (allowed.has(status)) return true;
  if (blocked.has(status)) return false;

  // Estado desconocido: permitir por defecto para no ocultar la acción
  return true;
};
// Helper: determinar si una campaña puede ejecutarse desde la UI


  // Helper: determinar si una campaña puede ejecutarse desde la UI
  

  // Helper: determinar si una campaña puede ejecutarse desde la UI
  

  const handleExecuteCampaign = async (campaignId: number) => {
    if (!confirm('¿Estás seguro de que quieres ejecutar esta campaña?')) return;

      setLoading(true);
    try {
      // ✅ CORREGIDO: Usar executeCampaignNow en lugar de executeCampaign
      const result = await campaignService.executeCampaignNow(campaignId);
      if (result.success) {
        toast({
          title: "¡Éxito!",
          description: "Campaña ejecutada correctamente. Los mensajes están siendo enviados."
        });
        loadCampaigns();
        // loadExecutions(); // No necesario por ahora ya que es array vacío
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error executing campaign:', error);
      
      // Mejorar mensajes de error
      let errorMessage = error instanceof Error ? error.message : "Error al ejecutar la campaña";
      
      if (errorMessage.includes('instancia') || errorMessage.includes('WhatsApp') || errorMessage.includes('conectada')) {
        toast({
          title: "⚠️ Instancia de WhatsApp no disponible",
          description: "No hay instancias de WhatsApp conectadas. Ve a la pestaña 'Conexión WhatsApp' para crear y conectar una instancia.",
          variant: "destructive",
          duration: 8000
        });
      } else if (errorMessage.includes('microservicio')) {
        toast({
          title: "❌ Error de conexión",
          description: "No se pudo conectar con el servicio de WhatsApp. Verifica que el microservicio esté funcionando.",
          variant: "destructive",
          duration: 8000
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta campaña?')) return;

      setLoading(true);
    try {
      const result = await campaignService.deleteCampaign(campaignId);
      if (result.success) {
        toast({
          title: "¡Éxito!",
          description: "Campaña eliminada correctamente"
        });
        loadCampaigns();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al eliminar la campaña",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCampaign = async (campaignId: number) => {
    if (!confirm('¿Estás seguro de que quieres reenviar esta campaña? Se volverán a enviar los mensajes a todos los destinatarios.')) return;

      setLoading(true);
    try {
      const result = await campaignService.executeCampaignNow(campaignId);
      if (result.success) {
        toast({
          title: "¡Éxito!",
          description: "Campaña reenviada correctamente. Los mensajes están siendo enviados nuevamente."
        });
        loadCampaigns();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error resending campaign:', error);
      
      // Mejorar mensajes de error
      let errorMessage = error instanceof Error ? error.message : "Error al reenviar la campaña";
      
      if (errorMessage.includes('instancia') || errorMessage.includes('WhatsApp') || errorMessage.includes('conectada')) {
        toast({
          title: "⚠️ Instancia de WhatsApp no disponible",
          description: "No hay instancias de WhatsApp conectadas. Ve a la pestaña 'Conexión WhatsApp' para crear y conectar una instancia.",
          variant: "destructive",
          duration: 8000
        });
      } else if (errorMessage.includes('microservicio')) {
        toast({
          title: "❌ Error de conexión",
          description: "No se pudo conectar con el servicio de WhatsApp. Verifica que el microservicio esté funcionando.",
          variant: "destructive",
          duration: 8000
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewCampaign = (campaignId: number) => {
        toast({
      title: "Próximamente",
      description: "La vista de detalles estará disponible pronto"
    });
  };

  const handleDuplicateCampaign = async (campaignId: number) => {
    toast({
      title: "Próximamente",
      description: "La función de duplicar estará disponible pronto"
    });
  };

  const handleViewResults = (campaignId: number) => {
    // Cambiar a tab de historial (no existe 'executions' en el union de tabs)
    setActiveTab('history');
    toast({
      title: "Ver resultados",
      description: "Mostrando el historial de ejecuciones"
    });
  };

  const handleEditCampaign = (campaignId: number) => {
        toast({
      title: "Próximamente",
      description: "La función de editar estará disponible pronto"
    });
  };

  // Filtrar campañas con protección defensiva
  const filteredCampaigns = campaigns.filter(campaign => {
    if (!campaign) return false; // Protección adicional
    
    const matchesSearch = (campaign.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (campaign.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Paginación
  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
  const paginatedCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string | undefined) => {
    const statusConfig = {
      draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-800' },
      active: { label: 'Activa', color: 'bg-green-100 text-green-800' },
      sending: { label: 'Enviando', color: 'bg-yellow-100 text-yellow-800' },
      running: { label: 'En ejecución', color: 'bg-yellow-100 text-yellow-800' },
      pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-800' },
      completed: { label: 'Completada', color: 'bg-blue-100 text-blue-800' },
      scheduled: { label: 'Programada', color: 'bg-indigo-100 text-indigo-800' },
      paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-800' },
      failed: { label: 'Fallida', color: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[(status || 'draft') as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getCampaignTypeIcon = (type: string | undefined) => {
    if (!type) return 'solar:chat-square-code-bold'; // Protección defensiva
    
    const icons = {
      immediate: 'solar:lightning-bold',
      scheduled: 'solar:calendar-bold',
      policy_reminder: 'solar:shield-check-bold',
      expired_policy: 'solar:shield-warning-bold'
    };
    return icons[type as keyof typeof icons] || 'solar:chat-square-code-bold';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Campañas</h1>
          <p className="text-gray-600">Administra y ejecuta campañas de WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => loadCampaigns()} variant="outline" className="flex items-center gap-2">
            <Icon icon="solar:refresh-bold" className="w-4 h-4" />
            Actualizar
          </Button>
          <Button
            onClick={() => setAutoRefresh((prev) => !prev)}
            variant={autoRefresh ? "default" : "outline"}
            className={`flex items-center gap-2 ${autoRefresh ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
            title="Alternar auto-actualización"
          >
            <Icon icon="solar:clock-circle-bold" className="w-4 h-4" />
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
            <Icon icon="solar:add-circle-bold" className="w-5 h-5" />
            Crear Nueva Campaña
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Icon icon="solar:list-bold" className="w-4 h-4" />
            Campañas
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Icon icon="solar:history-bold" className="w-4 h-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Icon icon="solar:document-text-bold" className="w-4 h-4" />
            Plantillas
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
            Crear
          </TabsTrigger>
        </TabsList>

        {/* Lista de Campañas */}
        <TabsContent value="list" className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar campañas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
        </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="active">Activa</option>
              <option value="scheduled">Programada</option>
              <option value="completed">Completada</option>
            </select>
            </div>

          {/* Lista de campañas */}
          <div className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center">
                    <Icon icon="solar:refresh-bold" className="w-6 h-6 animate-spin mr-2" />
                    Cargando campañas...
            </div>
                </CardContent>
              </Card>
            ) : paginatedCampaigns.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-gray-500">
                    <Icon icon="solar:inbox-bold" className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No se encontraron campañas</p>
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      variant="outline"
                      className="mt-4"
                    >
                      Crear primera campaña
                    </Button>
          </div>
                </CardContent>
              </Card>
            ) : (
              paginatedCampaigns.map((campaign) => {
                try {
                  console.debug('🔍 [CAMPAIGN MANAGER] Render', { id: campaign.id, status: (campaign as any)?.status, canExecute: canExecute(campaign) });
                } catch {}
                return (
                <Card key={campaign.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Icon 
                            icon={getCampaignTypeIcon(campaign.campaign_type)} 
                            className="w-6 h-6 text-indigo-600" 
                          />
        </div>
                        <div className="flex-1">
          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{campaign.name || 'Sin nombre'}</h3>
                            {getStatusBadge(((campaign.campaign_type === 'scheduled' && campaign.status === 'draft') ? 'scheduled' : (campaign.status || 'draft')))}
                            {canExecute(campaign) && (
                              <Button
                                onClick={() => campaign.id && handleExecuteCampaign(campaign.id)}
                                disabled={!campaign.id}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-green-300 text-green-700 hover:text-white hover:bg-green-600"
                                title="Ejecutar ahora"
                              >
                                <Icon icon="solar:play-bold" className="w-4 h-4 mr-1" />
                                Ejecutar
                              </Button>
                            )}
            </div>
                          <p className="text-gray-600 text-sm">{campaign.description || 'Sin descripción'}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>Tipo: {campaign.campaign_type || 'No especificado'}</span>
                            <span>Creada: {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : 'Fecha no disponible'}</span>
                            {campaign.campaign_type === 'scheduled' && (((campaign as any).scheduled_date) || ((campaign as any).next_execution)) && (
                              <span>
                                Programada para: {new Date((((campaign as any).scheduled_date) || ((campaign as any).next_execution)) as any).toLocaleString()}
                              </span>
                            )}
            </div>
          </div>
        </div>
                      <div className="flex items-center space-x-3">
                        {/* Estadísticas rápidas */}
                        <div className="hidden sm:flex items-center space-x-4 text-xs text-gray-500 border-r pr-4">
                          <div className="flex items-center space-x-1">
                            <Icon icon="solar:users-group-rounded-bold" className="w-3 h-3" />
                            <span>
                              {
                                (campaign as any).total_targets ??
                                (campaign.stats as any)?.['total_targets'] ??
                                (campaign.stats as any)?.['total_contacts'] ??
                                0
                              }
                            </span>
                          </div>
                          
                          {/* Mensajes enviados exitosamente */}
                          {(((campaign as any).sent_count ?? campaign.stats?.sent_count ?? 0) > 0) && (
                            <div className="flex items-center space-x-1">
                              <Icon icon="solar:check-circle-bold" className="w-3 h-3 text-green-500" />
                              <span>{(campaign as any).sent_count ?? campaign.stats?.sent_count ?? 0}</span>
                            </div>
                          )}
                          
                          {/* Mensajes fallidos */}
                          {(((campaign as any).failed_count ?? campaign.stats?.failed_count ?? 0) > 0) && (
                            <div className="flex items-center space-x-1">
                              <Icon icon="solar:close-circle-bold" className="w-3 h-3 text-red-500" />
                              <span>{(campaign as any).failed_count ?? campaign.stats?.failed_count ?? 0}</span>
                            </div>
                          )}
                          
                          {/* Mostrar 0/0 solo si la campaña está completada pero no hay stats */}
                          {campaign.status === 'completed' &&
                           (((campaign as any).sent_count ?? campaign.stats?.sent_count ?? 0) === 0) &&
                           (((campaign as any).failed_count ?? campaign.stats?.failed_count ?? 0) === 0) && (
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center space-x-1">
                                <Icon icon="solar:check-circle-bold" className="w-3 h-3 text-green-500" />
                                <span>0</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Icon icon="solar:close-circle-bold" className="w-3 h-3 text-red-500" />
                                <span>0</span>
                              </div>
                            </div>
                          )}
                  </div>

                        {/* Botón de acción principal */}
                        {canExecute(campaign) && (
                      <Button
                            onClick={() => campaign.id && handleExecuteCampaign(campaign.id)}
                            disabled={!campaign.id}
                        size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Icon icon="solar:play-bold" className="w-4 h-4 mr-1" />
                            Ejecutar
                            </Button>
                          )}
                          
                        {campaign.status === 'completed' && (
                          <Button
                          onClick={() => campaign.id && handleResendCampaign(campaign.id)}
                            disabled={!campaign.id}
                            size="sm"
                          variant="outline"
                          className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
                          >
                          <Icon icon="solar:restart-bold" className="w-4 h-4 mr-1" />
                          Reenviar
                          </Button>
                        )}
                          
                        {/* Menú de acciones */}
                        <div className="relative">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button 
                              size="sm" 
                                variant="outline"
                                className="px-2"
                            >
                                <Icon icon="solar:menu-dots-bold" className="w-4 h-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {canExecute(campaign) && (
  <DropdownMenuItem
    onClick={() => campaign.id && handleExecuteCampaign(campaign.id)}
    className="flex items-center space-x-2"
  >
    <Icon icon="solar:play-bold" className="w-4 h-4" />
    <span>Ejecutar ahora</span>
  </DropdownMenuItem>
)}
                              <DropdownMenuItem
                                onClick={() => campaign.id && handleViewCampaign(campaign.id)}
                                className="flex items-center space-x-2"
                              >
                                <Icon icon="solar:eye-bold" className="w-4 h-4" />
                                <span>Ver detalles</span>
                              </DropdownMenuItem>
                              
                              {campaign.status === 'completed' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => campaign.id && handleDuplicateCampaign(campaign.id)}
                                    className="flex items-center space-x-2"
                                  >
                                    <Icon icon="solar:copy-bold" className="w-4 h-4" />
                                    <span>Duplicar</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => campaign.id && handleViewResults(campaign.id)}
                                    className="flex items-center space-x-2"
                                  >
                                    <Icon icon="solar:chart-2-bold" className="w-4 h-4" />
                                    <span>Ver resultados</span>
                                  </DropdownMenuItem>
                        </>
                      )}
                              

                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem
                                onClick={() => campaign.id && handleDeleteCampaign(campaign.id)}
                                className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                              >
                                <Icon icon="solar:trash-bin-bold" className="w-4 h-4" />
                                <span>Eliminar</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
              </div>
            </div>
                  </div>
                  </CardContent>
                </Card>
                );
              })
            )}
                </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                Anterior
                  </Button>
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
              >
                Siguiente
                  </Button>
              </div>
            )}
        </TabsContent>

        {/* Historial de Ejecuciones */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Ejecuciones</CardTitle>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Icon icon="solar:history-bold" className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No hay ejecuciones registradas</p>
                  </div>
              ) : (
                <div className="space-y-3">
                  {executions.map((execution) => (
                    <div key={execution.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                  <div>
                          <h4 className="font-medium">Ejecución #{execution.id}</h4>
                          <p className="text-sm text-gray-600">
                            Ejecutada: {execution.execution_date ? new Date(execution.execution_date).toLocaleDateString() : 'Fecha no disponible'}
                          </p>
                </div>
                        <Badge className={
                          execution.status === 'completed' ? 'bg-green-100 text-green-800' :
                          execution.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {execution.status || 'Unknown'}
                        </Badge>
                </div>
                      {(execution.messages_sent !== undefined || execution.messages_failed !== undefined) && (
                        <div className="mt-2 text-sm text-gray-600">
                          Enviados: {execution.messages_sent || 0} |
                          Fallidos: {execution.messages_failed || 0}
                        </div>
                      )}
                  </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plantillas */}
        <TabsContent value="templates" className="space-y-4">
                <Card>
                  <CardHeader>
              <CardTitle>Plantillas de Mensaje</CardTitle>
                  </CardHeader>
                  <CardContent>
              {templates.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Icon icon="solar:document-text-bold" className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No hay plantillas creadas</p>
                        </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id}>
                      <CardContent className="py-4">
                        <h4 className="font-medium">{template.name || 'Sin nombre'}</h4>
                        <p className="text-sm text-gray-600 mt-1">{template.description || 'Sin descripción'}</p>
                        <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                          {template.message_template ? template.message_template.substring(0, 100) + '...' : 'Sin contenido'}
                    </div>
                  </CardContent>
                </Card>
                  ))}
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Crear (redirige a modal) */}
        <TabsContent value="create">
            <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Icon icon="solar:add-circle-bold" className="w-16 h-16 mx-auto mb-4 text-indigo-600" />
                <h3 className="text-lg font-semibold mb-2">Crear Nueva Campaña</h3>
                <p className="text-gray-600 mb-4">
                  Utiliza nuestro asistente paso a paso para crear campañas personalizadas
                </p>
                <Button onClick={() => setShowCreateModal(true)} size="lg">
                  Abrir Asistente de Campañas
                    </Button>
                </div>
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Wizard mejorado para crear campañas */}
      <CreateCampaignWizard
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCampaignCreated={(campaign) => {
          loadCampaigns(); // Recargar la lista de campañas
          onCampaignCreated?.(campaign);
          setActiveTab('list'); // Cambiar a la lista de campañas
        }}
      />

      {/* Modal de previsualización */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Previsualización de Objetivos</DialogTitle>
          </DialogHeader>

          {previewData && (
            <div className="space-y-4">
              <Alert>
                <Icon icon="solar:info-circle-bold" className="h-4 w-4" />
                <AlertDescription>
                  Se encontraron {previewData.total_targets} pólizas que cumplen los criterios.
                </AlertDescription>
              </Alert>

              <div className="max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {previewData.sample_targets?.map((target: any, index: number) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{target.client_name}</p>
                          <p className="text-xs text-gray-600">{target.phone}</p>
                          <p className="text-xs text-gray-500">Póliza: {target.policy_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{target.policy_type}</p>
                          {target.days_until_expiry !== undefined && (
                            <p className="text-xs font-medium">
                              {target.days_until_expiry} días restantes
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignManager;