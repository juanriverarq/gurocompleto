import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Button,
  Spinner,
  Badge,
  Table,
  Tabs,
  Progress,
  Dropdown,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import { IconDots } from '@tabler/icons-react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { polizaService } from '../../../services/polizaService';
import { useToast } from 'src/hooks/use-toast';

interface ComisionVendedor {
  id: string;
  polizaId: string;
  numeroPoliza: string;
  cliente: string;
  aseguradora: string;
  ramo: string;
  vendedor: string;
  vendedorId: string;
  primaNeta: number;
  porcentajeComision: number;
  comisionTotal: number;
  comisionPagada: number;
  comisionPendiente: number;
  fechaPoliza: string;
  fechaVencimiento: string;
  estadoPago: 'Pagado' | 'Pendiente' | 'Parcial';
  fechaPago?: string;
}

interface EstadisticasLiquidacion {
  totalComisiones: number;
  comisionesPagadas: number;
  comisionesPendientes: number;
  totalVendedores: number;
  polizasConComision: number;
  tasaPago: number;
}

const LiquidarVendedores = () => {
  const [comisiones, setComisiones] = useState<ComisionVendedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [estadisticas, setEstadisticas] = useState<EstadisticasLiquidacion | null>(null);
  const { toast } = useToast();

  const [paginaActual, setPaginaActual] = useState(1);
  const [elementosPorPagina, setElementosPorPagina] = useState(25);

  const [filtros, setFiltros] = useState({
    busqueda: '',
    vendedor: '',
    estadoPago: '',
    periodo: new Date().toISOString().slice(0, 7),
  });

  const [tabActivo, setTabActivo] = useState<'porPagar' | 'pagados'>('porPagar');

  const cargarComisiones = async () => {
    try {
      setLoading(true);

      // Usar el endpoint de cartera que incluye información real de pagos y comisiones
      const response = await polizaService.getCarteraPolizas();

      if (!response.success || !response.data) {
        setComisiones([]);
        return;
      }

      // Filtrar solo pólizas con vendedor asignado y que tengan comisiones
      const comisionesVendedores: ComisionVendedor[] = response.data
        .filter((poliza: any) => poliza.vendedor && poliza.vendedor !== 'Sin asignar')
        .map((poliza: any) => {
          const primaNeta = Number(poliza.prima_neta || 0);
          const comisionTotal = Number(poliza.comision || 0);
          
          // Obtener información real de cobro de comisión
          const cobroComision = poliza.cobro_comision || {};
          const comisionCobrada = Number(cobroComision.cobrada || 0);
          const comisionPendiente = Number(cobroComision.pendiente || 0);
          
          // Si no hay cobro registrado pero hay comisión, está pendiente
          const pendiente = comisionPendiente > 0 ? comisionPendiente : (comisionCobrada === 0 && comisionTotal > 0 ? comisionTotal : 0);
          
          // Determinar estado de pago
          let estadoPago: 'Pagado' | 'Pendiente' | 'Parcial' = 'Pendiente';
          if (comisionCobrada >= comisionTotal && comisionTotal > 0) {
            estadoPago = 'Pagado';
          } else if (comisionCobrada > 0) {
            estadoPago = 'Parcial';
          }

          return {
            id: String(poliza.id),
            polizaId: String(poliza.id),
            numeroPoliza: poliza.numero_poliza || '',
            cliente: poliza.cliente || 'Sin nombre',
            aseguradora: poliza.aseguradora || '',
            ramo: poliza.ramo || '',
            vendedor: poliza.vendedor,
            vendedorId: String(poliza.vendedor_id || poliza.vendedor),
            primaNeta,
            porcentajeComision: Number(poliza.porcentaje_comision || 15),
            comisionTotal,
            comisionPagada: comisionCobrada,
            comisionPendiente: pendiente,
            fechaPoliza: poliza.fecha_inicio || '',
            fechaVencimiento: poliza.fecha_vencimiento || '',
            estadoPago,
            fechaPago: cobroComision.fecha,
          };
        });

      setComisiones(comisionesVendedores);
      calcularEstadisticas(comisionesVendedores);

    } catch (error: any) {
      console.error('Error cargando comisiones:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información de comisiones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularEstadisticas = (comisionesData: ComisionVendedor[]) => {
    const totalComisiones = comisionesData.reduce((sum, c) => sum + c.comisionTotal, 0);
    const comisionesPagadas = comisionesData.reduce((sum, c) => sum + c.comisionPagada, 0);
    const comisionesPendientes = comisionesData.reduce((sum, c) => sum + c.comisionPendiente, 0);
    const vendedoresUnicos = new Set(comisionesData.map(c => c.vendedorId)).size;
    const tasaPago = totalComisiones > 0 ? (comisionesPagadas / totalComisiones) * 100 : 0;

    setEstadisticas({
      totalComisiones,
      comisionesPagadas,
      comisionesPendientes,
      totalVendedores: vendedoresUnicos,
      polizasConComision: comisionesData.length,
      tasaPago,
    });
  };

  useEffect(() => {
    cargarComisiones();
  }, []);

  const comisionesFiltradas = useMemo(() => {
    let resultado = [...comisiones];

    if (filtros.busqueda) {
      const busqueda = filtros.busqueda.toLowerCase();
      resultado = resultado.filter(c =>
        c.numeroPoliza.toLowerCase().includes(busqueda) ||
        c.cliente.toLowerCase().includes(busqueda) ||
        c.vendedor.toLowerCase().includes(busqueda)
      );
    }

    if (filtros.vendedor) {
      resultado = resultado.filter(c => c.vendedor === filtros.vendedor);
    }

    if (filtros.estadoPago) {
      resultado = resultado.filter(c => c.estadoPago === filtros.estadoPago);
    }

    return resultado;
  }, [comisiones, filtros]);

  const comisionesPorPagar = useMemo(() => 
    comisionesFiltradas.filter(c => c.estadoPago === 'Pendiente' || c.estadoPago === 'Parcial'),
    [comisionesFiltradas]
  );

  const comisionesPagadas = useMemo(() => 
    comisionesFiltradas.filter(c => c.estadoPago === 'Pagado'),
    [comisionesFiltradas]
  );

  const comisionesPorPagarPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return comisionesPorPagar.slice(inicio, inicio + elementosPorPagina);
  }, [comisionesPorPagar, paginaActual, elementosPorPagina]);

  const totalPaginasPorPagar = Math.ceil(comisionesPorPagar.length / elementosPorPagina);

  const comisionesPagadasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return comisionesPagadas.slice(inicio, inicio + elementosPorPagina);
  }, [comisionesPagadas, paginaActual, elementosPorPagina]);

  const totalPaginasPagadas = Math.ceil(comisionesPagadas.length / elementosPorPagina);

  const estadisticasUI = useMemo(() => {
    const totalComisiones = comisionesFiltradas.reduce((sum, c) => sum + c.comisionTotal, 0);
    const comisionesPagadasTotal = comisionesFiltradas.reduce((sum, c) => sum + c.comisionPagada, 0);
    const comisionesPendientesTotal = comisionesFiltradas.reduce((sum, c) => sum + c.comisionPendiente, 0);
    const vendedoresUnicos = new Set(comisionesFiltradas.map(c => c.vendedorId)).size;
    const tasaPago = totalComisiones > 0 ? (comisionesPagadasTotal / totalComisiones) * 100 : 0;

    return {
      totalComisiones,
      comisionesPagadas: comisionesPagadasTotal,
      comisionesPendientes: comisionesPendientesTotal,
      totalVendedores: vendedoresUnicos,
      polizasConComision: comisionesFiltradas.length,
      tasaPago,
    } as EstadisticasLiquidacion;
  }, [comisionesFiltradas]);

  const comisionesPorVendedor = useMemo(() => {
    const consolidado = comisionesFiltradas.reduce((acc, c) => {
      if (!acc[c.vendedorId]) {
        acc[c.vendedorId] = {
          vendedor: c.vendedor,
          vendedorId: c.vendedorId,
          polizas: 0,
          comisionTotal: 0,
          comisionPagada: 0,
          comisionPendiente: 0,
        };
      }
      acc[c.vendedorId].polizas++;
      acc[c.vendedorId].comisionTotal += c.comisionTotal;
      acc[c.vendedorId].comisionPagada += c.comisionPagada;
      acc[c.vendedorId].comisionPendiente += c.comisionPendiente;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(consolidado);
  }, [comisionesFiltradas]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return '-';
    }
  };

  const getEstadoPagoColor = (estado: string) => {
    switch (estado) {
      case 'Pagado': return 'success';
      case 'Pendiente': return 'warning';
      case 'Parcial': return 'info';
      default: return 'gray';
    }
  };

  const getVendedoresUnicos = () => {
    const vendedores = new Set(comisiones.map(c => c.vendedor).filter(Boolean));
    return Array.from(vendedores).sort();
  };

  useEffect(() => {
    setPaginaActual(1);
  }, [filtros, tabActivo]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Cargando liquidación de vendedores...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Comisiones</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">
                  {formatCurrency(estadisticasUI.totalComisiones)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {estadisticasUI.polizasConComision} pólizas
                </p>
              </div>
              <Icon icon="solar:calculator-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Por Pagar</p>
                <p className="text-lg md:text-2xl font-bold text-orange-600">
                  {formatCurrency(estadisticasUI.comisionesPendientes)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Pendiente de liquidar
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-orange-500 rounded-full"></div>
              </div>
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Pagadas</p>
                <p className="text-lg md:text-2xl font-bold text-green-600">
                  {formatCurrency(estadisticasUI.comisionesPagadas)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Ya liquidadas
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Vendedores</p>
                <p className="text-lg md:text-2xl font-bold text-purple-600">
                  {estadisticasUI.totalVendedores}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tasa pago: {estadisticasUI.tasaPago.toFixed(1)}%
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xs md:text-sm">👥</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Header de Controles */}
      <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar por póliza, cliente o vendedor..."
                  value={filtros.busqueda || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltros({ ...filtros, busqueda: e.target.value })}
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => cargarComisiones()}
                disabled={loading}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Actualizar"
              >
                <Icon icon="solar:refresh-bold-duotone" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button
                color="light"
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Exportar"
              >
                <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
              </Button>

              <Button
                color="primary"
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]"
              >
                <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Liquidar Seleccionadas</span>
                <span className="sm:hidden">Liquidar</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs>
          <Tabs.Item 
            active={tabActivo === 'porPagar'}
            title={`Por Pagar (${comisionesPorPagar.length})`}
            icon={() => <Icon icon="solar:wallet-money-bold-duotone" />}
            onClick={() => setTabActivo('porPagar')}
          >
            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Póliza</Table.HeadCell>
                  <Table.HeadCell>Cliente</Table.HeadCell>
                  <Table.HeadCell>Vendedor</Table.HeadCell>
                  <Table.HeadCell>Aseguradora</Table.HeadCell>
                  <Table.HeadCell className="text-right">Prima</Table.HeadCell>
                  <Table.HeadCell className="text-right">% Com.</Table.HeadCell>
                  <Table.HeadCell className="text-right">Comisión</Table.HeadCell>
                  <Table.HeadCell className="text-right">Pagado</Table.HeadCell>
                  <Table.HeadCell className="text-right">Pendiente</Table.HeadCell>
                  <Table.HeadCell>Fecha Póliza</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {comisionesPorPagarPaginadas.map((comision) => (
                    <Table.Row key={comision.id}>
                      <Table.Cell className="font-medium">{comision.numeroPoliza}</Table.Cell>
                      <Table.Cell>{comision.cliente}</Table.Cell>
                      <Table.Cell>
                        <Badge color="info" size="sm">{comision.vendedor}</Badge>
                      </Table.Cell>
                      <Table.Cell>{comision.aseguradora}</Table.Cell>
                      <Table.Cell className="text-right">
                        {formatCurrency(comision.primaNeta)}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {comision.porcentajeComision}%
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold">
                        {formatCurrency(comision.comisionTotal)}
                      </Table.Cell>
                      <Table.Cell className="text-right text-green-600">
                        {formatCurrency(comision.comisionPagada)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-orange-600">
                        {formatCurrency(comision.comisionPendiente)}
                      </Table.Cell>
                      <Table.Cell>{formatDate(comision.fechaPoliza)}</Table.Cell>
                      <Table.Cell>
                        <div className="relative inline-block">
                          <Dropdown
                            label=""
                            dismissOnClick={false}
                            placement="left-start"
                            className="z-50"
                            renderTrigger={() => (
                              <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                <IconDots size={22} />
                              </span>
                            )}
                          >
                            <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                              <Icon icon="solar:eye-bold-duotone" height={18} />
                              <span>Ver Detalle</span>
                            </Dropdown.Item>
                            <Dropdown.Item className="flex gap-3 w-full justify-start text-left text-blue-600">
                              <Icon icon="solar:dollar-minimalistic-bold-duotone" height={18} />
                              <span>Pagar Comisión</span>
                            </Dropdown.Item>
                          </Dropdown>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

              {comisionesPorPagar.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay comisiones pendientes de pagar</p>
                </div>
              )}
            </div>

            {/* Paginación */}
            {totalPaginasPorPagar > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {((paginaActual - 1) * elementosPorPagina) + 1} a {Math.min(paginaActual * elementosPorPagina, comisionesPorPagar.length)} de {comisionesPorPagar.length}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span>Por página:</span>
                    <select
                      className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray"
                      value={elementosPorPagina}
                      onChange={(e) => {
                        setElementosPorPagina(Number(e.target.value));
                        setPaginaActual(1);
                      }}
                    >
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === 1}
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {paginaActual} de {totalPaginasPorPagar}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === totalPaginasPorPagar}
                    onClick={() => setPaginaActual(p => Math.min(totalPaginasPorPagar, p + 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          <Tabs.Item 
            title={`Pagadas (${comisionesPagadas.length})`}
            icon={() => <Icon icon="solar:check-circle-bold-duotone" />}
            onClick={() => setTabActivo('pagados')}
          >
            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Póliza</Table.HeadCell>
                  <Table.HeadCell>Cliente</Table.HeadCell>
                  <Table.HeadCell>Vendedor</Table.HeadCell>
                  <Table.HeadCell>Aseguradora</Table.HeadCell>
                  <Table.HeadCell className="text-right">Prima</Table.HeadCell>
                  <Table.HeadCell className="text-right">Comisión</Table.HeadCell>
                  <Table.HeadCell className="text-right">Pagado</Table.HeadCell>
                  <Table.HeadCell>Fecha Pago</Table.HeadCell>
                  <Table.HeadCell>Fecha Póliza</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {comisionesPagadasPaginadas.map((comision) => (
                    <Table.Row key={comision.id}>
                      <Table.Cell className="font-medium">{comision.numeroPoliza}</Table.Cell>
                      <Table.Cell>{comision.cliente}</Table.Cell>
                      <Table.Cell>
                        <Badge color="success" size="sm">{comision.vendedor}</Badge>
                      </Table.Cell>
                      <Table.Cell>{comision.aseguradora}</Table.Cell>
                      <Table.Cell className="text-right">
                        {formatCurrency(comision.primaNeta)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold">
                        {formatCurrency(comision.comisionTotal)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-green-600">
                        {formatCurrency(comision.comisionPagada)}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="success" size="sm">
                          {formatDate(comision.fechaPago || '')}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{formatDate(comision.fechaPoliza)}</Table.Cell>
                      <Table.Cell>
                        <div className="relative inline-block">
                          <Dropdown
                            label=""
                            dismissOnClick={false}
                            placement="left-start"
                            className="z-50"
                            renderTrigger={() => (
                              <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                <IconDots size={22} />
                              </span>
                            )}
                          >
                            <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                              <Icon icon="solar:eye-bold-duotone" height={18} />
                              <span>Ver Detalle</span>
                            </Dropdown.Item>
                            <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                              <Icon icon="solar:document-text-bold-duotone" height={18} />
                              <span>Ver Comprobante</span>
                            </Dropdown.Item>
                          </Dropdown>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

              {comisionesPagadas.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:wallet-money-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay comisiones pagadas aún</p>
                </div>
              )}
            </div>

            {/* Paginación */}
            {totalPaginasPagadas > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {((paginaActual - 1) * elementosPorPagina) + 1} a {Math.min(paginaActual * elementosPorPagina, comisionesPagadas.length)} de {comisionesPagadas.length}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === 1}
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {paginaActual} de {totalPaginasPagadas}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === totalPaginasPagadas}
                    onClick={() => setPaginaActual(p => Math.min(totalPaginasPagadas, p + 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          <Tabs.Item
            title={`Por Vendedor (${comisionesPorVendedor.length})`}
            icon={() => <Icon icon="solar:user-bold-duotone" />}
          >
            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Vendedor</Table.HeadCell>
                  <Table.HeadCell className="text-center">Pólizas</Table.HeadCell>
                  <Table.HeadCell className="text-right">Comisión Total</Table.HeadCell>
                  <Table.HeadCell className="text-right">Pagado</Table.HeadCell>
                  <Table.HeadCell className="text-right">Pendiente</Table.HeadCell>
                  <Table.HeadCell className="text-center">% Pagado</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {comisionesPorVendedor.map((vendedor: any) => (
                    <Table.Row key={vendedor.vendedorId}>
                      <Table.Cell className="font-medium">{vendedor.vendedor}</Table.Cell>
                      <Table.Cell className="text-center font-semibold text-blue-600">
                        {vendedor.polizas}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold">
                        {formatCurrency(vendedor.comisionTotal)}
                      </Table.Cell>
                      <Table.Cell className="text-right text-green-600">
                        {formatCurrency(vendedor.comisionPagada)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-orange-600">
                        {formatCurrency(vendedor.comisionPendiente)}
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Progress 
                            progress={vendedor.comisionTotal > 0 ? (vendedor.comisionPagada / vendedor.comisionTotal) * 100 : 0}
                            size="sm"
                            color="green"
                          />
                          <span className="text-xs text-gray-500">
                            {vendedor.comisionTotal > 0 ? ((vendedor.comisionPagada / vendedor.comisionTotal) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="relative inline-block">
                          <Dropdown
                            label=""
                            dismissOnClick={false}
                            placement="left-start"
                            className="z-50"
                            renderTrigger={() => (
                              <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                <IconDots size={22} />
                              </span>
                            )}
                          >
                            <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                              <Icon icon="solar:eye-bold-duotone" height={18} />
                              <span>Ver Detalle</span>
                            </Dropdown.Item>
                            <Dropdown.Item className="flex gap-3 w-full justify-start text-left text-blue-600">
                              <Icon icon="solar:dollar-minimalistic-bold-duotone" height={18} />
                              <span>Liquidar Vendedor</span>
                            </Dropdown.Item>
                          </Dropdown>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Tabs.Item>
        </Tabs>
      </Card>
    </div>
  );
};

export default LiquidarVendedores;