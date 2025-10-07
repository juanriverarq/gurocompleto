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
    title: "Conversiones",
  },
];

interface EtapaConversion {
  nombre: string;
  total: number;
  convertidos: number;
  tasa_conversion: number;
  valor_promedio: number;
  tiempo_promedio: number;
}

interface ConversionDetalle {
  id: string;
  lead_id: string;
  nombre_cliente: string;
  empresa: string;
  producto: string;
  fuente_original: string;
  fecha_lead: string;
  fecha_conversion: string;
  dias_conversion: number;
  valor_poliza: number;
  vendedor: string;
  etapas_recorridas: string[];
  actividades_realizadas: number;
  canal_conversion: string;
  tipo_conversion: 'nueva_poliza' | 'renovacion' | 'producto_adicional';
}

interface MetricaConversion {
  periodo: string;
  total_leads: number;
  leads_convertidos: number;
  tasa_conversion_general: number;
  valor_total_conversiones: number;
  tiempo_promedio_conversion: number;
  costo_por_conversion: number;
}

const Conversiones = () => {
  const [loading, setLoading] = useState(true);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes_actual');
  const [filtroFuente, setFiltroFuente] = useState('todos');
  const [filtroVendedor, setFiltroVendedor] = useState('todos');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [conversionSeleccionada, setConversionSeleccionada] = useState<ConversionDetalle | null>(null);

  const [metricas, setMetricas] = useState<MetricaConversion>({
    periodo: 'Enero 2025',
    total_leads: 0,
    leads_convertidos: 0,
    tasa_conversion_general: 0,
    valor_total_conversiones: 0,
    tiempo_promedio_conversion: 0,
    costo_por_conversion: 0
  });

  const [embudoConversion, setEmbudoConversion] = useState<EtapaConversion[]>([]);
  const [conversiones, setConversiones] = useState<ConversionDetalle[]>([]);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setMetricas({
        periodo: 'Enero 2025',
        total_leads: 234,
        leads_convertidos: 45,
        tasa_conversion_general: 19.2,
        valor_total_conversiones: 180000000,
        tiempo_promedio_conversion: 28,
        costo_por_conversion: 450000
      });

      setEmbudoConversion([
        {
          nombre: 'Leads Generados',
          total: 234,
          convertidos: 234,
          tasa_conversion: 100,
          valor_promedio: 0,
          tiempo_promedio: 0
        },
        {
          nombre: 'Leads Contactados',
          total: 234,
          convertidos: 189,
          tasa_conversion: 80.8,
          valor_promedio: 0,
          tiempo_promedio: 2
        },
        {
          nombre: 'Leads Calificados',
          total: 189,
          convertidos: 142,
          tasa_conversion: 75.1,
          valor_promedio: 0,
          tiempo_promedio: 5
        },
        {
          nombre: 'Propuestas Enviadas',
          total: 142,
          convertidos: 89,
          tasa_conversion: 62.7,
          valor_promedio: 0,
          tiempo_promedio: 12
        },
        {
          nombre: 'En Negociación',
          total: 89,
          convertidos: 67,
          tasa_conversion: 75.3,
          valor_promedio: 0,
          tiempo_promedio: 18
        },
        {
          nombre: 'Conversiones Exitosas',
          total: 67,
          convertidos: 45,
          tasa_conversion: 67.2,
          valor_promedio: 4000000,
          tiempo_promedio: 28
        }
      ]);

      setConversiones([
        {
          id: 'CONV-001',
          lead_id: 'LEAD-001',
          nombre_cliente: 'María González',
          empresa: 'Transportes González S.A.S',
          producto: 'Seguro de Flota Vehicular',
          fuente_original: 'Website',
          fecha_lead: '10/01/2025',
          fecha_conversion: '15/01/2025',
          dias_conversion: 5,
          valor_poliza: 25000000,
          vendedor: 'Carlos Mendoza',
          etapas_recorridas: ['Lead', 'Contactado', 'Calificado', 'Propuesta', 'Convertido'],
          actividades_realizadas: 8,
          canal_conversion: 'Reunión presencial',
          tipo_conversion: 'nueva_poliza'
        },
        {
          id: 'CONV-002',
          lead_id: 'LEAD-002',
          nombre_cliente: 'Roberto Silva',
          empresa: 'Constructora del Futuro',
          producto: 'Todo Riesgo Construcción',
          fuente_original: 'Referido',
          fecha_lead: '08/01/2025',
          fecha_conversion: '14/01/2025',
          dias_conversion: 6,
          valor_poliza: 45000000,
          vendedor: 'Ana García',
          etapas_recorridas: ['Lead', 'Contactado', 'Calificado', 'Propuesta', 'Negociación', 'Convertido'],
          actividades_realizadas: 12,
          canal_conversion: 'Llamada telefónica',
          tipo_conversion: 'nueva_poliza'
        },
        {
          id: 'CONV-003',
          lead_id: 'LEAD-003',
          nombre_cliente: 'Andrea Morales',
          empresa: 'PYME Innovadora Ltda',
          producto: 'Seguro PYME Integral',
          fuente_original: 'Google Ads',
          fecha_lead: '12/01/2025',
          fecha_conversion: '18/01/2025',
          dias_conversion: 6,
          valor_poliza: 8000000,
          vendedor: 'Miguel Torres',
          etapas_recorridas: ['Lead', 'Contactado', 'Calificado', 'Propuesta', 'Convertido'],
          actividades_realizadas: 6,
          canal_conversion: 'Email + WhatsApp',
          tipo_conversion: 'nueva_poliza'
        },
        {
          id: 'CONV-004',
          lead_id: 'LEAD-004',
          nombre_cliente: 'Fernando López',
          empresa: 'Industrias del Pacífico',
          producto: 'Responsabilidad Civil Profesional',
          fuente_original: 'LinkedIn',
          fecha_lead: '05/01/2025',
          fecha_conversion: '20/01/2025',
          dias_conversion: 15,
          valor_poliza: 15000000,
          vendedor: 'Laura Rodríguez',
          etapas_recorridas: ['Lead', 'Contactado', 'Calificado', 'Propuesta', 'Negociación', 'Convertido'],
          actividades_realizadas: 15,
          canal_conversion: 'Reunión virtual',
          tipo_conversion: 'nueva_poliza'
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

  const obtenerColorTipoConversion = (tipo: string) => {
    const colores = {
      'nueva_poliza': 'bg-green-100 text-green-800',
      'renovacion': 'bg-blue-100 text-blue-800',
      'producto_adicional': 'bg-purple-100 text-purple-800'
    };
    return colores[tipo as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const obtenerColorFuente = (fuente: string) => {
    const colores = {
      'Website': 'bg-blue-100 text-blue-800',
      'Google Ads': 'bg-green-100 text-green-800',
      'Facebook': 'bg-blue-100 text-blue-800',
      'LinkedIn': 'bg-indigo-100 text-indigo-800',
      'Referido': 'bg-purple-100 text-purple-800',
      'Teléfono': 'bg-yellow-100 text-yellow-800'
    };
    return colores[fuente as keyof typeof colores] || 'bg-gray-100 text-gray-800';
  };

  const conversionesFiltradas = conversiones.filter(conversion => {
    const cumpleFuente = filtroFuente === 'todos' || conversion.fuente_original === filtroFuente;
    const cumpleVendedor = filtroVendedor === 'todos' || conversion.vendedor === filtroVendedor;
    return cumpleFuente && cumpleVendedor;
  });

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '256px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 24px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(99, 91, 255, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(99, 91, 255, 0.12)',
            borderTop: '2px solid rgba(99, 91, 255, 0.4)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ 
            color: '#64748b',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Cargando conversiones...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Análisis de Conversiones" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Análisis de Conversiones</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitorea el embudo de conversión y analiza el rendimiento de leads convertidos a clientes.
        </p>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon="solar:users-group-rounded-bold" className="text-primary" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{metricas.total_leads}</h3>
              <p className="text-xs text-gray-500">Total Leads</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{metricas.leads_convertidos}</h3>
              <p className="text-xs text-gray-500">Convertidos</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Icon icon="solar:chart-2-bold" className="text-info" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{metricas.tasa_conversion_general}%</h3>
              <p className="text-xs text-gray-500">Tasa Conversión</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Icon icon="solar:dollar-minimalistic-bold" className="text-warning" width={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-dark dark:text-white">{formatearMoneda(metricas.valor_total_conversiones)}</h3>
              <p className="text-xs text-gray-500">Valor Total</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon icon="solar:clock-circle-bold" className="text-purple-600" width={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">{metricas.tiempo_promedio_conversion}</h3>
              <p className="text-xs text-gray-500">Días Promedio</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Icon icon="solar:calculator-bold" className="text-orange-600" width={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-dark dark:text-white">{formatearMoneda(metricas.costo_por_conversion)}</h3>
              <p className="text-xs text-gray-500">Costo/Conversión</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Embudo de Conversión */}
      <Card className="mb-6">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Embudo de Conversión - {metricas.periodo}</h3>
          <div className="space-y-4">
            {embudoConversion.map((etapa, index) => (
              <div key={index} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      index === 0 ? 'bg-blue-500' :
                      index === embudoConversion.length - 1 ? 'bg-green-500' : 'bg-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <h4 className="font-semibold">{etapa.nombre}</h4>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span><strong>{etapa.convertidos}</strong> de {etapa.total}</span>
                    <span className="text-green-600 font-semibold">{etapa.tasa_conversion.toFixed(1)}%</span>
                    {etapa.tiempo_promedio > 0 && (
                      <span className="text-gray-600">{etapa.tiempo_promedio} días</span>
                    )}
                  </div>
                </div>
                <div className="ml-11">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        etapa.tasa_conversion >= 80 ? 'bg-green-500' :
                        etapa.tasa_conversion >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${etapa.tasa_conversion}%` }}
                    ></div>
                  </div>
                </div>
                {index < embudoConversion.length - 1 && (
                  <div className="ml-4 mt-2 w-px h-4 bg-gray-300"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Análisis por Fuente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Conversiones por Fuente</h3>
            <div className="space-y-3">
              {['Website', 'Google Ads', 'Referido', 'LinkedIn', 'Facebook'].map((fuente, index) => {
                const conversionesFuente = conversiones.filter(c => c.fuente_original === fuente);
                const porcentaje = (conversionesFuente.length / conversiones.length) * 100;
                return (
                  <div key={fuente} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={obtenerColorFuente(fuente)} size="sm">
                        {fuente}
                      </Badge>
                      <span className="text-sm">{conversionesFuente.length} conversiones</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold">{porcentaje.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Vendedores</h3>
            <div className="space-y-3">
              {['Carlos Mendoza', 'Ana García', 'Miguel Torres', 'Laura Rodríguez'].map((vendedor) => {
                const conversionesVendedor = conversiones.filter(c => c.vendedor === vendedor);
                const valorTotal = conversionesVendedor.reduce((sum, c) => sum + c.valor_poliza, 0);
                return (
                  <div key={vendedor} className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{vendedor}</p>
                      <p className="text-xs text-gray-500">{conversionesVendedor.length} conversiones</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{formatearMoneda(valorTotal)}</p>
                      <p className="text-xs text-gray-500">
                        Promedio: {formatearMoneda(valorTotal / (conversionesVendedor.length || 1))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fuente</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={filtroFuente}
                  onChange={(e) => setFiltroFuente(e.target.value)}
                >
                  <option value="todos">Todas las Fuentes</option>
                  <option value="Website">Website</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Referido">Referido</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Facebook">Facebook</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Vendedor</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
            </div>
            
            <div className="flex gap-2">
              <Button color="primary" size="sm">
                <Icon icon="solar:chart-2-bold" className="mr-2" width={16} />
                Generar Reporte
              </Button>
              <Button color="gray" size="sm">
                <Icon icon="solar:export-bold" className="mr-2" width={16} />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Conversiones */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Conversiones Exitosas ({conversionesFiltradas.length})</h3>
            <Badge color="success">
              {formatearMoneda(conversionesFiltradas.reduce((sum, c) => sum + c.valor_poliza, 0))} Total
            </Badge>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Cliente</Table.HeadCell>
                <Table.HeadCell>Empresa</Table.HeadCell>
                <Table.HeadCell>Producto</Table.HeadCell>
                <Table.HeadCell>Fuente</Table.HeadCell>
                <Table.HeadCell>Valor Póliza</Table.HeadCell>
                <Table.HeadCell>Días Conversión</Table.HeadCell>
                <Table.HeadCell>Vendedor</Table.HeadCell>
                <Table.HeadCell>Canal</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {conversionesFiltradas.map((conversion) => (
                  <Table.Row key={conversion.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <div>
                        <p className="font-semibold text-sm">{conversion.nombre_cliente}</p>
                        <p className="text-xs text-gray-500">Lead: {conversion.fecha_lead}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{conversion.empresa}</Table.Cell>
                    <Table.Cell>{conversion.producto}</Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorFuente(conversion.fuente_original)} size="sm">
                        {conversion.fuente_original}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="font-semibold text-green-600">
                      {formatearMoneda(conversion.valor_poliza)}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Icon 
                          icon="solar:clock-circle-bold" 
                          className={conversion.dias_conversion <= 7 ? 'text-green-500' : 
                                   conversion.dias_conversion <= 14 ? 'text-yellow-500' : 'text-red-500'} 
                          width={16} 
                        />
                        <span>{conversion.dias_conversion} días</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{conversion.vendedor}</Table.Cell>
                    <Table.Cell className="text-sm">{conversion.canal_conversion}</Table.Cell>
                    <Table.Cell>
                      <Badge className={obtenerColorTipoConversion(conversion.tipo_conversion)} size="sm">
                        {conversion.tipo_conversion.replace('_', ' ')}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Button 
                        size="xs" 
                        color="gray"
                        onClick={() => {
                          setConversionSeleccionada(conversion);
                          setMostrarModal(true);
                        }}
                      >
                        <Icon icon="solar:eye-bold" width={14} />
                      </Button>
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
        <Modal.Header>Detalle de Conversión</Modal.Header>
        <Modal.Body>
          {conversionSeleccionada && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Información del Cliente</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nombre:</strong> {conversionSeleccionada.nombre_cliente}</p>
                    <p><strong>Empresa:</strong> {conversionSeleccionada.empresa}</p>
                    <p><strong>Producto:</strong> {conversionSeleccionada.producto}</p>
                    <p><strong>Valor Póliza:</strong> {formatearMoneda(conversionSeleccionada.valor_poliza)}</p>
                    <p><strong>Vendedor:</strong> {conversionSeleccionada.vendedor}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Proceso de Conversión</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Fuente Original:</strong> {conversionSeleccionada.fuente_original}</p>
                    <p><strong>Canal de Conversión:</strong> {conversionSeleccionada.canal_conversion}</p>
                    <p><strong>Fecha Lead:</strong> {conversionSeleccionada.fecha_lead}</p>
                    <p><strong>Fecha Conversión:</strong> {conversionSeleccionada.fecha_conversion}</p>
                    <p><strong>Tiempo Total:</strong> {conversionSeleccionada.dias_conversion} días</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Etapas Recorridas</h4>
                <div className="flex flex-wrap gap-2">
                  {conversionSeleccionada.etapas_recorridas.map((etapa, index) => (
                    <Badge key={index} color="primary" size="sm">
                      {index + 1}. {etapa}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Actividades Realizadas</h4>
                  <p className="text-2xl font-bold text-primary">{conversionSeleccionada.actividades_realizadas}</p>
                  <p className="text-sm text-gray-600">Llamadas, emails, reuniones, etc.</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Tipo de Conversión</h4>
                  <Badge className={obtenerColorTipoConversion(conversionSeleccionada.tipo_conversion)}>
                    {conversionSeleccionada.tipo_conversion.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setMostrarModal(false)}>
            Cerrar
          </Button>
          <Button color="primary">
            <Icon icon="solar:document-text-bold" className="mr-2" width={16} />
            Ver Póliza
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Conversiones; 