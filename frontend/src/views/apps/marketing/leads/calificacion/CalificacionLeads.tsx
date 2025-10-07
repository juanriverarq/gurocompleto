import { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Modal, Table, Progress } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/marketing",
    title: "Marketing",
  },
  {
    to: "/apps/marketing/leads",
    title: "Leads",
  },
  {
    title: "Calificación",
  },
];

interface CriterioCalificacion {
  id: string;
  nombre: string;
  descripcion: string;
  peso: number;
  activo: boolean;
}

interface LeadCalificacion {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  producto_interes: string;
  puntuacion_total: number;
  calificacion: 'A' | 'B' | 'C' | 'D';
  criterios: {
    criterio_id: string;
    puntuacion: number;
    detalle: string;
  }[];
  fecha_calificacion: string;
  calificado_por: string;
  estado_seguimiento: 'pendiente' | 'en_proceso' | 'calificado' | 'descartado';
  recomendacion: string;
  prioridad: 'alta' | 'media' | 'baja';
}

const CalificacionLeads = () => {
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [leadSeleccionado, setLeadSeleccionado] = useState<LeadCalificacion | null>(null);
  const [filtroCalificacion, setFiltroCalificacion] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const [criterios, setCriterios] = useState<CriterioCalificacion[]>([]);
  const [leadsCalificacion, setLeadsCalificacion] = useState<LeadCalificacion[]>([]);

  const [estadisticas, setEstadisticas] = useState({
    total_leads_calificar: 0,
    leads_calificados: 0,
    puntuacion_promedio: 0,
    leads_alta_calidad: 0,
    tasa_calificacion: 0
  });

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setCriterios([
        {
          id: 'C001',
          nombre: 'Tamaño de Empresa',
          descripcion: 'Número de empleados y facturación anual',
          peso: 25,
          activo: true
        },
        {
          id: 'C002',
          nombre: 'Presupuesto Disponible',
          descripcion: 'Capacidad financiera para contratar el seguro',
          peso: 30,
          activo: true
        },
        {
          id: 'C003',
          nombre: 'Autoridad de Decisión',
          descripcion: 'Nivel de influencia en la decisión de compra',
          peso: 20,
          activo: true
        },
        {
          id: 'C004',
          nombre: 'Necesidad del Producto',
          descripcion: 'Urgencia y relevancia del seguro solicitado',
          peso: 15,
          activo: true
        },
        {
          id: 'C005',
          nombre: 'Timeline de Compra',
          descripcion: 'Tiempo estimado para tomar la decisión',
          peso: 10,
          activo: true
        }
      ]);

      setLeadsCalificacion([
        {
          id: 'LEAD-001',
          nombre: 'María González',
          empresa: 'Transportes González S.A.S',
          email: 'maria.gonzalez@empresa.com',
          telefono: '+57 300 123 4567',
          producto_interes: 'Seguro de Flota',
          puntuacion_total: 87,
          calificacion: 'A',
          criterios: [
            { criterio_id: 'C001', puntuacion: 90, detalle: 'Empresa mediana, 150 empleados' },
            { criterio_id: 'C002', puntuacion: 85, detalle: 'Presupuesto confirmado de $50M' },
            { criterio_id: 'C003', puntuacion: 95, detalle: 'Gerente de Operaciones con autoridad' },
            { criterio_id: 'C004', puntuacion: 80, detalle: 'Necesidad alta por expansión de flota' },
            { criterio_id: 'C005', puntuacion: 85, detalle: 'Decisión en 30 días' }
          ],
          fecha_calificacion: '15/01/2025',
          calificado_por: 'Sistema IA + Carlos Mendoza',
          estado_seguimiento: 'calificado',
          recomendacion: 'Lead de alta calidad. Priorizar contacto inmediato.',
          prioridad: 'alta'
        },
        {
          id: 'LEAD-002',
          nombre: 'Roberto Silva',
          empresa: 'Constructora del Futuro',
          email: 'roberto.silva@constructora.com',
          telefono: '+57 310 987 6543',
          producto_interes: 'Todo Riesgo Construcción',
          puntuacion_total: 92,
          calificacion: 'A',
          criterios: [
            { criterio_id: 'C001', puntuacion: 95, detalle: 'Empresa grande, 300+ empleados' },
            { criterio_id: 'C002', puntuacion: 90, detalle: 'Presupuesto alto confirmado' },
            { criterio_id: 'C003', puntuacion: 100, detalle: 'Director Financiero, decisor final' },
            { criterio_id: 'C004', puntuacion: 85, detalle: 'Proyecto inmediato en ejecución' },
            { criterio_id: 'C005', puntuacion: 90, detalle: 'Urgente, 15 días' }
          ],
          fecha_calificacion: '14/01/2025',
          calificado_por: 'Ana García',
          estado_seguimiento: 'en_proceso',
          recomendacion: 'Excelente prospecto. Programar reunión ejecutiva.',
          prioridad: 'alta'
        },
        {
          id: 'LEAD-003',
          nombre: 'Andrea Morales',
          empresa: 'PYME Innovadora Ltda',
          email: 'andrea@pyme.com',
          telefono: '+57 320 456 7890',
          producto_interes: 'Seguro PYME',
          puntuacion_total: 65,
          calificacion: 'B',
          criterios: [
            { criterio_id: 'C001', puntuacion: 60, detalle: 'Empresa pequeña, 25 empleados' },
            { criterio_id: 'C002', puntuacion: 55, detalle: 'Presupuesto limitado, sensible al precio' },
            { criterio_id: 'C003', puntuacion: 80, detalle: 'Propietaria, decisión directa' },
            { criterio_id: 'C004', puntuacion: 70, detalle: 'Necesidad media, cumplimiento legal' },
            { criterio_id: 'C005', puntuacion: 60, detalle: 'No urgente, 60-90 días' }
          ],
          fecha_calificacion: '13/01/2025',
          calificado_por: 'Miguel Torres',
          estado_seguimiento: 'calificado',
          recomendacion: 'Lead promedio. Enfocar en valor y beneficios.',
          prioridad: 'media'
        },
        {
          id: 'LEAD-004',
          nombre: 'Fernando López',
          empresa: 'Industrias del Pacífico',
          email: 'fernando.lopez@industria.com',
          telefono: '+57 315 234 5678',
          producto_interes: 'Responsabilidad Civil',
          puntuacion_total: 45,
          calificacion: 'C',
          criterios: [
            { criterio_id: 'C001', puntuacion: 50, detalle: 'Empresa mediana, información limitada' },
            { criterio_id: 'C002', puntuacion: 40, detalle: 'Presupuesto no definido' },
            { criterio_id: 'C003', puntuacion: 45, detalle: 'Gerente de Riesgos, influencia media' },
            { criterio_id: 'C004', puntuacion: 50, detalle: 'Necesidad baja, exploratoria' },
            { criterio_id: 'C005', puntuacion: 40, detalle: 'Timeline indefinido' }
          ],
          fecha_calificacion: '12/01/2025',
          calificado_por: 'Sistema IA',
          estado_seguimiento: 'pendiente',
          recomendación: 'Lead de baja calidad. Requiere más información.',
          prioridad: 'baja'
        }
      ]);

      setEstadisticas({
        total_leads_calificar: 28,
        leads_calificados: 45,
        puntuacion_promedio: 72.3,
        leads_alta_calidad: 18,
        tasa_calificacion: 85.2
      });

      setLoading(false);
    }, 1000);
  }, []);

  const obtenerColorCalificacion = (calificacion: string) => {
    const colores = {
      'A': 'bg-green-100 text-green-800',
      'B': 'bg-yellow-100 text-yellow-800',
      'C': 'bg-orange-100 text-orange-800',
      'D': 'bg-red-100 text-red-800'
    };
    return colores[calificacion as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorPrioridad = (prioridad: string) => {
    const colores = {
      'alta': 'bg-red-100 text-red-800',
      'media': 'bg-yellow-100 text-yellow-800',
      'baja': 'bg-blue-100 text-blue-800'
    };
    return colores[prioridad as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorEstado = (estado: string) => {
    const colores = {
      'pendiente': 'bg-gray-100 text-gray-800',
      'en_proceso': 'bg-blue-100 text-blue-800',
      'calificado': 'bg-green-100 text-green-800',
      'descartado': 'bg-red-100 text-red-800'
    };
    return colores[estado as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const leadsFiltrados = leadsCalificacion.filter(lead => {
    const cumpleCalificacion = filtroCalificacion === 'todos' || lead.calificacion === filtroCalificacion;
    const cumpleEstado = filtroEstado === 'todos' || lead.estado_seguimiento === filtroEstado;
    return cumpleCalificacion && cumpleEstado;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Calificación de Leads" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Calificación de Leads</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Sistema inteligente de scoring y calificación de leads basado en criterios personalizables.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon="solar:clipboard-list-bold" className="text-primary" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.total_leads_calificar}</h3>
              <p className="text-xs text-gray-500">Por Calificar</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.leads_calificados}</h3>
              <p className="text-xs text-gray-500">Calificados</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Icon icon="solar:chart-2-bold" className="text-info" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.puntuacion_promedio}</h3>
              <p className="text-xs text-gray-500">Score Promedio</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon icon="solar:star-bold" className="text-warning" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.leads_alta_calidad}</h3>
              <p className="text-xs text-gray-500">Alta Calidad</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon icon="solar:target-bold" className="text-purple-600" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.tasa_calificacion}%</h3>
              <p className="text-xs text-gray-500">Tasa Calificación</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Criterios de Calificación */}
      <Card className="mb-6">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Criterios de Calificación Activos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {criterios.filter(c => c.activo).map((criterio) => (
              <div key={criterio.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">{criterio.nombre}</h4>
                  <Badge color="primary">{criterio.peso}%</Badge>
                </div>
                <p className="text-xs text-gray-600">{criterio.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Filtros */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Calificación</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={filtroCalificacion}
                  onChange={(e) => setFiltroCalificacion(e.target.value)}
                >
                  <option value="todos">Todas las Calificaciones</option>
                  <option value="A">Calificación A</option>
                  <option value="B">Calificación B</option>
                  <option value="C">Calificación C</option>
                  <option value="D">Calificación D</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="calificado">Calificado</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button color="primary" size="sm">
                <Icon icon="solar:cpu-bolt-bold" className="mr-2" width={16} />
                Calificar con IA
              </Button>
              <Button color="gray" size="sm">
                <Icon icon="solar:settings-bold" className="mr-2" width={16} />
                Configurar Criterios
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Leads Calificados */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Leads Calificados ({leadsFiltrados.length})</h3>
            <div className="flex gap-2">
              <Badge color="success">{leadsFiltrados.filter(l => l.calificacion === 'A').length} Grado A</Badge>
              <Badge color="warning">{leadsFiltrados.filter(l => l.calificacion === 'B').length} Grado B</Badge>
              <Badge color="gray">{leadsFiltrados.filter(l => l.prioridad === 'alta').length} Alta Prioridad</Badge>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Lead</Table.HeadCell>
                <Table.HeadCell>Empresa</Table.HeadCell>
                <Table.HeadCell>Producto</Table.HeadCell>
                <Table.HeadCell>Puntuación</Table.HeadCell>
                <Table.HeadCell>Calificación</Table.HeadCell>
                <Table.HeadCell>Prioridad</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Fecha</Table.HeadCell>
                <Table.HeadCell>Calificado Por</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {leadsFiltrados.map((lead) => (
                  <Table.Row key={lead.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <div>
                        <p className="font-semibold text-sm">{lead.nombre}</p>
                        <p className="text-xs text-gray-500">{lead.email}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{lead.empresa}</Table.Cell>
                    <Table.Cell>{lead.producto_interes}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Progress
                          progress={lead.puntuacion_total}
                          color={lead.puntuacion_total >= 80 ? 'green' : lead.puntuacion_total >= 60 ? 'yellow' : 'red'}
                          size="sm"
                          className="w-16"
                        />
                        <span className="text-sm font-semibold">{lead.puntuacion_total}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorCalificacion(lead.calificacion)} size="sm">
                        Grado {lead.calificacion}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorPrioridad(lead.prioridad)} size="sm">
                        {lead.prioridad}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorEstado(lead.estado_seguimiento)} size="sm">
                        {lead.estado_seguimiento}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{lead.fecha_calificacion}</Table.Cell>
                    <Table.Cell className="text-xs">{lead.calificado_por}</Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button 
                          size="xs" 
                          color="gray"
                          onClick={() => {
                            setLeadSeleccionado(lead);
                            setMostrarModal(true);
                          }}
                        >
                          <Icon icon="solar:eye-bold" width={14} />
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
        <Modal.Header>Detalle de Calificación</Modal.Header>
        <Modal.Body>
          {leadSeleccionado && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Información del Lead</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nombre:</strong> {leadSeleccionado.nombre}</p>
                    <p><strong>Empresa:</strong> {leadSeleccionado.empresa}</p>
                    <p><strong>Email:</strong> {leadSeleccionado.email}</p>
                    <p><strong>Teléfono:</strong> {leadSeleccionado.telefono}</p>
                    <p><strong>Producto:</strong> {leadSeleccionado.producto_interes}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Resultado de Calificación</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Puntuación Total:</strong> {leadSeleccionado.puntuacion_total}/100</p>
                    <p><strong>Calificación:</strong> 
                      <Badge className={`ml-2 ${obtenerColorCalificacion(leadSeleccionado.calificacion)}`}>
                        Grado {leadSeleccionado.calificacion}
                      </Badge>
                    </p>
                    <p><strong>Prioridad:</strong> 
                      <Badge className={`ml-2 ${obtenerColorPrioridad(leadSeleccionado.prioridad)}`}>
                        {leadSeleccionado.prioridad}
                      </Badge>
                    </p>
                    <p><strong>Fecha:</strong> {leadSeleccionado.fecha_calificacion}</p>
                    <p><strong>Calificado por:</strong> {leadSeleccionado.calificado_por}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Desglose por Criterios</h4>
                <div className="space-y-3">
                  {leadSeleccionado.criterios.map((criterio) => {
                    const criterioInfo = criterios.find(c => c.id === criterio.criterio_id);
                    return (
                      <div key={criterio.criterio_id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-sm">{criterioInfo?.nombre}</h5>
                          <div className="flex items-center gap-2">
                            <Progress
                              progress={criterio.puntuacion}
                              color={criterio.puntuacion >= 80 ? 'green' : criterio.puntuacion >= 60 ? 'yellow' : 'red'}
                              size="sm"
                              className="w-20"
                            />
                            <span className="text-sm font-semibold">{criterio.puntuacion}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">{criterio.detalle}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Recomendación</h4>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">{leadSeleccionado.recomendacion}</p>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarModal(false)}>
            Cerrar
          </Button>
          <Button color="warning">
            <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
            Recalificar
          </Button>
          <Button color="primary">
            <Icon icon="solar:phone-bold" className="mr-2" width={16} />
            Contactar Lead
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CalificacionLeads; 