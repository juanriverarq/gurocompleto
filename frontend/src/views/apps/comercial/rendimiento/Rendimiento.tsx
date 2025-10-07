import { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Dropdown, Table } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { salesFunnelService } from 'src/services/salesFunnelService';
import salesPerformanceService, { AgentPerformance, PerformanceMetrics, PerformanceStatistics } from 'src/services/salesPerformanceService';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/comercial",
    title: "Gestión Comercial",
  },
  {
    title: "Análisis de Rendimiento",
  },
];

interface RendimientoVendedor {
  id: string;
  nombre: string;
  foto: string;
  ventas_mes: number;
  ventas_anterior: number;
  meta_mes: number;
  cumplimiento: number;
  comisiones: number;
  clientes_nuevos: number;
  llamadas: number;
  reuniones: number;
  propuestas: number;
  tasa_conversion: number;
  ticket_promedio: number;
  ranking: number;
}

interface MetricaEquipo {
  periodo: string;
  ventas_totales: number;
  meta_equipo: number;
  num_vendedores: number;
  clientes_nuevos: number;
  tasa_retencion: number;
  ticket_promedio: number;
}

const Rendimiento = () => {
  const [loading, setLoading] = useState(true);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'semana' | 'mes' | 'anio'>('mes');
  const [ordenarPor, setOrdenarPor] = useState('ventas_mes');

  const [metricas, setMetricas] = useState<MetricaEquipo>({
    periodo: 'Enero 2025',
    ventas_totales: 450000000,
    meta_equipo: 500000000,
    num_vendedores: 8,
    clientes_nuevos: 45,
    tasa_retencion: 87.5,
    ticket_promedio: 2800000
  });

  const [vendedores, setVendedores] = useState<RendimientoVendedor[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);

        // Obtener métricas generales
        const period = periodoSeleccionado === 'semana' ? 'week' : periodoSeleccionado === 'anio' ? 'year' : 'month';
        const metrics = await salesPerformanceService.getMetrics({ period });

        // Obtener rendimiento de agentes
        const agentsPerformance = await salesPerformanceService.getAgentsPerformance({
          period,
          limit: 10,
          sort_by: 'monthly_sales'
        });

        // Convertir datos del backend al formato del componente
        const vendedoresData: RendimientoVendedor[] = agentsPerformance.map((agent, index) => ({
          id: String(agent.id),
          nombre: agent.name,
          foto: `/images/profile/user-${(index % 12) + 1}.jpg`, // Placeholder
          ventas_mes: agent.monthly_sales,
          ventas_anterior: agent.monthly_sales * 0.9, // Placeholder
          meta_mes: agent.monthly_goal,
          cumplimiento: agent.achievement_percentage,
          comisiones: agent.commission_earned,
          clientes_nuevos: agent.new_clients,
          llamadas: agent.calls_made,
          reuniones: agent.meetings_scheduled,
          propuestas: agent.proposals_sent,
          tasa_conversion: agent.conversion_rate,
          ticket_promedio: agent.monthly_sales / Math.max(1, agent.new_clients), // Calcular ticket promedio
          ranking: index + 1
        }));

        setMetricas({
          periodo: periodoSeleccionado === 'semana' ? 'Semana Actual' : periodoSeleccionado === 'anio' ? 'Año Actual' : 'Mes Actual',
          ventas_totales: metrics.total_sales,
          meta_equipo: metrics.total_goals,
          num_vendedores: metrics.active_agents,
          clientes_nuevos: vendedoresData.reduce((sum, v) => sum + v.clientes_nuevos, 0),
          tasa_retencion: 87.5, // Placeholder
          ticket_promedio: vendedoresData.reduce((sum, v) => sum + v.ticket_promedio, 0) / Math.max(1, vendedoresData.length)
        });

        setVendedores(vendedoresData);

      } catch (e) {
        console.error('Error loading performance data:', e);
        // Fallback a datos mock si falla la API
        setMetricas(prev => ({
          ...prev,
          periodo: periodoSeleccionado === 'semana' ? 'Semana Actual' : periodoSeleccionado === 'anio' ? 'Año Actual' : 'Mes Actual',
        }));

        // Mantener datos mock como fallback
        setVendedores([
          {
            id: 'V001',
            nombre: 'Carlos Mendoza',
            foto: '/images/profile/user-1.jpg',
            ventas_mes: 85000000,
            ventas_anterior: 72000000,
            meta_mes: 80000000,
            cumplimiento: 106.25,
            comisiones: 4250000,
            clientes_nuevos: 12,
            llamadas: 145,
            reuniones: 28,
            propuestas: 15,
            tasa_conversion: 53.6,
            ticket_promedio: 3200000,
            ranking: 1
          },
          {
            id: 'V002',
            nombre: 'Ana García',
            foto: '/images/profile/user-2.jpg',
            ventas_mes: 78000000,
            ventas_anterior: 81000000,
            meta_mes: 75000000,
            cumplimiento: 104.0,
            comisiones: 3900000,
            clientes_nuevos: 9,
            llamadas: 132,
            reuniones: 24,
            propuestas: 12,
            tasa_conversion: 50.0,
            ticket_promedio: 2900000,
            ranking: 2
          },
          {
            id: 'V003',
            nombre: 'Miguel Torres',
            foto: '/images/profile/user-3.jpg',
            ventas_mes: 65000000,
            ventas_anterior: 58000000,
            meta_mes: 70000000,
            cumplimiento: 92.9,
            comisiones: 3250000,
            clientes_nuevos: 8,
            llamadas: 118,
            reuniones: 22,
            propuestas: 14,
            tasa_conversion: 63.6,
            ticket_promedio: 2600000,
            ranking: 3
          },
          {
            id: 'V004',
            nombre: 'Laura Rodríguez',
            foto: '/images/profile/user-4.jpg',
            ventas_mes: 62000000,
            ventas_anterior: 69000000,
            meta_mes: 65000000,
            cumplimiento: 95.4,
            comisiones: 3100000,
            clientes_nuevos: 7,
            llamadas: 98,
            reuniones: 19,
            propuestas: 11,
            tasa_conversion: 57.9,
            ticket_promedio: 2800000,
            ranking: 4
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [periodoSeleccionado]);

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);
  };

  const calcularCrecimiento = (actual: number, anterior: number) => {
    const crecimiento = ((actual - anterior) / anterior) * 100;
    return crecimiento;
  };

  const obtenerColorCumplimiento = (cumplimiento: number) => {
    if (cumplimiento >= 100) return 'text-green-600';
    if (cumplimiento >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const vendedoresOrdenados = [...vendedores].sort((a, b) => {
    switch (ordenarPor) {
      case 'ventas_mes':
        return b.ventas_mes - a.ventas_mes;
      case 'cumplimiento':
        return b.cumplimiento - a.cumplimiento;
      case 'tasa_conversion':
        return b.tasa_conversion - a.tasa_conversion;
      default:
        return a.ranking - b.ranking;
    }
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
      <BreadcrumbComp title="Análisis de Rendimiento" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Análisis de Rendimiento Comercial</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitorea el desempeño del equipo comercial con métricas detalladas y comparativas.
        </p>
      </div>

      {/* Métricas Generales del Equipo */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Rendimiento del Equipo - {metricas.periodo}</h3>
            <div className="flex gap-2">
              <Dropdown label={periodoSeleccionado === 'semana' ? 'Semana' : periodoSeleccionado === 'anio' ? 'Año' : 'Mes'}>
                <Dropdown.Item onClick={() => setPeriodoSeleccionado('semana')}>Semana</Dropdown.Item>
                <Dropdown.Item onClick={() => setPeriodoSeleccionado('mes')}>Mes</Dropdown.Item>
                <Dropdown.Item onClick={() => setPeriodoSeleccionado('anio')}>Año</Dropdown.Item>
              </Dropdown>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="p-4 bg-primary/10 rounded-lg mb-3">
                <Icon icon="solar:dollar-minimalistic-bold" className="text-primary mx-auto" width={32} />
              </div>
              <h4 className="text-2xl font-bold text-dark dark:text-white">{formatearMoneda(metricas.ventas_totales)}</h4>
              <p className="text-sm text-gray-500">Ventas Totales</p>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${(metricas.ventas_totales / metricas.meta_equipo) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {((metricas.ventas_totales / metricas.meta_equipo) * 100).toFixed(1)}% de la meta
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <div className="p-4 bg-success/10 rounded-lg mb-3">
                <Icon icon="solar:users-group-rounded-bold" className="text-success mx-auto" width={32} />
              </div>
              <h4 className="text-2xl font-bold text-dark dark:text-white">{metricas.clientes_nuevos}</h4>
              <p className="text-sm text-gray-500">Clientes Nuevos</p>
              <p className="text-xs text-success mt-2">+15% vs mes anterior</p>
            </div>
            
            <div className="text-center">
              <div className="p-4 bg-info/10 rounded-lg mb-3">
                <Icon icon="solar:chart-2-bold" className="text-info mx-auto" width={32} />
              </div>
              <h4 className="text-2xl font-bold text-dark dark:text-white">{metricas.tasa_retencion}%</h4>
              <p className="text-sm text-gray-500">Tasa Retención</p>
              <p className="text-xs text-info mt-2">Meta: 85%</p>
            </div>
            
            <div className="text-center">
              <div className="p-4 bg-warning/10 rounded-lg mb-3">
                <Icon icon="solar:ticket-bold" className="text-warning mx-auto" width={32} />
              </div>
              <h4 className="text-lg font-bold text-dark dark:text-white">{formatearMoneda(metricas.ticket_promedio)}</h4>
              <p className="text-sm text-gray-500">Ticket Promedio</p>
              <p className="text-xs text-warning mt-2">+8% vs mes anterior</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {vendedores.slice(0, 3).map((vendedor, index) => (
          <Card key={vendedor.id} className={`relative ${index === 0 ? 'ring-2 ring-yellow-400' : ''}`}>
            <div className="p-6">
              {index === 0 && (
                <div className="absolute -top-2 -right-2">
                  <Badge color="warning" className="flex items-center gap-1">
                    <Icon icon="solar:crown-bold" width={14} />
                    Top Performer
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <img 
                    src={vendedor.foto} 
                    alt={vendedor.nombre}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {vendedor.ranking}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-dark dark:text-white">{vendedor.nombre}</h4>
                  <p className="text-sm text-gray-500">{vendedor.id}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Ventas del Mes</span>
                    <span className="font-semibold">{formatearMoneda(vendedor.ventas_mes)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${(vendedor.ventas_mes / vendedor.meta_mes) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Cumplimiento</p>
                    <p className={`font-semibold ${obtenerColorCumplimiento(vendedor.cumplimiento)}`}>
                      {vendedor.cumplimiento.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Conversión</p>
                    <p className="font-semibold">{vendedor.tasa_conversion.toFixed(1)}%</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Clientes Nuevos</p>
                    <p className="font-semibold">{vendedor.clientes_nuevos}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Comisiones</p>
                    <p className="font-semibold text-green-600">{formatearMoneda(vendedor.comisiones)}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabla Detallada de Rendimiento */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Rendimiento Detallado por Vendedor</h3>
            <div className="flex gap-2">
              <Dropdown label="Ordenar por">
                <Dropdown.Item onClick={() => setOrdenarPor('ventas_mes')}>
                  Ventas del Mes
                </Dropdown.Item>
                <Dropdown.Item onClick={() => setOrdenarPor('cumplimiento')}>
                  % Cumplimiento
                </Dropdown.Item>
                <Dropdown.Item onClick={() => setOrdenarPor('tasa_conversion')}>
                  Tasa Conversión
                </Dropdown.Item>
              </Dropdown>
              <Button color="gray" size="sm">
                <Icon icon="solar:export-bold" className="mr-2" width={16} />
                Exportar
              </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Vendedor</Table.HeadCell>
                <Table.HeadCell>Ventas Mes</Table.HeadCell>
                <Table.HeadCell>Meta</Table.HeadCell>
                <Table.HeadCell>Cumplimiento</Table.HeadCell>
                <Table.HeadCell>Crecimiento</Table.HeadCell>
                <Table.HeadCell>Clientes Nuevos</Table.HeadCell>
                <Table.HeadCell>Actividades</Table.HeadCell>
                <Table.HeadCell>Conversión</Table.HeadCell>
                <Table.HeadCell>Ticket Promedio</Table.HeadCell>
                <Table.HeadCell>Comisiones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {vendedoresOrdenados.map((vendedor) => (
                  <Table.Row key={vendedor.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <img 
                          src={vendedor.foto} 
                          alt={vendedor.nombre}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-semibold text-sm">{vendedor.nombre}</p>
                          <p className="text-xs text-gray-500">Ranking #{vendedor.ranking}</p>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="font-semibold">{formatearMoneda(vendedor.ventas_mes)}</Table.Cell>
                    <Table.Cell>{formatearMoneda(vendedor.meta_mes)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${obtenerColorCumplimiento(vendedor.cumplimiento)}`}>
                          {vendedor.cumplimiento.toFixed(1)}%
                        </span>
                        {vendedor.cumplimiento >= 100 && (
                          <Icon icon="solar:check-circle-bold" className="text-green-500" width={16} />
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-1">
                        {calcularCrecimiento(vendedor.ventas_mes, vendedor.ventas_anterior) > 0 ? (
                          <Icon icon="solar:arrow-up-bold" className="text-green-500" width={14} />
                        ) : (
                          <Icon icon="solar:arrow-down-bold" className="text-red-500" width={14} />
                        )}
                        <span className={calcularCrecimiento(vendedor.ventas_mes, vendedor.ventas_anterior) > 0 ? 'text-green-600' : 'text-red-600'}>
                          {Math.abs(calcularCrecimiento(vendedor.ventas_mes, vendedor.ventas_anterior)).toFixed(1)}%
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="info">{vendedor.clientes_nuevos}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-xs space-y-1">
                        <p>Llamadas: {vendedor.llamadas}</p>
                        <p>Reuniones: {vendedor.reuniones}</p>
                        <p>Propuestas: {vendedor.propuestas}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${vendedor.tasa_conversion}%` }}
                          ></div>
                        </div>
                        <span className="text-sm">{vendedor.tasa_conversion.toFixed(1)}%</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{formatearMoneda(vendedor.ticket_promedio)}</Table.Cell>
                    <Table.Cell className="font-semibold text-green-600">
                      {formatearMoneda(vendedor.comisiones)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      </Card>
    </>
  );
};

export default Rendimiento; 