import { useState } from 'react';
import { Card, Badge, Button, Progress, Alert, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

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
    title: "Predicciones de venta",
  },
];

export interface PrediccionType {
  id: string;
  tipo: 'siniestralidad' | 'renovacion' | 'abandono' | 'fraude' | 'ventas';
  titulo: string;
  descripcion: string;
  confianza: number;
  impacto: 'alto' | 'medio' | 'bajo';
  tendencia: 'positiva' | 'negativa' | 'estable';
  valor: string;
  cambio: string;
  fecha: string;
  estado: 'activa' | 'completada' | 'pendiente';
}

export const prediccionesData: PrediccionType[] = [
  {
    id: "PRED-001",
    tipo: "siniestralidad",
    titulo: "Aumento de Siniestralidad Q1 2025",
    descripcion: "Se predice un incremento del 15% en siniestros de automóvil debido a condiciones climáticas adversas",
    confianza: 87,
    impacto: "alto",
    tendencia: "negativa",
    valor: "15% ↗",
    cambio: "+3.2% vs Q4 2024",
    fecha: "15/01/2025",
    estado: "activa"
  },
  {
    id: "PRED-002",
    tipo: "renovacion",
    titulo: "Tasa de Renovación Pólizas Vida",
    descripcion: "Las renovaciones de seguros de vida mostrarán un crecimiento del 8% en los próximos 3 meses",
    confianza: 92,
    impacto: "medio",
    tendencia: "positiva",
    valor: "8% ↗",
    cambio: "+1.5% vs período anterior",
    fecha: "12/01/2025",
    estado: "activa"
  },
  {
    id: "PRED-003",
    tipo: "abandono",
    titulo: "Riesgo de Abandono de Clientes",
    descripcion: "234 clientes con alta probabilidad de cancelar sus pólizas en los próximos 60 días",
    confianza: 94,
    impacto: "alto",
    tendencia: "negativa",
    valor: "234 clientes",
    cambio: "-12% vs mes anterior",
    fecha: "10/01/2025",
    estado: "pendiente"
  },
  {
    id: "PRED-004",
    tipo: "fraude",
    titulo: "Detección de Patrones de Fraude",
    descripcion: "Identificados 18 casos sospechosos que requieren investigación adicional",
    confianza: 89,
    impacto: "alto",
    tendencia: "estable",
    valor: "18 casos",
    cambio: "Estable vs mes anterior",
    fecha: "08/01/2025",
    estado: "activa"
  },
  {
    id: "PRED-005",
    tipo: "ventas",
    titulo: "Proyección de Ventas Q1",
    descripcion: "Las ventas de seguros empresariales crecerán un 22% en el primer trimestre",
    confianza: 85,
    impacto: "alto",
    tendencia: "positiva",
    valor: "22% ↗",
    cambio: "+5.8% vs proyección anterior",
    fecha: "05/01/2025",
    estado: "activa"
  }
];

// Datos para gráficos
const tendenciasSiniestralidad = [
  { mes: 'Ene', real: 2.1, prediccion: 2.4 },
  { mes: 'Feb', real: 2.3, prediccion: 2.6 },
  { mes: 'Mar', real: 2.8, prediccion: 3.1 },
  { mes: 'Abr', real: null, prediccion: 3.2 },
  { mes: 'May', real: null, prediccion: 3.0 },
  { mes: 'Jun', real: null, prediccion: 2.8 }
];

const distribucionRiesgos = [
  { name: 'Bajo Riesgo', value: 65, color: '#10B981' },
  { name: 'Riesgo Medio', value: 25, color: '#F59E0B' },
  { name: 'Alto Riesgo', value: 10, color: '#EF4444' }
];

const impactoFinanciero = [
  { categoria: 'Siniestros', impacto: -850000, proyeccion: -980000 },
  { categoria: 'Renovaciones', impacto: 1200000, proyeccion: 1350000 },
  { categoria: 'Nuevas Ventas', impacto: 2100000, proyeccion: 2450000 },
  { categoria: 'Retención', impacto: 900000, proyeccion: 1050000 }
];

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'siniestralidad':
      return 'solar:danger-triangle-bold-duotone';
    case 'renovacion':
      return 'solar:refresh-bold-duotone';
    case 'abandono':
      return 'solar:user-cross-bold-duotone';
    case 'fraude':
      return 'solar:eye-bold-duotone';
    case 'ventas':
      return 'solar:chart-2-bold-duotone';
    default:
      return 'solar:chart-bold-duotone';
  }
};

const getTipoColor = (tipo: string) => {
  switch (tipo) {
    case 'siniestralidad':
      return 'text-error';
    case 'renovacion':
      return 'text-info';
    case 'abandono':
      return 'text-warning';
    case 'fraude':
      return 'text-purple-500';
    case 'ventas':
      return 'text-success';
    default:
      return 'text-gray-500';
  }
};

const getImpactoColor = (impacto: string) => {
  switch (impacto) {
    case 'alto':
      return 'failure';
    case 'medio':
      return 'warning';
    case 'bajo':
      return 'info';
    default:
      return 'gray';
  }
};

const getTendenciaIcon = (tendencia: string) => {
  switch (tendencia) {
    case 'positiva':
      return 'solar:arrow-up-bold';
    case 'negativa':
      return 'solar:arrow-down-bold';
    case 'estable':
      return 'solar:arrow-right-bold';
    default:
      return 'solar:minus-bold';
  }
};

const Predicciones = () => {

  const [predicciones] = useState<PrediccionType[]>(prediccionesData);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [prediccionSeleccionada, setPrediccionSeleccionada] = useState<PrediccionType | null>(null);
  const navigate = useNavigate();

  const prediccionesFiltradas = filtroTipo === 'todos' 
    ? predicciones 
    : predicciones.filter(p => p.tipo === filtroTipo);

  // Estadísticas
  const totalPredicciones = predicciones.length;
  const prediccionesActivas = predicciones.filter(p => p.estado === 'activa').length;
  const confianzaPromedio = predicciones.reduce((acc, p) => acc + p.confianza, 0) / predicciones.length;
  const altoImpacto = predicciones.filter(p => p.impacto === 'alto').length;

  return (
    <>
      <BreadcrumbComp title="Predicciones de venta" items={BCrumb} />

      
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:crystal-ball-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalPredicciones}</h3>
              <p className="text-sm text-gray-500">Predicciones Activas</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{confianzaPromedio.toFixed(1)}%</h3>
              <p className="text-sm text-gray-500">Confianza Promedio</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-failure/10 rounded-lg">
              <Icon icon="solar:fire-bold" className="text-failure" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{altoImpacto}</h3>
              <p className="text-sm text-gray-500">Alto Impacto</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:pulse-2-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{prediccionesActivas}</h3>
              <p className="text-sm text-gray-500">En Monitoreo</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerta de IA */}
      <Alert color="info" className="mb-6">
        <Icon icon="solar:cpu-bolt-bold" className="mr-2" width={16} />
        <span>
          <strong>Análisis Predictivo Avanzado:</strong> Los modelos de IA analizan patrones históricos, 
          tendencias del mercado y variables externas para generar predicciones precisas sobre el comportamiento 
          futuro de tu cartera de seguros.
        </span>
      </Alert>

      {/* Filtros */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            color={filtroTipo === 'todos' ? 'primary' : 'light'}
            onClick={() => setFiltroTipo('todos')}
          >
            Todas las Predicciones
          </Button>
          <Button
            size="sm"
            color={filtroTipo === 'siniestralidad' ? 'primary' : 'light'}
            onClick={() => setFiltroTipo('siniestralidad')}
          >
            <Icon icon="solar:danger-triangle-bold" className="mr-1" width={14} />
            Siniestralidad
          </Button>
          <Button
            size="sm"
            color={filtroTipo === 'renovacion' ? 'primary' : 'light'}
            onClick={() => setFiltroTipo('renovacion')}
          >
            <Icon icon="solar:refresh-bold" className="mr-1" width={14} />
            Renovaciones
          </Button>
          <Button
            size="sm"
            color={filtroTipo === 'abandono' ? 'primary' : 'light'}
            onClick={() => setFiltroTipo('abandono')}
          >
            <Icon icon="solar:user-cross-bold" className="mr-1" width={14} />
            Abandono
          </Button>
          <Button
            size="sm"
            color={filtroTipo === 'fraude' ? 'primary' : 'light'}
            onClick={() => setFiltroTipo('fraude')}
          >
            <Icon icon="solar:eye-bold" className="mr-1" width={14} />
            Fraude
          </Button>
          <Button
            size="sm"
            color={filtroTipo === 'ventas' ? 'primary' : 'light'}
            onClick={() => setFiltroTipo('ventas')}
          >
            <Icon icon="solar:chart-2-bold" className="mr-1" width={14} />
            Ventas
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Tendencias de Siniestralidad */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">
            Tendencia de Siniestralidad
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tendenciasSiniestralidad}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="real" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Real"
              />
              <Line 
                type="monotone" 
                dataKey="prediccion" 
                stroke="#EF4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Predicción"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Distribución de Riesgos */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">
            Distribución de Riesgos
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={distribucionRiesgos}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {distribucionRiesgos.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-4">
            {distribucionRiesgos.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Impacto Financiero */}
      <Card className="mb-6 p-6">
        <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">
          Impacto Financiero Proyectado
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={impactoFinanciero}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="categoria" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => `$${(value / 1000000).toFixed(1)}M`}
            />
            <Bar dataKey="impacto" fill="#3B82F6" name="Actual" />
            <Bar dataKey="proyeccion" fill="#10B981" name="Proyección" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Lista de Predicciones */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-dark dark:text-white">
            Predicciones Detalladas
          </h3>
          <Button color="light" size="sm">
            <Icon icon="solar:download-minimalistic-bold" className="mr-2" width={16} />
            Exportar Reporte
          </Button>
        </div>
        
        <div className="space-y-4">
          {prediccionesFiltradas.map((prediccion) => (
            <div key={prediccion.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <Icon 
                      icon={getTipoIcon(prediccion.tipo)} 
                      className={getTipoColor(prediccion.tipo)}
                      width={24} 
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-dark dark:text-white">{prediccion.titulo}</h4>
                    <p className="text-sm text-gray-500">{prediccion.descripcion}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge color={getImpactoColor(prediccion.impacto)} className="capitalize">
                    {prediccion.impacto} impacto
                  </Badge>
                  <Icon 
                    icon={getTendenciaIcon(prediccion.tendencia)} 
                    className={
                      prediccion.tendencia === 'positiva' ? 'text-success' :
                      prediccion.tendencia === 'negativa' ? 'text-error' : 'text-gray-500'
                    }
                    width={16} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-500">Confianza</p>
                  <div className="flex items-center gap-2">
                    <Progress progress={prediccion.confianza} color="blue" size="sm" className="flex-1" />
                    <span className="text-sm font-medium">{prediccion.confianza}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valor Predicho</p>
                  <p className="font-semibold text-dark dark:text-white">{prediccion.valor}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cambio</p>
                  <p className="font-semibold text-dark dark:text-white">{prediccion.cambio}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha Predicción</p>
                  <p className="font-semibold text-dark dark:text-white">{prediccion.fecha}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="xs"
                  color="primary"
                  onClick={() => {
                    setPrediccionSeleccionada(prediccion);
                    setModalOpen(true);
                  }}
                >
                  <Icon icon="solar:eye-bold" className="mr-1" width={12} />
                  Ver Detalles
                </Button>
                <Button
                  size="xs"
                  color="info"
                  onClick={() => navigate(`/apps/ia/analisis-predictivo/predicciones/${prediccion.id}`, { state: { prediccion } })}
                >
                  <Icon icon="solar:chart-bold" className="mr-1" width={12} />
                  Análisis Completo
                </Button>
                <Button size="xs" color="success">
                  <Icon icon="solar:bell-bold" className="mr-1" width={12} />
                  Crear Alerta
                </Button>
                <Button size="xs" color="light">
                  <Icon icon="solar:share-bold" className="mr-1" width={12} />
                  Compartir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Modal Detalles de Predicción */}
      <Modal show={modalOpen} size="lg" onClose={() => setModalOpen(false)} popup>
        <Modal.Header />
        <Modal.Body>
          {prediccionSeleccionada && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <Icon
                      icon={getTipoIcon(prediccionSeleccionada.tipo)}
                      className={getTipoColor(prediccionSeleccionada.tipo)}
                      width={28}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-dark dark:text-white">{prediccionSeleccionada.titulo}</h3>
                    <p className="text-sm text-gray-500">ID: {prediccionSeleccionada.id} · {prediccionSeleccionada.fecha}</p>
                  </div>
                </div>
                <Badge color={getImpactoColor(prediccionSeleccionada.impacto)} className="capitalize">
                  {prediccionSeleccionada.impacto} impacto
                </Badge>
              </div>

              <Alert color="gray">
                <Icon icon="solar:info-circle-bold" className="mr-2" width={16} />
                {prediccionSeleccionada.descripcion}
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-xs text-gray-500 mb-2">Confianza del Modelo</p>
                  <div className="flex items-center gap-2">
                    <Progress progress={prediccionSeleccionada.confianza} color="blue" className="flex-1" />
                    <span className="text-sm font-semibold">{prediccionSeleccionada.confianza}%</span>
                  </div>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-gray-500 mb-1">Valor Predicho</p>
                  <p className="text-lg font-semibold text-dark dark:text-white">{prediccionSeleccionada.valor}</p>
                  <p className="text-xs text-gray-500">Cambio: {prediccionSeleccionada.cambio}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-gray-500 mb-1">Tendencia</p>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon={getTendenciaIcon(prediccionSeleccionada.tendencia)}
                      className={
                        prediccionSeleccionada.tendencia === 'positiva' ? 'text-success' :
                        prediccionSeleccionada.tendencia === 'negativa' ? 'text-error' : 'text-gray-500'
                      }
                      width={18}
                    />
                    <span className="capitalize">{prediccionSeleccionada.tendencia}</span>
                  </div>
                </Card>
              </div>

              <div className="flex justify-end gap-2">
                <Button color="light" onClick={() => setModalOpen(false)}>Cerrar</Button>
                <Button color="primary" onClick={() => setModalOpen(false)}>
                  <Icon icon="solar:download-minimalistic-bold" className="mr-1" width={16} />
                  Exportar Detalle
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default Predicciones; 