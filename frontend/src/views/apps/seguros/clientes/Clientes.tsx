import React, { useState, useEffect } from 'react';
import {
  Button,
  Badge,
  Modal,
  Tabs,
  Avatar,
  Spinner,
  Label,
} from 'flowbite-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import TableActionMenu, { TableMenuItem } from 'src/components/TableActionMenu';
import { useToast } from 'src/hooks/use-toast';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/shadcn-ui/Default-Ui/select';
import { saasApi } from '../../../../services/saasApi';
import api from 'src/config/api';
// import { ClienteSaaS } from '../../../../types/saas';
import { TIPOS_CLIENTE, TIPOS_DOCUMENTO, GENEROS, ESTADOS_CLIENTE } from 'src/constants/catalogos';
import ClientesExportModal from './components/ClientesExportModal';
import ClientNotificationsModal from './components/ClientNotificationsModal'; // v2
import { useAutoTour } from 'src/components/GuroTour/useAutoTour';
import { TOUR_CLIENTES } from 'src/components/GuroTour/tourConfigs';
import { ClienteSaaS } from 'src/types/saas';
import { clienteService } from 'src/services/clienteService';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import suraLogo from 'src/assets/images/logoscompanias/sura.png';
import bolivarLogo from 'src/assets/images/logoscompanias/bolivar.png';
import hdiLogo from 'src/assets/images/logoscompanias/hdi.png';
import estadoLogo from 'src/assets/images/logoscompanias/estado.png';
import equidadLogo from 'src/assets/images/logoscompanias/equidad.png';
import axaLogo from 'src/assets/images/logoscompanias/axa.png';
import mapfreLogo from 'src/assets/images/logoscompanias/mapfre.png';
import allianzLogo from 'src/assets/images/logoscompanias/allianz.png';
import mundialLogo from 'src/assets/images/logoscompanias/mundial.svg';

const INSURER_LOGOS: Record<string, string> = {
  sura: suraLogo,
  bolivar: bolivarLogo,
  bolívar: bolivarLogo,
  hdi: hdiLogo,
  estado: estadoLogo,
  'seguros del estado': estadoLogo,
  'la-equidad': equidadLogo,
  'la equidad': equidadLogo,
  equidad: equidadLogo,
  axa: axaLogo,
  'axa-colpatria': axaLogo,
  mapfre: mapfreLogo,
  allianz: allianzLogo,
  mundial: mundialLogo,
  'seguros mundial': mundialLogo,
};

const getInsurerLogo = (nombre: string): string | null => {
  if (!nombre) return null;
  const key = nombre.toLowerCase().trim();
  if (INSURER_LOGOS[key]) return INSURER_LOGOS[key];
  for (const [k, v] of Object.entries(INSURER_LOGOS)) {
    if (key.includes(k)) return v;
  }
  return null;
};

// Interfaz para adaptar los datos de la API
interface Cliente {
  id: string;
  tipoCliente: 'persona' | 'empresa';
  nombre: string;
  tipoDocumento: 'CC' | 'NIT' | 'CE' | 'TI' | 'PP' | 'RC' | 'pasaporte';
  numeroDocumento: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  genero?: string;
  fechaNacimiento?: string;
  edad?: number;
  fechaRegistro: string;
  estado: 'activo' | 'inactivo' | 'prospecto' | 'bloqueado';
  agente: string;
  polizasActivas: number;
  siniestrosReportados: number;
  valorCartera: number;
  ultimaActividad: string;
  observaciones?: string;
  source?: string;
  syncSource?: string;
  syncAt?: string;
}

// Función para convertir datos de la API al formato local
const convertirClienteAPI = (clienteAPI: any): Cliente => {
  // Determinar tipoCliente primero para decidir qué nombre mostrar
  const docType: any = clienteAPI.tipo_documento || clienteAPI.document_type;
  const hasCompany = !!(
    clienteAPI.company ||
    clienteAPI.company_legal_name ||
    clienteAPI.razon_social
  );
  let tipoCliente: 'persona' | 'empresa' =
    clienteAPI.client_type === 'empresa' || docType === 'NIT' || hasCompany ? 'empresa' : 'persona';

  // Nombre mostrado según tipo
  let nombre = '';
  if (tipoCliente === 'empresa') {
    nombre = (clienteAPI.razon_social || clienteAPI.company_legal_name || clienteAPI.company || '')
      .toString()
      .trim();
    if (!nombre) {
      // Fallback a nombre de persona si no hay razón social
      if (clienteAPI.nombre && clienteAPI.apellidos) {
        nombre = `${clienteAPI.nombre} ${clienteAPI.apellidos}`.trim();
      } else if (clienteAPI.first_name && clienteAPI.last_name) {
        nombre = `${clienteAPI.first_name} ${clienteAPI.last_name}`.trim();
      }
    }
  } else {
    if (clienteAPI.nombre && clienteAPI.apellidos) {
      nombre = `${clienteAPI.nombre} ${clienteAPI.apellidos}`.trim();
    } else if (clienteAPI.first_name && clienteAPI.last_name) {
      nombre = `${clienteAPI.first_name} ${clienteAPI.last_name}`.trim();
    } else {
      // Fallback a razón social si sólo existe empresa
      nombre = (
        clienteAPI.razon_social ||
        clienteAPI.company_legal_name ||
        clienteAPI.company ||
        ''
      )
        .toString()
        .trim();
    }
  }

  // Tipo y número de documento
  let tipoDocumento: 'CC' | 'NIT' | 'CE' | 'TI' | 'PP' | 'RC' | 'pasaporte' = docType || 'CC';
  let numeroDocumento = clienteAPI.cuit || clienteAPI.document_number || '';
  if (tipoCliente === 'empresa') {
    tipoDocumento = 'NIT';
  }

  // Extraer datos de contacto
  let telefono = clienteAPI.telefono || clienteAPI.phone || '';
  let email = clienteAPI.email_principal || clienteAPI.email || '';

  // Celular como fallback para teléfono
  if (!telefono) {
    telefono = clienteAPI.celular_principal || clienteAPI.mobile_phone || '';
  }

  // Extraer ubicación
  let direccion = clienteAPI.domicilio_principal || clienteAPI.address || '';
  let ciudad = clienteAPI.ciudad || clienteAPI.city || '';
  let departamento = clienteAPI.departamento || clienteAPI.state || '';

  // Datos personales adicionales (persona)
  const rawGenero = clienteAPI.genero || clienteAPI.gender || clienteAPI.persona?.genero || '';
  const genero = (() => {
    const v = (rawGenero || '').toString().trim().toLowerCase();
    if (['m', 'masculino', 'male'].includes(v)) return 'Masculino';
    if (['f', 'femenino', 'female'].includes(v)) return 'Femenino';
    if (v) return v.charAt(0).toUpperCase() + v.slice(1);
    return '';
  })();

  const rawBirth =
    clienteAPI.fecha_nacimiento ||
    clienteAPI.birth_date ||
    clienteAPI.persona?.fecha_nacimiento ||
    '';
  const fechaNacimiento = (() => {
    const v = (rawBirth || '').toString();
    if (!v) return '';
    // Normalizar a YYYY-MM-DD si viene con tiempo
    const candidate = v.length >= 10 ? v.substring(0, 10) : v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  })();

  const edad = (() => {
    if (!fechaNacimiento) return undefined;
    const parts = fechaNacimiento.split('-');
    if (parts.length !== 3) return undefined;
    const [y, m, d] = parts.map((n: string) => Number(n));
    if (!y || !m || !d) return undefined;
    const today = new Date();
    let age = today.getFullYear() - y;
    const hasHadBirthday =
      today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
    if (!hasHadBirthday) age -= 1;
    return age >= 0 && age < 130 ? age : undefined;
  })();

  // Normalizar estado
  let estado = clienteAPI.estado || clienteAPI.status || 'activo';
  if (estado === 'active') estado = 'activo';
  if (estado === 'inactive') estado = 'inactivo';
  if (estado === 'prospect') estado = 'prospecto';
  if (estado === 'blocked') estado = 'bloqueado';

  // Fallbacks para datos vacíos
  if (!nombre) {
    nombre = email ? email.split('@')[0] : `Cliente ${numeroDocumento}`;
  }

  return {
    id: String(clienteAPI.id || ''),
    tipoCliente,
    nombre,
    tipoDocumento,
    numeroDocumento,
    email,
    telefono,
    direccion,
    ciudad,
    departamento,
    genero,
    fechaNacimiento,
    edad,
    fechaRegistro: clienteAPI.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    estado: estado as 'activo' | 'inactivo' | 'prospecto',
    agente: clienteAPI.assigned_user_id || 'Sin asignar',
    polizasActivas: clienteAPI.total_policies_count || 0,
    siniestrosReportados: 0, // No disponible en la API actual
    valorCartera: clienteAPI.total_policies_value || 0,
    ultimaActividad:
      clienteAPI.updated_at?.split('T')[0] ||
      clienteAPI.created_at?.split('T')[0] ||
      new Date().toISOString().split('T')[0],
    observaciones: clienteAPI.observaciones || clienteAPI.notes || '',
    source: clienteAPI.source || null,
    syncSource: clienteAPI.sync_source || null,
    syncAt: clienteAPI.sync_at || null,
  };
};

const departamentosFallback = [
  'Antioquia',
  'Atlántico',
  'Bogotá D.C.',
  'Bolívar',
  'Boyacá',
  'Caldas',
  'Caquetá',
  'Casanare',
  'Cauca',
  'Cesar',
  'Chocó',
  'Córdoba',
  'Cundinamarca',
  'Huila',
  'La Guajira',
  'Magdalena',
  'Meta',
  'Nariño',
  'Norte de Santander',
  'Quindío',
  'Risaralda',
  'Santander',
  'Sucre',
  'Tolima',
  'Valle del Cauca',
];

const Clientes: React.FC = () => {
  useAutoTour(TOUR_CLIENTES);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  // Paginación backend
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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [fullCliente, setFullCliente] = useState<ClienteSaaS | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Página y tamaño por página (persistidos)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [elementsPerPage, setElementsPerPage] = useState<number>(() => {
    const v = Number(localStorage.getItem('clientes_page_size') || '15');
    return [15, 25, 50].includes(v) ? v : 15;
  });

  // Filtros
  const [filters, setFilters] = useState({
    search: '',
    tipo: '',
    tipo_documento: '',
    estado: '',
    departamento: '',
    agente: '',
    sort_by: '',
    sort_dir: '',
    // Filtros adicionales
    ciudad: '',
    genero: '',
    edad_min: '',
    edad_max: '',
    fecha_desde: '',
    fecha_hasta: '',
    priority: '',
    page: 1,
    per_page: Number(localStorage.getItem('clientes_page_size') || '15'),
    // Papelera: 'only' devuelve únicamente clientes soft-deleted
    trashed: 'none' as 'none' | 'only',
  });
  // Borrador de filtros para el modal (no aplica hasta confirmar)
  const [modalFilters, setModalFilters] = useState({ ...filters });

  // Columnas visibles
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'nombre',
    'tipo',
    'documento',
    'contacto',
    'ubicacion',
    'estado',
    'origen',
  ]);

  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: saasLoading, hasPermission } = useUnifiedAuth();
  const canCreateClient = hasPermission('clientes', 'crear');
  const canEditClient = hasPermission('clientes', 'editar');
  const canDeleteClient = hasPermission('clientes', 'eliminar');
  const canCreatePolicy = hasPermission('polizas', 'crear');

  // Selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkStateModal, setShowBulkStateModal] = useState(false);
  const [bulkClientTargetState, setBulkClientTargetState] = useState<string>('activo');
  const [showBulkDeleteAllModal, setShowBulkDeleteAllModal] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');

  // Usuarios (Agentes) dinámicos
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const departamentosDinamicos = React.useMemo(() => {
    const set = new Set<string>();
    (clientes || []).forEach((c) => {
      if (c.departamento) set.add(c.departamento);
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    return list.length ? list : departamentosFallback;
  }, [clientes]);
  const ciudadesDinamicas = React.useMemo(() => {
    const set = new Set<string>();
    (clientes || []).forEach((c) => {
      if (filters.departamento) {
        if (c.departamento === filters.departamento && c.ciudad) set.add(c.ciudad);
      } else {
        if (c.ciudad) set.add(c.ciudad);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [clientes, filters.departamento]);

  // Ciudades dinámicas para el modal (basadas en modalFilters.departamento)
  const ciudadesDinamicasModal = React.useMemo(() => {
    const set = new Set<string>();
    (clientes || []).forEach((c) => {
      if (modalFilters.departamento) {
        if (c.departamento === modalFilters.departamento && c.ciudad) set.add(c.ciudad);
      } else {
        if (c.ciudad) set.add(c.ciudad);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [clientes, modalFilters.departamento]);

  // Si cambia el departamento y la ciudad seleccionada deja de ser válida, limpiar ciudad
  useEffect(() => {
    if (filters.ciudad && !ciudadesDinamicas.includes(filters.ciudad)) {
      setFilters((prev) => ({ ...prev, ciudad: '' }));
    }
  }, [filters.departamento, ciudadesDinamicas]);

  // Mantener coherencia en el modal: si cambia el departamento en el borrador y la ciudad ya no aplica, limpiar ciudad del borrador
  useEffect(() => {
    if (modalFilters.ciudad && !ciudadesDinamicasModal.includes(modalFilters.ciudad)) {
      setModalFilters((prev) => ({ ...prev, ciudad: '' }));
    }
  }, [modalFilters.departamento, ciudadesDinamicasModal]);

  // Verificar autenticación
  useEffect(() => {
    if (!saasLoading && !user) {
      navigate('/auth/auth1/login');
    } else if (!saasLoading && user) {
      // Aquí podría hacer algo más si es necesario
    } else {
      // Loading state
    }
  }, [saasLoading, user, navigate]);

  // Detectar query param para abrir modal automáticamente desde el buscador global
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open_client_id');
    if (openId) {
      if (!showModal || selectedCliente?.id !== String(openId)) {
        openClienteById(String(openId));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    // Persistir tamaño de página y sincronizar con filtros
    localStorage.setItem('clientes_page_size', String(elementsPerPage));
    setFilters((prev) => ({ ...prev, per_page: elementsPerPage }));
  }, [elementsPerPage]);

  // Handlers
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      // Si cambia cualquier filtro distinto a la página o per_page, reiniciar a página 1
      page: key === 'page' || key === 'per_page' ? (key === 'page' ? (value as any) : 1) : 1,
    }));
  };

  // Cargar clientes desde la API
  const cargarClientes = async () => {
    try {
      setLoading(true);
      setError(null);
      // Traducir filtros de UI a filtros de API (ClienteFilters)
      const buildClienteFiltersFromUI = (ui: typeof filters) => {
        const params: Record<string, any> = {};
        // Búsqueda y paginación
        if (ui.search) params.search = ui.search;
        params.page = ui.page || currentPage || 1;
        params.per_page = ui.per_page || elementsPerPage || 15;

        // Mejora de búsqueda: soportar "nombre apellido" y documentos
        // - Si el término parece documento (solo dígitos con/ sin separadores), mapear a "documento"
        // - Si hay dos o más tokens, mapear primer token a "nombres" y el resto a "apellidos"
        {
          const s = (ui.search || '').toString().trim();
          if (s) {
            const tokens = s.split(/\s+/).filter(Boolean);
            // Documento: remover separadores y validar 5+ dígitos
            const doc = s.replace(/[.\s-]/g, '');
            if (/^\d{5,}$/.test(doc)) {
              (params as any).documento = doc;
            }
            // Nombre + Apellido(s)
            if (tokens.length >= 2) {
              const first = tokens[0];
              const last = tokens.slice(1).join(' ');
              (params as any).nombres = first;
              (params as any).apellidos = last;
            }
          }
        }

        // Tipo de cliente (UI usa 'tipo' persona|empresa) -> API usa 'client_type'
        if (ui.tipo) {
          const t = String(ui.tipo).toLowerCase();
          if (t === 'persona' || t === 'empresa') {
            params.client_type = t;
          }
        }

        // Estado: activo|inactivo|prospecto|bloqueado -> active|inactive|prospect|blocked
        if (ui.estado) {
          const e = String(ui.estado).toLowerCase();
          const normalized =
            e === 'activo'
              ? 'active'
              : e === 'inactivo'
              ? 'inactive'
              : e === 'prospecto'
              ? 'prospect'
              : e === 'bloqueado'
              ? 'blocked'
              : '';
          if (normalized) params.estado = normalized;
        }

        // Ciudad
        if (ui.ciudad) params.ciudad = ui.ciudad;

        // Departamento (state)
        if (ui.departamento) params.departamento = ui.departamento;

        // Tipo de documento (CC, CE, NIT, TI, PP, RC)
        if (ui.tipo_documento && ui.tipo_documento !== 'todos')
          params.tipo_documento = ui.tipo_documento;

        // Género (Masculino/Femenino -> backend normaliza a M/F)
        if (ui.genero && ui.genero !== 'todos') params.genero = ui.genero;

        // Edad mínima y máxima (validar numéricos)
        if (ui.edad_min !== undefined && ui.edad_min !== null && ui.edad_min !== '') {
          const n = Number(ui.edad_min);
          if (!Number.isNaN(n)) params.edad_min = n;
        }
        if (ui.edad_max !== undefined && ui.edad_max !== null && ui.edad_max !== '') {
          const n = Number(ui.edad_max);
          if (!Number.isNaN(n)) params.edad_max = n;
        }

        // Rango de fechas de creación
        if (ui.fecha_desde) params.fecha_desde = ui.fecha_desde;
        if (ui.fecha_hasta) params.fecha_hasta = ui.fecha_hasta;

        // Prioridad (low|medium|high)
        if (ui.priority) {
          const p = String(ui.priority).toLowerCase();
          if (['low', 'medium', 'high'].includes(p)) params.priority = p;
        }

        // Agente: backend no filtra por asesor_id en index; omitir para evitar ruido

        // Ordenamiento: traducir sort_by/sort_dir (UI) a sort_field/sort_direction (API)
        if (ui.sort_by) params.sort_field = ui.sort_by;
        if (ui.sort_dir) params.sort_direction = ui.sort_dir;

        // Tab Papelera
        if (ui.trashed === 'only') params.trashed = 'only';

        // Ignorar filtros no soportados por el backend actual: agente (no soportado en index)
        return params;
      };

      const params = buildClienteFiltersFromUI(filters);
      console.debug('[Clientes] Params enviados a API /saas/clientes', params);
      const res = await saasApi.getClientes(params);

      const root: any = res as any;
      const payload: any =
        Array.isArray(res?.data) || typeof res?.data === 'object' ? (res.data as any) : root;
      const list: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      const meta = {
        current_page: Number(payload?.current_page || root?.current_page || params.page || 1),
        last_page: Number(payload?.last_page || root?.last_page || 1),
        per_page: Number(
          payload?.per_page || root?.per_page || params.per_page || elementsPerPage || 15,
        ),
        total: Number(payload?.total || root?.total || list.length || 0),
        from: Number(
          payload?.from ||
            root?.from ||
            (params.page - 1) * params.per_page + (list.length ? 1 : 0),
        ),
        to: Number(payload?.to || root?.to || (params.page - 1) * params.per_page + list.length),
      };
      console.debug('[Clientes] Meta respuesta', meta);

      const clientesConvertidos = list.map(convertirClienteAPI);
      setClientes(clientesConvertidos);
      setPagination(meta);
      setCurrentPage(meta.current_page);

      // Las estadísticas se cargan una sola vez al montar el componente
      // No se recalculan aquí para evitar inconsistencias
    } catch (err: any) {
      // Manejar errores de autenticación (alineado con Pólizas)
      const msg = String(err?.message || '').toLowerCase();
      const unauth =
        err?.status === 401 ||
        err?.status === 403 ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('unauthenticated') ||
        err?.code === 'UNAUTHENTICATED';

      if (unauth) {
        console.warn('[Clientes] Error de autenticación, redirigiendo a login (SaaS)');
        // No forzar limpieza aquí; el flujo de login se encarga de reestablecer sesión
        navigate('/auth/auth1/login');
        return;
      }

      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Estado para estadísticas totales (se establecen una vez)
  const [estadisticasTotales, setEstadisticasTotales] = useState<{
    total: number;
    activos: number;
    prospectos: number;
    inactivos: number;
    personas: number;
    empresas: number;
    valorTotal: number;
    polizasTotal: number;
  } | null>(null);

  // Cargar estadísticas totales (se ejecuta una sola vez al montar)
  const loadEstadisticas = async () => {
    try {
      console.log('[Clientes] Cargando estadísticas desde el backend...');
      const response = await saasApi.getClientesEstadisticas();

      if (response.success && response.data) {
        console.log('[Clientes] Estadísticas recibidas del backend:', response.data);

        // El backend devuelve las estadísticas calculadas
        const stats = {
          total: response.data.total_clientes || 0,
          activos: response.data.clientes_activos || 0,
          prospectos: response.data.clientes_prospectos || 0,
          inactivos: response.data.clientes_inactivos || 0,
          personas: response.data.clientes_personas || 0,
          empresas: response.data.clientes_empresas || 0,
          valorTotal: response.data.valor_total_cartera || 0,
          polizasTotal: response.data.total_polizas_activas || 0,
        };

        console.log('[Clientes] Estadísticas procesadas:', stats);
        setEstadisticasTotales(stats);
      } else {
        throw new Error('No se pudieron obtener las estadísticas');
      }
    } catch (error) {
      console.error('[Clientes] Error cargando estadísticas:', error);
      // Fallback: establecer vacías
      setEstadisticasTotales({
        total: 0,
        activos: 0,
        prospectos: 0,
        inactivos: 0,
        personas: 0,
        empresas: 0,
        valorTotal: 0,
        polizasTotal: 0,
      });
    }
  };

  // Efectos
  useEffect(() => {
    cargarClientes();
  }, [filters]);

  const loadNotificationStatus = async () => {
    try {
      const res = await api.get('/saas/client-notifications/config');
      if (res.data?.success && res.data?.data) {
        setNotificationStatus(res.data.data);
      }
    } catch {
      setNotificationStatus({ is_active: false, whatsapp_status: null });
    }
  };

  useEffect(() => {
    loadEstadisticas();
    loadNotificationStatus();
  }, []);

  // Ordenamiento: mapa de columnas a campos del backend
  const columnToApiField: Record<string, string> = {
    // Campos soportados por el backend (SaasClientesController@index)
    nombre: 'first_name',
    documento: 'document_number',
    estado: 'status',
    // fechaRegistro no es una columna directa, pero podemos mapearla si se agrega a visibleColumns
    fechaRegistro: 'created_at',
  };
  const toggleSort = (columnKey: string) => {
    const apiField = columnToApiField[columnKey];
    if (!apiField) return;
    setFilters((prev) => {
      const isSame = prev.sort_by === apiField;
      const nextDir = isSame ? (prev.sort_dir === 'asc' ? 'desc' : 'asc') : 'asc';
      // Mantener estado de UI, la traducción a API se hace en cargarClientes
      return { ...prev, sort_by: apiField, sort_dir: nextDir, page: 1 };
    });
  };

  // Cargar usuarios/agentes para filtro y visualización
  useEffect(() => {
    (async () => {
      try {
        const res = await saasApi.getUsuarios({ per_page: 999999 });
        const payload: any = res?.data as any;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : [];
        setUsuarios(list || []);
      } catch (e: any) {
        const msg = String(e?.message || '');
        const status = e?.status ?? 0;
        const code = String(e?.code || '').toUpperCase();

        // Silenciar casos no críticos:
        // - 404: el endpoint de usuarios puede no existir en algunos backends
        // - 401/403/Unauthenticated: permisos insuficientes para listar usuarios (no bloquea la vista de clientes)
        if (
          msg.includes('404') ||
          status === 401 ||
          status === 403 ||
          /unauth|unath/i.test(msg) ||
          code === 'UNAUTHENTICATED'
        ) {
          return;
        }

        toast({
          title: 'No se pudieron cargar los usuarios',
          description: msg || 'Error al obtener la lista de agentes.',
          variant: 'destructive',
        });
      }
    })();
  }, []);

  // Refrescar al volver desde edición/creación
  useEffect(() => {
    const state: any = location.state;
    if (state?.updatedCliente) {
      // Actualización optimista: reemplazar fila en memoria
      setClientes((prev) => {
        const updated = convertirClienteAPI(state.updatedCliente);
        const idx = prev.findIndex((c) => c.id === String(updated.id));
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = updated;
          return clone;
        }
        return prev;
      });
      // Las estadísticas se mantienen fijas (no se recalculan por edición)
    } else if (state?.refresh) {
      cargarClientes();
      // Las estadísticas se mantienen fijas (no se recalculan por refresh)
    }
  }, [location.state]);

  // Al cambiar filtros, reiniciar a página 1 (excepto cambios de página explícitos)
  useEffect(() => {
    setCurrentPage(filters.page);
  }, [filters.page]);

  // Funciones helper
  const handleViewCliente = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setShowModal(true);
    await Promise.all([loadClienteFullData(cliente.id), loadClienteRelatedData(cliente.id)]);
  };

  // Abrir detalle desde deep-link (?open_client_id=ID)
  const openClienteById = async (clienteId: string) => {
    try {
      const res = await saasApi.getCliente(clienteId);
      const data: any = res?.data || null;
      if (!data) return;
      const adapted = convertirClienteAPI(data);
      setSelectedCliente(adapted);
      setShowModal(true);
      await Promise.all([loadClienteFullData(clienteId), loadClienteRelatedData(clienteId)]);
    } catch (_e) {
      // ignorar errores silenciosamente para no romper UI
    }
  };

  // Datos adicionales para modal
  const [polizasCliente, setPolizasCliente] = useState<any[]>([]);
  const [tareasCliente, setTareasCliente] = useState<any[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(false);

  const loadClienteRelatedData = async (clienteId: string) => {
    try {
      setLoadingTabs(true);
      const cli = clientes.find((c) => String(c.id) === String(clienteId));
      const dni = cli?.numeroDocumento || selectedCliente?.numeroDocumento || '';
      const [polizasRes, tareasRes] = await Promise.all([
        saasApi.getPolizas({ client_id: clienteId, dni_cliente: dni, per_page: 50 }),
        saasApi.getCommercialTasks({ client_id: clienteId, per_page: 50 }),
      ]);
      const polizasData = Array.isArray(polizasRes.data)
        ? polizasRes.data
        : polizasRes.data?.data || [];
      const tareasData = Array.isArray(tareasRes.data)
        ? tareasRes.data
        : tareasRes.data?.data || [];
      setPolizasCliente(polizasData || []);
      setTareasCliente(tareasData || []);
    } catch (e: any) {
      toast({
        title: 'Error al cargar datos relacionados',
        description: e?.message || 'No fue posible cargar pólizas o seguimientos del cliente.',
        variant: 'destructive',
      });
    } finally {
      setLoadingTabs(false);
    }
  };

  const loadClienteFullData = async (clienteId: string) => {
    try {
      setLoadingFull(true);
      const res = await saasApi.getCliente(clienteId);
      if (res.success && res.data) {
        setFullCliente(res.data as any);
      } else {
        setFullCliente(null);
      }
    } catch (e) {
      setFullCliente(null);
    } finally {
      setLoadingFull(false);
    }
  };

  const handleCloseDetailsModal = () => {
    setShowModal(false);
    setFullCliente(null);
    try {
      const params = new URLSearchParams(location.search);
      if (params.has('open_client_id')) {
        params.delete('open_client_id');
        navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, {
          replace: true,
        });
      }
    } catch {}
  };

  const handleDeleteCliente = async (cliente: Cliente) => {
    if (
      window.confirm(
        `¿Estás seguro de que deseas eliminar al cliente "${cliente.nombre}"?\n\nEsta acción no se puede deshacer.`,
      )
    ) {
      try {
        setLoading(true);
        const response = await saasApi.deleteCliente(cliente.id);

        if (response.success) {
          toast({
            title: 'Cliente eliminado',
            description: `El cliente "${cliente.nombre}" ha sido eliminado correctamente.`,
          });

          // Recargar la lista de clientes y estadísticas
          await cargarClientes();
          // Recalcular estadísticas totales después de eliminar
          setEstadisticasTotales((prev) => {
            if (!prev) return null;

            let activos = prev.activos;
            let inactivos = prev.inactivos;
            let prospectos = prev.prospectos;

            switch (cliente.estado) {
              case 'activo':
                activos = Math.max(0, activos - 1);
                break;
              case 'inactivo':
                inactivos = Math.max(0, inactivos - 1);
                break;
              case 'prospecto':
                prospectos = Math.max(0, prospectos - 1);
                break;
            }

            let personas = prev.personas;
            let empresas = prev.empresas;
            if (cliente.tipoCliente === 'persona') {
              personas = Math.max(0, personas - 1);
            } else {
              empresas = Math.max(0, empresas - 1);
            }

            return {
              ...prev,
              total: Math.max(0, prev.total - 1),
              activos,
              inactivos,
              prospectos,
              personas,
              empresas,
              valorTotal: Math.max(0, prev.valorTotal - cliente.valorCartera),
              polizasTotal: Math.max(0, prev.polizasTotal - cliente.polizasActivas),
            };
          });
        } else {
          throw new Error(response.message || 'Error al eliminar el cliente');
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Error al eliminar el cliente',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCreatePoliza = (cliente: Cliente) => {
    // Navegar a crear nueva póliza con cliente preseleccionado
    navigate(`/apps/seguros/polizas/nueva?cliente_id=${cliente.id}`);
  };

  // Cambios locales dentro del modal (no disparan búsqueda hasta aplicar)
  const handleModalFilterChange = (key: string, value: any) => {
    const filterValue = value === 'todos' ? '' : value;
    setModalFilters((prev) => ({ ...prev, [key]: filterValue }));
  };

  // Abrir modal sincronizando el borrador con los filtros actuales
  const handleOpenFilterModal = () => {
    setModalFilters({ ...filters, page: 1 });
    setShowFilterModal(true);
  };

  const getActiveFiltersCount = () => {
    const keys = [
      'search',
      'tipo',
      'tipo_documento',
      'estado',
      'departamento',
      'agente',
      'ciudad',
      'genero',
      'edad_min',
      'edad_max',
      'fecha_desde',
      'fecha_hasta',
      'priority',
    ] as const;
    let count = 0;
    keys.forEach((k) => {
      if ((filters as any)[k]) count++;
    });
    return count;
  };

  const getColumnName = (columnKey: string) => {
    const columnMap: Record<string, string> = {
      nombre: 'Cliente',
      tipo: 'Tipo',
      documento: 'Documento',
      contacto: 'Contacto',
      ubicacion: 'Ubicación',
      estado: 'Estado',
      origen: 'Origen',
      polizas: 'Pólizas',
      valorCartera: 'Valor Cartera',
      agente: 'Agente',
      genero: 'Género',
      edad: 'Edad',
    };
    return columnMap[columnKey] || columnKey;
  };
  const getCellClass = (columnKey: string) => {
    switch (columnKey) {
      case 'nombre':
        return 'min-w-[220px] max-w-[280px] whitespace-normal break-words';
      case 'documento':
        return 'min-w-[180px] max-w-[220px] whitespace-normal break-words';
      case 'contacto':
        return 'min-w-[240px] max-w-[300px] whitespace-normal break-words';
      case 'ubicacion':
        return 'min-w-[200px] max-w-[260px] whitespace-normal break-words';
      case 'estado':
        return 'min-w-[140px] whitespace-normal';
      default:
        return 'min-w-[160px] whitespace-normal break-words';
    }
  };

  const getTipoIcon = (tipo: string) => {
    return tipo === 'empresa' ? 'solar:buildings-bold-duotone' : 'solar:user-bold-duotone';
  };

  const renderTableCell = (cliente: Cliente, columnKey: string) => {
    switch (columnKey) {
      case 'nombre':
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar placeholderInitials={getInitials(cliente.nombre)} rounded size="sm" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {String(cliente.nombre || '').toUpperCase()}
              </p>
              <p className="text-sm text-gray-500">
                Registro: {new Date(cliente.fechaRegistro).toLocaleDateString('es-CO')}
              </p>
            </div>
          </div>
        );
      // Columnas género y edad eliminadas de la vista
      case 'tipo':
        return (
          <div className="flex items-center gap-2">
            <Icon icon={getTipoIcon(cliente.tipoCliente)} className="w-4 h-4 text-gray-600" />
            <span className="capitalize">{cliente.tipoCliente}</span>
          </div>
        );
      case 'documento':
        return (
          <div>
            <p className="font-medium">{cliente.tipoDocumento}</p>
            <p className="text-sm text-gray-500">{cliente.numeroDocumento}</p>
          </div>
        );
      case 'contacto': {
        const email = (cliente.email || '').trim();
        const telefono = (cliente.telefono || '').trim();
        const emailText = email ? email : 'Sin email';
        const telText = telefono ? telefono : 'Sin teléfono';
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <Icon icon="solar:letter-bold-duotone" className="w-3 h-3 text-gray-500" />
              <span className="truncate max-w-[180px]">{emailText}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Icon icon="solar:phone-bold-duotone" className="w-3 h-3 text-gray-500" />
              <span>{telText}</span>
            </div>
          </div>
        );
      }
      case 'ubicacion': {
        const toTitleCase = (input: string) =>
          input
            .split(' ')
            .map((w) =>
              w
                .split('-')
                .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p))
                .join('-'),
            )
            .join(' ');
        const ciudad = (cliente.ciudad || '').trim();
        const dep = (cliente.departamento || '').trim();
        let ubicacion = 'Sin ubicación';
        if (ciudad && dep) ubicacion = `${ciudad} - ${dep}`;
        else if (ciudad) ubicacion = ciudad;
        else if (dep) ubicacion = dep;
        return (
          <div className="flex items-center gap-1">
            <Icon icon="solar:map-point-bold-duotone" className="w-3 h-3 text-gray-500" />
            <span className="text-sm">{toTitleCase(ubicacion)}</span>
          </div>
        );
      }
      case 'estado':
        return (
          <Badge color={getEstadoBadge(cliente.estado)} className="capitalize">
            {cliente.estado}
          </Badge>
        );
      case 'origen': {
        const src = cliente.syncSource || cliente.source || '';
        if (src && src.includes('_sync')) {
          const insurerName = src.replace('_sync', '').replace('-', ' ');
          const displayMap: Record<string, string> = { sura: 'Sura', bolivar: 'Bolívar', hdi: 'HDI', 'axa colpatria': 'AXA', 'seguros del estado': 'Estado' };
          const display = displayMap[insurerName] || insurerName.charAt(0).toUpperCase() + insurerName.slice(1);
          return (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#573CFF]/10 text-[#573CFF] dark:bg-[#573CFF]/20 dark:text-[#a78bfa]">
                <Icon icon="solar:refresh-bold-duotone" className="w-3 h-3" />
                {display}
              </span>
            </div>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
            <Icon icon="solar:pen-bold-duotone" className="w-3 h-3" />
            Manual
          </span>
        );
      }
      case 'polizas':
        return (
          <div className="text-center">
            <p className="font-medium text-blue-600">{cliente.polizasActivas}</p>
            <p className="text-xs text-gray-500">pólizas</p>
          </div>
        );
      case 'valorCartera':
        return (
          <div className="text-right">
            <p className="font-medium text-green-600">{formatCurrency(cliente.valorCartera)}</p>
            <p className="text-xs text-gray-500">valor anual</p>
          </div>
        );
      case 'agente':
        return getAgenteNombre(String(cliente.agente));
      default:
        return '-';
    }
  };

  // Helpers de agentes
  const buildNombreUsuario = (u: any) => {
    const n = [u?.first_name || u?.nombre, u?.last_name || u?.apellidos]
      .filter(Boolean)
      .join(' ')
      .trim();
    return n || u?.name || u?.display_name || u?.email || String(u?.id || '');
  };
  const getAgenteNombre = (id: string) => {
    if (!id || id === 'Sin asignar') return 'Sin asignar';
    const u = usuarios.find((x: any) => String(x.id) === String(id));
    return u ? buildNombreUsuario(u) : 'Sin asignar';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'activo':
        return 'success';
      case 'inactivo':
        return 'gray';
      case 'prospecto':
        return 'warning';
      case 'bloqueado':
        return 'failure';
      default:
        return 'gray';
    }
  };

  const getInitials = (nombre: string) => {
    return nombre
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Paginación backend
  const startIndex = pagination.from || 0;
  const endIndex = pagination.to || 0;
  const currentClientes = clientes;

  // ===== Acciones Masivas - Helpers =====
  const mapEstadoUiToApi = (e: string): string => {
    const v = String(e || '').toLowerCase();
    if (v === 'activo') return 'active';
    if (v === 'inactivo') return 'inactive';
    if (v === 'prospecto') return 'prospect';
    if (v === 'bloqueado') return 'blocked';
    return v;
  };

  const isAllSelected =
    currentClientes.length > 0 && currentClientes.every((c) => selectedIds.has(String(c.id)));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      currentClientes.forEach((c) => {
        if (c.id) next.add(String(c.id));
      });
      setSelectedIds(next);
    }
  };
  const toggleSelectOne = (id?: string) => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const k = String(id);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDeleteClientes = async () => {
    if (selectedIds.size === 0) return;
    const isTrash = filters.trashed === 'only';
    if (!confirm(`¿${isTrash ? 'Eliminar PERMANENTEMENTE' : 'Eliminar'} ${selectedIds.size} cliente(s) seleccionados? Esta acción no se puede deshacer.`)) return;
    try {
      setLoading(true);
      if (isTrash) {
        const ids = Array.from(selectedIds).map(Number);
        const res = await saasApi.eliminarDefinitivoPapelera('clientes', ids);
        toast({ title: 'Eliminación permanente', description: `Eliminados definitivamente: ${(res.data as any)?.deleted ?? ids.length}.` });
      } else {
        const ids = Array.from(selectedIds);
        const results = await Promise.allSettled(ids.map((id) => saasApi.deleteCliente(id)));
        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const fail = results.length - ok;
        toast({ title: 'Eliminación masiva de clientes', description: `Eliminados: ${ok}. Fallidos: ${fail}.` });
      }
      clearSelection();
      await cargarClientes();
      await loadEstadisticas();
    } catch (_e) {
      // Mensajes de error ya manejados por el servicio en cada intento
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBulkClientStateModal = () => {
    if (selectedIds.size === 0) return;
    setBulkClientTargetState('activo');
    setShowBulkStateModal(true);
  };

  const handleConfirmBulkClientStateChange = async () => {
    if (!bulkClientTargetState) return;
    try {
      setLoading(true);
      const target = mapEstadoUiToApi(bulkClientTargetState);
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) => clienteService.updateCliente(id, { estado: target as any })),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      toast({
        title: 'Cambio de estado masivo',
        description: `Actualizados: ${ok}. Fallidos: ${fail}.`,
      });
      setShowBulkStateModal(false);
      clearSelection();
      await cargarClientes();
    } catch (_e) {
      // Errores ya toasteados en clienteService si ocurren
    } finally {
      setLoading(false);
    }
  };

  // Borrado masivo de TODOS los clientes
  const handleBulkDeleteAll = async () => {
    if (bulkDeleteConfirmText !== 'ELIMINAR TODOS') return;

    try {
      setLoading(true);
      const isTrash = filters.trashed === 'only';
      const response = isTrash
        ? await saasApi.eliminarDefinitivoPapelera('clientes', [], true)
        : await saasApi.bulkDeleteClientes({ delete_all: true });
      
      if (response.success) {
        const data = response.data as any;
        toast({
          title: 'Borrado masivo completado',
          description: response.message || `Se eliminaron ${data?.deleted_count ?? data?.deleted ?? 0} clientes.`,
        });
        setShowBulkDeleteAllModal(false);
        setBulkDeleteConfirmText('');
        clearSelection();
        await cargarClientes();
        await loadEstadisticas();
      } else {
        throw new Error(response.message || 'Error al eliminar clientes');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar clientes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-[10px]">
          {error}
        </div>
      )}

      {/* Estadísticas */}
      {estadisticasTotales && estadisticasTotales.total !== undefined && (
        <div data-tour="clientes-stats" className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#573CFF20' }}>
                <Icon icon="solar:users-group-two-rounded-bold-duotone" width={18} style={{ color: '#573CFF' }} />
              </div>
              <span data-tour="clientes-page-title" className="text-xs text-neutral-500 font-medium">Total Clientes</span>
            </div>
            <p className="text-xl font-bold text-white tracking-tight">{estadisticasTotales.total}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
                <Icon icon="solar:check-circle-bold-duotone" width={18} style={{ color: '#22c55e' }} />
              </div>
              <span className="text-xs text-neutral-500 font-medium">Activos</span>
            </div>
            <p className="text-xl font-bold text-white tracking-tight">{estadisticasTotales.activos}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f9731620' }}>
                <Icon icon="solar:clock-circle-bold-duotone" width={18} style={{ color: '#f97316' }} />
              </div>
              <span className="text-xs text-neutral-500 font-medium">Prospectos</span>
            </div>
            <p className="text-xl font-bold text-white tracking-tight">{estadisticasTotales.prospectos}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#573CFF20' }}>
                <Icon icon="solar:wallet-bold-duotone" width={18} style={{ color: '#573CFF' }} />
              </div>
              <span className="text-xs text-neutral-500 font-medium">Valor Cartera</span>
            </div>
            <p className="text-xl font-bold text-white tracking-tight">{formatCurrency(estadisticasTotales.valorTotal)}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3b82f620' }}>
                <Icon icon="solar:shield-check-bold-duotone" width={18} style={{ color: '#3b82f6' }} />
              </div>
              <span className="text-xs text-neutral-500 font-medium">Pólizas Activas</span>
            </div>
            <p className="text-xl font-bold text-white tracking-tight">{estadisticasTotales.polizasTotal}</p>
          </div>
        </div>
      )}

      {/* Tabla de clientes */}
      <div data-tour="clientes-table" className="rounded-2xl border border-neutral-800 bg-neutral-950/70 overflow-hidden">
        {/* Tabs Activos / Papelera */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-neutral-800/60">
          {([
            { v: 'none' as const, label: 'Activos', icon: 'solar:users-group-rounded-bold-duotone', color: '#573CFF' },
            { v: 'only' as const, label: 'Papelera', icon: 'solar:trash-bin-trash-bold-duotone', color: '#ef4444' },
          ]).map(t => {
            const isActive = (filters.trashed || 'none') === t.v;
            const count = isActive ? (pagination?.total ?? null) : null;
            return (
              <button
                key={t.v}
                onClick={() => setFilters(prev => ({ ...prev, trashed: t.v, page: 1 }))}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  isActive ? '' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
                style={isActive ? { borderColor: t.color, color: t.color } : {}}
              >
                <Icon icon={t.icon} width={16} />
                {t.label}
                {count !== null && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full" style={{ backgroundColor: t.color + '33', color: t.color }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Search bar + actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800/60">
          <div className="relative flex-1 max-w-sm">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" width={16} />
            <input
              type="text"
              placeholder="Buscar por nombre, documento o email..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:border-[#573CFF] focus:outline-none transition-colors"
            />
          </div>
          <button onClick={() => cargarClientes()} disabled={loading} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-2 text-neutral-400 transition-colors" title="Refrescar">
            <Icon icon={loading ? 'svg-spinners:ring-resize' : 'solar:refresh-linear'} width={18} />
          </button>
          <button onClick={handleOpenFilterModal} className="relative rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-2 text-neutral-400 transition-colors" title="Filtros">
            <Icon icon="solar:filter-bold-duotone" width={18} />
            {getActiveFiltersCount() > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{getActiveFiltersCount()}</span>
            )}
          </button>
          <button
            onClick={() => setShowNotificationsModal(true)}
            className={`relative rounded-lg border px-2.5 py-2 transition-colors ${
              notificationStatus?.is_active && notificationStatus?.whatsapp_status?.connected
                ? 'border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                : notificationStatus?.is_active && !notificationStatus?.whatsapp_status?.connected
                ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 animate-pulse'
                : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
            title={
              notificationStatus?.is_active && notificationStatus?.whatsapp_status?.connected
                ? '✅ Notificaciones Activas - WhatsApp Conectado'
                : notificationStatus?.is_active && !notificationStatus?.whatsapp_status?.connected
                ? '⚠️ Notificaciones Activas - WhatsApp Desconectado'
                : 'Notificaciones Inactivas'
            }
            data-feature="client-notifications-v2"
          >
            {notificationStatus?.is_active && (
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${notificationStatus?.whatsapp_status?.connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
            )}
            <Icon icon="solar:bell-bold-duotone" width={18} />
          </button>
          <button onClick={() => setShowExportModal(true)} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-2 text-neutral-400 transition-colors" title="Exportar">
            <Icon icon="solar:download-bold-duotone" width={18} />
          </button>
          <button
            onClick={() => {
              if (visibleColumns.includes('polizas')) {
                setVisibleColumns(['nombre', 'tipo', 'documento', 'genero', 'edad', 'contacto', 'ubicacion', 'estado']);
              } else {
                setVisibleColumns(['nombre', 'tipo', 'documento', 'genero', 'edad', 'contacto', 'ubicacion', 'estado', 'polizas', 'valorCartera']);
              }
            }}
            className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-2 text-neutral-400 transition-colors"
            title="Mostrar/Ocultar más columnas"
          >
            <Icon icon="solar:eye-bold-duotone" width={18} />
          </button>
          {canCreateClient && (
            <Link to="/apps/seguros/clientes/nuevo" data-tour="clientes-create-btn">
              <button className="flex items-center gap-2 rounded-lg border border-[#573CFF]/40 bg-[#573CFF] hover:bg-[#4b31e6] px-4 py-2 text-sm font-medium text-white transition-colors">
                <Icon icon="solar:add-circle-bold-duotone" width={18} />
                <span className="hidden sm:inline">Nuevo Cliente</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            </Link>
          )}
        </div>
        {/* Table content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Icon icon="svg-spinners:ring-resize" width={32} className="text-[#573CFF]" />
            </div>
          ) : currentClientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
              <Icon icon="solar:user-hands-bold-duotone" width={48} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No tienes clientes registrados aún</p>
              <p className="text-xs mt-1">Comienza creando tu primer cliente</p>
              {canCreateClient && (
                <Link to="/apps/seguros/clientes/nuevo" className="mt-3">
                  <button className="flex items-center gap-2 rounded-lg border border-[#573CFF]/40 bg-[#573CFF] hover:bg-[#4b31e6] px-4 py-2 text-sm font-medium text-white transition-colors">
                    <Icon icon="solar:user-plus-bold" width={16} />
                    Crear primer cliente
                  </button>
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Selection toolbar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800/60">
                <button
                  onClick={() => toggleSelectAll()}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    currentClientes.length > 0 && currentClientes.every((c) => selectedIds.has(String(c.id)))
                      ? 'bg-[#573CFF] text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {currentClientes.length > 0 && currentClientes.every((c) => selectedIds.has(String(c.id)))
                    ? 'Deseleccionar todo'
                    : 'Seleccionar todo'}
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-xs text-gray-700 dark:text-neutral-400">
                      <strong className="text-[#573CFF] dark:text-[#a78bfa]">{selectedIds.size}</strong> seleccionados
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        onClick={handleOpenBulkClientStateModal}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#573CFF]/40 bg-[#573CFF]/10 text-[#573CFF] dark:text-[#a78bfa] hover:bg-[#573CFF]/20 transition-colors"
                      >
                        <Icon icon="solar:settings-bold-duotone" width={14} />
                        Cambiar estado
                      </button>
                      {canDeleteClient && (
                        <>
                          <button
                            onClick={handleBulkDeleteClientes}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Icon icon="solar:trash-bin-minimalistic-bold-duotone" width={14} />
                            Eliminar ({selectedIds.size})
                          </button>
                          {estadisticasTotales && estadisticasTotales.total > 0 && (
                            <button
                              onClick={() => setShowBulkDeleteAllModal(true)}
                              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                            >
                              <Icon icon="solar:trash-bin-trash-bold-duotone" width={14} />
                              Eliminar TODOS ({estadisticasTotales.total})
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={clearSelection}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
                      >
                        Limpiar
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Table */}
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-500">
                    {visibleColumns.map((columnKey) => {
                      const apiField = columnToApiField[columnKey];
                      const isSortable = !!apiField;
                      const isActive = isSortable && filters.sort_by === apiField;
                      const dir = isActive ? filters.sort_dir || 'asc' : undefined;
                      return (
                        <th key={columnKey} className="px-4 py-3 font-medium whitespace-nowrap">
                          <div
                            className={isSortable ? 'flex items-center gap-1.5 cursor-pointer select-none hover:text-neutral-300 transition-colors' : ''}
                            onClick={() => isSortable && toggleSort(columnKey)}
                          >
                            <span>{getColumnName(columnKey)}</span>
                            {isSortable && (
                              <Icon
                                icon={
                                  isActive
                                    ? dir === 'asc'
                                      ? 'solar:arrow-up-bold-duotone'
                                      : 'solar:arrow-down-bold-duotone'
                                    : 'solar:sort-vertical-bold-duotone'
                                }
                                className={`w-3.5 h-3.5 ${isActive ? 'text-[#573CFF]' : 'text-neutral-600'}`}
                              />
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {currentClientes.map((cliente) => (
                    <tr
                      key={cliente.id}
                      className={`hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer ${selectedIds.has(String(cliente.id)) ? 'bg-[#573CFF]/10 dark:bg-[#573CFF]/5' : ''}`}
                      onClick={() => toggleSelectOne(cliente.id)}
                    >
                      {visibleColumns.map((columnKey) => (
                        <td key={columnKey} className="px-4 py-3 text-sm text-neutral-300 whitespace-nowrap">
                          {renderTableCell(cliente, columnKey)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <TableActionMenu>
                          <TableMenuItem onClick={() => handleViewCliente(cliente)}>
                            <Icon icon="solar:eye-bold-duotone" height={18} />
                            <span>Ver Detalles</span>
                          </TableMenuItem>
                          {canEditClient && (
                            <Link
                              to={`/apps/seguros/clientes/editar/${cliente.id}`}
                              onClick={() => {
                                const debugInfo = {
                                  timestamp: new Date().toISOString(),
                                  action: 'CLICK_EDITAR',
                                  clienteId: cliente.id,
                                  clienteCompleto: cliente,
                                };
                                localStorage.setItem(
                                  'debug_last_cliente_edit',
                                  JSON.stringify(debugInfo),
                                );
                                const historial = JSON.parse(
                                  localStorage.getItem('debug_historial') || '[]',
                                );
                                historial.push(debugInfo);
                                if (historial.length > 10) historial.shift();
                                localStorage.setItem(
                                  'debug_historial',
                                  JSON.stringify(historial),
                                );
                              }}
                            >
                              <TableMenuItem>
                                <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                                <span>Editar</span>
                              </TableMenuItem>
                            </Link>
                          )}
                          {canCreatePolicy && (
                            <TableMenuItem onClick={() => handleCreatePoliza(cliente)}>
                              <Icon icon="solar:document-add-bold-duotone" height={18} />
                              <span>Nueva Póliza</span>
                            </TableMenuItem>
                          )}
                          {canDeleteClient && (filters.trashed === 'only' ? (
                            <>
                              <TableMenuItem className="text-green-600 hover:text-green-700" onClick={async () => {
                                const res = await saasApi.restaurarPapelera('clientes', [Number(cliente.id)]);
                                if (res.success) { await cargarClientes(); } else alert(res.message || 'Error');
                              }}>
                                <Icon icon="solar:refresh-circle-bold-duotone" height={18} />
                                <span>Restaurar</span>
                              </TableMenuItem>
                              <TableMenuItem className="text-red-600 hover:text-red-700" onClick={async () => {
                                const nombre = (cliente as any).first_name ? `${(cliente as any).first_name} ${(cliente as any).last_name||''}`.trim() : ((cliente as any).company || (cliente as any).name || `cliente ${cliente.id}`);
                                if (!confirm(`¿Eliminar PERMANENTEMENTE a ${nombre}? Esta acción NO se puede deshacer.`)) return;
                                const res = await saasApi.eliminarDefinitivoPapelera('clientes', [Number(cliente.id)]);
                                if (res.success) { await cargarClientes(); } else alert(res.message || 'Error');
                              }}>
                                <Icon icon="solar:trash-bin-2-bold-duotone" height={18} />
                                <span>Eliminar definitivo</span>
                              </TableMenuItem>
                            </>
                          ) : (
                            <TableMenuItem className="text-red-600 hover:text-red-700" onClick={() => handleDeleteCliente(cliente)}>
                              <Icon icon="solar:trash-bin-minimalistic-bold-duotone" height={18} />
                              <span>Eliminar</span>
                            </TableMenuItem>
                          ))}
                        </TableActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Pagination */}
        {(pagination.last_page || 1) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
            <span className="text-xs text-neutral-500">
              Mostrando {startIndex || 0}-{endIndex || 0} de {pagination.total || 0}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const newPage = Math.max(1, (pagination.current_page || 1) - 1);
                  setFilters((prev) => ({ ...prev, page: newPage }));
                }}
                disabled={(pagination.current_page || 1) <= 1}
                className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 transition-colors"
              >
                <Icon icon="solar:alt-arrow-left-linear" width={16} />
              </button>
              {Array.from({ length: Math.min(pagination.last_page || 1, 7) }, (_, i) => {
                let pageNum: number;
                const lastPage = pagination.last_page || 1;
                const currentPage = pagination.current_page || 1;
                if (lastPage <= 7) pageNum = i + 1;
                else if (currentPage <= 4) pageNum = i + 1;
                else if (currentPage >= lastPage - 3) pageNum = lastPage - 6 + i;
                else pageNum = currentPage - 3 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setFilters((prev) => ({ ...prev, page: pageNum }))}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${currentPage === pageNum ? 'bg-[#573CFF] text-white' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  const newPage = Math.min(pagination.last_page || 1, (pagination.current_page || 1) + 1);
                  setFilters((prev) => ({ ...prev, page: newPage }));
                }}
                disabled={(pagination.current_page || 1) >= (pagination.last_page || 1)}
                className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 transition-colors"
              >
                <Icon icon="solar:alt-arrow-right-linear" width={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Filtros */}
      <Modal show={showFilterModal} onClose={() => setShowFilterModal(false)} size="2xl">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:filter-bold-duotone" className="w-5 h-5" />
            <span>Filtros Avanzados</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="tipo">Tipo de Cliente</Label>
              <Select
                value={modalFilters.tipo || 'todos'}
                onValueChange={(value) => handleModalFilterChange('tipo', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {TIPOS_CLIENTE.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={modalFilters.estado || 'todos'}
                onValueChange={(value) => handleModalFilterChange('estado', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {ESTADOS_CLIENTE.map((estado) => (
                    <SelectItem key={estado.value} value={estado.value}>
                      {estado.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tipo_documento">Tipo de documento</Label>
              <Select
                value={modalFilters.tipo_documento || 'todos'}
                onValueChange={(value) => handleModalFilterChange('tipo_documento', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TIPOS_DOCUMENTO.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="departamento">Departamento</Label>
              <Select
                value={modalFilters.departamento || 'todos'}
                onValueChange={(value) => handleModalFilterChange('departamento', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos los departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los departamentos</SelectItem>
                  {departamentosDinamicos.map((depto) => (
                    <SelectItem key={depto} value={depto}>
                      {depto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* País eliminado del set de filtros */}
            <div>
              <Label htmlFor="agente">Agente</Label>
              <Select
                value={modalFilters.agente || 'todos'}
                onValueChange={(value) => handleModalFilterChange('agente', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos los agentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los agentes</SelectItem>
                  <SelectItem value="Sin asignar">Sin asignar</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {buildNombreUsuario(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Documento eliminado del set de filtros */}
            {/* Email eliminado del set de filtros */}
            {/* Teléfono eliminado del set de filtros */}
            <div>
              <Label htmlFor="ciudad">Ciudad</Label>
              <Select
                value={modalFilters.ciudad || 'todos'}
                onValueChange={(value) => handleModalFilterChange('ciudad', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas las ciudades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las ciudades</SelectItem>
                  {ciudadesDinamicasModal.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="genero">Género</Label>
              <Select
                value={modalFilters.genero || 'todos'}
                onValueChange={(value) => handleModalFilterChange('genero', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {GENEROS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edad_min">Edad mín.</Label>
                <Input
                  id="edad_min"
                  type="number"
                  className="mt-1"
                  value={modalFilters.edad_min}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleModalFilterChange('edad_min', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="edad_max">Edad máx.</Label>
                <Input
                  id="edad_max"
                  type="number"
                  className="mt-1"
                  value={modalFilters.edad_max}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleModalFilterChange('edad_max', e.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fecha_desde">Fecha desde</Label>
                <Input
                  id="fecha_desde"
                  type="date"
                  className="mt-1"
                  value={modalFilters.fecha_desde}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleModalFilterChange('fecha_desde', e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="fecha_hasta">Fecha hasta</Label>
                <Input
                  id="fecha_hasta"
                  type="date"
                  className="mt-1"
                  value={modalFilters.fecha_hasta}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleModalFilterChange('fecha_hasta', e.target.value)
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select
                value={modalFilters.priority || 'todos'}
                onValueChange={(value) => handleModalFilterChange('priority', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Pólizas mín/máx eliminado */}
            {/* Valor mín/máx eliminado */}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() =>
              setModalFilters({
                search: '',
                tipo: '',
                tipo_documento: '',
                estado: '',
                departamento: '',
                agente: '',
                sort_by: '',
                sort_dir: '',
                ciudad: '',
                genero: '',
                edad_min: '',
                edad_max: '',
                fecha_desde: '',
                fecha_hasta: '',
                priority: '',
                page: 1,
                per_page: elementsPerPage,
              })
            }
            className="rounded-[10px]"
          >
            <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
            Limpiar Filtros
          </Button>
          <Button
            color="blue"
            onClick={() => {
              setFilters({ ...modalFilters, page: 1 });
              setShowFilterModal(false);
            }}
            className="rounded-[10px]"
          >
            <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mr-2" />
            Aplicar Filtros
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Detalle */}
      <Modal show={showModal} onClose={handleCloseDetailsModal} size="5xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Avatar
              placeholderInitials={selectedCliente ? getInitials(selectedCliente.nombre) : ''}
              rounded
              size="md"
            />
            <div>
              <h3 className="text-lg font-semibold">{selectedCliente?.nombre}</h3>
              <p className="text-sm text-gray-500">
                {selectedCliente?.tipoDocumento} {selectedCliente?.numeroDocumento}
              </p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedCliente && (
            <Tabs>
              <Tabs.Item title="Información General" active>
                {loadingFull ? (
                  <div className="py-6 flex items-center gap-2 text-gray-500">
                    <Spinner size="sm" /> Cargando información del cliente...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Datos Generales</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Tipo de Cliente:</span>
                          <div className="flex items-center gap-2">
                            <Icon
                              icon={getTipoIcon(selectedCliente.tipoCliente)}
                              className="w-4 h-4 text-gray-600"
                            />
                            <span className="capitalize">{selectedCliente.tipoCliente}</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Estado:</span>
                          <Badge
                            color={getEstadoBadge(
                              (fullCliente?.estado || selectedCliente.estado)
                                .toString()
                                .toLowerCase(),
                            )}
                            className="capitalize"
                          >
                            {(fullCliente?.estado || selectedCliente.estado)
                              .toString()
                              .toLowerCase()}
                          </Badge>
                        </div>
                        {fullCliente?.codigo_cliente ? (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Código Cliente:</span>
                            <span className="font-medium">{fullCliente.codigo_cliente}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Documento:</span>
                          <span className="font-medium">
                            {selectedCliente.tipoDocumento} {selectedCliente.numeroDocumento}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Fecha de Nacimiento:</span>
                          <span className="font-medium">
                            {fullCliente?.persona?.fecha_nacimiento ||
                              selectedCliente.fechaNacimiento ||
                              '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Fecha de Registro:</span>
                          <span className="font-medium">
                            {new Date(selectedCliente.fechaRegistro).toLocaleDateString('es-CO')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Contacto y Ubicación</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Email:</span>
                          <span className="font-medium">
                            {fullCliente?.email || selectedCliente.email || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Teléfono:</span>
                          <span className="font-medium">
                            {fullCliente?.telefono || selectedCliente.telefono || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Celular:</span>
                          <span className="font-medium">{fullCliente?.celular || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Dirección:</span>
                          <span className="font-medium">
                            {fullCliente?.direccion || selectedCliente.direccion || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Ciudad:</span>
                          <span className="font-medium">
                            {fullCliente?.ciudad || selectedCliente.ciudad || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Departamento:</span>
                          <span className="font-medium">
                            {fullCliente?.departamento || selectedCliente.departamento || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">País:</span>
                          <span className="font-medium">{fullCliente?.pais || 'Colombia'}</span>
                        </div>
                        {fullCliente?.codigo_postal ? (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Código Postal:</span>
                            <span className="font-medium">{fullCliente.codigo_postal}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      {fullCliente?.tipo === 'PERSONA' && fullCliente.persona ? (
                        <>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Datos de Persona</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Nombres:</span>
                              <div className="font-medium">{fullCliente.persona.nombres}</div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Apellidos:</span>
                              <div className="font-medium">{fullCliente.persona.apellidos}</div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Tipo Doc. / Número:</span>
                              <div className="font-medium">
                                {fullCliente.persona.tipo_documento} {fullCliente.persona.documento}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Fecha Nacimiento:</span>
                              <div className="font-medium">
                                {fullCliente.persona.fecha_nacimiento}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Género:</span>
                              <div className="font-medium">{fullCliente.persona.genero}</div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Estado Civil:</span>
                              <div className="font-medium">{fullCliente.persona.estado_civil}</div>
                            </div>
                            {fullCliente.persona.profesion ? (
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Profesión:</span>
                                <div className="font-medium">{fullCliente.persona.profesion}</div>
                              </div>
                            ) : null}
                            {typeof fullCliente.persona.ingresos_mensuales === 'number' ? (
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Ingresos Mensuales:</span>
                                <div className="font-medium">
                                  {new Intl.NumberFormat('es-CO', {
                                    style: 'currency',
                                    currency: 'COP',
                                    minimumFractionDigits: 0,
                                  }).format(fullCliente.persona.ingresos_mensuales)}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : null}

                      {fullCliente?.tipo === 'EMPRESA' && fullCliente.empresa ? (
                        <>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Datos de Empresa</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Razón Social:</span>
                              <div className="font-medium">{fullCliente.empresa.razon_social}</div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">NIT:</span>
                              <div className="font-medium">{fullCliente.empresa.nit}</div>
                            </div>
                            {fullCliente.empresa.nombre_comercial ? (
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Nombre Comercial:</span>
                                <div className="font-medium">
                                  {fullCliente.empresa.nombre_comercial}
                                </div>
                              </div>
                            ) : null}
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Tipo de Empresa:</span>
                              <div className="font-medium">{fullCliente.empresa.tipo_empresa}</div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Representante Legal:</span>
                              <div className="font-medium">
                                {fullCliente.empresa.representante_legal}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Doc. Representante:</span>
                              <div className="font-medium">
                                {fullCliente.empresa.documento_representante}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Sector Económico:</span>
                              <div className="font-medium">
                                {fullCliente.empresa.sector_economico}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Actividad Económica:</span>
                              <div className="font-medium">
                                {fullCliente.empresa.actividad_economica}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">N° Empleados:</span>
                              <div className="font-medium">
                                {fullCliente.empresa.numero_empleados}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Fecha Constitución:</span>
                              <div className="font-medium">
                                {fullCliente.empresa.fecha_constitucion}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {fullCliente?.tipo === 'CONSORCIO' && fullCliente.consorcio ? (
                        <>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Datos de Consorcio</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Nombre:</span>
                              <div className="font-medium">
                                {fullCliente.consorcio.nombre_consorcio}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Objeto:</span>
                              <div className="font-medium">
                                {fullCliente.consorcio.objeto_consorcio}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Duración:</span>
                              <div className="font-medium">
                                {fullCliente.consorcio.duracion_consorcio}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </Tabs.Item>
              <Tabs.Item title="Pólizas">
                {loadingTabs ? (
                  <div className="py-6 flex items-center gap-2 text-gray-500">
                    <Spinner size="sm" /> Cargando pólizas...
                  </div>
                ) : polizasCliente.length === 0 ? (
                  <div className="py-6 text-gray-500">Sin pólizas para este cliente.</div>
                ) : (
                  <div className="guro-table-wrap">
                    <table className="guro-table">
                      <thead>
                        <tr>
                          <th>Número</th>
                          <th>Aseguradora</th>
                          <th>Ramo</th>
                          <th>Prima</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {polizasCliente.map((p: any) => (
                          <tr
                            key={p.id}
                            className="cursor-pointer group"
                            onClick={() => {
                              handleCloseDetailsModal();
                              navigate(`/apps/seguros/polizas?open_poliza_id=${p.id}`);
                            }}
                          >
                            <td>{p.numero_poliza || p.policy_number}</td>
                            <td>
                              {(() => {
                                const asegName = (p as any).aseguradora_nombre || p.aseguradora || p.insurance_company || '';
                                const logo = getInsurerLogo(asegName);
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200 dark:border-neutral-700 shrink-0">
                                      {logo ? (
                                        <img src={logo} alt="" className="w-5 h-5 object-contain" />
                                      ) : (
                                        <span className="text-[9px] font-bold text-[#111]">{asegName.charAt(0)}</span>
                                      )}
                                    </div>
                                    <span>{asegName}</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td>
                              {(p as any).ramo_nombre || p.ramo_principal || p.type}
                            </td>
                            <td>
                              {new Intl.NumberFormat('es-CO', {
                                style: 'currency',
                                currency: 'COP',
                                minimumFractionDigits: 0,
                              }).format(p.prima_neta || p.premium_amount || 0)}
                            </td>
                            <td>{p.estado || p.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Tabs.Item>
              <Tabs.Item title="Seguimientos">
                {loadingTabs ? (
                  <div className="py-6 flex items-center gap-2 text-gray-500">
                    <Spinner size="sm" /> Cargando seguimientos...
                  </div>
                ) : tareasCliente.length === 0 ? (
                  <div className="py-6 text-gray-500">Sin seguimientos registrados.</div>
                ) : (
                  <div className="guro-table-wrap">
                    <table className="guro-table">
                      <thead>
                        <tr>
                          <th>Título</th>
                          <th>Tipo</th>
                          <th>Prioridad</th>
                          <th>Estado</th>
                          <th>Programado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tareasCliente.map((t: any) => (
                          <tr key={t.id} className="group">
                            <td>{t.title}</td>
                            <td>{t.type}</td>
                            <td>{t.priority}</td>
                            <td>{t.status}</td>
                            <td>
                              {t.scheduled_for
                                ? new Date(t.scheduled_for).toLocaleString('es-CO')
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Tabs.Item>
            </Tabs>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Link to={`/apps/seguros/clientes/editar/${selectedCliente?.id}`}>
            <Button color="blue" className="rounded-[10px]">
              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 mr-2" />
              Editar Cliente
            </Button>
          </Link>
          <Button color="gray" onClick={() => setShowModal(false)} className="rounded-[10px]">
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Exportación */}
      <ClientesExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentFilters={filters}
      />

      {/* Modal de Notificaciones de Clientes */}
      <ClientNotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => {
          setShowNotificationsModal(false);
          loadNotificationStatus();
        }}
      />

      {/* Modal cambio de estado masivo */}
      <Modal show={showBulkStateModal} onClose={() => setShowBulkStateModal(false)} size="md">
        <Modal.Header>Cambiar estado a {selectedIds.size} cliente(s)</Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <Label>Nuevo estado</Label>
            <select
              className="w-full border rounded-md p-2 dark:bg-darkgray"
              value={bulkClientTargetState}
              onChange={(e) => setBulkClientTargetState(e.target.value)}
            >
              {ESTADOS_CLIENTE.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Se aplicará a todos los clientes seleccionados.</p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="blue" onClick={handleConfirmBulkClientStateChange}>
            Aplicar
          </Button>
          <Button color="gray" onClick={() => setShowBulkStateModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de borrado masivo total */}
      <Modal 
        show={showBulkDeleteAllModal} 
        onClose={() => {
          setShowBulkDeleteAllModal(false);
          setBulkDeleteConfirmText('');
        }} 
        size="md"
      >
        <Modal.Header>
          <div className="flex items-center gap-2 text-red-600">
            <Icon icon="solar:danger-triangle-bold" className="w-6 h-6" />
            Eliminar TODOS los clientes
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-400 font-medium">
                ⚠️ Esta acción eliminará permanentemente TODOS los {estadisticasTotales?.total || 0} clientes de tu cuenta.
              </p>
              <p className="text-red-600 dark:text-red-500 text-sm mt-2">
                Esta acción NO se puede deshacer.
              </p>
            </div>
            
            <div>
              <Label className="text-gray-700 dark:text-gray-300">
                Para confirmar, escribe <strong>ELIMINAR TODOS</strong> en el campo:
              </Label>
              <Input
                type="text"
                value={bulkDeleteConfirmText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBulkDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR TODOS"
                className="mt-2"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            color="failure" 
            onClick={handleBulkDeleteAll}
            disabled={bulkDeleteConfirmText !== 'ELIMINAR TODOS' || loading}
          >
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Eliminando...
              </>
            ) : (
              <>
                <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" />
                Eliminar todos los clientes
              </>
            )}
          </Button>
          <Button 
            color="gray" 
            onClick={() => {
              setShowBulkDeleteAllModal(false);
              setBulkDeleteConfirmText('');
            }}
          >
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Clientes;
