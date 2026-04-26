import { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Modal, Table, TextInput, Progress } from 'flowbite-react';
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
    title: "Bases de Datos",
  },
];

interface BaseDatos {
  id: string;
  nombre: string;
  tipo: 'mysql' | 'postgresql' | 'sqlserver' | 'oracle' | 'mongodb' | 'redis';
  host: string;
  puerto: number;
  base_datos: string;
  usuario: string;
  estado: 'conectada' | 'desconectada' | 'error' | 'sincronizando';
  ssl_habilitado: boolean;
  pool_conexiones: number;
  conexiones_activas: number;
  latencia: number;
  ultima_conexion: string;
  ultima_sincronizacion: string;
  tablas_sincronizadas: string[];
  registros_sincronizados: number;
  errores_sincronizacion: number;
  proposito: string;
  frecuencia_sync: 'manual' | 'tiempo_real' | 'horaria' | 'diaria' | 'semanal';
  fecha_creacion: string;
  creado_por: string;
  configuracion_avanzada: {
    timeout: number;
    max_reintentos: number;
    charset: string;
    timezone: string;
  };
}

interface LogSincronizacion {
  id: string;
  base_datos_id: string;
  timestamp: string;
  tipo: 'sincronizacion' | 'backup' | 'restore' | 'conexion' | 'error';
  estado: 'exitoso' | 'fallido' | 'en_progreso' | 'cancelado';
  tabla?: string;
  registros_procesados: number;
  duracion: number;
  error_mensaje?: string;
  usuario: string;
}

const BasesDatos = () => {
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarLogs, setMostrarLogs] = useState(false);
  const [baseDatosSeleccionada, setBaseDatosSeleccionada] = useState<BaseDatos | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [estadisticas, setEstadisticas] = useState({
    total_bases: 0,
    bases_conectadas: 0,
    sincronizaciones_hoy: 0,
    registros_sincronizados: 0,
    bases_con_error: 0
  });

  const [basesDatos, setBasesDatos] = useState<BaseDatos[]>([]);
  const [logs, setLogs] = useState<LogSincronizacion[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setEstadisticas({
        total_bases: 8,
        bases_conectadas: 6,
        sincronizaciones_hoy: 24,
        registros_sincronizados: 45678,
        bases_con_error: 1
      });

      setBasesDatos([
        {
          id: 'DB-001',
          nombre: 'Base Principal CRM',
          tipo: 'mysql',
          host: 'crm-db.empresa.com',
          puerto: 3306,
          base_datos: 'crm_principal',
          usuario: 'crm_user',
          estado: 'conectada',
          ssl_habilitado: true,
          pool_conexiones: 20,
          conexiones_activas: 8,
          latencia: 15,
          ultima_conexion: '16/01/2025 14:30',
          ultima_sincronizacion: '16/01/2025 14:25',
          tablas_sincronizadas: ['clientes', 'contactos', 'oportunidades', 'actividades'],
          registros_sincronizados: 12547,
          errores_sincronizacion: 0,
          proposito: 'Sincronización bidireccional de datos de clientes y oportunidades',
          frecuencia_sync: 'tiempo_real',
          fecha_creacion: '15/11/2024',
          creado_por: 'admin',
          configuracion_avanzada: {
            timeout: 30,
            max_reintentos: 3,
            charset: 'utf8mb4',
            timezone: 'America/Bogota'
          }
        },
        {
          id: 'DB-002',
          nombre: 'Contabilidad ERP',
          tipo: 'postgresql',
          host: 'erp-db.empresa.com',
          puerto: 5432,
          base_datos: 'contabilidad',
          usuario: 'erp_sync',
          estado: 'conectada',
          ssl_habilitado: true,
          pool_conexiones: 15,
          conexiones_activas: 3,
          latencia: 28,
          ultima_conexion: '16/01/2025 14:20',
          ultima_sincronizacion: '16/01/2025 13:00',
          tablas_sincronizadas: ['facturas', 'pagos', 'cuentas_por_cobrar'],
          registros_sincronizados: 8934,
          errores_sincronizacion: 2,
          proposito: 'Exportación de datos financieros al sistema contable',
          frecuencia_sync: 'horaria',
          fecha_creacion: '20/10/2024',
          creado_por: 'carlos.mendoza',
          configuracion_avanzada: {
            timeout: 45,
            max_reintentos: 5,
            charset: 'UTF8',
            timezone: 'UTC'
          }
        },
        {
          id: 'DB-003',
          nombre: 'Warehouse Analytics',
          tipo: 'sqlserver',
          host: 'analytics-db.empresa.com',
          puerto: 1433,
          base_datos: 'DataWarehouse',
          usuario: 'analytics_user',
          estado: 'error',
          ssl_habilitado: false,
          pool_conexiones: 10,
          conexiones_activas: 0,
          latencia: 0,
          ultima_conexion: '16/01/2025 12:45',
          ultima_sincronizacion: '15/01/2025 23:30',
          tablas_sincronizadas: ['dim_clientes', 'fact_polizas', 'fact_siniestros'],
          registros_sincronizados: 156789,
          errores_sincronizacion: 15,
          proposito: 'Carga de datos para análisis y reportes de BI',
          frecuencia_sync: 'diaria',
          fecha_creacion: '05/12/2024',
          creado_por: 'ana.garcia',
          configuracion_avanzada: {
            timeout: 60,
            max_reintentos: 2,
            charset: 'UTF-8',
            timezone: 'America/Bogota'
          }
        },
        {
          id: 'DB-004',
          nombre: 'Cache Redis',
          tipo: 'redis',
          host: 'cache.empresa.com',
          puerto: 6379,
          base_datos: '0',
          usuario: 'redis_user',
          estado: 'conectada',
          ssl_habilitado: true,
          pool_conexiones: 50,
          conexiones_activas: 15,
          latencia: 5,
          ultima_conexion: '16/01/2025 14:30',
          ultima_sincronizacion: '16/01/2025 14:30',
          tablas_sincronizadas: ['sessions', 'cache_keys', 'user_preferences'],
          registros_sincronizados: 5432,
          errores_sincronizacion: 0,
          proposito: 'Cache de sesiones y datos temporales',
          frecuencia_sync: 'tiempo_real',
          fecha_creacion: '18/09/2024',
          creado_por: 'miguel.torres',
          configuracion_avanzada: {
            timeout: 10,
            max_reintentos: 1,
            charset: 'UTF-8',
            timezone: 'UTC'
          }
        },
        {
          id: 'DB-005',
          nombre: 'MongoDB Documentos',
          tipo: 'mongodb',
          host: 'docs-db.empresa.com',
          puerto: 27017,
          base_datos: 'documentos',
          usuario: 'docs_user',
          estado: 'sincronizando',
          ssl_habilitado: true,
          pool_conexiones: 25,
          conexiones_activas: 12,
          latencia: 22,
          ultima_conexion: '16/01/2025 14:28',
          ultima_sincronizacion: '16/01/2025 14:15',
          tablas_sincronizadas: ['polizas', 'siniestros', 'documentos_adjuntos'],
          registros_sincronizados: 23456,
          errores_sincronizacion: 1,
          proposito: 'Almacenamiento de documentos y archivos adjuntos',
          frecuencia_sync: 'horaria',
          fecha_creacion: '10/01/2025',
          creado_por: 'laura.martinez',
          configuracion_avanzada: {
            timeout: 40,
            max_reintentos: 3,
            charset: 'UTF-8',
            timezone: 'America/Bogota'
          }
        }
      ]);

      setLogs([
        {
          id: 'LOG-001',
          base_datos_id: 'DB-001',
          timestamp: '16/01/2025 14:25:30',
          tipo: 'sincronizacion',
          estado: 'exitoso',
          tabla: 'clientes',
          registros_procesados: 247,
          duracion: 15,
          usuario: 'sistema'
        },
        {
          id: 'LOG-002',
          base_datos_id: 'DB-002',
          timestamp: '16/01/2025 13:00:15',
          tipo: 'sincronizacion',
          estado: 'exitoso',
          tabla: 'facturas',
          registros_procesados: 89,
          duracion: 32,
          usuario: 'sistema'
        },
        {
          id: 'LOG-003',
          base_datos_id: 'DB-003',
          timestamp: '16/01/2025 12:45:00',
          tipo: 'conexion',
          estado: 'fallido',
          registros_procesados: 0,
          duracion: 0,
          error_mensaje: 'Connection timeout - Host unreachable',
          usuario: 'sistema'
        },
        {
          id: 'LOG-004',
          base_datos_id: 'DB-005',
          timestamp: '16/01/2025 14:15:45',
          tipo: 'sincronizacion',
          estado: 'en_progreso',
          tabla: 'documentos_adjuntos',
          registros_procesados: 1543,
          duracion: 0,
          usuario: 'sistema'
        }
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const obtenerColorEstado = (estado: string) => {
    const colores = {
      'conectada': 'bg-green-100 text-green-800',
      'desconectada': 'bg-gray-100 text-gray-800',
      'error': 'bg-red-100 text-red-800',
      'sincronizando': 'bg-blue-100 text-blue-800'
    };
    return colores[estado as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorTipo = (tipo: string) => {
    const colores = {
      'mysql': 'bg-orange-100 text-orange-800',
      'postgresql': 'bg-blue-100 text-blue-800',
      'sqlserver': 'bg-red-100 text-red-800',
      'oracle': 'bg-red-100 text-red-800',
      'mongodb': 'bg-green-100 text-green-800',
      'redis': 'bg-red-100 text-red-800'
    };
    return colores[tipo as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorLog = (estado: string) => {
    const colores = {
      'exitoso': 'bg-green-100 text-green-800',
      'fallido': 'bg-red-100 text-red-800',
      'en_progreso': 'bg-blue-100 text-blue-800',
      'cancelado': 'bg-yellow-100 text-yellow-800'
    };
    return colores[estado as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerIconoTipo = (tipo: string) => {
    const iconos = {
      'mysql': 'solar:database-bold',
      'postgresql': 'solar:server-bold',
      'sqlserver': 'solar:server-2-bold',
      'oracle': 'solar:database-bold',
      'mongodb': 'solar:document-bold',
      'redis': 'solar:server-minimalistic-bold'
    };
    return iconos[tipo as keyof typeof iconos] || 'solar:database-bold';
  };

  const formatearDuracion = (segundos: number) => {
    if (segundos < 60) return `${segundos}s`;
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}m ${segs}s`;
  };

  const probarConexion = async (baseDatos: BaseDatos) => {
    // Simular prueba de conexión
    setTimeout(() => {
      alert(`Conexión a ${baseDatos.nombre} - ${baseDatos.estado === 'conectada' ? 'Exitosa' : 'Fallida'}`);
    }, 1000);
  };

  const sincronizarManual = async (baseDatos: BaseDatos) => {
    // Simular sincronización manual
    setBasesDatos(prev => prev.map(bd => 
      bd.id === baseDatos.id ? { ...bd, estado: 'sincronizando' } : bd
    ));
    
    setTimeout(() => {
      setBasesDatos(prev => prev.map(bd => 
        bd.id === baseDatos.id ? { ...bd, estado: 'conectada', ultima_sincronizacion: new Date().toLocaleString() } : bd
      ));
      alert(`Sincronización de ${baseDatos.nombre} completada`);
    }, 3000);
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
      <BreadcrumbComp title="Bases de Datos" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Integración de Bases de Datos</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestión y sincronización de conexiones con bases de datos externas.
        </p>
      </div>

      {/* Alertas */}
      {estadisticas.bases_con_error > 0 && (
        <Alert color="failure" className="mb-6">
          <Icon icon="solar:danger-triangle-bold" className="mr-2" width={20} />
          <span>
            <strong>{estadisticas.bases_con_error} base(s) de datos</strong> presentan errores de conexión.
          </span>
        </Alert>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon="solar:database-bold" className="text-primary" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.total_bases}</h3>
              <p className="text-xs text-gray-500">Total Bases</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.bases_conectadas}</h3>
              <p className="text-xs text-gray-500">Conectadas</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Icon icon="solar:refresh-bold" className="text-info" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.sincronizaciones_hoy}</h3>
              <p className="text-xs text-gray-500">Sync Hoy</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon icon="solar:document-bold" className="text-warning" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.registros_sincronizados.toLocaleString()}</h3>
              <p className="text-xs text-gray-500">Registros</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Icon icon="solar:close-circle-bold" className="text-red-600 dark:text-red-400" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.bases_con_error}</h3>
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
              <label className="block text-sm font-medium mb-1">Buscar Base</label>
              <TextInput
                placeholder="Nombre o host..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                icon={() => <Icon icon="solar:magnifer-bold" width={16} />}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select 
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm w-full"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="todos">Todos los Tipos</option>
                <option value="mysql">MySQL</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="sqlserver">SQL Server</option>
                <option value="oracle">Oracle</option>
                <option value="mongodb">MongoDB</option>
                <option value="redis">Redis</option>
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
                <option value="conectada">Conectada</option>
                <option value="desconectada">Desconectada</option>
                <option value="error">Error</option>
                <option value="sincronizando">Sincronizando</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <HeroButton icon="solar:add-circle-bold" size="sm">Nueva Conexión</HeroButton>
              <Button color="gray" size="sm" onClick={() => setMostrarLogs(true)}>
                <Icon icon="solar:document-text-bold" className="mr-2" width={16} />
                Ver Logs
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button color="info" size="sm">
                <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
                Sincronizar Todo
              </Button>
              <Button color="gray" size="sm">
                <Icon icon="solar:export-bold" className="mr-2" width={16} />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Bases de Datos */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Bases de Datos Configuradas ({basesDatos.length})</h3>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Base de Datos</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Conexión</Table.HeadCell>
                <Table.HeadCell>Pool</Table.HeadCell>
                <Table.HeadCell>Sincronización</Table.HeadCell>
                <Table.HeadCell>Registros</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {basesDatos.map((bd) => (
                  <Table.Row key={bd.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <Icon icon={obtenerIconoTipo(bd.tipo)} width={20} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{bd.nombre}</p>
                          <p className="text-xs text-gray-500">{bd.host}:{bd.puerto}</p>
                          <p className="text-xs text-blue-600">{bd.base_datos}</p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorTipo(bd.tipo)} size="sm">
                        {bd.tipo.toUpperCase()}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorEstado(bd.estado)} size="sm">
                        {bd.estado}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold">{bd.latencia}ms</p>
                        <p className="text-gray-500">{bd.ssl_habilitado ? 'SSL' : 'No SSL'}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold">{bd.conexiones_activas}/{bd.pool_conexiones}</p>
                        <Progress 
                          progress={(bd.conexiones_activas / bd.pool_conexiones) * 100} 
                          size="sm"
                          color="blue"
                        />
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold">{bd.frecuencia_sync}</p>
                        <p className="text-gray-500 text-xs">{bd.ultima_sincronizacion}</p>
                        {bd.errores_sincronizacion > 0 && (
                          <p className="text-red-600 text-xs">{bd.errores_sincronizacion} errores</p>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold text-green-600">{bd.registros_sincronizados.toLocaleString()}</p>
                        <p className="text-gray-500 text-xs">{bd.tablas_sincronizadas.length} tablas</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button 
                          size="xs" 
                          color="gray"
                          onClick={() => {
                            setBaseDatosSeleccionada(bd);
                            setMostrarModal(true);
                          }}
                        >
                          <Icon icon="solar:eye-bold" width={14} />
                        </Button>
                        <Button 
                          size="xs" 
                          color="info"
                          onClick={() => probarConexion(bd)}
                        >
                          <Icon icon="solar:play-bold" width={14} />
                        </Button>
                        <Button 
                          size="xs" 
                          color="success"
                          onClick={() => sincronizarManual(bd)}
                          disabled={bd.estado === 'sincronizando'}
                        >
                          <Icon icon="solar:refresh-bold" width={14} />
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
        <Modal.Header>Detalle de Base de Datos - {baseDatosSeleccionada?.nombre}</Modal.Header>
        <Modal.Body>
          {baseDatosSeleccionada && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Configuración de Conexión</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Tipo:</strong> {baseDatosSeleccionada.tipo.toUpperCase()}</p>
                    <p><strong>Host:</strong> {baseDatosSeleccionada.host}</p>
                    <p><strong>Puerto:</strong> {baseDatosSeleccionada.puerto}</p>
                    <p><strong>Base de Datos:</strong> {baseDatosSeleccionada.base_datos}</p>
                    <p><strong>Usuario:</strong> {baseDatosSeleccionada.usuario}</p>
                    <p><strong>SSL:</strong> {baseDatosSeleccionada.ssl_habilitado ? 'Habilitado' : 'Deshabilitado'}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Métricas de Rendimiento</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Latencia:</strong> {baseDatosSeleccionada.latencia}ms</p>
                    <p><strong>Pool Conexiones:</strong> {baseDatosSeleccionada.pool_conexiones}</p>
                    <p><strong>Conexiones Activas:</strong> {baseDatosSeleccionada.conexiones_activas}</p>
                    <p><strong>Última Conexión:</strong> {baseDatosSeleccionada.ultima_conexion}</p>
                    <p><strong>Registros Sincronizados:</strong> {baseDatosSeleccionada.registros_sincronizados.toLocaleString()}</p>
                    <p><strong>Errores Sincronización:</strong> {baseDatosSeleccionada.errores_sincronizacion}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Sincronización</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Frecuencia:</strong> {baseDatosSeleccionada.frecuencia_sync}</p>
                    <p><strong>Última Sincronización:</strong> {baseDatosSeleccionada.ultima_sincronizacion}</p>
                  </div>
                  <div>
                    <p><strong>Estado:</strong> 
                      <Badge className={`ml-2 ${obtenerColorEstado(baseDatosSeleccionada.estado)}`}>
                        {baseDatosSeleccionada.estado}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Tablas Sincronizadas</h4>
                <div className="flex flex-wrap gap-2">
                  {baseDatosSeleccionada.tablas_sincronizadas.map((tabla, index) => (
                    <Badge key={index} color="info" size="sm">
                      {tabla}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Configuración Avanzada</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(baseDatosSeleccionada.configuracion_avanzada, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Información Adicional</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Propósito:</strong> {baseDatosSeleccionada.proposito}</p>
                    <p><strong>Fecha Creación:</strong> {baseDatosSeleccionada.fecha_creacion}</p>
                    <p><strong>Creado por:</strong> {baseDatosSeleccionada.creado_por}</p>
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
          <Button color="info" onClick={() => baseDatosSeleccionada && probarConexion(baseDatosSeleccionada)}>
            <Icon icon="solar:play-bold" className="mr-2" width={16} />
            Probar Conexión
          </Button>
          <Button color="success" onClick={() => baseDatosSeleccionada && sincronizarManual(baseDatosSeleccionada)}>
            <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
            Sincronizar
          </Button>
          <Button color="primary">
            <Icon icon="solar:pen-bold" className="mr-2" width={16} />
            Editar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Logs */}
      <Modal show={mostrarLogs} onClose={() => setMostrarLogs(false)} size="6xl">
        <Modal.Header>Logs de Sincronización</Modal.Header>
        <Modal.Body>
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Timestamp</Table.HeadCell>
                <Table.HeadCell>Base de Datos</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Tabla</Table.HeadCell>
                <Table.HeadCell>Registros</Table.HeadCell>
                <Table.HeadCell>Duración</Table.HeadCell>
                <Table.HeadCell>Usuario</Table.HeadCell>
                <Table.HeadCell>Error</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {logs.map((log) => {
                  const bd = basesDatos.find(b => b.id === log.base_datos_id);
                  return (
                    <Table.Row key={log.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <Table.Cell className="text-sm font-mono">{log.timestamp}</Table.Cell>
                      <Table.Cell className="text-sm">{bd?.nombre}</Table.Cell>
                      <Table.Cell>
                        <Badge color="info" size="sm">{log.tipo}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge className={obtenerColorLog(log.estado)} size="sm">
                          {log.estado}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-sm">{log.tabla || '-'}</Table.Cell>
                      <Table.Cell className="text-sm">{log.registros_procesados.toLocaleString()}</Table.Cell>
                      <Table.Cell className="text-sm">{formatearDuracion(log.duracion)}</Table.Cell>
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

export default BasesDatos; 