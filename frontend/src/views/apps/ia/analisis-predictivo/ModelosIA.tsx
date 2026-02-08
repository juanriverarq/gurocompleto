import { useState, useContext } from 'react';
import { Badge, Button, Card, Progress, Alert, Modal, TextInput, Textarea, Select } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { CustomizerContext } from 'src/context/CustomizerContext';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/ia",
    title: "Inteligencia Artificial",
  },
  {
    to: "/apps/ia/analisis-predictivo",
    title: "Análisis Predictivo",
  },
  {
    title: "Modelos IA",
  },
];

export interface ModeloType {
  id: string;
  nombre: string;
  tipo: 'clasificacion' | 'regresion' | 'deteccion_anomalias' | 'clustering' | 'deep_learning';
  categoria: 'siniestralidad' | 'fraude' | 'abandono' | 'ventas' | 'riesgo';
  estado: 'entrenando' | 'activo' | 'inactivo' | 'error' | 'evaluando';
  precision: number;
  fechaCreacion: string;
  ultimoEntrenamiento: string;
  version: string;
  datosEntrenamiento: number;
  metricas: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  descripcion: string;
  autor: string;
}

const modelosData: ModeloType[] = [
  {
    id: "MODEL-001",
    nombre: "Predictor de Siniestralidad Auto",
    tipo: "regresion",
    categoria: "siniestralidad",
    estado: "activo",
    precision: 94.2,
    fechaCreacion: "15/11/2024",
    ultimoEntrenamiento: "10/12/2024",
    version: "v2.1.3",
    datosEntrenamiento: 125000,
    metricas: {
      accuracy: 94.2,
      precision: 92.8,
      recall: 95.1,
      f1Score: 93.9
    },
    descripcion: "Modelo avanzado para predecir la probabilidad de siniestros en seguros de automóvil basado en perfil del conductor y vehículo",
    autor: "Dr. Carlos Mendoza"
  },
  {
    id: "MODEL-002",
    nombre: "Detector de Fraude Neural",
    tipo: "deep_learning",
    categoria: "fraude",
    estado: "entrenando",
    precision: 89.7,
    fechaCreacion: "22/10/2024",
    ultimoEntrenamiento: "12/12/2024",
    version: "v1.8.2",
    datosEntrenamiento: 89000,
    metricas: {
      accuracy: 89.7,
      precision: 91.3,
      recall: 87.5,
      f1Score: 89.4
    },
    descripcion: "Red neuronal profunda especializada en detectar patrones de fraude en reclamaciones de seguros",
    autor: "Ing. Ana Rodríguez"
  },
  {
    id: "MODEL-003",
    nombre: "Clasificador de Riesgo Cliente",
    tipo: "clasificacion",
    categoria: "riesgo",
    estado: "activo",
    precision: 91.5,
    fechaCreacion: "08/09/2024",
    ultimoEntrenamiento: "05/12/2024",
    version: "v3.0.1",
    datosEntrenamiento: 67000,
    metricas: {
      accuracy: 91.5,
      precision: 89.2,
      recall: 93.8,
      f1Score: 91.4
    },
    descripcion: "Clasifica automáticamente el nivel de riesgo de nuevos clientes para optimizar la tarificación",
    autor: "Dra. Patricia Jiménez"
  },
  {
    id: "MODEL-004",
    nombre: "Predictor de Abandono",
    tipo: "clasificacion",
    categoria: "abandono",
    estado: "evaluando",
    precision: 87.3,
    fechaCreacion: "30/08/2024",
    ultimoEntrenamiento: "08/12/2024",
    version: "v1.5.0",
    datosEntrenamiento: 45000,
    metricas: {
      accuracy: 87.3,
      precision: 85.1,
      recall: 89.7,
      f1Score: 87.3
    },
    descripcion: "Identifica clientes con alta probabilidad de cancelar sus pólizas en los próximos 90 días",
    autor: "Ing. Roberto Vargas"
  },
  {
    id: "MODEL-005",
    nombre: "Optimizador de Ventas Cruzadas",
    tipo: "clustering",
    categoria: "ventas",
    estado: "inactivo",
    precision: 82.8,
    fechaCreacion: "12/07/2024",
    ultimoEntrenamiento: "25/11/2024",
    version: "v2.3.1",
    datosEntrenamiento: 78000,
    metricas: {
      accuracy: 82.8,
      precision: 84.5,
      recall: 80.9,
      f1Score: 82.7
    },
    descripcion: "Agrupa clientes por comportamiento y sugiere productos adicionales con mayor probabilidad de éxito",
    autor: "Dr. Luis García"
  }
];

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'clasificacion':
      return 'solar:filters-bold-duotone';
    case 'regresion':
      return 'solar:graph-up-bold-duotone';
    case 'deteccion_anomalias':
      return 'solar:eye-scan-bold-duotone';
    case 'clustering':
      return 'solar:widget-6-bold-duotone';
    case 'deep_learning':
      return 'solar:cpu-bolt-bold-duotone';
    default:
      return 'solar:cpu-bold-duotone';
  }
};

const getTipoColor = (tipo: string) => {
  switch (tipo) {
    case 'clasificacion':
      return 'text-primary';
    case 'regresion':
      return 'text-success';
    case 'deteccion_anomalias':
      return 'text-warning';
    case 'clustering':
      return 'text-info';
    case 'deep_learning':
      return 'text-purple-500';
    default:
      return 'text-gray-500';
  }
};

const getEstadoColor = (estado: string) => {
  switch (estado) {
    case 'activo':
      return 'success';
    case 'entrenando':
      return 'warning';
    case 'evaluando':
      return 'info';
    case 'inactivo':
      return 'gray';
    case 'error':
      return 'failure';
    default:
      return 'gray';
  }
};

const getCategoriaIcon = (categoria: string) => {
  switch (categoria) {
    case 'siniestralidad':
      return 'solar:danger-triangle-bold';
    case 'fraude':
      return 'solar:shield-warning-bold';
    case 'abandono':
      return 'solar:user-cross-bold';
    case 'ventas':
      return 'solar:chart-2-bold';
    case 'riesgo':
      return 'solar:scale-bold';
    default:
      return 'solar:chart-bold';
  }
};

const ModelosIA = () => {
  const [data] = useState<ModeloType[]>(modelosData);
  const [showModal, setShowModal] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const { isBorderRadius } = useContext(CustomizerContext);

  const modelosFiltrados = filtroEstado === 'todos' 
    ? data 
    : data.filter(m => m.estado === filtroEstado);

  // Estadísticas
  const totalModelos = data.length;
  const modelosActivos = data.filter(m => m.estado === 'activo').length;
  const precisionPromedio = data.reduce((acc, m) => acc + m.precision, 0) / data.length;
  const modelosEntrenando = data.filter(m => m.estado === 'entrenando').length;

  return (
    <>
      <BreadcrumbComp title="Modelos IA" items={BCrumb} />
      
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:cpu-bolt-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalModelos}</h3>
              <p className="text-sm text-gray-500">Modelos Totales</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{modelosActivos}</h3>
              <p className="text-sm text-gray-500">Modelos Activos</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:chart-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{precisionPromedio.toFixed(1)}%</h3>
              <p className="text-sm text-gray-500">Precisión Promedio</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Icon icon="solar:refresh-bold" className="text-warning" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{modelosEntrenando}</h3>
              <p className="text-sm text-gray-500">En Entrenamiento</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerta de IA */}
      <Alert color="info" className="mb-6">
        <Icon icon="solar:cpu-bolt-bold" className="mr-2" width={16} />
        <span>
          <strong>Gestión de Modelos IA:</strong> Administra el ciclo de vida completo de tus modelos de 
          inteligencia artificial, desde el entrenamiento hasta el despliegue en producción. 
          Monitorea métricas de rendimiento y optimiza continuamente.
        </span>
      </Alert>

      {/* Header con botones */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
          <Button
            size="sm"
            color={filtroEstado === 'todos' ? 'primary' : 'light'}
            onClick={() => setFiltroEstado('todos')}
          >
            Todos
          </Button>
          <Button
            size="sm"
            color={filtroEstado === 'activo' ? 'primary' : 'light'}
            onClick={() => setFiltroEstado('activo')}
          >
            <Icon icon="solar:check-circle-bold" className="mr-1" width={14} />
            Activos
          </Button>
          <Button
            size="sm"
            color={filtroEstado === 'entrenando' ? 'primary' : 'light'}
            onClick={() => setFiltroEstado('entrenando')}
          >
            <Icon icon="solar:refresh-bold" className="mr-1" width={14} />
            Entrenando
          </Button>
          <Button
            size="sm"
            color={filtroEstado === 'evaluando' ? 'primary' : 'light'}
            onClick={() => setFiltroEstado('evaluando')}
          >
            <Icon icon="solar:eye-bold" className="mr-1" width={14} />
            Evaluando
          </Button>
        </div>
        
        <div className="flex gap-3">
          <Button color="light" size="sm">
            <Icon icon="solar:download-minimalistic-bold" className="mr-2" width={16} />
            Exportar Métricas
          </Button>
          <Button color="info" size="sm">
            <Icon icon="solar:upload-bold" className="mr-2" width={16} />
            Importar Modelo
          </Button>
          <HeroButton icon="solar:add-circle-bold" onClick={() => setShowModal(true)} size="sm">Nuevo Modelo</HeroButton>
        </div>
      </div>

      {/* Lista de Modelos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        {modelosFiltrados.map((modelo) => (
          <Card key={modelo.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Icon 
                    icon={getTipoIcon(modelo.tipo)} 
                    className={getTipoColor(modelo.tipo)}
                    width={24} 
                  />
                </div>
                <div>
                  <h4 className="font-semibold text-dark dark:text-white">{modelo.nombre}</h4>
                  <p className="text-sm text-gray-500">{modelo.version} • {modelo.autor}</p>
                </div>
              </div>
              
              <Badge color={getEstadoColor(modelo.estado)} className="capitalize">
                {modelo.estado === 'entrenando' && <Icon icon="solar:refresh-bold" className="mr-1 animate-spin" width={12} />}
                {modelo.estado === 'evaluando' && <Icon icon="solar:eye-bold" className="mr-1" width={12} />}
                {modelo.estado === 'activo' && <Icon icon="solar:check-circle-bold" className="mr-1" width={12} />}
                {modelo.estado}
              </Badge>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon 
                  icon={getCategoriaIcon(modelo.categoria)} 
                  className="text-gray-500"
                  width={16} 
                />
                <span className="capitalize text-sm font-medium text-dark dark:text-white">
                  {modelo.categoria}
                </span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2">{modelo.descripcion}</p>
            </div>
            
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-500">Precisión</span>
                  <span className="text-sm font-medium text-dark dark:text-white">
                    {modelo.precision.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  progress={modelo.precision} 
                  color={modelo.precision >= 90 ? "green" : modelo.precision >= 80 ? "yellow" : "red"}
                  size="sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Datos:</span>
                  <span className="font-medium text-dark dark:text-white ml-1">
                    {(modelo.datosEntrenamiento / 1000).toFixed(0)}K
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">F1-Score:</span>
                  <span className="font-medium text-dark dark:text-white ml-1">
                    {modelo.metricas.f1Score.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="text-sm">
                <span className="text-gray-500">Último entrenamiento:</span>
                <span className="font-medium text-dark dark:text-white ml-1">
                  {modelo.ultimoEntrenamiento}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button size="xs" color="primary" className="flex-1">
                <Icon icon="solar:eye-bold" className="mr-1" width={12} />
                Ver Detalles
              </Button>
              <Button size="xs" color="info">
                <Icon icon="solar:play-bold" width={12} />
              </Button>
              <Button size="xs" color="success">
                <Icon icon="solar:upload-bold" width={12} />
              </Button>
              <Button size="xs" color="light" className="!text-gray-500">
                <Icon icon="solar:settings-bold" width={12} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal Nuevo Modelo */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>Crear Nuevo Modelo IA</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre del Modelo
              </label>
              <TextInput placeholder="Ej: Predictor de Riesgo Crediticio" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Modelo
                </label>
                <Select>
                  <option value="clasificacion">Clasificación</option>
                  <option value="regresion">Regresión</option>
                  <option value="deteccion_anomalias">Detección de Anomalías</option>
                  <option value="clustering">Clustering</option>
                  <option value="deep_learning">Deep Learning</option>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categoría
                </label>
                <Select>
                  <option value="siniestralidad">Siniestralidad</option>
                  <option value="fraude">Fraude</option>
                  <option value="abandono">Abandono</option>
                  <option value="ventas">Ventas</option>
                  <option value="riesgo">Riesgo</option>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descripción
              </label>
              <Textarea 
                rows={4} 
                placeholder="Describe el propósito y funcionamiento del modelo..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dataset de Entrenamiento
              </label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <Icon icon="solar:cloud-upload-bold" className="mx-auto text-gray-400 mb-2" width={48} />
                <p className="text-gray-500">Arrastra tu dataset aquí o haz clic para seleccionar</p>
                <p className="text-xs text-gray-400 mt-1">Formatos soportados: CSV, JSON, Parquet</p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button color="primary">
            <Icon icon="solar:cpu-bolt-bold" className="mr-2" width={16} />
            Crear y Entrenar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ModelosIA;
