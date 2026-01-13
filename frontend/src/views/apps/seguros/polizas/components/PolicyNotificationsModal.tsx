import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Badge, Tabs, Alert, Table, TextInput } from 'flowbite-react';
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
import policyNotificationService, {
  PolicyNotificationConfig,
  WhatsAppStatus
} from 'src/services/policyNotificationService';
import { useToast } from 'src/hooks/use-toast';
import { useTerminologia } from 'src/context/TerminologiaContext';
import api from 'src/config/api';
import whatsappInstanceService from 'src/services/whatsappInstanceService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PolicyNotificationsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const { terminologia } = useTerminologia();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PolicyNotificationConfig | null>(null);
  const [whatsappInstances, setWhatsappInstances] = useState<any[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [polizas, setPolizas] = useState<any[]>([]);

  // Helpers para normalizar campos de cliente
  const getClientName = (c: any): string => {
    const company = c.razon_social || c.company_name || c.nombre_completo || c.full_name || '';
    const first = c.first_name || c.nombre || c.nombres || '';
    const last = c.last_name || c.apellido || c.apellidos || '';
    const full = (first || last) ? `${first} ${last}`.trim() : company;
    return full || '';
  };

  const getClientDocument = (c: any): string => {
    // 1) Campos directos más comunes
    const direct =
      c.document_number ??
      c.numero_documento ??
      c.num_documento ??
      c.dni ??
      c.documento ??
      c.nit ??
      c.identificacion ??
      c.identification ??
      c.id_documento ??
      null;

    if (direct !== null && direct !== undefined && direct !== '') {
      return String(direct);
    }

    // 2) Búsqueda en estructuras anidadas comunes
    const nestedCandidates: any[] = [
      c.document,
      c.documents,
      c.doc,
      c.identification,
      c.identificacion,
      c.identidad,
      c.id_doc,
      c.info_documento,
      c.datos_documento,
      c.persona,
      c.company,
      c.empresa,
      c.cliente,
      c.client,
    ].filter(Boolean);

    for (const obj of nestedCandidates) {
      if (obj && typeof obj === 'object') {
        const val =
          obj.document_number ??
          obj.numero_documento ??
          obj.num_documento ??
          obj.dni ??
          obj.documento ??
          obj.nit ??
          obj.number ??
          obj.numero ??
          obj.value ??
          null;
        if (val !== null && val !== undefined && val !== '') return String(val);

        // Heurística de claves probables dentro del objeto
        for (const [k, v] of Object.entries(obj)) {
          if (
            (typeof v === 'string' || typeof v === 'number') &&
            /^(document.*|doc.*|dni|nit|ident.*)$/i.test(k)
          ) {
            return String(v);
          }
        }
      }
    }

    // 3) Heurística en nivel superior si aún no se encontró
    for (const [k, v] of Object.entries(c || {})) {
      if (
        (typeof v === 'string' || typeof v === 'number') &&
        /^(document.*|doc.*|dni|nit|ident.*)$/i.test(k)
      ) {
        return String(v);
      }
    }

    // 4) Fallback
    return '';
  };

  const getClientPoliciesCount = (c: any): number => {
    // Preferir conteos directos si existen
    const direct =
      c.total_policies_count ??
      c.policies_count ??
      c.total_polizas ??
      c.totalPolicies ??
      (Array.isArray(c.policies) ? c.policies.length : undefined);

    if (typeof direct === 'number' && !Number.isNaN(direct)) {
      return direct;
    }

    // Fallback: calcular desde el arreglo global de pólizas cargado
    const cid =
      c.id ?? c.client_id ?? c.cliente_id ?? c.clientId ?? c.clienteId ?? c.uuid ?? c._id ?? c.client?.id ?? c.cliente?.id;

    if (cid === null || cid === undefined) return 0;

    const cidStr = String(cid);
    let total = 0;

    for (const p of polizas) {
      const pid =
        p?.client_id ?? p?.cliente_id ?? p?.clientId ?? p?.clienteId ?? p?.client?.id ?? p?.cliente?.id;
      if (pid !== null && pid !== undefined && String(pid) === cidStr) {
        total++;
      }
    }

    return total;
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadWhatsAppInstances();
      loadClientes();
      loadPolizas();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await policyNotificationService.getConfig();
      setConfig(data);
    } catch (error) {
      console.error('Error cargando configuración:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsAppInstances = async () => {
    try {
      setLoadingInstances(true);
      console.log('🔄 Cargando instancias de WhatsApp...');
      
      // Usar el mismo servicio que ConfiguracionMasiva
      const response = await whatsappInstanceService.getInstances();
      console.log('📊 Respuesta de instancias:', response);
      
      if (response.success && response.data) {
        setWhatsappInstances(response.data);
        console.log('✅ Instancias cargadas:', response.data.length);
      } else {
        console.warn('⚠️ No se pudieron cargar instancias:', response);
        setWhatsappInstances([]);
      }
    } catch (error) {
      console.error('❌ Error cargando instancias:', error);
      setWhatsappInstances([]);
    } finally {
      setLoadingInstances(false);
    }
  };

  const loadClientes = async () => {
    try {
      setLoadingClientes(true);
      console.log('🔄 Cargando TODOS los clientes...');
      
      // Usar endpoint directo /saas/clientes/all
      const response = await api.get('/saas/clientes/all');
      console.log('📊 Respuesta completa:', response.data);
      
      // Manejar diferentes estructuras de respuesta
      let data: any[] = [];
      if (Array.isArray(response.data.data)) {
        data = response.data.data;
      } else if (Array.isArray(response.data)) {
        data = response.data;
      }
      
      console.log('📊 Total clientes cargados:', data.length);
      if (data.length > 0) {
        console.log('📊 Ejemplo de cliente:', data[0]);
        console.log('📊 Campos disponibles:', Object.keys(data[0]));
        console.log('📊 Documento extraído:', getClientDocument(data[0]));
        console.log('📊 Nombre extraído:', getClientName(data[0]));
        console.log('📊 Pólizas extraídas:', getClientPoliciesCount(data[0]));
      }
      
      setClientes(data);
    } catch (error) {
      console.error('❌ Error cargando clientes:', error);
      setClientes([]);
    } finally {
      setLoadingClientes(false);
    }
  };

  const loadPolizas = async () => {
    try {
      const response = await api.get('/saas/polizas', { params: { per_page: 1000 } });
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      setPolizas(data);
    } catch (error) {
      console.error('Error cargando pólizas:', error);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    // Validar configuración
    const validation = policyNotificationService.validateConfig(config);
    if (!validation.valid) {
      toast({
        title: 'Validación fallida',
        description: validation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const updated = await policyNotificationService.updateConfig(config);
      setConfig(updated);
      toast({
        title: 'Configuración guardada',
        description: 'Las notificaciones se han configurado correctamente',
      });
      onClose();
    } catch (error: any) {
      console.error('Error guardando configuración:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<PolicyNotificationConfig>) => {
    setConfig(prev => prev ? { ...prev, ...updates } : null);
  };

  const getWhatsAppStatusBadge = (status: WhatsAppStatus) => {
    if (!status) {
      return <Badge color="gray">Sin configurar</Badge>;
    }

    if (status.connected) {
      return (
        <Badge color="success" className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Conectado
        </Badge>
      );
    }

    return (
      <Badge color="failure" className="flex items-center gap-1">
        <Icon icon="solar:danger-triangle-bold" className="w-3 h-3" />
        Desconectado
      </Badge>
    );
  };

  const renderWhatsAppAlert = () => {
    if (!config?.whatsapp_status) return null;

    const status = config.whatsapp_status;

    // Solo mostrar alerta si hay un problema crítico
    if (!config.whatsapp_instance_id) {
      return (
        <Alert color="warning" className="mb-4">
          <div className="flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" className="w-4 h-4" />
            <span className="text-sm">Selecciona una instancia de WhatsApp para activar las notificaciones</span>
          </div>
        </Alert>
      );
    }

    if (config.is_active && !status.connected) {
      return (
        <Alert color="failure" className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
              <span className="text-sm">
                WhatsApp <strong>{status.instance_id}</strong> desconectado - Las notificaciones no se enviarán
              </span>
            </div>
            <Button
            size="xs"
            color="light"
            onClick={() => window.open('/apps/saas/configuracion-masiva', '_blank')}
          >
            <Icon icon="solar:settings-bold" className="w-3 h-3 mr-1" />
            Reconectar
          </Button>
          </div>
        </Alert>
      );
    }

    // No mostrar alerta si todo está bien
    return null;
  };

  if (loading) {
    return (
      <Modal show={isOpen} onClose={onClose} size="4xl">
        <Modal.Header>Configuración de Notificaciones</Modal.Header>
        <Modal.Body>
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
            <span className="ml-3">Cargando configuración...</span>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  if (!config) {
    return (
      <Modal show={isOpen} onClose={onClose} size="4xl">
        <Modal.Header>Configuración de Notificaciones</Modal.Header>
        <Modal.Body>
          <div className="text-center py-12">
            <Icon icon="solar:danger-triangle-bold" className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-gray-500">No se pudo cargar la configuración</p>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  return (
    <Modal show={isOpen} onClose={onClose} size="5xl">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:bell-bold-duotone" className="w-6 h-6 text-blue-600" />
          Configuración de Notificaciones Automáticas
        </div>
      </Modal.Header>
      <Modal.Body>
        <Tabs>
          {/* Tab: Configuración General */}
          <Tabs.Item active title="General" icon={() => <Icon icon="solar:settings-bold" className="w-4 h-4" />}>
            <div className="space-y-6">
              {renderWhatsAppAlert()}

              {/* Estado y nombre */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label>Estado del Sistema</Label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={config.is_active}
                      onChange={(checked) => updateConfig({ is_active: checked })}
                      className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-success"
                    >
                      <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                    </Switch>
                    <span className="text-sm font-medium">
                      {config.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    {config.is_active && config.whatsapp_status && (
                      <div className="ml-auto">
                        {getWhatsAppStatusBadge(config.whatsapp_status)}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {config.is_active
                      ? 'Las notificaciones se enviarán automáticamente'
                      : 'Activa el sistema para comenzar'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de Configuración</Label>
                  <Input
                    id="name"
                    value={config.name}
                    onChange={(e) => updateConfig({ name: e.target.value })}
                    placeholder="Ej: Notificaciones de Pólizas"
                  />
                </div>
              </div>

              {/* Instancia de WhatsApp */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="whatsapp_instance">Instancia de WhatsApp</Label>
                  {config.whatsapp_instance_id && config.whatsapp_status && (
                    <Badge color={config.whatsapp_status.connected ? 'success' : 'failure'} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${config.whatsapp_status.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      {config.whatsapp_status.connected ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  )}
                </div>
                {loadingInstances ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Spinner size="sm" />
                    Cargando instancias...
                  </div>
                ) : whatsappInstances.length === 0 ? (
                  <div className="p-4 border border-dashed rounded-lg text-center">
                    <Icon icon="solar:inbox-line-bold-duotone" className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-2">No hay instancias de WhatsApp disponibles</p>
                    <Button
                      size="xs"
                      color="blue"
                      onClick={() => window.open('/apps/saas/configuracion-masiva', '_blank')}
                    >
                      <Icon icon="solar:add-circle-bold" className="w-3 h-3 mr-1" />
                      Crear Instancia
                    </Button>
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
                      <SelectItem value="none">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:close-circle-bold" className="w-3 h-3 text-gray-400" />
                          Sin instancia
                        </div>
                      </SelectItem>
                      {whatsappInstances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${instance.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="font-medium">{instance.phone_number || instance.instance_id}</span>
                            {instance.status === 'connected' ? (
                              <Badge color="success" size="xs">Conectado</Badge>
                            ) : (
                              <Badge color="failure" size="xs">Desconectado</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {whatsappInstances.length} instancia(s) disponible(s)
                  </span>
                  {whatsappInstances.length > 0 && (
                    <button
                      onClick={() => window.open('/apps/saas/configuracion-masiva', '_blank')}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Icon icon="solar:settings-bold" className="w-3 h-3" />
                      Gestionar instancias
                    </button>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Textarea
                  id="description"
                  value={config.description || ''}
                  onChange={(e) => updateConfig({ description: e.target.value })}
                  placeholder="Describe el propósito de estas notificaciones..."
                  rows={2}
                />
              </div>
            </div>
          </Tabs.Item>

          {/* Tab: Tipos de Notificaciones */}
          <Tabs.Item title="Tipos" icon={() => <Icon icon="solar:bell-bold" className="w-4 h-4" />}>
            <div className="space-y-6">
              {/* Vencimiento */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:danger-triangle-bold-duotone" className="w-6 h-6 text-orange-500" />
                    <div>
                      <h4 className="font-medium">Notificaciones de Vencimiento</h4>
                      <p className="text-sm text-gray-500">Recordar a clientes cuando su póliza está por vencer</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.notify_expiration}
                    onChange={(checked) => updateConfig({ notify_expiration: checked })}
                    className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-warning"
                  >
                    <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                  </Switch>
                </div>

                {config.notify_expiration && (
                  <div className="space-y-4 pl-9">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Días de anticipación</Label>
                        <Button
                          size="xs"
                          color="blue"
                          onClick={() => {
                            const current = config.expiration_days_before_multiple || [config.expiration_days_before];
                            updateConfig({
                              expiration_days_before_multiple: [...current, 30].sort((a, b) => b - a)
                            });
                          }}
                        >
                          <Icon icon="solar:add-circle-bold" className="w-3 h-3 mr-1" />
                          Agregar recordatorio
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(config.expiration_days_before_multiple || [config.expiration_days_before]).map((days, index) => (
                          <div key={`exp-${index}-${days}`} className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-lg px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              max="365"
                              defaultValue={days}
                              onBlur={(e) => {
                                const parsed = parseInt(e.target.value);
                                const newDays = isNaN(parsed) ? 30 : parsed;
                                const current = config.expiration_days_before_multiple || [config.expiration_days_before];
                                const updated = [...current];
                                updated[index] = newDays;
                                updateConfig({
                                  expiration_days_before_multiple: updated,
                                  expiration_days_before: Math.max(...updated)
                                });
                              }}
                              className="w-16 h-8 text-center text-sm font-medium"
                            />
                            <span className="text-xs text-gray-600">días</span>
                            {(config.expiration_days_before_multiple || [config.expiration_days_before]).length > 1 && (
                              <button
                                onClick={() => {
                                  const current = config.expiration_days_before_multiple || [config.expiration_days_before];
                                  const updated = current.filter((_, i) => i !== index);
                                  updateConfig({
                                    expiration_days_before_multiple: updated,
                                    expiration_days_before: Math.max(...updated) || 30
                                  });
                                }}
                                className="ml-1 text-red-500 hover:text-red-700"
                              >
                                <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Se enviarán recordatorios en cada uno de los días configurados
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expiration_template">Plantilla de mensaje</Label>
                      <Textarea
                        id="expiration_template"
                        value={config.expiration_template || policyNotificationService.getDefaultTemplate('expiration')}
                        onChange={(e) => updateConfig({ expiration_template: e.target.value })}
                        rows={3}
                        placeholder="Usa variables como {{client_name}}, {{policy_number}}, etc."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Renovación */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 text-blue-500" />
                    <div>
                      <h4 className="font-medium">Notificaciones de Renovación</h4>
                      <p className="text-sm text-gray-500">Recordar a clientes cuando deben renovar su póliza</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.notify_renewal}
                    onChange={(checked) => updateConfig({ notify_renewal: checked })}
                    className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-info"
                  >
                    <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                  </Switch>
                </div>

                {config.notify_renewal && (
                  <div className="space-y-4 pl-9">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Días de anticipación</Label>
                        <Button
                          size="xs"
                          color="blue"
                          onClick={() => {
                            const current = config.renewal_days_before_multiple || [config.renewal_days_before];
                            updateConfig({
                              renewal_days_before_multiple: [...current, 45].sort((a, b) => b - a)
                            });
                          }}
                        >
                          <Icon icon="solar:add-circle-bold" className="w-3 h-3 mr-1" />
                          Agregar recordatorio
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(config.renewal_days_before_multiple || [config.renewal_days_before]).map((days, index) => (
                          <div key={`ren-${index}-${days}`} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              max="365"
                              defaultValue={days}
                              onBlur={(e) => {
                                const parsed = parseInt(e.target.value);
                                const newDays = isNaN(parsed) ? 45 : parsed;
                                const current = config.renewal_days_before_multiple || [config.renewal_days_before];
                                const updated = [...current];
                                updated[index] = newDays;
                                updateConfig({
                                  renewal_days_before_multiple: updated,
                                  renewal_days_before: Math.max(...updated)
                                });
                              }}
                              className="w-16 h-8 text-center text-sm font-medium"
                            />
                            <span className="text-xs text-gray-600">días</span>
                            {(config.renewal_days_before_multiple || [config.renewal_days_before]).length > 1 && (
                              <button
                                onClick={() => {
                                  const current = config.renewal_days_before_multiple || [config.renewal_days_before];
                                  const updated = current.filter((_, i) => i !== index);
                                  updateConfig({
                                    renewal_days_before_multiple: updated,
                                    renewal_days_before: Math.max(...updated) || 45
                                  });
                                }}
                                className="ml-1 text-red-500 hover:text-red-700"
                              >
                                <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Se enviarán recordatorios en cada uno de los días configurados
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="renewal_template">Plantilla de mensaje</Label>
                      <Textarea
                        id="renewal_template"
                        value={config.renewal_template || policyNotificationService.getDefaultTemplate('renewal')}
                        onChange={(e) => updateConfig({ renewal_template: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pago Pendiente */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:dollar-bold-duotone" className="w-6 h-6 text-green-500" />
                    <div>
                      <h4 className="font-medium">Notificaciones de Pago</h4>
                      <p className="text-sm text-gray-500">Recordar a clientes sobre pagos pendientes</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.notify_payment_due}
                    onChange={(checked) => updateConfig({ notify_payment_due: checked })}
                    className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-success"
                  >
                    <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                  </Switch>
                </div>

                {config.notify_payment_due && (
                  <div className="space-y-4 pl-9">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Días de anticipación</Label>
                        <Button
                          size="xs"
                          color="blue"
                          onClick={() => {
                            const current = config.payment_days_before_multiple || [config.payment_days_before];
                            updateConfig({
                              payment_days_before_multiple: [...current, 7].sort((a, b) => b - a)
                            });
                          }}
                        >
                          <Icon icon="solar:add-circle-bold" className="w-3 h-3 mr-1" />
                          Agregar recordatorio
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(config.payment_days_before_multiple || [config.payment_days_before]).map((days, index) => (
                          <div key={`pay-${index}-${days}`} className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              max="90"
                              defaultValue={days}
                              onBlur={(e) => {
                                const parsed = parseInt(e.target.value);
                                const newDays = isNaN(parsed) ? 7 : parsed;
                                const current = config.payment_days_before_multiple || [config.payment_days_before];
                                const updated = [...current];
                                updated[index] = newDays;
                                updateConfig({
                                  payment_days_before_multiple: updated,
                                  payment_days_before: Math.max(...updated)
                                });
                              }}
                              className="w-16 h-8 text-center text-sm font-medium"
                            />
                            <span className="text-xs text-gray-600">días</span>
                            {(config.payment_days_before_multiple || [config.payment_days_before]).length > 1 && (
                              <button
                                onClick={() => {
                                  const current = config.payment_days_before_multiple || [config.payment_days_before];
                                  const updated = current.filter((_, i) => i !== index);
                                  updateConfig({
                                    payment_days_before_multiple: updated,
                                    payment_days_before: Math.max(...updated) || 7
                                  });
                                }}
                                className="ml-1 text-red-500 hover:text-red-700"
                              >
                                <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Se enviarán recordatorios en cada uno de los días configurados
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment_template">Plantilla de mensaje</Label>
                      <Textarea
                        id="payment_template"
                        value={config.payment_template || policyNotificationService.getDefaultTemplate('payment_due')}
                        onChange={(e) => updateConfig({ payment_template: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Variables disponibles */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h5 className="font-medium mb-2 flex items-center gap-2">
                  <Icon icon="solar:code-bold" className="w-4 h-4" />
                  Variables disponibles
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {policyNotificationService.getAvailableVariables().map((v) => (
                    <div key={v.name} className="flex items-start gap-1">
                      <code className="bg-white dark:bg-gray-800 px-1 rounded">{v.name}</code>
                      <span className="text-gray-500">- {v.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Tabs.Item>

          {/* Tab: Horarios y Límites */}
          <Tabs.Item title="Horarios" icon={() => <Icon icon="solar:clock-circle-bold" className="w-4 h-4" />}>
            <div className="space-y-6">
              {/* Hora de envío con selector visual */}
              <div className="space-y-3">
                <Label>Hora de envío</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="send_time" className="text-xs text-gray-500">Selector de hora</Label>
                    <Input
                      id="send_time"
                      type="time"
                      value={config.send_time}
                      onChange={(e) => updateConfig({ send_time: e.target.value })}
                      className="text-lg font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Horarios sugeridos</Label>
                    <div className="flex flex-wrap gap-2">
                      {['09:00', '10:00', '14:00', '16:00'].map((time) => (
                        <Button
                          key={time}
                          size="sm"
                          color={config.send_time === time + ':00' ? 'blue' : 'light'}
                          onClick={() => updateConfig({ send_time: time + ':00' })}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    Las notificaciones se enviarán a las <strong>{config.send_time}</strong> cada día seleccionado
                  </p>
                </div>
              </div>

              {/* Días de la semana */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Días de envío</Label>
                  <div className="flex gap-2">
                    <Button
                      size="xs"
                      color="light"
                      onClick={() => updateConfig({ send_days: [1, 2, 3, 4, 5] })}
                    >
                      Lun-Vie
                    </Button>
                    <Button
                      size="xs"
                      color="light"
                      onClick={() => updateConfig({ send_days: [1, 2, 3, 4, 5, 6, 0] })}
                    >
                      Todos
                    </Button>
                    <Button
                      size="xs"
                      color="light"
                      onClick={() => updateConfig({ send_days: [] })}
                    >
                      Ninguno
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {[
                    { value: 1, label: 'Lun', full: 'Lunes' },
                    { value: 2, label: 'Mar', full: 'Martes' },
                    { value: 3, label: 'Mié', full: 'Miércoles' },
                    { value: 4, label: 'Jue', full: 'Jueves' },
                    { value: 5, label: 'Vie', full: 'Viernes' },
                    { value: 6, label: 'Sáb', full: 'Sábado' },
                    { value: 0, label: 'Dom', full: 'Domingo' },
                  ].map((day) => {
                    const isSelected = config.send_days?.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        onClick={() => {
                          const current = config.send_days || [];
                          const updated = isSelected
                            ? current.filter(d => d !== day.value)
                            : [...current, day.value];
                          updateConfig({ send_days: updated });
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                        }`}
                        title={day.full}
                      >
                        <div className="text-xs font-medium">{day.label}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500">
                  {config.send_days?.length || 0} día(s) seleccionado(s)
                </p>
              </div>

              {/* Opciones de horario */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">Saltar fines de semana</p>
                    <p className="text-xs text-gray-500">No enviar sábados ni domingos</p>
                  </div>
                  <Switch
                    checked={config.skip_weekends}
                    onChange={(checked) => updateConfig({ skip_weekends: checked })}
                    className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-primary"
                  >
                    <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                  </Switch>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">Saltar festivos</p>
                    <p className="text-xs text-gray-500">No enviar en días festivos</p>
                  </div>
                  <Switch
                    checked={config.skip_holidays}
                    onChange={(checked) => updateConfig({ skip_holidays: checked })}
                    className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-primary"
                  >
                    <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                  </Switch>
                </div>
              </div>

              {/* Límite diario */}
              <div className="space-y-2">
                <Label htmlFor="max_per_day">Máximo de notificaciones por día</Label>
                <Input
                  id="max_per_day"
                  type="number"
                  min="1"
                  max="1000"
                  value={config.max_notifications_per_day}
                  onChange={(e) => updateConfig({ max_notifications_per_day: parseInt(e.target.value) || 50 })}
                />
                <p className="text-xs text-gray-500">
                  Límite de seguridad para evitar envíos masivos accidentales
                </p>
              </div>
            </div>
          </Tabs.Item>

          {/* Tab: Destinatarios */}
          <Tabs.Item title="Destinatarios" icon={() => <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4" />}>
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Enviar notificaciones a:</h4>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">Teléfono principal del cliente</p>
                    <p className="text-xs text-gray-500">Campo "phone" del cliente</p>
                  </div>
                  <Switch
                    checked={config.send_to_client_phone}
                    onChange={(checked) => updateConfig({ send_to_client_phone: checked })}
                    className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-primary"
                  >
                    <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                  </Switch>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">Teléfono móvil del cliente</p>
                    <p className="text-xs text-gray-500">Campo "mobile_phone" del cliente</p>
                  </div>
                  <Switch
                    checked={config.send_to_client_mobile}
                    onChange={(checked) => updateConfig({ send_to_client_mobile: checked })}
                    className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-primary"
                  >
                    <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                  </Switch>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{terminologia.vendedor} asignado</p>
                    <p className="text-xs text-gray-500">Notificar también al {terminologia.vendedor.toLowerCase()} asignado</p>
                  </div>
                  <Switch
                    checked={config.send_to_assigned_user}
                    onChange={(checked) => updateConfig({ send_to_assigned_user: checked })}
                    className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-[checked]:bg-primary"
                  >
                    <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6" />
                  </Switch>
                </div>
              </div>

              {!config.send_to_client_phone && !config.send_to_client_mobile && (
                <Alert color="warning">
                  <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 mr-2" />
                  Debes seleccionar al menos un tipo de teléfono para enviar notificaciones
                </Alert>
              )}
            </div>
          </Tabs.Item>

          {/* Tab: Exclusiones */}
          <Tabs.Item title="Exclusiones" icon={() => <Icon icon="solar:close-circle-bold" className="w-4 h-4" />}>
            <div className="space-y-6">
              <Alert color="info">
                <Icon icon="solar:info-circle-bold" className="w-4 h-4 mr-2" />
                Selecciona clientes o pólizas específicas que NO recibirán notificaciones automáticas
              </Alert>

              {/* Estados de póliza excluidos */}
              <div className="space-y-2">
                <Label>Estados de póliza excluidos</Label>
                <div className="flex flex-wrap gap-2">
                  {['CANCELADA', 'SUSPENDIDA', 'VENCIDA'].map((status) => {
                    const isExcluded = config.excluded_policy_statuses?.includes(status);
                    return (
                      <Button
                        key={status}
                        size="sm"
                        color={isExcluded ? 'failure' : 'light'}
                        onClick={() => {
                          const current = config.excluded_policy_statuses || [];
                          const updated = isExcluded
                            ? current.filter(s => s !== status)
                            : [...current, status];
                          updateConfig({ excluded_policy_statuses: updated });
                        }}
                      >
                        {isExcluded && <Icon icon="solar:close-circle-bold" className="w-3 h-3 mr-1" />}
                        {status}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500">
                  {config.excluded_policy_statuses?.length || 0} estado(s) excluido(s)
                </p>
              </div>

              {/* Ramos de póliza excluidos */}
              <div className="space-y-2">
                <Label>Ramos de póliza excluidos</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'AUTOS',
                    'VIDA',
                    'SALUD',
                    'HOGAR',
                    'PYMES',
                    'SOAT',
                    'ACCIDENTES_PERSONALES',
                    'TODO_RIESGO',
                    'RESPONSABILIDAD_CIVIL',
                    'INCENDIO',
                    'TRANSPORTE',
                    'CUMPLIMIENTO',
                    'MANEJO',
                    'RC_PROFESIONAL',
                    'RC_EXTRACONTRACTUAL'
                  ].map((type) => {
                    const isExcluded = config.excluded_policy_types?.includes(type);
                    return (
                      <Button
                        key={type}
                        size="sm"
                        color={isExcluded ? 'failure' : 'light'}
                        onClick={() => {
                          const current = config.excluded_policy_types || [];
                          const updated = isExcluded
                            ? current.filter(t => t !== type)
                            : [...current, type];
                          updateConfig({ excluded_policy_types: updated });
                        }}
                      >
                        {isExcluded && <Icon icon="solar:close-circle-bold" className="w-3 h-3 mr-1" />}
                        {type.replace(/_/g, ' ')}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500">
                  {config.excluded_policy_types?.length || 0} ramo(s) excluido(s)
                </p>
              </div>

              {/* Clientes excluidos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Clientes excluidos</Label>
                  <div className="flex items-center gap-2">
                    <Badge color={config.excluded_client_ids?.length ? 'failure' : 'gray'}>
                      {config.excluded_client_ids?.length || 0} de {clientes.length} excluidos
                    </Badge>
                    <Button
                      size="xs"
                      color="failure"
                      onClick={() => {
                        const allIds = clientes.map(c => c.id);
                        updateConfig({ excluded_client_ids: allIds });
                      }}
                      disabled={config.excluded_client_ids?.length === clientes.length}
                    >
                      <Icon icon="solar:users-group-rounded-bold" className="w-3 h-3 mr-1" />
                      Seleccionar Todos
                    </Button>
                    {config.excluded_client_ids && config.excluded_client_ids.length > 0 && (
                      <Button
                        size="xs"
                        color="light"
                        onClick={() => updateConfig({ excluded_client_ids: [] })}
                      >
                        <Icon icon="solar:close-circle-bold" className="w-3 h-3 mr-1" />
                        Limpiar
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <TextInput
                    placeholder="Buscar cliente por nombre o documento..."
                    value={clienteSearch}
                    onChange={(e) => setClienteSearch(e.target.value)}
                    icon={() => <Icon icon="solar:magnifer-bold" className="w-4 h-4" />}
                    className="flex-1"
                  />
                  {clienteSearch && (
                    <Button
                      size="sm"
                      color="light"
                      onClick={() => setClienteSearch('')}
                    >
                      <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {loadingClientes ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-8">
                    <Spinner size="sm" />
                    Cargando clientes...
                  </div>
                ) : clientes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Icon icon="solar:users-group-rounded-bold-duotone" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No hay clientes disponibles</p>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-lg max-h-80 overflow-y-auto">
                      <Table>
                        <Table.Head>
                          <Table.HeadCell className="w-10">
                            <input
                              type="checkbox"
                              checked={
                                clientes
                                  .filter(c => {
                                    if (!clienteSearch) return true;
                                    const search = clienteSearch.toLowerCase();
                                    const nombre = getClientName(c).toLowerCase();
                                    const doc = getClientDocument(c).toLowerCase();
                                    return nombre.includes(search) || doc.includes(search);
                                  })
                                  .slice(0, 50)
                                  .length > 0 &&
                                clientes
                                  .filter(c => {
                                    if (!clienteSearch) return true;
                                    const search = clienteSearch.toLowerCase();
                                    const nombre = getClientName(c).toLowerCase();
                                    const doc = getClientDocument(c).toLowerCase();
                                    return nombre.includes(search) || doc.includes(search);
                                  })
                                  .slice(0, 50)
                                  .every(c => config.excluded_client_ids?.includes(c.id))
                              }
                              onChange={(e) => {
                                const filteredClientes = clientes
                                  .filter(c => {
                                    if (!clienteSearch) return true;
                                    const search = clienteSearch.toLowerCase();
                                    const nombre = getClientName(c).toLowerCase();
                                    const doc = getClientDocument(c).toLowerCase();
                                    return nombre.includes(search) || doc.includes(search);
                                  })
                                  .slice(0, 50);
                                
                                if (e.target.checked) {
                                  const current = config.excluded_client_ids || [];
                                  const newIds = filteredClientes.map(c => c.id).filter(id => !current.includes(id));
                                  updateConfig({ excluded_client_ids: [...current, ...newIds] });
                                } else {
                                  const idsToRemove = filteredClientes.map(c => c.id);
                                  const updated = (config.excluded_client_ids || []).filter(id => !idsToRemove.includes(id));
                                  updateConfig({ excluded_client_ids: updated });
                                }
                              }}
                              className="w-4 h-4 text-red-600 rounded"
                              title="Seleccionar/Deseleccionar todos los visibles"
                            />
                          </Table.HeadCell>
                          <Table.HeadCell>Cliente</Table.HeadCell>
                          <Table.HeadCell>Documento</Table.HeadCell>
                          <Table.HeadCell>Pólizas</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                          {clientes
                            .filter(c => {
                              if (!clienteSearch) return true;
                              const search = clienteSearch.toLowerCase();
                              const nombre = getClientName(c).toLowerCase();
                              const doc = getClientDocument(c).toLowerCase();
                              return nombre.includes(search) || doc.includes(search);
                            })
                            .slice(0, 50)
                            .map((cliente) => {
                              const isExcluded = config.excluded_client_ids?.includes(cliente.id);
                              return (
                                <Table.Row
                                  key={cliente.id}
                                  className={`cursor-pointer transition-colors ${
                                    isExcluded
                                      ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                  onClick={() => {
                                    const current = config.excluded_client_ids || [];
                                    const updated = isExcluded
                                      ? current.filter(id => id !== cliente.id)
                                      : [...current, cliente.id];
                                    updateConfig({ excluded_client_ids: updated });
                                  }}
                                >
                                  <Table.Cell>
                                    <input
                                      type="checkbox"
                                      checked={isExcluded}
                                      onChange={() => {}}
                                      className="w-4 h-4 text-red-600 rounded pointer-events-none"
                                    />
                                  </Table.Cell>
                                  <Table.Cell className="font-medium">
                                    {getClientName(cliente) || '—'}
                                  </Table.Cell>
                                  <Table.Cell className="text-sm text-gray-500">
                                    {getClientDocument(cliente) || '—'}
                                  </Table.Cell>
                                  <Table.Cell className="text-sm text-gray-500">
                                    {getClientPoliciesCount(cliente)}
                                  </Table.Cell>
                                </Table.Row>
                              );
                            })}
                        </Table.Body>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Mostrando {Math.min(50, clientes.filter(c => {
                          if (!clienteSearch) return true;
                          const search = clienteSearch.toLowerCase();
                          const nombre = getClientName(c).toLowerCase();
                          const doc = getClientDocument(c).toLowerCase();
                          return nombre.includes(search) || doc.includes(search);
                        }).length)} de {clientes.length} clientes
                      </span>
                      <span>Click en la fila para excluir/incluir</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Tabs.Item>

          {/* Tab: Logs */}
          <Tabs.Item title="Logs" icon={() => <Icon icon="solar:document-text-bold" className="w-4 h-4" />}>
            <LogsTab config={config} />
          </Tabs.Item>

          {/* Tab: Estadísticas */}
          <Tabs.Item title="Estadísticas" icon={() => <Icon icon="solar:chart-bold" className="w-4 h-4" />}>
            <div className="space-y-6">
              {/* Estado del sistema */}
              <div className={`p-4 rounded-lg border-2 ${
                config.is_active && config.whatsapp_status?.connected
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20'
                  : config.is_active
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20'
                  : 'bg-gray-50 border-gray-200 dark:bg-gray-900/20'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    config.is_active && config.whatsapp_status?.connected
                      ? 'bg-green-100 dark:bg-green-800'
                      : config.is_active
                      ? 'bg-red-100 dark:bg-red-800'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <Icon
                      icon={
                        config.is_active && config.whatsapp_status?.connected
                          ? 'solar:check-circle-bold'
                          : config.is_active
                          ? 'solar:danger-triangle-bold'
                          : 'solar:pause-circle-bold'
                      }
                      className={`w-6 h-6 ${
                        config.is_active && config.whatsapp_status?.connected
                          ? 'text-green-600'
                          : config.is_active
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      {config.is_active && config.whatsapp_status?.connected
                        ? 'Sistema Operativo'
                        : config.is_active
                        ? 'Sistema Activo - WhatsApp Desconectado'
                        : 'Sistema Inactivo'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {config.is_active && config.whatsapp_status?.connected
                        ? `Enviando notificaciones vía ${config.whatsapp_status.phone_number}`
                        : config.is_active
                        ? 'Las notificaciones no se enviarán hasta reconectar WhatsApp'
                        : 'Activa el sistema en el tab General para comenzar'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Estadísticas */}
              {config.stats && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <Icon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-600">{config.stats.total_sent}</p>
                      <p className="text-sm text-gray-500">Enviadas</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <Icon icon="solar:close-circle-bold-duotone" className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-red-600">{config.stats.total_failed}</p>
                      <p className="text-sm text-gray-500">Fallidas</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <Icon icon="solar:chart-bold-duotone" className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-600">{config.stats.success_rate}%</p>
                      <p className="text-sm text-gray-500">Tasa de éxito</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <Icon icon="solar:calendar-bold-duotone" className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-600">{config.stats.last_30_days.total}</p>
                      <p className="text-sm text-gray-500">Últimos 30 días</p>
                    </div>
                  </div>

                  {/* Desglose últimos 30 días */}
                  {config.stats.last_30_days.total > 0 && (
                    <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-green-600">{config.stats.last_30_days.sent}</p>
                        <p className="text-xs text-gray-500">Enviadas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-red-600">{config.stats.last_30_days.failed}</p>
                        <p className="text-xs text-gray-500">Fallidas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-gray-600">{config.stats.last_30_days.skipped}</p>
                        <p className="text-xs text-gray-500">Omitidas</p>
                      </div>
                    </div>
                  )}

                  {/* Información de ejecución */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:clock-circle-bold" className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Última ejecución:</span>
                      </div>
                      <span className="font-medium text-sm">{config.stats.last_execution || 'Nunca'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:calendar-mark-bold" className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Próxima ejecución:</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-sm block">{config.stats.next_execution_formatted || 'No programada'}</span>
                        {config.stats.next_execution && (
                          <span className="text-xs text-gray-400">{config.stats.next_execution}</span>
                        )}
                      </div>
                    </div>
                    {config.stats.send_time && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:alarm-bold" className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">Hora de envío:</span>
                        </div>
                        <span className="font-medium text-sm">{config.stats.send_time?.substring(0, 5)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Tabs.Item>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between w-full">
          <Button color="light" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button color="blue" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Icon icon="solar:diskette-bold" className="w-4 h-4 mr-2" />
                Guardar Configuración
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

// Componente de Logs
const LogsTab: React.FC<{ config: PolicyNotificationConfig }> = ({ config: _config }) => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [scheduledInfo, setScheduledInfo] = useState<any>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [skippingId, setSkippingId] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'scheduled' | 'logs'>('scheduled');

  useEffect(() => {
    loadLogs();
    loadScheduledNotifications();
  }, []);

  const loadLogs = async () => {
    try {
      setLoadingLogs(true);
      const response = await policyNotificationService.getLogs({ limit: 100 });
      setLogs(response.data || []);
    } catch (error) {
      console.error('Error cargando logs:', error);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadScheduledNotifications = async () => {
    try {
      setLoadingScheduled(true);
      const response = await policyNotificationService.getScheduledNotifications(50);
      setScheduledNotifications(response.data || []);
      setScheduledInfo({
        next_execution: response.next_execution,
        next_execution_formatted: response.next_execution_formatted,
        next_execution_human: response.next_execution_human,
        send_time: response.send_time,
        send_days_labels: response.send_days_labels,
      });
    } catch (error) {
      console.error('Error cargando notificaciones programadas:', error);
      setScheduledNotifications([]);
    } finally {
      setLoadingScheduled(false);
    }
  };

  const handleSkipNotification = async (notification: any) => {
    try {
      setSkippingId(notification.policy_id);
      await policyNotificationService.skipNotification({
        poliza_id: notification.policy_id,
        notification_type: notification.notification_type,
        reason: 'Omitido manualmente desde el panel',
      });
      toast({
        title: 'Notificación omitida',
        description: `La notificación de ${notification.notification_type_label} para la póliza ${notification.policy_number} ha sido omitida`,
      });
      // Recargar la lista
      await loadScheduledNotifications();
    } catch (error) {
      console.error('Error omitiendo notificación:', error);
      toast({
        title: 'Error',
        description: 'No se pudo omitir la notificación',
        variant: 'destructive',
      });
    } finally {
      setSkippingId(null);
    }
  };

  const getStatusBadge = (status: string, errorMessage?: string) => {
    switch (status) {
      case 'sent':
        return <Badge color="success">Enviado</Badge>;
      case 'failed':
        return (
          <div className="flex flex-col gap-1">
            <Badge color="failure">Fallido</Badge>
            {errorMessage && (
              <span className="text-xs text-red-500">{translateError(errorMessage)}</span>
            )}
          </div>
        );
      case 'skipped':
        return (
          <div className="flex flex-col gap-1">
            <Badge color="warning">Omitido</Badge>
            {errorMessage && (
              <span className="text-xs text-gray-500">{translateError(errorMessage)}</span>
            )}
          </div>
        );
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  const translateError = (error: string): string => {
    // Traducciones de errores comunes
    const translations: Record<string, string> = {
      'Error desconocido': 'Error desconocido al enviar',
      'Instance not connected': 'WhatsApp desconectado',
      'instance not connected': 'WhatsApp desconectado',
      'Connection closed': 'Conexión cerrada',
      'connection closed': 'Conexión cerrada',
      'Phone number not registered': 'Número no registrado en WhatsApp',
      'Invalid phone number': 'Número de teléfono inválido',
      'Rate limit exceeded': 'Límite de envíos excedido',
      'Timeout': 'Tiempo de espera agotado',
      'timeout': 'Tiempo de espera agotado',
      'Network error': 'Error de red',
      'Omitido manualmente': 'Omitido por el usuario',
      'Omitido por el usuario': 'Omitido por el usuario',
    };

    // Buscar traducción exacta
    if (translations[error]) {
      return translations[error];
    }

    // Buscar patrones comunes
    if (error.includes('[HTTP 4') || error.includes('[HTTP 5')) {
      const match = error.match(/\[HTTP (\d+)\]/);
      if (match) {
        const code = match[1];
        if (code === '401') return 'No autorizado - Verificar credenciales';
        if (code === '403') return 'Acceso denegado';
        if (code === '404') return 'Servicio no encontrado';
        if (code === '429') return 'Demasiadas solicitudes - Esperar';
        if (code === '500') return 'Error del servidor de WhatsApp';
        if (code === '502' || code === '503') return 'Servicio de WhatsApp no disponible';
        return `Error del servidor (${code})`;
      }
    }

    if (error.toLowerCase().includes('disconnect')) {
      return 'WhatsApp desconectado';
    }
    if (error.toLowerCase().includes('not found')) {
      return 'No encontrado';
    }
    if (error.toLowerCase().includes('invalid')) {
      return 'Datos inválidos';
    }

    // Si no hay traducción, mostrar el error original truncado
    return error.length > 40 ? error.substring(0, 40) + '...' : error;
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveSubTab('scheduled')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === 'scheduled'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Icon icon="solar:clock-circle-bold" className="w-4 h-4 inline mr-2" />
          Próximos Envíos
          {scheduledNotifications.length > 0 && (
            <Badge color="info" size="xs" className="ml-2">{scheduledNotifications.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === 'logs'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Icon icon="solar:history-bold" className="w-4 h-4 inline mr-2" />
          Historial de Envíos
        </button>
      </div>

      {/* Próximos Envíos Programados */}
      {activeSubTab === 'scheduled' && (
        <div>
          {loadingScheduled ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Spinner size="sm" />
              <span className="text-sm text-gray-500">Cargando envíos programados...</span>
            </div>
          ) : scheduledNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay envíos programados</p>
              <p className="text-sm text-gray-400 mt-2">Configura los tipos de notificación y días de anticipación</p>
            </div>
          ) : (
            <>
              {/* Info de próxima ejecución */}
              {scheduledInfo && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:calendar-mark-bold" className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">Próximo envío:</span>
                      <span className="text-blue-700 dark:text-blue-300 font-semibold">
                        {scheduledInfo.next_execution_formatted || 'No programado'}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({scheduledInfo.next_execution_human})
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Hora:</span> {scheduledInfo.send_time?.substring(0, 5)} | 
                      <span className="font-medium ml-2">Días:</span> {scheduledInfo.send_days_labels?.join(', ')}
                    </div>
                  </div>
                </div>
              )}
              
              <Alert color="info" className="mb-4">
                <Icon icon="solar:info-circle-bold" className="w-4 h-4 mr-2" />
                Estas notificaciones se enviarán en la próxima ejecución programada. Si cambias la hora o los días, se recalculará automáticamente.
              </Alert>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <Table.Head>
                      <Table.HeadCell>Póliza</Table.HeadCell>
                      <Table.HeadCell>Cliente</Table.HeadCell>
                      <Table.HeadCell>Tipo</Table.HeadCell>
                      <Table.HeadCell>Fecha Evento</Table.HeadCell>
                      <Table.HeadCell>Días</Table.HeadCell>
                      <Table.HeadCell>Acción</Table.HeadCell>
                    </Table.Head>
                    <Table.Body>
                      {scheduledNotifications.map((notification: any, index: number) => (
                        <Table.Row key={index}>
                          <Table.Cell className="font-medium text-sm">
                            {notification.policy_number || '-'}
                          </Table.Cell>
                          <Table.Cell className="text-sm">
                            {notification.client_name || '-'}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge 
                              color={notification.notification_type === 'expiration' ? 'warning' : 
                                     notification.notification_type === 'renewal' ? 'info' : 'success'} 
                              size="xs"
                            >
                              {notification.notification_type_label || notification.notification_type}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell className="text-sm">
                            {notification.event_date || '-'}
                          </Table.Cell>
                          <Table.Cell className="text-sm">
                            <span className={notification.days_until_event !== null && notification.days_until_event < 7 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              {notification.days_until_event !== null ? `${notification.days_until_event}d` : '-'}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Button
                              size="xs"
                              color="failure"
                              onClick={() => handleSkipNotification(notification)}
                              disabled={skippingId === notification.policy_id}
                            >
                              {skippingId === notification.policy_id ? (
                                <Spinner size="xs" />
                              ) : (
                                <>
                                  <Icon icon="solar:close-circle-bold" className="w-3 h-3 mr-1" />
                                  Omitir
                                </>
                              )}
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Total: {scheduledNotifications.length} notificación(es) programada(s)
              </p>
            </>
          )}
        </div>
      )}

      {/* Historial de Envíos */}
      {activeSubTab === 'logs' && (
        <div>
          {loadingLogs ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Spinner size="sm" />
              <span className="text-sm text-gray-500">Cargando historial...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Icon icon="solar:inbox-line-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay registros de envíos aún</p>
              <p className="text-sm text-gray-400 mt-2">Los envíos aparecerán aquí cuando se ejecute el comando programado</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <Table.Head>
                    <Table.HeadCell>Fecha/Hora</Table.HeadCell>
                    <Table.HeadCell>Póliza</Table.HeadCell>
                    <Table.HeadCell>Cliente</Table.HeadCell>
                    <Table.HeadCell>Tipo</Table.HeadCell>
                    <Table.HeadCell>Estado</Table.HeadCell>
                    <Table.HeadCell>Teléfono</Table.HeadCell>
                  </Table.Head>
                  <Table.Body>
                    {logs.map((log: any) => (
                      <Table.Row key={log.id}>
                        <Table.Cell className="text-sm">
                          {formatDateTime(log.sent_at || log.created_at)}
                        </Table.Cell>
                        <Table.Cell className="font-medium text-sm">
                          {log.policy_number || '-'}
                        </Table.Cell>
                        <Table.Cell className="text-sm">
                          {log.client_name || '-'}
                        </Table.Cell>
                        <Table.Cell className="text-sm">
                          <Badge color="info" size="xs">
                            {log.notification_type === 'expiration' ? 'Vencimiento' :
                             log.notification_type === 'renewal' ? 'Renovación' :
                             log.notification_type === 'payment_due' ? 'Pago' : log.notification_type}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          {getStatusBadge(log.status, log.error_message)}
                        </Table.Cell>
                        <Table.Cell className="text-sm text-gray-500">
                          {log.phone_number || '-'}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PolicyNotificationsModal;