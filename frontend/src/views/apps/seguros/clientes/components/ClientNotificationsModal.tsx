import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Spinner, Badge, Alert, Table } from 'flowbite-react';
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
import { useToast } from 'src/hooks/use-toast';
import api from 'src/config/api';
import whatsappInstanceService from 'src/services/whatsappInstanceService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ClientNotifConfig {
  id: number;
  broker_id: number;
  whatsapp_instance_id: number | null;
  is_active: boolean;
  notify_birthday: boolean;
  notify_workers_day: boolean;
  notify_womens_day: boolean;
  notify_mens_day: boolean;
  notify_advisor_day: boolean;
  birthday_template: string;
  workers_day_template: string;
  womens_day_template: string;
  mens_day_template: string;
  advisor_day_template: string;
  workers_day_date: string;
  womens_day_date: string;
  mens_day_date: string;
  advisor_day_date: string;
  send_time: string;
  max_notifications_per_day: number;
  send_to_client_phone: boolean;
  send_to_client_mobile: boolean;
  excluded_client_ids: number[];
  whatsapp_status?: { connected: boolean; status: string; phone_number?: string } | null;
  stats?: { total_sent: number; total_failed: number; last_execution?: string };
  special_dates_info?: Record<string, { name: string; default_date: string }>;
}

interface WaTemplate {
  name: string;
  status: string;
  category: string;
  language: string;
  body_text: string;
  param_count: number;
}

type TabType = 'dashboard' | 'config' | 'history';

const NOTIFICATION_TYPES = [
  { key: 'birthday', label: 'Cumpleaños', icon: 'solar:cake-bold', color: 'text-pink-500', bgColor: 'bg-pink-50 dark:bg-pink-900/20', templateKey: 'birthday_template', desc: 'Felicitación automática el día del cumpleaños del cliente', dateEditable: false },
  { key: 'workers_day', label: 'Día del Trabajador', icon: 'solar:case-round-bold', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', templateKey: 'workers_day_template', dateKey: 'workers_day_date', desc: 'Felicitación por el día del trabajador', dateEditable: true },
  { key: 'womens_day', label: 'Día de la Mujer', icon: 'solar:women-bold', color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-900/20', templateKey: 'womens_day_template', dateKey: 'womens_day_date', desc: 'Felicitación por el día de la mujer (solo clientas)', dateEditable: true },
  { key: 'mens_day', label: 'Día del Hombre', icon: 'solar:men-bold', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20', templateKey: 'mens_day_template', dateKey: 'mens_day_date', desc: 'Felicitación por el día del hombre (solo clientes)', dateEditable: true },
  { key: 'advisor_day', label: 'Día del Asesor', icon: 'solar:shield-user-bold', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', templateKey: 'advisor_day_template', dateKey: 'advisor_day_date', desc: 'Felicitación por el día del asesor de seguros', dateEditable: true },
];

const ClientNotificationsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [config, setConfig] = useState<ClientNotifConfig | null>(null);

  const [whatsappInstances, setWhatsappInstances] = useState<any[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [creatingTemplateFor, setCreatingTemplateFor] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [submittingTemplate, setSubmittingTemplate] = useState(false);

  const [openSections, setOpenSections] = useState({
    types: true,
    templates: false,
    schedule: false,
  });

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/saas/client-notifications/config');
      if (res.data?.success && res.data?.data) {
        setConfig(res.data.data);
      }
    } catch (error) {
      console.error('Error cargando config:', error);
      toast({ title: 'Error', description: 'No se pudo cargar la configuración', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      const res = await whatsappInstanceService.getInstances();
      if (res.success && res.data) setWhatsappInstances(res.data);
    } catch (error) {
      console.error('Error cargando instancias:', error);
    } finally {
      setLoadingInstances(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const res = await api.get('/saas/client-notifications/whatsapp-templates');
      if (res.data?.success && res.data?.data) setWaTemplates(res.data.data);
    } catch (error) {
      console.error('Error cargando plantillas:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const loadScheduled = useCallback(async () => {
    try {
      setLoadingScheduled(true);
      const res = await api.get('/saas/client-notifications/scheduled');
      if (res.data?.success && res.data?.data) setScheduledNotifications(res.data.data);
    } catch (error) {
      console.error('Error cargando próximos envíos:', error);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const res = await api.get('/saas/client-notifications/logs', { params: { limit: 50 } });
      if (res.data?.success && res.data?.data) setLogs(res.data.data);
    } catch (error) {
      console.error('Error cargando logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadInstances();
    }
  }, [isOpen, loadConfig, loadInstances]);

  useEffect(() => {
    if (isOpen && config) {
      if (activeTab === 'dashboard') loadScheduled();
      if (activeTab === 'history') loadLogs();
      if (activeTab === 'config' && openSections.templates) loadTemplates();
    }
  }, [isOpen, config, activeTab, openSections.templates, loadScheduled, loadLogs, loadTemplates]);

  const updateConfig = (updates: Partial<ClientNotifConfig>) => {
    if (config) setConfig({ ...config, ...updates });
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const res = await api.put('/saas/client-notifications/config', config);
      if (res.data?.success && res.data?.data) {
        toast({ title: 'Guardado', description: 'Configuración actualizada' });
        setConfig(res.data.data);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCreateTemplate = (templateKey: string, exampleBody: string) => {
    if (creatingTemplateFor === templateKey) {
      setCreatingTemplateFor(null);
      setNewTemplateName('');
      setNewTemplateBody('');
      return;
    }
    const suffix = templateKey.replace('_template', '');
    setNewTemplateName(`guro_${suffix}_${Date.now().toString(36)}`);
    setNewTemplateBody(exampleBody);
    setCreatingTemplateFor(templateKey);
  };

  const submitNewTemplate = async (templateKey: string) => {
    if (!newTemplateName || !newTemplateBody || !config?.whatsapp_instance_id) return;
    try {
      setSubmittingTemplate(true);
      const instance = whatsappInstances.find(i => i.id === config.whatsapp_instance_id);
      if (!instance) throw new Error('No hay instancia seleccionada');

      const res = await api.post('/saas/whatsapp-inbox/templates', {
        instance_id: instance.id,
        name: newTemplateName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category: 'UTILITY',
        language: 'es',
        body: newTemplateBody,
        example_body_params: ['Juan Pérez'],
      });

      if (res.data?.success || res.data?.data) {
        toast({ title: 'Plantilla enviada', description: 'Se envió a Meta para aprobación. Puede tomar minutos o hasta 24 horas.' });
        updateConfig({ [templateKey]: newTemplateName.toLowerCase().replace(/[^a-z0-9_]/g, '_') } as any);
        setCreatingTemplateFor(null);
        setNewTemplateName('');
        setNewTemplateBody('');
        setTimeout(() => loadTemplates(), 3000);
      } else {
        throw new Error(res.data?.error || 'Error al crear plantilla');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Error al crear';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const typeLabel = (t: string) => {
    const found = NOTIFICATION_TYPES.find(n => n.key === t);
    return found?.label || t;
  };

  if (!isOpen) return null;

  return (
    <Modal show={isOpen} onClose={onClose} size="5xl" dismissible>
      <Modal.Header className="border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Icon icon="solar:bell-bing-bold-duotone" className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Notificaciones de Clientes</h3>
            <p className="text-sm text-gray-500">Cumpleaños, fechas especiales y más</p>
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
            {/* Sidebar */}
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

                {/* Stats */}
                <div className="mt-2 pt-2 border-t space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Enviados</span>
                    <span className="font-medium text-green-600">{config.stats?.total_sent || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Fallidos</span>
                    <span className="font-medium text-red-500">{config.stats?.total_failed || 0}</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              {[
                { id: 'dashboard' as TabType, icon: 'solar:calendar-mark-bold-duotone', label: 'Próximos' },
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
              {/* TAB: Próximos Envíos */}
              {activeTab === 'dashboard' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-blue-500" />
                      Próximos Envíos
                    </h4>
                    <Button size="xs" color="light" onClick={loadScheduled} disabled={loadingScheduled}>
                      <Icon icon="solar:refresh-bold" className={`w-4 h-4 ${loadingScheduled ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>

                  {/* Stats cards */}
                  {config && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-green-700 dark:text-green-400">Enviados</span>
                        </div>
                        <p className="text-lg font-bold text-green-700 dark:text-green-300">{config.stats?.total_sent || 0}</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon icon="solar:clock-circle-bold" className="w-4 h-4 text-blue-600" />
                          <span className="text-xs text-blue-700 dark:text-blue-400">Hora de envío</span>
                        </div>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{config.send_time?.substring(0, 5) || '09:00'}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-3 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon icon="solar:calendar-bold" className="w-4 h-4 text-purple-600" />
                          <span className="text-xs text-purple-700 dark:text-purple-400">Pendientes</span>
                        </div>
                        <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{scheduledNotifications.filter(s => s.status !== 'sent').length}</p>
                      </div>
                    </div>
                  )}

                  {loadingScheduled ? (
                    <div className="flex items-center justify-center py-12">
                      <Spinner size="sm" />
                      <span className="ml-2 text-sm text-gray-500">Cargando...</span>
                    </div>
                  ) : scheduledNotifications.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <Icon icon="solar:inbox-line-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay envíos programados</p>
                      <p className="text-xs text-gray-400 mt-1">Activa las notificaciones y asegúrate de que los clientes tengan fecha de cumpleaños</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <Table.Head>
                          <Table.HeadCell>Cliente</Table.HeadCell>
                          <Table.HeadCell>Tipo</Table.HeadCell>
                          <Table.HeadCell>Fecha evento</Table.HeadCell>
                          <Table.HeadCell>Envío programado</Table.HeadCell>
                          <Table.HeadCell>Estado</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                          {scheduledNotifications.map((item: any, idx: number) => (
                            <Table.Row key={`${item.client_id || item.notification_type}-${idx}`}>
                              <Table.Cell>
                                <div className="flex items-center gap-2">
                                  {item.is_special_date ? (
                                    <Icon icon="solar:users-group-two-rounded-bold" className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <Icon icon="solar:user-bold" className="w-4 h-4 text-gray-400" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{item.client_name}</p>
                                    {item.client_phone && <p className="text-xs text-gray-400">{item.client_phone}</p>}
                                  </div>
                                </div>
                              </Table.Cell>
                              <Table.Cell>
                                <Badge color={
                                  item.notification_type === 'birthday' ? 'pink' :
                                  item.notification_type === 'womens_day' ? 'purple' :
                                  item.notification_type === 'mens_day' ? 'info' :
                                  item.notification_type === 'workers_day' ? 'warning' : 'success'
                                } size="xs">
                                  {item.is_special_date ? item.special_date_label : typeLabel(item.notification_type)}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell className="text-sm">{item.event_date}</Table.Cell>
                              <Table.Cell className="text-sm text-gray-500">{item.scheduled_send_at_human}</Table.Cell>
                              <Table.Cell>
                                {item.status === 'sent' ? (
                                  <Badge color="success" size="xs">
                                    <Icon icon="solar:check-circle-bold" className="w-3 h-3 mr-1" />
                                    Enviado
                                  </Badge>
                                ) : item.status === 'today' ? (
                                  <Badge color="warning" size="xs">
                                    <Icon icon="solar:clock-circle-bold" className="w-3 h-3 mr-1" />
                                    Hoy
                                  </Badge>
                                ) : (
                                  <Badge color="gray" size="xs">
                                    <Icon icon="solar:calendar-bold" className="w-3 h-3 mr-1" />
                                    {item.days_until}d
                                  </Badge>
                                )}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Configuración */}
              {activeTab === 'config' && (
                <div className="space-y-4">
                  {/* WhatsApp Instance */}
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
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
                        onValueChange={(v) => updateConfig({ whatsapp_instance_id: v === 'none' ? null : parseInt(v) })}
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

                  {/* Tipos de Notificación */}
                  <Collapsible open={openSections.types} onOpenChange={() => toggleSection('types')}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon icon="solar:bell-bold-duotone" className="w-6 h-6 text-pink-500" />
                          <div className="text-left">
                            <h4 className="font-medium">Tipos de Notificación</h4>
                            <p className="text-xs text-gray-500">Cumpleaños, días especiales</p>
                          </div>
                        </div>
                        <Icon icon={openSections.types ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                        {NOTIFICATION_TYPES.map((notif) => {
                          const enabledKey = `notify_${notif.key}` as keyof ClientNotifConfig;
                          const isEnabled = config[enabledKey] as boolean;
                          return (
                            <div key={notif.key}>
                              <div className={`flex items-center justify-between p-3 ${notif.bgColor} rounded-lg`}>
                                <div className="flex items-center gap-3">
                                  <Icon icon={notif.icon} className={`w-5 h-5 ${notif.color}`} />
                                  <div>
                                    <p className="font-medium text-sm">{notif.label}</p>
                                    <p className="text-xs text-gray-500">{notif.desc}</p>
                                  </div>
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  onChange={(checked) => updateConfig({ [enabledKey]: checked } as any)}
                                  className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-green-500"
                                >
                                  <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                                </Switch>
                              </div>
                              {isEnabled && notif.dateEditable && notif.dateKey && (
                                <div className="pl-8 mt-2">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs whitespace-nowrap">Fecha (MM-DD):</Label>
                                    <Input
                                      value={(config as any)[notif.dateKey] || ''}
                                      onChange={(e) => updateConfig({ [notif.dateKey!]: e.target.value } as any)}
                                      placeholder="MM-DD"
                                      className="w-24 h-7 text-sm"
                                    />
                                    <span className="text-xs text-gray-400">
                                      Ej: 05-01 = 1 de mayo
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                            <p className="text-xs text-gray-500">Selecciona plantillas aprobadas de Meta</p>
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
                            <span className="ml-2 text-sm text-gray-500">Cargando plantillas...</span>
                          </div>
                        )}

                        {(() => {
                          const exampleTemplates: Record<string, string> = {
                            birthday: '¡Feliz cumpleaños, {{1}}! 🎂 Te deseamos un excelente día lleno de bendiciones.',
                            workers_day: '¡Feliz Día del Trabajador, {{1}}! 💪 Gracias por tu esfuerzo y dedicación.',
                            womens_day: '¡Feliz Día de la Mujer, {{1}}! 🌸 Un reconocimiento especial para ti.',
                            mens_day: '¡Feliz Día del Hombre, {{1}}! 💙 Un saludo especial en tu día.',
                            advisor_day: '¡Feliz Día del Asesor, {{1}}! 🛡️ Gracias por confiar en nosotros.',
                          };
                          return NOTIFICATION_TYPES.map((notif) => {
                            const selectedName = (config as any)[notif.templateKey] || '';
                            const selectedTemplate = waTemplates.find(t => t.name === selectedName);
                            const paramMismatch = selectedTemplate && selectedTemplate.param_count !== 1;
                            const isCreating = creatingTemplateFor === notif.templateKey;
                            return (
                              <div key={notif.key} className={`p-4 rounded-xl border border-gray-200 dark:border-gray-700/50 ${notif.bgColor} space-y-3`}>
                                {/* Header + variable chip */}
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <Icon icon={notif.icon} className={`w-5 h-5 ${notif.color}`} />
                                    <span className="font-semibold text-sm">{notif.label}</span>
                                  </div>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-600 rounded text-[10px] text-gray-500 dark:text-gray-400">
                                    <code className="font-mono text-purple-600 dark:text-purple-400">{'{{1}}'}</code> Nombre cliente
                                  </span>
                                </div>

                                {/* Template selector + create button */}
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <Select
                                      value={selectedName || 'none'}
                                      onValueChange={(v) => updateConfig({ [notif.templateKey]: v === 'none' ? '' : v } as any)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona plantilla" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">— Sin plantilla —</SelectItem>
                                        {waTemplates.map((t) => (
                                          <SelectItem key={t.name} value={t.name}>
                                            <div className="flex items-center gap-2">
                                              <span>{t.name}</span>
                                              <span className={`text-xs ${t.param_count === 1 ? 'text-green-500' : 'text-red-500'}`}>
                                                ({t.param_count} var{t.param_count === 1 ? ' ✓' : ' ✗'})
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button
                                    size="sm"
                                    color={isCreating ? 'light' : 'purple'}
                                    onClick={() => {
                                      if (!config?.whatsapp_instance_id) {
                                        toast({ title: 'Instancia requerida', description: 'Selecciona una instancia de WhatsApp antes de crear plantillas', variant: 'destructive' });
                                        return;
                                      }
                                      handleCreateTemplate(notif.templateKey, exampleTemplates[notif.key] || `Hola {{1}}, un saludo especial en tu día.`);
                                    }}
                                    title={isCreating ? 'Cancelar' : 'Crear nueva plantilla'}
                                  >
                                    <Icon icon={isCreating ? 'solar:close-circle-bold' : 'solar:add-circle-bold'} className="w-4 h-4" />
                                  </Button>
                                </div>

                                {/* Selected template preview with validation */}
                                {selectedTemplate && !isCreating && (
                                  <div className={`p-2.5 rounded-lg border text-xs ${paramMismatch ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <Icon icon={paramMismatch ? 'solar:danger-triangle-bold' : 'solar:check-circle-bold'} className={`w-3.5 h-3.5 ${paramMismatch ? 'text-red-500' : 'text-green-500'}`} />
                                      <span className={`font-semibold ${paramMismatch ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        {paramMismatch ? `Necesita 1 variable, tiene ${selectedTemplate.param_count}` : 'Compatible ✓'}
                                      </span>
                                    </div>
                                    <p className="text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{selectedTemplate.body_text}</p>
                                  </div>
                                )}

                                {/* Inline template creator */}
                                {isCreating && (
                                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-purple-300 dark:border-purple-600 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300">
                                      <Icon icon="solar:pen-new-square-bold" className="w-4 h-4" />
                                      Crear plantilla para {notif.label}
                                    </div>
                                    <div>
                                      <Label className="text-xs text-gray-500 dark:text-gray-400">Nombre (solo letras minúsculas, números y _)</Label>
                                      <Input
                                        value={newTemplateName}
                                        onChange={(e) => setNewTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                        placeholder="guro_cumpleanos"
                                        className="mt-1 h-8 text-sm font-mono"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-gray-500 dark:text-gray-400">Texto del mensaje (usa {'{{1}}'} para el nombre del cliente)</Label>
                                      <Textarea
                                        value={newTemplateBody}
                                        onChange={(e) => setNewTemplateBody(e.target.value)}
                                        rows={3}
                                        className="mt-1 text-sm font-mono"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] text-gray-400">Se enviará a Meta para aprobación (minutos a 24h)</p>
                                      <Button
                                        size="xs"
                                        color="purple"
                                        onClick={() => submitNewTemplate(notif.templateKey)}
                                        disabled={submittingTemplate || !newTemplateName || !newTemplateBody}
                                      >
                                        {submittingTemplate ? <Spinner size="xs" className="mr-1" /> : <Icon icon="solar:plain-bold" className="w-3.5 h-3.5 mr-1" />}
                                        Enviar a Meta
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
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
                            <h4 className="font-medium">Horario y Destinatarios</h4>
                            <p className="text-xs text-gray-500">{config.send_time?.substring(0, 5) || '09:00'} - Máx {config.max_notifications_per_day}/día</p>
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
                              onChange={(e) => updateConfig({ max_notifications_per_day: parseInt(e.target.value) || 100 })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Enviar a:</Label>
                          {[
                            { key: 'send_to_client_phone', label: 'Teléfono principal' },
                            { key: 'send_to_client_mobile', label: 'Teléfono móvil' },
                          ].map((opt) => (
                            <div key={opt.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <span className="text-sm">{opt.label}</span>
                              <Switch
                                checked={(config as any)[opt.key]}
                                onChange={(checked) => updateConfig({ [opt.key]: checked } as any)}
                                className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-cyan-500"
                              >
                                <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                              </Switch>
                            </div>
                          ))}
                        </div>
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
                      <span className="ml-2 text-sm text-gray-500">Cargando...</span>
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
                          <Table.HeadCell>Cliente</Table.HeadCell>
                          <Table.HeadCell>Tipo</Table.HeadCell>
                          <Table.HeadCell>Estado</Table.HeadCell>
                          <Table.HeadCell>Teléfono</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                          {logs.map((log: any) => (
                            <Table.Row key={log.id}>
                              <Table.Cell className="text-xs">{formatDateTime(log.sent_at || log.created_at)}</Table.Cell>
                              <Table.Cell className="text-sm">{log.client_name || '-'}</Table.Cell>
                              <Table.Cell>
                                <Badge color="info" size="xs">{typeLabel(log.notification_type)}</Badge>
                              </Table.Cell>
                              <Table.Cell>
                                <Badge color={log.status === 'sent' ? 'success' : log.status === 'failed' ? 'failure' : 'warning'} size="xs">
                                  {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Fallido' : log.status}
                                </Badge>
                                {log.error_message && log.status === 'failed' && (
                                  <p className="text-xs text-red-500 mt-1">{log.error_message.substring(0, 40)}...</p>
                                )}
                              </Table.Cell>
                              <Table.Cell className="text-xs text-gray-500">{log.recipient_phone || '-'}</Table.Cell>
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
          <Button color="light" onClick={onClose} disabled={saving}>Cerrar</Button>
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

export default ClientNotificationsModal;
