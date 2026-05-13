import React, { useState, useEffect, useMemo } from 'react';
import { Card, Badge, Spinner, Modal, Table, Button, TextInput, Label } from 'flowbite-react';
import TableActionMenu, { TableMenuItem } from 'src/components/TableActionMenu';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useToast } from 'src/hooks/use-toast';
import renovacionesService, { 
  RenovacionFilters, 
  Renovacion, 
} from 'src/services/renovacionesService';
import DetalleRenovacion from 'src/components/renovaciones/DetalleRenovacion';
import { polizaService } from 'src/services/polizaService';
import { useAseguradoras, useVendedores, useRamos } from 'src/hooks/useAdminCrudApi';

const Renovaciones: React.FC = () => {
  const [renovaciones, setRenovaciones] = useState<Renovacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedRenovacion, setSelectedRenovacion] = useState<Renovacion | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [renAseguradoraId, setRenAseguradoraId] = useState<string>('');
  const [renRamoId, setRenRamoId] = useState<string>('');
  const [renCaratulaFile, setRenCaratulaFile] = useState<File | null>(null);
  const [renPdfProcessing, setRenPdfProcessing] = useState(false);
  const [renPdfSuggestions, setRenPdfSuggestions] = useState<Record<string, string>>({});
  const [renPrimaNeta, setRenPrimaNeta] = useState<string>('');
  const [renPorcentajeIva, setRenPorcentajeIva] = useState<string>('19');
  const [renIva, setRenIva] = useState<string>('');
  const [renGastosAdicionales, setRenGastosAdicionales] = useState<string>('');
  const [renTotal, setRenTotal] = useState<string>('');
  const [renPorcentajeComision, setRenPorcentajeComision] = useState<string>('');
  const [renComision, setRenComision] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'todas' | 'pendientes' | 'renovadas' | 'vencidas'>('pendientes');

  // Estados para filtros y columnas
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const { toast } = useToast();
  useNavigate();
  const { aseguradoras: aseguradorasList, loading: loadingAseguradoras } = useAseguradoras();
  const { vendedores: vendedoresList, loading: loadingVendedores } = useVendedores();
  const { ramos: ramosList, loading: loadingRamos } = useRamos();

  // Filtros - inicializar con el estado del tab "pendientes" por defecto
  const [filters, setFilters] = useState<RenovacionFilters>({
    search: '',
    estado: 'PENDIENTE,EN_PROCESO,CRITICO', // Tab pendientes por defecto
    agente: '',
    aseguradora: '',
    ramo: '',
    placa: '',
    diasVencimiento: '',
    fecha_inicio: '',
    fecha_fin: '',
    per_page: 15,
    page: 1,
    sort_field: 'fechaVencimiento',
    sort_direction: 'asc'
  });

  const tiposSeguro = [
    { value: 'vida', label: 'Vida', icon: 'solar:heart-bold-duotone', color: 'red' },
    { value: 'automovil', label: 'Automóvil', icon: 'solar:car-bold-duotone', color: 'blue' },
    { value: 'hogar', label: 'Hogar', icon: 'solar:home-bold-duotone', color: 'green' },
    { value: 'salud', label: 'Salud', icon: 'solar:medical-kit-bold-duotone', color: 'pink' },
    { value: 'empresarial', label: 'Empresarial', icon: 'solar:buildings-bold-duotone', color: 'purple' },
  ];


  const estadosRenovacion = [
    { value: 'PENDIENTE', label: 'Pendiente', color: 'warning' },
    { value: 'EN_PROCESO', label: 'En Proceso', color: 'info' },
    { value: 'CRITICO', label: 'Crítico', color: 'failure' },
    { value: 'RENOVADO', label: 'Renovado', color: 'success' },
    { value: 'VENCIDO', label: 'Vencido', color: 'gray' }
  ];


  // Cargar renovaciones desde el backend (sin fallback a mock)
  const loadRenovaciones = async (currentFilters = filters) => {
    try {
      setLoading(true);
      
      const response = await renovacionesService.getRenovaciones(currentFilters);
      
      setRenovaciones(response.data || []);
      setPagination({
        current_page: response.current_page || 1,
        last_page: response.last_page || 1,
        per_page: response.per_page || 15,
        total: response.total || 0,
        from: response.from || 0,
        to: response.to || 0
      });
      
    } catch (error) {
      console.error('Error cargando renovaciones:', error);
      setRenovaciones([]);
      setPagination(null);
      toast({ title: 'Error', description: 'No se pudieron cargar las renovaciones. Intenta nuevamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas desde el backend
  const loadEstadisticas = async () => {
    try {
      const stats = await renovacionesService.getEstadisticas();
      setEstadisticas(stats);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  // Efecto inicial para cargar datos
  useEffect(() => {
    loadRenovaciones();
    loadEstadisticas();
  }, []);

  // Efecto para recargar cuando cambien los filtros (con debounce para search)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadRenovaciones();
    }, filters.search ? 500 : 0);

    return () => clearTimeout(timer);
  }, [filters]);

  // Efecto para recargar estadísticas periódicamente (cada 5 minutos)
  useEffect(() => {
    const statsTimer = setInterval(() => {
      loadEstadisticas();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(statsTimer);
  }, []);

  // Efecto para cambiar filtros cuando cambia el tab activo
  useEffect(() => {
    let nuevoEstado = '';
    let nuevoDiasV: string | undefined = undefined;
    switch (activeTab) {
      case 'pendientes':
        // Pendientes = próximas a vencer incluyendo críticas (sin limitación de días)
        nuevoEstado = 'PENDIENTE,EN_PROCESO,CRITICO';
        nuevoDiasV = '';
        break;
      case 'renovadas':
        // Renovadas no dependen de ventana de días
        nuevoEstado = 'RENOVADO';
        nuevoDiasV = 'all';
        break;
      case 'vencidas':
        // Vencidas no dependen de ventana de días
        nuevoEstado = 'VENCIDO';
        nuevoDiasV = 'all';
        break;
      case 'todas':
      default:
        // Todas: sin limitaciones de fecha - mostrar todas las renovaciones
        nuevoEstado = '';
        nuevoDiasV = '';
        break;
    }

    setFilters(prev => ({
      ...prev,
      estado: nuevoEstado,
      diasVencimiento: nuevoDiasV,
      page: 1,
    }));
  }, [activeTab]);

  // Auto-calculate financial fields in renewal modal
  useEffect(() => {
    const prima = parseFloat(renPrimaNeta) || 0;
    const pctIva = parseFloat(renPorcentajeIva) || 0;
    const gastos = parseFloat(renGastosAdicionales) || 0;
    const iva = Math.round((prima * pctIva) / 100);
    const total = prima + iva + gastos;
    const pctComision = parseFloat(renPorcentajeComision) || 0;
    const comision = Math.round((prima * pctComision) / 100);
    setRenIva(String(iva));
    setRenTotal(String(total));
    setRenComision(String(comision));
  }, [renPrimaNeta, renPorcentajeIva, renGastosAdicionales, renPorcentajeComision]);

  // Auto-fill commission % and IVA % from comisiones_aseguradoras when ramo+aseguradora change
  useEffect(() => {
    if (!renRamoId || !renAseguradoraId) return;
    const ramo = ramosList.find((r: any) => String(r.id) === String(renRamoId));
    const comision = ramo?.comisiones_aseguradoras?.find((c: any) => String(c.aseguradora_id) === String(renAseguradoraId));
    if (comision) {
      setRenPorcentajeComision(String(comision.porcentaje_comision || ''));
      if (comision.porcentaje_iva > 0) {
        setRenPorcentajeIva(String(comision.porcentaje_iva));
      }
    }
  }, [renRamoId, renAseguradoraId, ramosList]);

  // Calcular contadores para los tabs
  const getTabCounts = () => {
    if (!estadisticas) return { todas: 0, pendientes: 0, renovadas: 0, vencidas: 0 };
    return {
      todas: estadisticas.total_renovaciones || 0,
      pendientes: (estadisticas.renovaciones_pendientes || 0) + (estadisticas.renovaciones_criticas || 0),
      renovadas: estadisticas.renovaciones_completadas || 0,
      vencidas: estadisticas.renovaciones_vencidas || 0
    };
  };

  const tabCounts = getTabCounts();

  // Handlers
  const handleFilterChange = (key: keyof RenovacionFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value
    }));
  };

  const handleViewRenovacion = (renovacion: Renovacion) => {
    setSelectedRenovacion(renovacion);
    setShowModal(true);
  };

  const handleRegistrarContacto = (renovacion: Renovacion) => {
    setSelectedRenovacion(renovacion);
    setShowContactModal(true);
  };

  const handleRenovar = (renovacion: Renovacion) => {
    setSelectedRenovacion(renovacion);
    // Pre-fill financial fields from current poliza data
    const prima = (renovacion as any).valorPrima || 0;
    const pctIva = (renovacion as any).porcentajeIva ?? 19;
    const ivaVal = (renovacion as any).iva ?? Math.round((prima * pctIva) / 100);
    const gastos = (renovacion as any).gastosAdicionales ?? 0;
    const totalVal = (renovacion as any).total ?? (prima + ivaVal + gastos);
    setRenPrimaNeta(String(Math.round(prima)));
    setRenPorcentajeIva(String(pctIva));
    setRenIva(String(Math.round(ivaVal)));
    setRenGastosAdicionales(gastos ? String(Math.round(gastos)) : '');
    setRenTotal(String(Math.round(totalVal)));
    setRenPorcentajeComision(String((renovacion as any).comisionPorcentaje || ''));
    setRenComision(String(Math.round((prima * ((renovacion as any).comisionPorcentaje || 0)) / 100)));
    // Pre-fill aseguradora/ramo from poliza
    setRenAseguradoraId((renovacion as any).aseguradora_id ? String((renovacion as any).aseguradora_id) : '');
    setRenRamoId((renovacion as any).ramo_id ? String((renovacion as any).ramo_id) : '');
    setRenCaratulaFile(null);
    setRenPdfSuggestions({});
    setShowRenovarModal(true);
  };

  const handleRenCaratulaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRenCaratulaFile(file);
    setRenPdfSuggestions({});
    if (!file || file.type !== 'application/pdf') return;
    try {
      setRenPdfProcessing(true);
      const { processPdf } = await import('src/services/advancedPdfProcessor');
      const result = await processPdf(file);
      const s: Record<string, string> = {};
      if (result?.numeroPoliza) s.numeroPoliza = result.numeroPoliza;
      if (result?.fechaInicio) s.fechaInicio = result.fechaInicio;
      if (result?.fechaFin) s.fechaFin = result.fechaFin;
      if (result?.primaNeta) s.primaNeta = String(Math.round(parseFloat(result.primaNeta) || 0));
      if (result?.total) s.total = String(Math.round(parseFloat(result.total) || 0));
      setRenPdfSuggestions(s);
    } catch (_e) {
      // silencioso
    } finally {
      setRenPdfProcessing(false);
    }
  };

  const handleExportRenovaciones = async () => {
    try {
      // Mostrar indicador de carga
      toast({
        title: "Exportando...",
        description: "Generando archivo de renovaciones",
        variant: "default",
      });

      const blob = await renovacionesService.exportarRenovaciones(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `renovaciones_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Éxito",
        description: "Renovaciones exportadas exitosamente",
        variant: "default",
      });
    } catch (error) {
      console.error('Error exportando renovaciones:', error);
      toast({
        title: "Error",
        description: "Error al exportar renovaciones. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleRegistrarContactoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRenovacion) return;

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const contactoData = {
        tipo: formData.get('tipo_contacto') as string,
        resultado: formData.get('resultado_contacto') as string,
        observaciones: formData.get('observaciones_contacto') as string,
        proximoContacto: formData.get('proximo_contacto') as string || undefined,
      };

      // Validaciones del lado cliente
      if (!contactoData.tipo || !contactoData.resultado || !contactoData.observaciones.trim()) {
        toast({
          title: "Error de validación",
          description: "Todos los campos son obligatorios",
          variant: "destructive",
        });
        return;
      }

      // Validar fecha futura si se proporciona
      if (contactoData.proximoContacto) {
        const fechaProxima = new Date(contactoData.proximoContacto);
        const ahora = new Date();
        if (fechaProxima <= ahora) {
          toast({
            title: "Error de validación",
            description: "La fecha del próximo contacto debe ser futura",
            variant: "destructive",
          });
          return;
        }
      }

      await renovacionesService.registrarContacto(selectedRenovacion.id, contactoData);

      toast({
        title: "Éxito",
        description: "Contacto registrado exitosamente",
        variant: "default",
      });

      // Notificar al historial de la póliza para refrescarse
      try {
        if (selectedRenovacion.poliza_id) {
          window.dispatchEvent(new CustomEvent('renovaciones:historial:refresh', { detail: { polizaId: selectedRenovacion.poliza_id } }));
        }
      } catch {}

      setShowContactModal(false);
      setSelectedRenovacion(null);
      loadRenovaciones();
      loadEstadisticas(); // Recargar estadísticas después del contacto
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al registrar contacto",
        variant: "destructive",
      });
    }
  };

  const handleProcesarRenovacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRenovacion) return;

    try {
      const formData = new FormData(e.target as HTMLFormElement);

      // Validaciones del lado cliente
      const nuevaFechaV = formData.get('nueva_fecha') as string;
      const nuevoValorPrima = parseFloat(formData.get('nuevo_valor') as string);
      const nuevoNumero = (formData.get('nuevo_numero_poliza') as string || '').trim();

      // Validar fecha requerida
      if (!nuevaFechaV) {
        toast({
          title: "Error de validación",
          description: "La fecha de vencimiento es obligatoria",
          variant: "destructive",
        });
        return;
      }

      // Validar fecha futura
      const fechaSeleccionada = new Date(nuevaFechaV);
      const hoy = new Date();
      if (fechaSeleccionada <= hoy) {
        toast({
          title: "Error de validación",
          description: "La fecha de vencimiento debe ser futura",
          variant: "destructive",
        });
        return;
      }

      // Validar fecha no demasiado lejana (máximo 2 años)
      const maxFecha = new Date();
      maxFecha.setFullYear(maxFecha.getFullYear() + 2);
      if (fechaSeleccionada > maxFecha) {
        toast({
          title: "Error de validación",
          description: "La fecha de vencimiento no puede ser superior a 2 años",
          variant: "destructive",
        });
        return;
      }

      // Validar prima requerida y en rango
      if (isNaN(nuevoValorPrima) || nuevoValorPrima < 0) {
        toast({
          title: "Error de validación",
          description: "El valor de la prima es obligatorio y debe ser mayor o igual a 0",
          variant: "destructive",
        });
        return;
      }

      // Validar que el número de póliza no esté vacío si se proporcionó algo
      if (nuevoNumero && nuevoNumero.length < 3) {
        toast({
          title: "Error de validación",
          description: "El número de póliza debe tener al menos 3 caracteres",
          variant: "destructive",
        });
        return;
      }

      // Fallback: si no tocan la fecha, usar la que se muestra por defecto (vencimiento + 1 año)
      const fallbackNuevaFecha = selectedRenovacion
        ? new Date(new Date(selectedRenovacion.fechaVencimiento).getTime() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
        : '';
      const fechaFinal = nuevaFechaV || fallbackNuevaFecha;

      const nuevaAseguradora = renAseguradoraId || '';
      const nuevoRamo = renRamoId || '';

      const renovacionData = {
        nuevaFechaVencimiento: fechaFinal,
        nuevoValorPrima: nuevoValorPrima,
        observaciones: formData.get('observaciones_renovacion') as string,
        nuevoNumeroPoliza: nuevoNumero || undefined,
        nuevaAseguradora: nuevaAseguradora || undefined,
        nuevoRamoId: nuevoRamo || undefined,
        porcentajeIva: parseFloat(renPorcentajeIva) || 19,
        iva: parseFloat(renIva) || 0,
        gastosAdicionales: parseFloat(renGastosAdicionales) || 0,
        total: parseFloat(renTotal) || 0,
      };
      const caratulaFile = formData.get('caratula') as File | null;

      const resultado = await renovacionesService.procesarRenovacion(selectedRenovacion.id, renovacionData);

      // Determine target poliza for file upload
      const resData = (resultado as any)?.data;
      const targetPolizaId = resData?.nueva_poliza?.id
        ? String(resData.nueva_poliza.id)
        : String(selectedRenovacion.poliza_id);

      // Si se adjuntó carátula, subirla a la póliza resultado
      if (caratulaFile && caratulaFile.size > 0) {
        try {
          await polizaService.subirDocumento(targetPolizaId, caratulaFile, { type: 'caratula' });
        } catch (err) {
          console.warn('No se pudo subir carátula en renovación:', err);
        }
      }

      const numRenovacion = resData?.nueva_poliza?.numero_renovacion;
      const mode = resData?.mode;
      const np = resData?.nueva_poliza;
      const op = resData?.poliza_original;
      const descParts: string[] = [];
      if (mode === 'updated') {
        descParts.push(`Póliza renovada en sitio (renovación #${numRenovacion || 1})`);
      } else {
        descParts.push(`Nueva póliza ${np?.numero_poliza || ''} creada (renovación #${numRenovacion || 1})`);
        if (op?.nuevo_estado === 'cancelada') descParts.push(`Póliza anterior ${op?.numero_poliza} cancelada`);
      }
      if (np?.aseguradora) descParts.push(`Aseg: ${np.aseguradora}`);
      if (np?.comision_porcentaje) descParts.push(`Comisión: ${np.comision_porcentaje}%`);
      toast({
        title: "Renovación exitosa",
        description: descParts.join(' · '),
        variant: "default",
      });
      
      // Notificar al historial de la póliza para refrescarse
      try {
        if (selectedRenovacion.poliza_id) {
          window.dispatchEvent(new CustomEvent('renovaciones:historial:refresh', { detail: { polizaId: selectedRenovacion.poliza_id } }));
        }
      } catch {}

      setShowRenovarModal(false);
      setSelectedRenovacion(null);
      setRenAseguradoraId('');
      setRenRamoId('');
      loadRenovaciones();
      loadEstadisticas();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar renovación",
        variant: "destructive",
      });
    }
  };

  const handleViewPoliza = (renovacion: Renovacion) => {
    window.open(`/apps/seguros/polizas/editar/${renovacion.poliza_id}`, '_blank');
  };

  const getTipoIcon = (tipo?: string) => {
    if (!tipo) return <Icon icon="solar:document-bold-duotone" className="w-3 h-3" />;
    const tipoInfo = tiposSeguro.find(t => t.value === tipo.toLowerCase());
    if (tipoInfo) {
      return <Icon icon={tipoInfo.icon} className="w-3 h-3" />;
    }
    return <Icon icon="solar:document-bold-duotone" className="w-3 h-3" />;
  };

  const getEstadoBadge = (estado: string) => {
    const estadoInfo = estadosRenovacion.find(e => e.value === estado);
    return estadoInfo?.color || 'gray';
  };


  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDiasVencimientoColor = (dias: number) => {
    if (dias < 0) return 'text-red-600';
    if (dias <= 7) return 'text-red-500';
    if (dias <= 15) return 'text-orange-500';
    if (dias <= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  const formatDiasVencimiento = (dias: number) => {
    if (dias < 0) return `${Math.abs(dias)} días vencido`;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `${dias} días`;
  };

  return (
    <div className="space-y-4">
      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Renovaciones</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">{estadisticas.total_renovaciones || 0}</p>
              </div>
              <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Críticas</p>
                <p className="text-lg md:text-2xl font-bold text-red-600">{estadisticas.renovaciones_criticas || 0}</p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-red-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-lg md:text-2xl font-bold text-orange-600">{estadisticas.renovaciones_pendientes || 0}</p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-orange-500 rounded-full"></div>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Prima Total</p>
                <p className="text-sm md:text-lg font-bold text-purple-600">
                  {formatCurrency(typeof estadisticas.valor_total_primas === 'string' ? parseFloat(estadisticas.valor_total_primas) : (estadisticas.valor_total_primas || 0))}
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xs md:text-sm">$</span>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-4 col-span-2 sm:col-span-3 md:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Completadas</p>
                <p className="text-lg md:text-2xl font-bold text-green-600">{estadisticas.renovaciones_completadas || 0}</p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs de navegación por estado */}
      <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-2 px-6 pt-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('pendientes')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'pendientes'
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:clock-circle-bold-duotone" className="w-4 h-4" />
                <span>Pendientes</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'pendientes'
                    ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tabCounts.pendientes}
                </span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('renovadas')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'renovadas'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-b-2 border-green-500'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4" />
                <span>Renovadas</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'renovadas'
                    ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tabCounts.renovadas}
                </span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('vencidas')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'vencidas'
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-b-2 border-red-500'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4" />
                <span>Vencidas</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'vencidas'
                    ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tabCounts.vencidas}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('todas')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'todas'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:list-bold-duotone" className="w-4 h-4" />
                <span>Todas</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'todas'
                    ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tabCounts.todas}
                </span>
              </div>
            </button>
          </nav>
        </div>

        {/* Controles */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <TextInput
                  placeholder="Buscar por número de póliza, cliente, placa..."
                  value={filters.search || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('search', e.target.value)}
                  className="pl-10 h-10 text-sm rounded-[10px] bg-white dark:bg-darkgray border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => setShowFilterDrawer(true)}
                className="h-10 w-10 p-0 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Filtros"
              >
                <Icon icon="solar:filter-bold-duotone" className="w-4 h-4" />
              </Button>

              <Button
                color="light"
                onClick={handleExportRenovaciones}
                className="h-10 px-3 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center gap-2"
                title="Exportar a CSV"
              >
                <Icon icon="solar:export-bold-duotone" className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Exportar</span>
              </Button>
              
              {/* Botón Nueva Póliza removido según solicitud del usuario */}
            </div>
          </div>

          {/* Labels de filtros activos */}
          {(filters.agente || filters.aseguradora || filters.ramo || filters.fecha_inicio || filters.fecha_fin || filters.diasVencimiento) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {filters.agente && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                  Asesor: {filters.agente}
                  <button
                    onClick={() => handleFilterChange('agente', '')}
                    className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {filters.aseguradora && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full">
                  Aseguradora: {filters.aseguradora}
                  <button
                    onClick={() => handleFilterChange('aseguradora', '')}
                    className="ml-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {filters.ramo && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 rounded-full">
                  Ramo: {filters.ramo}
                  <button
                    onClick={() => handleFilterChange('ramo', '')}
                    className="ml-1 hover:bg-cyan-200 dark:hover:bg-cyan-800 rounded-full p-0.5"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {filters.fecha_inicio && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                  Desde: {filters.fecha_inicio}
                  <button
                    onClick={() => handleFilterChange('fecha_inicio', '')}
                    className="ml-1 hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {filters.fecha_fin && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full">
                  Hasta: {filters.fecha_fin}
                  <button
                    onClick={() => handleFilterChange('fecha_fin', '')}
                    className="ml-1 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-full p-0.5"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {filters.diasVencimiento && filters.diasVencimiento !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full">
                  Plazo: {filters.diasVencimiento === 'critico' ? '≤7 días' : filters.diasVencimiento === 'proximo' ? '≤30 días' : filters.diasVencimiento === 'proximo_2m' ? '≤60 días' : filters.diasVencimiento}
                  <button
                    onClick={() => handleFilterChange('diasVencimiento', '')}
                    className="ml-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-full p-0.5"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    agente: '',
                    aseguradora: '',
                    ramo: '',
                    fecha_inicio: '',
                    fecha_fin: '',
                    diasVencimiento: '',
                    page: 1
                  }));
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              >
                Limpiar todos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de renovaciones */}
      <div className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner size="lg" />
            <span className="ml-2">Cargando renovaciones...</span>
          </div>
        ) : renovaciones.length === 0 ? (
          <div className="text-center py-8">
            <Icon icon="solar:refresh-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No se encontraron renovaciones</p>
            <div className="flex justify-center">
              <Button color="primary">
                <Icon icon="solar:calendar-add-bold-duotone" className="w-4 h-4 mr-2" />
                Programar primera renovación
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="guro-table-wrap">
              <table className="guro-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Aseguradora</th>
                    <th>Ramo</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                    <th>Prima</th>
                    <th className="sticky-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {renovaciones.map((renovacion) => (
                    <tr key={renovacion.id} className="group">
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <h6 className="text-sm font-medium">{renovacion.numeroPoliza}</h6>
                          {renovacion.numeroRenovacion != null && renovacion.numeroRenovacion > 0 && (
                            <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full leading-none">
                              R{renovacion.numeroRenovacion}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="truncate line-clamp-2 max-w-44">
                          <h6 className="text-sm uppercase">{renovacion.cliente}</h6>
                          <p className="text-xs text-bodytext">{renovacion.dni_cliente || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <p className="text-bodytext text-sm">{renovacion.aseguradora}</p>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTipoIcon(renovacion.tipoSeguro)}
                          <span className="text-sm font-medium">{tiposSeguro.find(t => t.value === renovacion.tipoSeguro)?.label || renovacion.tipoSeguro}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <div>
                          <h6 className="text-sm">{new Date(renovacion.fechaVencimiento).toLocaleDateString('es-CO')}</h6>
                          <p className={`text-xs ${getDiasVencimientoColor(renovacion.diasVencimiento)}`}>
                            {formatDiasVencimiento(renovacion.diasVencimiento)}
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <Badge
                          color={activeTab === 'renovadas' && renovacion.estado === 'RENOVADO' ? 'success' : `light${getEstadoBadge(renovacion.estado)}`}
                          className="capitalize text-xs"
                        >
                          {estadosRenovacion.find(e => e.value === renovacion.estado)?.label || renovacion.estado}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap">
                        <h6 className="text-sm">{formatCurrency(renovacion.valorPrima)}</h6>
                      </td>
                      <td className="sticky-right" onClick={(e) => e.stopPropagation()}>
                        <TableActionMenu>
                          <TableMenuItem onClick={() => handleViewRenovacion(renovacion)}>
                            <Icon icon="solar:eye-bold-duotone" height={18} />
                            <span>Ver Detalles</span>
                          </TableMenuItem>
                          <TableMenuItem onClick={() => handleViewPoliza(renovacion)}>
                            <Icon icon="solar:document-bold-duotone" height={18} className="text-blue-600" />
                            <span>Ver Póliza</span>
                          </TableMenuItem>
                          <TableMenuItem onClick={() => handleRegistrarContacto(renovacion)}>
                            <Icon icon="solar:phone-bold-duotone" height={18} />
                            <span>Registrar Contacto</span>
                          </TableMenuItem>
                          {renovacion.estado !== 'RENOVADO' && (
                            <TableMenuItem className="text-green-600" onClick={() => handleRenovar(renovacion)}>
                              <Icon icon="solar:refresh-bold-duotone" height={18} />
                              <span>Renovar</span>
                            </TableMenuItem>
                          )}
                        </TableActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Paginación */}
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
          <div className="text-sm text-gray-500">
            Mostrando {pagination.from} a {pagination.to} de {pagination.total} resultados
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              color="light"
              disabled={pagination.current_page === 1}
              onClick={() => handleFilterChange('page', pagination.current_page - 1)}
              className="rounded-[10px]"
            >
              Anterior
            </Button>
            <span className="flex items-center px-3 text-sm bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
              Página {pagination.current_page} de {pagination.last_page}
            </span>
            <Button
              size="sm"
              color="light"
              disabled={pagination.current_page === pagination.last_page}
              onClick={() => handleFilterChange('page', pagination.current_page + 1)}
              className="rounded-[10px]"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modal de detalle mejorado */}
      <DetalleRenovacion
        show={showModal}
        onClose={() => setShowModal(false)}
        renovacion={selectedRenovacion}
        onRegistrarContacto={handleRegistrarContacto}
        onRenovar={handleRenovar}
      />

      {/* Modal de filtros avanzados */}
      <Modal show={showFilterDrawer} onClose={() => setShowFilterDrawer(false)} size="2xl">
        <Modal.Header>Filtros Avanzados</Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="estado" className="mb-2 block text-gray-900 dark:text-white">Estado</Label>
              <select
                id="estado"
                value={filters.estado || ''}
                onChange={(e) => handleFilterChange('estado', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
              >
                <option value="">Todos los estados</option>
                {estadosRenovacion.map((estado) => (
                  <option key={estado.value} value={estado.value}>{estado.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <Label htmlFor="dias_vencimiento" className="mb-2 block text-gray-900 dark:text-white">Días de Vencimiento</Label>
              <select
                id="dias_vencimiento"
                value={filters.diasVencimiento || ''}
                onChange={(e) => handleFilterChange('diasVencimiento', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
              >
                <option value="">Todos los plazos</option>
                <option value="critico">Crítico (≤7 días)</option>
                <option value="proximo">Próximo (≤30 días)</option>
                <option value="proximo_2m">Próximos 2 meses (≤60 días)</option>
                <option value="all">Sin ventana (todos)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="agente" className="mb-2 block text-gray-900 dark:text-white">Asesor</Label>
              <select
                id="agente"
                value={filters.agente || ''}
                onChange={(e) => handleFilterChange('agente', e.target.value)}
                disabled={loadingVendedores}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
              >
                <option value="">Todos los asesores</option>
                {(vendedoresList || []).map((v: any) => (
                  <option key={v.id} value={v.nombres}>{v.nombres}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="aseguradora" className="mb-2 block text-gray-900 dark:text-white">Aseguradora</Label>
              <select
                id="aseguradora"
                value={(filters as any).aseguradora || ''}
                onChange={(e) => handleFilterChange('aseguradora' as any, e.target.value)}
                disabled={loadingAseguradoras}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
              >
                <option value="">Todas</option>
                {(aseguradorasList || []).map((a: any) => (
                  <option key={a.id} value={a.nombre}>{a.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="ramo" className="mb-2 block text-gray-900 dark:text-white">Ramo</Label>
              <select
                id="ramo"
                value={filters.ramo || ''}
                onChange={(e) => handleFilterChange('ramo', e.target.value)}
                disabled={loadingRamos}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
              >
                <option value="">Todos los ramos</option>
                {(ramosList || []).map((r: any) => (
                  <option key={r.id} value={r.nombre}>{r.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="fecha_inicio" className="mb-2 block text-gray-900 dark:text-white">Vencimiento desde</Label>
              <TextInput
                id="fecha_inicio"
                type="date"
                value={(filters as any).fecha_inicio || ''}
                onChange={(e) => handleFilterChange('fecha_inicio' as any, e.target.value)}
                className="h-10"
              />
            </div>

            <div>
              <Label htmlFor="fecha_fin" className="mb-2 block text-gray-900 dark:text-white">Vencimiento hasta</Label>
              <TextInput
                id="fecha_fin"
                type="date"
                value={(filters as any).fecha_fin || ''}
                onChange={(e) => handleFilterChange('fecha_fin' as any, e.target.value)}
                className="h-10"
              />
            </div>

            <div>
              <Label htmlFor="per_page" className="mb-2 block text-gray-900 dark:text-white">Elementos por página</Label>
              <select
                id="per_page"
                value={filters.per_page?.toString() || '15'}
                onChange={(e) => handleFilterChange('per_page', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            color="gray" 
            onClick={() => {
              setFilters({
                search: '',
                estado: '',
                agente: '',
                aseguradora: '',
                ramo: '',
                placa: '',
                diasVencimiento: '',
                fecha_inicio: '',
                fecha_fin: '',
                per_page: 15,
                page: 1,
                sort_field: 'fechaVencimiento',
                sort_direction: 'asc'
              });
              setShowFilterDrawer(false);
            }}
          >
            Limpiar Filtros
          </Button>
          <Button color="primary" onClick={() => setShowFilterDrawer(false)}>
            Aplicar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de personalización de columnas oculto temporalmente por no aplicar cambios */}
      {/* Modal Registrar Contacto */}
      <Modal show={showContactModal} onClose={() => setShowContactModal(false)}>
        <Modal.Header>Registrar Contacto - {selectedRenovacion?.numeroPoliza}</Modal.Header>
        <Modal.Body>
          <form onSubmit={handleRegistrarContactoSubmit} id="contact-form">
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <div className="flex">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-amber-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Información del último contacto:</strong><br/>
                      {selectedRenovacion?.ultimoContacto ?
                        `Fecha: ${new Date(selectedRenovacion.ultimoContacto).toLocaleDateString('es-CO')} | Intentos: ${selectedRenovacion.intentosContacto}` :
                        'Sin contactos previos registrados'
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="tipo_contacto" className="mb-2 block text-gray-900 dark:text-white">
                  Tipo de Contacto <span className="text-red-500">*</span>
                </Label>
                <select
                  id="tipo_contacto"
                  name="tipo_contacto"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Seleccionar tipo...</option>
                  <option value="llamada">📞 Llamada telefónica</option>
                  <option value="email">📧 Correo electrónico</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="presencial">🏢 Visita presencial</option>
                  <option value="sms">📱 SMS</option>
                </select>
              </div>
              <div>
                <Label htmlFor="resultado_contacto" className="mb-2 block text-gray-900 dark:text-white">
                  Resultado del Contacto <span className="text-red-500">*</span>
                </Label>
                <select
                  id="resultado_contacto"
                  name="resultado_contacto"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Seleccionar resultado...</option>
                  <option value="exitoso">✅ Cliente contactado exitosamente</option>
                  <option value="no_disponible">⏰ Cliente no disponible</option>
                  <option value="no_contesta">📵 Número no contesta</option>
                  <option value="rebotado">📧 Correo rebotado</option>
                  <option value="solicita_info">ℹ️ Cliente solicita información</option>
                  <option value="no_interesado">❌ Cliente no interesado</option>
                </select>
              </div>
              <div>
                <Label htmlFor="observaciones_contacto" className="mb-2 block text-gray-900 dark:text-white">
                  Observaciones <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">Mínimo 10 caracteres</span>
                </Label>
                <textarea
                  id="observaciones_contacto"
                  name="observaciones_contacto"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Detalles del contacto realizado..."
                  minLength={10}
                  maxLength={1000}
                  required
                />
              </div>
              <div>
                <Label htmlFor="proximo_contacto" className="mb-2 block text-gray-900 dark:text-white">
                  Próximo Contacto
                  <span className="text-xs text-gray-500 ml-2">Opcional - Fecha futura</span>
                </Label>
                <TextInput
                  type="datetime-local"
                  id="proximo_contacto"
                  name="proximo_contacto"
                  className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit" form="contact-form" color="primary">
            Registrar Contacto
          </Button>
          <Button color="gray" onClick={() => setShowContactModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Renovar */}
      <Modal show={showRenovarModal} onClose={() => setShowRenovarModal(false)} size="2xl">
        <Modal.Header>Procesar Renovación - {selectedRenovacion?.numeroPoliza}</Modal.Header>
        <Modal.Body>
          <form onSubmit={handleProcesarRenovacion} id="renovacion-form">
            <div className="space-y-4">
              {/* Current poliza details */}
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">Póliza actual</span>
                  {selectedRenovacion?.numeroRenovacion != null && selectedRenovacion.numeroRenovacion > 0 && (
                    <span className="ml-auto text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      Renovación #{selectedRenovacion.numeroRenovacion}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                  <div><span className="text-gray-500">Número:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedRenovacion?.numeroPoliza}</span></div>
                  <div><span className="text-gray-500">Aseguradora:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedRenovacion?.aseguradora || '—'}</span></div>
                  <div><span className="text-gray-500">Ramo:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedRenovacion?.ramo || selectedRenovacion?.tipoSeguro || '—'}</span></div>
                  <div><span className="text-gray-500">Prima actual:</span> <span className="font-medium text-gray-900 dark:text-white">${selectedRenovacion?.valorPrima?.toLocaleString('es-CO') || '0'}</span></div>
                  <div><span className="text-gray-500">Vigencia:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedRenovacion?.fechaInicio?.split('T')[0] || '—'} → {selectedRenovacion?.fechaVencimiento?.split('T')[0] || '—'}</span></div>
                  <div><span className="text-gray-500">Cliente:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedRenovacion?.cliente || '—'}</span></div>
                </div>
              </div>
              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  <strong>Sin</strong> nuevo número → se actualiza la póliza existente &nbsp;|&nbsp;
                  <strong>Con</strong> nuevo número → se crea nueva póliza y la anterior queda <strong>cancelada</strong> &nbsp;|&nbsp;
                  La comisión se calcula automáticamente
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nuevo_numero_poliza" className="mb-2 block text-gray-900 dark:text-white">
                    Nuevo número de póliza (opcional)
                  </Label>
                  <TextInput
                    type="text"
                    id="nuevo_numero_poliza"
                    name="nuevo_numero_poliza"
                    placeholder="Número de la nueva póliza"
                    className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <Label htmlFor="nueva_aseguradora" className="mb-2 block text-gray-900 dark:text-white">
                    Cambiar Aseguradora (opcional)
                  </Label>
                  <select
                    id="nueva_aseguradora"
                    name="nueva_aseguradora"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                    value={renAseguradoraId}
                    onChange={(e) => { setRenAseguradoraId(e.target.value); setRenRamoId(''); }}
                  >
                    <option value="">Mantener aseguradora actual ({selectedRenovacion?.aseguradora})</option>
                    {!loadingAseguradoras && aseguradorasList.map((aseg) => (
                      <option key={aseg.id} value={aseg.id}>{aseg.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              {renAseguradoraId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nuevo_ramo" className="mb-2 block text-gray-900 dark:text-white">
                      Nuevo Ramo
                    </Label>
                    <select
                      id="nuevo_ramo"
                      name="nuevo_ramo"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                      value={renRamoId}
                      onChange={(e) => setRenRamoId(e.target.value)}
                    >
                      <option value="">Mantener ramo actual ({selectedRenovacion?.ramo || selectedRenovacion?.tipoSeguro})</option>
                      {!loadingRamos && ramosList.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    {(() => {
                      const targetRamoId = renRamoId;
                      const targetAsegId = renAseguradoraId;
                      if (targetRamoId && targetAsegId) {
                        const ramo = ramosList.find((r: any) => String(r.id) === String(targetRamoId));
                        const comision = ramo?.comisiones_aseguradoras?.find((c: any) => String(c.aseguradora_id) === String(targetAsegId));
                        if (comision) {
                          return (
                            <div className="w-full p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Comisión configurada</p>
                              <p className="text-lg font-bold text-green-700 dark:text-green-300">{comision.porcentaje_comision}%</p>
                              {comision.porcentaje_iva > 0 && <p className="text-xs text-green-600 dark:text-green-400">IVA: {comision.porcentaje_iva}%</p>}
                            </div>
                          );
                        } else {
                          return (
                            <div className="w-full p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                              <p className="text-xs text-yellow-600 dark:text-yellow-400">Sin comisión configurada para esta combinación</p>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="nueva_fecha" className="mb-2 block text-gray-900 dark:text-white">
                  Nueva Fecha de Vencimiento <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">Máximo 2 años</span>
                </Label>
                <TextInput
                  type="date"
                  id="nueva_fecha"
                  name="nueva_fecha"
                  className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={selectedRenovacion ? new Date(new Date(selectedRenovacion.fechaVencimiento).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : ''}
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0]}
                  required
                />
              </div>
              {/* Información Financiera */}
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="solar:wallet-bold-duotone" className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">Información Financiera</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="nuevo_valor" className="text-xs font-medium text-gray-900 dark:text-white">Prima Neta <span className="text-red-500">*</span></Label>
                    <TextInput
                      type="number"
                      id="nuevo_valor"
                      name="nuevo_valor"
                      placeholder="0"
                      className="mt-1 bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      value={renPrimaNeta}
                      onChange={(e) => setRenPrimaNeta(e.target.value)}
                      step="1"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ren_pct_iva" className="text-xs font-medium text-gray-900 dark:text-white">% IVA</Label>
                    <TextInput
                      type="number"
                      id="ren_pct_iva"
                      placeholder="19"
                      className="mt-1 bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      value={renPorcentajeIva}
                      onChange={(e) => setRenPorcentajeIva(e.target.value)}
                      step="0.01"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-900 dark:text-white">IVA</Label>
                    <TextInput
                      type="text"
                      value={renIva ? Number(renIva).toLocaleString('es-CO') : '0'}
                      readOnly
                      className="mt-1 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ren_gastos" className="text-xs font-medium text-gray-900 dark:text-white">Gastos Adic.</Label>
                    <TextInput
                      type="number"
                      id="ren_gastos"
                      placeholder="0"
                      className="mt-1 bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      value={renGastosAdicionales}
                      onChange={(e) => setRenGastosAdicionales(e.target.value)}
                      step="1"
                      min="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-900 dark:text-white">Total</Label>
                    <TextInput
                      type="text"
                      value={renTotal ? Number(renTotal).toLocaleString('es-CO') : '0'}
                      readOnly
                      className="mt-1 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ren_pct_comision" className="text-xs font-medium text-gray-900 dark:text-white">% Comisión</Label>
                    <TextInput
                      type="number"
                      id="ren_pct_comision"
                      placeholder="0"
                      className="mt-1 bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      value={renPorcentajeComision}
                      onChange={(e) => setRenPorcentajeComision(e.target.value)}
                      step="0.01"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                {renComision && parseFloat(renComision) > 0 && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Comisión estimada: <span className="font-bold text-green-600">${Number(renComision).toLocaleString('es-CO')}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="caratula" className="mb-2 block text-gray-900 dark:text-white">
                    Carátula (PDF, opcional)
                  </Label>
                  <input
                    type="file"
                    id="caratula"
                    name="caratula"
                    accept="application/pdf"
                    onChange={handleRenCaratulaChange}
                    className="block w-full text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {renPdfProcessing && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                      <Spinner size="sm" />
                      <span>Leyendo PDF con IA...</span>
                    </div>
                  )}
                  {!renPdfProcessing && Object.keys(renPdfSuggestions).length > 0 && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-xs">
                      <p className="font-semibold text-green-700 dark:text-green-400 mb-2">IA detectó en el PDF — haz clic para aplicar:</p>
                      <div className="flex flex-wrap gap-2">
                        {renPdfSuggestions.numeroPoliza && (
                          <button type="button" onClick={() => { const el = document.getElementById('ren_nueva_numero_poliza') as HTMLInputElement; if (el) { el.value = renPdfSuggestions.numeroPoliza; el.dispatchEvent(new Event('input', { bubbles: true })); } }} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded cursor-pointer hover:bg-green-200">
                            N° póliza: {renPdfSuggestions.numeroPoliza}
                          </button>
                        )}
                        {renPdfSuggestions.fechaInicio && (
                          <button type="button" onClick={() => { const el = document.getElementById('ren_fecha_inicio') as HTMLInputElement; if (el) { el.value = renPdfSuggestions.fechaInicio; el.dispatchEvent(new Event('input', { bubbles: true })); } }} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded cursor-pointer hover:bg-green-200">
                            Inicio: {renPdfSuggestions.fechaInicio}
                          </button>
                        )}
                        {renPdfSuggestions.fechaFin && (
                          <button type="button" onClick={() => { const el = document.getElementById('ren_fecha_fin') as HTMLInputElement; if (el) { el.value = renPdfSuggestions.fechaFin; el.dispatchEvent(new Event('input', { bubbles: true })); } }} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded cursor-pointer hover:bg-green-200">
                            Fin: {renPdfSuggestions.fechaFin}
                          </button>
                        )}
                        {renPdfSuggestions.primaNeta && (
                          <button type="button" onClick={() => setRenPrimaNeta(renPdfSuggestions.primaNeta)} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded cursor-pointer hover:bg-green-200">
                            Prima: ${Number(renPdfSuggestions.primaNeta).toLocaleString('es-CO')}
                          </button>
                        )}
                        {renPdfSuggestions.total && (
                          <button type="button" onClick={() => setRenTotal(renPdfSuggestions.total)} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded cursor-pointer hover:bg-green-200">
                            Total: ${Number(renPdfSuggestions.total).toLocaleString('es-CO')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="observaciones_renovacion" className="mb-2 block text-gray-900 dark:text-white">
                    Observaciones
                  </Label>
                  <textarea
                    id="observaciones_renovacion"
                    name="observaciones_renovacion"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white text-sm"
                    rows={2}
                    placeholder="Notas sobre la renovación..."
                    maxLength={1000}
                  />
                </div>
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit" form="renovacion-form" color="success">
            Confirmar Renovación
          </Button>
          <Button color="gray" onClick={() => setShowRenovarModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Renovaciones; 