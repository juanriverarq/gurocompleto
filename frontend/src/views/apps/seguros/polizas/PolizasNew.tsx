import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Table, Dropdown, TextInput, Label, Spinner, Badge } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { IconDots } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from 'src/hooks/use-toast';
import ColumnsCustomizationModal from './components/ColumnsCustomizationModal';
import { polizaService } from 'src/services/polizaService';


// Tipos básicos (adaptados a los datos reales del backend)
interface Poliza {
  id: string;
  numero_poliza: string;
  nombres_cliente: string;
  apellidos_cliente?: string;
  dni_cliente?: string;
  ramo_principal: string;
  prima_neta: number;
  estado: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA' | 'PENDIENTE';
  fecha_fin: string;
  aseguradora?: string;
  vendedor?: string;
  sede?: string;
  // Campos adicionales para retrocompatibilidad
  cliente_nombre?: string;
  tipo_seguro?: string;
  prima?: number;
  fecha_vencimiento?: string;
  forma_pago?: string; // Nuevo campo para forma de pago
}

// Estados permitidos para cambio vía servicio
type EstadoCambio = 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA';

interface PolizaFilters {
  search?: string;
  aseguradora?: string;
  ramo?: string;
  estado?: string;
  vendedor?: string;
  sede?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  per_page?: number;
  page?: number;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
}

const PolizasNew: React.FC = () => {
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPoliza, setSelectedPoliza] = useState<Poliza | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [polizaToDelete, setPolizaToDelete] = useState<Poliza | null>(null);
  const [showChangeStateModal, setShowChangeStateModal] = useState(false);
  const [newEstado, setNewEstado] = useState<EstadoCambio | ''>('');
  const [motivoCambio, setMotivoCambio] = useState('');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewFechaFin, setRenewFechaFin] = useState('');

  // Estados para filtros y columnas
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([
    'numero_poliza', 'cliente', 'aseguradora', 'ramo', 'estado', 'prima_neta'
  ]);

  const { toast } = useToast();
  const navigate = useNavigate();

  // Filtros
  const [filters, setFilters] = useState<PolizaFilters>({
    search: '',
    aseguradora: '',
    ramo: '',
    estado: '',
    vendedor: '',
    sede: '',
    fecha_inicio: '',
    fecha_fin: '',
    per_page: 15,
    page: 1,
    sort_field: 'created_at',
    sort_direction: 'desc'
  });

  // Handler para cambio de columnas visibles
  const handleVisibleColumnsChange = (columns: string[]) => {
    setVisibleColumns(columns);
    // Opcionalmente guardar en localStorage para persistencia
    localStorage.setItem('polizas_visible_columns', JSON.stringify(columns));
  };

  // Cargar columnas desde localStorage al inicializar
  useEffect(() => {
    const savedColumns = localStorage.getItem('polizas_visible_columns');
    if (savedColumns) {
      try {
        const parsedColumns = JSON.parse(savedColumns);
        if (Array.isArray(parsedColumns) && parsedColumns.length > 0) {
          setVisibleColumns(parsedColumns);
        }
      } catch (error) {
      }
    }
  }, []);

  // Preferencia: per_page persistido en localStorage
  useEffect(() => {
    const savedPerPage = localStorage.getItem('polizas_per_page');
    if (savedPerPage) {
      const n = parseInt(savedPerPage);
      if ([10, 15, 25, 50, 100].includes(n)) {
        setFilters(prev => ({ ...prev, per_page: n, page: 1 }));
      }
    }
  }, []);

  useEffect(() => {
    if (filters.per_page) {
      localStorage.setItem('polizas_per_page', String(filters.per_page));
    }
  }, [filters.per_page]);

  

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

  const estadosPoliza = [
    { value: 'ACTIVA', label: 'Activa', color: 'success' },
    { value: 'VENCIDA', label: 'Vencida', color: 'warning' },
    { value: 'CANCELADA', label: 'Cancelada', color: 'failure' },
    { value: 'SUSPENDIDA', label: 'Suspendida', color: 'gray' }
  ];

  // Cargar pólizas desde la API real con filtros
  const loadPolizas = async (currentFilters = filters) => {
    try {
      setLoading(true);
      // Usar servicio centralizado (maneja headers y errores)
      const res = await polizaService.getPolizas(currentFilters as any);
      const payload: any = res.data || {};
      // Soportar respuesta paginada estándar {data, current_page, ...}
      if (Array.isArray(payload)) {
        // En caso de backend retornando array plano (sin paginación)
        setPolizas(payload);
        setPagination({
          current_page: 1,
          last_page: 1,
          per_page: payload.length,
          total: payload.length,
          from: payload.length > 0 ? 1 : 0,
          to: payload.length,
        });
      } else {
        setPolizas(payload.data || []);
        setPagination({
          current_page: payload.current_page || 1,
          last_page: payload.last_page || 1,
          per_page: payload.per_page || (payload.data ? payload.data.length : 15),
          total: payload.total || (payload.data ? payload.data.length : 0),
          from: payload.from || (payload.data && payload.data.length ? 1 : 0),
          to: payload.to || (payload.data ? payload.data.length : 0),
        });
      }
    } catch (error) {
      setPolizas([]);
      setPagination({
        current_page: 1,
        last_page: 1,
        per_page: 15,
        total: 0,
        from: 0,
        to: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas
  const loadEstadisticas = async () => {
    try {
      const res = await polizaService.getEstadisticas();
      if (res.success) {
        setEstadisticas(res.data);
      }
    } catch (error) {
      setEstadisticas({
        total_polizas: 3,
        polizas_activas: 2,
        polizas_vencidas: 0,
        polizas_por_vencer: 1,
        valor_total_primas: 150000
      });
    }
  };

  // Efecto inicial para cargar datos
  useEffect(() => {
    loadPolizas();
    loadEstadisticas();
  }, []);

  // Efecto para recargar cuando cambien los filtros (con debounce para search)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPolizas();
    }, filters.search ? 500 : 0); // 500ms de debounce para búsqueda, inmediato para otros filtros

    return () => clearTimeout(timer);
  }, [filters]);

  // Handlers
  const handleFilterChange = (key: keyof PolizaFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value
    }));
  };

  const handleViewPoliza = (poliza: Poliza) => {
    setSelectedPoliza(poliza);
    setShowModal(true);
  };

  const handleDeletePoliza = (poliza: Poliza) => {
    setPolizaToDelete(poliza);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!polizaToDelete) return;

    try {
      await polizaService.deletePoliza(polizaToDelete.id!);
      await loadPolizas();
      await loadEstadisticas();
      setShowDeleteModal(false);
      setPolizaToDelete(null);
      toast({
        title: "Póliza eliminada",
        description: "La póliza ha sido eliminada exitosamente.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar la póliza.",
      });
    }
  };

  // Función para renderizar celda según la columna
  const renderTableCell = (poliza: Poliza, columnKey: string) => {
    switch (columnKey) {
      case 'numero_poliza':
        return (
          <div className="flex items-center gap-2">
            {getTipoIcon(poliza.ramo_principal)}
            {poliza.numero_poliza}
          </div>
        );
      case 'cliente':
        return (
          <div>
            <div className="font-medium">{poliza.nombres_cliente} {poliza.apellidos_cliente}</div>
            <div className="text-sm text-gray-500">{poliza.dni_cliente}</div>
          </div>
        );
      case 'aseguradora':
        return (poliza as any).aseguradora_nombre || poliza.aseguradora;
      case 'ramo':
        return (
          <div className="flex items-center gap-2">
            {getTipoIcon(poliza.ramo_principal)}
            {(poliza as any).ramo_nombre || tiposSeguro.find(t => t.value === poliza.ramo_principal)?.label || poliza.ramo_principal}
          </div>
        );
      case 'estado':
        return (
          <Badge color={`light${getEstadoBadge(poliza.estado)}`} className="capitalize text-xs">
            {poliza.estado}
          </Badge>
        );
      case 'prima_neta':
        return (
          <span className="font-medium">
            {formatCurrency(poliza.prima_neta || 0)}
          </span>
        );
      case 'vencimiento':
        return (
          <div>
            <div className="text-sm">{poliza.fecha_fin ? new Date(poliza.fecha_fin).toLocaleDateString('es-CO') : 'Sin fecha'}</div>
            <div className={`text-xs ${getColorVencimiento(poliza)}`}>
              {getDiasVencimiento(poliza)}
            </div>
          </div>
        );
      case 'vendedor':
        return poliza.vendedor || '-';
      case 'sede':
        return poliza.sede || '-';
      case 'forma_pago':
        return poliza.forma_pago || '-';
      default:
        return '-';
    }
  };

  // Función para obtener el nombre de la columna
  const getColumnName = (columnKey: string) => {
    const columnMap: Record<string, string> = {
      numero_poliza: 'Número',
      cliente: 'Cliente',
      aseguradora: 'Aseguradora',
      ramo: 'Ramo',
      estado: 'Estado',
      prima_neta: 'Prima Neta',
      vencimiento: 'Vencimiento',
      vendedor: 'Vendedor',
      sede: 'Sede',
      forma_pago: 'Forma de Pago'
    };
    return columnMap[columnKey] || columnKey;
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
    const estadoInfo = estadosPoliza.find(e => e.value === estado);
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

  const getDiasVencimiento = (poliza: Poliza) => {
    const hoy = new Date();
    const fechaVenc = poliza.fecha_fin || poliza.fecha_vencimiento || '';
    if (!fechaVenc) return 'Sin fecha';
    
    const vencimiento = new Date(fechaVenc);
    const diferencia = vencimiento.getTime() - hoy.getTime();
    const dias = Math.ceil(diferencia / (1000 * 3600 * 24));
    
    if (dias < 0) return 'Vencida';
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    if (dias <= 30) return `${dias} días`;
    return `${Math.ceil(dias / 30)} meses`;
  };

  const getColorVencimiento = (poliza: Poliza) => {
    const hoy = new Date();
    const fechaVenc = poliza.fecha_fin || poliza.fecha_vencimiento || '';
    if (!fechaVenc) return 'text-gray-600';
    
    const vencimiento = new Date(fechaVenc);
    const diferencia = vencimiento.getTime() - hoy.getTime();
    const dias = Math.ceil(diferencia / (1000 * 3600 * 24));
    
    if (dias < 0) return 'text-red-600';
    if (dias <= 30) return 'text-orange-600';
    return 'text-green-600';
  };

  // Navegación de páginas con límites
  const goToPage = (page: number) => {
    if (!pagination) return;
    const target = Math.max(1, Math.min(page, pagination.last_page || 1));
    handleFilterChange('page', target);
  };

  // Renderiza botones de páginas con elipsis: 1 … prev current next … last
  const renderPageButtons = () => {
    if (!pagination) return null;
    const current = pagination.current_page || 1;
    const last = pagination.last_page || 1;
    const pages: (number | 'ellipsis')[] = [];

    const pushUnique = (v: number | 'ellipsis') => {
      if (pages.length === 0 || pages[pages.length - 1] !== v) pages.push(v);
    };

    // Siempre incluir primera página
    pushUnique(1);

    // Ventana alrededor de la actual
    const windowSize = 1; // muestra current-1, current, current+1
    let start = Math.max(2, current - windowSize);
    let end = Math.min(last - 1, current + windowSize);

    // Elipsis después de 1 si hay gap
    if (start > 2) pushUnique('ellipsis');

    // Rango centrado
    for (let p = start; p <= end; p++) pushUnique(p);

    // Elipsis antes del último si hay gap
    if (end < last - 1) pushUnique('ellipsis');

    // Siempre incluir última página si > 1
    if (last > 1) pushUnique(last);

    return (
      <div className="flex items-center gap-1">
        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`el-${idx}`} className="px-2 text-gray-500">…</span>
          ) : (
            <Button
              key={p}
              size="sm"
              color={p === current ? 'primary' : 'light'}
              onClick={() => goToPage(p)}
              className={`rounded-[10px] ${p === current ? 'text-white' : ''}`}
            >
              {p}
            </Button>
          )
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Pólizas</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">{estadisticas.total_polizas || 0}</p>
              </div>
              <Icon icon="solar:document-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Activas</p>
                <p className="text-lg md:text-2xl font-bold text-green-600">{estadisticas.polizas_activas || 0}</p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </Card>
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Por Vencer</p>
                <p className="text-lg md:text-2xl font-bold text-orange-600">{estadisticas.polizas_por_vencer || 0}</p>
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
                  {formatCurrency(estadisticas.valor_total_primas || 0)}
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
                <p className="text-xs md:text-sm font-medium text-gray-600">Vencidas</p>
                <p className="text-lg md:text-2xl font-bold text-red-600">{estadisticas.polizas_vencidas || 0}</p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-red-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
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
                  placeholder="Buscar por número de póliza, cliente o aseguradora..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => setShowFilterDrawer(true)}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 rounded-[10px] flex items-center justify-center"
                title="Filtros"
              >
                <Icon icon="solar:filter-bold-duotone" className="w-4 h-4" />
              </Button>

              <Button
                color="light"
                onClick={() => setShowColumnsModal(true)}
                className="h-10 px-3 border-gray-200 hover:bg-gray-50 rounded-[10px] flex items-center justify-center gap-2"
                title="Personalizar Columnas"
              >
                <Icon icon="solar:settings-bold-duotone" className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">
                  {visibleColumns.length}/10
                </span>
              </Button>
              <Button
                color="light"
                onClick={async () => {
                  try {
                    const blob = await polizaService.exportarExcel(filters as any);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `polizas_${new Date().toISOString().slice(0,10)}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    toast({ title: 'Exportación iniciada', description: 'Se descargó el archivo de Excel.' });
                  } catch (error) {
                    toast({ variant: 'destructive', title: 'Error al exportar', description: error instanceof Error ? error.message : 'Error desconocido' });
                  }
                }}
                className="h-10 px-3 border-gray-200 hover:bg-gray-50 rounded-[10px] flex items-center justify-center gap-2"
                title="Exportar a Excel"
              >
                <Icon icon="solar:export-bold-duotone" className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Exportar</span>
              </Button>
              
              <HeroButton icon="solar:add-circle-bold-duotone" onClick={() => setShowCreateTypeModal(true)}>Nueva Póliza</HeroButton>
            </div>
          </div>
        </div>


      </div>

      {/* Tabla de pólizas */}
      <div className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner size="lg" />
            <span className="ml-2">Cargando pólizas...</span>
          </div>
        ) : polizas.length === 0 ? (
          <div className="text-center py-8">
            <Icon icon="solar:document-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No se encontraron pólizas</p>
            <div className="flex justify-center">
              <HeroButton icon="solar:add-circle-bold-duotone" onClick={() => setShowCreateTypeModal(true)} size="lg">Crear primera póliza</HeroButton>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table hoverable className="shadow-md dark:shadow-none bg-white dark:bg-darkgray rounded-[10px]">
                <Table.Head>
                  {visibleColumns.map((columnKey) => (
                    <Table.HeadCell key={columnKey} className="text-sm font-semibold py-2">
                      {getColumnName(columnKey)}
                    </Table.HeadCell>
                  ))}
                  <Table.HeadCell className="text-sm font-semibold py-2">Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="">
                  {polizas.map((poliza) => (
                    <Table.Row key={poliza.id}>
                      {visibleColumns.map((columnKey) => (
                        <Table.Cell key={columnKey} className="whitespace-nowrap">
                          {renderTableCell(poliza, columnKey)}
                        </Table.Cell>
                      ))}
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
                          <Dropdown.Item onClick={() => handleViewPoliza(poliza)} className="flex gap-2 text-sm">
                            <Icon icon="solar:eye-bold" height={16} />
                            <span>Ver Detalles</span>
                          </Dropdown.Item>
                          <Link to={`/apps/seguros/polizas/editar/${poliza.id}`}>
                            <Dropdown.Item className="flex gap-2 text-sm">
                              <Icon icon="solar:pen-new-square-broken" height={16} />
                              <span>Editar</span>
                            </Dropdown.Item>
                          </Link>
                          <Dropdown.Item 
                            className="flex gap-2 text-sm"
                            onClick={() => {
                              setSelectedPoliza(poliza);
                              // Si el estado actual es PENDIENTE, sugerimos ACTIVA por defecto
                              setNewEstado((poliza.estado === 'PENDIENTE' ? 'ACTIVA' : poliza.estado) as EstadoCambio);
                              setMotivoCambio('');
                              setShowChangeStateModal(true);
                            }}
                          >
                            <Icon icon="solar:refresh-bold-duotone" height={16} />
                            <span>Cambiar estado</span>
                          </Dropdown.Item>
                          <Dropdown.Item 
                            className="flex gap-2 text-sm"
                            onClick={() => {
                              setSelectedPoliza(poliza);
                              setRenewFechaFin('');
                              setShowRenewModal(true);
                            }}
                          >
                            <Icon icon="solar:calendar-add-bold-duotone" height={16} />
                            <span>Renovar</span>
                          </Dropdown.Item>
                          <Dropdown.Item 
                            className="text-red-600 flex gap-2 text-sm"
                            onClick={() => handleDeletePoliza(poliza)}
                          >
                            <Icon icon="solar:trash-bin-minimalistic-outline" height={16} />
                            <span>Eliminar</span>
                          </Dropdown.Item>
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
      {pagination && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">
              Mostrando {pagination.from} a {pagination.to} de {pagination.total} resultados
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="per_page_footer" className="text-sm text-gray-600">Elementos por página</Label>
              <select
                id="per_page_footer"
                value={(filters.per_page || 15).toString()}
                onChange={(e) => handleFilterChange('per_page', parseInt(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded-[10px] text-sm"
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              color="light"
              disabled={pagination.current_page === 1}
              onClick={() => goToPage(pagination.current_page - 1)}
              className="rounded-[10px]"
            >
              Anterior
            </Button>
            {renderPageButtons()}
            <Button
              size="sm"
              color="light"
              disabled={pagination.current_page === pagination.last_page}
              onClick={() => goToPage(pagination.current_page + 1)}
              className="rounded-[10px]"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      <Modal show={showModal} onClose={() => setShowModal(false)} size="4xl">
        <Modal.Header>
          Detalle de Póliza {selectedPoliza?.numero_poliza}
        </Modal.Header>
        <Modal.Body>
          {selectedPoliza && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Información de la Póliza</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <strong>Número:</strong> 
                    <span>{selectedPoliza.numero_poliza}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong>Aseguradora:</strong>
                    <span>{(selectedPoliza as any).aseguradora_nombre || selectedPoliza.aseguradora}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong>Ramo:</strong>
                    <span>{(selectedPoliza as any).ramo_nombre || selectedPoliza.ramo_principal}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <strong>Estado:</strong> 
                    <Badge color={`light${getEstadoBadge(selectedPoliza.estado)}`} className="capitalize">
                      {selectedPoliza.estado}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <strong>Prima:</strong> 
                    <span>{formatCurrency(selectedPoliza.prima_neta || 0)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Información del Cliente</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <strong>Nombre:</strong> 
                    <span>{selectedPoliza.nombres_cliente}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong>Tipo Seguro:</strong>
                    <span>{(selectedPoliza as any).ramo_nombre || selectedPoliza.ramo_principal}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong>Aseguradora:</strong>
                    <span>{(selectedPoliza as any).aseguradora_nombre || selectedPoliza.aseguradora || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong>Vencimiento:</strong> 
                    <span>{selectedPoliza.fecha_fin ? new Date(selectedPoliza.fecha_fin).toLocaleDateString('es-CO') : 'Sin fecha'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Modal Cambiar Estado */}
      <Modal show={showChangeStateModal} onClose={() => setShowChangeStateModal(false)} size="md">
        <Modal.Header>Cambiar estado de póliza</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nuevo_estado" className="mb-2 block">Nuevo estado</Label>
              <select
                id="nuevo_estado"
                value={newEstado}
                onChange={(e) => setNewEstado(e.target.value as EstadoCambio)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {estadosPoliza.filter((e) => e.value !== 'PENDIENTE').map((estado) => (
                  <option key={estado.value} value={estado.value}>{estado.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="motivo_cambio" className="mb-2 block">Motivo (opcional)</Label>
              <TextInput id="motivo_cambio" value={motivoCambio} onChange={(e) => setMotivoCambio(e.target.value)} placeholder="Ingresa un motivo" />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowChangeStateModal(false)}>Cancelar</Button>
          <Button
            color="primary"
            onClick={async () => {
              if (!selectedPoliza || !newEstado) return;
              try {
                await polizaService.cambiarEstado(selectedPoliza.id, newEstado, motivoCambio || undefined);
                await loadPolizas();
                await loadEstadisticas();
                setShowChangeStateModal(false);
                toast({ title: 'Estado actualizado', description: `La póliza ahora está ${newEstado}.` });
              } catch (error) {
                toast({ variant: 'destructive', title: 'Error al cambiar estado', description: error instanceof Error ? error.message : 'Error desconocido' });
              }
            }}
          >
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Renovar */}
      <Modal show={showRenewModal} onClose={() => setShowRenewModal(false)} size="md">
        <Modal.Header>Renovar póliza</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="renew_fecha_fin" className="mb-2 block">Nueva fecha de fin</Label>
              <TextInput id="renew_fecha_fin" type="date" value={renewFechaFin} onChange={(e) => setRenewFechaFin(e.target.value)} />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowRenewModal(false)}>Cancelar</Button>
          <Button
            color="primary"
            onClick={async () => {
              if (!selectedPoliza || !renewFechaFin) {
                toast({ variant: 'destructive', title: 'Fecha requerida', description: 'Selecciona la nueva fecha de fin.' });
                return;
              }
              try {
                await polizaService.renovarPoliza(selectedPoliza.id, renewFechaFin);
                await loadPolizas();
                await loadEstadisticas();
                setShowRenewModal(false);
                toast({ title: 'Póliza renovada', description: 'Se ha renovado la póliza correctamente.' });
              } catch (error) {
                toast({ variant: 'destructive', title: 'Error al renovar', description: error instanceof Error ? error.message : 'Error desconocido' });
              }
            }}
          >
            Renovar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} size="md">
        <Modal.Header>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Confirmar Eliminación
          </h3>
        </Modal.Header>
        <Modal.Body>
          <div className="delete-modal-content">
            <div className="delete-modal-icon">
              <Icon icon="solar:trash-bin-minimalistic-bold-duotone" />
            </div>
            <h3 className="delete-modal-title">
              ¿Estás seguro de que deseas eliminar la póliza?
            </h3>
            <p className="delete-modal-subtitle">
              <span className="delete-modal-poliza-number">{polizaToDelete?.numero_poliza}</span>
            </p>
            <p className="delete-modal-description">
              Esta acción no se puede deshacer.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="delete-modal-buttons">
            <Button 
              color="failure" 
              onClick={confirmDelete}
              className="btn btn-danger"
            >
              <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
              Sí, eliminar
            </Button>
            <Button 
              color="gray" 
              onClick={() => setShowDeleteModal(false)}
              className="btn btn-secondary"
            >
              <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
              Cancelar
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Drawer de filtros avanzados */}
      <Modal show={showFilterDrawer} onClose={() => setShowFilterDrawer(false)} size="2xl">
        <Modal.Header>Filtros Avanzados</Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="aseguradora" className="mb-2 block">Aseguradora</Label>
              <select
                id="aseguradora"
                value={filters.aseguradora || ''}
                onChange={(e) => handleFilterChange('aseguradora', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las aseguradoras</option>
                {aseguradoras.map((aseg) => (
                  <option key={aseg} value={aseg}>{aseg}</option>
                ))}
              </select>
            </div>
            
            <div>
              <Label htmlFor="ramo" className="mb-2 block">Ramo</Label>
              <select
                id="ramo"
                value={filters.ramo || ''}
                onChange={(e) => handleFilterChange('ramo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los ramos</option>
                {tiposSeguro.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="estado" className="mb-2 block">Estado</Label>
              <select
                id="estado"
                value={filters.estado || ''}
                onChange={(e) => handleFilterChange('estado', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                {estadosPoliza.map((estado) => (
                  <option key={estado.value} value={estado.value}>{estado.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="per_page" className="mb-2 block">Elementos por página</Label>
              <select
                id="per_page"
                value={filters.per_page?.toString() || '15'}
                onChange={(e) => handleFilterChange('per_page', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>

            <div>
              <Label htmlFor="fecha_inicio" className="mb-2 block">Fecha de inicio (desde)</Label>
              <TextInput
                type="date"
                id="fecha_inicio"
                value={filters.fecha_inicio || ''}
                onChange={(e) => handleFilterChange('fecha_inicio', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="fecha_fin" className="mb-2 block">Fecha de fin (hasta)</Label>
              <TextInput
                type="date"
                id="fecha_fin"
                value={filters.fecha_fin || ''}
                onChange={(e) => handleFilterChange('fecha_fin', e.target.value)}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            color="gray" 
            onClick={() => {
              setFilters({
                search: '',
                aseguradora: '',
                ramo: '',
                estado: '',
                vendedor: '',
                sede: '',
                fecha_inicio: '',
                fecha_fin: '',
                per_page: 15,
                page: 1,
                sort_field: 'created_at',
                sort_direction: 'desc'
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
      <ColumnsCustomizationModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        visibleColumns={visibleColumns}
        onVisibleColumnsChange={handleVisibleColumnsChange}
      />

      {/* Modal de selección de tipo de póliza */}
      <Modal show={showCreateTypeModal} onClose={() => setShowCreateTypeModal(false)} size="md">
        <Modal.Header>Crear póliza</Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Selecciona el tipo de póliza que deseas crear:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                color="light"
                onClick={() => {
                  setShowCreateTypeModal(false);
                  navigate('/apps/seguros/polizas/nueva');
                }}
                className="h-24 flex flex-col items-center justify-center gap-2 border"
              >
                <Icon icon="solar:user-bold-duotone" className="w-6 h-6" />
                Individual
              </Button>
              <Button
                color="light"
                onClick={() => {
                  setShowCreateTypeModal(false);
                  navigate('/apps/seguros/polizas/nueva-colectiva');
                }}
                className="h-24 flex flex-col items-center justify-center gap-2 border"
              >
                <Icon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6" />
                Colectiva
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};
export default PolizasNew;