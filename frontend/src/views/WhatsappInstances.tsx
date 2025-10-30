import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/shadcn-ui/Default-Ui/dialog';
import whatsappMicroserviceDirect from 'src/services/whatsappMicroserviceDirect';
import { Card, CardContent, CardHeader, CardTitle } from '../components/shadcn-ui/Default-Ui/card';
import { Button } from '../components/shadcn-ui/Default-Ui/button';
import { Input } from '../components/shadcn-ui/Default-Ui/input';
import { Label } from '../components/shadcn-ui/Default-Ui/label';
import { Alert, AlertDescription } from '../components/shadcn-ui/Default-Ui/alert';
import { Plus, Smartphone, RefreshCw, Activity, Power, PowerOff, QrCode, Trash2, X } from 'lucide-react';

const WhatsAppInstances: React.FC = () => {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrExpiry, setQrExpiry] = useState<string>('');
  const [refreshingInstances, setRefreshingInstances] = useState<number[]>([]);
  const [stats, setStats] = useState({
    total_instances: 0,
    connected_instances: 0,
    connecting_instances: 0,
    disconnected_instances: 0,
    error_instances: 0,
  });

  // Estados para crear nueva instancia (tipado explícito para evitar implicit any)
  interface NewInstance {
    phone_number: string;
    webhook_url: string;
    settings: Record<string, any>;
  }
  const [newInstance, setNewInstance] = useState<NewInstance>({
    phone_number: '',
    webhook_url: '',
    settings: {}
  });
  const [creating, setCreating] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'connected': { text: 'Conectado', color: 'green' },
      'connecting': { text: 'Conectando', color: 'blue' },
      'disconnected': { text: 'Desconectado', color: 'gray' },
      'error': { text: 'Error', color: 'red' },
      'qr_pending': { text: 'QR Pendiente', color: 'yellow' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { text: status, color: 'gray' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
        {config.text}
      </span>
    );
  };

  const formatLastActivity = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  useEffect(() => {
    loadInstances();
    loadStats();
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(() => {
      loadInstances();
      loadStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const response = await whatsappMicroserviceDirect.getStats();
      if (response.success) {
        // Simulamos instancias basadas en las estadísticas
        const mockInstances = [];
        for (let i = 0; i < response.data.total_instances; i++) {
          mockInstances.push({
            id: i + 1,
            instance_id: `instance_${i + 1}`,
            phone_number: `+57300123456${i}`,
            status: i < response.data.connected_instances ? 'connected' : 'disconnected',
            is_active: i < response.data.connected_instances,
            session_id: `session_${i + 1}`,
            last_activity_at: new Date().toISOString(),
            reconnect_attempts: 0
          });
        }
        setInstances(mockInstances);
      } else {
        alert(response.message || 'Error al cargar instancias');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await whatsappMicroserviceDirect.getStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreateInstance = async () => {
    if (!newInstance.phone_number) {
      alert('El número de teléfono es requerido');
      return;
    }

    setCreating(true);
    try {
      // Forzar header detrás de la modal
      const header = document.querySelector('header');
      if (header) {
        header.style.zIndex = '0';
      }

      // Por ahora solo simularemos la creación
      alert('Instancia creada correctamente (simulado)');
      setIsCreateModalOpen(false);
      setNewInstance({ phone_number: '', webhook_url: '', settings: {} });
      loadInstances();
      loadStats();
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setCreating(false);
      // Restaurar z-index del header
      const header = document.querySelector('header');
      if (header) {
        header.style.zIndex = '10';
      }
    }
  };

  const handleShowQR = async (instance: any) => {
    if (!instance.id) return;

    // Forzar header detrás de la modal antes de abrir
    const header = document.querySelector('header');
    if (header) {
      header.style.zIndex = '0';
    }

    setSelectedInstance(instance);
    setQrCode('');
    setIsQRModalOpen(true);

    try {
      const response = await whatsappMicroserviceDirect.getQRCode();
      if (response.success && response.qr) {
        setQrCode(response.qr);
        setQrExpiry(''); // El servicio no retorna expires_at
      } else {
        alert(response.message || 'Error al obtener código QR');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const handleRefreshStatus = async (instanceId: number) => {
    setRefreshingInstances(prev => [...prev, instanceId]);
    
    try {
      const response = await whatsappMicroserviceDirect.getConnectionStatus();
      if (response.success) {
        // Mapear a un string de estado
        const newStatus = response.connected
          ? 'connected'
          : (response.connecting ? 'connecting' : 'disconnected');
        setInstances(prev => prev.map(instance =>
          instance.id === instanceId
            ? { ...instance, status: newStatus }
            : instance
        ));
        alert('Estado actualizado');
      } else {
        alert(response.message || 'Error al actualizar estado');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setRefreshingInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  const handleRestartInstance = async (instanceId: number) => {
    try {
      const response = await whatsappMicroserviceDirect.reconnect();
      if (response.success) {
        alert(response.message);
        loadInstances();
      } else {
        alert(response.message || 'Error al reiniciar instancia');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const handleDisconnectInstance = async (instanceId: number) => {
    try {
      const response = await whatsappMicroserviceDirect.disconnect();
      if (response.success) {
        alert(response.message);
        loadInstances();
      } else {
        alert(response.message || 'Error al desconectar instancia');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const handleDeleteInstance = async (instanceId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta instancia?')) {
      return;
    }

    try {
      // No existe deleteInstance en el servicio directo; usamos resetConnection como "eliminar sesión"
      const response = await whatsappMicroserviceDirect.resetConnection();
      if (response.success) {
        alert(response.message);
        loadInstances();
        loadStats();
      } else {
        alert(response.message || 'Error al resetear la instancia');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header y estadísticas */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Instancias WhatsApp</h1>
          <p className="text-muted-foreground">Gestiona tus conexiones de WhatsApp</p>
        </div>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nueva Instancia
        </Button>
      </div>

      {/* Cards de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_instances}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conectadas</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.connected_instances}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conectando</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.connecting_instances}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desconectadas</CardTitle>
            <PowerOff className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.disconnected_instances}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Error</CardTitle>
            <Power className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.error_instances}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de instancias */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Mis Instancias</CardTitle>
              <p className="text-sm text-muted-foreground">Administra tus conexiones de WhatsApp</p>
            </div>
            <Button 
              variant="outline" 
              onClick={loadInstances}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando instancias...</p>
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8">
              <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No hay instancias</h3>
              <p className="text-muted-foreground mb-4">Crea tu primera instancia de WhatsApp para comenzar</p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Instancia
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {instances.map((instance) => (
                <Card key={instance.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Smartphone className="h-5 w-5" />
                        <div>
                          <h3 className="font-semibold">{instance.phone_number || instance.instance_id}</h3>
                          <p className="text-sm text-muted-foreground">ID: {instance.instance_id}</p>
                        </div>
                        {getStatusBadge(instance.status)}
                      </div>

                      {instance.error_message && (
                        <Alert className="mb-3">
                          <AlertDescription>{instance.error_message}</AlertDescription>
                        </Alert>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Session ID</p>
                          <p className="font-mono text-xs">{instance.session_id || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Última actividad</p>
                          <p>{formatLastActivity(instance.last_activity_at)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Reintentos</p>
                          <p>{instance.reconnect_attempts}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Estado</p>
                          <p className={instance.is_active ? 'text-green-600' : 'text-gray-600'}>
                            {instance.is_active ? 'Activa' : 'Inactiva'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {/* Botón QR */}
                      {(instance.status === 'qr_pending' || instance.status === 'disconnected') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShowQR(instance)}
                          className="flex items-center gap-1"
                        >
                          <QrCode className="h-4 w-4" />
                          QR
                        </Button>
                      )}

                      {/* Botón Actualizar estado */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => instance.id && handleRefreshStatus(instance.id)}
                        disabled={refreshingInstances.includes(instance.id!)}
                        className="flex items-center gap-1"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshingInstances.includes(instance.id!) ? 'animate-spin' : ''}`} />
                        Estado
                      </Button>

                      {/* Botón Reiniciar */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => instance.id && handleRestartInstance(instance.id)}
                        className="flex items-center gap-1"
                      >
                        <Power className="h-4 w-4" />
                        Reiniciar
                      </Button>

                      {/* Botón Desconectar */}
                      {(instance.status === 'connected' || instance.status === 'authenticated') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => instance.id && handleDisconnectInstance(instance.id)}
                          className="flex items-center gap-1"
                        >
                          <PowerOff className="h-4 w-4" />
                          Desconectar
                        </Button>
                      )}

                      {/* Botón Eliminar */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => instance.id && handleDeleteInstance(instance.id)}
                        className="flex items-center gap-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para crear nueva instancia */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Instancia WhatsApp</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Número de Teléfono</Label>
              <Input
                id="phone"
                placeholder="Ej: +573001234567"
                value={newInstance.phone_number}
                onChange={(e) => setNewInstance(prev => ({ ...prev, phone_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook">Webhook URL (Opcional)</Label>
              <Input
                id="webhook"
                placeholder="https://tu-dominio.com/webhook"
                value={newInstance.webhook_url}
                onChange={(e) => setNewInstance(prev => ({ ...prev, webhook_url: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateInstance} disabled={creating}>
              {creating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Instancia'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para mostrar QR */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Código QR - WhatsApp</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center space-y-4 py-4">
            {qrCode ? (
              <>
                <div className="bg-white p-4 rounded-lg border">
                  <img
                    src={qrCode}
                    alt="Código QR de WhatsApp"
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                {qrExpiry && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Expira: {new Date(qrExpiry).toLocaleString()}
                  </p>
                )}
                <Alert>
                  <AlertDescription>
                    1. Abre WhatsApp en tu teléfono<br/>
                    2. Ve a Configuración → Dispositivos vinculados<br/>
                    3. Toca "Vincular un dispositivo"<br/>
                    4. Escanea este código QR
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <p>Generando código QR...</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsQRModalOpen(false)}>
              Cerrar
            </Button>
            {selectedInstance?.id && (
              <Button onClick={() => handleShowQR(selectedInstance)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar QR
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppInstances;
