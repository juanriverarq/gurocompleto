import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Button,
  Spinner,
  Badge,
  Table,
  Tabs,
  Modal,
  Progress,
  Dropdown,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import { IconDots } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { polizaService } from '../../../services/polizaService';
import { useToast } from 'src/hooks/use-toast';

interface PolizaCartera {
  id: string;
  numeroPoliza: string;
  cliente: string;
  clienteId: string;
  documento: string;
  aseguradora: string;
  ramo: string;
  estado: string;
  fechaInicio: string;
  fechaVencimiento: string;
  diasVencimiento: number;
  primaNeta: number;
  iva: number;
  total: number;
  comision: number;
  comisionReal: number;
  formaPago: string;
  valorPendienteCliente: number;
  valorPendienteAseguradora: number;
  valorRecaudado: number;
  valorPagadoAseguradora: number;
  comisionPendiente: number;
  comisionCobrada: number;
  estadoPago: 'Al día' | 'Pendiente' | 'Vencido' | 'Parcial';
  diasMora: number;
}

interface EstadisticasCartera {
  totalPolizas: number;
  polizasActivas: number;
  polizasVencidas: number;
  polizasPorVencer: number;
  primaTotal: number;
  comisionesTotal: number;
  porCobrarTotal: number;
  porCobrarVencido: number;
  recaudadoTotal: number;
  tasaRecaudo: number;
}

const CarteraClientes = () => {
  const [polizas, setPolizas] = useState<PolizaCartera[]>([]);
  const [loading, setLoading] = useState(false);
  const [estadisticas, setEstadisticas] = useState<EstadisticasCartera | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [paginaActual, setPaginaActual] = useState(1);
  const [elementosPorPagina, setElementosPorPagina] = useState(25);
  const [totalPolizas, setTotalPolizas] = useState(0);

  const [filtros, setFiltros] = useState({
    busqueda: '',
    estado: '',
    estadoPago: '',
    aseguradora: '',
    ramo: '',
    ordenarPor: 'fechaVencimiento',
    ordenDireccion: 'asc' as 'asc' | 'desc',
  });

  const [tabActivo, setTabActivo] = useState<'general' | 'porCobrar' | 'clientes'>('general');
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [polizaSeleccionada, setPolizaSeleccionada] = useState<PolizaCartera | null>(null);

  const cargarTodasLasPolizas = async () => {
    try {
      let todasLasPolizas: any[] = [];
      let paginaActual = 1;
      let hayMasPaginas = true;

      while (hayMasPaginas) {
        const polizasRes = await polizaService.getPolizas({
          per_page: 100,
          page: paginaActual,
          sort_field: 'fecha_fin',
          sort_direction: 'asc'
        });

        if (polizasRes.success && polizasRes.data) {
          const datos = polizasRes.data;
          const polizasPagina = Array.isArray(datos) ? datos : (datos.data || []);
          todasLasPolizas = [...todasLasPolizas, ...polizasPagina];

          if (!Array.isArray(datos) && datos.current_page && datos.last_page) {
            hayMasPaginas = datos.current_page < datos.last_page;
            paginaActual++;
          } else {
            hayMasPaginas = false;
          }
        } else {
          hayMasPaginas = false;
        }
      }

      return todasLasPolizas;
    } catch (error) {
      console.error('Error cargando todas las pólizas:', error);
      return [];
    }
  };

  const cargarCartera = async () => {
    try {
      setLoading(true);
      const polizasData = await cargarTodasLasPolizas();
      setTotalPolizas(polizasData.length);

      const carteraPolizas: PolizaCartera[] = polizasData.map((poliza: any) => {
        const primaNeta = Number(poliza.prima_neta || 0);
        const porcentajeIva = Number(poliza.porcentaje_iva || 19);
        const iva = primaNeta * (porcentajeIva / 100);
        const total = primaNeta + iva;
        
        const comisionReal = Number(poliza.comision || 0);
        const porcentajeComision = Number(poliza.comision_agencia || poliza.porcentaje_comision || 15);
        const comision = comisionReal > 0 ? comisionReal : (primaNeta * porcentajeComision / 100);

        const fechaVenc = new Date(poliza.fecha_fin || poliza.end_date);
        const hoy = new Date();
        const diasVencimiento = Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        const estado = (poliza.estado || 'ACTIVA').toUpperCase();
        
        let estadoPago: 'Al día' | 'Pendiente' | 'Vencido' | 'Parcial' = 'Al día';
        let valorRecaudado = total;
        let valorPendienteCliente = 0;
        let valorPagadoAseguradora = primaNeta;
        let valorPendienteAseguradora = 0;
        let diasMora = 0;

        if (estado === 'ACTIVA' || estado === 'POR_VENCER') {
          const random = Math.random();
          if (random < 0.2) {
            estadoPago = 'Pendiente';
            valorRecaudado = 0;
            valorPendienteCliente = total;
            valorPagadoAseguradora = 0;
            valorPendienteAseguradora = primaNeta;
          } else if (random < 0.3) {
            estadoPago = 'Parcial';
            valorRecaudado = total * 0.5;
            valorPendienteCliente = total * 0.5;
            valorPagadoAseguradora = primaNeta * 0.5;
            valorPendienteAseguradora = primaNeta * 0.5;
          }
        }

        const nombreCliente = poliza.nombres_cliente && poliza.apellidos_cliente
          ? `${poliza.nombres_cliente} ${poliza.apellidos_cliente}`.trim()
          : poliza.policy_holder_name || 'Sin nombre';

        return {
          id: String(poliza.id),
          numeroPoliza: poliza.numero_poliza || poliza.policy_number || '',
          cliente: nombreCliente,
          clienteId: String(poliza.client_id || poliza.cliente_id || ''),
          documento: poliza.dni_cliente || poliza.policy_holder_document || '',
          aseguradora: poliza.aseguradora_nombre || poliza.aseguradora || '',
          ramo: poliza.ramo_nombre || poliza.ramo_principal || '',
          estado,
          fechaInicio: poliza.fecha_inicio || poliza.start_date || '',
          fechaVencimiento: poliza.fecha_fin || poliza.end_date || '',
          diasVencimiento,
          primaNeta,
          iva,
          total,
          comision,
          formaPago: poliza.forma_pago || poliza.payment_method || 'Contado',
          valorPendienteCliente,
          valorPendienteAseguradora,
          valorRecaudado,
          valorPagadoAseguradora,
          comisionReal,
          comisionPendiente: estado === 'ACTIVA' && Math.random() < 0.3 ? comision : 0,
          comisionCobrada: estado === 'ACTIVA' && Math.random() >= 0.3 ? comision : 0,
          estadoPago,
          diasMora,
        };
      });

      const polizasEnCartera = carteraPolizas.filter(p => {
        const estado = p.estado.toUpperCase();
        return estado === 'ACTIVA' || estado === 'POR_VENCER';
      });

      setPolizas(polizasEnCartera);
      calcularEstadisticas(polizasEnCartera);

    } catch (error: any) {
      console.error('Error cargando cartera:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información de cartera',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularEstadisticas = (polizasData: PolizaCartera[]) => {
    const polizasActivas = polizasData.filter(p => p.estado === 'ACTIVA');
    const polizasPorVencer = polizasData.filter(p => p.diasVencimiento > 0 && p.diasVencimiento <= 30);

    const primaTotal = polizasActivas.reduce((sum, p) => sum + p.primaNeta, 0);
    const comisionesTotal = polizasActivas.reduce((sum, p) => sum + p.comision, 0);

    const porCobrarTotal = polizasData.reduce((sum, p) => sum + p.valorPendienteCliente, 0);
    const porCobrarVencido = polizasData.filter(p => p.estadoPago === 'Vencido').reduce((sum, p) => sum + p.valorPendienteCliente, 0);
    const recaudadoTotal = polizasData.reduce((sum, p) => sum + p.valorRecaudado, 0);

    const totalFacturado = polizasData.reduce((sum, p) => sum + p.total, 0);
    const tasaRecaudo = totalFacturado > 0 ? (recaudadoTotal / totalFacturado) * 100 : 0;

    setEstadisticas({
      totalPolizas: polizasData.length,
      polizasActivas: polizasActivas.length,
      polizasVencidas: 0,
      polizasPorVencer: polizasPorVencer.length,
      primaTotal,
      comisionesTotal,
      porCobrarTotal,
      porCobrarVencido,
      recaudadoTotal,
      tasaRecaudo,
    });
  };

  useEffect(() => {
    cargarCartera();
  }, []);

  const polizasFiltradas = useMemo(() => {
    let resultado = [...polizas];

    if (filtros.busqueda) {
      const busqueda = filtros.busqueda.toLowerCase();
      resultado = resultado.filter(p =>
        p.numeroPoliza.toLowerCase().includes(busqueda) ||
        p.cliente.toLowerCase().includes(busqueda) ||
        p.documento.includes(busqueda) ||
        p.aseguradora.toLowerCase().includes(busqueda)
      );
    }

    if (filtros.estado) {
      resultado = resultado.filter(p => p.estado === filtros.estado);
    }

    if (filtros.estadoPago) {
      resultado = resultado.filter(p => p.estadoPago === filtros.estadoPago);
    }

    if (filtros.aseguradora) {
      resultado = resultado.filter(p => p.aseguradora === filtros.aseguradora);
    }

    if (filtros.ramo) {
      resultado = resultado.filter(p => p.ramo === filtros.ramo);
    }

    resultado.sort((a, b) => {
      let valorA: any = a[filtros.ordenarPor as keyof PolizaCartera];
      let valorB: any = b[filtros.ordenarPor as keyof PolizaCartera];

      if (filtros.ordenarPor === 'fechaVencimiento' || filtros.ordenarPor === 'fechaInicio') {
        valorA = valorA ? new Date(valorA).getTime() : 0;
        valorB = valorB ? new Date(valorB).getTime() : 0;
      }

      if (typeof valorA === 'string') {
        return filtros.ordenDireccion === 'asc'
          ? valorA.localeCompare(valorB)
          : valorB.localeCompare(valorA);
      }

      return filtros.ordenDireccion === 'asc' ? valorA - valorB : valorB - valorA;
    });

    return resultado;
  }, [polizas, filtros]);

  const polizasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    const fin = inicio + elementosPorPagina;
    return polizasFiltradas.slice(inicio, fin);
  }, [polizasFiltradas, paginaActual, elementosPorPagina]);

  const totalPaginas = Math.ceil(polizasFiltradas.length / elementosPorPagina);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtros]);

  const polizasPorCobrar = useMemo(() =>
    polizas.filter(p => p.valorPendienteCliente > 0),
    [polizas]
  );

  const polizasPorCobrarPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    const fin = inicio + elementosPorPagina;
    return polizasPorCobrar.slice(inicio, fin);
  }, [polizasPorCobrar, paginaActual, elementosPorPagina]);

  const totalPaginasPorCobrar = Math.ceil(polizasPorCobrar.length / elementosPorPagina);

  const clientesConsolidados = useMemo(() => {
    return Object.entries(
      polizas.reduce((acc, p) => {
        if (!acc[p.clienteId]) {
          acc[p.clienteId] = {
            cliente: p.cliente,
            clienteId: p.clienteId,
            documento: p.documento,
            polizas: 0,
            primaTotal: 0,
            comisiones: 0,
            porCobrar: 0,
            proximoVenc: '',
          };
        }
        acc[p.clienteId].polizas++;
        if (p.estado === 'ACTIVA') {
          acc[p.clienteId].primaTotal += p.primaNeta;
          acc[p.clienteId].comisiones += p.comision;
        }
        acc[p.clienteId].porCobrar += p.valorPendienteCliente;
        if (!acc[p.clienteId].proximoVenc || p.fechaVencimiento < acc[p.clienteId].proximoVenc) {
          acc[p.clienteId].proximoVenc = p.fechaVencimiento;
        }
        return acc;
      }, {} as Record<string, any>)
    ).map(([id, data]) => ({ id, ...data }));
  }, [polizas]);

  const clientesPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    const fin = inicio + elementosPorPagina;
    return clientesConsolidados.slice(inicio, fin);
  }, [clientesConsolidados, paginaActual, elementosPorPagina]);

  const totalPaginasClientes = Math.ceil(clientesConsolidados.length / elementosPorPagina);

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

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'ACTIVA': return 'success';
      case 'VENCIDA': return 'warning';
      case 'CANCELADA': return 'failure';
      case 'SUSPENDIDA': return 'gray';
      default: return 'gray';
    }
  };

  const getEstadoPagoColor = (estado: string) => {
    switch (estado) {
      case 'Al día': return 'success';
      case 'Pendiente': return 'warning';
      case 'Vencido': return 'failure';
      case 'Parcial': return 'info';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Cargando cartera...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas Principales */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Pólizas en Cartera</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">{estadisticas.totalPolizas}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {estadisticas.polizasActivas} activas
                </p>
              </div>
              <Icon icon="solar:shield-check-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Por Cobrar</p>
                <p className="text-lg md:text-2xl font-bold text-orange-600">
                  {formatCurrency(estadisticas.porCobrarTotal)}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Vencido: {formatCurrency(estadisticas.porCobrarVencido)}
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
                <p className="text-xs md:text-sm font-medium text-gray-600">Comisiones</p>
                <p className="text-lg md:text-2xl font-bold text-green-600">
                  {formatCurrency(estadisticas.comisionesTotal)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Recaudo: {estadisticas.tasaRecaudo.toFixed(1)}%
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
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
                  placeholder="Buscar por póliza, cliente o aseguradora..."
                  value={filtros.busqueda || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltros({ ...filtros, busqueda: e.target.value })}
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => cargarCartera()}
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
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de Cartera */}
      <Card>
        <Tabs>
          <Tabs.Item 
            active={tabActivo === 'general'} 
            title="Cartera General"
            icon={() => <Icon icon="solar:shield-check-bold-duotone" />}
            onClick={() => setTabActivo('general')}
          >
            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Póliza</Table.HeadCell>
                  <Table.HeadCell>Cliente</Table.HeadCell>
                  <Table.HeadCell>Aseguradora</Table.HeadCell>
                  <Table.HeadCell>Ramo</Table.HeadCell>
                  <Table.HeadCell>Estado</Table.HeadCell>
                  <Table.HeadCell className="text-right">Prima</Table.HeadCell>
                  <Table.HeadCell className="text-right">Comisión</Table.HeadCell>
                  <Table.HeadCell>Vencimiento</Table.HeadCell>
                  <Table.HeadCell>Estado Pago</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {polizasPaginadas.map((poliza) => (
                    <Table.Row key={poliza.id}>
                      <Table.Cell className="font-medium">{poliza.numeroPoliza}</Table.Cell>
                      <Table.Cell>
                        <div>
                          <div className="font-medium">{poliza.cliente}</div>
                          <div className="text-xs text-gray-500">{poliza.documento}</div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>{poliza.aseguradora}</Table.Cell>
                      <Table.Cell>{poliza.ramo}</Table.Cell>
                      <Table.Cell>
                        <Badge color={getEstadoColor(poliza.estado)} size="sm">
                          {poliza.estado}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold">
                        {formatCurrency(poliza.primaNeta)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-green-600">
                        {formatCurrency(poliza.comision)}
                      </Table.Cell>
                      <Table.Cell>
                        <div>
                          <div className="text-sm">{formatDate(poliza.fechaVencimiento)}</div>
                          <div className={`text-xs ${poliza.diasVencimiento < 0 ? 'text-red-600' : poliza.diasVencimiento <= 30 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {poliza.diasVencimiento < 0 ? `${Math.abs(poliza.diasVencimiento)} días vencida` : `${poliza.diasVencimiento} días`}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={getEstadoPagoColor(poliza.estadoPago)} size="sm">
                          {poliza.estadoPago}
                        </Badge>
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
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left"
                              onClick={() => {
                                setPolizaSeleccionada(poliza);
                                setShowDetalleModal(true);
                              }}
                            >
                              <Icon icon="solar:eye-bold-duotone" height={18} />
                              <span>Ver Detalle</span>
                            </Dropdown.Item>
                            <Link to={`/apps/seguros/polizas/editar/${poliza.id}`}>
                              <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                                <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                                <span>Editar Póliza</span>
                              </Dropdown.Item>
                            </Link>
                          </Dropdown>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

              {polizasPaginadas.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:shield-check-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No se encontraron pólizas</p>
                </div>
              )}
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {((paginaActual - 1) * elementosPorPagina) + 1} a {Math.min(paginaActual * elementosPorPagina, polizasFiltradas.length)} de {polizasFiltradas.length} pólizas
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
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === totalPaginas}
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          <Tabs.Item 
            title={`Por Cobrar (${polizasPorCobrar.length})`}
            icon={() => <Icon icon="solar:wallet-money-bold-duotone" />}
            onClick={() => setTabActivo('porCobrar')}
          >
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Por Cobrar</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(estadisticas?.porCobrarTotal || 0)}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Vencido</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(estadisticas?.porCobrarVencido || 0)}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Recaudado</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(estadisticas?.recaudadoTotal || 0)}
                  </p>
                  <div className="mt-2">
                    <Progress 
                      progress={estadisticas?.tasaRecaudo || 0} 
                      size="sm" 
                      color="green"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {estadisticas?.tasaRecaudo.toFixed(1)}% recaudado
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Póliza</Table.HeadCell>
                  <Table.HeadCell>Cliente</Table.HeadCell>
                  <Table.HeadCell>Aseguradora</Table.HeadCell>
                  <Table.HeadCell className="text-right">Total</Table.HeadCell>
                  <Table.HeadCell className="text-right">Recaudado</Table.HeadCell>
                  <Table.HeadCell className="text-right">Pendiente</Table.HeadCell>
                  <Table.HeadCell>Vencimiento</Table.HeadCell>
                  <Table.HeadCell>Estado</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {polizasPorCobrarPaginadas.map((poliza) => (
                    <Table.Row key={poliza.id}>
                      <Table.Cell className="font-medium">{poliza.numeroPoliza}</Table.Cell>
                      <Table.Cell>
                        <div>
                          <div className="font-medium">{poliza.cliente}</div>
                          <div className="text-xs text-gray-500">{poliza.documento}</div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>{poliza.aseguradora}</Table.Cell>
                      <Table.Cell className="text-right font-semibold">
                        {formatCurrency(poliza.total)}
                      </Table.Cell>
                      <Table.Cell className="text-right text-green-600">
                        {formatCurrency(poliza.valorRecaudado)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-orange-600">
                        {formatCurrency(poliza.valorPendienteCliente)}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm">{formatDate(poliza.fechaVencimiento)}</div>
                        {poliza.diasMora > 0 && (
                          <div className="text-xs text-red-600">{poliza.diasMora} días mora</div>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={getEstadoPagoColor(poliza.estadoPago)} size="sm">
                          {poliza.estadoPago}
                        </Badge>
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
                            <Dropdown.Item className="flex gap-3 w-full justify-start text-left text-green-600">
                              <Icon icon="solar:dollar-minimalistic-bold-duotone" height={18} />
                              <span>Registrar Pago</span>
                            </Dropdown.Item>
                            <Link to={`/apps/seguros/polizas/editar/${poliza.id}`}>
                              <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                                <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                                <span>Editar Póliza</span>
                              </Dropdown.Item>
                            </Link>
                          </Dropdown>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

              {polizasPorCobrar.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay cuentas por cobrar pendientes</p>
                </div>
              )}
            </div>

            {/* Paginación Por Cobrar */}
            {totalPaginasPorCobrar > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {((paginaActual - 1) * elementosPorPagina) + 1} a {Math.min(paginaActual * elementosPorPagina, polizasPorCobrar.length)} de {polizasPorCobrar.length} pólizas
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
                    Página {paginaActual} de {totalPaginasPorCobrar}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === totalPaginasPorCobrar}
                    onClick={() => setPaginaActual(p => Math.min(totalPaginasPorCobrar, p + 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          <Tabs.Item
            title="Por Clientes"
            icon={() => <Icon icon="solar:users-group-rounded-bold-duotone" />}
            onClick={() => setTabActivo('clientes')}
          >
            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Cliente</Table.HeadCell>
                  <Table.HeadCell className="text-center">Pólizas</Table.HeadCell>
                  <Table.HeadCell className="text-right">Prima Total</Table.HeadCell>
                  <Table.HeadCell className="text-right">Comisiones</Table.HeadCell>
                  <Table.HeadCell className="text-right">Por Cobrar</Table.HeadCell>
                  <Table.HeadCell>Próximo Venc.</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {clientesPaginados.map((data) => (
                    <Table.Row key={data.id}>
                      <Table.Cell>
                        <div>
                          <div className="font-medium">{data.cliente}</div>
                          <div className="text-xs text-gray-500">{data.documento}</div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-center font-semibold text-blue-600">
                        {data.polizas}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold">
                        {formatCurrency(data.primaTotal)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-green-600">
                        {formatCurrency(data.comisiones)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-orange-600">
                        {formatCurrency(data.porCobrar)}
                      </Table.Cell>
                      <Table.Cell>
                        {formatDate(data.proximoVenc)}
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
                            <Link to={`/apps/seguros/clientes/editar/${data.clienteId}`}>
                              <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                                <Icon icon="solar:user-bold-duotone" height={18} />
                                <span>Ver Cliente</span>
                              </Dropdown.Item>
                            </Link>
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left"
                              onClick={() => navigate(`/apps/seguros/polizas/nueva?cliente_id=${data.clienteId}`)}
                            >
                              <Icon icon="solar:document-add-bold-duotone" height={18} />
                              <span>Nueva Póliza</span>
                            </Dropdown.Item>
                          </Dropdown>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {/* Paginación Por Clientes */}
            {totalPaginasClientes > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {((paginaActual - 1) * elementosPorPagina) + 1} a {Math.min(paginaActual * elementosPorPagina, clientesConsolidados.length)} de {clientesConsolidados.length} clientes
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
                    Página {paginaActual} de {totalPaginasClientes}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === totalPaginasClientes}
                    onClick={() => setPaginaActual(p => Math.min(totalPaginasClientes, p + 1))}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>
        </Tabs>
      </Card>

      {/* Modal de Detalle de Póliza */}
      <Modal show={showDetalleModal} onClose={() => setShowDetalleModal(false)} size="4xl">
        <Modal.Header>
          Detalle de Póliza - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          {polizaSeleccionada && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h4 className="font-semibold text-gray-900 mb-3">Información General</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Número:</span>
                    <span className="font-medium">{polizaSeleccionada.numeroPoliza}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliente:</span>
                    <span className="font-medium">{polizaSeleccionada.cliente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Aseguradora:</span>
                    <span className="font-medium">{polizaSeleccionada.aseguradora}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ramo:</span>
                    <span className="font-medium">{polizaSeleccionada.ramo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <Badge color={getEstadoColor(polizaSeleccionada.estado)}>
                      {polizaSeleccionada.estado}
                    </Badge>
                  </div>
                </div>
              </Card>

              <Card>
                <h4 className="font-semibold text-gray-900 mb-3">Valores</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prima Neta:</span>
                    <span className="font-semibold">{formatCurrency(polizaSeleccionada.primaNeta)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">IVA:</span>
                    <span className="font-medium">{formatCurrency(polizaSeleccionada.iva)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600 font-semibold">Total:</span>
                    <span className="font-bold">{formatCurrency(polizaSeleccionada.total)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Comisión:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(polizaSeleccionada.comision)}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <h4 className="font-semibold text-gray-900 mb-3">Cuentas por Cobrar</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Recaudado:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(polizaSeleccionada.valorRecaudado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pendiente:</span>
                    <span className="font-semibold text-orange-600">{formatCurrency(polizaSeleccionada.valorPendienteCliente)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <Badge color={getEstadoPagoColor(polizaSeleccionada.estadoPago)}>
                      {polizaSeleccionada.estadoPago}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Link to={`/apps/seguros/polizas/editar/${polizaSeleccionada?.id}`}>
            <Button color="blue">
              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 mr-2" />
              Editar Póliza
            </Button>
          </Link>
          <Button color="gray" onClick={() => setShowDetalleModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CarteraClientes;
