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
  const [ramos, setRamos] = useState<Array<{ id: number; nombre: string }>>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  
  // Estados de UI
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingRamos, setLoadingRamos] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [waTemplates, setWaTemplates] = useState<{ name: string; status: string; category: string; language: string; body_text: string; param_count: number }[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [creatingTemplateFor, setCreatingTemplateFor] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [ramoSearch, setRamoSearch] = useState('');
  
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

  const loadRamos = useCallback(async () => {
    try {
      setLoadingRamos(true);
      const response = await api.get('/saas/catalogos/ramos?per_page=999999');
      if (response.data?.data) {
        setRamos(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando ramos:', error);
    } finally {
      setLoadingRamos(false);
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

  const loadWhatsAppTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const response = await api.get('/saas/policy-notifications/whatsapp-templates');
      if (response.data?.success && response.data?.data) {
        setWaTemplates(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando plantillas de WhatsApp:', error);
    } finally {
      setLoadingTemplates(false);
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
      } else if (activeTab === 'config') {
        if (openSections.exclusions) {
          loadClientes();
          loadRamos();
        }
        if (openSections.templates) loadWhatsAppTemplates();
      }
    }
  }, [isOpen, config, activeTab, openSections.exclusions, openSections.templates, loadScheduledNotifications, loadLogs, loadClientes, loadWhatsAppTemplates]);

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

  // Mensajes en español para errores conocidos de Meta WhatsApp Cloud API.
  // Más detalle del raw error en el tooltip (`title`) del span donde se muestra.
  const META_ERROR_CODES: Record<string, string> = {
    '100': 'Parámetro inválido en el envío',
    '131000': 'Error general de Meta',
    '131005': 'Número no registrado en WhatsApp',
    '131008': 'Falta un parámetro requerido',
    '131009': 'Valor de parámetro inválido (revisa nombre/teléfono)',
    '131016': 'Servicio temporalmente caído',
    '131021': 'No puedes enviarte mensaje a ti mismo',
    '131026': 'Mensaje no entregable (cliente bloqueó/no abierto)',
    '131031': 'Cuenta restringida temporalmente por Meta',
    '131042': 'Cuenta de WhatsApp Business no verificada',
    '131047': 'Ventana de 24h cerrada (usa plantilla)',
    '131048': 'Límite de spam alcanzado por este número',
    '131051': 'Tipo de mensaje no soportado',
    '131052': 'Error descargando el media (archivo)',
    '131056': 'Conversación con el destinatario aún no permitida',
    '132000': 'Cantidad de parámetros no coincide con la plantilla',
    '132001': 'Plantilla no existe en este idioma',
    '132005': 'Texto traducido demasiado largo',
    '132007': 'Política de caracteres de la plantilla violada',
    '132012': 'Formato de parámetro no coincide con la plantilla',
    '132015': 'Plantilla pausada por Meta',
    '132016': 'Plantilla deshabilitada por Meta',
    '132068': 'Plantilla en revisión, aún no aprobada',
    '133000': 'Demasiados intentos de PIN',
    '135000': 'Error genérico del usuario',
    '136025': 'Permiso revocado por la cuenta de Meta',
    '80007': 'Límite de envío alcanzado (rate limit)',
    '190': 'Token de Meta expirado o inválido',
    '200': 'Permisos insuficientes en el token de Meta',
    '368': 'Cuenta bloqueada por Meta temporalmente',
  };

  const translateError = (error: string): string => {
    if (!error) return 'Error al enviar';
    const exact: Record<string, string> = {
      'Error desconocido': 'Error al enviar',
      'Instance not connected': 'WhatsApp desconectado',
      'instance not connected': 'WhatsApp desconectado',
      'Connection closed': 'Conexión cerrada',
      'Phone number not registered': 'Número no registrado',
      'Invalid phone number': 'Número inválido',
      'Rate limit exceeded': 'Límite de envíos excedido',
      'Timeout': 'Tiempo agotado',
      'Omitido manualmente': 'Omitido por usuario',
    };
    if (exact[error]) return exact[error];

    // Códigos #N de Meta WhatsApp Cloud API (más comunes: #100, #131009, #132000…)
    const metaMatch = error.match(/\(#(\d+)\)/);
    if (metaMatch) {
      const code = metaMatch[1];
      const translated = META_ERROR_CODES[code];
      if (translated) return `${translated} (Meta #${code})`;
      return `Error de Meta #${code}`;
    }

    // HTTP genéricos
    const httpMatch = error.match(/\[HTTP (\d+)\]/);
    if (httpMatch) {
      const code = httpMatch[1];
      if (code === '500') return 'Error del servidor';
      if (code === '502' || code === '503') return 'Servicio no disponible';
      if (code === '401') return 'Token inválido o expirado';
      if (code === '403') return 'Sin permiso para enviar';
      if (code === '429') return 'Demasiadas peticiones';
      return `Error HTTP ${code}`;
    }

    // Errores de cURL (red/conectividad al ir a Meta)
    const curlMatch = error.match(/cURL error (\d+)/i);
    if (curlMatch) {
      const code = curlMatch[1];
      if (code === '6' || /resolving timed out|could not resolve host/i.test(error)) {
        return 'No se pudo conectar a WhatsApp (DNS / red caída)';
      }
      if (code === '7') return 'No se pudo conectar al servidor de WhatsApp';
      if (code === '28' || /timed out/i.test(error)) return 'Tiempo agotado al conectar con WhatsApp';
      if (code === '35' || code === '60') return 'Error SSL al conectar con WhatsApp';
      return `Error de red (cURL ${code})`;
    }

    // Frases comunes en inglés que llegan como texto libre
    if (/template name does not exist/i.test(error)) return 'Plantilla no existe en ese idioma (Meta)';
    if (/parameter value is not valid/i.test(error)) return 'Valor de parámetro inválido';
    if (/number of parameters does not match/i.test(error)) return 'Cantidad de parámetros no coincide con la plantilla';

    return error.length > 60 ? error.substring(0, 60) + '…' : error;
  };

  const formatDateTime = (dateStr: string) => {
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
    if (!wasRead && !log.delivered_at && !log.sent_at) tooltipLines.push('Sin entrega aún');
    return (
      <span
        title={tooltipLines.join('\n')}
        className={`inline-flex items-center cursor-help ${wasRead ? 'text-green-500' : 'text-gray-400'}`}
      >
        <Icon icon="solar:check-read-bold" className="w-5 h-5" />
      </span>
    );
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCreateTemplate = async (configKey: string, exampleBody: string, exampleParams: string[]) => {
    if (creatingTemplateFor === configKey) {
      // Toggle off
      setCreatingTemplateFor(null);
      setNewTemplateName('');
      setNewTemplateBody('');
      return;
    }
    // Pre-fill
    const suffix = configKey.replace('_template', '').replace('payment', 'pago');
    setNewTemplateName(`guro_${suffix}_${Date.now().toString(36)}`);
    setNewTemplateBody(exampleBody);
    setCreatingTemplateFor(configKey);
  };

  const submitNewTemplate = async (configKey: string, exampleParams: string[]) => {
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
        example_body_params: exampleParams,
      });

      if (res.data?.success || res.data?.data) {
        toast({ title: 'Plantilla enviada', description: 'Se envió a Meta para aprobación. Puede tomar minutos o hasta 24 horas.' });
        // Auto-select the new template
        updateConfig({ [configKey]: newTemplateName.toLowerCase().replace(/[^a-z0-9_]/g, '_') });
        setCreatingTemplateFor(null);
        setNewTemplateName('');
        setNewTemplateBody('');
        // Reload templates after short delay
        setTimeout(() => loadWhatsAppTemplates(), 3000);
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
            <span className="ml-3 text-gray-500">Cargando configuración...</span>
          </div>
        ) : !config ? (
          <div className="text-center py-16">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-gray-500">Error al cargar la configuración</p>
            <Button color="blue" size="sm" className="mt-4" onClick={loadConfig}>Reintentar</Button>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Estado del sistema (banner superior) */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${config.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className={`text-sm font-semibold ${config.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                    Sistema {config.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {config.whatsapp_status && (
                  <div className="flex items-center gap-1.5 pl-4 border-l border-gray-300 dark:border-gray-600">
                    <Icon icon="logos:whatsapp-icon" className="w-4 h-4" />
                    <span className={`text-xs ${config.whatsapp_status.connected ? 'text-green-600' : 'text-red-500'}`}>
                      {config.whatsapp_status.connected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
                    </span>
                  </div>
                )}
                {config.stats?.next_execution_formatted && (
                  <div className="flex items-center gap-1.5 pl-4 border-l border-gray-300 dark:border-gray-600 text-xs text-gray-500">
                    <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4" />
                    Próximo: {config.stats.next_execution_formatted}
                  </div>
                )}
              </div>
              <Switch
                checked={config.is_active}
                onChange={(checked) => updateConfig({ is_active: checked })}
                className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition data-[checked]:bg-green-500"
              >
                <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
              </Switch>
            </div>

            {/* Tabs horizontales (estilo AutomovilNotificationsModal) */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'dashboard' as TabType, icon: 'solar:dashboard-bold-duotone', label: 'Dashboard' },
                  { id: 'config' as TabType, icon: 'solar:settings-bold-duotone', label: 'Configuración' },
                  { id: 'history' as TabType, icon: 'solar:clock-circle-bold-duotone', label: 'Historial' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
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

            {/* Contenido principal */}
            <div>
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

                  {/* Estadísticas rápidas (estilo AutomovilNotificationsModal) */}
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
                        <div className="max-h-[480px] overflow-y-auto">
                        <Table>
                          <Table.Head className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                            <Table.HeadCell>Póliza</Table.HeadCell>
                            <Table.HeadCell>Cliente</Table.HeadCell>
                            <Table.HeadCell>Tipo</Table.HeadCell>
                            <Table.HeadCell>Vence</Table.HeadCell>
                            <Table.HeadCell>Envío</Table.HeadCell>
                            <Table.HeadCell></Table.HeadCell>
                          </Table.Head>
                          <Table.Body>
                            {scheduledNotifications.map((item: any) => (
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
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: Configuración */}
              {activeTab === 'config' && (
                <div className="space-y-4">
                  {/* Sección: WhatsApp */}
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
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
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
                      <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
                        {/* Vencimiento */}
                        <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 text-orange-500" />
                            <div>
                              <p className="font-medium text-sm">Vencimiento</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Días: {(config.expiration_days_before_multiple || [config.expiration_days_before]).join(', ')}</p>
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
                                  <div key={idx} className="flex items-center gap-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded px-2 py-1">
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
                                    <span className="text-xs text-gray-500 dark:text-gray-400">días</span>
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
                              <p className="text-xs text-gray-500 dark:text-gray-400">Días: {(config.renewal_days_before_multiple || [config.renewal_days_before]).join(', ')}</p>
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

                        {config.notify_renewal && (
                          <div className="pl-8 space-y-3">
                            <div>
                              <Label className="text-xs">Días de anticipación</Label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {(config.renewal_days_before_multiple || [config.renewal_days_before]).map((days, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded px-2 py-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="365"
                                      defaultValue={days}
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        const arr = [...(config.renewal_days_before_multiple || [config.renewal_days_before])];
                                        arr[idx] = isNaN(val) ? 30 : val;
                                        updateConfig({ renewal_days_before_multiple: arr, renewal_days_before: Math.max(...arr) });
                                      }}
                                      className="w-14 h-7 text-center text-sm"
                                    />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">días</span>
                                    {(config.renewal_days_before_multiple || []).length > 1 && (
                                      <button onClick={() => {
                                        const arr = (config.renewal_days_before_multiple || []).filter((_, i) => i !== idx);
                                        updateConfig({ renewal_days_before_multiple: arr, renewal_days_before: Math.max(...arr) || 30 });
                                      }} className="text-red-500 hover:text-red-700">
                                        <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <Button size="xs" color="light" onClick={() => {
                                  const arr = [...(config.renewal_days_before_multiple || [config.renewal_days_before]), 7];
                                  updateConfig({ renewal_days_before_multiple: arr.sort((a, b) => b - a) });
                                }}>
                                  <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Pago */}
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:wallet-money-bold" className="w-5 h-5 text-green-500" />
                            <div>
                              <p className="font-medium text-sm">Pago Pendiente</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Recordatorios por cada cuota próxima a vencer · Días: {(config.payment_days_before_multiple || [config.payment_days_before]).join(', ')}</p>
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

                        {config.notify_payment_due && (
                          <div className="pl-8 space-y-3">
                            {/* Aviso sobre pólizas ya pagadas */}
                            <div className="flex items-start gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                              <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                              <div className="text-[11px] text-blue-700 dark:text-blue-300 leading-snug">
                                <p className="font-medium">Las pólizas con cartera pagada no se notifican.</p>
                                <p className="mt-0.5">Solo se envían recordatorios por cuotas pendientes (no recaudadas, no anuladas, no anticipos). Cuando todas las cuotas están al día, esa póliza se omite automáticamente.</p>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Días de anticipación</Label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {(config.payment_days_before_multiple || [config.payment_days_before]).map((days, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded px-2 py-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="365"
                                      defaultValue={days}
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        const arr = [...(config.payment_days_before_multiple || [config.payment_days_before])];
                                        arr[idx] = isNaN(val) ? 30 : val;
                                        updateConfig({ payment_days_before_multiple: arr, payment_days_before: Math.max(...arr) });
                                      }}
                                      className="w-14 h-7 text-center text-sm"
                                    />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">días</span>
                                    {(config.payment_days_before_multiple || []).length > 1 && (
                                      <button onClick={() => {
                                        const arr = (config.payment_days_before_multiple || []).filter((_, i) => i !== idx);
                                        updateConfig({ payment_days_before_multiple: arr, payment_days_before: Math.max(...arr) || 30 });
                                      }} className="text-red-500 hover:text-red-700">
                                        <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <Button size="xs" color="light" onClick={() => {
                                  const arr = [...(config.payment_days_before_multiple || [config.payment_days_before]), 7];
                                  updateConfig({ payment_days_before_multiple: arr.sort((a, b) => b - a) });
                                }}>
                                  <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Sección: Horario */}
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

                  {/* Sección: Destinatarios */}
                  <Collapsible open={openSections.recipients} onOpenChange={() => toggleSection('recipients')}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
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
                      <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
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
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon icon="solar:shield-cross-bold-duotone" className="w-6 h-6 text-red-500" />
                          <div className="text-left">
                            <h4 className="font-medium">Exclusiones</h4>
                            <p className="text-xs text-gray-500">{config.excluded_client_ids?.length || 0} clientes, {config.excluded_ramo_ids?.length || 0} ramos excluidos</p>
                          </div>
                        </div>
                        <Icon icon={openSections.exclusions ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} className="w-5 h-5 text-gray-400" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
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

                        {/* Ramos excluidos */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs">Ramos excluidos</Label>
                            <div className="flex gap-2">
                              <Button size="xs" color="failure" onClick={() => updateConfig({ excluded_ramo_ids: ramos.map(r => r.id) })}>
                                Excluir todos
                              </Button>
                              <Button size="xs" color="light" onClick={() => updateConfig({ excluded_ramo_ids: [] })}>
                                Limpiar
                              </Button>
                            </div>
                          </div>
                          <TextInput
                            placeholder="Buscar ramo..."
                            value={ramoSearch}
                            onChange={(e) => setRamoSearch(e.target.value)}
                            className="mb-2"
                          />
                          {loadingRamos ? (
                            <div className="flex items-center justify-center py-4">
                              <Spinner size="sm" />
                            </div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto border rounded-lg">
                              {ramos
                                .filter(r => {
                                  if (!ramoSearch) return true;
                                  const s = ramoSearch.toLowerCase();
                                  if (r.nombre?.toLowerCase().includes(s)) return true;
                                  // subramo puede venir como string o array (accessor del backend lo retorna como array)
                                  const subList = Array.isArray(r.subramo)
                                    ? r.subramo
                                    : typeof r.subramo === 'string' && r.subramo
                                      ? [r.subramo]
                                      : [];
                                  return subList.some((sub: string) => typeof sub === 'string' && sub.toLowerCase().includes(s));
                                })
                                .slice(0, 30)
                                .map((r) => {
                                  const isEx = config.excluded_ramo_ids?.includes(r.id);
                                  return (
                                    <div
                                      key={r.id}
                                      onClick={() => {
                                        const curr = config.excluded_ramo_ids || [];
                                        updateConfig({ excluded_ramo_ids: isEx ? curr.filter(id => id !== r.id) : [...curr, r.id] });
                                      }}
                                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                                        isEx ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                      }`}
                                    >
                                      <input type="checkbox" checked={isEx} readOnly className="w-4 h-4 text-red-600 rounded pointer-events-none" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{r.nombre}</p>
                                        {r.subramo && <p className="text-xs text-gray-500">{r.subramo}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
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
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Icon icon="solar:document-text-bold-duotone" className="w-6 h-6 text-indigo-500" />
                          <div className="text-left">
                            <h4 className="font-medium">Plantillas de WhatsApp</h4>
                            <p className="text-xs text-gray-500">Selecciona o crea plantillas para cada notificación</p>
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

                        {[
                          {
                            key: 'expiration_template' as const,
                            label: 'Vencimiento',
                            icon: 'solar:danger-triangle-bold',
                            color: 'text-orange-500',
                            bgColor: 'bg-orange-50 dark:bg-orange-900/20',
                            borderColor: 'border-orange-200 dark:border-orange-700/50',
                            requiredParams: 6,
                            variableChips: ['Nombre cliente', 'Nro póliza', 'Aseguradora', 'Fecha vencimiento', 'Ramo', 'Riesgo'],
                            exampleParams: ['Juan Pérez', 'POL-12345', 'Sura', '15/04/2026', 'Vida', 'ABC-123'],
                            exampleTemplate: 'Hola {{1}}, te recordamos que tu póliza {{2}} ({{5}}) de {{3}} vence el {{4}}. Riesgo: {{6}}. Contáctanos para renovarla.',
                          },
                          {
                            key: 'renewal_template' as const,
                            label: 'Renovación',
                            icon: 'solar:refresh-bold',
                            color: 'text-blue-500',
                            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                            borderColor: 'border-blue-200 dark:border-blue-700/50',
                            requiredParams: 6,
                            variableChips: ['Nombre cliente', 'Nro póliza', 'Aseguradora', 'Fecha renovación', 'Ramo', 'Riesgo'],
                            exampleParams: ['Juan Pérez', 'POL-12345', 'Sura', '15/04/2026', 'Vida', 'ABC-123'],
                            exampleTemplate: 'Hola {{1}}, es momento de renovar tu póliza {{2}} ({{5}}) de {{3}}. La fecha de renovación es {{4}}. Riesgo: {{6}}. ¿Te ayudamos?',
                          },
                          {
                            key: 'payment_template' as const,
                            label: 'Pago Pendiente',
                            icon: 'solar:wallet-money-bold',
                            color: 'text-green-500',
                            bgColor: 'bg-green-50 dark:bg-green-900/20',
                            borderColor: 'border-green-200 dark:border-green-700/50',
                            requiredParams: 6,
                            variableChips: ['Nombre cliente', 'Nro póliza', 'Fecha pago', 'Monto prima', 'Ramo', 'Riesgo'],
                            exampleParams: ['Juan Pérez', 'POL-12345', '15/04/2026', '$1.500.000', 'Autos', 'ABC-123'],
                            exampleTemplate: 'Hola {{1}}, tu póliza {{2}} ({{5}}) tiene un pago pendiente para el {{3}} por un valor de {{4}}. Riesgo: {{6}}. No olvides pagarlo.',
                          },
                        ].map((item) => {
                          const selectedName = (config as any)[item.key] || '';
                          const selectedTemplate = waTemplates.find(t => t.name === selectedName);
                          const paramMismatch = selectedTemplate && selectedTemplate.param_count !== item.requiredParams;
                          const isCreating = creatingTemplateFor === item.key;
                          return (
                            <div key={item.key} className={`p-4 rounded-xl border ${item.borderColor} ${item.bgColor} space-y-3`}>
                              {/* Header + variable chips */}
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Icon icon={item.icon} className={`w-5 h-5 ${item.color}`} />
                                  <span className="font-semibold text-sm">{item.label}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {item.variableChips.map((chip, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-600 rounded text-[10px] text-gray-500 dark:text-gray-400">
                                      <code className="font-mono text-purple-600 dark:text-purple-400">{`{{${i + 1}}}`}</code> {chip}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Template selector + create button */}
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Select
                                    value={selectedName || 'none'}
                                    onValueChange={(value) => updateConfig({ [item.key]: value === 'none' ? '' : value })}
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
                                            <span className={`text-xs ${t.param_count === item.requiredParams ? 'text-green-500' : 'text-red-500'}`}>
                                              ({t.param_count} var{t.param_count === item.requiredParams ? ' ✓' : ` ✗`})
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Tooltip content={isCreating ? 'Cancelar' : (!config?.whatsapp_instance_id ? 'Selecciona una instancia de WhatsApp primero' : 'Crear nueva plantilla')}>
                                  <Button
                                    size="sm"
                                    color={isCreating ? 'light' : 'purple'}
                                    onClick={() => {
                                      if (!config?.whatsapp_instance_id) {
                                        toast({ title: 'Instancia requerida', description: 'Selecciona una instancia de WhatsApp en la sección de conexión antes de crear plantillas', variant: 'destructive' });
                                        return;
                                      }
                                      handleCreateTemplate(item.key, item.exampleTemplate, item.exampleParams);
                                    }}
                                  >
                                    <Icon icon={isCreating ? 'solar:close-circle-bold' : 'solar:add-circle-bold'} className="w-4 h-4" />
                                  </Button>
                                </Tooltip>
                              </div>

                              {/* Selected template preview with validation */}
                              {selectedTemplate && !isCreating && (
                                <div className={`p-2.5 rounded-lg border text-xs ${paramMismatch ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'}`}>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Icon icon={paramMismatch ? 'solar:danger-triangle-bold' : 'solar:check-circle-bold'} className={`w-3.5 h-3.5 ${paramMismatch ? 'text-red-500' : 'text-green-500'}`} />
                                    <span className={`font-semibold ${paramMismatch ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                      {paramMismatch ? `Necesita ${item.requiredParams} variables, tiene ${selectedTemplate.param_count}` : 'Compatible ✓'}
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
                                    Crear plantilla para {item.label}
                                  </div>
                                  <div>
                                    <Label className="text-xs text-gray-500 dark:text-gray-400">Nombre (solo letras minúsculas, números y _)</Label>
                                    <Input
                                      value={newTemplateName}
                                      onChange={(e) => setNewTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                      placeholder="guro_vencimiento_poliza"
                                      className="mt-1 h-8 text-sm font-mono"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-gray-500 dark:text-gray-400">Texto del mensaje (edita libremente, mantén las variables {'{{1}}'} {'{{2}}'} etc.)</Label>
                                    <Textarea
                                      value={newTemplateBody}
                                      onChange={(e) => setNewTemplateBody(e.target.value)}
                                      rows={3}
                                      className="mt-1 text-sm font-mono"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-gray-400">Se enviará a Meta para aprobación (puede tomar minutos a 24h)</p>
                                    <Button
                                      size="xs"
                                      color="purple"
                                      onClick={() => submitNewTemplate(item.key, item.exampleParams)}
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
                        })}
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
                          <Table.HeadCell>Entrega</Table.HeadCell>
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
                                    <span
                                      className="text-xs text-red-500 cursor-help"
                                      title={`Detalle Meta:\n${log.error_message}`}
                                    >
                                      {translateError(log.error_message)}
                                    </span>
                                  )}
                                </div>
                              </Table.Cell>
                              <Table.Cell>
                                <DeliveryStatus log={log} />
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
