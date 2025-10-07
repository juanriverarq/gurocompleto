import React, { useState, useEffect } from 'react';
import { Card, Badge, Spinner, Modal, Table, Button, Dropdown, TextInput, Label, Checkbox } from 'flowbite-react';
import { IconDots } from '@tabler/icons-react';
import { Icon } from '@iconify/react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from 'src/hooks/use-toast';
import renovacionesService, { 
  RenovacionFilters, 
  Renovacion, 
  RenovacionesResponse, 
  RenovacionesStats 
} from 'src/services/renovacionesService';
import DetalleRenovacion from 'src/components/renovaciones/DetalleRenovacion';
import { polizaService } from 'src/services/polizaService';

const Renovaciones: React.FC = () => {
  const [renovaciones, setRenovaciones] = useState<Renovacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedRenovacion, setSelectedRenovacion] = useState<Renovacion | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showRenovarModal, setShowRenovarModal] = useState(false);

  // Estados para filtros y columnas
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([
    'numero_poliza', 'cliente', 'tipo_seguro', 'vencimiento', 'estado', 'prioridad'
  ]);

  const { toast } = useToast();
  const navigate = useNavigate();

  // Filtros
  const [filters, setFilters] = useState<RenovacionFilters>({
    search: '',
    estado: '',
    prioridad: '',
    agente: '',
    diasVencimiento: 'proximo', // Por defecto mostrar próximas (30 días)
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

  const aseguradoras = [
    'Seguros Sura', 'Mapfre', 'Bolívar Seguros', 'La Previsora', 'AXA Colpatria'
  ];

  const estadosRenovacion = [
    { value: 'PENDIENTE', label: 'Pendiente', color: 'warning' },
    { value: 'EN_PROCESO', label: 'En Proceso', color: 'info' },
    { value: 'CRITICO', label: 'Crítico', color: 'failure' },
    { value: 'RENOVADO', label: 'Renovado', color: 'success' },
    { value: 'VENCIDO', label: 'Vencido', color: 'gray' }
  ];

  const prioridadRenovacion = [
    { value: 'BAJA', label: 'Baja', color: 'gray' },
    { value: 'MEDIA', label: 'Media', color: 'warning' },
    { value: 'ALTA', label: 'Alta', color: 'info' },
    { value: 'CRITICA', label: 'Crítica', color: 'failure' }
  ];

  // Datos mock para renovaciones (mantener por compatibilidad durante desarrollo)
  const renovacionesMock: Renovacion[] = [
    {
      id: '1',
      numeroPoliza: 'POL-2024-001',
      cliente: 'Juan Carlos Pérez',
      dni_cliente: '12345678',
      aseguradora: 'Seguros Bolívar',
      tipoSeguro: 'automovil',
      fechaVencimiento: '2024-08-15',
      diasVencimiento: 25,
      valorPrima: 1250000,
      estado: 'PENDIENTE',
      prioridad: 'ALTA',
      agente: 'María González',
      ultimoContacto: '2024-07-10',
      intentosContacto: 2,
      observaciones: 'Cliente interesado, pendiente documentación',
      poliza_id: 1
    },
    {
      id: '2',
      numeroPoliza: 'POL-2024-002',
      cliente: 'Empresa Logística ABC',
      dni_cliente: '900123456',
      aseguradora: 'Mapfre',
      tipoSeguro: 'empresarial',
      fechaVencimiento: '2024-07-30',
      diasVencimiento: 8,
      valorPrima: 3500000,
      estado: 'CRITICO',
      prioridad: 'CRITICA',
      agente: 'Carlos Rodríguez',
      ultimoContacto: '2024-07-20',
      intentosContacto: 5,
      observaciones: 'Urgente: Cliente no responde llamadas',
      poliza_id: 2
    },
    {
      id: '3',
      numeroPoliza: 'POL-2024-003',
      cliente: 'Ana María Torres',
      dni_cliente: '87654321',
      aseguradora: 'Sura',
      tipoSeguro: 'hogar',
      fechaVencimiento: '2024-09-10',
      diasVencimiento: 50,
      valorPrima: 850000,
      estado: 'EN_PROCESO',
      prioridad: 'MEDIA',
      agente: 'Luis Hernández',
      ultimoContacto: '2024-07-18',
      intentosContacto: 1,
      observaciones: 'Documentos enviados, esperando respuesta',
      poliza_id: 3
    },
    {
      id: '4',
      numeroPoliza: 'POL-2024-004',
      cliente: 'Constructora del Norte',
      dni_cliente: '800987654',
      aseguradora: 'Liberty',
      tipoSeguro: 'empresarial',
      fechaVencimiento: '2024-08-05',
      diasVencimiento: 15,
      valorPrima: 5200000,
      estado: 'RENOVADO',
      prioridad: 'ALTA',
      agente: 'Patricia Morales',
      ultimoContacto: '2024-07-19',
      intentosContacto: 3,
      observaciones: 'Renovación completada exitosamente',
      poliza_id: 4
    }
  ];

  // Cargar renovaciones desde el backend
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
      setUsingMockData(false);
      
    } catch (error) {
      console.error('Error cargando renovaciones:', error);
      
      // Determinar el tipo de error para mostrar mensaje más específico
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      let description = "Se están mostrando datos de ejemplo mientras se soluciona el problema.";
      
      if (errorMessage.includes('Token') || errorMessage.includes('authorization') || errorMessage.includes('401')) {
        description = "Problema de autenticación. Inicia sesión nuevamente. " + description;
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        description = "Sin conexión al servidor. " + description;
      }
      
      toast ({
        title: "⚠️ Renovaciones (Modo Demo)",
        description: description,
        variant: "destructive",
      });
      
      // Fallback a datos mock en caso de error
      const filteredData = renovacionesMock.filter(r => {
        return (!currentFilters.search || 
                r.cliente.toLowerCase().includes(currentFilters.search.toLowerCase()) ||
                r.numeroPoliza.toLowerCase().includes(currentFilters.search.toLowerCase())) &&
               (!currentFilters.estado || r.estado === currentFilters.estado) &&
               (!currentFilters.prioridad || r.prioridad === currentFilters.prioridad);
      });
      
      setRenovaciones(filteredData);
      setPagination({
        current_page: 1,
        last_page: 1,
        per_page: currentFilters.per_page || 15,
        total: filteredData.length,
        from: 1,
        to: filteredData.length
      });
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas desde el backend
  const loadEstadisticas = async () => {
    try {
      const stats = await renovacionesService.getEstadisticas();
      setEstadisticas(stats);
      // No cambiar usingMockData aquí ya que las estadísticas pueden cargarse independientemente
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      
      toast({
        title: "⚠️ Estadísticas (Modo Demo)",
        description: "Se están mostrando estadísticas de ejemplo.",
        variant: "destructive",
      });
      
      // Fallback a datos mock en caso de error
      const total = renovacionesMock.length;
      const criticas = renovacionesMock.filter(r => r.estado === 'CRITICO').length;
      const pendientes = renovacionesMock.filter(r => r.estado === 'PENDIENTE').length;
      const renovadas = renovacionesMock.filter(r => r.estado === 'RENOVADO').length;
      const valorTotal = renovacionesMock.reduce((sum, r) => sum + r.valorPrima, 0);
      
      setEstadisticas({
        total_renovaciones: total,
        renovaciones_criticas: criticas,
        renovaciones_pendientes: pendientes,
        renovaciones_completadas: renovadas,
        valor_total_primas: valorTotal,
        renovaciones_vencidas: 0
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
      const blob = await renovacionesService.exportarRenovaciones(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `renovaciones_${new Date().toISOString().split('T')[0]}.csv`;
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
      toast({
        title: "Error",
        description: "Error al exportar renovaciones",
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
      // Fallback: si no tocan la fecha, usar la que se muestra por defecto (vencimiento + 1 año)
      const fallbackNuevaFecha = selectedRenovacion
        ? new Date(new Date(selectedRenovacion.fechaVencimiento).getTime() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
        : '';
      const nuevaFechaV = (formData.get('nueva_fecha') as string) || fallbackNuevaFecha;
      const renovacionData = {
        nuevaFechaVencimiento: nuevaFechaV,
        nuevoValorPrima: parseFloat(formData.get('nuevo_valor') as string),
        observaciones: formData.get('observaciones_renovacion') as string,
      };
      const nuevoNumero = (formData.get('nuevo_numero_poliza') as string || '').trim();
      const caratulaFile = formData.get('caratula') as File | null;

      await renovacionesService.procesarRenovacion(selectedRenovacion.id, renovacionData);

      // Si se especificó nuevo número de póliza, actualizar la póliza
      if (nuevoNumero && selectedRenovacion.poliza_id) {
        try {
          await polizaService.updatePoliza(String(selectedRenovacion.poliza_id), {
            numero_poliza: nuevoNumero,
          } as any);
        } catch (err) {
          // Continuar aunque falle esta parte
          console.warn('No se pudo actualizar número de póliza en renovación:', err);
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
    navigate(`/apps/seguros/polizas/${renovacion.poliza_id}`);
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

  const getPrioridadBadge = (prioridad: string) => {
    const prioridadInfo = prioridadRenovacion.find(p => p.value === prioridad);
    return prioridadInfo?.color || 'gray';
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
      {/* Indicador de modo demo */}
      {usingMockData && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-yellow-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">Modo Demostración</p>
            <p className="text-xs text-yellow-700">Se están mostrando datos de ejemplo. Verifica tu conexión o autenticación.</p>
          </div>
        </div>
      )}
      
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

      {/* Controles */}
      <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
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
                onClick={() => setShowColumnsModal(true)}
                className="h-10 w-10 p-0 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Columnas"
              >
                <Icon icon="solar:settings-bold-duotone" className="w-4 h-4" />
              </Button>

              <Button
                color="light"
                onClick={handleExportRenovaciones}
                className="h-10 px-4 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-[10px]"
                title="Exportar"
              >
                <Icon icon="solar:download-bold-duotone" className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              
              <Button 
                color="primary" 
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]"
                onClick={() => navigate('/apps/seguros/polizas/create')}
              >
                <Icon icon="solar:calendar-add-bold-duotone" className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Nueva Póliza</span>
                <span className="sm:hidden">Nueva</span>
              </Button>
            </div>
          </div>
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
                  <Table.HeadCell className="text-sm font-semibold py-2">Tipo</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Vencimiento</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Estado</Table.HeadCell>
                  <Table.HeadCell className="text-sm font-semibold py-2">Prioridad</Table.HeadCell>
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
                        <div className="flex items-center gap-1">
                          {getTipoIcon(renovacion.tipoSeguro)}
                          <span className="uppercase text-sm">{tiposSeguro.find(t => t.value === renovacion.tipoSeguro)?.label || renovacion.tipoSeguro}</span>
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
                          color={`light${getEstadoBadge(renovacion.estado)}`}
                          className="capitalize text-xs"
                        >
                          {estadosRenovacion.find(e => e.value === renovacion.estado)?.label || renovacion.estado}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        <Badge
                          color={`light${getPrioridadBadge(renovacion.prioridad)}`}
                          className="capitalize text-xs"
                        >
                          {prioridadRenovacion.find(p => p.value === renovacion.prioridad)?.label || renovacion.prioridad}
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
              <Label htmlFor="prioridad" className="mb-2 block text-gray-900 dark:text-white">Prioridad</Label>
              <select
                id="prioridad"
                value={filters.prioridad || ''}
                onChange={(e) => handleFilterChange('prioridad', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
              >
                <option value="">Todas las prioridades</option>
                {prioridadRenovacion.map((prioridad) => (
                  <option key={prioridad.value} value={prioridad.value}>{prioridad.label}</option>
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
              </select>
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
                prioridad: '',
                agente: '',
                diasVencimiento: '',
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

      {/* Modal de personalización de columnas */}
      <Modal show={showColumnsModal} onClose={() => setShowColumnsModal(false)} size="md">
        <Modal.Header>Personalizar Columnas</Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">Selecciona las columnas que deseas mostrar en la tabla:</p>
            
            {[
              { key: 'numero_poliza', label: 'Número de Póliza' },
              { key: 'cliente', label: 'Cliente' },
              { key: 'aseguradora', label: 'Aseguradora' },
              { key: 'tipo_seguro', label: 'Tipo de Seguro' },
              { key: 'vencimiento', label: 'Vencimiento' },
              { key: 'estado', label: 'Estado' },
              { key: 'prioridad', label: 'Prioridad' },
              { key: 'prima', label: 'Prima' },
            ].map((column) => (
              <div key={column.key} className="flex items-center">
                                 <Checkbox
                   id={`column-${column.key}`}
                   checked={visibleColumns.includes(column.key)}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                     if (e.target.checked) {
                       setVisibleColumns([...visibleColumns, column.key]);
                     } else {
                       setVisibleColumns(visibleColumns.filter(col => col !== column.key));
                     }
                   }}
                 />
                <Label htmlFor={`column-${column.key}`} className="ml-2 text-gray-900 dark:text-white">
                  {column.label}
                </Label>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="primary" onClick={() => setShowColumnsModal(false)}>
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Registrar Contacto */}
      <Modal show={showContactModal} onClose={() => setShowContactModal(false)}>
        <Modal.Header>Registrar Contacto - {selectedRenovacion?.numeroPoliza}</Modal.Header>
        <Modal.Body>
          <form onSubmit={handleRegistrarContactoSubmit} id="contact-form">
            <div className="space-y-4">
              <div>
                <Label htmlFor="tipo_contacto" className="mb-2 block text-gray-900 dark:text-white">Tipo de Contacto</Label>
                <select
                  id="tipo_contacto"
                  name="tipo_contacto"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                  required
                >
                  <option value="llamada">Llamada telefónica</option>
                  <option value="email">Correo electrónico</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="presencial">Visita presencial</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <Label htmlFor="resultado_contacto" className="mb-2 block text-gray-900 dark:text-white">Resultado del Contacto</Label>
                <select
                  id="resultado_contacto"
                  name="resultado_contacto"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                  required
                >
                  <option value="exitoso">Cliente contactado exitosamente</option>
                  <option value="no_disponible">Cliente no disponible</option>
                  <option value="no_contesta">Número no contesta</option>
                  <option value="rebotado">Correo rebotado</option>
                  <option value="solicita_info">Cliente solicita información</option>
                  <option value="no_interesado">Cliente no interesado</option>
                </select>
              </div>
              <div>
                <Label htmlFor="observaciones_contacto" className="mb-2 block text-gray-900 dark:text-white">Observaciones</Label>
                <textarea 
                  id="observaciones_contacto"
                  name="observaciones_contacto"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Detalles del contacto realizado..."
                  required
                />
              </div>
              <div>
                <Label htmlFor="proximo_contacto" className="mb-2 block text-gray-900 dark:text-white">Próximo Contacto</Label>
                <TextInput 
                  type="datetime-local" 
                  id="proximo_contacto" 
                  name="proximo_contacto"
                  className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
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
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="nuevo_numero_poliza" className="mb-2 block text-gray-900 dark:text-white">Nuevo número de póliza (opcional)</Label>
                <TextInput 
                  type="text" 
                  id="nuevo_numero_poliza" 
                  name="nuevo_numero_poliza"
                  placeholder="Ej: POL-2025-0001"
                  className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <Label htmlFor="nueva_fecha" className="mb-2 block text-gray-900 dark:text-white">Nueva Fecha de Vencimiento</Label>
                <TextInput 
                  type="date" 
                  id="nueva_fecha" 
                  name="nueva_fecha"
                  className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={selectedRenovacion ? new Date(new Date(selectedRenovacion.fechaVencimiento).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : ''}
                  required
                />
              </div>
              <div>
                <Label htmlFor="nuevo_valor" className="mb-2 block text-gray-900 dark:text-white">Nuevo Valor Prima</Label>
                <TextInput 
                  type="number" 
                  id="nuevo_valor" 
                  name="nuevo_valor"
                  placeholder="Valor de la prima" 
                  className="bg-white dark:bg-darkgray border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={selectedRenovacion?.valorPrima}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div>
                <Label htmlFor="caratula" className="mb-2 block text-gray-900 dark:text-white">Carátula (PDF, opcional)</Label>
                <input
                  type="file"
                  id="caratula"
                  name="caratula"
                  accept="application/pdf"
                  className="block w-full text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <Label htmlFor="observaciones_renovacion" className="mb-2 block text-gray-900 dark:text-white">Observaciones de Renovación</Label>
                <textarea 
                  id="observaciones_renovacion"
                  name="observaciones_renovacion"
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkgray text-gray-900 dark:text-white"
                  rows={2}
                  placeholder="Notas sobre la renovación..."
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