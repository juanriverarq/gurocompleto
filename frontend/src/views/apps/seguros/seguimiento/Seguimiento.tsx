import React, { useState, useEffect, useCallback, useMemo, useTransition, memo, useRef } from 'react';
import { Card, Badge, Button, Modal, Textarea, Spinner, Alert, Table, Dropdown } from 'flowbite-react';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { 
  Select as ShSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from 'src/components/shadcn-ui/Default-Ui/select';
import { useToast } from 'src/hooks/use-toast';
import TitleCard from 'src/components/shared/TitleBorderCard';
import FormField from 'src/components/shared/FormField';

// CSS inline para forzar z-index del dropdown y mejorar posicionamiento
const dropdownStyles = `
  .flowbite-dropdown {
    z-index: 9999 !important;
    position: relative !important;
  }
  .flowbite-dropdown > div {
    z-index: 9999 !important;
    position: relative !important;
  }
  .flowbite-dropdown [role="menu"] {
    z-index: 9999 !important;
    position: absolute !important;
    top: 100% !important;
    right: 0 !important;
    transform: translateY(4px) !important;
    min-width: 160px !important;
    max-width: 200px !important;
  }
  [data-testid="flowbite-dropdown"] {
    z-index: 9999 !important;
    position: absolute !important;
    top: 100% !important;
    right: 0 !important;
  }
  .flowbite-dropdown-target {
    z-index: 9999 !important;
  }
  div[role="menu"] {
    z-index: 9999 !important;
    position: absolute !important;
    top: 100% !important;
    right: 0 !important;
    transform: translateY(4px) !important;
  }
  /* Optimizar transiciones para mejor velocidad */
  .flowbite-dropdown [role="menu"],
  [data-testid="flowbite-dropdown"] {
    transition: opacity 0.15s ease-out, transform 0.15s ease-out !important;
  }
  /* Permitir que el dropdown salga del contenedor verticalmente sin afectar el ancho */
  .overflow-x-auto {
    overflow-y: visible !important;
  }
  table, td {
    overflow: visible !important;
  }
`;
import { Icon } from '@iconify/react';
import { IconDots } from '@tabler/icons-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  seguimientoService, 
  SeguimientoItem, 
  CreateSeguimientoData, 
  UpdateSeguimientoData,
  SeguimientoStatistics 
} from '../../../../services/seguimientoService';
import { saasApi } from '../../../../services/saasApi';

// Estados dinámicos de seguimiento (basados en el backend real)
const SEGUIMIENTO_STATES = {
  'pendiente': { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: 'solar:clock-circle-bold-duotone' },
  'en_progreso': { label: 'En Progreso', color: 'bg-blue-100 text-blue-800', icon: 'solar:settings-bold-duotone' },
  'completada': { label: 'Completada', color: 'bg-green-100 text-green-800', icon: 'solar:check-circle-bold-duotone' },
  'vencida': { label: 'Vencida', color: 'bg-red-100 text-red-800', icon: 'solar:danger-circle-bold-duotone' },
  'cancelada': { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: 'solar:close-circle-bold-duotone' },
  'pausada': { label: 'Pausada', color: 'bg-purple-100 text-purple-800', icon: 'solar:pause-circle-bold-duotone' }
};

// Componente optimizado para filas de tabla
const SeguimientoTableRow = memo(({ 
  item, 
  onEdit, 
  onChangeState, 
  onDelete,
  onViewDetails,
  getTipoIcon 
}: {
  item: SeguimientoItem;
  onEdit: (item: SeguimientoItem) => void;
  onChangeState: (item: SeguimientoItem) => void;
  onDelete: (id: number) => void;
  onViewDetails: (item: SeguimientoItem) => void;
  getTipoIcon: (type: string) => string;
}) => {
  const stateConfig = SEGUIMIENTO_STATES[item.status as keyof typeof SEGUIMIENTO_STATES] || SEGUIMIENTO_STATES['pendiente'];
  
  return (
    <Table.Row className="hover:bg-gray-50 dark:hover:bg-gray-700">
      <Table.Cell className="whitespace-nowrap pr-8">
        <div className="flex items-center gap-2">
          <Icon icon={getTipoIcon(item.type)} className="w-4 h-4 text-blue-600" />
          <span className="text-sm capitalize">{item.type.replace('_', ' ')}</span>
        </div>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap pr-8">
        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</div>
        {item.description && (
          <div className="text-xs text-gray-500">{item.description}</div>
        )}
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap pr-8">
        <div className="text-sm">
          {item.client?.name ? (
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">{item.client.name}</div>
              <div className="text-xs text-gray-500">{item.client.document}</div>
            </div>
          ) : (
            <span className="text-gray-400">Sin asignar</span>
          )}
        </div>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap pr-8">
        <div className="flex items-center gap-2">
          <Icon icon={stateConfig.icon} className="w-4 h-4" />
          <Badge className={`${stateConfig.color} px-2 py-1 rounded-full text-xs font-medium`}>
            {stateConfig.label}
          </Badge>
        </div>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap pr-8">
        <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${
          item.priority === 'critica' ? 'bg-red-100 text-red-800' :
          item.priority === 'alta' ? 'bg-orange-100 text-orange-800' :
          item.priority === 'media' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {item.priority === 'critica' ? 'Crítica' :
           item.priority === 'alta' ? 'Alta' :
           item.priority === 'media' ? 'Media' : 'Baja'}
        </Badge>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap pr-8">
        <div className="text-sm text-gray-900 dark:text-white">
          {item.scheduled_for ? format(new Date(item.scheduled_for), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}
        </div>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap pr-8">
        <div className="text-sm text-gray-900 dark:text-white">
          {item.assigned_user?.name || 'Sin asignar'}
        </div>
      </Table.Cell>
      <Table.Cell>
        <div className="relative inline-block">
          <Dropdown
            label=""
            dismissOnClick={false}
            renderTrigger={() => (
              <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                <IconDots size={22} />
              </span>
            )}
          >
            <Dropdown.Item 
              className="flex gap-3 w-full justify-start text-left"
              onClick={() => onViewDetails(item)}
            >
              <Icon icon="solar:eye-bold-duotone" height={18} />
              <span>Ver Detalles</span>
            </Dropdown.Item>
            <Dropdown.Item 
              className="flex gap-3 w-full justify-start text-left"
              onClick={() => onEdit(item)}
            >
              <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
              <span>Editar</span>
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item 
              className="flex gap-3 w-full justify-start text-left"
              onClick={() => onChangeState(item)}
            >
              <Icon icon="solar:refresh-circle-bold-duotone" height={18} />
              <span>Cambiar Estado</span>
            </Dropdown.Item>
          </Dropdown>
        </div>
      </Table.Cell>
    </Table.Row>
  );
});

const Seguimiento: React.FC = () => {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  const [seguimientos, setSeguimientos] = useState<SeguimientoItem[]>([]);
  const [statistics, setStatistics] = useState<SeguimientoStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Estados de filtros (corregidos según backend)
  const [filters, setFilters] = useState({
    search: '',
    estado: 'todos',
    tipo: 'todos',
    prioridad: 'todas',
    asignado: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  
  // Controlador para cancelar requests en vuelo
  const requestControllerRef = useRef<AbortController | null>(null);

  // Estados de paginación (igual que clientes)
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Estados para cambio de estado
  const [showStateModal, setShowStateModal] = useState(false);
  const [seguimientoToChangeState, setSeguimientoToChangeState] = useState<SeguimientoItem | null>(null);
  const [newState, setNewState] = useState('');
  const [changingState, setChangingState] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SeguimientoItem | null>(null);
  const [editarItem, setEditarItem] = useState<SeguimientoItem | null>(null);
  const [nuevoSeguimiento, setNuevoSeguimiento] = useState<CreateSeguimientoData>({
    title: '',
    description: '',
    type: 'seguimiento_cliente',
    priority: 'media',
    scheduled_for: '',
    client_id: undefined,
    poliza_id: undefined,
    assigned_to: undefined,
    contact_method: undefined,
  });
  const [editarSeguimiento, setEditarSeguimiento] = useState<UpdateSeguimientoData>({
    title: '',
    description: '',
    type: 'seguimiento_cliente',
    priority: 'media',
    scheduled_for: '',
    client_id: undefined,
    poliza_id: undefined,
    assigned_to: undefined,
    contact_method: undefined,
  });
  const [clientes, setClientes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [polizasCliente, setPolizasCliente] = useState<any[]>([]);
  const [clienteQuery, setClienteQuery] = useState<string>('');
  const [polizaQuery, setPolizaQuery] = useState<string>('');
  const [nuevoErrores, setNuevoErrores] = useState<Record<string, string>>({});
  const [editarErrores, setEditarErrores] = useState<Record<string, string>>({});


  // Cargar usuarios cuando se abren modales
  useEffect(() => {
    if (modalNuevoOpen && usuarios.length === 0) {
      loadUsuarios();
    }
  }, [modalNuevoOpen]);

  useEffect(() => {
    if (modalEditarOpen && usuarios.length === 0) {
      loadUsuarios();
    }
  }, [modalEditarOpen]);

  // Búsqueda de clientes con debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (clienteQuery.length >= 2 || clienteQuery === '') {
        loadClientes(clienteQuery || undefined);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [clienteQuery]);

  // Efecto para cargar per_page inicial
  useEffect(() => {
    const savedPerPage = localStorage.getItem('seguimientos_per_page');
    if (savedPerPage) {
      setPerPage(parseInt(savedPerPage));
    }
  }, []);

  // Debounce solo para búsqueda de texto
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        loadSeguimientos();
      }
    }, 300); // Reducido a 300ms para mejor respuesta

    return () => clearTimeout(timer);
  }, [filters.search]);

  // Efecto inmediato para filtros y paginación (sin debounce)
  useEffect(() => {
    loadSeguimientos();
  }, [filters.estado, filters.tipo, filters.prioridad, filters.asignado, filters.fecha_desde, filters.fecha_hasta, currentPage, perPage]);

  // Persistir per_page en localStorage
  useEffect(() => {
    localStorage.setItem('seguimientos_per_page', perPage.toString());
  }, [perPage]);

  const loadSeguimientos = useCallback(async () => {
    // Evitar llamadas duplicadas
    if (loading && seguimientos.length > 0) return;
    
    try {
      setLoading(true);
      setError(null);
      // Cancelar solicitudes previas en curso
      if (requestControllerRef.current) {
        requestControllerRef.current.abort();
      }
      const controller = new AbortController();
      requestControllerRef.current = controller;
      const { signal } = controller;

      const response = await seguimientoService.getSeguimientos({
        search: filters.search || undefined,
        status: filters.estado && filters.estado !== 'todos' ? filters.estado : undefined,
        type: filters.tipo && filters.tipo !== 'todos' ? filters.tipo : undefined,
        priority: filters.prioridad && filters.prioridad !== 'todas' ? filters.prioridad : undefined,
        assigned_to: filters.asignado || undefined,
        due_date_from: filters.fecha_desde || undefined,
        due_date_to: filters.fecha_hasta || undefined,
        page: currentPage,
        per_page: perPage,
      }, signal);
      
      setSeguimientos(response.data || []);
      setTotalItems(response.total || 0);
      setTotalPages(Math.ceil((response.total || 0) / perPage));
      
      // Cargar estadísticas solo la primera vez y de forma lazy
      if (currentPage === 1 && !statistics) {
        setTimeout(() => loadStatistics(), 100); // Lazy load statistics
      }
    } catch (error: any) {
      console.error('Error loading seguimientos:', error);
      setError('Error al cargar seguimientos: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, perPage]);

  const loadStatistics = async () => {
    try {
      const response = await seguimientoService.getStatistics();
      
      // No usar estadísticas del servidor si tenemos seguimientos locales cargados
      if (seguimientos.length > 0) {
        return;
      }
      
      setStatistics(response.data);
    } catch (error) {
      // Generar estadísticas basadas en los seguimientos locales como fallback
      if (seguimientos.length > 0) {
        const localStats = generateLocalStatistics();
        setStatistics(localStats);
      }
    }
  };

  const loadClientes = async (search?: string) => {
    try {
      const response = await seguimientoService.getClients(search, 50);
      setClientes(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadUsuarios = async () => {
    try {
      const response = await seguimientoService.getUsers();
      setUsuarios(response.data);
    } catch (error) {
    }
  };

  const loadPolizasDeCliente = async (clientId?: number) => {
    try {
      if (!clientId) { setPolizasCliente([]); return; }
      const res = await saasApi.getPolizas({ client_id: Number(clientId), per_page: 100 });
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setPolizasCliente(data || []);
    } catch (e) {
      setPolizasCliente([]);
    }
  };

  // Cargar pólizas cuando se abre editar y ya hay cliente seleccionado
  useEffect(() => {
    if (modalEditarOpen && editarSeguimiento.client_id) {
      loadPolizasDeCliente(editarSeguimiento.client_id);
    }
  }, [modalEditarOpen, editarSeguimiento.client_id]);


  // Actualizar estadísticas cuando cambien los seguimientos
  useEffect(() => {
    if (seguimientos.length > 0) {
      const localStats = generateLocalStatistics();
      setStatistics(localStats);
    } else {
    }
  }, [seguimientos]);

  const getTipoIcon = (tipo: string) => {
    const icons = {
      llamada: 'solar:phone-bold-duotone',
      email: 'solar:letter-bold-duotone',
      visita: 'solar:map-point-bold-duotone',
      documentos: 'solar:document-bold-duotone',
      documentacion: 'solar:document-bold-duotone',
      reunion: 'solar:users-group-two-rounded-bold-duotone',
      seguimiento_cliente: 'solar:user-check-bold-duotone',
      inspeccion: 'solar:magnifer-bold-duotone',
      renovacion: 'solar:refresh-bold-duotone',
      siniestro: 'solar:danger-bold-duotone',
      cotizacion: 'solar:calculator-bold-duotone'
    };
    return icons[tipo as keyof typeof icons] || 'solar:info-circle-bold-duotone';
  };

  const getEstadoBadge = (estado: SeguimientoItem['status']) => {
    const estados = {
      pendiente: { color: 'yellow', text: 'Pendiente' },
      en_progreso: { color: 'blue', text: 'En Progreso' },
      completada: { color: 'green', text: 'Completado' },
      completado: { color: 'green', text: 'Completado' },
      vencida: { color: 'red', text: 'Vencido' },
      vencido: { color: 'red', text: 'Vencido' },
      cancelada: { color: 'gray', text: 'Cancelado' },
      pausada: { color: 'purple', text: 'Pausado' }
    };
    const config = estados[estado as keyof typeof estados] || { color: 'gray', text: estado };
    return <Badge color={config.color}>{config.text}</Badge>;
  };

  const getPrioridadBadge = (prioridad: SeguimientoItem['priority']) => {
    const prioridades = {
      baja: { color: 'gray', text: 'Baja' },
      media: { color: 'yellow', text: 'Media' },
      alta: { color: 'orange', text: 'Alta' },
      critica: { color: 'red', text: 'Crítica' }
    };
    const config = prioridades[prioridad as keyof typeof prioridades] || { color: 'gray', text: prioridad };
    return <Badge color={config.color}>{config.text}</Badge>;
  };

  // Funciones auxiliares para los badges de la tabla
  const getEstadoBadgeColor = (estado: string) => {
    const estados = {
      pendiente: 'warning',
      en_progreso: 'info',
      completada: 'success',
      completado: 'success',
      vencida: 'failure',
      vencido: 'failure',
      cancelada: 'gray',
      pausada: 'purple'
    };
    return estados[estado as keyof typeof estados] || 'gray';
  };

  const getEstadoText = (estado: string) => {
    const estados = {
      pendiente: 'Pendiente',
      en_progreso: 'En Progreso',
      completada: 'Completado',
      completado: 'Completado',
      vencida: 'Vencido',
      vencido: 'Vencido',
      cancelada: 'Cancelado',
      pausada: 'Pausado'
    };
    return estados[estado as keyof typeof estados] || estado;
  };

  const getPrioridadBadgeColor = (prioridad: string) => {
    const prioridades = {
      baja: 'gray',
      media: 'warning',
      alta: 'failure',
      critica: 'failure'
    };
    return prioridades[prioridad as keyof typeof prioridades] || 'gray';
  };

  const getPrioridadText = (prioridad: string) => {
    const prioridades = {
      baja: 'Baja',
      media: 'Media',
      alta: 'Alta',
      critica: 'Crítica'
    };
    return prioridades[prioridad as keyof typeof prioridades] || prioridad;
  };

  const validateNuevo = (): boolean => {
    const errs: Record<string, string> = {};
    if (!nuevoSeguimiento.title?.trim()) errs.title = 'El título es obligatorio';
    if (!nuevoSeguimiento.type) errs.type = 'El tipo es obligatorio';
    if (!nuevoSeguimiento.priority) errs.priority = 'La prioridad es obligatoria';
    if (!nuevoSeguimiento.description?.trim()) errs.description = 'La descripción es obligatoria';
    setNuevoErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const validateEditar = (): boolean => {
    const errs: Record<string, string> = {};
    if (!editarSeguimiento.title?.trim()) errs.title = 'El título es obligatorio';
    if (!editarSeguimiento.type) errs.type = 'El tipo es obligatorio';
    if (!editarSeguimiento.priority) errs.priority = 'La prioridad es obligatoria';
    if (!editarSeguimiento.description?.trim()) errs.description = 'La descripción es obligatoria';
    setEditarErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateSeguimiento = async () => {
    if (!validateNuevo()) return;

    try {
      setSaving(true);
      setError(null);
      await seguimientoService.createSeguimiento(nuevoSeguimiento);
      
      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();
      
      // Limpiar formulario y cerrar modal
      setNuevoSeguimiento({
        title: '',
        description: '',
        type: 'llamada',
        priority: 'media',
        scheduled_for: '',
      });
      setNuevoErrores({});
      setModalNuevoOpen(false);
    } catch (error: any) {
      setError('Error al crear seguimiento: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSeguimiento = async () => {
    if (!editarItem) return;
    if (!validateEditar()) return;

    try {
      setSaving(true);
      setError(null);
      await seguimientoService.updateSeguimiento(editarItem.id, editarSeguimiento);
      
      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();
      
      // Cerrar modal
      setModalEditarOpen(false);
      setEditarItem(null);
      setEditarErrores({});
    } catch (error: any) {
      setError('Error al actualizar seguimiento: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSeguimiento = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este seguimiento?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await seguimientoService.deleteSeguimiento(id);
      
      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();
      
      // Cerrar modal si está abierto
      if (modalOpen) setModalOpen(false);
    } catch (error: any) {
      setError('Error al eliminar seguimiento: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartSeguimiento = async (id: number) => {
    try {
      setSaving(true);
      setError(null);
      await seguimientoService.startSeguimiento(id);
      
      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();
    } catch (error: any) {
      setError('Error al iniciar seguimiento: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSeguimiento = async (id: number) => {
    try {
      setSaving(true);
      setError(null);
      await seguimientoService.completeSeguimiento(id, {
        result: 'completado',
        notes: 'Completado desde la interfaz'
      });
      
      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();
    } catch (error: any) {
      setError('Error al completar seguimiento: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (id: number, newStatus: string) => {
    try {
      setSaving(true);
      setError(null);
      
      // Usar el método apropiado según el nuevo estado
      if (newStatus === 'en_progreso') {
        await seguimientoService.startSeguimiento(id);
      } else if (newStatus === 'completada' || newStatus === 'completado') {
        await seguimientoService.completeSeguimiento(id, {
          result: 'completado',
          notes: 'Completado desde la interfaz'
        });
      } else {
        // Para otros estados, usar updateSeguimiento
        await seguimientoService.updateSeguimiento(id, { status: newStatus });
      }
      
      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();
    } catch (error: any) {
      setError(`Error al cambiar estado a ${newStatus}: ` + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Generar estadísticas locales basadas en los seguimientos cargados
  const generateLocalStatistics = (): SeguimientoStatistics => {
    
    const stats: SeguimientoStatistics = {
      total: seguimientos.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
      due_today: 0,
      due_this_week: 0,
      needing_follow_up: 0,
      by_type: {},
      by_priority: {}
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    seguimientos.forEach((item, index) => {
      
      // Contar por estado
      switch (item.status) {
        case 'pendiente':
          stats.pending++;
          break;
        case 'en_progreso':
          stats.in_progress++;
          break;
        case 'completada':
        case 'completado':
          stats.completed++;
          break;
        case 'vencida':
        case 'vencido':
          stats.overdue++;
          break;
        case 'cancelada':
        case 'pausada':
          break;
        default:
          break;
      }

      // Contar por tipo
      stats.by_type[item.type] = (stats.by_type[item.type] || 0) + 1;
      
      // Contar por prioridad
      stats.by_priority[item.priority] = (stats.by_priority[item.priority] || 0) + 1;

      // Verificar fechas de vencimiento
      if (item.due_date) {
        const dueDate = new Date(item.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate.getTime() === today.getTime()) {
          stats.due_today++;
        }
        
        if (dueDate >= today && dueDate < nextWeek) {
          stats.due_this_week++;
        }
        
        if (dueDate < today && (item.status === 'pendiente' || item.status === 'en_progreso')) {
          stats.overdue++;
        }
      }

      // Verificar si necesita seguimiento
      if (item.next_follow_up) {
        const followUpDate = new Date(item.next_follow_up);
        if (followUpDate <= today && (item.status === 'pendiente' || item.status === 'en_progreso')) {
          stats.needing_follow_up++;
        }
      }
    });

    return stats;
  };

  const openEditModal = useCallback((item: SeguimientoItem) => {
    setEditarItem(item);
    setEditarSeguimiento({
      title: item.title,
      description: item.description || '',
      type: item.type,
      priority: item.priority,
      scheduled_for: item.scheduled_for ? new Date(item.scheduled_for).toISOString().slice(0, 16) : '',
    });
    setModalEditarOpen(true);
  }, []);

  const handleChangeState = useCallback((seguimiento: SeguimientoItem) => {
    setSeguimientoToChangeState(seguimiento);
    setNewState(seguimiento.status as SeguimientoItem['status']);
    setShowStateModal(true);
  }, []);

  const confirmStateChange = async () => {
    if (!seguimientoToChangeState || !newState) return;

    try {
      setChangingState(true);
      await seguimientoService.updateSeguimiento(seguimientoToChangeState.id, {
        status: newState
      });

      // Actualizar la lista local
      setSeguimientos((prev): SeguimientoItem[] => prev.map((s) => (
        s.id === seguimientoToChangeState.id
          ? { ...s, status: newState }
          : s
      )));

      setShowStateModal(false);
      setSeguimientoToChangeState(null);
      setNewState('pendiente');
      
      toast({
        title: "Estado actualizado",
        description: `El seguimiento ahora está en estado "${SEGUIMIENTO_STATES[newState as keyof typeof SEGUIMIENTO_STATES]?.label}".`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del seguimiento.",
        variant: "destructive",
      });
    } finally {
      setChangingState(false);
    }
  };

  if (loading && seguimientos.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-2 text-lg">Cargando seguimientos...</span>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: dropdownStyles }} />
      
      {/* Header idéntico a clientes */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Gestión de Seguimientos
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Administra y realiza seguimiento a todas las actividades comerciales
          </p>
        </div>
        <div className="flex items-center gap-3" />
      </div>

      {/* Estadísticas optimizadas */}
      {statistics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{statistics.pending}</p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Icon icon="solar:clock-circle-bold-duotone" className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">En Progreso</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.in_progress}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon icon="solar:settings-bold-duotone" className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completados</p>
                <p className="text-2xl font-bold text-green-600">{statistics.completed}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{statistics.overdue}</p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <Icon icon="solar:danger-circle-bold-duotone" className="w-6 h-6 text-red-600" />
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
                  placeholder="Buscar por título, descripción o cliente..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
                {isPending && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => window.location.reload()}
                disabled={loading}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Actualizar"
              >
                <Icon icon="solar:refresh-bold-duotone" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button onClick={() => setModalNuevoOpen(true)} color="primary" className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]">
                <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Nuevo Seguimiento</span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros adicionales eliminados para igualar sales-funnel */}

      {/* Tabla */}
      <Card>
        {seguimientos.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Icon icon="solar:document-bold-duotone" className="w-16 h-16 text-gray-300" />
              <p className="text-gray-500 text-lg font-medium">No hay seguimientos</p>
              <p className="text-gray-400 text-sm">Comienza creando tu primer seguimiento</p>
              <Button onClick={() => setModalNuevoOpen(true)} color="primary" className="mt-2">
                <Icon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                Crear primer seguimiento
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table hoverable className="w-full shadow-md dark:shadow-none bg-white dark:bg-darkgray rounded-[10px]">
            <Table.Head>
              <Table.HeadCell>
                <div className="flex items-center gap-1 cursor-pointer select-none">
                  <span>Tipo</span>
                  <Icon
                    icon="solar:sort-vertical-bold-duotone"
                    className="w-4 h-4 text-gray-400"
                  />
                </div>
              </Table.HeadCell>
              <Table.HeadCell>
                <div className="flex items-center gap-1 cursor-pointer select-none">
                  <span>Título</span>
                  <Icon
                    icon="solar:sort-vertical-bold-duotone"
                    className="w-4 h-4 text-gray-400"
                  />
                </div>
              </Table.HeadCell>
              <Table.HeadCell>Cliente</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>Prioridad</Table.HeadCell>
              <Table.HeadCell>Fecha Programada</Table.HeadCell>
              <Table.HeadCell>Asignado</Table.HeadCell>
              <Table.HeadCell>Acciones</Table.HeadCell>
            </Table.Head>
                <Table.Body>
                  {seguimientos.map((item) => (
                    <SeguimientoTableRow
                      key={item.id}
                      item={item}
                      onEdit={openEditModal}
                      onChangeState={handleChangeState}
                      onDelete={handleDeleteSeguimiento}
                      onViewDetails={(item) => { setSelectedItem(item); setModalOpen(true); }}
                      getTipoIcon={getTipoIcon}
                    />
                  ))}
                </Table.Body>
              </Table>
            </div>

            {/* Paginación */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  Mostrando {new Intl.NumberFormat('es-CO').format(((currentPage - 1) * perPage) + 1)} a {new Intl.NumberFormat('es-CO').format(Math.min(currentPage * perPage, totalItems))} de {new Intl.NumberFormat('es-CO').format(totalItems)} seguimientos
                </span>
                <div className="flex items-center gap-2">
                  <span>Por página:</span>
                  <select
                    className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray"
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  color="gray"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
                </Button>
                
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Página {currentPage} de {totalPages}
                </span>
                
                <Button
                  size="sm"
                  color="gray"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Modal de detalles */}
      <Modal show={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <Modal.Header>Detalles del Seguimiento</Modal.Header>
        <Modal.Body>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Título</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedItem.title}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cliente</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedItem.client?.name || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo</label>
                  <div className="flex items-center mt-1">
                    <Icon icon={getTipoIcon(selectedItem.type)} className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="capitalize text-sm">{selectedItem.type.replace('_', ' ')}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estado</label>
                  <div className="mt-1">{getEstadoBadge(selectedItem.status)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Prioridad</label>
                  <div className="mt-1">{getPrioridadBadge(selectedItem.priority)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Asignado a</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedItem.assigned_user?.name || '-'}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Descripción</label>
                <p className="mt-1 text-sm text-gray-900">{selectedItem.description || '-'}</p>
              </div>
              {selectedItem.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notas</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedItem.notes}</p>
                </div>
              )}
              {selectedItem.scheduled_for && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha Programada</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(selectedItem.scheduled_for), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setModalOpen(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal nuevo seguimiento */}
      <Modal show={modalNuevoOpen} onClose={() => setModalNuevoOpen(false)} size="xl" className="[--modal-z:60]">
        <Modal.Header>Nuevo Seguimiento</Modal.Header>
        <Modal.Body>
          <TitleCard title="Información del Seguimiento">
            <div className="space-y-6">
              <FormField
                id="nuevo_title"
                name="title"
                label="Título"
                value={nuevoSeguimiento.title}
                onChange={(e) => {
                  setNuevoSeguimiento(prev => ({...prev, title: e.target.value}));
                  if (nuevoErrores.title) setNuevoErrores(prev => ({...prev, title: ''}));
                }}
                placeholder="Título del seguimiento"
                required
                error={nuevoErrores.title}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  id="nuevo_type"
                  name="type"
                  label="Tipo"
                  value={nuevoSeguimiento.type}
                  onChange={(e) => {
                    setNuevoSeguimiento(prev => ({ ...prev, type: e.target.value as any }));
                    if (nuevoErrores.type) setNuevoErrores(prev => ({...prev, type: ''}));
                  }}
                  type="select"
                  required
                  options={[
                    { value: 'seguimiento_cliente', label: 'Seguimiento Cliente' },
                    { value: 'llamada', label: 'Llamada' },
                    { value: 'email', label: 'Email' },
                    { value: 'visita', label: 'Visita' },
                    { value: 'reunion', label: 'Reunión' },
                    { value: 'documentacion', label: 'Documentación' },
                    { value: 'inspeccion', label: 'Inspección' },
                    { value: 'renovacion', label: 'Renovación' },
                    { value: 'siniestro', label: 'Siniestro' },
                    { value: 'cotizacion', label: 'Cotización' }
                  ]}
                  error={nuevoErrores.type}
                />
                <FormField
                  id="nuevo_priority"
                  name="priority"
                  label="Prioridad"
                  value={nuevoSeguimiento.priority}
                  onChange={(e) => {
                    setNuevoSeguimiento(prev => ({ ...prev, priority: e.target.value as any }));
                    if (nuevoErrores.priority) setNuevoErrores(prev => ({...prev, priority: ''}));
                  }}
                  type="select"
                  required
                  options={[
                    { value: 'baja', label: 'Baja' },
                    { value: 'media', label: 'Media' },
                    { value: 'alta', label: 'Alta' },
                    { value: 'critica', label: 'Crítica' }
                  ]}
                  error={nuevoErrores.priority}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1 block">Asignado a</Label>
                  <ShSelect
                    value={nuevoSeguimiento.assigned_to ? String(nuevoSeguimiento.assigned_to) : undefined}
                    onValueChange={(val) => setNuevoSeguimiento(prev => ({ ...prev, assigned_to: val ? Number(val) : undefined }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Yo mismo" />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      {usuarios.map(u => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <Combobox
                    value={clientes.find(c=> c.id === nuevoSeguimiento.client_id) || null}
                    onChange={async (val: any) => {
                      const clientId = val?.id as number | undefined;
                      setNuevoSeguimiento(prev => ({...prev, client_id: clientId, poliza_id: undefined}));
                      await loadPolizasDeCliente(clientId);
                    }}
                    onClose={()=> setClienteQuery('')}
                  >
                    <div className="relative z-[60]">
                      <ComboboxInput
                        as={Input}
                        className="w-full"
                        displayValue={(c: any)=> c ? `${c.name} (${c.document})` : ''}
                        onChange={(e)=> setClienteQuery(e.target.value)}
                        placeholder="Buscar cliente"
                      />
                      <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                        <Icon icon="solar:alt-arrow-down-outline" height={20} />
                      </ComboboxButton>
                    </div>
                    <ComboboxOptions anchor="bottom" transition className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0">
                      {clientes.map(c => (
                        <ComboboxOption key={c.id} value={c} className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary">
                          <Icon icon="solar:check-read-linear" className="invisible group-data-[selected]:visible" height={20} />
                          <div className="text-sm">{c.name} ({c.document})</div>
                        </ComboboxOption>
                      ))}
                    </ComboboxOptions>
                  </Combobox>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Póliza</label>
                  <Combobox
                    value={polizasCliente.find(p=> p.id === nuevoSeguimiento.poliza_id) || null}
                    onChange={(val: any)=> setNuevoSeguimiento(prev => ({...prev, poliza_id: val?.id}))}
                    onClose={()=> setPolizaQuery('')}
                    disabled={!nuevoSeguimiento.client_id}
                  >
                    <div className="relative z-[60]">
                      <ComboboxInput
                        as={Input}
                        className="w-full"
                        displayValue={(p: any)=> p ? `${p.numero_poliza || p.policy_number}` : ''}
                        onChange={(e)=> setPolizaQuery(e.target.value)}
                        placeholder={nuevoSeguimiento.client_id ? 'Buscar póliza' : 'Seleccione primero un cliente'}
                      />
                      <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                        <Icon icon="solar:alt-arrow-down-outline" height={20} />
                      </ComboboxButton>
                    </div>
                    <ComboboxOptions anchor="bottom" transition className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0">
                      {(polizaQuery ? polizasCliente.filter((p:any)=> (`${p.numero_poliza || p.policy_number}`).toLowerCase().includes(polizaQuery.toLowerCase())) : polizasCliente).map((p:any) => (
                        <ComboboxOption key={p.id} value={p} className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary">
                          <Icon icon="solar:check-read-linear" className="invisible group-data-[selected]:visible" height={20} />
                          <div className="text-sm">{p.numero_poliza || p.policy_number}</div>
                        </ComboboxOption>
                      ))}
                    </ComboboxOptions>
                  </Combobox>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1 block">Método de contacto</Label>
                  <ShSelect
                    value={nuevoSeguimiento.contact_method || undefined}
                    onValueChange={(val) => setNuevoSeguimiento(prev => ({ ...prev, contact_method: val as any }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No especificado" />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      <SelectItem value="phone">Teléfono</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="in_person">Presencial</SelectItem>
                      <SelectItem value="video_call">Videollamada</SelectItem>
                    </SelectContent>
                  </ShSelect>
                </div>
              </div>
              <FormField
                id="nuevo_fecha"
                name="scheduled_for"
                label="Fecha Programada"
                value={nuevoSeguimiento.scheduled_for}
                onChange={(e) => setNuevoSeguimiento(prev => ({...prev, scheduled_for: e.target.value}))}
                type="date"
              />
              <FormField
                id="nuevo_description"
                name="description"
                label="Descripción"
                value={nuevoSeguimiento.description}
                onChange={(e) => {
                  setNuevoSeguimiento(prev => ({...prev, description: e.target.value}));
                  if (nuevoErrores.description) setNuevoErrores(prev => ({...prev, description: ''}));
                }}
                type="textarea"
                placeholder="Descripción del seguimiento"
                required
                rows={3}
                error={nuevoErrores.description}
              />
            </div>
          </TitleCard>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            onClick={handleCreateSeguimiento} 
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saving}
            data-testid="btn-crear-seguimiento"
          >
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Crear Seguimiento
          </Button>
          <Button color="gray" onClick={() => setModalNuevoOpen(false)} disabled={saving}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal editar seguimiento */}
      <Modal show={modalEditarOpen} onClose={() => setModalEditarOpen(false)} size="lg" className="[--modal-z:60]">
        <Modal.Header>Editar Seguimiento</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_title" className="text-sm font-medium">Título <span className="text-red-500">*</span></Label>
              <Input 
                id="edit_title"
                value={editarSeguimiento.title}
                onChange={(e) => {
                  setEditarSeguimiento(prev => ({...prev, title: e.target.value}));
                  if (editarErrores.title) setEditarErrores(prev => ({...prev, title: ''}));
                }}
                placeholder="Título del seguimiento"
                className={editarErrores.title ? 'border-red-500' : ''}
              />
              {editarErrores.title && (<p className="text-red-500 text-xs mt-1">{editarErrores.title}</p>)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Tipo <span className="text-red-500">*</span></Label>
                <ShSelect
                  value={editarSeguimiento.type}
                  onValueChange={(val) => {
                    setEditarSeguimiento(prev => ({ ...prev, type: val as any }));
                    if (editarErrores.type) setEditarErrores(prev => ({...prev, type: ''}));
                  }}
                >
                  <SelectTrigger className={`w-full ${editarErrores.type ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="seguimiento_cliente">Seguimiento Cliente</SelectItem>
                    <SelectItem value="llamada">Llamada</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="visita">Visita</SelectItem>
                    <SelectItem value="reunion">Reunión</SelectItem>
                    <SelectItem value="documentacion">Documentación</SelectItem>
                    <SelectItem value="inspeccion">Inspección</SelectItem>
                    <SelectItem value="renovacion">Renovación</SelectItem>
                    <SelectItem value="siniestro">Siniestro</SelectItem>
                    <SelectItem value="cotizacion">Cotización</SelectItem>
                  </SelectContent>
                </ShSelect>
                {editarErrores.type && (<p className="text-red-500 text-xs mt-1">{editarErrores.type}</p>)}
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Prioridad <span className="text-red-500">*</span></Label>
                <ShSelect
                  value={editarSeguimiento.priority}
                  onValueChange={(val) => {
                    setEditarSeguimiento(prev => ({ ...prev, priority: val as any }));
                    if (editarErrores.priority) setEditarErrores(prev => ({...prev, priority: ''}));
                  }}
                >
                  <SelectTrigger className={`w-full ${editarErrores.priority ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </ShSelect>
                {editarErrores.priority && (<p className="text-red-500 text-xs mt-1">{editarErrores.priority}</p>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Asignado a</Label>
                <ShSelect
                  value={editarSeguimiento.assigned_to ? String(editarSeguimiento.assigned_to) : undefined}
                  onValueChange={(val) => setEditarSeguimiento(prev => ({ ...prev, assigned_to: val ? Number(val) : undefined }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Yo mismo" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    {usuarios.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </ShSelect>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <Combobox
                  value={clientes.find(c=> c.id === editarSeguimiento.client_id) || null}
                  onChange={async (val: any) => {
                    const clientId = val?.id as number | undefined;
                    setEditarSeguimiento(prev => ({...prev, client_id: clientId, poliza_id: undefined}));
                    await loadPolizasDeCliente(clientId);
                  }}
                  onClose={()=> setClienteQuery('')}
                >
                  <div className="relative z-[60]">
                    <ComboboxInput
                      as={Input}
                      className="w-full"
                      displayValue={(c: any)=> c ? `${c.name} (${c.document})` : ''}
                      onChange={(e)=> setClienteQuery(e.target.value)}
                      placeholder="Buscar cliente"
                    />
                    <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                      <Icon icon="solar:alt-arrow-down-outline" height={20} />
                    </ComboboxButton>
                  </div>
                  <ComboboxOptions anchor="bottom" transition className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0">
                    {clientes.map(c => (
                      <ComboboxOption key={c.id} value={c} className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary">
                        <Icon icon="solar:check-read-linear" className="invisible group-data-[selected]:visible" height={20} />
                        <div className="text-sm">{c.name} ({c.document})</div>
                      </ComboboxOption>
                    ))}
                  </ComboboxOptions>
                </Combobox>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Póliza</label>
                <Combobox
                  value={polizasCliente.find(p=> p.id === editarSeguimiento.poliza_id) || null}
                  onChange={(val: any)=> setEditarSeguimiento(prev => ({...prev, poliza_id: val?.id}))}
                  onClose={()=> setPolizaQuery('')}
                  disabled={!editarSeguimiento.client_id}
                >
                  <div className="relative z-[60]">
                    <ComboboxInput
                      as={Input}
                      className="w-full"
                      displayValue={(p: any)=> p ? `${p.numero_poliza || p.policy_number}` : ''}
                      onChange={(e)=> setPolizaQuery(e.target.value)}
                      placeholder={editarSeguimiento.client_id ? 'Buscar póliza' : 'Seleccione primero un cliente'}
                    />
                    <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                      <Icon icon="solar:alt-arrow-down-outline" height={20} />
                    </ComboboxButton>
                  </div>
                  <ComboboxOptions anchor="bottom" transition className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0">
                    {(polizaQuery ? polizasCliente.filter((p:any)=> (`${p.numero_poliza || p.policy_number}`).toLowerCase().includes(polizaQuery.toLowerCase())) : polizasCliente).map((p:any) => (
                      <ComboboxOption key={p.id} value={p} className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary">
                        <Icon icon="solar:check-read-linear" className="invisible group-data-[selected]:visible" height={20} />
                        <div className="text-sm">{p.numero_poliza || p.policy_number}</div>
                      </ComboboxOption>
                    ))}
                  </ComboboxOptions>
                </Combobox>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Método de contacto</Label>
                <ShSelect
                  value={editarSeguimiento.contact_method || undefined}
                  onValueChange={(val) => setEditarSeguimiento(prev => ({ ...prev, contact_method: val as any }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No especificado" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="phone">Teléfono</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="in_person">Presencial</SelectItem>
                    <SelectItem value="video_call">Videollamada</SelectItem>
                  </SelectContent>
                </ShSelect>
              </div>
            </div>
            <div>
              <Label htmlFor="edit_fecha" className="text-sm font-medium">Fecha Programada</Label>
              <Input 
                id="edit_fecha"
                type="datetime-local"
                value={editarSeguimiento.scheduled_for || ''}
                onChange={(e) => setEditarSeguimiento(prev => ({...prev, scheduled_for: e.target.value}))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Descripción <span className="text-red-500">*</span></Label>
              <Textarea 
                value={editarSeguimiento.description}
                onChange={(e) => {
                  setEditarSeguimiento(prev => ({...prev, description: e.target.value}));
                  if (editarErrores.description) setEditarErrores(prev => ({...prev, description: ''}));
                }}
                placeholder="Descripción del seguimiento"
                rows={3}
                className={editarErrores.description ? 'border-red-500' : ''}
              />
              {editarErrores.description && (<p className="text-red-500 text-xs mt-1">{editarErrores.description}</p>)}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            onClick={handleUpdateSeguimiento} 
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Actualizar Seguimiento
          </Button>
          <Button color="gray" onClick={() => setModalEditarOpen(false)} disabled={saving}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para cambiar estado */}
      <Modal show={showStateModal} onClose={() => setShowStateModal(false)} size="md">
        <Modal.Header>Cambiar Estado del Seguimiento</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Selecciona el nuevo estado para: <strong>{seguimientoToChangeState?.title}</strong>
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(SEGUIMIENTO_STATES).map(([key, state]) => (
                <div
                  key={key}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    newState === key 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setNewState(key)}
                >
                  <div className="flex items-center gap-3">
                    <Icon icon={state.icon} className="w-5 h-5" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{state.label}</div>
                      <div className="text-xs text-gray-500">
                        {key === 'pendiente' && 'El seguimiento está programado pero no ha iniciado'}
                        {key === 'en_progreso' && 'El seguimiento está siendo ejecutado actualmente'}
                        {key === 'completada' && 'El seguimiento ha sido completado exitosamente'}
                        {key === 'vencida' && 'El seguimiento no se completó en la fecha programada'}
                        {key === 'cancelada' && 'El seguimiento ha sido cancelado'}
                        {key === 'pausada' && 'El seguimiento está temporalmente pausado'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={confirmStateChange}
            disabled={changingState || !newState}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {changingState ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Cambiando...
              </>
            ) : (
              'Confirmar Cambio'
            )}
          </Button>
          <Button
            onClick={() => setShowStateModal(false)}
            disabled={changingState}
          >
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Seguimiento;
