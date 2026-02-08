import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button, Spinner, Badge, Alert, Table, TextInput, Tooltip } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Switch } from '@headlessui/react';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Textarea } from 'src/components/shadcn-ui/Default-Ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/shadcn-ui/Default-Ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'src/components/shadcn-ui/Default-Ui/collapsible';
import policyNotificationService, {
  PolicyNotificationConfig,
} from 'src/services/policyNotificationService';
import { useToast } from 'src/hooks/use-toast';
import { useTerminologia } from 'src/context/TerminologiaContext';
import api from 'src/config/api';
import whatsappInstanceService from 'src/services/whatsappInstanceService';
import { useWhatsAppSocket } from 'src/hooks/useWhatsAppSocket';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'dashboard' | 'config' | 'history';

const PolicyNotificationsModalV2: React.FC<Props> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const { terminologia } = useTerminologia();
  
  // Estados principales
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [config, setConfig] = useState<PolicyNotificationConfig | null>(null);
  
  // Estados de datos
  const [whatsappInstances, setWhatsappInstances] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  
  // Estados de UI
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [skippingId, setSkippingId] = useState<string | null>(null);
  
  // Ref para acceder al config actual sin causar re-renders
  const configRef = useRef(config);
  
  // Mantener ref actualizado
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // WebSocket para actualización en tiempo real del estado de WhatsApp
  const { isConnected: socketConnected, subscribeToInstance, unsubscribeFromInstance } = useWhatsAppSocket({
    autoConnect: isOpen,
    events: {
      onConnected: (data) => {
        console.log('🎉 [NotificationsModal] WhatsApp conectado:', data.instanceId);
        // Actualizar instancias
        setWhatsappInstances(prev => prev.map(inst => 
          inst.instance_id === data.instanceId ? { ...inst, status: 'connected' } : inst
        ));
        // Actualizar config
        if (configRef.current) {
          setConfig(prev => prev ? {
            ...prev,
            whatsapp_status: { ...prev.whatsapp_status!, connected: true, status: 'connected', message: 'Conectado' }
          } : null);
        }
        toast({ title: '✅ WhatsApp Conectado', description: 'La instancia está lista para enviar mensajes' });
      },
      onDisconnected: (data) => {
        console.log('❌ [NotificationsModal] WhatsApp desconectado:', data.instanceId);
        // Actualizar instancias
        setWhatsappInstances(prev => prev.map(inst => 
          inst.instance_id === data.instanceId ? { ...inst, status: 'disconnected' } : inst
        ));
        // Actualizar config
        if (configRef.current) {
          setConfig(prev => prev ? {
            ...prev,
            whatsapp_status: { ...prev.whatsapp_status!, connected: false, status: 'disconnected', message: 'Desconectado' }
          } : null);
        }
        toast({ title: '❌ WhatsApp Desconectado', description: 'La instancia se ha desconectado', variant: 'destructive' });
      },
      onInstanceUpdate: (data) => {
        console.log('📡 [NotificationsModal] Actualización de instancia:', data);
        if (data.event === 'connected') {
          setWhatsappInstances(prev => prev.map(inst => 
            inst.instance_id === data.instanceId ? { ...inst, status: 'connected' } : inst
          ));
        } else if (data.event === 'disconnected') {
          setWhatsappInstances(prev => prev.map(inst => 
            inst.instance_id === data.instanceId ? { ...inst, status: 'disconnected' } : inst
          ));
        }
      },
    }
  });

  // Suscribirse a la instancia seleccionada cuando cambia
  const subscribedInstanceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!socketConnected || !config?.whatsapp_instance_id) return;
    
    // Buscar el instance_id de la instancia seleccionada
    const selectedInstance = whatsappInstances.find(i => i.id === config.whatsapp_instance_id);
    const instanceId = selectedInstance?.instance_id;
    
    if (instanceId && instanceId !== subscribedInstanceRef.current) {
      // Desuscribirse de la anterior
      if (subscribedInstanceRef.current) {
        unsubscribeFromInstance(subscribedInstanceRef.current);
      }
      // Suscribirse a la nueva
      subscribeToInstance(instanceId);
      subscribedInstanceRef.current = instanceId;
    }
    
    return () => {
      if (subscribedInstanceRef.current) {
        unsubscribeFromInstance(subscribedInstanceRef.current);
        subscribedInstanceRef.current = null;
      }
    };
  }, [socketConnected, config?.whatsapp_instance_id, whatsappInstances, subscribeToInstance, unsubscribeFromInstance]);
  
  // Secciones colapsables
  const [openSections, setOpenSections] = useState({
    notifications: true,
    schedule: false,
    recipients: false,
    exclusions: false,
    templates: false,
  });

  // Helpers
  const getClientName = (c: any): string => {
    const company = c.razon_social || c.company_name || c.nombre_completo || c.full_name || '';
    const first = c.first_name || c.nombre || c.nombres || '';
    const last = c.last_name || c.apellido || c.apellidos || '';
    return (first || last) ? `${first} ${last}`.trim() : company || '';
  };

  const getClientDocument = (c: any): string => {
    return c.document_number ?? c.numero_documento ?? c.dni ?? c.documento ?? c.nit ?? '';
  };

  // Cargar datos
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await policyNotificationService.getConfig();
      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      toast({ title: 'Error', description: 'No se pudo cargar la configuración', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadWhatsAppInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      const response = await whatsappInstanceService.getInstances();
      if (response.success && response.data) {
        setWhatsappInstances(response.data);
      }
    } catch (error) {
      console.error('Error cargando instancias:', error);
    } finally {
      setLoadingInstances(false);
    }
  }, []);

  const loadClientes = useCallback(async () => {
    try {
      setLoadingClientes(true);
      const response = await api.get('/saas/clientes', { params: { limit: 500 } });
      if (response.data?.data) {
        setClientes(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const response = await policyNotificationService.getLogs({ limit: 50 });
      if (response?.data) {
        setLogs(response.data);
      }
    } catch (error) {
      console.error('Error cargando logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const loadScheduledNotifications = useCallback(async () => {
    try {
      setLoadingScheduled(true);
      const response = await policyNotificationService.getScheduledNotifications();
      if (response?.data) {
        setScheduledNotifications(response.data);
      }
    } catch (error) {
      console.error('Error cargando próximos envíos:', error);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadWhatsAppInstances();
    }
  }, [isOpen, loadConfig, loadWhatsAppInstances]);

  useEffect(() => {
    if (isOpen && config) {
      if (activeTab === 'dashboard') {
        loadScheduledNotifications();
      } else if (activeTab === 'history') {
        loadLogs();
      } else if (activeTab === 'config' && openSections.exclusions) {
        loadClientes();
      }
    }
  }, [isOpen, config, activeTab, openSections.exclusions, loadScheduledNotifications, loadLogs, loadClientes]);

  const updateConfig = (updates: Partial<PolicyNotificationConfig>) => {
    if (config) {
      setConfig({ ...config, ...updates });
    }
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const data = await policyNotificationService.updateConfig(config);
      if (data) {
        toast({ title: 'Guardado', description: 'Configuración actualizada correctamente' });
        setConfig(data);
      }
    } catch (error: any) {
      console.error('Error guardando:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSkipNotification = async (policyId: number, notificationType: string) => {
    const key = `${policyId}-${notificationType}`;
    try {
      setSkippingId(key);
      await policyNotificationService.skipNotification({
        poliza_id: policyId,
        notification_type: notificationType as 'expiration' | 'renewal' | 'payment_due',
        reason: 'Omitido por el usuario'
      });
      toast({ title: 'Omitido', description: 'La notificación no se enviará' });
      loadScheduledNotifications();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo omitir', variant: 'destructive' });
    } finally {
      setSkippingId(null);
    }
  };

  const translateError = (error: string): string => {
    const translations: Record<string, string> = {
      'Error desconocido': 'Error al enviar',
      'Instance not connected': 'WhatsApp desconectado',
      'instance not connected': 'WhatsApp desconectado',
      'Connection closed': 'Conexión cerrada',
      'Phone number not registered': 'Número no registrado',
      'Invalid phone number': 'Número inválido',
      'Rate limit exceeded': 'Límite excedido',
      'Timeout': 'Tiempo agotado',
      'Omitido manualmente': 'Omitido por usuario',
    };
    if (translations[error]) return translations[error];
    if (error.includes('[HTTP')) {
      const match = error.match(/\[HTTP (\d+)\]/);
      if (match) {
        const code = match[1];
        if (code === '500') return 'Error del servidor';
        if (code === '502' || code === '503') return 'Servicio no disponible';
        return `Error (${code})`;
      }
    }
    return error.length > 30 ? error.substring(0, 30) + '...' : error;
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!isOpen) return null;

  // Renderizado
  return (
    <Modal show={isOpen} onClose={onClose} size="5xl" dismissible>
      <Modal.Header className="border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Icon icon="solar:bell-bing-bold-duotone" className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Notificaciones Automáticas</h3>
            <p className="text-sm text-gray-500">Configura recordatorios de vencimiento por WhatsApp</p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
            <span className="ml-3 text-gray-500">Cargando...</span>
          </div>
        ) : !config ? (
          <div className="text-center py-16">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-gray-500">Error al cargar la configuración</p>
            <Button color="blue" size="sm" className="mt-4" onClick={loadConfig}>Reintentar</Button>
          </div>
        ) : (
          <div className="flex h-[600px]">
            {/* Sidebar con tabs */}
            <div className="w-48 bg-gray-50 dark:bg-gray-800/50 border-r p-3 space-y-1">
              {/* Estado del sistema */}
              <div className="p-3 mb-4 rounded-lg bg-white dark:bg-gray-800 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Sistema</span>
                  <Switch
                    checked={config.is_active}
                    onChange={(checked) => updateConfig({ is_active: checked })}
                    className="group inline-flex h-5 w-9 items-center rounded-full bg-gray-200 transition data-[checked]:bg-green-500"
                  >
                    <span className="size-3 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-5" />
                  </Switch>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${config.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className={`text-sm font-medium ${config.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                    {config.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {config.whatsapp_status && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Icon icon="logos:whatsapp-icon" className="w-4 h-4" />
                      <span className={`text-xs ${config.whatsapp_status.connected ? 'text-green-600' : 'text-red-500'}`}>
                        {config.whatsapp_status.connected ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              {[
                { id: 'dashboard' as TabType, icon: 'solar:chart-2-bold-duotone', label: 'Dashboard' },
                { id: 'config' as TabType, icon: 'solar:settings-bold-duotone', label: 'Configuración' },
                { id: 'history' as TabType, icon: 'solar:history-bold-duotone', label: 'Historial' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon icon={tab.icon} className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contenido principal */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* TAB: Dashboard */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Alerta si WhatsApp desconectado */}
                  {config.is_active && config.whatsapp_status && !config.whatsapp_status.connected && (
                    <Alert color="failure">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:danger-triangle-bold" className="w-5 h-5" />
                        <span className="font-medium">WhatsApp desconectado</span>
                      </div>
                      <p className="text-sm mt-1">Conecta tu WhatsApp para enviar notificaciones automáticas.</p>
                    </Alert>
                  )}

                  {/* Estadísticas rápidas */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-green-700 dark:text-green-400">Enviados</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">{config.stats?.total_sent || 0}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-red-600" />
                        <span className="text-sm text-red-700 dark:text-red-400">Fallidos</span>
                      </div>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">{config.stats?.total_failed || 0}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="solar:calendar-bold" className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-blue-700 dark:text-blue-400">Próximo envío</span>
                      </div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {config.stats?.next_execution_formatted || 'No programado'}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="solar:clock-circle-bold" className="w-5 h-5 text-purple-600" />
                        <span className="text-sm text-purple-700 dark:text-purple-400">Hora de envío</span>
                      </div>
                      <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                        {config.send_time?.substring(0, 5) || '09:00'}
                      </p>
                    </div>
                  </div>

                  {/* Próximos envíos */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-blue-500" />
                        Próximos Envíos
                      </h4>
                      <Button size="xs" color="light" onClick={loadScheduledNotifications} disabled={loadingScheduled}>
                        <Icon icon="solar:refresh-bold" className={`w-4 h-4 ${loadingScheduled ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    {loadingScheduled ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner size="sm" />
                        <span className="ml-2 text-sm text-gray-500">Cargando...</span>
                      </div>
                    ) : scheduledNotifications.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <Icon icon="solar:inbox-line-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No hay envíos programados</p>
                        <p className="text-xs text-gray-400 mt-1">Activa las notificaciones y configura los días de anticipación</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <Table.Head>
                            <Table.HeadCell>Póliza</Table.HeadCell>
                            <Table.HeadCell>Cliente</Table.HeadCell>
                            <Table.HeadCell>Tipo</Table.HeadCell>
                            <Table.HeadCell>Vence</Table.HeadCell>
                            <Table.HeadCell>Envío</Table.HeadCell>
                            <Table.HeadCell></Table.HeadCell>
                          </Table.Head>
                          <Table.Body>
                            {scheduledNotifications.slice(0, 10).map((item: any) => (
                              <Table.Row key={`${item.policy_id}-${item.notification_type}`}>
                                <Table.Cell className="font-medium">{item.policy_number}</Table.Cell>
                                <Table.Cell>{item.client_name}</Table.Cell>
                                <Table.Cell>
                                  <Badge color={item.notification_type === 'expiration' ? 'warning' : item.notification_type === 'renewal' ? 'info' : 'success'} size="xs">
                                    {item.notification_type_label}
                                  </Badge>
                                </Table.Cell>
                                <Table.Cell className="text-sm">{item.event_date}</Table.Cell>
                                <Table.Cell className="text-sm text-gray-500">{item.scheduled_send_at_human}</Table.Cell>
                                <Table.Cell>
                                  <Tooltip content="Omitir este envío">
                                    <Button
                                      size="xs"
                                      color="light"
                                      onClick={() => handleSkipNotification(item.policy_id, item.notification_type)}
                                      disabled={skippingId === `${item.policy_id}-${item.notification_type}`}
                                    >
                                      {skippingId === `${item.policy_id}-${item.notification_type}` ? (
                                        <Spinner size="xs" />
                                      ) : (
                                        <Icon icon="solar:close-circle-bold" className="w-4 h-4 text-red-500" />
                                      )}
                                    </Button>
                                  </Tooltip>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: Configuración */}
              {activeTab === 'config' && (
                <div className="space-y-4">
                  {/* Sección: WhatsApp */}
                  <div className="p-4 border rounded-lg bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon icon="logos:whatsapp-icon" className="w-6 h-6" />
                      <div className="flex-1">
                        <h4 className="font-medium">Instancia de WhatsApp</h4>
                        <p className="text-xs text-gray-500">Selecciona la línea para enviar mensajes</p>
                      </div>
                      {config.whatsapp_status && (
                        <Badge color={config.whatsapp_status.connected ? 'success' : 'failure'}>
                          {config.whatsapp_status.connected ? 'Conectado' : 'Desconectado'}
                        </Badge>
                      )}
                    </div>
                    {loadingInstances ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner size="sm" /> Cargando...
                      </div>
                    ) : (
                      <Select
                        value={config.whatsapp_instance_id?.toString() || 'none'}
                        onValueChange={(value) => updateConfig({ whatsapp_instance_id: value === 'none' ? null : parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una instancia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin instancia</SelectItem>
                          {whatsappInstances.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${inst.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                                {inst.phone_number || inst.instance_id}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Sección: Tipos de Notificación */}
                  <Collapsible open={openSections.notifications} onOpenChange={() => toggleSection('notifications')}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon icon="solar:bell-bold-duotone" className="w-6 h-6 text-orange-500" />
                          <div className="text-left">
                            <h4 className="font-medium">Tipos de Notificación</h4>
                            <p className="text-xs text-gray-500">Vencimiento, renovación, pagos</p>
                          </div>
                        </div>
                        <Icon icon={openSections.notifications ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-4 border rounded-lg space-y-4">
                        {/* Vencimiento */}
                        <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 text-orange-500" />
                            <div>
                              <p className="font-medium text-sm">Vencimiento</p>
                              <p className="text-xs text-gray-500">Días: {(config.expiration_days_before_multiple || [config.expiration_days_before]).join(', ')}</p>
                            </div>
                          </div>
                          <Switch
                            checked={config.notify_expiration}
                            onChange={(checked) => updateConfig({ notify_expiration: checked })}
                            className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-orange-500"
                          >
                            <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                          </Switch>
                        </div>

                        {config.notify_expiration && (
                          <div className="pl-8 space-y-3">
                            <div>
                              <Label className="text-xs">Días de anticipación</Label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {(config.expiration_days_before_multiple || [config.expiration_days_before]).map((days, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-white border rounded px-2 py-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="365"
                                      defaultValue={days}
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        const arr = [...(config.expiration_days_before_multiple || [config.expiration_days_before])];
                                        arr[idx] = isNaN(val) ? 30 : val;
                                        updateConfig({ expiration_days_before_multiple: arr, expiration_days_before: Math.max(...arr) });
                                      }}
                                      className="w-14 h-7 text-center text-sm"
                                    />
                                    <span className="text-xs text-gray-500">días</span>
                                    {(config.expiration_days_before_multiple || []).length > 1 && (
                                      <button onClick={() => {
                                        const arr = (config.expiration_days_before_multiple || []).filter((_, i) => i !== idx);
                                        updateConfig({ expiration_days_before_multiple: arr, expiration_days_before: Math.max(...arr) || 30 });
                                      }} className="text-red-500 hover:text-red-700">
                                        <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <Button size="xs" color="light" onClick={() => {
                                  const arr = [...(config.expiration_days_before_multiple || [config.expiration_days_before]), 7];
                                  updateConfig({ expiration_days_before_multiple: arr.sort((a, b) => b - a) });
                                }}>
                                  <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Renovación */}
                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:refresh-bold" className="w-5 h-5 text-blue-500" />
                            <div>
                              <p className="font-medium text-sm">Renovación</p>
                              <p className="text-xs text-gray-500">Días: {(config.renewal_days_before_multiple || [config.renewal_days_before]).join(', ')}</p>
                            </div>
                          </div>
                          <Switch
                            checked={config.notify_renewal}
                            onChange={(checked) => updateConfig({ notify_renewal: checked })}
                            className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-primary"
                          >
                            <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                          </Switch>
                        </div>

                        {/* Pago */}
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:wallet-money-bold" className="w-5 h-5 text-green-500" />
                            <div>
                              <p className="font-medium text-sm">Pago Pendiente</p>
                              <p className="text-xs text-gray-500">Días: {(config.payment_days_before_multiple || [config.payment_days_before]).join(', ')}</p>
                            </div>
                          </div>
                          <Switch
                            checked={config.notify_payment_due}
                            onChange={(checked) => updateConfig({ notify_payment_due: checked })}
                            className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-green-500"
                          >
                            <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                          </Switch>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Sección: Horario */}
                  <Collapsible open={openSections.schedule} onOpenChange={() => toggleSection('schedule')}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon icon="solar:clock-circle-bold-duotone" className="w-6 h-6 text-purple-500" />
                          <div className="text-left">
                            <h4 className="font-medium">Horario de Envío</h4>
                            <p className="text-xs text-gray-500">{config.send_time?.substring(0, 5) || '09:00'} - {(config.send_days || []).length} días</p>
                          </div>
                        </div>
                        <Icon icon={openSections.schedule ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-4 border rounded-lg space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Hora de envío</Label>
                            <Input
                              type="time"
                              value={config.send_time?.substring(0, 5) || '09:00'}
                              onChange={(e) => updateConfig({ send_time: e.target.value + ':00' })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Máximo por día</Label>
                            <Input
                              type="number"
                              min="1"
                              max="1000"
                              value={config.max_notifications_per_day}
                              onChange={(e) => updateConfig({ max_notifications_per_day: parseInt(e.target.value) || 50 })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Días de envío</Label>
                          <div className="flex gap-2 mt-2">
                            {[
                              { v: 1, l: 'L' }, { v: 2, l: 'M' }, { v: 3, l: 'X' },
                              { v: 4, l: 'J' }, { v: 5, l: 'V' }, { v: 6, l: 'S' }, { v: 0, l: 'D' }
                            ].map((d) => (
                              <button
                                key={d.v}
                                onClick={() => {
                                  const curr = config.send_days || [];
                                  const upd = curr.includes(d.v) ? curr.filter(x => x !== d.v) : [...curr, d.v];
                                  updateConfig({ send_days: upd });
                                }}
                                className={`w-10 h-10 rounded-lg font-medium text-sm transition ${
                                  (config.send_days || []).includes(d.v)
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                              >
                                {d.l}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Sección: Destinatarios */}
                  <Collapsible open={openSections.recipients} onOpenChange={() => toggleSection('recipients')}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6 text-cyan-500" />
                          <div className="text-left">
                            <h4 className="font-medium">Destinatarios</h4>
                            <p className="text-xs text-gray-500">A quién enviar las notificaciones</p>
                          </div>
                        </div>
                        <Icon icon={openSections.recipients ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-4 border rounded-lg space-y-3">
                        {[
                          { key: 'send_to_client_phone', label: 'Teléfono principal', desc: 'Campo phone del cliente' },
                          { key: 'send_to_client_mobile', label: 'Teléfono móvil', desc: 'Campo mobile_phone del cliente' },
                          { key: 'send_to_assigned_user', label: terminologia.vendedor, desc: `Notificar al ${terminologia.vendedor.toLowerCase()} asignado` },
                        ].map((opt) => (
                          <div key={opt.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{opt.label}</p>
                              <p className="text-xs text-gray-500">{opt.desc}</p>
                            </div>
                            <Switch
                              checked={(config as any)[opt.key]}
                              onChange={(checked) => updateConfig({ [opt.key]: checked })}
                              className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-cyan-500"
                            >
                              <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                            </Switch>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Sección: Exclusiones */}
                  <Collapsible open={openSections.exclusions} onOpenChange={() => toggleSection('exclusions')}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon icon="solar:shield-cross-bold-duotone" className="w-6 h-6 text-red-500" />
                          <div className="text-left">
                            <h4 className="font-medium">Exclusiones</h4>
                            <p className="text-xs text-gray-500">{config.excluded_client_ids?.length || 0} clientes excluidos</p>
                          </div>
                        </div>
                        <Icon icon={openSections.exclusions ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-4 border rounded-lg space-y-4">
                        {/* Estados excluidos */}
                        <div>
                          <Label className="text-xs">Estados de póliza excluidos</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {['CANCELADA', 'SUSPENDIDA', 'VENCIDA'].map((st) => {
                              const isEx = config.excluded_policy_statuses?.includes(st);
                              return (
                                <button
                                  key={st}
                                  onClick={() => {
                                    const curr = config.excluded_policy_statuses || [];
                                    updateConfig({ excluded_policy_statuses: isEx ? curr.filter(s => s !== st) : [...curr, st] });
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                    isEx ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-100 text-gray-600 border-gray-200'
                                  } border`}
                                >
                                  {isEx && <Icon icon="solar:close-circle-bold" className="w-3 h-3 inline mr-1" />}
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Clientes excluidos */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs">Clientes excluidos</Label>
                            <div className="flex gap-2">
                              <Button size="xs" color="failure" onClick={() => updateConfig({ excluded_client_ids: clientes.map(c => c.id) })}>
                                Excluir todos
                              </Button>
                              <Button size="xs" color="light" onClick={() => updateConfig({ excluded_client_ids: [] })}>
                                Limpiar
                              </Button>
                            </div>
                          </div>
                          <TextInput
                            placeholder="Buscar cliente..."
                            value={clienteSearch}
                            onChange={(e) => setClienteSearch(e.target.value)}
                            className="mb-2"
                          />
                          {loadingClientes ? (
                            <div className="flex items-center justify-center py-4">
                              <Spinner size="sm" />
                            </div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto border rounded-lg">
                              {clientes
                                .filter(c => {
                                  if (!clienteSearch) return true;
                                  const s = clienteSearch.toLowerCase();
                                  return getClientName(c).toLowerCase().includes(s) || getClientDocument(c).includes(s);
                                })
                                .slice(0, 30)
                                .map((c) => {
                                  const isEx = config.excluded_client_ids?.includes(c.id);
                                  return (
                                    <div
                                      key={c.id}
                                      onClick={() => {
                                        const curr = config.excluded_client_ids || [];
                                        updateConfig({ excluded_client_ids: isEx ? curr.filter(id => id !== c.id) : [...curr, c.id] });
                                      }}
                                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                                        isEx ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                      }`}
                                    >
                                      <input type="checkbox" checked={isEx} readOnly className="w-4 h-4 text-red-600 rounded pointer-events-none" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{getClientName(c)}</p>
                                        <p className="text-xs text-gray-500">{getClientDocument(c)}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Sección: Plantillas */}
                  <Collapsible open={openSections.templates} onOpenChange={() => toggleSection('templates')}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon icon="solar:document-text-bold-duotone" className="w-6 h-6 text-indigo-500" />
                          <div className="text-left">
                            <h4 className="font-medium">Plantillas de Mensaje</h4>
                            <p className="text-xs text-gray-500">Personaliza los mensajes de WhatsApp</p>
                          </div>
                        </div>
                        <Icon icon={openSections.templates ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-4 border rounded-lg space-y-4">
                        <div>
                          <Label className="text-xs">Plantilla de Vencimiento</Label>
                          <Textarea
                            value={config.expiration_template || policyNotificationService.getDefaultTemplate('expiration')}
                            onChange={(e) => updateConfig({ expiration_template: e.target.value })}
                            rows={3}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Plantilla de Renovación</Label>
                          <Textarea
                            value={config.renewal_template || policyNotificationService.getDefaultTemplate('renewal')}
                            onChange={(e) => updateConfig({ renewal_template: e.target.value })}
                            rows={3}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Plantilla de Pago</Label>
                          <Textarea
                            value={config.payment_template || policyNotificationService.getDefaultTemplate('payment_due')}
                            onChange={(e) => updateConfig({ payment_template: e.target.value })}
                            rows={3}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <Alert color="info">
                          <p className="text-xs">Variables: {'{{client_name}}'}, {'{{policy_number}}'}, {'{{end_date}}'}, {'{{days_until}}'}, {'{{insurance_company}}'}</p>
                        </Alert>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {/* TAB: Historial */}
              {activeTab === 'history' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Icon icon="solar:history-bold-duotone" className="w-5 h-5 text-gray-500" />
                      Historial de Envíos
                    </h4>
                    <Button size="xs" color="light" onClick={loadLogs} disabled={loadingLogs}>
                      <Icon icon="solar:refresh-bold" className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>

                  {loadingLogs ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner size="sm" />
                      <span className="ml-2 text-sm text-gray-500">Cargando historial...</span>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <Icon icon="solar:inbox-line-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay registros de envíos</p>
                      <p className="text-xs text-gray-400 mt-1">Los envíos aparecerán aquí cuando se ejecuten</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <Table.Head>
                          <Table.HeadCell>Fecha</Table.HeadCell>
                          <Table.HeadCell>Póliza</Table.HeadCell>
                          <Table.HeadCell>Cliente</Table.HeadCell>
                          <Table.HeadCell>Tipo</Table.HeadCell>
                          <Table.HeadCell>Estado</Table.HeadCell>
                          <Table.HeadCell>Teléfono</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                          {logs.map((log: any) => (
                            <Table.Row key={log.id}>
                              <Table.Cell className="text-xs">{formatDateTime(log.sent_at || log.created_at)}</Table.Cell>
                              <Table.Cell className="font-medium text-sm">{log.policy_number || '-'}</Table.Cell>
                              <Table.Cell className="text-sm">{log.client_name || '-'}</Table.Cell>
                              <Table.Cell>
                                <Badge color="info" size="xs">
                                  {log.notification_type === 'expiration' ? 'Vencimiento' :
                                   log.notification_type === 'renewal' ? 'Renovación' : 'Pago'}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>
                                <div className="flex flex-col gap-1">
                                  <Badge color={log.status === 'sent' ? 'success' : log.status === 'failed' ? 'failure' : 'warning'} size="xs">
                                    {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Fallido' : 'Omitido'}
                                  </Badge>
                                  {log.error_message && log.status !== 'sent' && (
                                    <span className="text-xs text-red-500">{translateError(log.error_message)}</span>
                                  )}
                                </div>
                              </Table.Cell>
                              <Table.Cell className="text-xs text-gray-500">{log.phone_number || '-'}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="border-t">
        <div className="flex justify-between w-full">
          <Button color="light" onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
          <Button color="blue" onClick={handleSave} disabled={saving || !config}>
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Icon icon="solar:diskette-bold" className="w-4 h-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default PolicyNotificationsModalV2;
