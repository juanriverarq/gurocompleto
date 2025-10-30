import { useState, useEffect } from 'react';
import { Card, Badge, Button, Dropdown, Table } from 'flowbite-react';
import { Icon } from '@iconify/react';
import salesPerformanceService, { AgentPerformance, PerformanceMetrics, PerformanceStatistics } from 'src/services/salesPerformanceService';


interface RendimientoVendedor {
  id: string;
  nombre: string;
  iniciales: string;
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
  const getInitialPeriodo = (): 'semana' | 'mes' | 'anio' => {
    const p = new URLSearchParams(window.location.search).get('period');
    if (p === 'year' || p === 'anio') return 'anio';
    if (p === 'week' || p === 'semana') return 'semana';
    return 'mes';
  };
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'semana' | 'mes' | 'anio'>(getInitialPeriodo());
  const [ordenarPor, setOrdenarPor] = useState('ventas_mes');

  const [metricas, setMetricas] = useState<MetricaEquipo>({
    periodo: 'Mes Actual',
    ventas_totales: 0,
    meta_equipo: 0,
    num_vendedores: 0,
    clientes_nuevos: 0,
    tasa_retencion: 0,
    ticket_promedio: 0
  });

  const [vendedores, setVendedores] = useState<RendimientoVendedor[]>([]);

  const getIniciales = (nombre: string): string => {
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length === 0) return '??';
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);

        const period = periodoSeleccionado === 'semana' ? 'week' : periodoSeleccionado === 'anio' ? 'year' : 'month';

        const [metrics, agentsPerformance, stats] = await Promise.all([
          salesPerformanceService.getMetrics({ period }),
          salesPerformanceService.getAgentsPerformance({
            period,
            limit: 10,
            sort_by: 'monthly_sales',
          }),
          salesPerformanceService.getStatistics({ period }),
        ]);

        const vendedoresData: RendimientoVendedor[] = agentsPerformance.map((agent, index) => ({
          id: String(agent.id),
          nombre: agent.name,
          iniciales: getIniciales(agent.name),
          ventas_mes: agent.monthly_sales,
          ventas_anterior: agent.monthly_sales,
          meta_mes: agent.monthly_goal,
          cumplimiento: agent.achievement_percentage,
          comisiones: agent.commission_earned,
          clientes_nuevos: agent.new_clients,
          llamadas: agent.calls_made,
          reuniones: agent.meetings_scheduled,
          propuestas: agent.proposals_sent,
          tasa_conversion: agent.conversion_rate,
          ticket_promedio: agent.new_clients > 0 ? agent.monthly_sales / agent.new_clients : 0,
          ranking: agent.ranking || index + 1,
        }));

        const totalNewClients = vendedoresData.reduce((sum, v) => sum + (v.clientes_nuevos || 0), 0);
        const totalSales = vendedoresData.reduce((sum, v) => sum + (v.ventas_mes || 0), 0);
        const avgTicket = totalNewClients > 0 ? totalSales / totalNewClients : 0;

        setMetricas({
          periodo: periodoSeleccionado === 'semana' ? 'Semana Actual' : periodoSeleccionado === 'anio' ? 'Año Actual' : 'Mes Actual',
          ventas_totales: metrics.total_sales,
          meta_equipo: metrics.total_goals,
          num_vendedores: metrics.active_agents,
          clientes_nuevos: totalNewClients,
          tasa_retencion: stats?.average_conversion_rate ?? 0,
          ticket_promedio: avgTicket,
        });

        setVendedores(vendedoresData);
      } catch (e) {
        console.error('Error loading performance data:', e);
        setVendedores([]);
        setMetricas((prev) => ({
          ...prev,
          periodo: periodoSeleccionado === 'semana' ? 'Semana Actual' : periodoSeleccionado === 'anio' ? 'Año Actual' : 'Mes Actual',
          ventas_totales: 0,
          meta_equipo: 0,
          num_vendedores: 0,
          clientes_nuevos: 0,
          tasa_retencion: 0,
          ticket_promedio: 0,
        }));
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
                    style={{ width: `${Math.min(100, metricas.meta_equipo > 0 ? (metricas.ventas_totales / metricas.meta_equipo) * 100 : 0)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {metricas.meta_equipo > 0 ? ((metricas.ventas_totales / metricas.meta_equipo) * 100).toFixed(1) : '0.0'}% de la meta
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <div className="p-4 bg-success/10 rounded-lg mb-3">
                <Icon icon="solar:users-group-rounded-bold" className="text-success mx-auto" width={32} />
              </div>
              <h4 className="text-2xl font-bold text-dark dark:text-white">{metricas.clientes_nuevos}</h4>
              <p className="text-sm text-gray-500">Clientes Nuevos</p>
            </div>
            
            <div className="text-center">
              <div className="p-4 bg-info/10 rounded-lg mb-3">
                <Icon icon="solar:chart-2-bold" className="text-info mx-auto" width={32} />
              </div>
              <h4 className="text-2xl font-bold text-dark dark:text-white">{metricas.tasa_retencion}%</h4>
              <p className="text-sm text-gray-500">Tasa Retención</p>
            </div>
            
            <div className="text-center">
              <div className="p-4 bg-warning/10 rounded-lg mb-3">
                <Icon icon="solar:ticket-bold" className="text-warning mx-auto" width={32} />
              </div>
              <h4 className="text-lg font-bold text-dark dark:text-white">{formatearMoneda(metricas.ticket_promedio)}</h4>
              <p className="text-sm text-gray-500">Ticket Promedio</p>
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
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                    {vendedor.iniciales}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {vendedor.ranking}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-dark dark:text-white">{vendedor.nombre}</h4>
                  <p className="text-sm text-gray-500">ID: {vendedor.id}</p>
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
                      style={{ width: `${Math.min(100, vendedor.meta_mes > 0 ? (vendedor.ventas_mes / vendedor.meta_mes) * 100 : 0)}%` }}
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
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                          {vendedor.iniciales}
                        </div>
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
                            style={{ width: `${Math.min(100, vendedor.tasa_conversion)}%` }}
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