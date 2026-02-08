import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Badge, Button, Spinner, Modal, Alert, Table, Tooltip } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import whatsappInstanceService, { CreateInstanceRequest, ConnectionType } from 'src/services/whatsappInstanceService';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useToast } from 'src/hooks/use-toast';
import { useWhatsAppSocket } from 'src/hooks/useWhatsAppSocket';

interface LocalInstance {
  id: number;
  instance_id: string;
  connection_type?: ConnectionType;
  phone_number?: string;
  status: string;
  is_active: boolean;
  session_id?: string;
  last_activity_at?: string;
  reconnect_attempts?: number;
  webhook_url?: string;
  settings?: any;
}

interface CloudApiFormData {
  phone_id: string;
  business_id: string;
  token: string;
  verify_token: string;
}

const WhatsAppConexiones: React.FC = () => {
  const { user: _user } = useUnifiedAuth();
  const { toast } = useToast();
  const [instances, setInstances] = useState<LocalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<LocalInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [refreshingInstances, setRefreshingInstances] = useState<number[]>([]);
  const [showConnectionSuccess, setShowConnectionSuccess] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedConnectionType, setSelectedConnectionType] = useState<ConnectionType>('cloud_api');
  const [cloudApiForm, setCloudApiForm] = useState<CloudApiFormData>({
    phone_id: '',
    business_id: '',
    token: '',
    verify_token: ''
  });
  const [instanceStats, setInstanceStats] = useState({
    total_instances: 0,
    connected_instances: 0,
    connecting_instances: 0,
    disconnected_instances: 0,
    error_instances: 0,
  });

  // Refs para WebSocket
  const selectedInstanceRef = useRef(selectedInstance);
  const isQRModalOpenRef = useRef(showQRModal);

  useEffect(() => {
    selectedInstanceRef.current = selectedInstance;
    isQRModalOpenRef.current = showQRModal;
  }, [selectedInstance, showQRModal]);

  // WebSocket para detección automática de conexión
  const { isConnected: socketConnected, subscribeToInstance, unsubscribeFromInstance } = useWhatsAppSocket({
    autoConnect: true,
    events: {
      onConnected: (data) => {
        console.log('🎉 [WebSocket] Instancia conectada:', data.instanceId);
        setInstances(prev => prev.map(instance => 
          instance.instance_id === data.instanceId 
            ? { ...instance, status: 'connected' }
            : instance
        ));
        
        if (selectedInstanceRef.current?.instance_id === data.instanceId && isQRModalOpenRef.current) {
          setShowConnectionSuccess(true);
          setQrCode(null);
          setTimeout(() => {
            setShowQRModal(false);
            setShowConnectionSuccess(false);
            toast({
              title: "🎉 ¡WhatsApp Conectado!",
              description: "La instancia se ha conectado exitosamente.",
            });
          }, 2000);
        }
        loadInstances();
        loadInstanceStats();
      },
      onDisconnected: (data) => {
        setInstances(prev => prev.map(instance => 
          instance.instance_id === data.instanceId 
            ? { ...instance, status: 'disconnected' }
            : instance
        ));
        loadInstanceStats();
      },
      onQRCode: (data) => {
        if (selectedInstanceRef.current?.instance_id === data.instanceId && isQRModalOpenRef.current) {
          setQrCode(data.qrCode);
        }
      },
    }
  });

  // Cargar instancias desde Laravel
  const loadInstances = useCallback(async () => {
    try {
      setLoading(true);
      const response = await whatsappInstanceService.getInstances();
      
      if (response.success && response.data) {
        const mappedInstances: LocalInstance[] = response.data.map((instance: any) => {
          // Buscar número en múltiples lugares posibles
          const phoneNumber = instance.phone_number 
            || instance.connection_info?.phone 
            || instance.connection_info?.wid?.user
            || instance.session_data?.me?.id?.split(':')[0]
            || instance.session_data?.me?.user
            || null;
          
          return {
            id: instance.id,
            instance_id: instance.instance_id,
            connection_type: instance.connection_type || 'baileys',
            phone_number: phoneNumber,
            status: instance.status || 'disconnected',
            is_active: instance.is_active,
            session_id: instance.session_id || 'N/A',
            last_activity_at: instance.last_activity_at || instance.updated_at,
            reconnect_attempts: instance.reconnect_attempts || 0,
            webhook_url: instance.webhook_url,
            settings: instance.settings,
          };
        });
        setInstances(mappedInstances);
        
        // Calcular estadísticas
        const stats = {
          total_instances: response.data.length,
          connected_instances: response.data.filter((i: any) => i.status === 'connected' || i.status === 'authenticated').length,
          connecting_instances: response.data.filter((i: any) => i.status === 'connecting' || i.status === 'qr_pending').length,
          disconnected_instances: response.data.filter((i: any) => i.status === 'disconnected').length,
          error_instances: response.data.filter((i: any) => i.status === 'error').length,
        };
        setInstanceStats(stats);
      }
    } catch (error) {
      console.error('Error cargando instancias:', error);
      setError('Error al cargar las conexiones');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInstanceStats = async () => {
    try {
      const response = await whatsappInstanceService.getInstances();
      if (response.success && response.data) {
        setInstanceStats({
          total_instances: response.data.length,
          connected_instances: response.data.filter((i: any) => i.status === 'connected' || i.status === 'authenticated').length,
          connecting_instances: response.data.filter((i: any) => i.status === 'connecting' || i.status === 'qr_pending').length,
          disconnected_instances: response.data.filter((i: any) => i.status === 'disconnected').length,
          error_instances: response.data.filter((i: any) => i.status === 'error').length,
        });
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // Suscribirse a instancias en WebSocket
  useEffect(() => {
    if (!socketConnected) return;
    instances.forEach(inst => {
      if (inst.instance_id) subscribeToInstance(inst.instance_id);
    });
    return () => {
      instances.forEach(inst => {
        if (inst.instance_id) unsubscribeFromInstance(inst.instance_id);
      });
    };
  }, [socketConnected, instances, subscribeToInstance, unsubscribeFromInstance]);

  // Abrir modal para seleccionar tipo de conexión
  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setSelectedConnectionType('baileys');
    setCloudApiForm({ phone_id: '', business_id: '', token: '', verify_token: '' });
    setError(null);
  };

  // Crear nueva instancia según el tipo seleccionado
  const handleCreateInstance = async () => {
    try {
      setCreatingInstance(true);
      setError(null);
      
      const instanceData: CreateInstanceRequest = {
        connection_type: selectedConnectionType,
        phone_number: '',
        webhook_url: '',
        settings: {}
      };

      // Si es Cloud API, agregar los datos del formulario
      if (selectedConnectionType === 'cloud_api') {
        if (!cloudApiForm.phone_id || !cloudApiForm.token) {
          setError('El Phone ID y el Token son obligatorios para Cloud API');
          setCreatingInstance(false);
          return;
        }
        instanceData.cloud_api_phone_id = cloudApiForm.phone_id;
        instanceData.cloud_api_business_id = cloudApiForm.business_id;
        instanceData.cloud_api_token = cloudApiForm.token;
        instanceData.cloud_api_verify_token = cloudApiForm.verify_token;
      }
      
      const response = await whatsappInstanceService.createInstance(instanceData);

      if (response.success && response.data) {
        setShowCreateModal(false);
        toast({
          title: "Instancia Creada",
          description: selectedConnectionType === 'baileys' 
            ? "La nueva conexión ha sido creada. Escanea el código QR para conectar."
            : "La conexión con Cloud API ha sido configurada.",
        });
        await loadInstances();
        
        // Si es Baileys, abrir modal de QR automáticamente
        if (selectedConnectionType === 'baileys') {
          const newInstance: LocalInstance = {
            id: response.data.id!,
            instance_id: response.data.instance_id,
            connection_type: response.data.connection_type,
            phone_number: response.data.phone_number,
            status: response.data.status,
            is_active: response.data.is_active,
          };
          handleConnectInstance(newInstance);
        }
      } else {
        setError(response.message || 'Error al crear la instancia');
        toast({
          title: "Error",
          description: response.message || 'Error al crear la instancia',
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error creando instancia:', error);
      setError(error.message || 'Error al crear la conexión');
    } finally {
      setCreatingInstance(false);
    }
  };

  // Conectar instancia (obtener QR)
  const handleConnectInstance = async (instance: LocalInstance) => {
    setSelectedInstance(instance);
    setShowQRModal(true);
    setQrLoading(true);
    setQrCode(null);
    setShowConnectionSuccess(false);

    try {
      const response = await whatsappInstanceService.getQRCode(instance.id);
      
      if (response.success && response.qr) {
        setQrCode(response.qr);
      } else if (response.message?.includes('already connected')) {
        setShowConnectionSuccess(true);
        await loadInstances();
      } else {
        setError(response.message || 'No se pudo obtener el código QR');
      }
    } catch (error: any) {
      console.error('Error obteniendo QR:', error);
      setError(error.message || 'Error al obtener el código QR');
    } finally {
      setQrLoading(false);
    }
  };

  // Actualizar estado de instancia
  const handleRefreshStatus = async (instanceId: number) => {
    setRefreshingInstances(prev => [...prev, instanceId]);
    
    try {
      const response = await whatsappInstanceService.getStatus(instanceId);
      
      if (response.success && response.status) {
        setInstances(prev => prev.map(instance => 
          instance.id === instanceId 
            ? { ...instance, status: response.status }
            : instance
        ));
        await loadInstanceStats();
        toast({
          title: "Estado Actualizado",
          description: `Estado: ${getStatusText(response.status)}`,
        });
      } else {
        toast({
          title: "Error",
          description: response.message || 'Error al obtener estado',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error actualizando estado:', error);
    } finally {
      setRefreshingInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  // Eliminar instancia
  const handleDeleteInstance = async (instanceId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta conexión? Esta acción no se puede deshacer.')) return;

    setRefreshingInstances(prev => [...prev, instanceId]);
    
    try {
      const response = await whatsappInstanceService.deleteInstance(instanceId);
      
      if (response.success) {
        toast({
          title: "Eliminada",
          description: "La conexión ha sido eliminada exitosamente",
        });
        await loadInstances();
      } else {
        toast({
          title: "Error",
          description: response.message || 'Error al eliminar',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error eliminando:', error);
    } finally {
      setRefreshingInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  // Refrescar QR
  const handleRefreshQR = async () => {
    if (!selectedInstance) return;
    
    setQrLoading(true);
    try {
      const response = await whatsappInstanceService.getQRCode(selectedInstance.id);
      
      if (response.success && response.qr) {
        setQrCode(response.qr);
      } else if (response.message?.includes('connected')) {
        setShowConnectionSuccess(true);
        await loadInstances();
      }
    } catch (error) {
      console.error('Error refrescando QR:', error);
    } finally {
      setQrLoading(false);
    }
  };

  // Helpers
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'connected': 'Conectado',
      'authenticated': 'Autenticado',
      'connecting': 'Conectando...',
      'disconnected': 'Desconectado',
      'error': 'Error',
      'qr_pending': 'Esperando QR'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Spinner size="xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Conexiones WhatsApp
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Gestiona tus instancias de WhatsApp Business
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <Icon icon="solar:widget-4-bold" width={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <Icon icon="solar:list-bold" width={18} />
            </button>
          </div>
          <HeroButton icon="solar:add-circle-bold" onClick={handleOpenCreateModal} disabled={creatingInstance}>Nueva Conexión</HeroButton>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Conexiones</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{instanceStats.total_instances}</p>
            </div>
            <div className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Icon icon="solar:smartphone-bold-duotone" className="text-gray-600 dark:text-gray-400" width={22} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Conectadas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{instanceStats.connected_instances}</p>
            </div>
            <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Icon icon="solar:check-circle-bold-duotone" className="text-green-600 dark:text-green-400" width={22} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Conectando</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{instanceStats.connecting_instances}</p>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Icon icon="solar:refresh-bold-duotone" className="text-amber-600 dark:text-amber-400" width={22} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Desconectadas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{instanceStats.disconnected_instances}</p>
            </div>
            <div className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Icon icon="solar:close-circle-bold-duotone" className="text-gray-500 dark:text-gray-400" width={22} />
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <Alert color="failure" className="mb-4" onDismiss={() => setError(null)}>
          <Icon icon="solar:danger-triangle-bold" className="mr-2" width={18} />
          {error}
        </Alert>
      )}

      {/* Empty State */}
      {instances.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Icon icon="solar:smartphone-bold-duotone" className="text-gray-400" width={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              No hay conexiones configuradas
            </h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Crea una nueva conexión para empezar a usar WhatsApp Business y enviar mensajes a tus clientes.
            </p>
            <div className="flex justify-center mt-6">
              <HeroButton icon="solar:add-circle-bold" onClick={handleOpenCreateModal} disabled={creatingInstance} size="lg">Crear Primera Conexión</HeroButton>
            </div>
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance) => {
            const connected = instance.status === 'connected' || instance.status === 'authenticated';
            const connecting = instance.status === 'connecting' || instance.status === 'qr_pending';
            
            return (
              <Card key={instance.id} className="hover:shadow-lg transition-all hover:border-primary/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${connected ? 'bg-green-100 dark:bg-green-900/30' : connecting ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Icon 
                        icon={connected ? "solar:smartphone-bold-duotone" : "solar:smartphone-outline"} 
                        className={connected ? 'text-green-500' : connecting ? 'text-yellow-500' : 'text-gray-400'} 
                        width={28} 
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Conexión {instance.instance_id?.split('_').slice(-1)[0]?.toUpperCase() || instance.id}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Icon icon="solar:phone-bold" width={14} />
                        {instance.phone_number || 'Sin número asignado'}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    color={connected ? 'success' : connecting ? 'warning' : 'gray'}
                    className="text-xs"
                  >
                    <span className={`w-2 h-2 rounded-full mr-1.5 inline-block ${connected ? 'bg-green-500 animate-pulse' : connecting ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`}></span>
                    {getStatusText(instance.status)}
                  </Badge>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:hashtag-bold" width={12} />
                        {instance.instance_id?.split('_').slice(-1)[0] || instance.id}
                      </span>
                      <Badge 
                        color={instance.connection_type === 'cloud_api' ? 'info' : 'purple'} 
                        size="xs"
                      >
                        {instance.connection_type === 'cloud_api' ? (
                          <><Icon icon="logos:meta" width={10} className="mr-1" /> Cloud API</>
                        ) : (
                          <><Icon icon="solar:qr-code-bold" width={10} className="mr-1" /> QR</>
                        )}
                      </Badge>
                    </div>
                    {instance.last_activity_at && (
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:clock-circle-bold" width={12} />
                        {new Date(instance.last_activity_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {connected ? (
                      <Button 
                        size="sm" 
                        color="light" 
                        className="flex-1"
                        onClick={() => handleRefreshStatus(instance.id)}
                        disabled={refreshingInstances.includes(instance.id)}
                      >
                        {refreshingInstances.includes(instance.id) ? (
                          <Spinner size="sm" className="mr-1" />
                        ) : (
                          <Icon icon="solar:refresh-bold" className="mr-1" width={16} />
                        )}
                        Actualizar
                      </Button>
                    ) : instance.connection_type === 'cloud_api' ? (
                      <Button 
                        size="sm" 
                        color="light" 
                        className="flex-1"
                        onClick={() => handleRefreshStatus(instance.id)}
                        disabled={refreshingInstances.includes(instance.id)}
                      >
                        <Icon icon="solar:settings-bold" className="mr-1" width={16} />
                        Configurar
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        color="light" 
                        className="flex-1"
                        onClick={() => handleConnectInstance(instance)}
                      >
                        <Icon icon="solar:qr-code-bold" className="mr-1" width={16} />
                        Escanear QR
                      </Button>
                    )}
                    <Tooltip content="Eliminar conexión" trigger="hover">
                      <Button 
                        size="sm" 
                        color="light"
                        onClick={() => handleDeleteInstance(instance.id)}
                        disabled={refreshingInstances.includes(instance.id)}
                      >
                        <Icon icon="solar:trash-bin-trash-bold" className="text-red-500" width={16} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <Card>
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Conexión</Table.HeadCell>
              <Table.HeadCell>Teléfono</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Última Actividad</Table.HeadCell>
              <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {instances.map((instance) => {
                const connected = instance.status === 'connected' || instance.status === 'authenticated';
                
                return (
                  <Table.Row key={instance.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                          <Icon 
                            icon="solar:smartphone-bold-duotone" 
                            className={connected ? 'text-green-500' : 'text-gray-400'} 
                            width={20} 
                          />
                        </div>
                        <div>
                          <span className="block">Conexión {instance.instance_id?.split('_').slice(-1)[0]?.toUpperCase() || instance.id}</span>
                          <span className="text-xs text-gray-400 font-mono">{instance.instance_id}</span>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{instance.phone_number || 'Sin número'}</Table.Cell>
                    <Table.Cell>
                      <Badge color={connected ? 'success' : 'gray'}>
                        {getStatusText(instance.status)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-sm text-gray-500">
                      {instance.last_activity_at ? new Date(instance.last_activity_at).toLocaleString() : 'N/A'}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-2">
                        {connected ? (
                          <Button 
                            size="xs" 
                            color="light" 
                            onClick={() => handleRefreshStatus(instance.id)}
                            disabled={refreshingInstances.includes(instance.id)}
                          >
                            {refreshingInstances.includes(instance.id) ? (
                              <Spinner size="xs" />
                            ) : (
                              <Icon icon="solar:refresh-bold" width={14} />
                            )}
                          </Button>
                        ) : (
                          <Button size="xs" color="light" onClick={() => handleConnectInstance(instance)}>
                            <Icon icon="solar:qr-code-bold" width={14} />
                          </Button>
                        )}
                        <Button 
                          size="xs" 
                          color="light" 
                          onClick={() => handleDeleteInstance(instance.id)}
                          disabled={refreshingInstances.includes(instance.id)}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="text-red-500" width={14} />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </Card>
      )}

      {/* QR Code Modal */}
      <Modal show={showQRModal} onClose={() => setShowQRModal(false)} size="md">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:qr-code-bold-duotone" className="text-gray-600" width={24} />
            Conectar WhatsApp
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            {qrLoading ? (
              <div className="py-12">
                {/* Animación de generación de QR */}
                <div className="relative w-48 h-48 mx-auto mb-6">
                  {/* Cuadro exterior animado */}
                  <div className="absolute inset-0 border-2 border-gray-200 dark:border-gray-700 rounded-xl animate-pulse"></div>
                  {/* Cuadrícula simulada */}
                  <div className="absolute inset-4 grid grid-cols-5 gap-1">
                    {[...Array(25)].map((_, i) => (
                      <div 
                        key={i} 
                        className="bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse"
                        style={{ animationDelay: `${i * 50}ms` }}
                      />
                    ))}
                  </div>
                  {/* Icono central */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-lg flex items-center justify-center shadow-sm">
                      <Icon icon="solar:qr-code-bold-duotone" className="text-gray-400 animate-pulse" width={28} />
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Generando código QR...</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Esto puede tomar unos segundos</p>
              </div>
            ) : showConnectionSuccess ? (
              <div className="py-12">
                {/* Animación de éxito */}
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Icon icon="solar:check-circle-bold" className="text-green-500" width={48} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">¡Conectado exitosamente!</h3>
                <p className="text-gray-500 mt-1">Tu WhatsApp está listo para usar</p>
              </div>
            ) : qrCode ? (
              <div className="space-y-4">
                <div className="bg-white p-3 rounded-xl inline-block shadow-sm border border-gray-100">
                  <img 
                    src={qrCode} 
                    alt="QR Code" 
                    className="w-56 h-56 mx-auto"
                  />
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg text-left">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                    Instrucciones:
                  </h4>
                  <ol className="text-sm text-gray-500 dark:text-gray-400 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                      <span>Abre WhatsApp en tu teléfono</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                      <span>Ve a Configuración → Dispositivos vinculados</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
                      <span>Toca "Vincular un dispositivo"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">4</span>
                      <span>Escanea este código QR</span>
                    </li>
                  </ol>
                </div>
                <div className="flex justify-center">
                  <Button color="light" size="sm" onClick={handleRefreshQR}>
                    <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
                    Refrescar QR
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-12">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Icon icon="solar:check-circle-bold" className="text-green-500" width={48} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">¡Conectado exitosamente!</h3>
                <p className="text-gray-500 mt-1">Tu WhatsApp está listo para usar</p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-center w-full">
            <Button color="gray" onClick={() => setShowQRModal(false)}>
              Cerrar
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Modal de Selección de Tipo de Conexión */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="xl">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:add-circle-bold-duotone" className="text-primary" width={24} />
            <span>Nueva Conexión WhatsApp</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            <p className="text-gray-500 dark:text-gray-400">
              Selecciona el tipo de conexión que deseas configurar:
            </p>

            {/* Opciones de tipo de conexión */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opción Cloud API (PRIMERO) */}
              <div
                onClick={() => setSelectedConnectionType('cloud_api')}
                className={`cursor-pointer p-5 rounded-xl border-2 transition-all ${
                  selectedConnectionType === 'cloud_api'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${selectedConnectionType === 'cloud_api' ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Icon icon="logos:meta" className={selectedConnectionType === 'cloud_api' ? '' : 'grayscale opacity-50'} width={28} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Cloud API</h4>
                    <p className="text-xs text-gray-500">API Oficial de Meta</p>
                  </div>
                  {selectedConnectionType === 'cloud_api' && (
                    <Icon icon="solar:check-circle-bold" className="text-primary ml-auto" width={20} />
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Usa la API oficial de WhatsApp Business. Requiere cuenta de Meta Business verificada.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge color="success" size="sm">Recomendado</Badge>
                  <Badge color="info" size="sm">Oficial</Badge>
                  <Badge color="gray" size="sm">Sin riesgo de bloqueo</Badge>
                </div>
              </div>

              {/* Opción Baileys (QR) - SEGUNDO */}
              <div
                onClick={() => setSelectedConnectionType('baileys')}
                className={`cursor-pointer p-5 rounded-xl border-2 transition-all ${
                  selectedConnectionType === 'baileys'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${selectedConnectionType === 'baileys' ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Icon icon="solar:qr-code-bold-duotone" className={selectedConnectionType === 'baileys' ? 'text-primary' : 'text-gray-500'} width={28} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Escaneo QR</h4>
                    <p className="text-xs text-gray-500">Conexión directa</p>
                  </div>
                  {selectedConnectionType === 'baileys' && (
                    <Icon icon="solar:check-circle-bold" className="text-primary ml-auto" width={20} />
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Conecta escaneando un código QR desde tu WhatsApp. Ideal para pruebas.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge color="gray" size="sm">Gratis</Badge>
                  <Badge color="gray" size="sm">Fácil configuración</Badge>
                </div>
              </div>
            </div>

            {/* Nota informativa para Escaneo QR */}
            {selectedConnectionType === 'baileys' && (
              <Alert color="gray" className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:info-circle-bold" width={20} className="flex-shrink-0 text-gray-500 mt-0.5" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Importante sobre esta conexión</p>
                    <p>
                      Esta conexión no es oficial de Meta. Evita enviar mensajes masivos o a contactos que no te hayan escrito primero para prevenir restricciones en tu línea.
                    </p>
                  </div>
                </div>
              </Alert>
            )}

            {/* Formulario para Cloud API */}
            {selectedConnectionType === 'cloud_api' && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Icon icon="solar:settings-bold" width={18} />
                  Configuración de Cloud API
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number ID *
                    </label>
                    <input
                      type="text"
                      value={cloudApiForm.phone_id}
                      onChange={(e) => setCloudApiForm(prev => ({ ...prev, phone_id: e.target.value }))}
                      placeholder="Ej: 123456789012345"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Business Account ID
                    </label>
                    <input
                      type="text"
                      value={cloudApiForm.business_id}
                      onChange={(e) => setCloudApiForm(prev => ({ ...prev, business_id: e.target.value }))}
                      placeholder="Ej: 123456789012345"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Access Token *
                    </label>
                    <input
                      type="password"
                      value={cloudApiForm.token}
                      onChange={(e) => setCloudApiForm(prev => ({ ...prev, token: e.target.value }))}
                      placeholder="Token de acceso permanente"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Verify Token (para Webhook)
                    </label>
                    <input
                      type="text"
                      value={cloudApiForm.verify_token}
                      onChange={(e) => setCloudApiForm(prev => ({ ...prev, verify_token: e.target.value }))}
                      placeholder="Token de verificación personalizado"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <Alert color="info" className="mt-3">
                  <div className="flex items-start gap-2">
                    <Icon icon="solar:info-circle-bold" width={18} className="flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">¿Cómo obtener estos datos?</p>
                      <p className="mt-1">Ve a <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">developers.facebook.com</a> → Tu App → WhatsApp → Configuración de API</p>
                    </div>
                  </div>
                </Alert>
              </div>
            )}

            {error && (
              <Alert color="failure" onDismiss={() => setError(null)}>
                <Icon icon="solar:danger-triangle-bold" className="mr-2" width={18} />
                {error}
              </Alert>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end gap-3 w-full">
            <Button color="gray" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button 
              color="primary" 
              onClick={handleCreateInstance}
              disabled={creatingInstance}
            >
              {creatingInstance ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creando...
                </>
              ) : (
                <>
                  <Icon icon="solar:add-circle-bold" className="mr-2" width={18} />
                  {selectedConnectionType === 'baileys' ? 'Crear y Escanear QR' : 'Configurar Cloud API'}
                </>
              )}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default WhatsAppConexiones;
