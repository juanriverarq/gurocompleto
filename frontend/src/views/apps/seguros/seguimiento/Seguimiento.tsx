import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
  memo,
  useRef,
} from 'react';
import {
  Card,
  Badge,
  Button,
  Modal,
  Textarea,
  Spinner,
  Alert,
  Table,
  Dropdown,
} from 'flowbite-react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import {
  Select as ShSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from 'src/components/shadcn-ui/Default-Ui/select';
import { useToast } from 'src/hooks/use-toast';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useVendedores, useEmpleadosBroker } from 'src/hooks/useAdminCrudApi';
import TitleCard from 'src/components/shared/TitleBorderCard';
import FormField from 'src/components/shared/FormField';

import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { IconDots } from '@tabler/icons-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  seguimientoService,
  priorityConfigService,
  SeguimientoItem,
  CreateSeguimientoData,
  UpdateSeguimientoData,
  SeguimientoStatistics,
  PriorityConfig,
  getPriorityStyle,
  getNextNotificationInfo,
} from '../../../../services/seguimientoService';
import { saasApi } from '../../../../services/saasApi';
import { commercialTasksService } from 'src/services/commercialTasksService';
import PermissionGate from 'src/components/PermissionGate';
import { useSearchParams } from 'react-router-dom';

// Paleta de colores predefinida para el editor de prioridades
// Cada swatch define color hex, clase de fondo Tailwind y clase de texto Tailwind
const PRIORITY_COLOR_PALETTE: Array<{
  name: string;
  color: string;
  bg_color: string;
  text_color: string;
}> = [
  { name: 'Gris',      color: '#6B7280', bg_color: 'bg-gray-100',    text_color: 'text-gray-800' },
  { name: 'Zinc',      color: '#71717A', bg_color: 'bg-zinc-100',    text_color: 'text-zinc-800' },
  { name: 'Rojo',      color: '#EF4444', bg_color: 'bg-red-100',     text_color: 'text-red-800' },
  { name: 'Rosa',      color: '#EC4899', bg_color: 'bg-pink-100',    text_color: 'text-pink-800' },
  { name: 'Morado',    color: '#A855F7', bg_color: 'bg-purple-100',  text_color: 'text-purple-800' },
  { name: 'Índigo',    color: '#6366F1', bg_color: 'bg-indigo-100',  text_color: 'text-indigo-800' },
  { name: 'Azul',      color: '#3B82F6', bg_color: 'bg-blue-100',    text_color: 'text-blue-800' },
  { name: 'Cyan',      color: '#06B6D4', bg_color: 'bg-cyan-100',    text_color: 'text-cyan-800' },
  { name: 'Teal',      color: '#14B8A6', bg_color: 'bg-teal-100',    text_color: 'text-teal-800' },
  { name: 'Esmeralda', color: '#10B981', bg_color: 'bg-emerald-100', text_color: 'text-emerald-800' },
  { name: 'Verde',     color: '#22C55E', bg_color: 'bg-green-100',   text_color: 'text-green-800' },
  { name: 'Lima',      color: '#84CC16', bg_color: 'bg-lime-100',    text_color: 'text-lime-800' },
  { name: 'Amarillo',  color: '#F59E0B', bg_color: 'bg-yellow-100',  text_color: 'text-yellow-800' },
  { name: 'Ámbar',     color: '#D97706', bg_color: 'bg-amber-100',   text_color: 'text-amber-800' },
  { name: 'Naranja',   color: '#F97316', bg_color: 'bg-orange-100',  text_color: 'text-orange-800' },
];

// Catálogo curado de iconos de Solar para prioridades
const PRIORITY_ICON_CATALOG: string[] = [
  'solar:flag-bold-duotone',
  'solar:flag-2-bold-duotone',
  'solar:flag-3-bold-duotone',
  'solar:shield-warning-bold-duotone',
  'solar:shield-check-bold-duotone',
  'solar:shield-star-bold-duotone',
  'solar:shield-keyhole-bold-duotone',
  'solar:danger-triangle-bold-duotone',
  'solar:danger-circle-bold-duotone',
  'solar:danger-square-bold-duotone',
  'solar:bell-bold-duotone',
  'solar:bell-bing-bold-duotone',
  'solar:star-bold-duotone',
  'solar:star-circle-bold-duotone',
  'solar:fire-bold-duotone',
  'solar:bolt-bold-duotone',
  'solar:bolt-circle-bold-duotone',
  'solar:rocket-bold-duotone',
  'solar:rocket-2-bold-duotone',
  'solar:crown-bold-duotone',
  'solar:crown-star-bold-duotone',
  'solar:medal-star-bold-duotone',
  'solar:medal-ribbon-star-bold-duotone',
  'solar:target-bold-duotone',
  'solar:clock-circle-bold-duotone',
  'solar:alarm-bold-duotone',
  'solar:stopwatch-bold-duotone',
  'solar:hourglass-bold-duotone',
  'solar:checklist-minimalistic-bold-duotone',
  'solar:check-circle-bold-duotone',
  'solar:heart-bold-duotone',
  'solar:lightbulb-bolt-bold-duotone',
  'solar:siren-bold-duotone',
  'solar:cup-star-bold-duotone',
];

// Presets de tiempo (en minutos) para botones rápidos
const FIRST_NOTIF_PRESETS: Array<{ label: string; value: number }> = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '4h', value: 240 },
  { label: '8h', value: 480 },
  { label: '12h', value: 720 },
  { label: '1d', value: 1440 },
  { label: '2d', value: 2880 },
  { label: '3d', value: 4320 },
];

const REPEAT_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Sin repetir', value: 0 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '4h', value: 240 },
  { label: '6h', value: 360 },
  { label: '12h', value: 720 },
  { label: '1d', value: 1440 },
];

const formatMinutes = (minutes: number): string => {
  if (minutes === 0) return '0min';
  if (minutes >= 1440) {
    const days = minutes / 1440;
    return `${days % 1 === 0 ? days : days.toFixed(1)}d`;
  }
  if (minutes >= 60) {
    const h = minutes / 60;
    return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
  }
  return `${minutes}min`;
};

// Estados dinámicos de seguimiento (basados en el backend real)
const SEGUIMIENTO_STATES = {
  pendiente: {
    label: 'Pendiente',
    color: 'bg-yellow-100 text-yellow-800',
    icon: 'solar:clock-circle-bold-duotone',
  },
  en_progreso: {
    label: 'En Progreso',
    color: 'bg-blue-100 text-blue-800',
    icon: 'solar:settings-bold-duotone',
  },
  completada: {
    label: 'Completada',
    color: 'bg-green-100 text-green-800',
    icon: 'solar:check-circle-bold-duotone',
  },
  vencida: {
    label: 'Vencida',
    color: 'bg-red-100 text-red-800',
    icon: 'solar:danger-circle-bold-duotone',
  },
  cancelada: {
    label: 'Cancelada',
    color: 'bg-gray-100 text-gray-800',
    icon: 'solar:close-circle-bold-duotone',
  },
  pausada: {
    label: 'Pausada',
    color: 'bg-purple-100 text-purple-800',
    icon: 'solar:pause-circle-bold-duotone',
  },
};

// Componente optimizado para filas de tabla
const SeguimientoTableRow = memo(
  ({
    item,
    onEdit,
    onChangeState,
    onDelete,
    onViewDetails,
    onShowBitacora,
    onReassign,
    onComplete,
    getTipoIcon,
    priorityConfigs,
  }: {
    item: SeguimientoItem;
    onEdit: (item: SeguimientoItem) => void;
    onChangeState: (item: SeguimientoItem) => void;
    onDelete: (id: number) => void;
    onViewDetails: (item: SeguimientoItem) => void;
    onShowBitacora: (item: SeguimientoItem) => void;
    onReassign: (item: SeguimientoItem) => void;
    onComplete: (item: SeguimientoItem) => void;
    getTipoIcon: (type: string) => string;
    priorityConfigs: Record<string, PriorityConfig>;
  }) => {
    const { hasPermission } = useUnifiedAuth();
    const canEdit = hasPermission('seguimiento_comercial', 'editar');
    const canDelete = hasPermission('seguimiento_comercial', 'eliminar');
    const stateConfig =
      SEGUIMIENTO_STATES[item.status as keyof typeof SEGUIMIENTO_STATES] ||
      SEGUIMIENTO_STATES['pendiente'];

    const priConfig = priorityConfigs[item.priority];
    const fallbackPri = {
      baja: { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'solar:flag-bold-duotone', label: 'Baja' },
      media: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'solar:flag-2-bold-duotone', label: 'Media' },
      alta: { bg: 'bg-orange-100', text: 'text-orange-800', icon: 'solar:shield-warning-bold-duotone', label: 'Alta' },
      critica: { bg: 'bg-red-100', text: 'text-red-800', icon: 'solar:danger-triangle-bold-duotone', label: 'Crítica' },
    };
    const priStyle = getPriorityStyle(priConfig, fallbackPri[item.priority as keyof typeof fallbackPri]);
    const notif = getNextNotificationInfo(item, priConfig);

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
          {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap pr-8">
          <div className="text-sm">
            {item.client?.name ? (
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.client.name}
                </div>
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
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${priStyle.bg} ${priStyle.text}`}>
            <Icon icon={priStyle.icon} className="w-3.5 h-3.5" />
            {priStyle.label}
          </span>
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap pr-8">
          <div className="text-sm text-gray-900 dark:text-white">
            {(item.due_date || item.scheduled_for)
              ? format(new Date((item.due_date || item.scheduled_for)!), 'dd/MM/yyyy HH:mm', { locale: es })
              : '-'}
          </div>
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap pr-8">
          <div className="text-xs text-gray-500">
            {notif.due ? (
              <span className="text-red-500 font-medium flex items-center gap-1">
                <Icon icon="solar:bell-bold-duotone" className="w-3.5 h-3.5" />
                {notif.text}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400">
                <Icon icon="solar:bell-bing-bold-duotone" className="w-3.5 h-3.5" />
                {notif.text}
              </span>
            )}
          </div>
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap pr-8">
          <div className="text-sm text-gray-900 dark:text-white">
            {item.assigned_user?.name || 'Sin asignar'}
          </div>
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap text-right">
          <div className="relative inline-block">
            <Dropdown
              label=""
              dismissOnClick={false}
              placement="left-start"
              renderTrigger={() => (
                <span className="h-8 w-8 flex justify-center items-center rounded-lg hover:bg-[#573CFF]/10 hover:text-[#573CFF] cursor-pointer transition-colors">
                  <IconDots size={18} />
                </span>
              )}
            >
              <Dropdown.Item onClick={() => onViewDetails(item)} className="flex gap-2 text-sm">
                <Icon icon="solar:eye-bold-duotone" height={16} />
                <span>Ver Detalles</span>
              </Dropdown.Item>
              {canEdit && (
                <Dropdown.Item onClick={() => onEdit(item)} className="flex gap-2 text-sm">
                  <Icon icon="solar:pen-new-square-bold-duotone" height={16} />
                  <span>Editar</span>
                </Dropdown.Item>
              )}
              <Dropdown.Item onClick={() => onShowBitacora(item)} className="flex gap-2 text-sm">
                <Icon icon="solar:book-bookmark-bold-duotone" height={16} />
                <span>Bitácora</span>
              </Dropdown.Item>
              {canEdit && (
                <Dropdown.Item onClick={() => onReassign(item)} className="flex gap-2 text-sm">
                  <Icon icon="solar:users-group-rounded-bold-duotone" height={16} />
                  <span>Reasignar</span>
                </Dropdown.Item>
              )}
              <Dropdown.Divider />
              {canEdit && item.status !== 'completada' && (
                <Dropdown.Item onClick={() => onComplete(item)} className="flex gap-2 text-sm text-emerald-600">
                  <Icon icon="solar:check-circle-bold-duotone" height={16} />
                  <span>Marcar Completada</span>
                </Dropdown.Item>
              )}
              {canEdit && (
                <Dropdown.Item onClick={() => onChangeState(item)} className="flex gap-2 text-sm">
                  <Icon icon="solar:refresh-circle-bold-duotone" height={16} />
                  <span>Cambiar Estado</span>
                </Dropdown.Item>
              )}
              <Dropdown.Divider />
              {canDelete && (
                <Dropdown.Item 
                  className="text-red-600 flex gap-2 text-sm"
                  onClick={() => onDelete(item.id)}
                >
                  <Icon icon="solar:trash-bin-trash-bold-duotone" height={16} />
                  <span>Eliminar</span>
                </Dropdown.Item>
              )}
            </Dropdown>
          </div>
        </Table.Cell>
      </Table.Row>
    );
  },
);

const Seguimiento: React.FC = () => {
  const { toast } = useToast();
  const { user, hasPermission } = useUnifiedAuth();
  const { vendedores: vendedoresHook } = useVendedores();
  const { empleados: empleadosHook } = useEmpleadosBroker();
  const [isPending, startTransition] = useTransition();

  const canCreate = hasPermission('seguimiento_comercial', 'crear');
  const [seguimientos, setSeguimientos] = useState<SeguimientoItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [statistics, setStatistics] = useState<SeguimientoStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Estados de filtros
  const [filters, setFilters] = useState({
    search: '',
    estado: 'todos',
    tipo: 'todos',
    prioridad: 'todas',
    asignado: '',
    fecha_desde: '',
    fecha_hasta: '',
    client_id: undefined as number | undefined,
    poliza_id: undefined as number | undefined,
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
  const [seguimientoToChangeState, setSeguimientoToChangeState] = useState<SeguimientoItem | null>(
    null,
  );
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
  // Catálogo de aseguradoras para el selector "Asignar a → Aseguradoras"
  const [aseguradorasList, setAseguradorasList] = useState<Array<{ id: number; nombre: string }>>([]);
  // Catálogo de financieras / bancos (mismo listado que en Editar Póliza → campo Banco)
  const financierasList = React.useMemo(() => [
    // Financieras de primas / entidades del sector asegurador
    'Finesa', 'Crediseguros', 'Sura', 'Crediestado', 'Previseguro',
    // Bancos tradicionales
    'Bancolombia', 'Banco de Bogotá', 'BBVA Colombia', 'Davivienda', 'Itaú Colombia',
    'Scotiabank Colpatria', 'Banco de Occidente', 'Banco Popular', 'Banco AV Villas',
    'Banco Caja Social', 'Banco Agrario', 'Banco Falabella', 'Banco Finandina',
    'Banco Pichincha', 'Banco GNB Sudameris', 'Banco W', 'Banco Serfinanza',
    'Lulo Bank', 'Nu (Nubank) Colombia', 'Coopcentral', 'Bancoomeva',
  ], []);
  const [clienteQuery, setClienteQuery] = useState<string>('');
  const [polizaQuery, setPolizaQuery] = useState<string>('');

  // Configuración de prioridades
  const [priorityConfigs, setPriorityConfigs] = useState<Record<string, PriorityConfig>>({});
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Bitácora
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraTask, setBitacoraTask] = useState<SeguimientoItem | null>(null);
  const [bitacoraEntries, setBitacoraEntries] = useState<any[]>([]);
  const [bitacoraNotes, setBitacoraNotes] = useState<any[]>([]);
  const [bitacoraNote, setBitacoraNote] = useState('');
  const [bitacoraIsPrivate, setBitacoraIsPrivate] = useState(false);
  const [loadingBitacora, setLoadingBitacora] = useState(false);

  // Reasignar
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTask, setReassignTask] = useState<SeguimientoItem | null>(null);
  const [reassignUserId, setReassignUserId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignUsers, setReassignUsers] = useState<any[]>([]);
  const [loadingReassign, setLoadingReassign] = useState(false);
  const [nuevoErrores, setNuevoErrores] = useState<Record<string, string>>({});
  const [editarErrores, setEditarErrores] = useState<Record<string, string>>({});

  // Cargar usuarios y clientes cuando se abren modales
  // Cargar usuarios al montar el componente (para el filtro "Asignado a")
  useEffect(() => {
    loadUsuarios();
  }, [vendedoresHook, empleadosHook]);

  useEffect(() => {
    if (modalNuevoOpen || modalEditarOpen) {
      // Cargar clientes iniciales para los combobox
      if (clientes.length === 0) {
        loadClientes();
      }
    }
  }, [modalNuevoOpen, modalEditarOpen]);

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
    // Cargar configuraciones de prioridad
    loadPriorityConfigs();
    // Cargar aseguradoras (para el selector "Asignar a → Aseguradoras")
    (async () => {
      try {
        const r = await saasApi.getAseguradoras();
        const arr = (r as any)?.data?.data || (r as any)?.data || [];
        setAseguradorasList(
          (Array.isArray(arr) ? arr : []).map((a: any) => ({
            id: a.id,
            nombre: a.nombre || a.name || `Aseguradora ${a.id}`,
          })),
        );
      } catch { /* no bloquear UI */ }
    })();
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
  }, [
    filters.estado,
    filters.tipo,
    filters.prioridad,
    filters.asignado,
    filters.fecha_desde,
    filters.fecha_hasta,
    filters.client_id,
    filters.poliza_id,
    currentPage,
    perPage,
  ]);

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

      const response = await seguimientoService.getSeguimientos(
        {
          search: filters.search || undefined,
          status: filters.estado && filters.estado !== 'todos' ? filters.estado : undefined,
          type: filters.tipo && filters.tipo !== 'todos' ? filters.tipo : undefined,
          priority:
            filters.prioridad && filters.prioridad !== 'todas' ? filters.prioridad : undefined,
          assigned_to: filters.asignado ? Number(filters.asignado) : undefined,
          due_date_from: filters.fecha_desde || undefined,
          due_date_to: filters.fecha_hasta || undefined,
          client_id: filters.client_id,
          poliza_id: filters.poliza_id,
          page: currentPage,
          per_page: perPage,
        },
        signal,
      );

      console.log('[DEBUG] Seguimientos cargados:', response.data);
      setSeguimientos(response.data || []);
      setTotalItems(response.total || 0);
      setTotalPages(Math.ceil((response.total || 0) / perPage));

      // Cargar estadísticas solo la primera vez y de forma lazy
      if (currentPage === 1 && !statistics) {
        setTimeout(() => loadStatistics(), 100); // Lazy load statistics
      }
    } catch (error: any) {
      console.error('[ERROR] Error loading seguimientos:', error);
      console.error('[ERROR] Error details:', error.message, error.stack);
      setError('Error al cargar tareas: ' + error.message);
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

  const loadPriorityConfigs = async (autoSeedIfEmpty = false) => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const response = await priorityConfigService.getConfigs();
      const list = response.data || [];
      const map: Record<string, PriorityConfig> = {};
      list.forEach((c) => {
        map[c.priority_key] = c;
      });

      // Fallback: si el backend no tiene configs todavía, sembrar defaults
      if (Object.keys(map).length === 0 && autoSeedIfEmpty) {
        const seeded = await priorityConfigService.resetDefaults();
        (seeded.data || []).forEach((c: any) => { map[c.priority_key] = c; });
      }

      setPriorityConfigs(map);
    } catch (error: any) {
      console.error('Error loading priority configs:', error);
      setConfigError(error?.message || 'No se pudieron cargar las configuraciones de prioridad');
    } finally {
      setConfigLoading(false);
    }
  };

  // Recargar (y sembrar si hace falta) al abrir el modal
  useEffect(() => {
    if (showConfigModal) {
      loadPriorityConfigs(true);
    }
  }, [showConfigModal]);

  // ═══════ Bitácora ═══════
  const openBitacoraModal = useCallback(async (item: SeguimientoItem) => {
    setBitacoraTask(item);
    setBitacoraOpen(true);
    setBitacoraEntries([]);
    setBitacoraNotes([]);
    setBitacoraNote('');
    setBitacoraIsPrivate(false);
    try {
      setLoadingBitacora(true);
      const log = await commercialTasksService.getActivityLog(item.id);
      const notes = log.filter((e: any) => e.activity === 'Nota agregada');
      const history = log.filter((e: any) => e.activity !== 'Nota agregada');
      setBitacoraNotes(notes);
      setBitacoraEntries(history);
    } catch (e: any) {
      toast({ title: 'Error al cargar bitácora', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingBitacora(false);
    }
  }, []);

  const submitBitacoraNote = useCallback(async () => {
    if (!bitacoraTask || !bitacoraNote.trim()) return;
    try {
      setLoadingBitacora(true);
      const log = await commercialTasksService.addNote(bitacoraTask.id, bitacoraNote.trim(), bitacoraIsPrivate);
      const notes = (log || []).filter((e: any) => e.activity === 'Nota agregada');
      const history = (log || []).filter((e: any) => e.activity !== 'Nota agregada');
      setBitacoraNotes(notes);
      setBitacoraEntries(history);
      setBitacoraNote('');
      setBitacoraIsPrivate(false);
      toast({ title: 'Nota agregada' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingBitacora(false);
    }
  }, [bitacoraTask, bitacoraNote, bitacoraIsPrivate]);

  // ═══════ Reasignar ═══════
  const openReassignModal = useCallback(async (item: SeguimientoItem) => {
    setReassignTask(item);
    setReassignUserId('');
    setReassignReason('');
    setReassignOpen(true);
    if (reassignUsers.length === 0) {
      try {
        const users = await commercialTasksService.getUsers();
        setReassignUsers(users || []);
      } catch (e) {
        console.warn('No se pudieron cargar usuarios para reasignar', e);
      }
    }
  }, [reassignUsers.length]);

  const submitReassign = useCallback(async () => {
    if (!reassignTask || !reassignUserId) return;
    try {
      setLoadingReassign(true);
      await commercialTasksService.reassignTask(reassignTask.id, Number(reassignUserId), reassignReason || undefined);
      await loadSeguimientos();
      setReassignOpen(false);
      toast({ title: 'Tarea reasignada' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingReassign(false);
    }
  }, [reassignTask, reassignUserId, reassignReason]);

  // ═══════ Marcar completada (rápido) ═══════
  const handleQuickComplete = useCallback(async (item: SeguimientoItem) => {
    if (!confirm(`¿Marcar "${item.title}" como completada?`)) return;
    try {
      await commercialTasksService.completeTask(item.id, { notes: 'Completada desde el listado' });
      await loadSeguimientos();
      toast({ title: 'Tarea completada' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  }, []);

  // Deep-link: ?task=ID abre el detalle de la tarea (desde calendario / topbar)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const taskParam = searchParams.get('task');
    if (!taskParam) return;
    const taskId = Number(taskParam);
    if (!Number.isFinite(taskId)) return;
    (async () => {
      try {
        const res = await seguimientoService.getSeguimiento(taskId);
        if (res?.data) {
          setSelectedItem(res.data);
          setModalOpen(true);
        }
      } catch (e) {
        console.warn('[Seguimiento] no se pudo cargar tarea desde deep-link', e);
      } finally {
        // Limpiar el query param para que recargas no reabran el modal
        const next = new URLSearchParams(searchParams);
        next.delete('task');
        setSearchParams(next, { replace: true });
      }
    })();
  }, [searchParams]);

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
      // El backend getUsers() ya devuelve TODOS los asignables del broker:
      // usuarios reales, empleados con shadow-user (resueltos a su nombre real)
      // y empleados sin shadow-user (usando su empleado_brokers.id directamente).
      // No mezclamos con los hooks para evitar colisión de IDs entre tablas.
      const response = await seguimientoService.getUsers();
      const lista = (response.data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        tipo: (u as any).type === 'empleado' ? 'empleado' : 'user',
      }));
      setUsuarios(lista);
    } catch (error) {
      console.error('Error loading usuarios:', error);
      setUsuarios([]);
    }
  };

  const loadPolizasDeCliente = async (clientId?: number) => {
    try {
      if (!clientId) {
        setPolizasCliente([]);
        return;
      }
      const res = await saasApi.getPolizas({ client_id: Number(clientId), per_page: 100 });
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
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
      cotizacion: 'solar:calculator-bold-duotone',
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
      pausada: { color: 'purple', text: 'Pausado' },
    };
    const config = estados[estado as keyof typeof estados] || { color: 'gray', text: estado };
    return <Badge color={config.color}>{config.text}</Badge>;
  };

  const getPrioridadBadge = (prioridad: SeguimientoItem['priority']) => {
    const config = priorityConfigs[prioridad];
    const fallback = {
      baja: { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'solar:flag-bold-duotone', label: 'Baja' },
      media: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'solar:flag-2-bold-duotone', label: 'Media' },
      alta: { bg: 'bg-orange-100', text: 'text-orange-800', icon: 'solar:shield-warning-bold-duotone', label: 'Alta' },
      critica: { bg: 'bg-red-100', text: 'text-red-800', icon: 'solar:danger-triangle-bold-duotone', label: 'Crítica' },
    };
    const style = getPriorityStyle(config, fallback[prioridad as keyof typeof fallback]);
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon icon={style.icon} className="w-3.5 h-3.5" />
        {style.label}
      </span>
    );
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
      pausada: 'purple',
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
      pausada: 'Pausado',
    };
    return estados[estado as keyof typeof estados] || estado;
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

      // Filtrar campos undefined para evitar enviarlos al backend
      const dataToSend: any = {};
      Object.entries(nuevoSeguimiento).forEach(([key, value]) => {
        // No enviar assigned_to si no está definido o es 0
        if (key === 'assigned_to' && (!value || value === 0)) {
          return;
        }
        if (value !== undefined && value !== null && value !== '') {
          dataToSend[key] = value;
        }
      });

      console.log('[DEBUG CREAR] Datos a enviar:', dataToSend);
      console.log('[DEBUG CREAR] Usuarios disponibles:', usuarios);
      console.log(
        '[DEBUG CREAR] Cliente seleccionado:',
        clientes.find((c) => c.id === nuevoSeguimiento.client_id),
      );

      await seguimientoService.createSeguimiento(dataToSend);

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
      setError('Error al crear tarea: ' + error.message);
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

      // Filtrar campos undefined para evitar enviarlos al backend
      const dataToSend: any = {};
      Object.entries(editarSeguimiento).forEach(([key, value]) => {
        // No enviar assigned_to si no está definido o es 0
        if (key === 'assigned_to' && (!value || value === 0)) {
          return;
        }
        if (value !== undefined && value !== null && value !== '') {
          dataToSend[key] = value;
        }
      });

      console.log('[DEBUG] Datos a enviar al actualizar seguimiento:', dataToSend);
      console.log('[DEBUG] Usuario asignado original:', editarItem?.assigned_to);
      console.log('[DEBUG] Usuario asignado en formulario:', editarSeguimiento.assigned_to);

      await seguimientoService.updateSeguimiento(editarItem.id, dataToSend);

      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();

      // Cerrar modal
      setModalEditarOpen(false);
      setEditarItem(null);
      setEditarErrores({});
    } catch (error: any) {
      setError('Error al actualizar tarea: ' + error.message);
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

      toast({
        title: 'Seguimiento eliminado',
        description: 'El seguimiento ha sido eliminado exitosamente.',
      });
    } catch (error: any) {
      setError('Error al eliminar seguimiento: ' + error.message);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el seguimiento.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: 'Selección vacía',
        description: 'Debes seleccionar al menos un seguimiento para eliminar.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.length} seguimiento(s)?`)) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Eliminar uno por uno
      for (const id of selectedIds) {
        await seguimientoService.deleteSeguimiento(id);
      }

      // Limpiar selección
      setSelectedIds([]);

      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();

      toast({
        title: 'Seguimientos eliminados',
        description: `Se eliminaron ${selectedIds.length} seguimiento(s) exitosamente.`,
      });
    } catch (error: any) {
      setError('Error al eliminar seguimientos: ' + error.message);
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar todos los seguimientos.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStateMultiple = async (newStatus: string) => {
    if (selectedIds.length === 0) {
      toast({
        title: 'Selección vacía',
        description: 'Debes seleccionar al menos un seguimiento.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Cambiar estado uno por uno
      for (const id of selectedIds) {
        await seguimientoService.updateSeguimiento(id, { status: newStatus as any });
      }

      // Limpiar selección
      setSelectedIds([]);

      // Recargar lista
      await loadSeguimientos();
      await loadStatistics();

      toast({
        title: 'Estados actualizados',
        description: `Se actualizaron ${selectedIds.length} seguimiento(s) a "${
          SEGUIMIENTO_STATES[newStatus as keyof typeof SEGUIMIENTO_STATES]?.label
        }".`,
      });
    } catch (error: any) {
      setError('Error al cambiar estados: ' + error.message);
      toast({
        title: 'Error',
        description: 'No se pudieron actualizar todos los seguimientos.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === seguimientos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(seguimientos.map((s) => s.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
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
        notes: 'Completado desde la interfaz',
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
          notes: 'Completado desde la interfaz',
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
      cancelada: 0,
      pausada: 0,
      due_today: 0,
      due_this_week: 0,
      needing_follow_up: 0,
      by_type: {},
      by_priority: {},
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
          stats.completed++;
          break;
        case 'vencida':
          stats.overdue++;
          break;
        case 'cancelada':
          stats.cancelada++;
          break;
        case 'pausada':
          stats.pausada++;
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
        if (
          followUpDate <= today &&
          (item.status === 'pendiente' || item.status === 'en_progreso')
        ) {
          stats.needing_follow_up++;
        }
      }
    });

    return stats;
  };

  const openEditModal = useCallback(async (item: SeguimientoItem) => {
    setEditarItem(item);
    setEditarSeguimiento({
      title: item.title,
      description: item.description || '',
      type: item.type,
      priority: item.priority,
      scheduled_for: item.scheduled_for
        ? new Date(item.scheduled_for).toISOString().slice(0, 16)
        : '',
      client_id: item.client_id,
      poliza_id: item.poliza_id,
      assigned_to: item.assigned_to,
      contact_method: item.contact_method,
    });

    // Cargar el cliente actual si existe
    if (item.client && item.client_id) {
      setClientes((prev) => {
        const exists = prev.find((c) => c.id === item.client_id);
        if (!exists && item.client) {
          return [
            ...prev,
            {
              id: item.client.id,
              name: item.client.name,
              document: item.client.document,
              email: item.client.email,
              phone: item.client.phone,
            },
          ];
        }
        return prev;
      });
    }

    // Cargar pólizas del cliente si existe
    if (item.client_id) {
      await loadPolizasDeCliente(item.client_id);
    }

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
        status: newState,
      });

      // Actualizar la lista local
      setSeguimientos((prev): SeguimientoItem[] =>
        prev.map((s) => (s.id === seguimientoToChangeState.id ? { ...s, status: newState } : s)),
      );

      setShowStateModal(false);
      setSeguimientoToChangeState(null);
      setNewState('pendiente');

      toast({
        title: 'Estado actualizado',
        description: `El seguimiento ahora está en estado "${
          SEGUIMIENTO_STATES[newState as keyof typeof SEGUIMIENTO_STATES]?.label
        }".`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del seguimiento.',
        variant: 'destructive',
      });
    } finally {
      setChangingState(false);
    }
  };

  if (loading && seguimientos.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-2 text-lg">Cargando tareas...</span>
      </div>
    );
  }

  return (
    <PermissionGate
      route="/apps/seguros/seguimiento"
      action="ver"
      fallback={
        <Alert color="warning" className="my-6">
          No tienes permisos para ver Tareas.
        </Alert>
      }
    >
      {/* Header idéntico a clientes */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Gestión de Tareas
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Administra y realiza seguimiento a todas las tareas comerciales
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            color="light"
            size="sm"
            onClick={() => setShowConfigModal(true)}
            className="rounded-[10px] h-10"
            title="Configurar prioridades"
          >
            <Icon icon="solar:settings-bold-duotone" className="w-4 h-4 mr-1.5" />
            Configurar Prioridades
          </Button>
        </div>
      </div>

      {/* Tabs de Estado */}
      {statistics && (
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'todos', label: 'Todos', count: statistics.total, icon: 'solar:folder-bold-duotone', activeClass: 'bg-[#573CFF] text-white shadow-md', inactiveClass: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300' },
            { key: 'pendiente', label: 'Pendientes', count: statistics.pending, icon: 'solar:clock-circle-bold-duotone', activeClass: 'bg-yellow-500 text-white shadow-md', inactiveClass: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
            { key: 'en_progreso', label: 'En Progreso', count: statistics.in_progress, icon: 'solar:settings-bold-duotone', activeClass: 'bg-blue-500 text-white shadow-md', inactiveClass: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
            { key: 'completada', label: 'Completadas', count: statistics.completed, icon: 'solar:check-circle-bold-duotone', activeClass: 'bg-green-500 text-white shadow-md', inactiveClass: 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
            { key: 'vencida', label: 'Vencidas', count: statistics.overdue, icon: 'solar:danger-circle-bold-duotone', activeClass: 'bg-red-500 text-white shadow-md', inactiveClass: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
            { key: 'cancelada', label: 'Canceladas', count: statistics.cancelada, icon: 'solar:close-circle-bold-duotone', activeClass: 'bg-gray-600 text-white shadow-md', inactiveClass: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400' },
            { key: 'pausada', label: 'Pausadas', count: statistics.pausada, icon: 'solar:pause-circle-bold-duotone', activeClass: 'bg-purple-500 text-white shadow-md', inactiveClass: 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilters((prev) => ({ ...prev, estado: tab.key }));
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                filters.estado === tab.key ? tab.activeClass : tab.inactiveClass
              }`}
            >
              <Icon icon={tab.icon} className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-xs font-bold ${
                filters.estado === tab.key ? 'bg-white/20 text-white' : 'bg-black/5 text-current'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Header de Controles */}
      <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 space-y-4">
          {/* Fila 1: Búsqueda + Acciones */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Icon
                  icon="solar:magnifer-bold-duotone"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                />
                <Input
                  placeholder="Buscar por título, descripción o cliente..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
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
                <Icon
                  icon="solar:refresh-bold-duotone"
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>

              {canCreate && (
                <HeroButton icon="solar:add-circle-bold-duotone" onClick={() => setModalNuevoOpen(true)}>Nueva Tarea</HeroButton>
              )}
            </div>
          </div>

          {/* Fila 2: Filtros Cliente + Póliza + Limpiar */}
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            {/* Filtro Cliente */}
            <div className="w-full lg:w-72">
              <Combobox
                value={clientes.find((c) => c.id === filters.client_id) || null}
                onChange={(val: any) => {
                  const clientId = val?.id as number | undefined;
                  setFilters((prev) => ({ ...prev, client_id: clientId, poliza_id: undefined }));
                  setCurrentPage(1);
                  if (clientId) {
                    loadPolizasDeCliente(clientId);
                  } else {
                    setPolizasCliente([]);
                  }
                }}
                onClose={() => setClienteQuery('')}
              >
                <div className="relative">
                  <ComboboxInput
                    as={Input}
                    className="w-full h-10 text-sm rounded-[10px]"
                    displayValue={(c: any) => (c ? `${c.name} (${c.document})` : '')}
                    onChange={(e) => setClienteQuery(e.target.value)}
                    placeholder="Filtrar por cliente..."
                  />
                  <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                    <Icon icon="solar:alt-arrow-down-outline" height={20} className="text-gray-400" />
                  </ComboboxButton>
                  {filters.client_id && (
                    <button
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, client_id: undefined, poliza_id: undefined }));
                        setPolizasCliente([]);
                      }}
                      className="absolute inset-y-0 right-8 flex items-center px-1 text-gray-400 hover:text-gray-600"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" height={16} />
                    </button>
                  )}
                </div>
                <ComboboxOptions
                  anchor="bottom"
                  transition
                  className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                >
                  {clientes.length === 0 && clienteQuery.length >= 2 && (
                    <div className="px-3 py-2 text-sm text-gray-500">No se encontraron clientes</div>
                  )}
                  {clientes.map((c) => (
                    <ComboboxOption
                      key={c.id}
                      value={c}
                      className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary px-3 py-2"
                    >
                      <Icon
                        icon="solar:check-read-linear"
                        className="invisible group-data-[selected]:visible mr-2"
                        height={20}
                      />
                      <div className="text-sm">
                        {c.name} <span className="text-gray-400">({c.document})</span>
                      </div>
                    </ComboboxOption>
                  ))}
                </ComboboxOptions>
              </Combobox>
            </div>

            {/* Filtro Asignado a */}
            <div className="w-full lg:w-56">
              <ShSelect
                value={filters.asignado || undefined}
                onValueChange={(val) => {
                  setFilters((prev) => ({ ...prev, asignado: val === '__todos__' ? '' : val }));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full h-10 text-sm rounded-[10px]">
                  <SelectValue placeholder="Asignado a..." />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-[50vh]" position="popper" side="bottom" sideOffset={4}>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {usuarios.filter((u) => u.tipo !== 'vendedor').length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
                        Yo mismo / empleados
                      </div>
                      {usuarios.filter((u) => u.tipo !== 'vendedor').map((u) => (
                        <SelectItem key={`filtro-user-${u.id}`} value={String(u.id)}>
                          {u.name} {u.email ? `(${u.email})` : ''}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {usuarios.filter((u) => u.tipo === 'vendedor').length > 0 && (
                    <>
                      <div className="px-2 py-1 mt-1 text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide border-t border-gray-200 dark:border-neutral-800">
                        Vendedores
                      </div>
                      {usuarios.filter((u) => u.tipo === 'vendedor').map((u) => (
                        <SelectItem key={`filtro-vend-${u.id}`} value={String(u.id)}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </ShSelect>
            </div>

            {/* Filtro Póliza (dependiente de cliente) */}
            <div className="w-full lg:w-64">
              <Combobox
                value={polizasCliente.find((p) => p.id === filters.poliza_id) || null}
                onChange={(val: any) => {
                  setFilters((prev) => ({ ...prev, poliza_id: val?.id }));
                  setCurrentPage(1);
                }}
                onClose={() => setPolizaQuery('')}
              >
                <div className="relative">
                  <ComboboxInput
                    as={Input}
                    className={`w-full h-10 text-sm rounded-[10px] ${!filters.client_id ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                    displayValue={(p: any) =>
                      p ? `${p.numero_poliza || p.policy_number}` : ''
                    }
                    onChange={(e) => setPolizaQuery(e.target.value)}
                    placeholder={
                      filters.client_id ? 'Filtrar por póliza...' : 'Seleccione primero un cliente'
                    }
                    disabled={!filters.client_id}
                  />
                  <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                    <Icon icon="solar:alt-arrow-down-outline" height={20} className="text-gray-400" />
                  </ComboboxButton>
                  {filters.poliza_id && (
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, poliza_id: undefined }))}
                      className="absolute inset-y-0 right-8 flex items-center px-1 text-gray-400 hover:text-gray-600"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" height={16} />
                    </button>
                  )}
                </div>
                <ComboboxOptions
                  anchor="bottom"
                  transition
                  className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                >
                  {polizasCliente.length === 0 && filters.client_id && (
                    <div className="px-3 py-2 text-sm text-gray-500">Este cliente no tiene pólizas</div>
                  )}
                  {(polizaQuery
                    ? polizasCliente.filter((p: any) =>
                        `${p.numero_poliza || p.policy_number}`
                          .toLowerCase()
                          .includes(polizaQuery.toLowerCase()),
                      )
                    : polizasCliente
                  ).map((p: any) => (
                    <ComboboxOption
                      key={p.id}
                      value={p}
                      className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary px-3 py-2"
                    >
                      <Icon
                        icon="solar:check-read-linear"
                        className="invisible group-data-[selected]:visible mr-2"
                        height={20}
                      />
                      <div className="text-sm">{p.numero_poliza || p.policy_number}</div>
                    </ComboboxOption>
                  ))}
                </ComboboxOptions>
              </Combobox>
            </div>

            {/* Botón Limpiar Filtros */}
            {(filters.client_id || filters.poliza_id || filters.search || filters.asignado) && (
              <button
                onClick={() => {
                  setFilters((prev) => ({
                    ...prev,
                    search: '',
                    client_id: undefined,
                    poliza_id: undefined,
                    asignado: '',
                  }));
                  setPolizasCliente([]);
                  setClienteQuery('');
                  setPolizaQuery('');
                  setCurrentPage(1);
                }}
                title="Limpiar filtros"
                className="h-10 w-10 flex items-center justify-center rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer shrink-0"
              >
                <Icon icon="solar:eraser-bold-duotone" className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros adicionales eliminados para igualar sales-funnel */}

      {/* Tabla */}
      <Card className="overflow-visible">
        {seguimientos.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Icon icon="solar:document-bold-duotone" className="w-16 h-16 text-gray-300" />
              <p className="text-gray-500 text-lg font-medium">No hay tareas</p>
              <p className="text-gray-400 text-sm">Comienza creando tu primera tarea</p>
              {canCreate && (
                <HeroButton icon="solar:add-circle-bold" onClick={() => setModalNuevoOpen(true)} size="lg">Crear primera tarea</HeroButton>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto table-container-with-dropdowns">
              <Table
                hoverable
                className="w-full shadow-md dark:shadow-none bg-white dark:bg-darkgray rounded-[10px]"
              >
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
                  <Table.HeadCell>Notificación</Table.HeadCell>
                  <Table.HeadCell>Asignado</Table.HeadCell>
                  <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
                </Table.Head>
                <Table.Body className="group/body">
                  {seguimientos.map((item) => (
                    <SeguimientoTableRow
                      key={item.id}
                      item={item}
                      onEdit={openEditModal}
                      onChangeState={handleChangeState}
                      onDelete={handleDeleteSeguimiento}
                      onViewDetails={(item) => {
                        setSelectedItem(item);
                        setModalOpen(true);
                      }}
                      onShowBitacora={openBitacoraModal}
                      onReassign={openReassignModal}
                      onComplete={handleQuickComplete}
                      getTipoIcon={getTipoIcon}
                      priorityConfigs={priorityConfigs}
                    />
                  ))}
                </Table.Body>
              </Table>
            </div>

            {/* Paginación */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  Mostrando {new Intl.NumberFormat('es-CO').format((currentPage - 1) * perPage + 1)}{' '}
                  a{' '}
                  {new Intl.NumberFormat('es-CO').format(
                    Math.min(currentPage * perPage, totalItems),
                  )}{' '}
                  de {new Intl.NumberFormat('es-CO').format(totalItems)} tareas
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
        <Modal.Header>Detalles de la Tarea</Modal.Header>
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
                    <Icon
                      icon={getTipoIcon(selectedItem.type)}
                      className="w-4 h-4 text-blue-600 mr-2"
                    />
                    <span className="capitalize text-sm">
                      {selectedItem.type.replace('_', ' ')}
                    </span>
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
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedItem.assigned_user?.name || '-'}
                  </p>
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
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha Programada
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(selectedItem.scheduled_for), 'dd/MM/yyyy HH:mm', {
                      locale: es,
                    })}
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
      <Modal
        show={modalNuevoOpen}
        onClose={() => setModalNuevoOpen(false)}
        size="xl"
        className="[--modal-z:60]"
      >
        <Modal.Header>Nueva Tarea</Modal.Header>
        <Modal.Body>
          <TitleCard title="Información de la Tarea">
            <div className="space-y-6">
              <FormField
                id="nuevo_title"
                name="title"
                label="Título"
                value={nuevoSeguimiento.title}
                onChange={(e) => {
                  setNuevoSeguimiento((prev) => ({ ...prev, title: e.target.value }));
                  if (nuevoErrores.title) setNuevoErrores((prev) => ({ ...prev, title: '' }));
                }}
                placeholder="Título de la tarea"
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
                    setNuevoSeguimiento((prev) => ({ ...prev, type: e.target.value as any }));
                    if (nuevoErrores.type) setNuevoErrores((prev) => ({ ...prev, type: '' }));
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
                    { value: 'cotizacion', label: 'Cotización' },
                  ]}
                  error={nuevoErrores.type}
                />
                <FormField
                  id="nuevo_priority"
                  name="priority"
                  label="Prioridad"
                  value={nuevoSeguimiento.priority}
                  onChange={(e) => {
                    setNuevoSeguimiento((prev) => ({ ...prev, priority: e.target.value as any }));
                    if (nuevoErrores.priority)
                      setNuevoErrores((prev) => ({ ...prev, priority: '' }));
                  }}
                  type="select"
                  required
                  options={[
                    { value: 'baja', label: 'Baja' },
                    { value: 'media', label: 'Media' },
                    { value: 'alta', label: 'Alta' },
                    { value: 'critica', label: 'Crítica' },
                  ]}
                  error={nuevoErrores.priority}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1 block">Asignar a</Label>
                  <ShSelect
                    value={(() => {
                      if (nuevoSeguimiento.assigned_to) return `user:${nuevoSeguimiento.assigned_to}`;
                      if (nuevoSeguimiento.assigned_company) return `aseg:${nuevoSeguimiento.assigned_company}`;
                      if (nuevoSeguimiento.assigned_financial_entity) return `fin:${nuevoSeguimiento.assigned_financial_entity}`;
                      return undefined;
                    })()}
                    onValueChange={(raw) => {
                      const idx = (raw || '').indexOf(':');
                      const grp = idx >= 0 ? raw.slice(0, idx) : '';
                      const id = idx >= 0 ? raw.slice(idx + 1) : '';
                      setNuevoSeguimiento((prev) => {
                        if (grp === 'user') {
                          return { ...prev, assigned_to: Number(id), assigned_company: undefined, assigned_financial_entity: undefined };
                        }
                        if (grp === 'aseg') {
                          return { ...prev, assigned_to: undefined, assigned_company: id, assigned_financial_entity: undefined };
                        }
                        if (grp === 'fin') {
                          return { ...prev, assigned_to: undefined, assigned_company: undefined, assigned_financial_entity: id };
                        }
                        return { ...prev, assigned_to: undefined, assigned_company: undefined, assigned_financial_entity: undefined };
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Yo mismo" />
                    </SelectTrigger>
                    <SelectContent className="z-[70] max-h-[50vh]" position="popper" side="bottom" sideOffset={4}>
                      {/* Grupo 1: Yo mismo + empleados/usuarios */}
                      {usuarios.filter((u) => u.tipo !== 'vendedor').length > 0 && (
                        <>
                          <div className="px-2 py-1 text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
                            Yo mismo / empleados
                          </div>
                          {usuarios
                            .filter((u) => u.tipo !== 'vendedor')
                            .map((u) => (
                              <SelectItem key={`user-${u.id}`} value={`user:${u.id}`}>
                                {u.name} {u.email ? `(${u.email})` : ''}
                              </SelectItem>
                            ))}
                        </>
                      )}
                      {/* Grupo 2: Vendedores */}
                      {usuarios.filter((u) => u.tipo === 'vendedor').length > 0 && (
                        <>
                          <div className="px-2 py-1 mt-1 text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide border-t border-gray-200 dark:border-neutral-800">
                            Vendedores
                          </div>
                          {usuarios
                            .filter((u) => u.tipo === 'vendedor')
                            .map((u) => (
                              <SelectItem key={`vend-${u.id}`} value={`user:${u.id}`}>
                                {u.name}
                              </SelectItem>
                            ))}
                        </>
                      )}
                      {/* Grupo 3: Aseguradoras */}
                      {aseguradorasList.length > 0 && (
                        <>
                          <div className="px-2 py-1 mt-1 text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide border-t border-gray-200 dark:border-neutral-800">
                            Aseguradoras
                          </div>
                          {aseguradorasList.map((a) => (
                            <SelectItem key={`aseg-${a.id}`} value={`aseg:${a.nombre}`}>
                              {a.nombre}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {/* Grupo 4: Financieras / Bancos (mismo listado que Editar Póliza) */}
                      {financierasList.length > 0 && (
                        <>
                          <div className="px-2 py-1 mt-1 text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide border-t border-gray-200 dark:border-neutral-800">
                            Financieras
                          </div>
                          {financierasList.map((f) => (
                            <SelectItem key={`fin-${f}`} value={`fin:${f}`}>
                              {f}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </ShSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <Combobox
                    value={clientes.find((c) => c.id === nuevoSeguimiento.client_id) || null}
                    onChange={async (val: any) => {
                      const clientId = val?.id as number | undefined;
                      setNuevoSeguimiento((prev) => ({ ...prev, client_id: clientId }));
                      if (clientId) {
                        await loadPolizasDeCliente(clientId);
                      } else {
                        setPolizasCliente([]);
                      }
                    }}
                    onClose={() => setClienteQuery('')}
                  >
                    <div className="relative z-[60]">
                      <ComboboxInput
                        as={Input}
                        className="w-full"
                        displayValue={(c: any) => (c ? `${c.name} (${c.document})` : '')}
                        onChange={(e) => setClienteQuery(e.target.value)}
                        placeholder="Buscar cliente"
                      />
                      <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                        <Icon icon="solar:alt-arrow-down-outline" height={20} />
                      </ComboboxButton>
                    </div>
                    <ComboboxOptions
                      anchor="bottom"
                      transition
                      className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                    >
                      {clientes.map((c) => (
                        <ComboboxOption
                          key={c.id}
                          value={c}
                          className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary"
                        >
                          <Icon
                            icon="solar:check-read-linear"
                            className="invisible group-data-[selected]:visible"
                            height={20}
                          />
                          <div className="text-sm">
                            {c.name} ({c.document})
                          </div>
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
                    value={polizasCliente.find((p) => p.id === nuevoSeguimiento.poliza_id) || null}
                    onChange={(val: any) => {
                      const polId = val?.id as number | undefined;
                      setNuevoSeguimiento((prev) => ({
                        ...prev,
                        poliza_id: polId,
                        // Auto-llenar compañía al elegir póliza (si el user no la había escrito)
                        assigned_company: !prev.assigned_company && val?.insurance_company
                          ? val.insurance_company
                          : prev.assigned_company,
                      }));
                    }}
                    onClose={() => setPolizaQuery('')}
                    disabled={!nuevoSeguimiento.client_id}
                  >
                    <div className="relative z-[60]">
                      <ComboboxInput
                        as={Input}
                        className="w-full"
                        displayValue={(p: any) =>
                          p ? `${p.numero_poliza || p.policy_number}` : ''
                        }
                        onChange={(e) => setPolizaQuery(e.target.value)}
                        placeholder={
                          nuevoSeguimiento.client_id
                            ? 'Buscar póliza'
                            : 'Seleccione primero un cliente'
                        }
                      />
                      <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                        <Icon icon="solar:alt-arrow-down-outline" height={20} />
                      </ComboboxButton>
                    </div>
                    <ComboboxOptions
                      anchor="bottom"
                      transition
                      className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                    >
                      {(polizaQuery
                        ? polizasCliente.filter((p: any) =>
                            `${p.numero_poliza || p.policy_number}`
                              .toLowerCase()
                              .includes(polizaQuery.toLowerCase()),
                          )
                        : polizasCliente
                      ).map((p: any) => (
                        <ComboboxOption
                          key={p.id}
                          value={p}
                          className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary"
                        >
                          <Icon
                            icon="solar:check-read-linear"
                            className="invisible group-data-[selected]:visible"
                            height={20}
                          />
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
                    onValueChange={(val) =>
                      setNuevoSeguimiento((prev) => ({ ...prev, contact_method: val as any }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No especificado" />
                    </SelectTrigger>
                    <SelectContent className="z-[70]" position="popper" sideOffset={4}>
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
                onChange={(e) =>
                  setNuevoSeguimiento((prev) => ({ ...prev, scheduled_for: e.target.value }))
                }
                type="date"
              />
              <FormField
                id="nuevo_description"
                name="description"
                label="Descripción"
                value={nuevoSeguimiento.description}
                onChange={(e) => {
                  setNuevoSeguimiento((prev) => ({ ...prev, description: e.target.value }));
                  if (nuevoErrores.description)
                    setNuevoErrores((prev) => ({ ...prev, description: '' }));
                }}
                type="textarea"
                placeholder="Descripción de la tarea"
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
            className=""
            disabled={saving}
            data-testid="btn-crear-seguimiento"
          >
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Crear Tarea
          </Button>
          <Button color="gray" onClick={() => setModalNuevoOpen(false)} disabled={saving}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal editar seguimiento */}
      <Modal
        show={modalEditarOpen}
        onClose={() => setModalEditarOpen(false)}
        size="lg"
        className="[--modal-z:60]"
      >
        <Modal.Header>Editar Tarea</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_title" className="text-sm font-medium">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_title"
                value={editarSeguimiento.title}
                onChange={(e) => {
                  setEditarSeguimiento((prev) => ({ ...prev, title: e.target.value }));
                  if (editarErrores.title) setEditarErrores((prev) => ({ ...prev, title: '' }));
                }}
                placeholder="Título de la tarea"
                className={editarErrores.title ? 'border-red-500' : ''}
              />
              {editarErrores.title && (
                <p className="text-red-500 text-xs mt-1">{editarErrores.title}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">
                  Tipo <span className="text-red-500">*</span>
                </Label>
                <ShSelect
                  value={editarSeguimiento.type}
                  onValueChange={(val) => {
                    setEditarSeguimiento((prev) => ({ ...prev, type: val as any }));
                    if (editarErrores.type) setEditarErrores((prev) => ({ ...prev, type: '' }));
                  }}
                >
                  <SelectTrigger className={`w-full ${editarErrores.type ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]" position="popper" sideOffset={4}>
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
                {editarErrores.type && (
                  <p className="text-red-500 text-xs mt-1">{editarErrores.type}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">
                  Prioridad <span className="text-red-500">*</span>
                </Label>
                <ShSelect
                  value={editarSeguimiento.priority}
                  onValueChange={(val) => {
                    setEditarSeguimiento((prev) => ({ ...prev, priority: val as any }));
                    if (editarErrores.priority)
                      setEditarErrores((prev) => ({ ...prev, priority: '' }));
                  }}
                >
                  <SelectTrigger
                    className={`w-full ${editarErrores.priority ? 'border-red-500' : ''}`}
                  >
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]" position="popper" sideOffset={4}>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </ShSelect>
                {editarErrores.priority && (
                  <p className="text-red-500 text-xs mt-1">{editarErrores.priority}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Asignado a</Label>
                <ShSelect
                  value={
                    editarSeguimiento.assigned_to
                      ? String(editarSeguimiento.assigned_to)
                      : undefined
                  }
                  onValueChange={(val) =>
                    setEditarSeguimiento((prev) => ({
                      ...prev,
                      assigned_to: val ? Number(val) : undefined,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Yo mismo" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]" position="popper" sideOffset={4}>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ShSelect>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <Combobox
                  value={clientes.find((c) => c.id === editarSeguimiento.client_id) || null}
                  onChange={async (val: any) => {
                    const clientId = val?.id as number | undefined;
                    setEditarSeguimiento((prev) => ({ ...prev, client_id: clientId }));
                    if (clientId) {
                      await loadPolizasDeCliente(clientId);
                    } else {
                      setPolizasCliente([]);
                    }
                  }}
                  onClose={() => setClienteQuery('')}
                >
                  <div className="relative z-[60]">
                    <ComboboxInput
                      as={Input}
                      className="w-full"
                      displayValue={(c: any) => (c ? `${c.name} (${c.document})` : '')}
                      onChange={(e) => setClienteQuery(e.target.value)}
                      placeholder="Buscar cliente"
                    />
                    <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                      <Icon icon="solar:alt-arrow-down-outline" height={20} />
                    </ComboboxButton>
                  </div>
                  <ComboboxOptions
                    anchor="bottom"
                    transition
                    className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                  >
                    {clientes.map((c) => (
                      <ComboboxOption
                        key={c.id}
                        value={c}
                        className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary"
                      >
                        <Icon
                          icon="solar:check-read-linear"
                          className="invisible group-data-[selected]:visible"
                          height={20}
                        />
                        <div className="text-sm">
                          {c.name} ({c.document})
                        </div>
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
                  value={polizasCliente.find((p) => p.id === editarSeguimiento.poliza_id) || null}
                  onChange={(val: any) =>
                    setEditarSeguimiento((prev) => ({ ...prev, poliza_id: val?.id }))
                  }
                  onClose={() => setPolizaQuery('')}
                  disabled={!editarSeguimiento.client_id}
                >
                  <div className="relative z-[60]">
                    <ComboboxInput
                      as={Input}
                      className="w-full"
                      displayValue={(p: any) =>
                        p ? `${p.numero_poliza || p.policy_number}` : ''
                      }
                      onChange={(e) => setPolizaQuery(e.target.value)}
                      placeholder={
                        editarSeguimiento.client_id
                          ? 'Buscar póliza'
                          : 'Seleccione primero un cliente'
                      }
                    />
                    <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
                      <Icon icon="solar:alt-arrow-down-outline" height={20} />
                    </ComboboxButton>
                  </div>
                  <ComboboxOptions
                    anchor="bottom"
                    transition
                    className="absolute z-[70] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-md bg-white dark:bg-dark py-1 text-base shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                  >
                    {(polizaQuery
                      ? polizasCliente.filter((p: any) =>
                          `${p.numero_poliza || p.policy_number}`
                            .toLowerCase()
                            .includes(polizaQuery.toLowerCase()),
                        )
                      : polizasCliente
                    ).map((p: any) => (
                      <ComboboxOption
                        key={p.id}
                        value={p}
                        className="group flex cursor-pointer ui-dropdown-item bg-hover hover:text-primary data-[focus]:bg-hover data-[focus]:text-primary"
                      >
                        <Icon
                          icon="solar:check-read-linear"
                          className="invisible group-data-[selected]:visible"
                          height={20}
                        />
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
                  onValueChange={(val) =>
                    setEditarSeguimiento((prev) => ({ ...prev, contact_method: val as any }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No especificado" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]" position="popper" sideOffset={4}>
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
              <Label htmlFor="edit_fecha" className="text-sm font-medium">
                Fecha Programada
              </Label>
              <Input
                id="edit_fecha"
                type="datetime-local"
                value={editarSeguimiento.scheduled_for || ''}
                onChange={(e) =>
                  setEditarSeguimiento((prev) => ({ ...prev, scheduled_for: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                Descripción <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={editarSeguimiento.description}
                onChange={(e) => {
                  setEditarSeguimiento((prev) => ({ ...prev, description: e.target.value }));
                  if (editarErrores.description)
                    setEditarErrores((prev) => ({ ...prev, description: '' }));
                }}
                placeholder="Descripción de la tarea"
                rows={3}
                className={editarErrores.description ? 'border-red-500' : ''}
              />
              {editarErrores.description && (
                <p className="text-red-500 text-xs mt-1">{editarErrores.description}</p>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={handleUpdateSeguimiento}
            className=""
            disabled={saving}
          >
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Actualizar Tarea
          </Button>
          <Button color="gray" onClick={() => setModalEditarOpen(false)} disabled={saving}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Configuración de Prioridades */}
      <Modal
        show={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        size="2xl"
        className="z-[9999]"
      >
        <Modal.Header>Configuración de Prioridades</Modal.Header>
        <Modal.Body>
          {configLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="xl" />
            </div>
          ) : configError ? (
            <div className="space-y-3">
              <Alert color="failure" icon={() => <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5" />}>
                <span className="font-medium">Error: </span>{configError}
              </Alert>
              <Button color="light" onClick={() => loadPriorityConfigs(true)}>
                <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-1.5" />
                Reintentar
              </Button>
            </div>
          ) : Object.keys(priorityConfigs).length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Icon icon="solar:settings-bold-duotone" className="w-12 h-12 mx-auto text-gray-300" />
              <p className="text-sm text-gray-500">No hay configuraciones todavía.</p>
              <Button color="light" onClick={() => loadPriorityConfigs(true)}>
                <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-1.5" />
                Cargar valores por defecto
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(priorityConfigs).map(([key, config]) => {
                const update = (patch: Partial<PriorityConfig>) => {
                  setPriorityConfigs((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
                };
                const isPaletteMatch = (sw: typeof PRIORITY_COLOR_PALETTE[number]) =>
                  sw.bg_color === config.bg_color && sw.text_color === config.text_color;

                return (
                  <div
                    key={key}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-900 shadow-sm"
                  >
                    {/* Preview card */}
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${config.bg_color} ${config.text_color} shadow-sm`}
                          style={{ boxShadow: `0 0 0 2px ${config.color}20` }}
                        >
                          <Icon icon={config.icon} className="w-5 h-5" />
                          {config.label}
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {key}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Notifica{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                          {formatMinutes(config.first_notification_minutes)}
                        </span>{' '}
                        antes
                        {config.repeat_every_minutes > 0 && (
                          <>
                            , repite cada{' '}
                            <span className="font-semibold text-gray-700 dark:text-gray-200">
                              {formatMinutes(config.repeat_every_minutes)}
                            </span>
                          </>
                        )}
                        {' '}· máx.{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                          {config.max_notifications}
                        </span>
                      </div>
                    </div>

                    {/* Nombre (label) */}
                    <div className="mb-4">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Nombre visible
                      </Label>
                      <Input
                        value={config.label}
                        onChange={(e) => update({ label: e.target.value })}
                        className="text-sm mt-1"
                        placeholder="Ej: Crítica"
                      />
                    </div>

                    {/* Paleta de colores */}
                    <div className="mb-4">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                        <span>
                          <Icon icon="solar:palette-bold-duotone" className="w-4 h-4 inline mr-1" />
                          Color
                        </span>
                        <input
                          type="color"
                          value={config.color}
                          onChange={(e) => update({ color: e.target.value })}
                          className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                          title="Color personalizado (hex)"
                        />
                      </Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {PRIORITY_COLOR_PALETTE.map((sw) => {
                          const active = isPaletteMatch(sw);
                          return (
                            <button
                              key={sw.name}
                              type="button"
                              onClick={() =>
                                update({
                                  color: sw.color,
                                  bg_color: sw.bg_color,
                                  text_color: sw.text_color,
                                })
                              }
                              title={sw.name}
                              className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                                active
                                  ? 'border-gray-900 dark:border-white scale-110 shadow-md'
                                  : 'border-transparent'
                              }`}
                              style={{ backgroundColor: sw.color }}
                            >
                              {active && (
                                <Icon
                                  icon="solar:check-read-bold"
                                  className="w-4 h-4 text-white drop-shadow mx-auto"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Elige un color del palette o usa el selector hex a la derecha.
                      </p>
                    </div>

                    {/* Grid de iconos */}
                    <div className="mb-4">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Icon icon="solar:gallery-bold-duotone" className="w-4 h-4 inline mr-1" />
                        Icono
                      </Label>
                      <div className="flex flex-wrap gap-1.5 mt-2 max-h-[160px] overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        {PRIORITY_ICON_CATALOG.map((ic) => {
                          const active = config.icon === ic;
                          return (
                            <button
                              key={ic}
                              type="button"
                              onClick={() => update({ icon: ic })}
                              title={ic.replace('solar:', '').replace('-bold-duotone', '')}
                              className={`w-9 h-9 rounded-md flex items-center justify-center transition-all ${
                                active
                                  ? `${config.bg_color} ${config.text_color} ring-2 ring-offset-1 scale-105`
                                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              style={active ? { boxShadow: `0 0 0 2px ${config.color}` } : undefined}
                            >
                              <Icon icon={ic} className="w-5 h-5" />
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          value={config.icon}
                          onChange={(e) => update({ icon: e.target.value })}
                          className="text-xs flex-1"
                          placeholder="Icono Solar personalizado (ej: solar:flag-bold-duotone)"
                        />
                      </div>
                    </div>

                    {/* Presets de tiempo */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          <Icon icon="solar:bell-bing-bold-duotone" className="w-4 h-4 inline mr-1" />
                          Primera notificación
                          <span className="ml-2 text-gray-400 font-normal">
                            ({formatMinutes(config.first_notification_minutes)} antes)
                          </span>
                        </Label>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {FIRST_NOTIF_PRESETS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => update({ first_notification_minutes: p.value })}
                              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                config.first_notification_minutes === p.value
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          value={config.first_notification_minutes}
                          onChange={(e) =>
                            update({ first_notification_minutes: parseInt(e.target.value) || 0 })
                          }
                          className="text-xs mt-2"
                          min={0}
                          placeholder="Minutos personalizados"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 inline mr-1" />
                          Repetir cada
                          <span className="ml-2 text-gray-400 font-normal">
                            ({config.repeat_every_minutes === 0 ? 'Sin repetir' : formatMinutes(config.repeat_every_minutes)})
                          </span>
                        </Label>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {REPEAT_PRESETS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => update({ repeat_every_minutes: p.value })}
                              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                config.repeat_every_minutes === p.value
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          value={config.repeat_every_minutes}
                          onChange={(e) =>
                            update({ repeat_every_minutes: parseInt(e.target.value) || 0 })
                          }
                          className="text-xs mt-2"
                          min={0}
                          placeholder="Minutos personalizados"
                        />
                      </div>
                    </div>

                    {/* Max notificaciones: slider */}
                    <div className="mt-4">
                      <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                        <span>
                          <Icon icon="solar:notification-unread-lines-bold-duotone" className="w-4 h-4 inline mr-1" />
                          Máximo de notificaciones
                        </span>
                        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${config.bg_color} ${config.text_color}`}>
                          {config.max_notifications}
                        </span>
                      </Label>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={config.max_notifications}
                        onChange={(e) => update({ max_notifications: parseInt(e.target.value) || 1 })}
                        className="w-full mt-2 accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>1</span>
                        <span>10</span>
                        <span>20</span>
                      </div>
                    </div>

                    {/* Toggle enabled */}
                    <div className="mt-4 flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => update({ enabled: !config.enabled })}
                        role="switch"
                        aria-checked={config.enabled}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          config.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            config.enabled ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {config.enabled ? 'Notificaciones activas' : 'Notificaciones pausadas'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={async () => {
              if (!confirm('¿Restaurar valores por defecto?')) return;
              try {
                setConfigLoading(true);
                const res = await priorityConfigService.resetDefaults();
                const map: Record<string, PriorityConfig> = {};
                (res.data || []).forEach((c: any) => { map[c.priority_key] = c; });
                setPriorityConfigs(map);
                toast({ title: 'Configuración restaurada' });
              } catch (e: any) {
                toast({ title: 'Error', description: e.message, variant: 'destructive' });
              } finally {
                setConfigLoading(false);
              }
            }}
          >
            Restaurar defaults
          </Button>
          <Button
            onClick={async () => {
              try {
                setConfigLoading(true);
                for (const [key, config] of Object.entries(priorityConfigs)) {
                  await priorityConfigService.updateConfig(key, {
                    label: config.label,
                    icon: config.icon,
                    color: config.color,
                    bg_color: config.bg_color,
                    text_color: config.text_color,
                    first_notification_minutes: config.first_notification_minutes,
                    repeat_every_minutes: config.repeat_every_minutes,
                    max_notifications: config.max_notifications,
                    enabled: config.enabled,
                  });
                }
                toast({ title: 'Configuración guardada' });
                setShowConfigModal(false);
              } catch (e: any) {
                toast({ title: 'Error', description: e.message, variant: 'destructive' });
              } finally {
                setConfigLoading(false);
              }
            }}
            className="bg-[#573CFF] text-white"
            disabled={configLoading}
          >
            {configLoading ? <Spinner size="sm" className="mr-2" /> : null}
            Guardar Configuración
          </Button>
          <Button color="gray" onClick={() => setShowConfigModal(false)} disabled={configLoading}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para cambiar estado */}
      <Modal
        show={showStateModal}
        onClose={() => setShowStateModal(false)}
        size="md"
        className="z-[9999]"
      >
        <Modal.Header>Cambiar Estado de la Tarea</Modal.Header>
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
                        {key === 'pendiente' &&
                          'El seguimiento está programado pero no ha iniciado'}
                        {key === 'en_progreso' &&
                          'El seguimiento está siendo ejecutado actualmente'}
                        {key === 'completada' && 'El seguimiento ha sido completado exitosamente'}
                        {key === 'vencida' &&
                          'El seguimiento no se completó en la fecha programada'}
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
            className="text-white"
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
          <Button onClick={() => setShowStateModal(false)} disabled={changingState}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ═══════ Modal Bitácora ═══════ */}
      <Modal show={bitacoraOpen} size="3xl" onClose={() => setBitacoraOpen(false)}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Icon icon="solar:book-bookmark-bold-duotone" className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Bitácora de la Tarea</h3>
              {bitacoraTask && (
                <p className="text-sm text-gray-500">{bitacoraTask.title}</p>
              )}
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          {loadingBitacora && bitacoraEntries.length === 0 && bitacoraNotes.length === 0 ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agregar nota */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Label className="text-sm font-medium">Agregar nota</Label>
                <Textarea
                  rows={3}
                  value={bitacoraNote}
                  onChange={(e) => setBitacoraNote(e.target.value)}
                  placeholder="Escribe una observación, llamada, gestión..."
                  className="mt-2"
                />
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={bitacoraIsPrivate}
                      onChange={(e) => setBitacoraIsPrivate(e.target.checked)}
                      className="rounded"
                    />
                    Nota privada
                  </label>
                  <Button
                    size="sm"
                    color="primary"
                    onClick={submitBitacoraNote}
                    disabled={!bitacoraNote.trim() || loadingBitacora}
                  >
                    {loadingBitacora ? <Spinner size="sm" className="mr-1.5" /> : <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-1.5" />}
                    Añadir
                  </Button>
                </div>
              </div>

              {/* Notas */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Icon icon="solar:notebook-bold-duotone" className="w-4 h-4" />
                  Notas ({bitacoraNotes.length})
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {bitacoraNotes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Sin notas todavía.</p>
                  ) : (
                    bitacoraNotes.map((n, i) => (
                      <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-500">
                            {n.timestamp ? new Date(n.timestamp).toLocaleString('es-CO') : ''}
                          </span>
                          {n.data?.is_private && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                              <Icon icon="solar:lock-keyhole-minimalistic-bold" className="w-3 h-3 inline" /> privada
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{n.data?.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Historial */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Icon icon="solar:history-bold-duotone" className="w-4 h-4" />
                  Historial ({bitacoraEntries.length})
                </h4>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {bitacoraEntries.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Sin actividad registrada.</p>
                  ) : (
                    bitacoraEntries.map((e, i) => (
                      <div key={i} className="p-3 bg-white dark:bg-gray-900 border-l-4 border-primary rounded shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {e.activity}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {e.timestamp ? new Date(e.timestamp).toLocaleString('es-CO') : ''}
                          </span>
                        </div>
                        {e.data && Object.keys(e.data).length > 0 && (
                          <pre className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-800 p-1.5 rounded">
                            {JSON.stringify(e.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setBitacoraOpen(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      {/* ═══════ Modal Reasignar ═══════ */}
      <Modal show={reassignOpen} size="lg" onClose={() => setReassignOpen(false)}>
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Icon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Reasignar Tarea</h3>
              {reassignTask && (
                <p className="text-sm text-gray-500">{reassignTask.title}</p>
              )}
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Asignar a</Label>
              <select
                value={reassignUserId}
                onChange={(e) => setReassignUserId(e.target.value)}
                className="w-full px-3 py-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Selecciona un usuario...</option>
                {reassignUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email || `Usuario ${u.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Motivo (opcional)</Label>
              <Textarea
                rows={3}
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Explica el motivo de la reasignación..."
                className="mt-1"
              />
            </div>
            <Alert color="info">
              <div className="flex items-start gap-2 text-xs">
                <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 mt-0.5" />
                <span>La acción se registrará automáticamente en la bitácora de la tarea.</span>
              </div>
            </Alert>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="primary"
            onClick={submitReassign}
            disabled={!reassignUserId || loadingReassign}
          >
            {loadingReassign ? <Spinner size="sm" className="mr-1.5" /> : null}
            Reasignar
          </Button>
          <Button color="gray" onClick={() => setReassignOpen(false)}>Cancelar</Button>
        </Modal.Footer>
      </Modal>
    </PermissionGate>
  );
};

export default Seguimiento;
