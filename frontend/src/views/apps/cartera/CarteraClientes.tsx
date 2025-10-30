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
    // Nuevos campos para tipos de recaudo
    recaudo_oficina?: {
      recaudado: number;
      pendiente: number;
      total: number;
      pago_id?: string;
    };
    recaudo_aseguradora?: {
      pagado: number;
      pendiente: number;
      total: number;
      pago_id?: string;
    };
    cobro_comision?: {
      cobrada: number;
      pendiente: number;
      total: number;
    };
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

  const [tabActivo, setTabActivo] = useState<'general' | 'porCobrar' | 'porPagar' | 'recaudosCompletados'>('general');
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [polizaSeleccionada, setPolizaSeleccionada] = useState<PolizaCartera | null>(null);

  // Estados para modales de pagos
  const [showPagoOficinaModal, setShowPagoOficinaModal] = useState(false);
  const [showPagoAseguradoraModal, setShowPagoAseguradoraModal] = useState(false);
  const [showCobroComisionModal, setShowCobroComisionModal] = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [observacionesPago, setObservacionesPago] = useState('');
  const [procesandoPago, setProcesandoPago] = useState(false);

  const cargarDatosCartera = async () => {
    try {
      // OPTIMIZACIÓN: Usar endpoint específico para cartera - mucho más eficiente
      const carteraRes = await polizaService.getCarteraPolizas();

      if (carteraRes.success && carteraRes.data) {
        return Array.isArray(carteraRes.data) ? carteraRes.data : [];
      }

      return [];
    } catch (error) {
      console.error('Error cargando cartera:', error);
      return [];
    }
  };

  const cargarCartera = async () => {
    try {
      setLoading(true);
      const polizasData = await cargarDatosCartera();
      setTotalPolizas(polizasData.length);

      // OPTIMIZACIÓN: Procesamiento simplificado ya que los datos vienen optimizados del backend
      const carteraPolizas: PolizaCartera[] = polizasData.map((poliza: any) => {
        // Calcular valores financieros basados en datos del backend
        const primaNeta = poliza.prima_neta;
        const iva = poliza.iva;
        const total = poliza.total;
        const comision = poliza.comision;

        // Calcular estado de pago basado en datos del backend
        let estadoPago: 'Al día' | 'Pendiente' | 'Vencido' | 'Parcial' = poliza.estado_pago || 'Al día';
        let valorRecaudado = total;
        let valorPendienteCliente = 0;
        let valorPagadoAseguradora = primaNeta;
        let valorPendienteAseguradora = 0;
        let diasMora = 0;

        // Ajustar valores según estado de pago
        switch (estadoPago) {
          case 'Pendiente':
            valorRecaudado = 0;
            valorPendienteCliente = total;
            valorPagadoAseguradora = 0;
            valorPendienteAseguradora = primaNeta;
            break;
          case 'Parcial':
            valorRecaudado = total * 0.5;
            valorPendienteCliente = total * 0.5;
            valorPagadoAseguradora = primaNeta * 0.5;
            valorPendienteAseguradora = primaNeta * 0.5;
            break;
          case 'Vencido':
            valorRecaudado = 0;
            valorPendienteCliente = total;
            valorPagadoAseguradora = 0;
            valorPendienteAseguradora = primaNeta;
            diasMora = Math.max(0, -poliza.dias_vencimiento);
            break;
        }

        return {
          id: String(poliza.id),
          numeroPoliza: poliza.numero_poliza || poliza.policy_number || '',
          cliente: poliza.cliente,
          clienteId: String(poliza.cliente_id),
          documento: poliza.documento,
          aseguradora: poliza.aseguradora,
          ramo: poliza.ramo,
          estado: poliza.estado,
          fechaInicio: poliza.fecha_inicio,
          fechaVencimiento: poliza.fecha_vencimiento,
          diasVencimiento: poliza.dias_vencimiento,
          primaNeta,
          iva,
          total,
          comision,
          formaPago: poliza.forma_pago,
          valorPendienteCliente,
          valorPendienteAseguradora,
          valorRecaudado,
          valorPagadoAseguradora,
          comisionReal: comision,
          comisionPendiente: estadoPago !== 'Al día' ? comision * 0.5 : 0,
          comisionCobrada: estadoPago === 'Al día' ? comision : 0,
          estadoPago,
          diasMora,
          // Nuevos campos de tipos de recaudo
          recaudo_oficina: poliza.recaudo_oficina,
          recaudo_aseguradora: poliza.recaudo_aseguradora,
          cobro_comision: poliza.cobro_comision,
        };
      });

      // OPTIMIZACIÓN: Ya no necesitamos filtrar en frontend porque el backend filtra por estado ACTIVA
      setPolizas(carteraPolizas);
      calcularEstadisticas(carteraPolizas);

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

  // Funciones para manejar pagos
  const abrirModalPagoOficina = (poliza: PolizaCartera) => {
    setPolizaSeleccionada(poliza);
    setMontoPago((poliza.recaudo_oficina?.pendiente || 0).toString());
    setMetodoPago('');
    setReferenciaPago('');
    setFechaPago(new Date().toISOString().split('T')[0]);
    setObservacionesPago('');
    setShowPagoOficinaModal(true);
  };

  const abrirModalPagoAseguradora = (poliza: PolizaCartera) => {
    setPolizaSeleccionada(poliza);
    setMontoPago((poliza.recaudo_aseguradora?.pendiente || 0).toString());
    setMetodoPago('');
    setReferenciaPago('');
    setFechaPago(new Date().toISOString().split('T')[0]);
    setObservacionesPago('');
    setShowPagoAseguradoraModal(true);
  };

  const abrirModalCobroComision = (poliza: PolizaCartera) => {
    setPolizaSeleccionada(poliza);
    setMontoPago((poliza.cobro_comision?.pendiente || 0).toString());
    setReferenciaPago('');
    setFechaPago(new Date().toISOString().split('T')[0]);
    setObservacionesPago('');
    setShowCobroComisionModal(true);
  };

  const registrarPagoOficina = async () => {
    if (!polizaSeleccionada || !montoPago) return;

    try {
      setProcesandoPago(true);
      const response = await polizaService.registrarPagoPoliza(
        polizaSeleccionada.id,
        'oficina',
        parseFloat(montoPago),
        metodoPago,
        referenciaPago,
        observacionesPago,
        fechaPago
      );

      if (response.success) {
        toast({
          title: 'Recaudo registrado',
          description: 'El recaudo por oficina ha sido registrado exitosamente',
        });
        setShowPagoOficinaModal(false);
        // Recargar datos
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error registrando recaudo oficina:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  const registrarPagoAseguradora = async () => {
    if (!polizaSeleccionada || !montoPago) return;

    try {
      setProcesandoPago(true);
      const response = await polizaService.registrarPagoPoliza(
        polizaSeleccionada.id,
        'aseguradora',
        parseFloat(montoPago),
        metodoPago,
        referenciaPago,
        observacionesPago,
        fechaPago
      );

      if (response.success) {
        toast({
          title: 'Pago registrado',
          description: 'El pago a la aseguradora ha sido registrado exitosamente',
        });
        setShowPagoAseguradoraModal(false);
        // Recargar datos
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error registrando pago aseguradora:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  const registrarCobroComision = async () => {
    if (!polizaSeleccionada || !montoPago) return;

    try {
      setProcesandoPago(true);
      const response = await polizaService.registrarCobroComision(
        polizaSeleccionada.id,
        parseFloat(montoPago),
        referenciaPago,
        observacionesPago,
        fechaPago
      );

      if (response.success) {
        toast({
          title: 'Cobro registrado',
          description: 'El cobro de comisión ha sido registrado exitosamente',
        });
        setShowCobroComisionModal(false);
        // Recargar datos
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error registrando cobro comisión:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  const revertirPago = async (poliza: PolizaCartera, pagoId: string) => {
    if (!confirm('¿Está seguro de revertir este pago? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await polizaService.revertirPago(poliza.id, pagoId);

      if (response.success) {
        toast({
          title: 'Pago revertido',
          description: 'El pago ha sido revertido exitosamente',
        });
        // Recargar datos
        await cargarCartera();
      }
    } catch (error) {
      console.error('Error revirtiendo pago:', error);
      toast({
        title: 'Error',
        description: 'No se pudo revertir el pago',
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
      resultado = resultado.filter((p) => {
        const num = (p.numeroPoliza || '').toLowerCase();
        const cli = (p.cliente || '').toLowerCase();
        const doc = (p.documento || '').toLowerCase();
        const aseg = (p.aseguradora || '').toLowerCase();
        const ramo = (p.ramo || '').toLowerCase();
        const estado = (p.estado || '').toLowerCase();
        const estadoPago = (p.estadoPago || '').toLowerCase();
        const clienteId = (p.clienteId || '').toLowerCase();

        return (
          num.includes(busqueda) ||
          cli.includes(busqueda) ||
          doc.includes(busqueda) ||
          aseg.includes(busqueda) ||
          ramo.includes(busqueda) ||
          estado.includes(busqueda) ||
          estadoPago.includes(busqueda) ||
          clienteId.includes(busqueda)
        );
      });
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
    polizasFiltradas.filter(p => {
      const recaudadoOficina = (p.recaudo_oficina?.recaudado || 0);
      const pendienteOficina = (p.recaudo_oficina?.pendiente || 0);
      const pagadoAseguradora = (p.recaudo_aseguradora?.pagado || 0);
      const pendienteAseguradora = (p.recaudo_aseguradora?.pendiente || 0);
      
      // NO mostrar si:
      // - Ya tiene recaudo por oficina (está en "Por Pagar" o "Recaudos Completados")
      // - Ya tiene pago a aseguradora completado (está en "Recaudos Completados")
      if (recaudadoOficina > 0 || pagadoAseguradora > 0) {
        return false;
      }
      
      // Solo mostrar si tiene algo pendiente
      return pendienteOficina > 0 || pendienteAseguradora > 0;
    }),
    [polizasFiltradas]
  );

  const polizasPorCobrarPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    const fin = inicio + elementosPorPagina;
    return polizasPorCobrar.slice(inicio, fin);
  }, [polizasPorCobrar, paginaActual, elementosPorPagina]);

  const totalPaginasPorCobrar = Math.ceil(polizasPorCobrar.length / elementosPorPagina);

  const clientesConsolidados = useMemo(() => {
    return Object.entries(
      polizasFiltradas.reduce((acc, p) => {
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
  }, [polizasFiltradas]);

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

      {/* Header de Controles - Fuera de las tabs para que funcione globalmente */}
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
            title={`Cartera General (${clientesConsolidados.length})`}
            icon={() => <Icon icon="solar:users-group-rounded-bold-duotone" />}
            onClick={() => setTabActivo('general')}
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

          <Tabs.Item
            active={tabActivo === 'porCobrar'}
            title={`Por Cobrar (${polizasPorCobrar.length})`}
            icon={() => <Icon icon="solar:wallet-money-bold-duotone" />}
            onClick={() => setTabActivo('porCobrar')}
          >
            {/* Estadísticas de Cobros por Tipo */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <p className="text-sm text-gray-500">Recaudo Oficina</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(polizasFiltradas.reduce((sum, p) => sum + (p.recaudo_oficina?.pendiente || 0), 0))}
                  </p>
                  <p className="text-xs text-green-600">
                    Recaudado: {formatCurrency(polizasFiltradas.reduce((sum, p) => sum + (p.recaudo_oficina?.recaudado || 0), 0))}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Pago Pendiente</p>
                  <p className="text-lg font-bold text-purple-600">
                    {formatCurrency(polizasFiltradas.reduce((sum, p) => sum + (p.recaudo_aseguradora?.pendiente || 0), 0))}
                  </p>
                  <p className="text-xs text-green-600">
                    Pagado: {formatCurrency(polizasFiltradas.reduce((sum, p) => sum + (p.recaudo_aseguradora?.pagado || 0), 0))}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Cobro Comisión</p>
                  <p className="text-lg font-bold text-indigo-600">
                    {formatCurrency(polizasFiltradas.reduce((sum, p) => sum + (p.cobro_comision?.pendiente || 0), 0))}
                  </p>
                  <p className="text-xs text-green-600">
                    Cobrado: {formatCurrency(polizasFiltradas.reduce((sum, p) => sum + (p.cobro_comision?.cobrada || 0), 0))}
                  </p>
                </div>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Póliza</Table.HeadCell>
                  <Table.HeadCell>Cliente</Table.HeadCell>
                  <Table.HeadCell>Aseguradora</Table.HeadCell>
                  <Table.HeadCell className="text-center">Pago Pendiente</Table.HeadCell>
                  <Table.HeadCell className="text-center">Cobro Comisión</Table.HeadCell>
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
                      <Table.Cell className="text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-purple-600">
                            Pend: {formatCurrency(poliza.recaudo_aseguradora?.pendiente || 0)}
                          </div>
                          <div className="text-xs text-green-600">
                            Pag: {formatCurrency(poliza.recaudo_aseguradora?.pagado || 0)}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-indigo-600">
                            Pend: {formatCurrency(poliza.cobro_comision?.pendiente || 0)}
                          </div>
                          <div className="text-xs text-green-600">
                            Cob: {formatCurrency(poliza.cobro_comision?.cobrada || 0)}
                          </div>
                        </div>
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
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left text-blue-600"
                              onClick={() => abrirModalPagoOficina(poliza)}
                            >
                              <Icon icon="solar:dollar-minimalistic-bold-duotone" height={18} />
                              <span>Registrar Pago Oficina</span>
                            </Dropdown.Item>
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left text-purple-600"
                              onClick={() => abrirModalPagoAseguradora(poliza)}
                            >
                              <Icon icon="solar:card-transfer-bold-duotone" height={18} />
                              <span>Registrar Pago Aseguradora</span>
                            </Dropdown.Item>
                            <Dropdown.Item
                              className="flex gap-3 w-full justify-start text-left text-indigo-600"
                              onClick={() => abrirModalCobroComision(poliza)}
                            >
                              <Icon icon="solar:money-bag-bold-duotone" height={18} />
                              <span>Registrar Cobro Comisión</span>
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
            active={tabActivo === 'porPagar'}
            title={`Por Pagar (${polizasFiltradas.filter(p =>
              (p.recaudo_oficina?.recaudado || 0) > 0 &&
              (p.recaudo_aseguradora?.pendiente || 0) > 0 &&
              (p.recaudo_aseguradora?.pagado || 0) === 0
            ).length})`}
            icon={() => <Icon icon="solar:card-transfer-bold-duotone" />}
            onClick={() => setTabActivo('porPagar')}
          >
            {/* Estadísticas de Por Pagar */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Por Pagar</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(polizasFiltradas.filter(p =>
                      (p.recaudo_oficina?.recaudado || 0) > 0 &&
                      (p.recaudo_aseguradora?.pagado || 0) === 0
                    ).reduce((sum, p) => sum + (p.recaudo_aseguradora?.pendiente || 0), 0))}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Pólizas Pendientes</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {polizasFiltradas.filter(p =>
                      (p.recaudo_oficina?.recaudado || 0) > 0 &&
                      (p.recaudo_aseguradora?.pendiente || 0) > 0 &&
                      (p.recaudo_aseguradora?.pagado || 0) === 0
                    ).length}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Recaudado en Oficina</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(polizasFiltradas.filter(p =>
                      (p.recaudo_oficina?.recaudado || 0) > 0 &&
                      (p.recaudo_aseguradora?.pagado || 0) === 0
                    ).reduce((sum, p) => sum + (p.recaudo_oficina?.recaudado || 0), 0))}
                  </p>
                </div>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Póliza</Table.HeadCell>
                  <Table.HeadCell>Cliente</Table.HeadCell>
                  <Table.HeadCell>Aseguradora</Table.HeadCell>
                  <Table.HeadCell className="text-right">Prima Neta</Table.HeadCell>
                  <Table.HeadCell className="text-right">Recaudado Oficina</Table.HeadCell>
                  <Table.HeadCell className="text-right">Por Pagar</Table.HeadCell>
                  <Table.HeadCell>Vencimiento</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {polizasFiltradas.filter(p =>
                    (p.recaudo_oficina?.recaudado || 0) > 0 &&
                    (p.recaudo_aseguradora?.pendiente || 0) > 0 &&
                    (p.recaudo_aseguradora?.pagado || 0) === 0
                  ).map((poliza) => (
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
                        {formatCurrency(poliza.primaNeta)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-blue-600">
                        {formatCurrency(poliza.recaudo_oficina?.recaudado || 0)}
                      </Table.Cell>
                      <Table.Cell className="text-right font-semibold text-purple-600">
                        {formatCurrency(poliza.recaudo_aseguradora?.pendiente || 0)}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm">{formatDate(poliza.fechaVencimiento)}</div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            color="purple"
                            onClick={() => abrirModalPagoAseguradora(poliza)}
                          >
                            <Icon icon="solar:card-transfer-bold-duotone" className="w-4 h-4 mr-2" />
                            Pagar
                          </Button>
                          {poliza.recaudo_oficina?.pago_id && (
                            <Button
                              size="sm"
                              color="gray"
                              onClick={() => revertirPago(poliza, poliza.recaudo_oficina!.pago_id!)}
                              title="Revertir recaudo"
                            >
                              <Icon icon="solar:undo-left-bold-duotone" className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

              {polizasFiltradas.filter(p =>
                (p.recaudo_oficina?.recaudado || 0) > 0 &&
                (p.recaudo_aseguradora?.pendiente || 0) > 0 &&
                (p.recaudo_aseguradora?.pagado || 0) === 0
              ).length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay pagos pendientes a compañías</p>
                  <p className="text-xs text-gray-400 mt-2">Los pagos pendientes aparecen cuando se registra un recaudo por oficina</p>
                </div>
              )}
            </div>
          </Tabs.Item>

          <Tabs.Item
            active={tabActivo === 'recaudosCompletados'}
            title={`Recaudos Completados (${polizasFiltradas.filter(p => (p.recaudo_aseguradora?.pagado || 0) > 0).length})`}
            icon={() => <Icon icon="solar:check-circle-bold-duotone" />}
            onClick={() => setTabActivo('recaudosCompletados')}
          >
            {/* Estadísticas de Recaudos Completados */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Recaudado</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(polizasFiltradas.filter(p => (p.recaudo_aseguradora?.pagado || 0) > 0).reduce((sum, p) => sum + (p.recaudo_aseguradora?.pagado || 0), 0))}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Pólizas Completadas</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {polizasFiltradas.filter(p => (p.recaudo_aseguradora?.pagado || 0) > 0).length}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Comisiones Generadas</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(polizasFiltradas.filter(p => (p.recaudo_aseguradora?.pagado || 0) > 0).reduce((sum, p) => sum + p.comision, 0))}
                  </p>
                </div>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Póliza</Table.HeadCell>
                  <Table.HeadCell>Cliente</Table.HeadCell>
                  <Table.HeadCell>Aseguradora</Table.HeadCell>
                  <Table.HeadCell>Tipo Recaudo</Table.HeadCell>
                  <Table.HeadCell className="text-right">Prima Neta</Table.HeadCell>
                  <Table.HeadCell className="text-right">Recaudado</Table.HeadCell>
                  <Table.HeadCell className="text-right">Comisión</Table.HeadCell>
                  <Table.HeadCell>Fecha</Table.HeadCell>
                  <Table.HeadCell>Estado</Table.HeadCell>
                  <Table.HeadCell>Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {polizasFiltradas.filter(p => (p.recaudo_aseguradora?.pagado || 0) > 0).map((poliza) => {
                    // Determinar tipo de recaudo
                    const tipoRecaudo = (poliza.recaudo_oficina?.recaudado || 0) > 0 ? 'Oficina' : 'Aseguradora';
                    const colorTipo = tipoRecaudo === 'Oficina' ? 'blue' : 'purple';
                    
                    return (
                      <Table.Row key={poliza.id}>
                        <Table.Cell className="font-medium">{poliza.numeroPoliza}</Table.Cell>
                        <Table.Cell>
                          <div>
                            <div className="font-medium">{poliza.cliente}</div>
                            <div className="text-xs text-gray-500">{poliza.documento}</div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>{poliza.aseguradora}</Table.Cell>
                        <Table.Cell>
                          <Badge color={colorTipo} size="sm">
                            {tipoRecaudo}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell className="text-right font-semibold">
                          {formatCurrency(poliza.primaNeta)}
                        </Table.Cell>
                        <Table.Cell className="text-right font-semibold text-green-600">
                          {formatCurrency(poliza.recaudo_aseguradora?.pagado || 0)}
                        </Table.Cell>
                        <Table.Cell className="text-right font-semibold text-indigo-600">
                          {formatCurrency(poliza.comision)}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-sm">{formatDate(poliza.fechaVencimiento)}</div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <Badge color="success" size="sm">
                              Completado
                            </Badge>
                            {poliza.recaudo_aseguradora?.pago_id && (
                              <Button
                                size="xs"
                                color="gray"
                                onClick={() => revertirPago(poliza, poliza.recaudo_aseguradora!.pago_id!)}
                                title="Revertir pago"
                              >
                                <Icon icon="solar:undo-left-bold-duotone" className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-2">
                            <Link to={`/apps/cartera/recibo-caja/${poliza.id}`}>
                              <Button
                                size="sm"
                                color="blue"
                                title="Ver Recibo de Caja"
                              >
                                <Icon icon="solar:document-text-bold-duotone" className="w-4 h-4 mr-2" />
                                Recibo de Caja
                              </Button>
                            </Link>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>

              {polizasFiltradas.filter(p => (p.recaudo_aseguradora?.pagado || 0) > 0).length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay recaudos completados</p>
                  <p className="text-xs text-gray-400 mt-2">Aquí aparecen las pólizas con pagos completados (por oficina o aseguradora)</p>
                </div>
              )}
            </div>
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
                <div className="space-y-3 text-sm">
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

                  {/* Detalle por tipos de recaudo */}
                  <div className="border-t pt-3 mt-3">
                    <h5 className="font-medium text-gray-800 mb-2">Detalle por Tipo de Recaudo</h5>

                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span className="text-blue-800 font-medium">Recaudo Oficina:</span>
                        <div className="text-right">
                          <div className="text-sm text-blue-600">Recaudado: {formatCurrency(polizaSeleccionada.recaudo_oficina?.recaudado || 0)}</div>
                          <div className="text-sm text-orange-600">Pendiente: {formatCurrency(polizaSeleccionada.recaudo_oficina?.pendiente || 0)}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                        <span className="text-purple-800 font-medium">Pago Pendiente:</span>
                        <div className="text-right">
                          <div className="text-sm text-purple-600">Pagado: {formatCurrency(polizaSeleccionada.recaudo_aseguradora?.pagado || 0)}</div>
                          <div className="text-sm text-orange-600">Pendiente: {formatCurrency(polizaSeleccionada.recaudo_aseguradora?.pendiente || 0)}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-2 bg-indigo-50 rounded">
                        <span className="text-indigo-800 font-medium">Cobro Comisión:</span>
                        <div className="text-right">
                          <div className="text-sm text-indigo-600">Cobrado: {formatCurrency(polizaSeleccionada.cobro_comision?.cobrada || 0)}</div>
                          <div className="text-sm text-orange-600">Pendiente: {formatCurrency(polizaSeleccionada.cobro_comision?.pendiente || 0)}</div>
                        </div>
                      </div>
                    </div>
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

      {/* Modal Pago Oficina */}
      <Modal show={showPagoOficinaModal} onClose={() => setShowPagoOficinaModal(false)} size="md">
        <Modal.Header>
          Registrar Pago por Oficina - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Pagar
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto del pago"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccionar método</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Pago
              </label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referencia de Pago
              </label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Número de recibo, comprobante, etc."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => setShowPagoOficinaModal(false)}
            disabled={procesandoPago}
          >
            Cancelar
          </Button>
          <Button
            color="blue"
            onClick={registrarPagoOficina}
            disabled={procesandoPago || !montoPago}
          >
            {procesandoPago ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Pago
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Pago Aseguradora */}
      <Modal show={showPagoAseguradoraModal} onClose={() => setShowPagoAseguradoraModal(false)} size="md">
        <Modal.Header>
          Registrar Pago por Aseguradora - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Pagado por Aseguradora
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto pagado por la aseguradora"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccionar método</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
                <option value="debito_automatico">Débito Automático</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Pago
              </label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referencia de Pago
              </label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Número de póliza aseguradora, recibo, etc."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => setShowPagoAseguradoraModal(false)}
            disabled={procesandoPago}
          >
            Cancelar
          </Button>
          <Button
            color="purple"
            onClick={registrarPagoAseguradora}
            disabled={procesandoPago || !montoPago}
          >
            {procesandoPago ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Pago
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Cobro Comisión */}
      <Modal show={showCobroComisionModal} onClose={() => setShowCobroComisionModal(false)} size="md">
        <Modal.Header>
          Registrar Cobro de Comisión - {polizaSeleccionada?.numeroPoliza}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Cobrar
              </label>
              <Input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Monto de la comisión a cobrar"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Cobro
              </label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referencia de Cobro
              </label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Número de recibo, comprobante, etc."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observacionesPago}
                onChange={(e) => setObservacionesPago(e.target.value)}
                placeholder="Observaciones adicionales del cobro"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => setShowCobroComisionModal(false)}
            disabled={procesandoPago}
          >
            Cancelar
          </Button>
          <Button
            color="green"
            onClick={registrarCobroComision}
            disabled={procesandoPago || !montoPago}
          >
            {procesandoPago ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Cobro
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CarteraClientes;
