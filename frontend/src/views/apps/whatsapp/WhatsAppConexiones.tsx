import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Badge, Button, Spinner, Modal, Alert, Table, Tooltip } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import whatsappInstanceService, { CreateInstanceRequest } from 'src/services/whatsappInstanceService';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useToast } from 'src/hooks/use-toast';

// Meta App ID for Embedded Signup
const META_APP_ID = '1851158175529745';
const META_CONFIG_ID = '894753990185576';

interface LocalInstance {
  id: number;
  instance_id: string;
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

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

const WhatsAppConexiones: React.FC = () => {
  const { user: _user } = useUnifiedAuth();
  const { toast } = useToast();
  const [instances, setInstances] = useState<LocalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [refreshingInstances, setRefreshingInstances] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'embedded' | 'manual'>('embedded');
  const [embeddedSignupLoading, setEmbeddedSignupLoading] = useState(false);
  const [fbSdkReady, setFbSdkReady] = useState(false);
  const fbInitRef = useRef(false);
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

  // Load Facebook SDK only when modal opens (avoid DOM conflicts with React)
  const loadFbSdk = useCallback(() => {
    if (window.FB) {
      setFbSdkReady(true);
      return;
    }
    if (fbInitRef.current) return;
    fbInitRef.current = true;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: false,
        version: 'v22.0',
      });
      setFbSdkReady(true);
    };

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

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

  // Abrir modal para crear conexión Cloud API
  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setConnectionMethod('embedded');
    setCloudApiForm({ phone_id: '', business_id: '', token: '', verify_token: '' });
    setError(null);
    loadFbSdk();
  };

  // Embedded Signup: Launch Facebook Login with WhatsApp Embedded Signup
  const handleEmbeddedSignup = () => {
    if (!window.FB) {
      setError('Facebook SDK no está cargado. Recarga la página e intenta de nuevo.');
      return;
    }

    setEmbeddedSignupLoading(true);
    setError(null);

    console.log('🚀 [EMBEDDED SIGNUP] Launching FB.login with config_id:', META_CONFIG_ID);

    // FB.login callback MUST be a regular function (not async)
    window.FB.login(
      (response: any) => {
        console.log('📥 [EMBEDDED SIGNUP] FB.login response:', JSON.stringify(response));

        if (response.authResponse) {
          const code = response.authResponse.code;
          console.log('✅ [EMBEDDED SIGNUP] Got code:', code ? 'yes' : 'no');

          if (code) {
            // Handle async work outside the callback
            whatsappInstanceService.embeddedSignup(code)
              .then((result) => {
                if (result.success) {
                  setShowCreateModal(false);
                  toast({
                    title: 'WhatsApp Conectado',
                    description: result.message || 'Tu línea de WhatsApp ha sido conectada exitosamente.',
                  });
                  loadInstances();
                } else {
                  setError(result.message || 'Error al completar la conexión');
                }
              })
              .catch((err: any) => {
                console.error('❌ [EMBEDDED SIGNUP] Backend error:', err);
                setError(err.message || 'Error procesando la respuesta de Meta');
              })
              .finally(() => {
                setEmbeddedSignupLoading(false);
              });
            return; // Don't set loading false yet
          } else {
            setError('No se recibió código de autorización de Meta');
          }
        } else {
          console.warn('⚠️ [EMBEDDED SIGNUP] No authResponse:', response);
          if (response.status === 'unknown') {
            setError('El popup fue cerrado o bloqueado. Permite ventanas emergentes e intenta de nuevo.');
          } else {
            setError('El proceso de conexión fue cancelado. Intenta de nuevo.');
          }
        }
        setEmbeddedSignupLoading(false);
      },
      {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '2',
        },
      }
    );
  };

  // Crear nueva instancia Cloud API
  const handleCreateInstance = async () => {
    try {
      setCreatingInstance(true);
      setError(null);

      if (!cloudApiForm.phone_id || !cloudApiForm.token) {
        setError('El Phone ID y el Token son obligatorios');
        setCreatingInstance(false);
        return;
      }
      
      const instanceData: CreateInstanceRequest = {
        connection_type: 'cloud_api',
        phone_number: '',
        webhook_url: '',
        settings: {},
        cloud_api_phone_id: cloudApiForm.phone_id,
        cloud_api_business_id: cloudApiForm.business_id,
        cloud_api_token: cloudApiForm.token,
        cloud_api_verify_token: cloudApiForm.verify_token,
      };
      
      const response = await whatsappInstanceService.createInstance(instanceData);

      if (response.success && response.data) {
        setShowCreateModal(false);
        toast({
          title: "Conexión Creada",
          description: "La conexión con Cloud API ha sido configurada exitosamente.",
        });
        await loadInstances();
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

  // Helpers
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'connected': 'Conectado',
      'authenticated': 'Autenticado',
      'connecting': 'Conectando...',
      'disconnected': 'Desconectado',
      'error': 'Error',
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
            
            return (
              <Card key={instance.id} className="hover:shadow-lg transition-all hover:border-primary/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Icon 
                        icon={connected ? "solar:smartphone-bold-duotone" : "solar:smartphone-outline"} 
                        className={connected ? 'text-green-500' : 'text-gray-400'} 
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
                    color={connected ? 'success' : 'gray'}
                    className="text-xs"
                  >
                    <span className={`w-2 h-2 rounded-full mr-1.5 inline-block ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
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
                      <Badge color="info" size="xs">
                        <Icon icon="logos:meta" width={10} className="mr-1" /> Cloud API
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
          <div className="guro-table-wrap">
            <table className="guro-table">
              <thead>
                <tr>
                  <th>Conexión</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Última Actividad</th>
                  <th className="sticky-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((instance) => {
                  const connected = instance.status === 'connected' || instance.status === 'authenticated';
                  
                  return (
                    <tr key={instance.id} className="group">
                      <td className="font-medium">
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
                      </td>
                      <td>{instance.phone_number || 'Sin número'}</td>
                      <td>
                        <Badge color={connected ? 'success' : 'gray'}>
                          {getStatusText(instance.status)}
                        </Badge>
                      </td>
                      <td className="text-sm text-gray-500">
                        {instance.last_activity_at ? new Date(instance.last_activity_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="sticky-right">
                        <div className="flex justify-center gap-2">
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
                          <Button 
                            size="xs" 
                            color="light" 
                            onClick={() => handleDeleteInstance(instance.id)}
                            disabled={refreshingInstances.includes(instance.id)}
                          >
                            <Icon icon="solar:trash-bin-trash-bold" className="text-red-500" width={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal de Nueva Conexión */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="logos:whatsapp-icon" width={24} />
            <span>Conectar WhatsApp Business</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-5">
            {/* Method Selector */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <button
                onClick={() => setConnectionMethod('embedded')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  connectionMethod === 'embedded'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon icon="logos:meta" width={16} />
                Conexión automática
              </button>
              <button
                onClick={() => setConnectionMethod('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  connectionMethod === 'manual'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon icon="solar:settings-bold" width={16} />
                Configuración manual
              </button>
            </div>

            {/* ===== EMBEDDED SIGNUP (Primary) ===== */}
            {connectionMethod === 'embedded' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-20 h-20 mx-auto bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-4">
                    <Icon icon="logos:whatsapp-icon" width={44} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Conecta tu WhatsApp en segundos
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
                    Inicia sesión con Facebook, selecciona tu cuenta de negocio y conecta tu número de WhatsApp automáticamente.
                  </p>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: 'solar:login-3-bold-duotone', title: 'Inicia sesión', desc: 'Con tu cuenta de Facebook' },
                    { icon: 'solar:buildings-bold-duotone', title: 'Selecciona negocio', desc: 'Tu Business Manager' },
                    { icon: 'solar:check-circle-bold-duotone', title: 'Listo', desc: 'WhatsApp conectado' },
                  ].map((step, i) => (
                    <div key={i} className="flex flex-col items-center text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mb-2">
                        <Icon icon={step.icon} width={22} className="text-blue-500" />
                      </div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{step.title}</p>
                      <p className="text-[10px] text-gray-400">{step.desc}</p>
                    </div>
                  ))}
                </div>

                <Button
                  color="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleEmbeddedSignup}
                  disabled={embeddedSignupLoading || !fbSdkReady}
                >
                  {embeddedSignupLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Conectando con Meta...
                    </>
                  ) : !fbSdkReady ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Cargando Facebook SDK...
                    </>
                  ) : (
                    <>
                      <Icon icon="logos:facebook" width={18} className="mr-2" />
                      Conectar con Facebook
                    </>
                  )}
                </Button>

                <p className="text-[10px] text-center text-gray-400">
                  Al conectar, autorizas a Guro a gestionar mensajes de WhatsApp Business en tu nombre.
                </p>
              </div>
            )}

            {/* ===== MANUAL CONFIG (Secondary) ===== */}
            {connectionMethod === 'manual' && (
              <div className="space-y-4">
                <Alert color="info">
                  <div className="flex items-start gap-2">
                    <Icon icon="solar:info-circle-bold" width={18} className="flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Configuración avanzada</p>
                      <p className="mt-1">Ingresa manualmente los datos de tu WhatsApp Cloud API desde <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">developers.facebook.com</a></p>
                    </div>
                  </div>
                </Alert>

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

                <Button
                  color="primary"
                  className="w-full"
                  onClick={handleCreateInstance}
                  disabled={creatingInstance}
                >
                  {creatingInstance ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Configurando...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:add-circle-bold" className="mr-2" width={18} />
                      Configurar Cloud API
                    </>
                  )}
                </Button>
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
      </Modal>
    </div>
  );
};

export default WhatsAppConexiones;
