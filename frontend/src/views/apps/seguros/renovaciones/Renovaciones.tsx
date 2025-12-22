import React, { useState, useEffect } from 'react';
import { Card, Badge, Spinner, Modal, Table, Button, Dropdown, TextInput, Label } from 'flowbite-react';
import { IconDots } from '@tabler/icons-react';
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
    setShowRenovarModal(true);
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
      if (!nuevoValorPrima || nuevoValorPrima < 10000 || nuevoValorPrima > 100000000) {
        toast({
          title: "Error de validación",
          description: "El valor de la prima debe estar entre $10,000 y $100,000,000",
          variant: "destructive",
        });
        return;
      }

      // Validar formato de número de póliza si se proporciona
      if (nuevoNumero && !/^[A-Z]{3}-\d{4}-\d{4}$/.test(nuevoNumero)) {
        toast({
          title: "Error de validación",
          description: "El formato del número de póliza debe ser AAA-0000-0000",
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

      const nuevaAseguradora = (formData.get('nueva_aseguradora') as string || '').trim();

      const renovacionData = {
        nuevaFechaVencimiento: fechaFinal,
        nuevoValorPrima: nuevoValorPrima,
        observaciones: formData.get('observaciones_renovacion') as string,
        nuevoNumeroPoliza: nuevoNumero || undefined,
        nuevaAseguradora: nuevaAseguradora || undefined,
      };
      const caratulaFile = formData.get('caratula') as File | null;

      await renovacionesService.procesarRenovacion(selectedRenovacion.id, renovacionData);

      // Si se especificó nuevo número de póliza o nueva aseguradora, actualizar la póliza
      if ((nuevoNumero || nuevaAseguradora) && selectedRenovacion.poliza_id) {
        try {
          const updateData: any = {};
          if (nuevoNumero) updateData.numero_poliza = nuevoNumero;
          if (nuevaAseguradora) updateData.aseguradora_id = nuevaAseguradora;
          await polizaService.updatePoliza(String(selectedRenovacion.poliza_id), updateData);
        } catch (err) {
          // Continuar aunque falle esta parte
          console.warn('No se pudo actualizar datos de póliza en renovación:', err);
        }
      }

      // Si se adjuntó carátula, subirla como documento de la póliza
      if (caratulaFile && caratulaFile.size > 0 && selectedRenovacion.poliza_id) {
        try {
          await polizaService.subirDocumento(String(selectedRenovacion.poliza_id), caratulaFile, { type: 'caratula' });
        } catch (err) {
          console.warn('No se pudo subir carátula en renovación:', err);
        }
      }
      
      toast({
        title: "Éxito",
        description: "Renovación procesada exitosamente",
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
                  placeholder="Buscar por número de póliza, cliente..."
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
            <div className="overflow-x-auto">
              <Table hoverable className="shadow-md dark:shadow-none bg-white dark:bg-darkgray rounded-[10px]">
                <Table.Head>
                  <Table.HeadCell className="text-sm font-semibold py-2">Número</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Cliente</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Aseguradora</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Ramo</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Vencimiento</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Estado</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Prima</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="">
                  {renovaciones.map((renovacion) => (
                    <Table.Row key={renovacion.id}>
                      <Table.Cell className="whitespace-nowrap">
                        <h6 className="text-sm font-medium">{renovacion.numeroPoliza}</h6>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <div className="truncate line-clamp-2 max-w-44">
                          <h6 className="text-sm uppercase">{renovacion.cliente}</h6>
                          <p className="text-xs text-bodytext">{renovacion.dni_cliente || 'N/A'}</p>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <p className="text-bodytext text-sm">{renovacion.aseguradora}</p>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTipoIcon(renovacion.tipoSeguro)}
                          <span className="text-sm font-medium">{tiposSeguro.find(t => t.value === renovacion.tipoSeguro)?.label || renovacion.tipoSeguro}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <div>
                          <h6 className="text-sm">{new Date(renovacion.fechaVencimiento).toLocaleDateString('es-CO')}</h6>
                          <p className={`text-xs ${getDiasVencimientoColor(renovacion.diasVencimiento)}`}>
                            {formatDiasVencimiento(renovacion.diasVencimiento)}
                          </p>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <Badge
                          color={activeTab === 'renovadas' && renovacion.estado === 'RENOVADO' ? 'success' : `light${getEstadoBadge(renovacion.estado)}`}
                          className="capitalize text-xs"
                        >
                          {estadosRenovacion.find(e => e.value === renovacion.estado)?.label || renovacion.estado}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <h6 className="text-sm">{formatCurrency(renovacion.valorPrima)}</h6>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <Dropdown
                          label=""
                          dismissOnClick={false}
                          renderTrigger={() => (
                            <span className="h-8 w-8 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                              <IconDots size={18} />
                            </span>
                          )}
                        >
                          <Dropdown.Item onClick={() => handleViewRenovacion(renovacion)} className="flex gap-2 text-sm">
                            <Icon icon="solar:eye-bold" height={16} />
                            <span>Ver Detalles</span>
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => handleViewPoliza(renovacion)} className="flex gap-2 text-sm text-blue-600">
                            <Icon icon="solar:document-bold" height={16} />
                            <span>Ver Póliza</span>
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => handleRegistrarContacto(renovacion)} className="flex gap-2 text-sm">
                            <Icon icon="solar:phone-bold" height={16} />
                            <span>Registrar Contacto</span>
                          </Dropdown.Item>
                          {renovacion.estado !== 'RENOVADO' && (
                            <Dropdown.Item onClick={() => handleRenovar(renovacion)} className="flex gap-2 text-sm text-green-600">
                              <Icon icon="solar:refresh-bold" height={16} />
                              <span>Renovar</span>
                            </Dropdown.Item>
                          )}
                        </Dropdown>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
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
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <div className="flex">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-200"><strong>Información:</strong> Estás a punto de procesar la renovación de esta póliza.</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      • La nueva fecha debe ser posterior a la fecha de vencimiento actual<br/>
                      • El cambio de prima no puede superar el 50%<br/>
                      • La fecha máxima permitida es 2 años desde hoy
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nuevo_numero_poliza" className="mb-2 block text-gray-900 dark:text-white">
                    Nuevo número de póliza (opcional)
                    <span className="text-xs text-gray-500 ml-2">Formato: AAA-0000-0000</span>
                  </Label>
                  <TextInput
                    type="text"
                    id="nuevo_numero_poliza"
                    name="nuevo_numero_poliza"
                    placeholder="Ej: POL-2025-0001"
                    className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    pattern="^[A-Z]{3}-\d{4}-\d{4}$"
                    title="Formato requerido: AAA-0000-0000"
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
                    defaultValue=""
                  >
                    <option value="">Mantener aseguradora actual ({selectedRenovacion?.aseguradora})</option>
                    {!loadingAseguradoras && aseguradorasList.map((aseg) => (
                      <option key={aseg.id} value={aseg.id}>{aseg.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
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
              <div>
                <Label htmlFor="nuevo_valor" className="mb-2 block text-gray-900 dark:text-white">
                  Nuevo Valor Prima <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">$10,000 - $100,000,000</span>
                </Label>
                <TextInput
                  type="number"
                  id="nuevo_valor"
                  name="nuevo_valor"
                  placeholder="Valor de la prima"
                  className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={selectedRenovacion?.valorPrima}
                  step="0.01"
                  min="10000"
                  max="100000000"
                  required
                />
              </div>
              <div>
                <Label htmlFor="caratula" className="mb-2 block text-gray-900 dark:text-white">
                  Carátula (PDF, opcional)
                  <span className="text-xs text-gray-500 ml-2">Máximo 10MB</span>
                </Label>
                <input
                  type="file"
                  id="caratula"
                  name="caratula"
                  accept="application/pdf"
                  className="block w-full text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <Label htmlFor="observaciones_renovacion" className="mb-2 block text-gray-900 dark:text-white">
                  Observaciones de Renovación
                  <span className="text-xs text-gray-500 ml-2">Máximo 1000 caracteres</span>
                </Label>
                <textarea
                  id="observaciones_renovacion"
                  name="observaciones_renovacion"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                  rows={2}
                  placeholder="Notas sobre la renovación..."
                  maxLength={1000}
                />
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