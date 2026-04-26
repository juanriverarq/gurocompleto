import { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Modal, Table, TextInput, ToggleSwitch } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/integraciones",
    title: "Integraciones",
  },
  {
    title: "Servicios de Terceros",
  },
];

interface ServicioTercero {
  id: string;
  nombre: string;
  categoria: 'comunicacion' | 'almacenamiento' | 'pago' | 'documentos' | 'mapas' | 'verificacion' | 'analytics';
  proveedor: string;
  descripcion: string;
  estado: 'activo' | 'inactivo' | 'configurando' | 'error';
  tipo_integracion: 'api' | 'webhook' | 'sdk' | 'plugin';
  url_servicio?: string;
  version_api?: string;
  metodo_autenticacion: 'api_key' | 'oauth2' | 'bearer_token' | 'basic_auth';
  configuracion: { [key: string]: any };
  limites: {
    requests_diarios: number;
    requests_utilizados: number;
    costo_por_request?: number;
  };
  metricas: {
    uptime: number;
    tiempo_respuesta_promedio: number;
    requests_exitosos: number;
    requests_fallidos: number;
  };
  ultima_actividad: string;
  fecha_integracion: string;
  configurado_por: string;
  documentacion_url?: string;
  soporte_contacto?: string;
}

interface LogServicio {
  id: string;
  servicio_id: string;
  timestamp: string;
  accion: string;
  estado: 'exitoso' | 'fallido' | 'pendiente';
  detalles: string;
  tiempo_respuesta: number;
  costo?: number;
  usuario: string;
  error_mensaje?: string;
}

const ServiciosTerceros = () => {
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarLogs, setMostrarLogs] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<ServicioTercero | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [estadisticas, setEstadisticas] = useState({
    total_servicios: 0,
    servicios_activos: 0,
    requests_hoy: 0,
    costo_mensual: 0,
    servicios_error: 0
  });

  const [servicios, setServicios] = useState<ServicioTercero[]>([]);
  const [logs, setLogs] = useState<LogServicio[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setEstadisticas({
        total_servicios: 12,
        servicios_activos: 10,
        requests_hoy: 2847,
        costo_mensual: 245.50,
        servicios_error: 1
      });

      setServicios([
        {
          id: 'SRV-001',
          nombre: 'WhatsApp Business API',
          categoria: 'comunicacion',
          proveedor: 'Meta',
          descripcion: 'Envío de mensajes y notificaciones por WhatsApp',
          estado: 'activo',
          tipo_integracion: 'api',
          url_servicio: 'https://graph.facebook.com/v18.0',
          version_api: 'v18.0',
          metodo_autenticacion: 'bearer_token',
          configuracion: {
            phone_number_id: '***hidden***',
            business_account_id: '***hidden***',
            webhook_url: 'https://api.nuestrosistema.com/webhooks/whatsapp'
          },
          limites: {
            requests_diarios: 10000,
            requests_utilizados: 2847,
            costo_por_request: 0.005
          },
          metricas: {
            uptime: 99.8,
            tiempo_respuesta_promedio: 245,
            requests_exitosos: 2798,
            requests_fallidos: 49
          },
          ultima_actividad: '16/01/2025 14:30',
          fecha_integracion: '15/11/2024',
          configurado_por: 'admin',
          documentacion_url: 'https://developers.facebook.com/docs/whatsapp',
          soporte_contacto: 'whatsapp-support@meta.com'
        },
        {
          id: 'SRV-002',
          nombre: 'AWS S3 Storage',
          categoria: 'almacenamiento',
          proveedor: 'Amazon Web Services',
          descripcion: 'Almacenamiento de documentos y archivos en la nube',
          estado: 'activo',
          tipo_integracion: 'sdk',
          url_servicio: 'https://s3.amazonaws.com',
          metodo_autenticacion: 'api_key',
          configuracion: {
            bucket_name: 'seguros-documentos',
            region: 'us-east-1',
            encryption: 'AES256'
          },
          limites: {
            requests_diarios: 50000,
            requests_utilizados: 8934,
            costo_por_request: 0.0004
          },
          metricas: {
            uptime: 99.9,
            tiempo_respuesta_promedio: 89,
            requests_exitosos: 8856,
            requests_fallidos: 78
          },
          ultima_actividad: '16/01/2025 14:25',
          fecha_integracion: '20/10/2024',
          configurado_por: 'carlos.mendoza',
          documentacion_url: 'https://docs.aws.amazon.com/s3/',
          soporte_contacto: 'aws-support@amazon.com'
        },
        {
          id: 'SRV-003',
          nombre: 'Twilio SMS',
          categoria: 'comunicacion',
          proveedor: 'Twilio',
          descripcion: 'Envío de SMS y notificaciones móviles',
          estado: 'activo',
          tipo_integracion: 'api',
          url_servicio: 'https://api.twilio.com/2010-04-01',
          version_api: '2010-04-01',
          metodo_autenticacion: 'basic_auth',
          configuracion: {
            account_sid: '***hidden***',
            from_number: '+1234567890'
          },
          limites: {
            requests_diarios: 5000,
            requests_utilizados: 1247,
            costo_por_request: 0.0075
          },
          metricas: {
            uptime: 99.5,
            tiempo_respuesta_promedio: 156,
            requests_exitosos: 1198,
            requests_fallidos: 49
          },
          ultima_actividad: '16/01/2025 14:20',
          fecha_integracion: '05/12/2024',
          configurado_por: 'ana.garcia',
          documentacion_url: 'https://www.twilio.com/docs/sms',
          soporte_contacto: 'help@twilio.com'
        },
        {
          id: 'SRV-004',
          nombre: 'SendGrid Email',
          categoria: 'comunicacion',
          proveedor: 'SendGrid',
          descripcion: 'Envío de emails transaccionales y marketing',
          estado: 'activo',
          tipo_integracion: 'api',
          url_servicio: 'https://api.sendgrid.com/v3',
          version_api: 'v3',
          metodo_autenticacion: 'bearer_token',
          configuracion: {
            from_email: 'noreply@empresa.com',
            from_name: 'Sistema de Seguros',
            template_ids: {
              bienvenida: 'd-12345',
              poliza_creada: 'd-67890'
            }
          },
          limites: {
            requests_diarios: 100000,
            requests_utilizados: 3456,
            costo_por_request: 0.0006
          },
          metricas: {
            uptime: 99.7,
            tiempo_respuesta_promedio: 198,
            requests_exitosos: 3398,
            requests_fallidos: 58
          },
          ultima_actividad: '16/01/2025 14:15',
          fecha_integracion: '18/09/2024',
          configurado_por: 'miguel.torres',
          documentacion_url: 'https://docs.sendgrid.com/',
          soporte_contacto: 'support@sendgrid.com'
        },
        {
          id: 'SRV-005',
          nombre: 'Google Maps API',
          categoria: 'mapas',
          proveedor: 'Google',
          descripcion: 'Geocodificación y mapas para ubicaciones',
          estado: 'activo',
          tipo_integracion: 'api',
          url_servicio: 'https://maps.googleapis.com/maps/api',
          metodo_autenticacion: 'api_key',
          configuracion: {
            enabled_apis: ['geocoding', 'places', 'directions'],
            restrictions: {
              domains: ['nuestrosistema.com']
            }
          },
          limites: {
            requests_diarios: 25000,
            requests_utilizados: 892,
            costo_por_request: 0.002
          },
          metricas: {
            uptime: 99.9,
            tiempo_respuesta_promedio: 124,
            requests_exitosos: 876,
            requests_fallidos: 16
          },
          ultima_actividad: '16/01/2025 13:45',
          fecha_integracion: '10/01/2025',
          configurado_por: 'laura.martinez',
          documentacion_url: 'https://developers.google.com/maps/documentation',
          soporte_contacto: 'maps-api-support@google.com'
        },
        {
          id: 'SRV-006',
          nombre: 'DocuSign eSignature',
          categoria: 'documentos',
          proveedor: 'DocuSign',
          descripcion: 'Firma electrónica de documentos y contratos',
          estado: 'error',
          tipo_integracion: 'api',
          url_servicio: 'https://demo.docusign.net/restapi',
          version_api: 'v2.1',
          metodo_autenticacion: 'oauth2',
          configuracion: {
            integration_key: '***hidden***',
            callback_url: 'https://api.nuestrosistema.com/callbacks/docusign'
          },
          limites: {
            requests_diarios: 1000,
            requests_utilizados: 45,
            costo_por_request: 0.50
          },
          metricas: {
            uptime: 95.2,
            tiempo_respuesta_promedio: 0,
            requests_exitosos: 38,
            requests_fallidos: 7
          },
          ultima_actividad: '16/01/2025 12:30',
          fecha_integracion: '25/11/2024',
          configurado_por: 'admin',
          documentacion_url: 'https://developers.docusign.com/',
          soporte_contacto: 'apisupport@docusign.com'
        }
      ]);

      setLogs([
        {
          id: 'LOG-001',
          servicio_id: 'SRV-001',
          timestamp: '16/01/2025 14:30:15',
          accion: 'Envío mensaje WhatsApp',
          estado: 'exitoso',
          detalles: 'Notificación de póliza creada enviada al cliente',
          tiempo_respuesta: 245,
          costo: 0.005,
          usuario: 'sistema'
        },
        {
          id: 'LOG-002',
          servicio_id: 'SRV-002',
          timestamp: '16/01/2025 14:25:30',
          accion: 'Subida archivo S3',
          estado: 'exitoso',
          detalles: 'Documento póliza_12345.pdf subido correctamente',
          tiempo_respuesta: 89,
          costo: 0.0004,
          usuario: 'carlos.mendoza'
        },
        {
          id: 'LOG-003',
          servicio_id: 'SRV-006',
          timestamp: '16/01/2025 12:30:45',
          accion: 'Crear sobre firma',
          estado: 'fallido',
          detalles: 'Error al crear sobre de firma para contrato',
          tiempo_respuesta: 0,
          error_mensaje: 'OAuth token expired - Authentication required',
          usuario: 'ana.garcia'
        },
        {
          id: 'LOG-004',
          servicio_id: 'SRV-004',
          timestamp: '16/01/2025 14:15:20',
          accion: 'Envío email transaccional',
          estado: 'exitoso',
          detalles: 'Email de bienvenida enviado a nuevo cliente',
          tiempo_respuesta: 198,
          costo: 0.0006,
          usuario: 'sistema'
        }
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const obtenerColorEstado = (estado: string) => {
    const colores = {
      'activo': 'bg-green-100 text-green-800',
      'inactivo': 'bg-gray-100 text-gray-800',
      'configurando': 'bg-blue-100 text-blue-800',
      'error': 'bg-red-100 text-red-800'
    };
    return colores[estado as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorCategoria = (categoria: string) => {
    const colores = {
      'comunicacion': 'bg-blue-100 text-blue-800',
      'almacenamiento': 'bg-green-100 text-green-800',
      'pago': 'bg-yellow-100 text-yellow-800',
      'documentos': 'bg-purple-100 text-purple-800',
      'mapas': 'bg-orange-100 text-orange-800',
      'verificacion': 'bg-red-100 text-red-800',
      'analytics': 'bg-indigo-100 text-indigo-800'
    };
    return colores[categoria as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerIconoCategoria = (categoria: string) => {
    const iconos = {
      'comunicacion': 'solar:chat-round-bold',
      'almacenamiento': 'solar:cloud-bold',
      'pago': 'solar:card-bold',
      'documentos': 'solar:document-bold',
      'mapas': 'solar:map-bold',
      'verificacion': 'solar:shield-check-bold',
      'analytics': 'solar:chart-2-bold'
    };
    return iconos[categoria as keyof typeof iconos] || 'solar:server-bold';
  };

  const obtenerColorLog = (estado: string) => {
    const colores = {
      'exitoso': 'bg-green-100 text-green-800',
      'fallido': 'bg-red-100 text-red-800',
      'pendiente': 'bg-yellow-100 text-yellow-800'
    };
    return colores[estado as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const probarServicio = async (servicio: ServicioTercero) => {
    // Simular prueba de servicio
    setTimeout(() => {
      alert(`Prueba de ${servicio.nombre} - ${servicio.estado === 'activo' ? 'Exitosa' : 'Fallida'}`);
    }, 1000);
  };

  const toggleEstadoServicio = (servicio: ServicioTercero) => {
    const nuevoEstado = servicio.estado === 'activo' ? 'inactivo' : 'activo';
    setServicios(prev => prev.map(s => 
      s.id === servicio.id ? { ...s, estado: nuevoEstado } : s
    ));
  };

  const formatearCosto = (costo: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(costo);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Servicios de Terceros" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Servicios de Terceros</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Integración y gestión de servicios externos y APIs de terceros.
        </p>
      </div>

      {/* Alertas */}
      {estadisticas.servicios_error > 0 && (
        <Alert color="failure" className="mb-6">
          <Icon icon="solar:danger-triangle-bold" className="mr-2" width={20} />
          <span>
            <strong>{estadisticas.servicios_error} servicio(s)</strong> presentan errores y requieren atención.
          </span>
        </Alert>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon="solar:server-bold" className="text-primary" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.total_servicios}</h3>
              <p className="text-xs text-gray-500">Total Servicios</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.servicios_activos}</h3>
              <p className="text-xs text-gray-500">Activos</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Icon icon="solar:transfer-horizontal-bold" className="text-info" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.requests_hoy.toLocaleString()}</h3>
              <p className="text-xs text-gray-500">Requests Hoy</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon icon="solar:dollar-minimalistic-bold" className="text-warning" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{formatearCosto(estadisticas.costo_mensual)}</h3>
              <p className="text-xs text-gray-500">Costo Mensual</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Icon icon="solar:close-circle-bold" className="text-red-600 dark:text-red-400" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.servicios_error}</h3>
              <p className="text-xs text-gray-500">Con Error</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros y Acciones */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Buscar Servicio</label>
              <TextInput
                placeholder="Nombre o proveedor..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                icon={() => <Icon icon="solar:magnifer-bold" width={16} />}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Categoría</label>
              <select 
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm w-full"
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              >
                <option value="todos">Todas las Categorías</option>
                <option value="comunicacion">Comunicación</option>
                <option value="almacenamiento">Almacenamiento</option>
                <option value="pago">Pagos</option>
                <option value="documentos">Documentos</option>
                <option value="mapas">Mapas</option>
                <option value="verificacion">Verificación</option>
                <option value="analytics">Analytics</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select 
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm w-full"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="configurando">Configurando</option>
                <option value="error">Error</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <HeroButton icon="solar:add-circle-bold" size="sm">Nuevo Servicio</HeroButton>
              <Button color="gray" size="sm" onClick={() => setMostrarLogs(true)}>
                <Icon icon="solar:document-text-bold" className="mr-2" width={16} />
                Ver Logs
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button color="info" size="sm">
                <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
                Sincronizar
              </Button>
              <Button color="gray" size="sm">
                <Icon icon="solar:export-bold" className="mr-2" width={16} />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Servicios */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Servicios Configurados ({servicios.length})</h3>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Servicio</Table.HeadCell>
                <Table.HeadCell>Categoría</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Proveedor</Table.HeadCell>
                <Table.HeadCell>Uso Diario</Table.HeadCell>
                <Table.HeadCell>Rendimiento</Table.HeadCell>
                <Table.HeadCell>Costo</Table.HeadCell>
                <Table.HeadCell>Última Actividad</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {servicios.map((servicio) => (
                  <Table.Row key={servicio.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <Icon icon={obtenerIconoCategoria(servicio.categoria)} width={20} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{servicio.nombre}</p>
                          <p className="text-xs text-gray-500">{servicio.descripcion}</p>
                          <p className="text-xs text-blue-600">{servicio.tipo_integracion.toUpperCase()}</p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorCategoria(servicio.categoria)} size="sm">
                        {servicio.categoria}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorEstado(servicio.estado)} size="sm">
                        {servicio.estado}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold">{servicio.proveedor}</p>
                        <p className="text-gray-500">{servicio.version_api || 'N/A'}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold">{servicio.limites.requests_utilizados.toLocaleString()}</p>
                        <p className="text-gray-500">de {servicio.limites.requests_diarios.toLocaleString()}</p>
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div 
                            className="bg-primary h-1 rounded-full" 
                            style={{ width: `${(servicio.limites.requests_utilizados / servicio.limites.requests_diarios) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold text-green-600">{servicio.metricas.uptime}% uptime</p>
                        <p className="text-gray-500">{servicio.metricas.tiempo_respuesta_promedio}ms</p>
                        <p className="text-xs">
                          <span className="text-green-600">{servicio.metricas.requests_exitosos}</span> / 
                          <span className="text-red-600 ml-1">{servicio.metricas.requests_fallidos}</span>
                        </p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        {servicio.limites.costo_por_request && (
                          <>
                            <p className="font-semibold">{formatearCosto(servicio.limites.costo_por_request)}</p>
                            <p className="text-gray-500 text-xs">por request</p>
                          </>
                        )}
                        {!servicio.limites.costo_por_request && (
                          <p className="text-gray-500">Gratuito</p>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-sm">{servicio.ultima_actividad}</Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button 
                          size="xs" 
                          color="gray"
                          onClick={() => {
                            setServicioSeleccionado(servicio);
                            setMostrarModal(true);
                          }}
                        >
                          <Icon icon="solar:eye-bold" width={14} />
                        </Button>
                        <Button 
                          size="xs" 
                          color="info"
                          onClick={() => probarServicio(servicio)}
                        >
                          <Icon icon="solar:play-bold" width={14} />
                        </Button>
                        <Button 
                          size="xs" 
                          color={servicio.estado === 'activo' ? 'warning' : 'success'}
                          onClick={() => toggleEstadoServicio(servicio)}
                        >
                          <Icon icon={servicio.estado === 'activo' ? 'solar:pause-bold' : 'solar:play-bold'} width={14} />
                        </Button>
                        <Button size="xs" color="primary">
                          <Icon icon="solar:pen-bold" width={14} />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      </Card>

      {/* Modal de Detalle */}
      <Modal show={mostrarModal} onClose={() => setMostrarModal(false)} size="xl">
        <Modal.Header>Detalle de Servicio - {servicioSeleccionado?.nombre}</Modal.Header>
        <Modal.Body>
          {servicioSeleccionado && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Información del Servicio</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Proveedor:</strong> {servicioSeleccionado.proveedor}</p>
                    <p><strong>Categoría:</strong> {servicioSeleccionado.categoria}</p>
                    <p><strong>Tipo Integración:</strong> {servicioSeleccionado.tipo_integracion}</p>
                    <p><strong>URL:</strong> <span className="text-blue-600">{servicioSeleccionado.url_servicio}</span></p>
                    <p><strong>Versión API:</strong> {servicioSeleccionado.version_api || 'N/A'}</p>
                    <p><strong>Autenticación:</strong> {servicioSeleccionado.metodo_autenticacion}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Métricas de Rendimiento</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Uptime:</strong> {servicioSeleccionado.metricas.uptime}%</p>
                    <p><strong>Tiempo Respuesta:</strong> {servicioSeleccionado.metricas.tiempo_respuesta_promedio}ms</p>
                    <p><strong>Requests Exitosos:</strong> <span className="text-green-600">{servicioSeleccionado.metricas.requests_exitosos.toLocaleString()}</span></p>
                    <p><strong>Requests Fallidos:</strong> <span className="text-red-600">{servicioSeleccionado.metricas.requests_fallidos.toLocaleString()}</span></p>
                    <p><strong>Última Actividad:</strong> {servicioSeleccionado.ultima_actividad}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Límites y Costos</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p><strong>Límite Diario:</strong> {servicioSeleccionado.limites.requests_diarios.toLocaleString()}</p>
                    <p><strong>Utilizados Hoy:</strong> {servicioSeleccionado.limites.requests_utilizados.toLocaleString()}</p>
                  </div>
                  <div>
                    <p><strong>Costo por Request:</strong> {servicioSeleccionado.limites.costo_por_request ? formatearCosto(servicioSeleccionado.limites.costo_por_request) : 'Gratuito'}</p>
                  </div>
                  <div>
                    <p><strong>Estado:</strong> 
                      <Badge className={`ml-2 ${obtenerColorEstado(servicioSeleccionado.estado)}`}>
                        {servicioSeleccionado.estado}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Configuración</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <pre className="text-xs font-mono overflow-x-auto">
                    {JSON.stringify(servicioSeleccionado.configuracion, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Información Adicional</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Fecha Integración:</strong> {servicioSeleccionado.fecha_integracion}</p>
                    <p><strong>Configurado por:</strong> {servicioSeleccionado.configurado_por}</p>
                  </div>
                  <div>
                    <p><strong>Documentación:</strong> 
                      {servicioSeleccionado.documentacion_url ? (
                        <a href={servicioSeleccionado.documentacion_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 ml-1">
                          Ver docs
                        </a>
                      ) : ' N/A'}
                    </p>
                    <p><strong>Soporte:</strong> {servicioSeleccionado.soporte_contacto || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarModal(false)}>
            Cerrar
          </Button>
          <Button color="info" onClick={() => servicioSeleccionado && probarServicio(servicioSeleccionado)}>
            <Icon icon="solar:play-bold" className="mr-2" width={16} />
            Probar Servicio
          </Button>
          <Button color="primary">
            <Icon icon="solar:pen-bold" className="mr-2" width={16} />
            Editar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Logs */}
      <Modal show={mostrarLogs} onClose={() => setMostrarLogs(false)} size="6xl">
        <Modal.Header>Logs de Servicios</Modal.Header>
        <Modal.Body>
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Timestamp</Table.HeadCell>
                <Table.HeadCell>Servicio</Table.HeadCell>
                <Table.HeadCell>Acción</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Detalles</Table.HeadCell>
                <Table.HeadCell>Tiempo</Table.HeadCell>
                <Table.HeadCell>Costo</Table.HeadCell>
                <Table.HeadCell>Usuario</Table.HeadCell>
                <Table.HeadCell>Error</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {logs.map((log) => {
                  const servicio = servicios.find(s => s.id === log.servicio_id);
                  return (
                    <Table.Row key={log.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <Table.Cell className="text-sm font-mono">{log.timestamp}</Table.Cell>
                      <Table.Cell className="text-sm">{servicio?.nombre}</Table.Cell>
                      <Table.Cell className="text-sm">{log.accion}</Table.Cell>
                      <Table.Cell>
                        <Badge className={obtenerColorLog(log.estado)} size="sm">
                          {log.estado}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-sm max-w-xs truncate">{log.detalles}</Table.Cell>
                      <Table.Cell className="text-sm">{log.tiempo_respuesta}ms</Table.Cell>
                      <Table.Cell className="text-sm">
                        {log.costo ? formatearCosto(log.costo) : '-'}
                      </Table.Cell>
                      <Table.Cell className="text-sm">{log.usuario}</Table.Cell>
                      <Table.Cell className="text-sm text-red-600 max-w-xs truncate">
                        {log.error_mensaje || '-'}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarLogs(false)}>
            Cerrar
          </Button>
          <Button color="primary">
            <Icon icon="solar:export-bold" className="mr-2" width={16} />
            Exportar Logs
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ServiciosTerceros; 