import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Card,
  Button,
  Spinner,
  Badge,
  Table,
  Tabs,
  Dropdown,
  Modal,
  Label,
  Textarea,
  TextInput,
  Checkbox,
  Select,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import { IconDots } from '@tabler/icons-react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { useToast } from 'src/hooks/use-toast';
import { useVendedores, useAseguradoras, useRamos } from 'src/hooks/useAdminCrudApi';
import { useTerminologia } from 'src/context/TerminologiaContext';
import liquidacionesVendedoresService, {
  type ComisionDisponible,
  type VistaPreviaLiquidacion,
  type Liquidacion,
  type PolizaComision,
} from '../../../services/liquidacionesVendedoresService';

const LiquidarVendedores = () => {
  // Datos de comisiones disponibles desde el backend
  const [comisionesDisponibles, setComisionesDisponibles] = useState<ComisionDisponible[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { vendedores: vendedoresData } = useVendedores();
  const { terminologia } = useTerminologia();
  // TODO: Usar para filtros avanzados de aseguradoras y ramos
  useAseguradoras();
  useRamos();

  const [paginaActual, setPaginaActual] = useState(1);
  const [elementosPorPagina, setElementosPorPagina] = useState(25);

  // Filtros avanzados
  const [filtros, setFiltros] = useState({
    busqueda: '',
    vendedor_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    aseguradoras: [] as string[],
    ramos: [] as string[],
  });

  // Mostrar/ocultar panel de filtros avanzados
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);

  const [tabActivo, setTabActivo] = useState<'porPagar' | 'pagadas' | 'porVendedor'>('porPagar');

  // Estados para selección de pólizas
  const [polizasSeleccionadas, setPolizasSeleccionadas] = useState<Set<number>>(new Set());

  // Estados para modal de liquidación
  const [showModalLiquidacion, setShowModalLiquidacion] = useState(false);
  const [pasoModal, setPasoModal] = useState(1);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<ComisionDisponible | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaLiquidacion | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [liquidacionCreada, setLiquidacionCreada] = useState<Liquidacion | null>(null);
  
  // Estados para selección y filtros dentro del modal
  const [polizasModalSeleccionadas, setPolizasModalSeleccionadas] = useState<Set<number>>(new Set());
  const [filtrosModal, setFiltrosModal] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    aseguradora: '',
    ramo: '',
    busqueda: '',
  });
  
  // Estados para histórico de liquidaciones
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [loadingLiquidaciones, setLoadingLiquidaciones] = useState(false);

  // Cargar comisiones disponibles desde el backend (solo las que no han sido liquidadas)
  const cargarComisionesDisponibles = useCallback(async () => {
    try {
      setLoading(true);

      const response = await liquidacionesVendedoresService.getComisionesDisponibles({
        vendedor_id: filtros.vendedor_id ? parseInt(filtros.vendedor_id) : undefined,
        fecha_inicio: filtros.fecha_inicio || undefined,
        fecha_fin: filtros.fecha_fin || undefined,
        aseguradoras: filtros.aseguradoras.length > 0 ? filtros.aseguradoras : undefined,
        ramos: filtros.ramos.length > 0 ? filtros.ramos : undefined,
      });

      if (response.success && response.data) {
        setComisionesDisponibles(response.data);
      } else {
        setComisionesDisponibles([]);
      }
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
  }, [filtros, toast]);

  useEffect(() => {
    cargarComisionesDisponibles();
  }, []);

  // Aplicar filtros de búsqueda local
  const comisionesFiltradas = useMemo(() => {
    if (!filtros.busqueda) return comisionesDisponibles;
    
    const busqueda = filtros.busqueda.toLowerCase();
    return comisionesDisponibles.filter(v => 
      v.vendedor.toLowerCase().includes(busqueda) ||
      v.polizas.some(p => 
        p.numero_poliza.toLowerCase().includes(busqueda) ||
        p.cliente.toLowerCase().includes(busqueda)
      )
    );
  }, [comisionesDisponibles, filtros.busqueda]);

  // Estadísticas calculadas
  const estadisticasUI = useMemo(() => {
    const totalPolizas = comisionesFiltradas.reduce((sum, v) => sum + v.total_polizas, 0);
    const totalComisionBruta = comisionesFiltradas.reduce((sum, v) => sum + v.comision_bruta_total, 0);
    const totalComisionNeta = comisionesFiltradas.reduce((sum, v) => sum + v.comision_neta_total, 0);

    return {
      totalComisiones: totalComisionBruta,
      comisionesPendientes: totalComisionNeta,
      totalVendedores: comisionesFiltradas.length,
      polizasConComision: totalPolizas,
    };
  }, [comisionesFiltradas]);

  // Todas las pólizas de todos los vendedores (para la vista por póliza)
  const todasLasPolizas = useMemo(() => {
    return comisionesFiltradas.flatMap(v => 
      v.polizas.map(p => ({
        ...p,
        vendedor: v.vendedor,
        vendedor_id: v.vendedor_id,
      }))
    );
  }, [comisionesFiltradas]);

  // Paginación de pólizas
  const polizasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return todasLasPolizas.slice(inicio, inicio + elementosPorPagina);
  }, [todasLasPolizas, paginaActual, elementosPorPagina]);

  const totalPaginasPolizas = Math.ceil(todasLasPolizas.length / elementosPorPagina);

  // Manejar selección de pólizas
  const togglePolizaSeleccionada = (polizaId: number) => {
    setPolizasSeleccionadas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(polizaId)) {
        nuevo.delete(polizaId);
      } else {
        nuevo.add(polizaId);
      }
      return nuevo;
    });
  };

  const seleccionarTodasPolizas = () => {
    if (polizasSeleccionadas.size === todasLasPolizas.length) {
      setPolizasSeleccionadas(new Set());
    } else {
      setPolizasSeleccionadas(new Set(todasLasPolizas.map(p => p.id)));
    }
  };

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

  // ===== FUNCIONES PARA LIQUIDACIÓN =====
  
  const abrirModalLiquidacion = (vendedor: ComisionDisponible) => {
    setVendedorSeleccionado(vendedor);
    setShowModalLiquidacion(true);
    setPasoModal(1);
    setVistaPrevia(null);
    setObservaciones('');
    // Seleccionar todas las pólizas del vendedor por defecto
    setPolizasModalSeleccionadas(new Set(vendedor.polizas.map(p => p.id)));
    setFiltrosModal({ fecha_inicio: '', fecha_fin: '', aseguradora: '', ramo: '', busqueda: '' });
  };

  // Filtrar pólizas del vendedor seleccionado en el modal
  const polizasModalFiltradas = useMemo(() => {
    if (!vendedorSeleccionado) return [];
    
    return vendedorSeleccionado.polizas.filter(poliza => {
      // Filtro por búsqueda
      if (filtrosModal.busqueda) {
        const busqueda = filtrosModal.busqueda.toLowerCase();
        const coincide = 
          poliza.numero_poliza.toLowerCase().includes(busqueda) ||
          poliza.cliente.toLowerCase().includes(busqueda);
        if (!coincide) return false;
      }
      
      // Filtro por fecha inicio (usa fecha_cobro si existe, sino fecha_poliza)
      const fechaPoliza = poliza.fecha_cobro || poliza.fecha_poliza;
      if (filtrosModal.fecha_inicio && fechaPoliza) {
        if (fechaPoliza < filtrosModal.fecha_inicio) return false;
      }
      
      // Filtro por fecha fin
      if (filtrosModal.fecha_fin && fechaPoliza) {
        if (fechaPoliza > filtrosModal.fecha_fin) return false;
      }
      
      // Filtro por aseguradora
      if (filtrosModal.aseguradora && poliza.aseguradora !== filtrosModal.aseguradora) {
        return false;
      }
      
      // Filtro por ramo
      if (filtrosModal.ramo && poliza.ramo !== filtrosModal.ramo) {
        return false;
      }
      
      return true;
    });
  }, [vendedorSeleccionado, filtrosModal]);

  // Obtener aseguradoras y ramos únicos del vendedor
  const aseguradorasUnicasModal = useMemo(() => {
    if (!vendedorSeleccionado) return [];
    return [...new Set(vendedorSeleccionado.polizas.map(p => p.aseguradora))].filter(Boolean);
  }, [vendedorSeleccionado]);

  const ramosUnicosModal = useMemo(() => {
    if (!vendedorSeleccionado) return [];
    return [...new Set(vendedorSeleccionado.polizas.map(p => p.ramo))].filter(Boolean);
  }, [vendedorSeleccionado]);

  // Toggle póliza en el modal
  const togglePolizaModal = (polizaId: number) => {
    setPolizasModalSeleccionadas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(polizaId)) {
        nuevo.delete(polizaId);
      } else {
        nuevo.add(polizaId);
      }
      return nuevo;
    });
  };

  // Seleccionar todas las pólizas filtradas del modal
  const seleccionarTodasPolizasModal = () => {
    const idsFiltradas = polizasModalFiltradas.map(p => p.id);
    const todasSeleccionadas = idsFiltradas.every(id => polizasModalSeleccionadas.has(id));
    
    if (todasSeleccionadas) {
      // Deseleccionar todas las filtradas
      setPolizasModalSeleccionadas(prev => {
        const nuevo = new Set(prev);
        idsFiltradas.forEach(id => nuevo.delete(id));
        return nuevo;
      });
    } else {
      // Seleccionar todas las filtradas
      setPolizasModalSeleccionadas(prev => {
        const nuevo = new Set(prev);
        idsFiltradas.forEach(id => nuevo.add(id));
        return nuevo;
      });
    }
  };

  // Calcular totales de pólizas seleccionadas en el modal
  const totalesModalSeleccionadas = useMemo(() => {
    if (!vendedorSeleccionado) return null;
    
    const seleccionadas = vendedorSeleccionado.polizas.filter(p => polizasModalSeleccionadas.has(p.id));
    
    return {
      cantidad: seleccionadas.length,
      prima_total: seleccionadas.reduce((sum, p) => sum + p.prima_neta, 0),
      comision_bruta: seleccionadas.reduce((sum, p) => sum + p.comision_bruta, 0),
      retencion: seleccionadas.reduce((sum, p) => sum + p.retencion, 0),
      retencion_ica: seleccionadas.reduce((sum, p) => sum + p.retencion_ica, 0),
      iva: seleccionadas.reduce((sum, p) => sum + p.iva, 0),
      reteiva: seleccionadas.reduce((sum, p) => sum + (p.reteiva || 0), 0),
      comision_neta: seleccionadas.reduce((sum, p) => sum + p.comision_neta, 0),
    };
  }, [vendedorSeleccionado, polizasModalSeleccionadas]);

  // Abrir modal para liquidar pólizas seleccionadas
  const abrirModalLiquidacionSeleccionadas = () => {
    if (polizasSeleccionadas.size === 0) {
      toast({
        title: 'Aviso',
        description: 'Seleccione al menos una póliza para liquidar',
        variant: 'destructive',
      });
      return;
    }
    
    // Agrupar pólizas seleccionadas por vendedor
    const polizasSeleccionadasArray = todasLasPolizas.filter(p => polizasSeleccionadas.has(p.id));
    const vendedoresUnicos = [...new Set(polizasSeleccionadasArray.map(p => p.vendedor_id))];
    
    if (vendedoresUnicos.length > 1) {
      toast({
        title: 'Aviso',
        description: 'Las pólizas seleccionadas pertenecen a diferentes vendedores. Seleccione pólizas de un solo vendedor.',
        variant: 'destructive',
      });
      return;
    }
    
    // Encontrar el vendedor correspondiente
    const vendedor = comisionesFiltradas.find(v => v.vendedor_id === vendedoresUnicos[0]);
    if (vendedor) {
      // Crear un vendedor con solo las pólizas seleccionadas
      const vendedorConSeleccion: ComisionDisponible = {
        ...vendedor,
        polizas: vendedor.polizas.filter(p => polizasSeleccionadas.has(p.id)),
        total_polizas: polizasSeleccionadasArray.length,
        prima_total: polizasSeleccionadasArray.reduce((sum, p) => sum + p.prima_neta, 0),
        comision_bruta_total: polizasSeleccionadasArray.reduce((sum, p) => sum + p.comision_bruta, 0),
        comision_neta_total: polizasSeleccionadasArray.reduce((sum, p) => sum + p.comision_neta, 0),
        retencion_total: polizasSeleccionadasArray.reduce((sum, p) => sum + p.retencion, 0),
        retencion_ica_total: polizasSeleccionadasArray.reduce((sum, p) => sum + p.retencion_ica, 0),
        iva_total: polizasSeleccionadasArray.reduce((sum, p) => sum + p.iva, 0),
      };
      abrirModalLiquidacion(vendedorConSeleccion);
    }
  };

  const cerrarModalLiquidacion = () => {
    setShowModalLiquidacion(false);
    setPasoModal(1);
    setVendedorSeleccionado(null);
    setVistaPrevia(null);
    setObservaciones('');
    setPolizasModalSeleccionadas(new Set());
    setFiltrosModal({ fecha_inicio: '', fecha_fin: '', aseguradora: '', ramo: '', busqueda: '' });
    setLiquidacionCreada(null);
  };

  // Función para descargar PDF
  const descargarPDF = async (liquidacionId: number) => {
    try {
      setLoadingModal(true);
      await liquidacionesVendedoresService.descargarPDF(liquidacionId);
      toast({
        title: 'Éxito',
        description: 'PDF descargado correctamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al descargar PDF',
        variant: 'destructive',
      });
    } finally {
      setLoadingModal(false);
    }
  };

  const generarVistaPrevia = async () => {
    if (!vendedorSeleccionado || !vendedorSeleccionado.vendedor_id) return;
    
    // Validar que haya pólizas seleccionadas
    if (polizasModalSeleccionadas.size === 0) {
      toast({
        title: 'Aviso',
        description: 'Seleccione al menos una póliza para liquidar',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setLoadingModal(true);
      
      // Usar solo las pólizas seleccionadas en el modal
      const polizasIds = Array.from(polizasModalSeleccionadas);
      const polizasSeleccionadasArr = vendedorSeleccionado.polizas.filter(p => polizasModalSeleccionadas.has(p.id));
      const fechas = polizasSeleccionadasArr.map(p => p.fecha_poliza).filter(f => f);
      const fechaInicio = fechas.length > 0 ? fechas.reduce((a, b) => a < b ? a : b) : new Date().toISOString().slice(0, 10);
      const fechaFin = fechas.length > 0 ? fechas.reduce((a, b) => a > b ? a : b) : new Date().toISOString().slice(0, 10);
      
      const response = await liquidacionesVendedoresService.getVistaPrevia({
        vendedor_id: vendedorSeleccionado.vendedor_id,
        polizas_ids: polizasIds,
        periodo_inicio: fechaInicio,
        periodo_fin: fechaFin,
        observaciones: observaciones,
      });
      
      if (response.success && response.data) {
        setVistaPrevia(response.data);
        setPasoModal(2);
      } else {
        toast({
          title: 'Error',
          description: response.message || 'No se pudo generar la vista previa',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Error al generar vista previa',
        variant: 'destructive',
      });
    } finally {
      setLoadingModal(false);
    }
  };

  const confirmarLiquidacion = async () => {
    if (!vistaPrevia || !vendedorSeleccionado) return;
    
    try {
      setLoadingModal(true);
      
      // Usar las pólizas seleccionadas del modal
      const polizasIds = Array.from(polizasModalSeleccionadas);
      
      const response = await liquidacionesVendedoresService.crear({
        vendedor_id: vistaPrevia.vendedor.id,
        polizas_ids: polizasIds,
        periodo_inicio: vistaPrevia.periodo.inicio,
        periodo_fin: vistaPrevia.periodo.fin,
        observaciones: observaciones,
      });
      
      if (response.success && response.data) {
        toast({
          title: 'Éxito',
          description: `Liquidación ${response.data.codigo} creada exitosamente`,
        });
        setLiquidacionCreada(response.data);
        setPasoModal(3); // Paso 3: Descarga de PDF
        setPolizasSeleccionadas(new Set());
        cargarComisionesDisponibles();
        cargarLiquidaciones();
      } else {
        toast({
          title: 'Error',
          description: response.message || 'No se pudo crear la liquidación',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Error al crear liquidación',
        variant: 'destructive',
      });
    } finally {
      setLoadingModal(false);
    }
  };

  const cargarLiquidaciones = useCallback(async () => {
    try {
      setLoadingLiquidaciones(true);
      const response = await liquidacionesVendedoresService.listar();
      console.log('Respuesta liquidaciones:', response);
      
      if (response.success && response.data) {
        setLiquidaciones(response.data);
      } else {
        console.error('Error en respuesta:', response.message);
      }
    } catch (error) {
      console.error('Error cargando liquidaciones:', error);
    } finally {
      setLoadingLiquidaciones(false);
    }
  }, []);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtros, tabActivo]);

  useEffect(() => {
    if (tabActivo === 'pagadas') {
      cargarLiquidaciones();
    }
  }, [tabActivo, cargarLiquidaciones]);

  // Cargar liquidaciones al montar el componente
  useEffect(() => {
    cargarLiquidaciones();
  }, [cargarLiquidaciones]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Cargando comisiones disponibles...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
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
              <p className="text-xs md:text-sm font-medium text-gray-600">Por Liquidar</p>
              <p className="text-lg md:text-2xl font-bold text-orange-600">
                {formatCurrency(estadisticasUI.comisionesPendientes)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Comisión neta
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
              <p className="text-xs md:text-sm font-medium text-gray-600">{terminologia.vendedorPlural}</p>
              <p className="text-lg md:text-2xl font-bold text-purple-600">
                {estadisticasUI.totalVendedores}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Con comisiones pendientes
              </p>
            </div>
            <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-bold text-xs md:text-sm">👥</span>
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Seleccionadas</p>
              <p className="text-lg md:text-2xl font-bold text-green-600">
                {polizasSeleccionadas.size}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Pólizas para liquidar
              </p>
            </div>
            <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Filtros Avanzados */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1">
              <div className="relative">
                <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar por póliza, cliente o vendedor..."
                  value={filtros.busqueda}
                  onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
                  className="pl-10 h-10"
                />
              </div>
            </div>

            <Button
              color="light"
              onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
              className="h-10"
            >
              <Icon icon="solar:filter-bold-duotone" className="w-4 h-4 mr-2" />
              Filtros
            </Button>

            <Button
              color="light"
              onClick={() => cargarComisionesDisponibles()}
              disabled={loading}
              className="h-10"
            >
              <Icon icon="solar:refresh-bold-duotone" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              color="primary"
              onClick={abrirModalLiquidacionSeleccionadas}
              disabled={polizasSeleccionadas.size === 0}
              className="h-10"
            >
              <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-4 h-4 mr-2" />
              Liquidar Seleccionadas ({polizasSeleccionadas.size})
            </Button>
          </div>

          {/* Panel de filtros avanzados */}
          {mostrarFiltrosAvanzados && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="vendedor_id">Vendedor</Label>
                <Select
                  id="vendedor_id"
                  value={filtros.vendedor_id}
                  onChange={(e) => setFiltros({ ...filtros, vendedor_id: e.target.value })}
                >
                  <option value="">Todos los vendedores</option>
                  {vendedoresData.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.nombres}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="fecha_inicio">Fecha Desde</Label>
                <TextInput
                  id="fecha_inicio"
                  type="date"
                  value={filtros.fecha_inicio}
                  onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fecha_fin">Fecha Hasta</Label>
                <TextInput
                  id="fecha_fin"
                  type="date"
                  value={filtros.fecha_fin}
                  onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  color="primary"
                  onClick={cargarComisionesDisponibles}
                  className="w-full"
                >
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs>
          <Tabs.Item
            active={tabActivo === 'porPagar'}
            title={`Por Pagar (${todasLasPolizas.length})`}
            icon={() => <Icon icon="solar:wallet-money-bold-duotone" />}
            onClick={() => setTabActivo('porPagar')}
          >
            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <Checkbox
                        checked={polizasSeleccionadas.size === todasLasPolizas.length && todasLasPolizas.length > 0}
                        onChange={seleccionarTodasPolizas}
                      />
                    </th>
                    <th>Póliza</th>
                    <th>Cliente</th>
                    <th>{terminologia.vendedor}</th>
                    <th>Aseguradora</th>
                    <th>Ramo</th>
                    <th className="text-right">Prima</th>
                    <th className="text-right">Com. Bruta</th>
                    <th className="text-right">Retención</th>
                    <th className="text-right">ICA</th>
                    <th className="text-right">IVA</th>
                    <th className="text-right">ReteIVA</th>
                    <th className="text-right">Com. Neta</th>
                    <th>Fecha Cobro</th>
                  </tr>
                </thead>
                <tbody>
                  {polizasPaginadas.map((poliza) => (
                    <tr key={poliza.id} className={polizasSeleccionadas.has(poliza.id) ? 'row-selected' : ''}>
                      <td>
                        <Checkbox
                          checked={polizasSeleccionadas.has(poliza.id)}
                          onChange={() => togglePolizaSeleccionada(poliza.id)}
                        />
                      </td>
                      <td className="font-medium">{poliza.numero_poliza}</td>
                      <td>{poliza.cliente}</td>
                      <td>
                        <Badge color="info" size="sm">{poliza.vendedor}</Badge>
                      </td>
                      <td>{poliza.aseguradora}</td>
                      <td>{poliza.ramo}</td>
                      <td className="text-right">{formatCurrency(poliza.prima_neta)}</td>
                      <td className="text-right">{formatCurrency(poliza.comision_bruta)}</td>
                      <td className="text-right text-red-500">{formatCurrency(poliza.retencion)}</td>
                      <td className="text-right text-red-500">{formatCurrency(poliza.retencion_ica)}</td>
                      <td className="text-right text-blue-500">{formatCurrency(poliza.iva)}</td>
                      <td className="text-right text-red-500">{formatCurrency(poliza.reteiva || 0)}</td>
                      <td className="text-right font-semibold text-green-600">
                        {formatCurrency(poliza.comision_neta)}
                      </td>
                      <td>
                        <span className="text-green-600">{formatDate(poliza.fecha_cobro || poliza.fecha_poliza)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {todasLasPolizas.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:wallet-money-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay comisiones disponibles para liquidar</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Las comisiones aparecen aquí cuando la aseguradora ya pagó al broker y la póliza tiene vendedor asignado
                  </p>
                </div>
              )}
            </div>

            {/* Paginación */}
            {totalPaginasPolizas > 1 && (
              <div className="flex items-center justify-between p-4">
                <div className="text-sm text-gray-600">
                  Mostrando {((paginaActual - 1) * elementosPorPagina) + 1} a {Math.min(paginaActual * elementosPorPagina, todasLasPolizas.length)} de {todasLasPolizas.length}
                </div>
                <div className="flex items-center gap-3">
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
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === 1}
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                  >
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {paginaActual} de {totalPaginasPolizas}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={paginaActual === totalPaginasPolizas}
                    onClick={() => setPaginaActual(p => Math.min(totalPaginasPolizas, p + 1))}
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Tabs.Item>

          <Tabs.Item
            active={tabActivo === 'porVendedor'}
            title={`Por ${terminologia.vendedor} (${comisionesFiltradas.length})`}
            icon={() => <Icon icon="solar:user-bold-duotone" />}
            onClick={() => setTabActivo('porVendedor')}
          >
            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>{terminologia.vendedor}</th>
                    <th className="text-center">Pólizas</th>
                    <th className="text-right">Prima Total</th>
                    <th className="text-right">Com. Bruta</th>
                    <th className="text-right">Retención</th>
                    <th className="text-right">Ret. ICA</th>
                    <th className="text-right">IVA</th>
                    <th className="text-right">ReteIVA</th>
                    <th className="text-right">Com. Neta</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {comisionesFiltradas.map((vendedor) => (
                    <tr key={vendedor.vendedor_id} className="group">
                      <td className="font-medium">
                        <div>
                          <span>{vendedor.vendedor}</span>
                          <div className="text-xs text-gray-500">
                            Ret: {vendedor.porcentajes?.retencion || 0}% | ICA: {vendedor.porcentajes?.retencion_ica || 0}% | IVA: {vendedor.porcentajes?.iva || 0}% | ReteIVA: {vendedor.porcentajes?.reteiva || 0}%
                          </div>
                        </div>
                      </td>
                      <td className="text-center font-semibold text-blue-600">
                        {vendedor.total_polizas}
                      </td>
                      <td className="text-right">{formatCurrency(vendedor.prima_total)}</td>
                      <td className="text-right font-semibold">
                        {formatCurrency(vendedor.comision_bruta_total)}
                      </td>
                      <td className="text-right text-red-600">
                        {formatCurrency(vendedor.retencion_total)}
                      </td>
                      <td className="text-right text-red-600">
                        {formatCurrency(vendedor.retencion_ica_total)}
                      </td>
                      <td className="text-right text-blue-600">
                        {formatCurrency(vendedor.iva_total)}
                      </td>
                      <td className="text-right text-red-600">
                        {formatCurrency(vendedor.reteiva_total || 0)}
                      </td>
                      <td className="text-right font-bold text-green-600">
                        {formatCurrency(vendedor.comision_neta_total)}
                      </td>
                      <td className="sticky-right">
                        <Button
                          size="sm"
                          color="primary"
                          onClick={() => abrirModalLiquidacion(vendedor)}
                        >
                          <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-4 h-4 mr-1" />
                          Liquidar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {comisionesFiltradas.length === 0 && (
                <div className="text-center py-12">
                  <Icon icon="solar:user-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay vendedores con comisiones pendientes</p>
                </div>
              )}
            </div>
          </Tabs.Item>

          <Tabs.Item
            active={tabActivo === 'pagadas'}
            title="Pagadas"
            icon={() => <Icon icon="solar:history-bold-duotone" />}
            onClick={() => setTabActivo('pagadas')}
          >
            {loadingLiquidaciones ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="guro-table-wrap">
                <table className="guro-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>{terminologia.vendedor}</th>
                      <th>Período</th>
                      <th className="text-right">Pólizas</th>
                      <th className="text-right">Com. Bruta</th>
                      <th className="text-right">Retención</th>
                      <th className="text-right">ICA</th>
                      <th className="text-right">IVA</th>
                      <th className="text-right">ReteIVA</th>
                      <th className="text-right">Com. Neta</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th className="sticky-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidaciones.map((liquidacion) => (
                      <tr key={liquidacion.id} className="group">
                        <td className="font-medium">{liquidacion.codigo}</td>
                        <td>{liquidacion.vendedor?.nombres || 'N/A'}</td>
                        <td>
                          {formatDate(liquidacion.periodo_inicio)} - {formatDate(liquidacion.periodo_fin)}
                        </td>
                        <td className="text-right">{liquidacion.cantidad_polizas}</td>
                        <td className="text-right">{formatCurrency(liquidacion.monto_bruto_total)}</td>
                        <td className="text-right text-red-500">{formatCurrency(liquidacion.monto_retencion_total)}</td>
                        <td className="text-right text-red-500">{formatCurrency(liquidacion.monto_retencion_ica_total)}</td>
                        <td className="text-right text-blue-500">{formatCurrency(liquidacion.monto_iva_total)}</td>
                        <td className="text-right text-red-500">{formatCurrency(liquidacion.monto_reteiva_total || 0)}</td>
                        <td className="text-right font-semibold text-green-600">
                          {formatCurrency(liquidacion.monto_neto_total)}
                        </td>
                        <td>
                          <Badge 
                            color={
                              liquidacion.estado === 'pagada' ? 'success' :
                              liquidacion.estado === 'aprobada' ? 'info' :
                              liquidacion.estado === 'revertida' ? 'failure' :
                              'warning'
                            }
                            size="sm"
                          >
                            {liquidacion.estado.toUpperCase()}
                          </Badge>
                        </td>
                        <td>{formatDate(liquidacion.fecha_generacion)}</td>
                        <td className="sticky-right">
                          <Button 
                            size="xs" 
                            color="primary" 
                            title="Descargar PDF"
                            onClick={() => descargarPDF(liquidacion.id)}
                          >
                            <Icon icon="solar:download-bold" className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {liquidaciones.length === 0 && (
                  <div className="text-center py-12">
                    <Icon icon="solar:folder-open-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No hay liquidaciones generadas aún</p>
                  </div>
                )}
              </div>
            )}
          </Tabs.Item>
        </Tabs>
      </Card>

      {/* Modal de Liquidación */}
      <Modal show={showModalLiquidacion} onClose={cerrarModalLiquidacion} size="6xl">
        <Modal.Header>
          {pasoModal === 1 && `Liquidar Comisiones - ${vendedorSeleccionado?.vendedor || ''}`}
          {pasoModal === 2 && 'Vista Previa de Liquidación'}
          {pasoModal === 3 && '✅ Liquidación Creada Exitosamente'}
        </Modal.Header>
        <Modal.Body className="max-h-[70vh] overflow-y-auto">
          {pasoModal === 1 && vendedorSeleccionado && (
            <div className="space-y-4">
              {/* Resumen del vendedor y totales seleccionados */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{vendedorSeleccionado.vendedor}</h3>
                    <p className="text-sm text-gray-600">
                      Ret: {vendedorSeleccionado.porcentajes?.retencion || 0}% | 
                      ICA: {vendedorSeleccionado.porcentajes?.retencion_ica || 0}% | 
                      IVA: {vendedorSeleccionado.porcentajes?.iva || 0}% | 
                      ReteIVA: {vendedorSeleccionado.porcentajes?.reteiva || 0}%
                    </p>
                  </div>
                  {totalesModalSeleccionadas && (
                    <div className="text-right">
                      <Badge color="info" size="lg">
                        {totalesModalSeleccionadas.cantidad} pólizas seleccionadas
                      </Badge>
                    </div>
                  )}
                </div>
                
                {totalesModalSeleccionadas && (
                  <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <span className="text-gray-500 block">Com. Bruta</span>
                      <span className="font-bold">{formatCurrency(totalesModalSeleccionadas.comision_bruta)}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <span className="text-gray-500 block">Retenciones</span>
                      <span className="font-bold text-red-600">
                        -{formatCurrency(totalesModalSeleccionadas.retencion + totalesModalSeleccionadas.retencion_ica + totalesModalSeleccionadas.reteiva)}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <span className="text-gray-500 block">IVA</span>
                      <span className="font-bold text-blue-600">+{formatCurrency(totalesModalSeleccionadas.iva)}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <span className="text-gray-500 block">Com. Neta</span>
                      <span className="font-bold text-green-600">{formatCurrency(totalesModalSeleccionadas.comision_neta)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Filtros */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Icon icon="solar:filter-bold-duotone" className="w-5 h-5" />
                    Filtrar Pólizas
                  </h4>
                  <Button size="xs" color="gray" onClick={() => setFiltrosModal({ fecha_inicio: '', fecha_fin: '', aseguradora: '', ramo: '', busqueda: '' })}>
                    Limpiar Filtros
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs">Buscar</Label>
                    <TextInput
                      sizing="sm"
                      placeholder="Póliza o cliente..."
                      value={filtrosModal.busqueda}
                      onChange={(e) => setFiltrosModal(prev => ({ ...prev, busqueda: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha Cobro Desde</Label>
                    <TextInput
                      sizing="sm"
                      type="date"
                      value={filtrosModal.fecha_inicio}
                      onChange={(e) => setFiltrosModal(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha Cobro Hasta</Label>
                    <TextInput
                      sizing="sm"
                      type="date"
                      value={filtrosModal.fecha_fin}
                      onChange={(e) => setFiltrosModal(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Aseguradora</Label>
                    <Select
                      sizing="sm"
                      value={filtrosModal.aseguradora}
                      onChange={(e) => setFiltrosModal(prev => ({ ...prev, aseguradora: e.target.value }))}
                    >
                      <option value="">Todas</option>
                      {aseguradorasUnicasModal.map(aseg => (
                        <option key={aseg} value={aseg}>{aseg}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Ramo</Label>
                    <Select
                      sizing="sm"
                      value={filtrosModal.ramo}
                      onChange={(e) => setFiltrosModal(prev => ({ ...prev, ramo: e.target.value }))}
                    >
                      <option value="">Todos</option>
                      {ramosUnicosModal.map(ramo => (
                        <option key={ramo} value={ramo}>{ramo}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Tabla de pólizas */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 flex justify-between items-center">
                  <span className="text-sm font-medium">
                    Mostrando {polizasModalFiltradas.length} de {vendedorSeleccionado.polizas.length} pólizas
                  </span>
                  <div className="flex gap-2">
                    <Button size="xs" color="gray" onClick={seleccionarTodasPolizasModal}>
                      {polizasModalFiltradas.every(p => polizasModalSeleccionadas.has(p.id)) ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
                    </Button>
                  </div>
                </div>
                <div className="guro-table-wrap max-h-64">
                  <table className="guro-table">
                    <thead>
                      <tr>
                        <th className="w-10">
                          <Checkbox
                            checked={polizasModalFiltradas.length > 0 && polizasModalFiltradas.every(p => polizasModalSeleccionadas.has(p.id))}
                            onChange={seleccionarTodasPolizasModal}
                          />
                        </th>
                        <th>Póliza</th>
                        <th>Cliente</th>
                        <th>Aseguradora</th>
                        <th>Ramo</th>
                        <th className="text-right">Com. Bruta</th>
                        <th className="text-right">Retención</th>
                        <th className="text-right">ICA</th>
                        <th className="text-right">IVA</th>
                        <th className="text-right">ReteIVA</th>
                        <th className="text-right">Com. Neta</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {polizasModalFiltradas.map((poliza) => (
                        <tr
                          key={poliza.id}
                          className={`cursor-pointer ${polizasModalSeleccionadas.has(poliza.id) ? 'row-selected' : ''}`}
                          onClick={() => togglePolizaModal(poliza.id)}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={polizasModalSeleccionadas.has(poliza.id)}
                              onChange={() => togglePolizaModal(poliza.id)}
                            />
                          </td>
                          <td className="font-medium">{poliza.numero_poliza}</td>
                          <td>{poliza.cliente}</td>
                          <td>{poliza.aseguradora}</td>
                          <td>{poliza.ramo}</td>
                          <td className="text-right">{formatCurrency(poliza.comision_bruta)}</td>
                          <td className="text-right text-red-500">{formatCurrency(poliza.retencion)}</td>
                          <td className="text-right text-red-500">{formatCurrency(poliza.retencion_ica)}</td>
                          <td className="text-right text-blue-500">{formatCurrency(poliza.iva)}</td>
                          <td className="text-right text-red-500">{formatCurrency(poliza.reteiva || 0)}</td>
                          <td className="text-right font-semibold text-green-600">{formatCurrency(poliza.comision_neta)}</td>
                          <td>{formatDate(poliza.fecha_cobro || poliza.fecha_poliza)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <Textarea
                  id="observaciones"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ingrese observaciones sobre esta liquidación..."
                  rows={2}
                />
              </div>

              {polizasModalSeleccionadas.size === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded text-sm text-yellow-700">
                  <Icon icon="solar:danger-triangle-bold" className="inline w-5 h-5 mr-2" />
                  Seleccione al menos una póliza para continuar con la liquidación.
                </div>
              )}
            </div>
          )}

          {pasoModal === 2 && vistaPrevia && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Resumen de Liquidación</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Vendedor:</span>
                    <span className="font-semibold ml-2">{vistaPrevia.vendedor.nombres}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Documento:</span>
                    <span className="font-semibold ml-2">{vistaPrevia.vendedor.numero_documento}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Período:</span>
                    <span className="font-semibold ml-2">{formatDate(vistaPrevia.periodo.inicio)} - {formatDate(vistaPrevia.periodo.fin)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Pólizas:</span>
                    <span className="font-semibold ml-2">{vistaPrevia.cantidad_polizas}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2">
                <h4 className="font-semibold mb-3">Detalle Financiero</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Prima Total:</span>
                    <span className="font-semibold">{formatCurrency(vistaPrevia.totales.prima_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Comisión Bruta:</span>
                    <span className="font-semibold">{formatCurrency(vistaPrevia.totales.comision_bruta_total)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>(-) Retención:</span>
                    <span>{formatCurrency(vistaPrevia.totales.retencion_total)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>(-) Retención ICA:</span>
                    <span>{formatCurrency(vistaPrevia.totales.retencion_ica_total)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>(+) IVA:</span>
                    <span>{formatCurrency(vistaPrevia.totales.iva_total)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-lg font-bold text-green-600">
                    <span>Comisión Neta a Pagar:</span>
                    <span>{formatCurrency(vistaPrevia.totales.comision_neta_total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 3: Liquidación creada - Descarga de PDF */}
          {pasoModal === 3 && liquidacionCreada && (
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg text-center">
                <Icon icon="solar:check-circle-bold" className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-700 mb-2">Liquidación Generada Exitosamente</h3>
                <p className="text-gray-600">Código: <span className="font-bold">{liquidacionCreada.codigo}</span></p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-3">Resumen de la Liquidación</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{terminologia.vendedor}:</span>
                    <span className="font-semibold ml-2">{liquidacionCreada.vendedor?.nombres}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Período:</span>
                    <span className="font-semibold ml-2">
                      {formatDate(liquidacionCreada.periodo_inicio)} - {formatDate(liquidacionCreada.periodo_fin)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Cantidad de Pólizas:</span>
                    <span className="font-semibold ml-2">{liquidacionCreada.cantidad_polizas}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Estado:</span>
                    <Badge color="warning" size="sm" className="ml-2">
                      {liquidacionCreada.estado.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div className="border-t mt-4 pt-4 grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <span className="text-gray-500 block">Comisión Bruta</span>
                    <span className="font-bold text-lg">{formatCurrency(liquidacionCreada.monto_bruto_total)}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-500 block">Retenciones</span>
                    <span className="font-bold text-lg text-red-600">
                      -{formatCurrency(liquidacionCreada.monto_retencion_total + liquidacionCreada.monto_retencion_ica_total)}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-500 block">Comisión Neta</span>
                    <span className="font-bold text-xl text-green-600">{formatCurrency(liquidacionCreada.monto_neto_total)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <Button 
                  size="lg" 
                  color="primary" 
                  onClick={() => descargarPDF(liquidacionCreada.id)}
                  disabled={loadingModal}
                >
                  {loadingModal ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:download-bold" className="w-5 h-5 mr-2" />
                      Descargar PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex gap-2 w-full justify-end">
            <Button color="gray" onClick={cerrarModalLiquidacion} disabled={loadingModal}>
              Cancelar
            </Button>
            {pasoModal === 1 && (
              <Button 
                onClick={generarVistaPrevia} 
                disabled={loadingModal || polizasModalSeleccionadas.size === 0}
                color="primary"
              >
                {loadingModal ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:eye-bold" className="w-4 h-4 mr-2" />
                    Ver Vista Previa ({polizasModalSeleccionadas.size} pólizas)
                  </>
                )}
              </Button>
            )}
            {pasoModal === 2 && (
              <Button onClick={confirmarLiquidacion} disabled={loadingModal} color="success">
                {loadingModal ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
                    Confirmar y Generar
                  </>
                )}
              </Button>
            )}
            {pasoModal === 3 && (
              <Button color="success" onClick={cerrarModalLiquidacion}>
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
                Cerrar
              </Button>
            )}
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LiquidarVendedores;
