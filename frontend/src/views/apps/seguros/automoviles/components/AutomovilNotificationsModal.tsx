import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Spinner, Badge, Alert, Table, TextInput } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Switch } from '@headlessui/react';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
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
import automovilNotificationService, {
  AutomovilNotificationConfig,
  AutomovilNotificationLog,
  ScheduledAutomovilNotification,
} from 'src/services/automovilNotificationService';
import { useToast } from 'src/hooks/use-toast';
import api from 'src/config/api';
import whatsappInstanceService from 'src/services/whatsappInstanceService';
import { useWhatsAppSocket } from 'src/hooks/useWhatsAppSocket';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'dashboard' | 'config' | 'history';

// Editor de recordatorios (chips editables: 30, 8, 3, 1...)
const DaysReminderEditor: React.FC<{
  label: string;
  colorClass: string;
  days: number[];
  onChange: (days: number[]) => void;
}> = ({ label, colorClass, days, onChange }) => {
  const [input, setInput] = useState('');

  const sortedDays = [...days].sort((a, b) => b - a);

  const addDay = () => {
    const n = parseInt(input.trim(), 10);
    if (isNaN(n) || n < 0 || n > 365) return;
    if (days.includes(n)) {
      setInput('');
      return;
    }
    onChange([...days, n].sort((a, b) => b - a));
    setInput('');
  };

  const removeDay = (n: number) => {
    onChange(days.filter((d) => d !== n));
  };

  return (
    <div>
      <Label className="text-xs text-gray-600 dark:text-gray-300">{label}</Label>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        {sortedDays.map((d) => (
          <span
            key={d}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white ${colorClass}`}
          >
            {d} días
            <button
              type="button"
              onClick={() => removeDay(d)}
              className="ml-1 rounded-full hover:bg-white/20 p-0.5"
              aria-label={`Eliminar ${d} días`}
            >
              <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={365}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDay();
              }
            }}
            placeholder="ej. 8"
            className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
          />
          <Button size="xs" color="light" onClick={addDay} disabled={!input.trim()}>
            <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-1" /> Añadir
          </Button>
        </div>
      </div>
      {sortedDays.length === 0 && (
        <p className="text-xs text-red-500 mt-1">Añade al menos un recordatorio.</p>
      )}
      <p className="text-[11px] text-gray-500 mt-2">
        Se enviará un recordatorio por cada valor (ej: 30, 8, 3, 1 → 4 envíos por vehículo).
      </p>
    </div>
  );
};

const AutomovilNotificationsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  
  // Estados principales
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [config, setConfig] = useState<AutomovilNotificationConfig | null>(null);
  
  // Estados de datos
  const [whatsappInstances, setWhatsappInstances] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [automoviles, setAutomoviles] = useState<any[]>([]);
  const [clasesVehiculo, setClasesVehiculo] = useState<any[]>([]);
  const [logs, setLogs] = useState<AutomovilNotificationLog[]>([]);
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledAutomovilNotification[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  // Estados de UI
  const [clienteSearch, setClienteSearch] = useState('');
  const [automovilSearch, setAutomovilSearch] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [openSections, setOpenSections] = useState({
    notifications: true,
    schedule: true,
    recipients: true,
    exclusions: false,
    templates: true,
  });
  
  // Loading states
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingAutomoviles, setLoadingAutomoviles] = useState(false);
  const [loadingClasesVehiculo, setLoadingClasesVehiculo] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // WebSocket para estado de WhatsApp
  const { connectionStatus } = useWhatsAppSocket();

  // Cargar configuración inicial
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await automovilNotificationService.getConfig();
      if (data) {
        setConfig(data);
      } else {
        // Crear configuración por defecto
        const defaultConfig: AutomovilNotificationConfig = {
          broker_id: 1, // TODO: obtener del contexto del broker
          whatsapp_instance_id: null,
          notify_soat: true,
          notify_tecnomecanica: true,
          soat_days_before: 30,
          tecnomecanica_days_before: 30,
          send_time: '09:00:00',
          send_days: [1, 2, 3, 4, 5],
          max_notifications_per_day: 50,
          excluded_client_ids: [],
          excluded_automovil_ids: [],
          excluded_clase_vehiculo_ids: [],
          soat_template_id: null,
          tecnomecanica_template_id: null,
          active: true,
        };
        const saved = await automovilNotificationService.updateConfig(defaultConfig);
        setConfig(saved);
      }
    } catch (error: any) {
      console.error('Error loading config:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo cargar la configuración', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Cargar instancias de WhatsApp
  const loadWhatsAppInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      const response = await whatsappInstanceService.getInstances();
      setWhatsappInstances(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Error loading WhatsApp instances:', error);
    } finally {
      setLoadingInstances(false);
    }
  }, []);

  // Cargar clientes
  const loadClientes = useCallback(async () => {
    try {
      setLoadingClientes(true);
      const response = await api.get('/clientes?limit=100');
      setClientes(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      console.error('Error loading clientes:', error);
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  // Cargar automóviles
  const loadAutomoviles = useCallback(async () => {
    try {
      setLoadingAutomoviles(true);
      const response = await api.get('/automoviles?limit=100');
      setAutomoviles(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      console.error('Error loading automoviles:', error);
    } finally {
      setLoadingAutomoviles(false);
    }
  }, []);

  // Cargar clases de vehículo
  const loadClasesVehiculo = useCallback(async () => {
    try {
      setLoadingClasesVehiculo(true);
      const response = await api.get('/clases-vehiculo');
      setClasesVehiculo(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      console.error('Error loading clases vehiculo:', error);
    } finally {
      setLoadingClasesVehiculo(false);
    }
  }, []);

  // Cargar logs
  const loadLogs = useCallback(async (page = 1) => {
    try {
      setLoadingLogs(true);
      const data = await automovilNotificationService.getLogs({ page, limit: 20 });
      setLogs(Array.isArray(data?.data) ? data.data : []);
      setLogsTotal(data.total);
      setLogsPage(data.page);
    } catch (error: any) {
      console.error('Error loading logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // Cargar notificaciones programadas
  const loadScheduledNotifications = useCallback(async () => {
    try {
      setLoadingScheduled(true);
      const data = await automovilNotificationService.getScheduledNotifications();
      setScheduledNotifications(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error loading scheduled notifications:', error);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  // Cargar plantillas — pasa la instancia seleccionada (en memoria, antes de guardar)
  const loadWhatsAppTemplates = useCallback(async (instanceId?: number | null) => {
    try {
      setLoadingTemplates(true);
      const data = await automovilNotificationService.getWhatsAppTemplates(instanceId ?? null);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Toggle sections
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
      } else if (activeTab === 'config') {
        if (openSections.exclusions) {
          loadClientes();
          loadAutomoviles();
          loadClasesVehiculo();
        }
        // Recargar plantillas cuando cambia la instancia de WhatsApp seleccionada
        if (openSections.templates) loadWhatsAppTemplates(config?.whatsapp_instance_id);
      }
    }
  }, [isOpen, config, activeTab, openSections.exclusions, openSections.templates, config?.whatsapp_instance_id, loadScheduledNotifications, loadLogs, loadClientes, loadAutomoviles, loadClasesVehiculo, loadWhatsAppTemplates]);

  const updateConfig = (updates: Partial<AutomovilNotificationConfig>) => {
    if (config) {
      setConfig({ ...config, ...updates });
    }
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const data = await automovilNotificationService.updateConfig(config);
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

  const handleSkipNotification = async (automovilId: number, notificationType: string) => {
    try {
      await automovilNotificationService.skipNotification(automovilId, notificationType);
      toast({ title: 'Omitido', description: 'Notificación omitida correctamente' });
      loadScheduledNotifications();
    } catch (error: any) {
      console.error('Error omitiendo:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo omitir', variant: 'destructive' });
    }
  };

  const getClientName = (cliente: any) => {
    return cliente.nombre || `${cliente.nombres} ${cliente.apellidos}` || 'Sin nombre';
  };

  const getClientDocument = (cliente: any) => {
    return cliente.documento || cliente.numero_documento || '';
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Indicador simple: chulo verde si fue leído, chulo gris si no.
  // Tooltip nativo (atributo title) para evitar conflictos de portales que crashean el modal.
  const DeliveryStatus = ({ log }: { log: any }) => {
    const wasRead = !!log.read_at;
    const tooltipLines: string[] = [];
    if (log.read_at) tooltipLines.push(`Leído: ${formatDateTime(log.read_at)}`);
    if (log.delivered_at) tooltipLines.push(`Entregado: ${formatDateTime(log.delivered_at)}`);
    if (log.sent_at) tooltipLines.push(`Enviado: ${formatDateTime(log.sent_at)}`);
    if (log.status === 'failed' || log.delivery_failed_at) {
      tooltipLines.push(`Falló entrega: ${log.delivery_error || log.error_message || ''}`.trim());
    }
    if (!tooltipLines.length) tooltipLines.push('Sin entrega aún');
    return (
      <span
        title={tooltipLines.join('\n')}
        className={`inline-flex items-center cursor-help ${wasRead ? 'text-green-500' : 'text-gray-400'}`}
      >
        <Icon icon="solar:check-read-bold" className="w-5 h-5" />
      </span>
    );
  };

  const getAutomovilName = (automovil: any) => {
    return `${automovil.placa} - ${automovil.marca} ${automovil.linea} ${automovil.modelo}`;
  };

  if (!isOpen) return null;

  return (
    <Modal
      show={isOpen}
      onClose={onClose}
      size="7xl"
      position="center"
    >
      <Modal.Header>
        <div className="flex items-center gap-3">
          <Icon icon="solar:car-bold-duotone" className="w-6 h-6 text-blue-500" />
          <div>
            <h3 className="text-lg font-semibold">Notificaciones Automáticas de Automóviles</h3>
            <p className="text-sm text-gray-500">Configura recordatorios de vencimiento de SOAT y Técnico Mecánica</p>
          </div>
        </div>
      </Modal.Header>
      
      <Modal.Body>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="ml-3">Cargando configuración...</span>
          </div>
        ) : config ? (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: 'solar:dashboard-bold-duotone' },
                  { id: 'config', label: 'Configuración', icon: 'solar:settings-bold-duotone' },
                  { id: 'history', label: 'Historial', icon: 'solar:clock-circle-bold-duotone' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon icon={tab.icon} className="w-4 h-4" />
                      {tab.label}
                    </div>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab: Dashboard */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <Icon icon="solar:calendar-bold-duotone" className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{scheduledNotifications.length}</p>
                        <p className="text-sm text-gray-500">Próximas notificaciones</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{config.stats?.total_sent || 0}</p>
                        <p className="text-sm text-gray-500">Enviadas exitosas</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                        <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{config.stats?.total_failed || 0}</p>
                        <p className="text-sm text-gray-500">Fallidos</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                        <Icon icon="solar:danger-triangle-bold-duotone" className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{config.stats?.total_skipped || 0}</p>
                        <p className="text-sm text-gray-500">Omitidas</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Próximas Notificaciones */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold">Próximas Notificaciones</h4>
                    <p className="text-sm text-gray-500">Vehículos con vencimientos próximos</p>
                  </div>
                  <div className="overflow-x-auto">
                    {loadingScheduled ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner />
                      </div>
                    ) : scheduledNotifications.length > 0 ? (
                      <Table>
                        <Table.Head>
                          <Table.HeadCell>Vehículo</Table.HeadCell>
                          <Table.HeadCell>Cliente</Table.HeadCell>
                          <Table.HeadCell>Tipo</Table.HeadCell>
                          <Table.HeadCell>Fecha</Table.HeadCell>
                          <Table.HeadCell>Días</Table.HeadCell>
                          <Table.HeadCell>Acciones</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                          {scheduledNotifications.map((notif) => (
                            <Table.Row key={`${notif.automovil_id}-${notif.notification_type}`}>
                              <Table.Cell>
                                <div>
                                  <p className="font-medium">{getAutomovilName(notif)}</p>
                                  <p className="text-sm text-gray-500">{notif.placa}</p>
                                </div>
                              </Table.Cell>
                              <Table.Cell>
                                {notif.cliente && (
                                  <div>
                                    <p className="font-medium">{getClientName(notif.cliente)}</p>
                                    <p className="text-sm text-gray-500">{getClientDocument(notif.cliente)}</p>
                                  </div>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <Badge
                                  color={notif.notification_type === 'soat' ? 'blue' : 'purple'}
                                  className="capitalize"
                                >
                                  {notif.notification_type === 'soat' ? 'SOAT' : 'Técnico Mecánica'}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>
                                {notif.scheduled_date ? new Date(notif.scheduled_date).toLocaleString('es-CO', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                }) : '-'}
                              </Table.Cell>
                              <Table.Cell>
                                <Badge
                                  color={notif.days_until <= 7 ? 'red' : notif.days_until <= 15 ? 'yellow' : 'green'}
                                >
                                  {notif.days_until} días
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>
                                <Button
                                  size="xs"
                                  color="light"
                                  onClick={() => handleSkipNotification(notif.automovil_id, notif.notification_type)}
                                >
                                  Omitir
                                </Button>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No hay notificaciones programadas
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Configuración */}
            {activeTab === 'config' && (
              <div className="space-y-4">
                {/* Master Activo / Inactivo */}
                <div className={`p-4 rounded-lg border-2 transition-colors ${config.active ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon icon={config.active ? 'solar:bell-bing-bold-duotone' : 'solar:bell-off-bold-duotone'} className={`w-6 h-6 ${config.active ? 'text-green-600' : 'text-amber-600'}`} />
                      <div>
                        <p className="font-semibold text-sm">{config.active ? 'Notificaciones activas' : 'Notificaciones desactivadas'}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {config.active
                            ? 'El cron procesará SOAT y RTM según los días configurados.'
                            : 'Activa este toggle para que el sistema empiece a programar y enviar.'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={!!config.active}
                      onChange={(checked) => updateConfig({ active: checked })}
                      className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-green-500"
                    >
                      <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                    </Switch>
                  </div>
                </div>

                {/* WhatsApp Instance */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <Label className="text-sm font-medium">Instancia de WhatsApp</Label>
                  <div className="mt-2">
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
                </div>

                {/* Tipos de Notificación */}
                <Collapsible open={openSections.notifications} onOpenChange={() => toggleSection('notifications')}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Icon icon="solar:bell-bold-duotone" className="w-6 h-6 text-orange-500" />
                        <div className="text-left">
                          <h4 className="font-medium">Tipos de Notificación</h4>
                          <p className="text-xs text-gray-500">SOAT y Técnico Mecánica</p>
                        </div>
                      </div>
                      <Icon icon={openSections.notifications ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
                      {/* SOAT */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:document-bold-duotone" className="w-5 h-5 text-blue-500" />
                            <div>
                              <p className="font-medium text-sm">Vencimiento de SOAT</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Recordatorios antes del vencimiento</p>
                            </div>
                          </div>
                          <Switch
                            checked={config.notify_soat}
                            onChange={(checked) => updateConfig({ notify_soat: checked })}
                            className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-blue-500"
                          >
                            <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                          </Switch>
                        </div>
                        {config.notify_soat && (
                          <div className="mt-3 pl-8">
                            <DaysReminderEditor
                              label="Días antes del vencimiento"
                              colorClass="bg-blue-500"
                              days={config.soat_days_before_multiple ?? [config.soat_days_before ?? 30]}
                              onChange={(days) => updateConfig({
                                soat_days_before_multiple: days,
                                soat_days_before: days[0] ?? 30,
                              })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Técnico Mecánica */}
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:wrench-bold-duotone" className="w-5 h-5 text-purple-500" />
                            <div>
                              <p className="font-medium text-sm">Vencimiento Técnico Mecánica</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Recordatorios antes del vencimiento</p>
                            </div>
                          </div>
                          <Switch
                            checked={config.notify_tecnomecanica}
                            onChange={(checked) => updateConfig({ notify_tecnomecanica: checked })}
                            className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-purple-500"
                          >
                            <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                          </Switch>
                        </div>
                        {config.notify_tecnomecanica && (
                          <div className="mt-3 pl-8">
                            <DaysReminderEditor
                              label="Días antes del vencimiento"
                              colorClass="bg-purple-500"
                              days={config.tecnomecanica_days_before_multiple ?? [config.tecnomecanica_days_before ?? 30]}
                              onChange={(days) => updateConfig({
                                tecnomecanica_days_before_multiple: days,
                                tecnomecanica_days_before: days[0] ?? 30,
                              })}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Exclusiones */}
                <Collapsible open={openSections.exclusions} onOpenChange={() => toggleSection('exclusions')}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Icon icon="solar:shield-cross-bold-duotone" className="w-6 h-6 text-red-500" />
                        <div className="text-left">
                          <h4 className="font-medium">Exclusiones</h4>
                          <p className="text-xs text-gray-500">{config.excluded_client_ids?.length || 0} clientes, {config.excluded_automovil_ids?.length || 0} vehículos excluidos</p>
                        </div>
                      </div>
                      <Icon icon={openSections.exclusions ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
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

                      {/* Vehículos excluidos */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs">Vehículos excluidos</Label>
                          <div className="flex gap-2">
                            <Button size="xs" color="failure" onClick={() => updateConfig({ excluded_automovil_ids: automoviles.map(a => a.id) })}>
                              Excluir todos
                            </Button>
                            <Button size="xs" color="light" onClick={() => updateConfig({ excluded_automovil_ids: [] })}>
                              Limpiar
                            </Button>
                          </div>
                        </div>
                        <TextInput
                          placeholder="Buscar vehículo..."
                          value={automovilSearch}
                          onChange={(e) => setAutomovilSearch(e.target.value)}
                          className="mb-2"
                        />
                        {loadingAutomoviles ? (
                          <div className="flex items-center justify-center py-4">
                            <Spinner size="sm" />
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto border rounded-lg">
                            {automoviles
                              .filter(a => {
                                if (!automovilSearch) return true;
                                const s = automovilSearch.toLowerCase();
                                return getAutomovilName(a).toLowerCase().includes(s) || a.placa.toLowerCase().includes(s);
                              })
                              .slice(0, 30)
                              .map((a) => {
                                const isEx = config.excluded_automovil_ids?.includes(a.id);
                                return (
                                  <div
                                    key={a.id}
                                    onClick={() => {
                                      const curr = config.excluded_automovil_ids || [];
                                      updateConfig({ excluded_automovil_ids: isEx ? curr.filter(id => id !== a.id) : [...curr, a.id] });
                                    }}
                                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                                      isEx ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                  >
                                    <input type="checkbox" checked={isEx} readOnly className="w-4 h-4 text-red-600 rounded pointer-events-none" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{getAutomovilName(a)}</p>
                                      <p className="text-xs text-gray-500">{a.placa}</p>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Clases de vehículo excluidas */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs">Clases de vehículo excluidas</Label>
                          <div className="flex gap-2">
                            <Button size="xs" color="failure" onClick={() => updateConfig({ excluded_clase_vehiculo_ids: clasesVehiculo.map(c => c.id) })}>
                              Excluir todas
                            </Button>
                            <Button size="xs" color="light" onClick={() => updateConfig({ excluded_clase_vehiculo_ids: [] })}>
                              Limpiar
                            </Button>
                          </div>
                        </div>
                        {loadingClasesVehiculo ? (
                          <div className="flex items-center justify-center py-4">
                            <Spinner size="sm" />
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto border rounded-lg">
                            {clasesVehiculo.map((clase) => {
                              const isEx = config.excluded_clase_vehiculo_ids?.includes(clase.id);
                              return (
                                <div
                                  key={clase.id}
                                  onClick={() => {
                                    const curr = config.excluded_clase_vehiculo_ids || [];
                                    updateConfig({ excluded_clase_vehiculo_ids: isEx ? curr.filter(id => id !== clase.id) : [...curr, clase.id] });
                                  }}
                                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                                    isEx ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <input type="checkbox" checked={isEx} readOnly className="w-4 h-4 text-red-600 rounded pointer-events-none" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{clase.nombre}</p>
                                    <p className="text-xs text-gray-500">{clase.codigo}</p>
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

                {/* Horario */}
                <Collapsible open={openSections.schedule} onOpenChange={() => toggleSection('schedule')}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
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
                    <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
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

                {/* Plantillas */}
                <Collapsible open={openSections.templates} onOpenChange={() => toggleSection('templates')}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Icon icon="solar:document-text-bold-duotone" className="w-6 h-6 text-indigo-500" />
                        <div className="text-left">
                          <h4 className="font-medium">Plantillas de WhatsApp</h4>
                          <p className="text-xs text-gray-500">Selecciona plantillas para cada notificación</p>
                        </div>
                      </div>
                      <Icon icon={openSections.templates ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
                      {loadingTemplates && (
                        <div className="flex items-center justify-center py-4">
                          <Spinner size="sm" />
                        </div>
                      )}
                      
                      {!loadingTemplates && templates.length === 0 && !config.whatsapp_instance_id && (
                        <Alert color="warning" className="text-xs">
                          Primero selecciona una <strong>instancia de WhatsApp</strong> en la sección "WhatsApp" de arriba para poder ver las plantillas disponibles.
                        </Alert>
                      )}

                      {!loadingTemplates && templates.length === 0 && config.whatsapp_instance_id && (
                        <Alert color="warning" className="text-xs">
                          No se encontraron plantillas aprobadas en la instancia de WhatsApp seleccionada.
                          Asegúrate de tener plantillas con estado <strong>APPROVED</strong> en Meta Business Manager.
                        </Alert>
                      )}

                      {/* Guía de variables a usar al crear la plantilla en Meta */}
                      <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 p-3 space-y-2">
                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                          📌 Variables disponibles en la plantilla
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <code className="px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-blue-200 dark:border-blue-800 font-mono text-blue-700 dark:text-blue-300">{'{{1}}'}</code>
                            <span className="text-gray-700 dark:text-neutral-300">Nombre cliente</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code className="px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-blue-200 dark:border-blue-800 font-mono text-blue-700 dark:text-blue-300">{'{{2}}'}</code>
                            <span className="text-gray-700 dark:text-neutral-300">Placa</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code className="px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-blue-200 dark:border-blue-800 font-mono text-blue-700 dark:text-blue-300">{'{{3}}'}</code>
                            <span className="text-gray-700 dark:text-neutral-300">Fecha vencimiento</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                          Crea la plantilla en Meta Business Manager con esas tres variables en el cuerpo, en ese orden. Ejemplos abajo.
                        </p>
                      </div>

                      {/* Ejemplos de plantilla */}
                      <details className="rounded-lg border border-gray-200 dark:border-neutral-800 group">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-700 dark:text-neutral-300 select-none hover:bg-gray-50 dark:hover:bg-neutral-900/50 rounded-lg">
                          Ver ejemplos de plantilla SOAT y Técnico Mecánica
                        </summary>
                        <div className="px-3 py-3 space-y-3 border-t border-gray-200 dark:border-neutral-800">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-600 dark:text-neutral-400 mb-1">Ejemplo SOAT</p>
                            <pre className="text-[11px] whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/60 p-2 rounded font-sans text-gray-800 dark:text-neutral-200">
{`¡Cordial saludo! 😊 {{1}},

En *Seguros Celeste* queremos que siempre estés protegido 💚💙

Te recordamos que tu *SOAT del vehículo con placa {{2}}* está próximo a vencer:

📅 *Fecha de vencimiento:* {{3}}

Evita sanciones y contratiempos renovándolo a tiempo, y sigue circulando con total tranquilidad y respaldo. 🚗✨

Si deseas, podemos ayudarte con la renovación de forma rápida y sencilla.

¡Estamos para acompañarte! 🤝`}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-600 dark:text-neutral-400 mb-1">Ejemplo Técnico Mecánica</p>
                            <pre className="text-[11px] whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/60 p-2 rounded font-sans text-gray-800 dark:text-neutral-200">
{`¡Cordial saludo! 😊 {{1}},

¡Seguros Celeste, más que un seguro, es Tranquilidad! 💚💙

Desde SEGUROS CELESTE queremos recordarte que la revisión tecnicomecánica de tu vehículo, Placa {{2}}, está próxima a vencerse. 🚗🔧

Fecha de vencimiento: {{3}}

Recuerda realizarla a tiempo para evitar inconvenientes y circular con total seguridad.

¡Estamos para acompañarte! ✨`}
                            </pre>
                          </div>
                        </div>
                      </details>

                      {/* Plantilla SOAT */}
                      <div>
                        <Label className="text-sm font-medium">Plantilla para SOAT</Label>
                        <Select
                          value={config.soat_template || 'none'}
                          onValueChange={(value) => updateConfig({ soat_template: value === 'none' ? null : value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecciona una plantilla" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin plantilla</SelectItem>
                            {templates.map((template: any) => (
                              <SelectItem key={template.name} value={template.name}>
                                {template.name}
                                {template.language ? ` (${template.language})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Plantilla Técnico Mecánica */}
                      <div>
                        <Label className="text-sm font-medium">Plantilla para Técnico Mecánica</Label>
                        <Select
                          value={config.tecnomecanica_template || 'none'}
                          onValueChange={(value) => updateConfig({ tecnomecanica_template: value === 'none' ? null : value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecciona una plantilla" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin plantilla</SelectItem>
                            {templates.map((template: any) => (
                              <SelectItem key={template.name} value={template.name}>
                                {template.name}
                                {template.language ? ` (${template.language})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Botón de guardar */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    color="primary"
                  >
                    {saving ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
                        Guardar Configuración
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Tab: Historial */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold">Historial de Notificaciones</h4>
                    <p className="text-sm text-gray-500">Registro de todas las notificaciones enviadas</p>
                  </div>
                  <div className="overflow-x-auto">
                    {loadingLogs ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner />
                      </div>
                    ) : logs.length > 0 ? (
                      <Table>
                        <Table.Head>
                          <Table.HeadCell>Fecha</Table.HeadCell>
                          <Table.HeadCell>Vehículo</Table.HeadCell>
                          <Table.HeadCell>Cliente</Table.HeadCell>
                          <Table.HeadCell>Tipo</Table.HeadCell>
                          <Table.HeadCell>Estado</Table.HeadCell>
                          <Table.HeadCell>Entrega</Table.HeadCell>
                          <Table.HeadCell>Error</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                          {logs.map((log) => (
                            <Table.Row key={log.id}>
                              <Table.Cell>
                                {new Date(log.created_at).toLocaleString('es-CO')}
                              </Table.Cell>
                              <Table.Cell>
                                {(log.placa || log.vehiculo) ? (
                                  <div>
                                    <p className="font-medium">{log.placa || '-'}</p>
                                    {log.vehiculo && log.vehiculo !== '-' && (
                                      <p className="text-sm text-gray-500">{log.vehiculo}</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                {log.client_name && log.client_name !== '-' ? (
                                  <p className="font-medium">{log.client_name}</p>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                                {log.recipient_phone && (
                                  <p className="text-xs text-gray-500 font-mono">{log.recipient_phone}</p>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <Badge
                                  color={log.notification_type === 'soat' ? 'blue' : 'purple'}
                                  className="capitalize"
                                >
                                  {log.notification_type === 'soat' ? 'SOAT' : 'Técnico Mecánica'}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>
                                <Badge
                                  color={
                                    log.status === 'sent' ? 'success' :
                                    log.status === 'failed' ? 'failure' :
                                    log.status === 'skipped' ? 'warning' : 'gray'
                                  }
                                >
                                  {log.status === 'sent' ? 'Enviado' :
                                   log.status === 'failed' ? 'Fallido' :
                                   log.status === 'skipped' ? 'Omitido' : 'Pendiente'}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>
                                <DeliveryStatus log={log} />
                              </Table.Cell>
                              <Table.Cell>
                                {log.error_message && (
                                  <span title={log.error_message} className="cursor-help inline-flex">
                                    <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 text-red-500" />
                                  </span>
                                )}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No hay registros de notificaciones
                      </div>
                    )}
                  </div>
                  
                  {/* Pagination */}
                  {logsTotal > 20 && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Mostrando {((logsPage - 1) * 20) + 1} a {Math.min(logsPage * 20, logsTotal)} de {logsTotal} registros
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="xs"
                            color="light"
                            onClick={() => loadLogs(logsPage - 1)}
                            disabled={logsPage <= 1}
                          >
                            Anterior
                          </Button>
                          <Button
                            size="xs"
                            color="light"
                            onClick={() => loadLogs(logsPage + 1)}
                            disabled={logsPage * 20 >= logsTotal}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Icon icon="solar:danger-triangle-bold" className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-500">No se pudo cargar la configuración</p>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default AutomovilNotificationsModal;
