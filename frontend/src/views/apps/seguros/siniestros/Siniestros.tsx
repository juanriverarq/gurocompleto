import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Badge,
  Table,
  Modal,
  Tabs,
  Timeline,
  Progress,
  Spinner,
  Dropdown,
  Label,
  Checkbox,
} from 'flowbite-react';
import {
  HiPlus,
  HiSearch,
  HiEye,
  HiPencil,
  HiDocumentText,
  HiClock,
  HiCheckCircle,
  HiXCircle,
  HiTrash,
  HiFilter,
  HiAdjustments,
  HiDownload,
} from 'react-icons/hi';
import {
  FaExclamationTriangle,
  FaCar,
  FaHome,
  FaHeartbeat,
  FaShieldAlt,
  FaFileAlt,
} from 'react-icons/fa';
import { IconDots } from '@tabler/icons-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useToast } from 'src/hooks/use-toast';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/shadcn-ui/Default-Ui/select';
import {
  siniestroService,
  Siniestro,
  TIPOS_SEGURO,
  TIPOS_SINIESTRO,
  ESTADOS,
  PRIORIDADES,
} from '../../../../services/siniestroService';
import PermissionGate from 'src/components/PermissionGate';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const estadosSiniestro = [
  { value: 'reportado', label: 'Reportado', color: 'info', icon: HiClock },
  { value: 'en_revision', label: 'En Revisión', color: 'warning', icon: HiEye },
  { value: 'investigacion', label: 'Investigación', color: 'purple', icon: HiSearch },
  { value: 'aprobado', label: 'Aprobado', color: 'success', icon: HiCheckCircle },
  { value: 'rechazado', label: 'Rechazado', color: 'failure', icon: HiXCircle },
  { value: 'pagado', label: 'Pagado', color: 'green', icon: HiCheckCircle },
];

const prioridadesSiniestro = [
  { value: 'baja', label: 'Baja', color: 'gray' },
  { value: 'media', label: 'Media', color: 'yellow' },
  { value: 'alta', label: 'Alta', color: 'orange' },
  { value: 'critica', label: 'Crítica', color: 'red' },
];

const tiposSeguro = [
  { value: 'auto', label: 'Automóvil', icon: FaCar },
  { value: 'hogar', label: 'Hogar', icon: FaHome },
  { value: 'vida', label: 'Vida', icon: FaHeartbeat },
  { value: 'salud', label: 'Salud', icon: FaHeartbeat },
  { value: 'empresarial', label: 'Empresarial', icon: FaShieldAlt },
];

const Siniestros: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useUnifiedAuth();
  const canCreate = hasPermission ? hasPermission('siniestros', 'crear') : false;
  const canEdit = hasPermission ? hasPermission('siniestros', 'editar') : false;
  const canDelete = hasPermission ? hasPermission('siniestros', 'eliminar') : false;
  const [siniestros, setSiniestros] = useState<Siniestro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedSiniestro, setSelectedSiniestro] = useState<Siniestro | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [siniestroToDelete, setSiniestroToDelete] = useState<Siniestro | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [pagination, setPagination] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
  }>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
    from: 0,
    to: 0,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [elementsPerPage, setElementsPerPage] = useState<number>(() => {
    const v = Number(localStorage.getItem('siniestros_page_size') || '15');
    return [15, 25, 50].includes(v) ? v : 15;
  });
  const [showChangeStateModal, setShowChangeStateModal] = useState(false);
  const [newState, setNewState] = useState('');
  const [stateObservation, setStateObservation] = useState('');
  const [changingState, setChangingState] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    search: '',
    tipo: 'todos',
    estado: 'todos',
    prioridad: 'todos',
    sort_by: '',
    sort_dir: '',
    page: 1,
    per_page: Number(localStorage.getItem('siniestros_page_size') || '15'),
  });

  // Debounce de búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: filters.search, page: 1 }));
    }, 400);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  // Persistir tamaño de página
  useEffect(() => {
    localStorage.setItem('siniestros_page_size', String(elementsPerPage));
    setFilters((prev) => ({ ...prev, per_page: elementsPerPage }));
  }, [elementsPerPage]);

  // Columnas visibles
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'numero',
    'cliente',
    'poliza',
    'tipo',
    'estado',
    'prioridad',
  ]);

  const { toast } = useToast();

  // Función para obtener el nombre del cliente del siniestro
  const getClienteNombre = (siniestro: Siniestro): string => {
    if (siniestro.cliente) {
      const firstName = siniestro.cliente.first_name || '';
      const lastName = siniestro.cliente.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || `Cliente ID: ${siniestro.cliente_id}`;
    }
    return `Cliente ID: ${siniestro.cliente_id}`;
  };

  // Cargar datos
  useEffect(() => {
    loadSiniestros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.page,
    filters.per_page,
    filters.search,
    filters.tipo,
    filters.estado,
    filters.prioridad,
    filters.sort_by,
    filters.sort_dir,
  ]);

  // Abrir modal por param open_siniestro_id desde el buscador global
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open_siniestro_id') || params.get('open_claim_id');
    if (openId) {
      if (!showModal || String(selectedSiniestro?.id) !== String(openId)) {
        openSiniestroById(String(openId));
      }
    }
  }, [location.search]);

  const loadSiniestros = async () => {
    try {
      setLoading(true);
      setError(null);
      // Construir parámetros para API
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.tipo && filters.tipo !== 'todos') params.tipo_seguro = filters.tipo;
      if (filters.estado && filters.estado !== 'todos') params.estado = filters.estado;
      if (filters.prioridad && filters.prioridad !== 'todos') params.prioridad = filters.prioridad;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_dir) params.sort_direction = filters.sort_dir as any;
      params.page = filters.page || currentPage || 1;
      params.per_page = filters.per_page || elementsPerPage || 15;

      const response = await siniestroService.getSiniestros(params);
      setSiniestros(Array.isArray(response.data) ? response.data : []);
      setPagination({
        current_page: Number(response.current_page || params.page || 1),
        last_page: Number(response.last_page || 1),
        per_page: Number(params.per_page || 15),
        total: Number(response.total || 0),
        from: Number(
          (response as any).from ||
            (params.page - 1) * params.per_page + ((response.data || []).length ? 1 : 0),
        ),
        to: Number(
          (response as any).to ||
            (params.page - 1) * params.per_page + (response.data || []).length,
        ),
      });
      setCurrentPage(Number(response.current_page || params.page || 1));
    } catch (err) {
      setError('Error al cargar los siniestros');
    } finally {
      setLoading(false);
    }
  };

  // Función para contar filtros activos
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.tipo && filters.tipo !== 'todos') count++;
    if (filters.estado && filters.estado !== 'todos') count++;
    if (filters.prioridad && filters.prioridad !== 'todos') count++;
    return count;
  };

  // Función para limpiar filtros
  const clearFilters = () => {
    setFilters({
      search: '',
      tipo: 'todos',
      estado: 'todos',
      prioridad: 'todos',
      sort_by: '',
      sort_dir: '',
      page: 1,
      per_page: Number(localStorage.getItem('siniestros_page_size') || '15'),
    });
  };

  // Paginación backend
  const totalPages = pagination.last_page || 1;
  const paginatedSiniestros = siniestros;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setFilters((prev) => ({ ...prev, page }));
  };

  // Ordenamiento por columnas (mapear columnas a campos API)
  const columnToApiField: Record<string, string> = {
    numero: 'numero_siniestro',
    cliente: '',
    poliza: 'numero_poliza',
    tipo: 'tipo_seguro',
    siniestro: 'tipo_siniestro',
    estado: 'estado',
    prioridad: 'prioridad',
    fecha: 'fecha_ocurrencia',
    monto: 'monto_reclamado',
  };
  const toggleSort = (columnKey: string) => {
    const apiField = columnToApiField[columnKey];
    if (!apiField) return;
    setFilters((prev) => {
      const isSame = prev.sort_by === apiField;
      const nextDir = isSame ? (prev.sort_dir === 'asc' ? 'desc' : 'asc') : 'asc';
      return { ...prev, sort_by: apiField, sort_dir: nextDir, page: 1 };
    });
  };

  // Definir columnas disponibles
  const availableColumns = [
    {
      key: 'numero',
      label: 'Número',
      description: 'Número de siniestro',
      icon: 'solar:document-text-bold',
      defaultVisible: true,
    },
    {
      key: 'cliente',
      label: 'Cliente',
      description: 'Nombre del cliente',
      icon: 'solar:user-bold',
      defaultVisible: true,
    },
    {
      key: 'poliza',
      label: 'Póliza',
      description: 'Número de póliza',
      icon: 'solar:document-bold',
      defaultVisible: true,
    },
    {
      key: 'tipo',
      label: 'Tipo',
      description: 'Tipo de seguro',
      icon: 'solar:shield-check-bold',
      defaultVisible: true,
    },
    {
      key: 'siniestro',
      label: 'Siniestro',
      description: 'Tipo de siniestro',
      icon: 'solar:danger-bold',
      defaultVisible: false,
    },
    {
      key: 'estado',
      label: 'Estado',
      description: 'Estado actual',
      icon: 'solar:check-circle-bold',
      defaultVisible: true,
    },
    {
      key: 'prioridad',
      label: 'Prioridad',
      description: 'Nivel de prioridad',
      icon: 'solar:flag-bold',
      defaultVisible: true,
    },
    {
      key: 'fecha',
      label: 'Fecha Ocurrencia',
      description: 'Fecha del siniestro',
      icon: 'solar:calendar-bold',
      defaultVisible: false,
    },
    {
      key: 'monto',
      label: 'Monto',
      description: 'Monto reclamado',
      icon: 'solar:dollar-bold',
      defaultVisible: false,
    },
    {
      key: 'progreso',
      label: 'Progreso',
      description: 'Progreso del siniestro',
      icon: 'solar:graph-bold',
      defaultVisible: false,
    },
  ];

  // Estado local para el modal de columnas
  const [localColumns, setLocalColumns] = useState<string[]>(visibleColumns);

  // Sincronizar con props cuando cambien
  useEffect(() => {
    setLocalColumns(visibleColumns);
  }, [visibleColumns]);

  // Funciones para manejo de columnas
  const handleColumnToggle = (columnKey: string) => {
    setLocalColumns((prev) => {
      const isCurrentlyVisible = prev.includes(columnKey);

      if (isCurrentlyVisible) {
        // Remover columna (mínimo 1 columna)
        if (prev.length <= 1) return prev;
        return prev.filter((col) => col !== columnKey);
      } else {
        // Agregar columna solo si no excede el máximo
        if (prev.length >= 6) {
          return prev; // No agregar si ya hay 6
        }
        return [...prev, columnKey];
      }
    });
  };

  const applyColumnChanges = () => {
    setVisibleColumns(localColumns);
    setShowColumnsModal(false);
  };

  const resetColumnsToDefault = () => {
    const defaultColumns = availableColumns
      .filter((col) => col.defaultVisible)
      .map((col) => col.key);
    setLocalColumns(defaultColumns);
  };

  const selectAllColumns = () => {
    const allColumns = availableColumns.slice(0, 6).map((col) => col.key);
    setLocalColumns(allColumns);
  };

  const formatCurrency = (amount: number) => {
    // Verificar si el valor es válido
    if (isNaN(amount) || amount === null || amount === undefined) {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(0);
    }

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getTipoIcon = (tipo: string) => {
    const tipoInfo = tiposSeguro.find((t) => t.value === tipo);
    if (tipoInfo) {
      const IconComponent = tipoInfo.icon;
      return <IconComponent className="w-4 h-4" />;
    }
    return <FaExclamationTriangle className="w-4 h-4" />;
  };

  const getEstadoBadge = (estado: string) => {
    const estadoInfo = estadosSiniestro.find((e) => e.value === estado);
    return estadoInfo ? (estadoInfo.color as any) : 'gray';
  };

  const getPrioridadBadge = (prioridad: string) => {
    const prioridadInfo = prioridadesSiniestro.find((p) => p.value === prioridad);
    return prioridadInfo ? (prioridadInfo.color as any) : 'gray';
  };

  const handleViewSiniestro = (siniestro: Siniestro) => {
    setSelectedSiniestro(siniestro);
    setShowModal(true);
  };

  const handleEditSiniestro = (siniestro: Siniestro) => {
    navigate(`/apps/seguros/siniestros/editar/${siniestro.id}`);
  };

  const handleDeleteSiniestro = (siniestro: Siniestro) => {
    setSiniestroToDelete(siniestro);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!siniestroToDelete) return;

    try {
      setDeleting(true);
      await siniestroService.deleteSiniestro(siniestroToDelete.id);
      setSiniestros((prev) => prev.filter((s) => s.id !== siniestroToDelete.id));
      setShowDeleteModal(false);
      setSiniestroToDelete(null);
    } catch (err) {
      setError('Error al eliminar el siniestro');
    } finally {
      setDeleting(false);
    }
  };

  // Deep-link helpers
  const openSiniestroById = async (id: string) => {
    try {
      const sin = await siniestroService.getSiniestro(Number(id));
      if (sin) {
        setSelectedSiniestro(sin);
        setShowModal(true);
      }
    } catch (e) {
      console.error('Error abriendo siniestro por ID desde query param:', e);
    }
  };

  const handleCloseDetailsModal = () => {
    setShowModal(false);
    try {
      const params = new URLSearchParams(location.search);
      params.delete('open_siniestro_id');
      params.delete('open_claim_id');
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
        { replace: true },
      );
    } catch {}
  };

  const getProgressPercentage = (estado: string) => {
    const estados = ['reportado', 'en_revision', 'investigacion', 'aprobado', 'pagado'];
    const index = estados.indexOf(estado);
    return estado === 'rechazado' ? 100 : ((index + 1) / estados.length) * 100;
  };

  // Función para cambiar estado del siniestro
  const handleChangeState = () => {
    setShowChangeStateModal(true);
  };

  const confirmChangeState = async () => {
    if (!selectedSiniestro || !newState) return;

    try {
      setChangingState(true);
      const updatedSiniestro = await siniestroService.changeState(
        selectedSiniestro.id,
        newState,
        stateObservation,
      );

      // Actualizar el siniestro en la lista
      setSiniestros((prev) =>
        prev.map((s) => (s.id === selectedSiniestro.id ? updatedSiniestro : s)),
      );

      // Actualizar el siniestro seleccionado
      setSelectedSiniestro(updatedSiniestro);

      // Cerrar modal y limpiar estado
      setShowChangeStateModal(false);
      setNewState('');
      setStateObservation('');

      toast({
        title: 'Estado cambiado',
        description: `El siniestro ha sido cambiado a ${(ESTADOS as any)[newState] || newState}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Error al cambiar el estado del siniestro',
        variant: 'destructive',
      });
    } finally {
      setChangingState(false);
    }
  };

  // Función para editar desde la modal
  const handleEditFromModal = () => {
    if (selectedSiniestro) {
      navigate(`/apps/seguros/siniestros/editar/${selectedSiniestro.id}`);
      setShowModal(false);
    }
  };

  const estadisticas = {
    total: siniestros.length,
    reportados: siniestros.filter((s) => s.estado === 'reportado').length,
    enRevision: siniestros.filter((s) => s.estado === 'en_revision').length,
    aprobados: siniestros.filter((s) => s.estado === 'aprobado').length,
    pagados: siniestros.filter((s) => s.estado === 'pagado').length,
    montoTotal: siniestros.reduce((sum, s) => {
      const monto = Number(s.monto_reclamado) || 0;
      return sum + monto;
    }, 0),
    montoAprobado: siniestros.reduce((sum, s) => {
      const monto = Number(s.monto_aprobado) || 0;
      return sum + monto;
    }, 0),
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <Spinner size="xl" />
          <p className="mt-4 text-gray-600">Cargando siniestros...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="p-6 text-center">
            <FaExclamationTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar siniestros</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadSiniestros} color="blue">
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <PermissionGate
      route="/apps/seguros/siniestros"
      action="ver"
      fallback={
        <div className="p-6 text-center text-gray-500">No tienes permisos para ver Siniestros.</div>
      }
    >
      <div className="space-y-6">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-blue-600">{estadisticas.total}</p>
              </div>
              <FaExclamationTriangle className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Reportados</p>
                <p className="text-2xl font-bold text-cyan-600">{estadisticas.reportados}</p>
              </div>
              <HiClock className="w-8 h-8 text-cyan-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Aprobados</p>
                <p className="text-2xl font-bold text-green-600">{estadisticas.aprobados}</p>
              </div>
              <HiCheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pagados</p>
                <p className="text-2xl font-bold text-emerald-600">{estadisticas.pagados}</p>
              </div>
              <HiCheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monto Aprobado</p>
                <p className="text-lg font-bold text-indigo-600">
                  {formatCurrency(estadisticas.montoAprobado)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Header de Controles Rediseñado */}
        <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
          {/* Barra superior con búsqueda y acciones principales */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Búsqueda principal */}
              <div className="flex-1">
                <div className="relative">
                  <Icon
                    icon="solar:magnifer-bold-duotone"
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  />
                  <Input
                    placeholder="Buscar por número de siniestro, cliente o aseguradora..."
                    value={filters.search || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFilters((prev) => ({ ...prev, search: e.target.value }))
                    }
                    className="pl-10 h-10 text-sm rounded-[10px]"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2">
                <Button
                  color="light"
                  onClick={() => loadSiniestros()}
                  disabled={loading}
                  className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                  title="Actualizar"
                >
                  <Icon
                    icon="solar:refresh-bold-duotone"
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  />
                </Button>

                <Button
                  color="light"
                  onClick={() => setShowFilterModal(true)}
                  className="relative h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                  title="Filtros"
                >
                  <Icon icon="solar:filter-bold-duotone" className="w-4 h-4" />
                  {getActiveFiltersCount() > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                      {getActiveFiltersCount()}
                    </div>
                  )}
                </Button>

                <Button
                  color="light"
                  onClick={() => siniestroService.exportarSiniestros(filters, 'excel')}
                  className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                  title="Exportar Siniestros"
                >
                  <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
                </Button>

                <Button
                  color="light"
                  onClick={() => setShowColumnsModal(true)}
                  className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                  title="Personalizar Vista"
                >
                  <Icon icon="solar:settings-bold-duotone" className="w-4 h-4" />
                </Button>

                {canCreate && (
                  <Link to="/apps/seguros/siniestros/nuevo">
                    <HeroButton icon="solar:add-circle-bold-duotone">Nuevo Siniestro</HeroButton>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de Siniestros */}
        <Card>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Spinner size="lg" />
              <span className="ml-2">Cargando siniestros...</span>
            </div>
          ) : siniestros.length === 0 ? (
            <div className="text-center py-8">
              <FaExclamationTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No se encontraron siniestros</p>
              <div className="flex justify-center">
                {canCreate && (
                  <Link to="/apps/seguros/siniestros/nuevo">
                    <HeroButton icon="solar:add-circle-bold" size="lg">Crear primer siniestro</HeroButton>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Vista de tabla para pantallas grandes */}
              <div className="hidden lg:block overflow-x-auto table-container-with-dropdowns">
                <Table hoverable>
                  <Table.Head>
                    {visibleColumns.includes('numero') && (
                      <Table.HeadCell>
                        <div
                          className={`flex items-center gap-1 ${
                            columnToApiField.numero ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={() => toggleSort('numero')}
                        >
                          <span>Número</span>
                          {filters.sort_by === columnToApiField.numero && (
                            <Icon
                              icon={
                                filters.sort_dir === 'asc'
                                  ? 'solar:arrow-up-bold-duotone'
                                  : 'solar:arrow-down-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    )}
                    {visibleColumns.includes('cliente') && <Table.HeadCell>Cliente</Table.HeadCell>}
                    {visibleColumns.includes('poliza') && (
                      <Table.HeadCell>
                        <div
                          className={`flex items-center gap-1 ${
                            columnToApiField.poliza ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={() => toggleSort('poliza')}
                        >
                          <span>Póliza</span>
                          {filters.sort_by === columnToApiField.poliza && (
                            <Icon
                              icon={
                                filters.sort_dir === 'asc'
                                  ? 'solar:arrow-up-bold-duotone'
                                  : 'solar:arrow-down-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    )}
                    {visibleColumns.includes('tipo') && (
                      <Table.HeadCell>
                        <div
                          className={`flex items-center gap-1 ${
                            columnToApiField.tipo ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={() => toggleSort('tipo')}
                        >
                          <span>Tipo</span>
                          {filters.sort_by === columnToApiField.tipo && (
                            <Icon
                              icon={
                                filters.sort_dir === 'asc'
                                  ? 'solar:arrow-up-bold-duotone'
                                  : 'solar:arrow-down-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    )}
                    {visibleColumns.includes('siniestro') && (
                      <Table.HeadCell>
                        <div
                          className={`flex items-center gap-1 ${
                            columnToApiField.siniestro ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={() => toggleSort('siniestro')}
                        >
                          <span>Siniestro</span>
                          {filters.sort_by === columnToApiField.siniestro && (
                            <Icon
                              icon={
                                filters.sort_dir === 'asc'
                                  ? 'solar:arrow-up-bold-duotone'
                                  : 'solar:arrow-down-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    )}
                    {visibleColumns.includes('estado') && (
                      <Table.HeadCell>
                        <div
                          className={`flex items-center gap-1 ${
                            columnToApiField.estado ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={() => toggleSort('estado')}
                        >
                          <span>Estado</span>
                          {filters.sort_by === columnToApiField.estado && (
                            <Icon
                              icon={
                                filters.sort_dir === 'asc'
                                  ? 'solar:arrow-up-bold-duotone'
                                  : 'solar:arrow-down-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    )}
                    {visibleColumns.includes('prioridad') && (
                      <Table.HeadCell>
                        <div
                          className={`flex items-center gap-1 ${
                            columnToApiField.prioridad ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={() => toggleSort('prioridad')}
                        >
                          <span>Prioridad</span>
                          {filters.sort_by === columnToApiField.prioridad && (
                            <Icon
                              icon={
                                filters.sort_dir === 'asc'
                                  ? 'solar:arrow-up-bold-duotone'
                                  : 'solar:arrow-down-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    )}
                    {visibleColumns.includes('fecha') && (
                      <Table.HeadCell>
                        <div
                          className={`flex items-center gap-1 ${
                            columnToApiField.fecha ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={() => toggleSort('fecha')}
                        >
                          <span>Fecha Ocurrencia</span>
                          {filters.sort_by === columnToApiField.fecha && (
                            <Icon
                              icon={
                                filters.sort_dir === 'asc'
                                  ? 'solar:arrow-up-bold-duotone'
                                  : 'solar:arrow-down-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    )}
                    {visibleColumns.includes('monto') && (
                      <Table.HeadCell>
                        <div
                          className={`flex items-center gap-1 ${
                            columnToApiField.monto ? 'cursor-pointer select-none' : ''
                          }`}
                          onClick={() => toggleSort('monto')}
                        >
                          <span>Monto Reclamado</span>
                          {filters.sort_by === columnToApiField.monto && (
                            <Icon
                              icon={
                                filters.sort_dir === 'asc'
                                  ? 'solar:arrow-up-bold-duotone'
                                  : 'solar:arrow-down-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    )}
                    {visibleColumns.includes('progreso') && (
                      <Table.HeadCell>Progreso</Table.HeadCell>
                    )}
                    <Table.HeadCell>Acciones</Table.HeadCell>
                  </Table.Head>
                  <Table.Body className="">
                    {paginatedSiniestros.map((siniestro) => (
                      <Table.Row key={siniestro.id} className="">
                        {visibleColumns.includes('numero') && (
                          <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                            {siniestro.numero_siniestro}
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('cliente') && (
                          <Table.Cell className="whitespace-nowrap">
                            {getClienteNombre(siniestro)}
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('poliza') && (
                          <Table.Cell className="whitespace-nowrap">
                            {siniestro.numero_poliza}
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('tipo') && (
                          <Table.Cell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getTipoIcon(siniestro.tipo_seguro)}
                              <span className="capitalize">
                                {(TIPOS_SEGURO as any)[siniestro.tipo_seguro] ||
                                  siniestro.tipo_seguro}
                              </span>
                            </div>
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('siniestro') && (
                          <Table.Cell className="whitespace-nowrap">
                            {(TIPOS_SINIESTRO as any)[siniestro.tipo_siniestro] ||
                              siniestro.tipo_siniestro}
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('estado') && (
                          <Table.Cell className="whitespace-nowrap">
                            <Badge color={getEstadoBadge(siniestro.estado)} className="capitalize">
                              {(ESTADOS as any)[siniestro.estado] ||
                                siniestro.estado.replace('_', ' ')}
                            </Badge>
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('prioridad') && (
                          <Table.Cell className="whitespace-nowrap">
                            <Badge
                              color={getPrioridadBadge(siniestro.prioridad)}
                              className="capitalize"
                            >
                              {(PRIORIDADES as any)[siniestro.prioridad] || siniestro.prioridad}
                            </Badge>
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('fecha') && (
                          <Table.Cell className="whitespace-nowrap">
                            {new Date(siniestro.fecha_ocurrencia).toLocaleDateString('es-CO')}
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('monto') && (
                          <Table.Cell className="whitespace-nowrap">
                            {formatCurrency(siniestro.monto_reclamado)}
                          </Table.Cell>
                        )}
                        {visibleColumns.includes('progreso') && (
                          <Table.Cell className="whitespace-nowrap">
                            <div className="w-24">
                              <Progress
                                progress={getProgressPercentage(siniestro.estado)}
                                size="sm"
                                color={siniestro.estado === 'rechazado' ? 'red' : 'blue'}
                              />
                            </div>
                          </Table.Cell>
                        )}
                        <Table.Cell className="whitespace-nowrap">
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
                              className="flex gap-3"
                              onClick={() => handleViewSiniestro(siniestro)}
                            >
                              <Icon icon="solar:eye-bold-duotone" height={18} />
                              <span>Ver Detalles</span>
                            </Dropdown.Item>
                            {canEdit && (
                              <Dropdown.Item
                                className="flex gap-3"
                                onClick={() => handleEditSiniestro(siniestro)}
                              >
                                <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                                <span>Editar</span>
                              </Dropdown.Item>
                            )}
                            {canDelete && (
                              <Dropdown.Item
                                className="flex gap-3 text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteSiniestro(siniestro)}
                              >
                                <Icon
                                  icon="solar:trash-bin-minimalistic-bold-duotone"
                                  height={18}
                                />
                                <span>Eliminar</span>
                              </Dropdown.Item>
                            )}
                          </Dropdown>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>

              {/* Vista de cards para tablets y móviles */}
              <div className="lg:hidden space-y-4">
                {paginatedSiniestros.map((siniestro) => (
                  <Card key={siniestro.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getTipoIcon(siniestro.tipo_seguro)}
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {siniestro.numero_siniestro}
                          </h3>
                          <p className="text-sm text-gray-500">{siniestro.aseguradora}</p>
                        </div>
                      </div>
                      <Badge color={getEstadoBadge(siniestro.estado)} className="capitalize">
                        {(ESTADOS as any)[siniestro.estado] || siniestro.estado.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Cliente</p>
                        <p className="text-sm font-medium">{getClienteNombre(siniestro)}</p>
                        <p className="text-xs text-gray-500">{siniestro.numero_poliza}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Tipo</p>
                        <div className="flex items-center gap-2">
                          {getTipoIcon(siniestro.tipo_seguro)}
                          <span className="text-sm">
                            {(TIPOS_SEGURO as any)[siniestro.tipo_seguro] || siniestro.tipo_seguro}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Monto Reclamado</p>
                        <p className="text-sm font-medium">
                          {formatCurrency(siniestro.monto_reclamado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Prioridad</p>
                        <Badge
                          color={getPrioridadBadge(siniestro.prioridad)}
                          className="capitalize"
                        >
                          {(PRIORIDADES as any)[siniestro.prioridad] || siniestro.prioridad}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4" />
                        <span>
                          Reportado: {new Date(siniestro.fecha_reporte).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                      <Dropdown
                        label=""
                        dismissOnClick={false}
                        placement="left-start"
                        className="z-50"
                        renderTrigger={() => (
                          <span className="h-8 w-8 flex justify-center items-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <IconDots size={18} />
                          </span>
                        )}
                      >
                        <Dropdown.Item
                          className="flex gap-3"
                          onClick={() => handleViewSiniestro(siniestro)}
                        >
                          <Icon icon="solar:eye-bold" height={16} />
                          <span>Ver Detalles</span>
                        </Dropdown.Item>
                        {canEdit && (
                          <Dropdown.Item
                            className="flex gap-3"
                            onClick={() => handleEditSiniestro(siniestro)}
                          >
                            <Icon icon="solar:pen-new-square-broken" height={16} />
                            <span>Editar</span>
                          </Dropdown.Item>
                        )}
                        {canDelete && (
                          <Dropdown.Item
                            className="flex gap-3 text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteSiniestro(siniestro)}
                          >
                            <Icon icon="solar:trash-bin-minimalistic-outline" height={16} />
                            <span>Eliminar</span>
                          </Dropdown.Item>
                        )}
                      </Dropdown>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Paginación (backend), consistente con Clientes */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando {pagination.from || 0} a {pagination.to || 0} de {pagination.total || 0}{' '}
                  siniestros
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span>Por página:</span>
                    <select
                      className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray"
                      value={elementsPerPage}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setElementsPerPage(val);
                        setFilters((prev) => ({ ...prev, per_page: val, page: 1 }));
                      }}
                    >
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={pagination.current_page <= 1}
                    onClick={() =>
                      handlePageChange(Math.max(1, (pagination.current_page || 1) - 1))
                    }
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {pagination.current_page || 1} de {pagination.last_page || 1}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={(pagination.current_page || 1) >= (pagination.last_page || 1)}
                    onClick={() =>
                      handlePageChange(
                        Math.min(pagination.last_page || 1, (pagination.current_page || 1) + 1),
                      )
                    }
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Modal de Detalle */}
        <Modal show={showModal} onClose={handleCloseDetailsModal} size="5xl">
          <Modal.Header>Detalle de Siniestro - {selectedSiniestro?.numero_siniestro}</Modal.Header>
          <Modal.Body>
            {selectedSiniestro && (
              <Tabs>
                <Tabs.Item title="Información General" active>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Datos del Siniestro</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Número:</span>
                          <span className="font-medium">{selectedSiniestro.numero_siniestro}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Póliza:</span>
                          <span className="font-medium">{selectedSiniestro.numero_poliza}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tipo de Siniestro:</span>
                          <span className="font-medium">
                            {(TIPOS_SINIESTRO as any)[selectedSiniestro.tipo_siniestro] ||
                              selectedSiniestro.tipo_siniestro}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Estado:</span>
                          <Badge
                            color={getEstadoBadge(selectedSiniestro.estado)}
                            className="capitalize"
                          >
                            {(ESTADOS as any)[selectedSiniestro.estado] ||
                              selectedSiniestro.estado.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prioridad:</span>
                          <Badge
                            color={getPrioridadBadge(selectedSiniestro.prioridad)}
                            className="capitalize"
                          >
                            {(PRIORIDADES as any)[selectedSiniestro.prioridad] ||
                              selectedSiniestro.prioridad}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fecha Ocurrencia:</span>
                          <span className="font-medium">
                            {new Date(selectedSiniestro.fecha_ocurrencia).toLocaleDateString(
                              'es-CO',
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fecha Reporte:</span>
                          <span className="font-medium">
                            {new Date(selectedSiniestro.fecha_reporte).toLocaleDateString('es-CO')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Información Financiera</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Monto Reclamado:</span>
                          <span className="font-medium">
                            {formatCurrency(selectedSiniestro.monto_reclamado)}
                          </span>
                        </div>
                        {selectedSiniestro.monto_aprobado && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Monto Aprobado:</span>
                            <span className="font-medium">
                              {formatCurrency(selectedSiniestro.monto_aprobado)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Aseguradora:</span>
                          <span className="font-medium">{selectedSiniestro.aseguradora}</span>
                        </div>
                        {selectedSiniestro.assigned_adjuster && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Ajustador:</span>
                            <span className="font-medium">
                              {selectedSiniestro.assigned_adjuster.name}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Lugar:</span>
                          <span className="font-medium">{selectedSiniestro.lugar_ocurrencia}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Días Trámite:</span>
                          <span className="font-medium">
                            {selectedSiniestro.dias_tramite || 0} días
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Descripción</h4>
                    <p className="text-gray-600">{selectedSiniestro.descripcion_evento}</p>
                  </div>
                </Tabs.Item>

                <Tabs.Item title="Cliente">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Información Personal</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Nombre Completo:</span>
                          <span className="font-medium">{getClienteNombre(selectedSiniestro)}</span>
                        </div>
                        {selectedSiniestro.cliente?.email && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium">{selectedSiniestro.cliente.email}</span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.phone && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Teléfono:</span>
                            <span className="font-medium">{selectedSiniestro.cliente.phone}</span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.mobile_phone && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Móvil:</span>
                            <span className="font-medium">
                              {selectedSiniestro.cliente.mobile_phone}
                            </span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.document_number && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Documento:</span>
                            <span className="font-medium">
                              {selectedSiniestro.cliente.document_type}{' '}
                              {selectedSiniestro.cliente.document_number}
                            </span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.birth_date && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fecha Nacimiento:</span>
                            <span className="font-medium">
                              {new Date(selectedSiniestro.cliente.birth_date).toLocaleDateString(
                                'es-CO',
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Información de Contacto</h4>
                      <div className="space-y-2">
                        {selectedSiniestro.cliente?.address && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Dirección:</span>
                            <span className="font-medium">{selectedSiniestro.cliente.address}</span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.city && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Ciudad:</span>
                            <span className="font-medium">{selectedSiniestro.cliente.city}</span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.state && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Estado/Departamento:</span>
                            <span className="font-medium">{selectedSiniestro.cliente.state}</span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.country && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">País:</span>
                            <span className="font-medium">{selectedSiniestro.cliente.country}</span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.emergency_contact_name && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Contacto Emergencia:</span>
                            <span className="font-medium">
                              {selectedSiniestro.cliente.emergency_contact_name}
                            </span>
                          </div>
                        )}
                        {selectedSiniestro.cliente?.emergency_contact_phone && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tel. Emergencia:</span>
                            <span className="font-medium">
                              {selectedSiniestro.cliente.emergency_contact_phone}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedSiniestro.cliente?.company && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Información Laboral</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Empresa:</span>
                            <span className="font-medium">{selectedSiniestro.cliente.company}</span>
                          </div>
                          {selectedSiniestro.cliente?.occupation && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Ocupación:</span>
                              <span className="font-medium">
                                {selectedSiniestro.cliente.occupation}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {selectedSiniestro.cliente?.work_address && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Dirección Trabajo:</span>
                              <span className="font-medium">
                                {selectedSiniestro.cliente.work_address}
                              </span>
                            </div>
                          )}
                          {selectedSiniestro.cliente?.monthly_income && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Ingresos Mensuales:</span>
                              <span className="font-medium">
                                {formatCurrency(selectedSiniestro.cliente.monthly_income)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Tabs.Item>
                <Tabs.Item title="Seguimiento">
                  <Timeline>
                    <Timeline.Item>
                      <Timeline.Point icon={HiClock} />
                      <Timeline.Content>
                        <Timeline.Time>
                          {new Date(selectedSiniestro.fecha_reporte).toLocaleDateString('es-CO')}
                        </Timeline.Time>
                        <Timeline.Title>Siniestro Reportado</Timeline.Title>
                        <Timeline.Body>
                          El siniestro fue reportado por el cliente{' '}
                          {getClienteNombre(selectedSiniestro)}
                        </Timeline.Body>
                      </Timeline.Content>
                    </Timeline.Item>
                    {selectedSiniestro.estado !== 'reportado' && (
                      <Timeline.Item>
                        <Timeline.Point icon={HiEye} />
                        <Timeline.Content>
                          <Timeline.Title>En Revisión</Timeline.Title>
                          <Timeline.Body>
                            El siniestro está siendo revisado por el equipo de ajuste
                          </Timeline.Body>
                        </Timeline.Content>
                      </Timeline.Item>
                    )}
                    {['investigacion', 'aprobado', 'pagado'].includes(selectedSiniestro.estado) && (
                      <Timeline.Item>
                        <Timeline.Point icon={HiSearch} />
                        <Timeline.Content>
                          <Timeline.Title>Investigación</Timeline.Title>
                          <Timeline.Body>
                            Se está realizando la investigación del siniestro
                          </Timeline.Body>
                        </Timeline.Content>
                      </Timeline.Item>
                    )}
                    {['aprobado', 'pagado'].includes(selectedSiniestro.estado) && (
                      <Timeline.Item>
                        <Timeline.Point icon={HiCheckCircle} />
                        <Timeline.Content>
                          <Timeline.Title>Aprobado</Timeline.Title>
                          <Timeline.Body>
                            El siniestro ha sido aprobado por un monto de{' '}
                            {formatCurrency(selectedSiniestro.monto_aprobado || 0)}
                          </Timeline.Body>
                        </Timeline.Content>
                      </Timeline.Item>
                    )}
                    {selectedSiniestro.estado === 'pagado' && (
                      <Timeline.Item>
                        <Timeline.Point icon={HiCheckCircle} />
                        <Timeline.Content>
                          <Timeline.Title>Pagado</Timeline.Title>
                          <Timeline.Body>El pago ha sido procesado exitosamente</Timeline.Body>
                        </Timeline.Content>
                      </Timeline.Item>
                    )}
                    {selectedSiniestro.estado === 'rechazado' && (
                      <Timeline.Item>
                        <Timeline.Point icon={HiXCircle} />
                        <Timeline.Content>
                          <Timeline.Title>Rechazado</Timeline.Title>
                          <Timeline.Body>El siniestro ha sido rechazado</Timeline.Body>
                        </Timeline.Content>
                      </Timeline.Item>
                    )}
                  </Timeline>
                </Tabs.Item>
                <Tabs.Item title="Documentos">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-gray-900">Documentos Adjuntos</h4>
                      <Button size="sm" color="blue">
                        <HiPlus className="w-4 h-4 mr-2" />
                        Subir Documento
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.from({ length: selectedSiniestro.total_documentos }, (_, i) => (
                        <div key={i} className="flex items-center p-3 border rounded-lg">
                          <FaFileAlt className="w-8 h-8 text-blue-500 mr-3" />
                          <div className="flex-1">
                            <p className="font-medium">Documento {i + 1}</p>
                            <p className="text-sm text-gray-500">Subido hace 2 días</p>
                          </div>
                          <Button size="xs" color="gray">
                            Ver
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </Tabs.Item>
              </Tabs>
            )}
          </Modal.Body>
          <Modal.Footer>
            {canEdit && (
              <Button color="blue" onClick={handleEditFromModal}>
                <HiPencil className="w-4 h-4 mr-2" />
                Editar Siniestro
              </Button>
            )}
            <Button color="green" onClick={handleChangeState}>
              <HiAdjustments className="w-4 h-4 mr-2" />
              Cambiar Estado
            </Button>
            <Button color="gray" onClick={handleCloseDetailsModal}>
              <HiXCircle className="w-4 h-4 mr-2" />
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Eliminación */}
        <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} size="sm">
          <Modal.Header>Eliminar Siniestro</Modal.Header>
          <Modal.Body>
            <p>¿Estás seguro de que quieres eliminar este siniestro?</p>
          </Modal.Body>
          <Modal.Footer>
            <Button color="gray" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Filtros Avanzados */}
        <Modal show={showFilterModal} onClose={() => setShowFilterModal(false)} size="lg">
          <Modal.Header>
            <Icon icon="solar:filter-bold-duotone" className="w-5 h-5 mr-2" />
            Filtros Avanzados
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900 dark:text-white mb-2 block font-medium">
                    Tipo de Seguro
                  </Label>
                  <Select
                    value={filters.tipo}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, tipo: value }))}
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los tipos</SelectItem>
                      {tiposSeguro.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-900 dark:text-white mb-2 block font-medium">
                    Estado
                  </Label>
                  <Select
                    value={filters.estado}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, estado: value }))}
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los estados</SelectItem>
                      {estadosSiniestro.map((estado) => (
                        <SelectItem key={estado.value} value={estado.value}>
                          {estado.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-900 dark:text-white mb-2 block font-medium">
                    Prioridad
                  </Label>
                  <Select
                    value={filters.prioridad}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, prioridad: value }))}
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                      <SelectValue placeholder="Seleccionar prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas las prioridades</SelectItem>
                      {prioridadesSiniestro.map((prioridad) => (
                        <SelectItem key={prioridad.value} value={prioridad.value}>
                          {prioridad.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Filtros activos: {getActiveFiltersCount()}
                  </span>
                </div>
                <Button size="sm" color="gray" onClick={clearFilters}>
                  <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
                  Limpiar Todo
                </Button>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button color="gray" onClick={() => setShowFilterModal(false)}>
              Cancelar
            </Button>
            <Button color="blue" onClick={() => setShowFilterModal(false)}>
              <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mr-2" />
              Aplicar Filtros
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Personalización de Columnas */}
        <Modal show={showColumnsModal} onClose={() => setShowColumnsModal(false)} size="xl" popup>
          <Modal.Header className="px-6 pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Icon
                    icon="solar:settings-bold"
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Personalizar Columnas
                  </h3>
                  <p className="text-xs text-gray-500">
                    Selecciona las columnas que deseas ver en la tabla
                  </p>
                </div>
              </div>
              <Badge color="info" size="sm" className="ml-3">
                {localColumns.length}/6
              </Badge>
            </div>
          </Modal.Header>

          <Modal.Body className="px-6 pb-6">
            <div className="space-y-4">
              {/* Controles rápidos */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
                    Máximo 6 columnas
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      size="xs"
                      color="light"
                      onClick={resetColumnsToDefault}
                      className="text-xs px-2 py-1"
                    >
                      <Icon icon="solar:refresh-bold" className="w-3 h-3" />
                    </Button>
                    <Button
                      size="xs"
                      color="blue"
                      onClick={selectAllColumns}
                      disabled={localColumns.length === 6}
                      className="text-xs px-2 py-1"
                    >
                      <Icon icon="solar:check-square-bold" className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista de columnas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableColumns.map((column) => {
                  const isVisible = localColumns.includes(column.key);
                  const canToggle = !isVisible || localColumns.length > 1;
                  const canAdd = isVisible || localColumns.length < 6;
                  const isDisabled = !canToggle || !canAdd;

                  return (
                    <div
                      key={column.key}
                      className={`relative p-3 border-2 rounded-lg transition-all duration-200 cursor-pointer ${
                        isVisible
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !isDisabled && handleColumnToggle(column.key)}
                    >
                      {/* Badge de posición si está visible */}
                      {isVisible && (
                        <div className="absolute -top-2 -right-2">
                          <Badge color="blue" size="sm" className="font-bold">
                            {localColumns.indexOf(column.key) + 1}
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1">
                          <div
                            className={`p-1.5 rounded-md ${
                              isVisible
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                            }`}
                          >
                            <Icon icon={column.icon} className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <h4
                              className={`text-sm font-semibold ${
                                isVisible
                                  ? 'text-blue-900 dark:text-blue-200'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {column.label}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {column.description}
                            </p>
                            {column.defaultVisible && (
                              <Badge color="gray" size="xs" className="mt-1">
                                Recomendada
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="ml-2">
                          <Checkbox
                            checked={isVisible}
                            onChange={() => !isDisabled && handleColumnToggle(column.key)}
                            disabled={isDisabled}
                            className="scale-110"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vista previa del orden */}
              {localColumns.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <Icon icon="solar:eye-bold" className="w-4 h-4" />
                    Vista Previa del Orden
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {localColumns.map((columnKey, index) => {
                      const column = availableColumns.find((col) => col.key === columnKey);
                      return (
                        <div
                          key={columnKey}
                          className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-2 rounded-lg border"
                        >
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                            {index + 1}
                          </span>
                          <Icon icon={column?.icon || 'solar:question-bold'} className="w-4 h-4" />
                          <span className="text-sm font-medium">{column?.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={applyColumnChanges}
                  className="flex-1"
                  color="primary"
                  disabled={localColumns.length === 0}
                >
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
                  Aplicar Cambios
                </Button>
                <Button onClick={() => setShowColumnsModal(false)} className="flex-1" color="light">
                  <Icon icon="solar:close-circle-bold" className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>

        {/* Modal para Cambiar Estado */}
        <Modal show={showChangeStateModal} onClose={() => setShowChangeStateModal(false)} size="md">
          <Modal.Header>
            <Icon icon="solar:settings-bold-duotone" className="w-5 h-5 mr-2" />
            Cambiar Estado del Siniestro
          </Modal.Header>
          <Modal.Body>
            {selectedSiniestro && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Siniestro: {selectedSiniestro.numero_siniestro}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>Estado actual:</span>
                    <Badge color={getEstadoBadge(selectedSiniestro.estado)} className="capitalize">
                      {(ESTADOS as any)[selectedSiniestro.estado] ||
                        selectedSiniestro.estado.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-900 dark:text-white mb-2 block font-medium">
                    Nuevo Estado
                  </Label>
                  <Select value={newState} onValueChange={setNewState}>
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                      <SelectValue placeholder="Seleccionar nuevo estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosSiniestro.map((estado) => (
                        <SelectItem key={estado.value} value={estado.value}>
                          <div className="flex items-center gap-2">
                            <estado.icon className="w-4 h-4" />
                            {estado.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-900 dark:text-white mb-2 block font-medium">
                    Observación (Opcional)
                  </Label>
                  <textarea
                    value={stateObservation}
                    onChange={(e) => setStateObservation(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    rows={3}
                    placeholder="Ingresa una observación sobre el cambio de estado..."
                  />
                </div>

                {newState && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-200">
                      <Icon icon="solar:info-circle-bold" className="w-4 h-4" />
                      <span>
                        El estado cambiará de{' '}
                        <strong>
                          {(ESTADOS as any)[selectedSiniestro.estado] ||
                            selectedSiniestro.estado.replace('_', ' ')}
                        </strong>{' '}
                        a{' '}
                        <strong>{(ESTADOS as any)[newState] || newState.replace('_', ' ')}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              color="green"
              onClick={confirmChangeState}
              disabled={!newState || changingState}
            >
              {changingState ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Cambiando...
                </>
              ) : (
                <>
                  <HiCheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Cambio
                </>
              )}
            </Button>
            <Button
              color="gray"
              onClick={() => {
                setShowChangeStateModal(false);
                setNewState('');
                setStateObservation('');
              }}
            >
              <HiXCircle className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </PermissionGate>
  );
};

export default Siniestros;
