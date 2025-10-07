import { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Modal, Dropdown, Table, TextInput } from 'flowbite-react';
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
    title: "Lista de Leads",
  },
];

interface Lead {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  cargo: string;
  producto_interes: string;
  fuente: string;
  estado: 'nuevo' | 'contactado' | 'calificado' | 'propuesta' | 'negociacion' | 'ganado' | 'perdido';
  puntuacion: number;
  temperatura: 'caliente' | 'tibio' | 'frio';
  fecha_creacion: string;
  ultima_actividad: string;
  vendedor_asignado: string;
  valor_estimado: number;
  probabilidad: number;
  dias_sin_contacto: number;
  origen_detalle: string;
  notas: string;
}

const Leads = () => {
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroFuente, setFiltroFuente] = useState('todos');
  const [filtroVendedor, setFiltroVendedor] = useState('todos');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [leadSeleccionado, setLeadSeleccionado] = useState<Lead | null>(null);

  const [estadisticas, setEstadisticas] = useState({
    total_leads: 0,
    leads_nuevos: 0,
    leads_calificados: 0,
    tasa_conversion: 0,
    valor_pipeline: 0,
    leads_mes: 0
  });

  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setEstadisticas({
        total_leads: 234,
        leads_nuevos: 45,
        leads_calificados: 89,
        tasa_conversion: 18.5,
        valor_pipeline: 145000000,
        leads_mes: 67
      });

      setLeads([
        {
          id: 'LEAD-001',
          nombre: 'María González',
          email: 'maria.gonzalez@empresa.com',
          telefono: '+57 300 123 4567',
          empresa: 'Transportes González S.A.S',
          cargo: 'Gerente de Operaciones',
          producto_interes: 'Seguro de Flota',
          fuente: 'website',
          estado: 'calificado',
          puntuacion: 85,
          temperatura: 'caliente',
          fecha_creacion: '10/01/2025',
          ultima_actividad: 'Llamada telefónica - 15/01/2025',
          vendedor_asignado: 'Carlos Mendoza',
          valor_estimado: 25000000,
          probabilidad: 70,
          dias_sin_contacto: 1,
          origen_detalle: 'Formulario de cotización web',
          notas: 'Interesada en cobertura completa para 15 vehículos'
        },
        {
          id: 'LEAD-002',
          nombre: 'Roberto Silva',
          email: 'roberto.silva@constructora.com',
          telefono: '+57 310 987 6543',
          empresa: 'Constructora del Futuro',
          cargo: 'Director Financiero',
          producto_interes: 'Todo Riesgo Construcción',
          fuente: 'referido',
          estado: 'propuesta',
          puntuacion: 92,
          temperatura: 'caliente',
          fecha_creacion: '08/01/2025',
          ultima_actividad: 'Envío de propuesta - 14/01/2025',
          vendedor_asignado: 'Ana García',
          valor_estimado: 45000000,
          probabilidad: 80,
          dias_sin_contacto: 2,
          origen_detalle: 'Referido por cliente existente',
          notas: 'Proyecto de 20 pisos en zona norte'
        },
        {
          id: 'LEAD-003',
          nombre: 'Andrea Morales',
          email: 'andrea@pyme.com',
          telefono: '+57 320 456 7890',
          empresa: 'PYME Innovadora Ltda',
          cargo: 'Propietaria',
          producto_interes: 'Seguro PYME',
          fuente: 'google_ads',
          estado: 'contactado',
          puntuacion: 65,
          temperatura: 'tibio',
          fecha_creacion: '12/01/2025',
          ultima_actividad: 'Email de seguimiento - 13/01/2025',
          vendedor_asignado: 'Miguel Torres',
          valor_estimado: 8000000,
          probabilidad: 45,
          dias_sin_contacto: 3,
          origen_detalle: 'Campaña Google Ads "Seguros PYME"',
          notas: 'Negocio familiar, precio sensible'
        },
        {
          id: 'LEAD-004',
          nombre: 'Fernando López',
          email: 'fernando.lopez@industria.com',
          telefono: '+57 315 234 5678',
          empresa: 'Industrias del Pacífico',
          cargo: 'Gerente de Riesgos',
          producto_interes: 'Responsabilidad Civil',
          fuente: 'linkedin',
          estado: 'nuevo',
          puntuacion: 58,
          temperatura: 'frio',
          fecha_creacion: '14/01/2025',
          ultima_actividad: 'Registro en sistema - 14/01/2025',
          vendedor_asignado: 'Laura Rodríguez',
          valor_estimado: 15000000,
          probabilidad: 25,
          dias_sin_contacto: 2,
          origen_detalle: 'Mensaje directo LinkedIn',
          notas: 'Requiere información detallada sobre coberturas'
        }
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);
  };

  const obtenerColorEstado = (estado: string) => {
    const colores = {
      'nuevo': 'bg-blue-100 text-blue-800',
      'contactado': 'bg-yellow-100 text-yellow-800',
      'calificado': 'bg-purple-100 text-purple-800',
      'propuesta': 'bg-orange-100 text-orange-800',
      'negociacion': 'bg-indigo-100 text-indigo-800',
      'ganado': 'bg-green-100 text-green-800',
      'perdido': 'bg-red-100 text-red-800'
    };
    return colores[estado as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorTemperatura = (temperatura: string) => {
    const colores = {
      'caliente': 'bg-red-100 text-red-800',
      'tibio': 'bg-yellow-100 text-yellow-800',
      'frio': 'bg-blue-100 text-blue-800'
    };
    return colores[temperatura as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorFuente = (fuente: string) => {
    const colores = {
      'website': 'bg-blue-100 text-blue-800',
      'google_ads': 'bg-green-100 text-green-800',
      'facebook': 'bg-blue-100 text-blue-800',
      'linkedin': 'bg-indigo-100 text-indigo-800',
      'referido': 'bg-purple-100 text-purple-800',
      'telefono': 'bg-yellow-100 text-yellow-800',
      'email': 'bg-gray-100 text-gray-800'
    };
    return colores[fuente as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const leadsFiltrados = leads.filter(lead => {
    const cumpleBusqueda = lead.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                          lead.email.toLowerCase().includes(busqueda.toLowerCase()) ||
                          lead.empresa.toLowerCase().includes(busqueda.toLowerCase());
    const cumpleEstado = filtroEstado === 'todos' || lead.estado === filtroEstado;
    const cumpleFuente = filtroFuente === 'todos' || lead.fuente === filtroFuente;
    const cumpleVendedor = filtroVendedor === 'todos' || lead.vendedor_asignado === filtroVendedor;
    
    return cumpleBusqueda && cumpleEstado && cumpleFuente && cumpleVendedor;
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
      <BreadcrumbComp title="Lista de Leads" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Lista de Leads</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestiona y convierte leads en oportunidades de negocio con seguimiento detallado.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon="solar:users-group-rounded-bold" className="text-primary" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.total_leads}</h3>
              <p className="text-xs text-gray-500">Total Leads</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Icon icon="solar:add-circle-bold" className="text-blue-600" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.leads_nuevos}</h3>
              <p className="text-xs text-gray-500">Nuevos</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-purple-600" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.leads_calificados}</h3>
              <p className="text-xs text-gray-500">Calificados</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Icon icon="solar:chart-2-bold" className="text-success" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.tasa_conversion}%</h3>
              <p className="text-xs text-gray-500">Conversión</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon icon="solar:dollar-minimalistic-bold" className="text-warning" width={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-dark dark:text-white">{formatearMoneda(estadisticas.valor_pipeline)}</h3>
              <p className="text-xs text-gray-500">Pipeline</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Icon icon="solar:calendar-bold" className="text-info" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{estadisticas.leads_mes}</h3>
              <p className="text-xs text-gray-500">Este Mes</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros y Búsqueda */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Buscar Lead</label>
              <TextInput
                placeholder="Nombre, email o empresa..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                icon={() => <Icon icon="solar:magnifer-bold" width={16} />}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="calificado">Calificado</option>
                <option value="propuesta">Propuesta</option>
                <option value="negociacion">Negociación</option>
                <option value="ganado">Ganado</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Fuente</label>
              <select 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={filtroFuente}
                onChange={(e) => setFiltroFuente(e.target.value)}
              >
                <option value="todos">Todas las Fuentes</option>
                <option value="website">Website</option>
                <option value="google_ads">Google Ads</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="referido">Referido</option>
                <option value="telefono">Teléfono</option>
                <option value="email">Email</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Vendedor</label>
              <select 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={filtroVendedor}
                onChange={(e) => setFiltroVendedor(e.target.value)}
              >
                <option value="todos">Todos los Vendedores</option>
                <option value="Carlos Mendoza">Carlos Mendoza</option>
                <option value="Ana García">Ana García</option>
                <option value="Miguel Torres">Miguel Torres</option>
                <option value="Laura Rodríguez">Laura Rodríguez</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <Button color="primary" size="sm">
                <Icon icon="solar:add-circle-bold" className="mr-2" width={16} />
                Nuevo Lead
              </Button>
              <Button color="gray" size="sm">
                <Icon icon="solar:export-bold" className="mr-2" width={16} />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Leads */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Leads ({leadsFiltrados.length})</h3>
            <div className="flex gap-2">
              <Badge color="info">{leadsFiltrados.filter(l => l.estado === 'nuevo').length} Nuevos</Badge>
              <Badge color="warning">{leadsFiltrados.filter(l => l.dias_sin_contacto > 3).length} Sin Contacto</Badge>
              <Badge color="success">{leadsFiltrados.filter(l => l.temperatura === 'caliente').length} Calientes</Badge>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Lead</Table.HeadCell>
                <Table.HeadCell>Empresa</Table.HeadCell>
                <Table.HeadCell>Producto</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>Fuente</Table.HeadCell>
                <Table.HeadCell>Temperatura</Table.HeadCell>
                <Table.HeadCell>Puntuación</Table.HeadCell>
                <Table.HeadCell>Valor Est.</Table.HeadCell>
                <Table.HeadCell>Vendedor</Table.HeadCell>
                <Table.HeadCell>Días s/Contacto</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {leadsFiltrados.map((lead) => (
                  <Table.Row key={lead.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <div>
                        <p className="font-semibold text-sm">{lead.nombre}</p>
                        <p className="text-xs text-gray-500">{lead.email}</p>
                        <p className="text-xs text-gray-500">{lead.telefono}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-sm">{lead.empresa}</p>
                        <p className="text-xs text-gray-500">{lead.cargo}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{lead.producto_interes}</Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorEstado(lead.estado)}>
                        {lead.estado}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorFuente(lead.fuente)}>
                        {lead.fuente}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorTemperatura(lead.temperatura)}>
                        {lead.temperatura}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              lead.puntuacion >= 80 ? 'bg-green-500' :
                              lead.puntuacion >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${lead.puntuacion}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold">{lead.puntuacion}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="font-semibold">{formatearMoneda(lead.valor_estimado)}</Table.Cell>
                    <Table.Cell>{lead.vendedor_asignado}</Table.Cell>
                    <Table.Cell>
                      <span className={lead.dias_sin_contacto > 3 ? 'text-red-600 font-semibold' : ''}>
                        {lead.dias_sin_contacto} días
                      </span>
                    </Table.Cell>
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
                        <Button size="xs" color="success">
                          <Icon icon="solar:phone-bold" width={14} />
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
        <Modal.Header>Detalle del Lead</Modal.Header>
        <Modal.Body>
          {leadSeleccionado && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Información Personal</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nombre:</strong> {leadSeleccionado.nombre}</p>
                    <p><strong>Email:</strong> {leadSeleccionado.email}</p>
                    <p><strong>Teléfono:</strong> {leadSeleccionado.telefono}</p>
                    <p><strong>Empresa:</strong> {leadSeleccionado.empresa}</p>
                    <p><strong>Cargo:</strong> {leadSeleccionado.cargo}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Información Comercial</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Producto de Interés:</strong> {leadSeleccionado.producto_interes}</p>
                    <p><strong>Valor Estimado:</strong> {formatearMoneda(leadSeleccionado.valor_estimado)}</p>
                    <p><strong>Probabilidad:</strong> {leadSeleccionado.probabilidad}%</p>
                    <p><strong>Vendedor Asignado:</strong> {leadSeleccionado.vendedor_asignado}</p>
                    <p><strong>Puntuación:</strong> {leadSeleccionado.puntuacion}/100</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Origen y Seguimiento</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Fuente:</strong> {leadSeleccionado.fuente}</p>
                    <p><strong>Origen Detalle:</strong> {leadSeleccionado.origen_detalle}</p>
                    <p><strong>Fecha de Creación:</strong> {leadSeleccionado.fecha_creacion}</p>
                  </div>
                  <div>
                    <p><strong>Estado Actual:</strong> {leadSeleccionado.estado}</p>
                    <p><strong>Temperatura:</strong> {leadSeleccionado.temperatura}</p>
                    <p><strong>Última Actividad:</strong> {leadSeleccionado.ultima_actividad}</p>
                    <p><strong>Días sin Contacto:</strong> {leadSeleccionado.dias_sin_contacto}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Notas</h4>
                <p className="text-sm bg-gray-50 p-3 rounded-lg">{leadSeleccionado.notas}</p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarModal(false)}>
            Cerrar
          </Button>
          <Button color="success">
            <Icon icon="solar:phone-bold" className="mr-2" width={16} />
            Contactar
          </Button>
          <Button color="primary">
            <Icon icon="solar:pen-bold" className="mr-2" width={16} />
            Editar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Leads; 