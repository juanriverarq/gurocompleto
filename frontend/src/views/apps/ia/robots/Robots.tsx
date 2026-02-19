import { useState, useContext } from 'react';
import { Card, Badge, Button, Modal, Checkbox, Label, ToggleSwitch, Tabs, Table, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { CustomizerContext } from 'src/context/CustomizerContext';
import { useToast } from 'src/hooks/use-toast';

// Tipos para las aseguradoras
interface Aseguradora {
  id: string;
  nombre: string;
  logoUrl: string;
  color: string;
  conectada: boolean;
}

// Tipos para los robots
interface Robot {
  id: string;
  nombre: string;
  descripcion: string;
  icon: string;
  iconColor: string;
  aseguradorasDisponibles: string[];
  activo: boolean;
  ultimaSincronizacion?: string;
  registrosPendientes?: number;
  modoAutomatico: boolean;
  frecuencia: number; // en minutos
}

// Opciones de frecuencia de sincronización
const FRECUENCIAS = [
  { value: 5, label: '5 minutos' },
  { value: 10, label: '10 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 360, label: '6 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
];

// Tipos para datos pendientes de auditoría
interface DatoPendiente {
  id: string;
  robotId: string;
  tipo: string;
  aseguradora: string;
  descripcion: string;
  fecha: string;
  datos: Record<string, any>;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
}

// Logos de aseguradoras (tomados del comparador de seguros)
const COMPANY_LOGOS: Record<string, { url: string; color: string }> = {
  'sura': { url: 'https://images.seeklogo.com/logo-png/32/1/sura-logo-png_seeklogo-328191.png', color: '#0033A0' },
  'bolivar': { url: 'https://d1yjjnpx0p53s8.cloudfront.net/styles/logo-thumbnail/s3/032019/seguros_bolivar.jpg?Kv_sRIqG71PgCVryIyJxZ48DlEBN3xJt&itok=YAoRdSt8', color: '#00529B' },
  'allianz': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Allianz.svg/1280px-Allianz.svg.png', color: '#003781' },
  'hdi': { url: 'https://www.hdi.cl/media/506086/microsoftteams-image-58.png', color: '#006747' },
};

// Aseguradoras disponibles
const ASEGURADORAS: Aseguradora[] = [
  { id: 'sura', nombre: 'Sura', logoUrl: COMPANY_LOGOS['sura'].url, color: COMPANY_LOGOS['sura'].color, conectada: false },
  { id: 'bolivar', nombre: 'Bolívar', logoUrl: COMPANY_LOGOS['bolivar'].url, color: COMPANY_LOGOS['bolivar'].color, conectada: false },
  { id: 'allianz', nombre: 'Allianz', logoUrl: COMPANY_LOGOS['allianz'].url, color: COMPANY_LOGOS['allianz'].color, conectada: false },
  { id: 'hdi', nombre: 'HDI Seguros', logoUrl: COMPANY_LOGOS['hdi'].url, color: COMPANY_LOGOS['hdi'].color, conectada: false },
];

// Robots disponibles
const ROBOTS_INICIALES: Robot[] = [
  {
    id: 'sync-cartera',
    nombre: 'Sincronizar Cartera',
    descripcion: 'Sincroniza automáticamente la cartera de clientes con las aseguradoras seleccionadas',
    icon: 'solar:wallet-bold-duotone',
    iconColor: 'text-primary',
    aseguradorasDisponibles: ['sura', 'bolivar', 'allianz', 'hdi'],
    activo: false,
    modoAutomatico: false,
    frecuencia: 30,
  },
  {
    id: 'sync-clientes',
    nombre: 'Sincronizar Clientes',
    descripcion: 'Importa y actualiza información de clientes desde las aseguradoras',
    icon: 'solar:users-group-rounded-bold-duotone',
    iconColor: 'text-success',
    aseguradorasDisponibles: ['sura', 'bolivar', 'allianz'],
    activo: false,
    modoAutomatico: false,
    frecuencia: 60,
  },
  {
    id: 'sync-polizas',
    nombre: 'Sincronizar Pólizas',
    descripcion: 'Mantiene actualizadas las pólizas con la información de las aseguradoras',
    icon: 'solar:shield-check-bold-duotone',
    iconColor: 'text-info',
    aseguradorasDisponibles: ['sura', 'bolivar', 'allianz', 'hdi'],
    activo: false,
    modoAutomatico: false,
    frecuencia: 60,
  },
];

// Datos de ejemplo para auditoría
const DATOS_PENDIENTES_EJEMPLO: DatoPendiente[] = [
  {
    id: '1',
    robotId: 'sync-clientes',
    tipo: 'Nuevo Cliente',
    aseguradora: 'Sura',
    descripcion: 'Juan Pérez García - CC 1234567890',
    fecha: '2025-01-12 14:30',
    datos: { nombre: 'Juan Pérez García', documento: '1234567890', telefono: '3001234567' },
    estado: 'pendiente',
  },
  {
    id: '2',
    robotId: 'sync-polizas',
    tipo: 'Nueva Póliza',
    aseguradora: 'Bolívar',
    descripcion: 'Póliza Auto #POL-2025-001 - María López',
    fecha: '2025-01-12 14:25',
    datos: { numero: 'POL-2025-001', cliente: 'María López', ramo: 'Automóviles' },
    estado: 'pendiente',
  },
  {
    id: '3',
    robotId: 'sync-cartera',
    tipo: 'Actualización Cartera',
    aseguradora: 'Solidaria',
    descripcion: 'Pago recibido - Factura #F-2025-100',
    fecha: '2025-01-12 14:20',
    datos: { factura: 'F-2025-100', monto: 1500000, estado: 'Pagado' },
    estado: 'pendiente',
  },
];

const Robots = () => {
  const { isBorderRadius } = useContext(CustomizerContext);
  const { toast } = useToast();

  // Estados
  const [robots, setRobots] = useState<Robot[]>(ROBOTS_INICIALES);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>(ASEGURADORAS);
  const [datosPendientes, setDatosPendientes] = useState<DatoPendiente[]>(DATOS_PENDIENTES_EJEMPLO);
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedAseguradora, setSelectedAseguradora] = useState<Aseguradora | null>(null);
  const [robotAseguradoras, setRobotAseguradoras] = useState<string[]>([]);
  const [modoAutomatico, setModoAutomatico] = useState(false);
  const [frecuencia, setFrecuencia] = useState(30);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('robots');

  // Estadísticas
  const robotsActivos = robots.filter(r => r.activo).length;
  const aseguradorasConectadas = aseguradoras.filter(a => a.conectada).length;
  const pendientesAuditoria = datosPendientes.filter(d => d.estado === 'pendiente').length;

  // Abrir modal de configuración de robot
  const handleConfigRobot = (robot: Robot) => {
    setSelectedRobot(robot);
    setRobotAseguradoras(robot.aseguradorasDisponibles.filter(a => 
      aseguradoras.find(as => as.id === a)?.conectada
    ));
    setModoAutomatico(robot.modoAutomatico);
    setFrecuencia(robot.frecuencia);
    setShowConfigModal(true);
  };

  // Guardar configuración del robot
  const handleSaveConfig = () => {
    if (!selectedRobot) return;

    setRobots(prev => prev.map(r => {
      if (r.id === selectedRobot.id) {
        return {
          ...r,
          activo: robotAseguradoras.length > 0,
          modoAutomatico,
          frecuencia,
        };
      }
      return r;
    }));

    toast({
      title: 'Configuración guardada',
      description: `Robot "${selectedRobot.nombre}" configurado correctamente`,
    });

    setShowConfigModal(false);
    setSelectedRobot(null);
  };

  // Abrir modal de login de aseguradora
  const handleLoginAseguradora = (aseguradora: Aseguradora) => {
    setSelectedAseguradora(aseguradora);
    setShowLoginModal(true);
  };

  // Simular conexión con aseguradora
  const handleConnectAseguradora = () => {
    if (!selectedAseguradora) return;

    setLoading(true);
    
    // Simular proceso de conexión
    setTimeout(() => {
      setAseguradoras(prev => prev.map(a => {
        if (a.id === selectedAseguradora.id) {
          return { ...a, conectada: true };
        }
        return a;
      }));

      toast({
        title: 'Conexión exitosa',
        description: `Conectado con ${selectedAseguradora.nombre}`,
      });

      setLoading(false);
      setShowLoginModal(false);
      setSelectedAseguradora(null);
    }, 1500);
  };

  // Desconectar aseguradora
  const handleDisconnectAseguradora = (aseguradora: Aseguradora) => {
    setAseguradoras(prev => prev.map(a => {
      if (a.id === aseguradora.id) {
        return { ...a, conectada: false };
      }
      return a;
    }));

    toast({
      title: 'Desconectado',
      description: `Se desconectó de ${aseguradora.nombre}`,
    });
  };

  // Aprobar dato pendiente
  const handleAprobar = (dato: DatoPendiente) => {
    setDatosPendientes(prev => prev.map(d => {
      if (d.id === dato.id) {
        return { ...d, estado: 'aprobado' };
      }
      return d;
    }));

    toast({
      title: 'Aprobado',
      description: `${dato.tipo} aprobado y sincronizado`,
    });
  };

  // Rechazar dato pendiente
  const handleRechazar = (dato: DatoPendiente) => {
    setDatosPendientes(prev => prev.map(d => {
      if (d.id === dato.id) {
        return { ...d, estado: 'rechazado' };
      }
      return d;
    }));

    toast({
      title: 'Rechazado',
      description: `${dato.tipo} rechazado`,
      variant: 'destructive',
    });
  };

  // Aprobar todos los pendientes
  const handleAprobarTodos = () => {
    setDatosPendientes(prev => prev.map(d => {
      if (d.estado === 'pendiente') {
        return { ...d, estado: 'aprobado' };
      }
      return d;
    }));

    toast({
      title: 'Todos aprobados',
      description: `${pendientesAuditoria} registros aprobados y sincronizados`,
    });
  };

  // Ejecutar sincronización manual
  const handleSyncManual = (robot: Robot) => {
    setLoading(true);
    
    setTimeout(() => {
      toast({
        title: 'Sincronización completada',
        description: `${robot.nombre} ejecutado correctamente`,
      });
      setLoading(false);
    }, 2000);
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">
          Robots de Automatización
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configura y gestiona los robots de sincronización automática con las aseguradoras
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:robot-bold-duotone" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{robotsActivos}</h3>
              <p className="text-sm text-gray-500">Robots Activos</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:link-bold-duotone" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{aseguradorasConectadas}</h3>
              <p className="text-sm text-gray-500">Aseguradoras Conectadas</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Icon icon="solar:clipboard-check-bold-duotone" className="text-warning" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{pendientesAuditoria}</h3>
              <p className="text-sm text-gray-500">Pendientes Auditoría</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:refresh-bold-duotone" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{robots.length}</h3>
              <p className="text-sm text-gray-500">Total Robots</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="mb-6" style={{ borderRadius: `${isBorderRadius}px` }}>
        <Tabs
          aria-label="Tabs de robots"
          variant="underline"
          onActiveTabChange={(tab) => setActiveTab(['robots', 'aseguradoras', 'auditor'][tab])}
        >
          {/* Tab Robots */}
          <Tabs.Item
            active={activeTab === 'robots'}
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:bolt-circle-bold-duotone" width={18} />
                <span>Robots</span>
              </div>
            }
          >
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {robots.map((robot) => (
                  <Card
                    key={robot.id}
                    className={`p-4 border-2 transition-all ${
                      robot.activo ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${robot.activo ? 'bg-primary/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                          <Icon icon={robot.icon} className={robot.iconColor} width={28} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-dark dark:text-white">{robot.nombre}</h3>
                          <span className={`text-xs font-medium ${robot.activo ? 'text-green-600' : 'text-gray-500'}`}>
                            {robot.activo ? '● Activo' : '○ Inactivo'}
                          </span>
                        </div>
                      </div>
                      {robot.activo && (
                        <div className="text-right text-xs text-gray-500">
                          <div>Cada {FRECUENCIAS.find(f => f.value === robot.frecuencia)?.label || `${robot.frecuencia} min`}</div>
                          {robot.modoAutomatico && <div className="text-blue-500">Sin auditor</div>}
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {robot.descripcion}
                    </p>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs text-gray-500">Aseguradoras:</span>
                      <div className="flex gap-1">
                        {robot.aseguradorasDisponibles.map((asegId) => {
                          const aseg = aseguradoras.find(a => a.id === asegId);
                          return aseg ? (
                            <div
                              key={asegId}
                              className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${
                                aseg.conectada ? 'bg-white ring-2 ring-green-400' : 'bg-gray-100'
                              }`}
                              title={aseg.nombre}
                            >
                              <img
                                src={aseg.logoUrl}
                                alt={aseg.nombre}
                                className={`w-6 h-6 object-contain ${!aseg.conectada ? 'opacity-40 grayscale' : ''}`}
                              />
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        color="primary"
                        className="flex-1"
                        onClick={() => handleConfigRobot(robot)}
                      >
                        <Icon icon="solar:settings-bold" width={16} className="mr-1" />
                        Configurar
                      </Button>
                      {robot.activo && (
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => handleSyncManual(robot)}
                          disabled={loading}
                        >
                          <Icon icon="solar:refresh-bold" width={16} />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Tabs.Item>

          {/* Tab Aseguradoras */}
          <Tabs.Item
            active={activeTab === 'aseguradoras'}
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:shield-check-bold-duotone" width={18} />
                <span>Aseguradoras</span>
                {aseguradorasConectadas > 0 && (
                  <Badge color="success" size="sm">{aseguradorasConectadas}</Badge>
                )}
              </div>
            }
          >
            <div className="p-4">
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:info-circle-bold" className="text-blue-500" width={20} />
                  <div>
                    <h4 className="font-medium text-blue-800 dark:text-blue-300">
                      Conexión centralizada
                    </h4>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Al conectar una aseguradora, estará disponible para todos los robots que la soporten.
                      Solo necesitas iniciar sesión una vez.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aseguradoras.map((aseguradora) => (
                  <Card
                    key={aseguradora.id}
                    className={`p-4 border-2 ${
                      aseguradora.conectada ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center p-2 ${aseguradora.conectada ? 'bg-white ring-2 ring-green-400' : 'bg-white dark:bg-gray-700'}`}>
                          <img src={aseguradora.logoUrl} alt={aseguradora.nombre} className={`max-w-full max-h-full object-contain ${!aseguradora.conectada ? 'opacity-50 grayscale' : ''}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-dark dark:text-white">
                            {aseguradora.nombre}
                          </h3>
                          <div className="flex items-center gap-2">
                            {aseguradora.conectada ? (
                              <>
                                <Icon icon="solar:check-circle-bold" className="text-green-500" width={16} />
                                <span className="text-sm text-green-600 dark:text-green-400">Conectada</span>
                              </>
                            ) : (
                              <>
                                <Icon icon="solar:close-circle-bold" className="text-gray-400" width={16} />
                                <span className="text-sm text-gray-500">No conectada</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {aseguradora.conectada ? (
                        <Button
                          size="sm"
                          color="failure"
                          outline
                          onClick={() => handleDisconnectAseguradora(aseguradora)}
                        >
                          <Icon icon="solar:logout-2-bold" width={16} className="mr-1" />
                          Desconectar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          color="primary"
                          onClick={() => handleLoginAseguradora(aseguradora)}
                        >
                          <Icon icon="solar:login-2-bold" width={16} className="mr-1" />
                          Conectar
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Tabs.Item>

          {/* Tab Auditor */}
          <Tabs.Item
            active={activeTab === 'auditor'}
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:clipboard-check-bold-duotone" width={18} />
                <span>Auditor</span>
                {pendientesAuditoria > 0 && (
                  <Badge color="warning" size="sm">{pendientesAuditoria}</Badge>
                )}
              </div>
            }
          >
            <div className="p-4">
              {/* Controles del auditor */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-dark dark:text-white">
                    Registros pendientes de aprobación
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {pendientesAuditoria > 0 && (
                    <Button size="sm" color="success" onClick={handleAprobarTodos}>
                      <Icon icon="solar:check-circle-bold" width={16} className="mr-1" />
                      Aprobar todos ({pendientesAuditoria})
                    </Button>
                  )}
                </div>
              </div>

              {/* Tabla de pendientes */}
              {datosPendientes.filter(d => d.estado === 'pendiente').length === 0 ? (
                <div className="text-center py-12">
                  <Icon icon="solar:clipboard-check-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                    No hay registros pendientes
                  </h3>
                  <p className="text-sm text-gray-500">
                    Todos los datos sincronizados han sido procesados
                  </p>
                </div>
              ) : (
                <div className="guro-table-wrap">
                  <table className="guro-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Aseguradora</th>
                        <th>Descripción</th>
                        <th>Fecha</th>
                        <th className="sticky-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosPendientes
                        .filter(d => d.estado === 'pendiente')
                        .map((dato) => {
                          const robot = robots.find(r => r.id === dato.robotId);
                          return (
                            <tr key={dato.id} className="group">
                              <td>
                                <div className="flex items-center gap-2">
                                  {robot && (
                                    <Icon icon={robot.icon} className={robot.iconColor} width={20} />
                                  )}
                                  <span className="font-medium">{dato.tipo}</span>
                                </div>
                              </td>
                              <td>
                                <Badge color="gray">{dato.aseguradora}</Badge>
                              </td>
                              <td>
                                <span className="text-sm">{dato.descripcion}</span>
                              </td>
                              <td>
                                <span className="text-sm text-gray-500">{dato.fecha}</span>
                              </td>
                              <td className="sticky-right">
                                <div className="flex gap-2 justify-center">
                                  <Button
                                    size="xs"
                                    color="success"
                                    onClick={() => handleAprobar(dato)}
                                  >
                                    <Icon icon="solar:check-circle-bold" width={16} />
                                  </Button>
                                  <Button
                                    size="xs"
                                    color="failure"
                                    onClick={() => handleRechazar(dato)}
                                  >
                                    <Icon icon="solar:close-circle-bold" width={16} />
                                  </Button>
                                  <Button size="xs" color="light">
                                    <Icon icon="solar:eye-bold" width={16} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Historial de procesados */}
              {datosPendientes.filter(d => d.estado !== 'pendiente').length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Historial reciente
                  </h4>
                  <div className="space-y-2">
                    {datosPendientes
                      .filter(d => d.estado !== 'pendiente')
                      .slice(0, 5)
                      .map((dato) => (
                        <div
                          key={dato.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Icon
                              icon={dato.estado === 'aprobado' ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
                              className={dato.estado === 'aprobado' ? 'text-green-500' : 'text-red-500'}
                              width={20}
                            />
                            <div>
                              <span className="text-sm font-medium">{dato.tipo}</span>
                              <span className="text-sm text-gray-500 ml-2">- {dato.descripcion}</span>
                            </div>
                          </div>
                          <Badge color={dato.estado === 'aprobado' ? 'success' : 'failure'}>
                            {dato.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </Tabs.Item>
        </Tabs>
      </Card>

      {/* Modal de configuración de robot */}
      <Modal show={showConfigModal} onClose={() => setShowConfigModal(false)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-3">
            {selectedRobot && (
              <>
                <Icon icon={selectedRobot.icon} className={selectedRobot.iconColor} width={24} />
                <span>Configurar {selectedRobot.nombre}</span>
              </>
            )}
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedRobot && (
            <div className="space-y-6">
              <p className="text-gray-600 dark:text-gray-400">
                {selectedRobot.descripcion}
              </p>

              {/* Selección de aseguradoras */}
              <div>
                <Label className="mb-3 block font-medium">
                  Aseguradoras a sincronizar
                </Label>
                <div className="space-y-3">
                  {selectedRobot.aseguradorasDisponibles.map((asegId) => {
                    const aseg = aseguradoras.find(a => a.id === asegId);
                    if (!aseg) return null;

                    return (
                      <div
                        key={asegId}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          aseg.conectada ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 bg-gray-50 dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`aseg-${asegId}`}
                            checked={robotAseguradoras.includes(asegId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRobotAseguradoras([...robotAseguradoras, asegId]);
                              } else {
                                setRobotAseguradoras(robotAseguradoras.filter(a => a !== asegId));
                              }
                            }}
                            disabled={!aseg.conectada}
                          />
                          <Label htmlFor={`aseg-${asegId}`} className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-white flex items-center justify-center p-1">
                              <img src={aseg.logoUrl} alt={aseg.nombre} className={`max-w-full max-h-full object-contain ${!aseg.conectada ? 'opacity-50 grayscale' : ''}`} />
                            </div>
                            <span>{aseg.nombre}</span>
                          </Label>
                        </div>
                        {!aseg.conectada && (
                          <Badge color="gray" size="sm">No conectada</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                {aseguradoras.filter(a => selectedRobot.aseguradorasDisponibles.includes(a.id) && !a.conectada).length > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    <Icon icon="solar:info-circle-bold" className="inline mr-1" width={14} />
                    Conecta las aseguradoras en la pestaña "Aseguradoras" para habilitarlas
                  </p>
                )}
              </div>

              {/* Frecuencia de sincronización */}
              <div>
                <Label className="mb-3 block font-medium">
                  <Icon icon="solar:clock-circle-bold" className="inline mr-2" width={16} />
                  Frecuencia de sincronización
                </Label>
                <select
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {FRECUENCIAS.map((f) => (
                    <option key={f.value} value={f.value}>
                      Cada {f.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  El robot se ejecutará automáticamente con esta frecuencia cuando esté activo
                </p>
              </div>

              {/* Modo automático */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Modo automático</Label>
                    <p className="text-sm text-gray-500">
                      Los datos se sincronizarán automáticamente sin pasar por el auditor
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={modoAutomatico}
                    onChange={setModoAutomatico}
                  />
                </div>
                {modoAutomatico && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Icon icon="solar:danger-triangle-bold" className="text-yellow-500" width={18} />
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        Los datos se aplicarán directamente sin revisión previa. Asegúrate de que la configuración sea correcta.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowConfigModal(false)}>
            Cancelar
          </Button>
          <Button color="primary" onClick={handleSaveConfig}>
            <Icon icon="solar:check-circle-bold" width={16} className="mr-1" />
            Guardar configuración
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de login de aseguradora */}
      <Modal show={showLoginModal} onClose={() => setShowLoginModal(false)}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            {selectedAseguradora && (
              <>
                <div className="w-8 h-8 rounded bg-white flex items-center justify-center p-1">
                  <img src={selectedAseguradora.logoUrl} alt={selectedAseguradora.nombre} className="max-w-full max-h-full object-contain" />
                </div>
                <span>Conectar con {selectedAseguradora.nombre}</span>
              </>
            )}
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Ingresa tus credenciales de {selectedAseguradora?.nombre} para conectar tu cuenta.
            </p>

            <div>
              <Label htmlFor="usuario" className="mb-2 block">
                Usuario / Email
              </Label>
              <input
                type="text"
                id="usuario"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 dark:bg-gray-700"
                placeholder="usuario@ejemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="password" className="mb-2 block">
                Contraseña
              </Label>
              <input
                type="password"
                id="password"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 p-2.5 dark:bg-gray-700"
                placeholder="••••••••"
              />
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Icon icon="solar:shield-check-bold" className="text-blue-500" width={18} />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Tus credenciales se almacenan de forma segura y encriptada. Solo se utilizan para sincronizar datos.
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowLoginModal(false)}>
            Cancelar
          </Button>
          <Button color="primary" onClick={handleConnectAseguradora} disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Conectando...
              </>
            ) : (
              <>
                <Icon icon="solar:login-2-bold" width={16} className="mr-1" />
                Conectar
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Robots;
