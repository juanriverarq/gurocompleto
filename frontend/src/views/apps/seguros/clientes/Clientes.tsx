import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Table, Modal, Tabs, Avatar, Spinner, Dropdown, Label, Checkbox } from 'flowbite-react';
import { IconDots } from '@tabler/icons-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
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
// import { ClienteSaaS } from '../../../../types/saas';
import { TIPOS_CLIENTE, TIPOS_DOCUMENTO, GENEROS, ESTADOS_CLIENTE } from 'src/constants/catalogos';
import ClientesExportModal from './components/ClientesExportModal';
import { ClienteSaaS } from 'src/types/saas';
import { clienteService } from 'src/services/clienteService';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';


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
}

// Función para convertir datos de la API al formato local
const convertirClienteAPI = (clienteAPI: any): Cliente => {
  // Determinar tipoCliente primero para decidir qué nombre mostrar
  const docType: any = clienteAPI.tipo_documento || clienteAPI.document_type;
  const hasCompany = !!(clienteAPI.company || clienteAPI.company_legal_name || clienteAPI.razon_social);
  let tipoCliente: 'persona' | 'empresa' = (clienteAPI.client_type === 'empresa' || docType === 'NIT' || hasCompany) ? 'empresa' : 'persona';

  // Nombre mostrado según tipo
  let nombre = '';
  if (tipoCliente === 'empresa') {
    nombre = (clienteAPI.razon_social || clienteAPI.company_legal_name || clienteAPI.company || '').toString().trim();
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
      nombre = (clienteAPI.razon_social || clienteAPI.company_legal_name || clienteAPI.company || '').toString().trim();
    }
  }

  // Tipo y número de documento
  let tipoDocumento: 'CC' | 'NIT' | 'CE' | 'TI' | 'PP' | 'RC' | 'pasaporte' = (docType || 'CC');
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
  
  const rawBirth = clienteAPI.fecha_nacimiento || clienteAPI.birth_date || clienteAPI.persona?.fecha_nacimiento || '';
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
    const hasHadBirthday = (today.getMonth() + 1 > m) || ((today.getMonth() + 1 === m) && (today.getDate() >= d));
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
    ultimaActividad: clienteAPI.updated_at?.split('T')[0] || clienteAPI.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    observaciones: clienteAPI.observaciones || clienteAPI.notes || ''
  };
};


const departamentosFallback = [
  'Antioquia', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá',
  'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Quindío',
  'Risaralda', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca'
];

const Clientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  // Paginación backend
  const [pagination, setPagination] = useState<{ current_page: number; last_page: number; per_page: number; total: number; from: number; to: number }>({
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
    per_page: Number(localStorage.getItem('clientes_page_size') || '15')
  });
  // Borrador de filtros para el modal (no aplica hasta confirmar)
  const [modalFilters, setModalFilters] = useState({ ...filters });
  
  // Columnas visibles
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'nombre', 'tipo', 'documento', 'contacto', 'ubicacion', 'estado'
  ]);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [deleteEnabled, setDeleteEnabled] = useState<boolean>(false);
  const { user, loading: saasLoading, usuarioSaas } = useUnifiedAuth();

  // Selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkStateModal, setShowBulkStateModal] = useState(false);
  const [bulkClientTargetState, setBulkClientTargetState] = useState<string>('activo');

  // Usuarios (Agentes) dinámicos
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const departamentosDinamicos = React.useMemo(() => {
    const set = new Set<string>();
    (clientes || []).forEach(c => { if (c.departamento) set.add(c.departamento); });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    return list.length ? list : departamentosFallback;
  }, [clientes]);
  const ciudadesDinamicas = React.useMemo(() => {
    const set = new Set<string>();
    (clientes || []).forEach(c => {
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
    (clientes || []).forEach(c => {
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
      setFilters(prev => ({ ...prev, ciudad: '' }));
    }
  }, [filters.departamento, ciudadesDinamicas]);

  // Mantener coherencia en el modal: si cambia el departamento en el borrador y la ciudad ya no aplica, limpiar ciudad del borrador
  useEffect(() => {
    if (modalFilters.ciudad && !ciudadesDinamicasModal.includes(modalFilters.ciudad)) {
      setModalFilters(prev => ({ ...prev, ciudad: '' }));
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
    // Inicializar deleteEnabled desde runtime config (window.__ENV__), luego env, query param y localStorage
    const init = () => {
      // 1) Runtime config (producción): public/env.js -> window.__ENV__.CLIENTES_DELETE_ENABLED
      const runtimeVal = (window as any)?.__ENV__?.CLIENTES_DELETE_ENABLED;
      let enabled = typeof runtimeVal === 'boolean' ? runtimeVal : false;

      // 2) Build-time (Vite env)
      if (!enabled) {
        const rawEnv = (import.meta as any)?.env?.VITE_CLIENTES_DELETE_ENABLED;
        const envVal = String(rawEnv || '').trim().toLowerCase();
        enabled = envVal === 'true';
      }

      // 3) Query param: ?enableDelete=1|true (persiste en localStorage y limpia la URL)
      const params = new URLSearchParams(location.search);
      const qp = params.get('enableDelete');
      if (!enabled && qp && ['1','true','yes','on'].includes(qp.toLowerCase())) {
        localStorage.setItem('clientes_delete_enabled', 'true');
        enabled = true;
        try {
          params.delete('enableDelete');
          const newUrl = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}${location.hash || ''}`;
          window.history.replaceState({}, '', newUrl);
        } catch {}
      }

      // 4) Fallback: localStorage
      if (!enabled) {
        const ls = String(localStorage.getItem('clientes_delete_enabled') || '').trim().toLowerCase();
        enabled = ls === 'true';
      }

      setDeleteEnabled(enabled);
    };
    init();

    // Escuchar cambios en localStorage desde otras pestañas (opcional en dev)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'clientes_delete_enabled') {
        setDeleteEnabled(String(e.newValue || '').trim().toLowerCase() === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [location.search]);

  useEffect(() => {
    // Persistir tamaño de página y sincronizar con filtros
    localStorage.setItem('clientes_page_size', String(elementsPerPage));
    setFilters(prev => ({ ...prev, per_page: elementsPerPage }));
  }, [elementsPerPage]);

  // Handlers
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      // Si cambia cualquier filtro distinto a la página o per_page, reiniciar a página 1
      page: key === 'page' || key === 'per_page' ? (key === 'page' ? value as any : 1) : 1,
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
            e === 'activo' ? 'active' :
            e === 'inactivo' ? 'inactive' :
            e === 'prospecto' ? 'prospect' :
            e === 'bloqueado' ? 'blocked' : '';
          if (normalized) params.estado = normalized;
        }

        // Ciudad
        if (ui.ciudad) params.ciudad = ui.ciudad;

        // Departamento (state)
        if (ui.departamento) params.departamento = ui.departamento;

        // Tipo de documento (CC, CE, NIT, TI, PP, RC)
        if (ui.tipo_documento && ui.tipo_documento !== 'todos') params.tipo_documento = ui.tipo_documento;

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
          if (['low','medium','high'].includes(p)) params.priority = p;
        }

        // Agente: backend no filtra por asesor_id en index; omitir para evitar ruido

        // Ordenamiento: traducir sort_by/sort_dir (UI) a sort_field/sort_direction (API)
        if (ui.sort_by) params.sort_field = ui.sort_by;
        if (ui.sort_dir) params.sort_direction = ui.sort_dir;

        // Ignorar filtros no soportados por el backend actual: agente (no soportado en index)
        return params;
      };

      const params = buildClienteFiltersFromUI(filters);
      console.debug('[Clientes] Params enviados a API /saas/clientes', params);
      const res = await saasApi.getClientes(params);

      const root: any = res as any;
      const payload: any = Array.isArray(res?.data) || typeof res?.data === 'object' ? (res.data as any) : root;
      const list: any[] = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : []);

      const meta = {
        current_page: Number(payload?.current_page || root?.current_page || params.page || 1),
        last_page: Number(payload?.last_page || root?.last_page || 1),
        per_page: Number(payload?.per_page || root?.per_page || params.per_page || elementsPerPage || 15),
        total: Number(payload?.total || root?.total || list.length || 0),
        from: Number(payload?.from || root?.from || ((params.page - 1) * params.per_page + (list.length ? 1 : 0))),
        to: Number(payload?.to || root?.to || ((params.page - 1) * params.per_page + list.length)),
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
          polizasTotal: response.data.total_polizas_activas || 0
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
        polizasTotal: 0
      });
    }
  };

  // Efectos
  useEffect(() => {
    cargarClientes();
  }, [filters]);

  useEffect(() => {
    loadEstadisticas();
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
    setFilters(prev => {
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
          : (Array.isArray(payload?.data) ? payload.data : []);
        setUsuarios(list || []);
      } catch (e: any) {
        const msg = String(e?.message || '');
        const status = e?.status ?? 0;
        const code = String(e?.code || '').toUpperCase();

        // Silenciar casos no críticos:
        // - 404: el endpoint de usuarios puede no existir en algunos backends
        // - 401/403/Unauthenticated: permisos insuficientes para listar usuarios (no bloquea la vista de clientes)
        if (msg.includes('404') || status === 401 || status === 403 || /unauth|unath/i.test(msg) || code === 'UNAUTHENTICATED') {
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
      setClientes(prev => {
        const updated = convertirClienteAPI(state.updatedCliente);
        const idx = prev.findIndex(c => c.id === String(updated.id));
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
    await Promise.all([
      loadClienteFullData(cliente.id),
      loadClienteRelatedData(cliente.id),
    ]);
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
      await Promise.all([
        loadClienteFullData(clienteId),
        loadClienteRelatedData(clienteId),
      ]);
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
      const cli = clientes.find(c => String(c.id) === String(clienteId));
      const dni = cli?.numeroDocumento || selectedCliente?.numeroDocumento || '';
      const [polizasRes, tareasRes] = await Promise.all([
        saasApi.getPolizas({ client_id: clienteId, dni_cliente: dni, per_page: 50 }),
        saasApi.getCommercialTasks({ client_id: clienteId, per_page: 50 }),
      ]);
      const polizasData = Array.isArray(polizasRes.data) ? polizasRes.data : (polizasRes.data?.data || []);
      const tareasData = Array.isArray(tareasRes.data) ? tareasRes.data : (tareasRes.data?.data || []);
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
        navigate(
          `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`,
          { replace: true }
        );
      }
    } catch {}
  };
  
  const handleDeleteCliente = async (cliente: Cliente) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al cliente "${cliente.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
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
          setEstadisticasTotales(prev => {
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
    setModalFilters(prev => ({ ...prev, [key]: filterValue }));
  };

  // Abrir modal sincronizando el borrador con los filtros actuales
  const handleOpenFilterModal = () => {
    setModalFilters({ ...filters, page: 1 });
    setShowFilterModal(true);
  };
 
  
  const getActiveFiltersCount = () => {
    const keys = [
      'search','tipo','tipo_documento','estado','departamento','agente','ciudad','genero','edad_min','edad_max','fecha_desde','fecha_hasta','priority'
    ] as const;
    let count = 0;
    keys.forEach((k) => { if ((filters as any)[k]) count++; });
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
      polizas: 'Pólizas',
      valorCartera: 'Valor Cartera',
      agente: 'Agente',
      genero: 'Género',
      edad: 'Edad'
    };
    return columnMap[columnKey] || columnKey;
  };
  const getCellClass = (columnKey: string) => {
    switch (columnKey) {
      case 'nombre':
        return 'whitespace-nowrap max-w-[260px]';
      case 'documento':
        return 'whitespace-nowrap max-w-[200px]';
      case 'contacto':
        return 'whitespace-nowrap max-w-[260px]';
      case 'ubicacion':
        return 'whitespace-nowrap max-w-[220px]';
      default:
        return 'whitespace-nowrap';
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
            <Avatar
              placeholderInitials={getInitials(cliente.nombre)}
              rounded
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">{String(cliente.nombre || '').toUpperCase()}</p>
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
      case 'contacto':
        {
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
      case 'ubicacion':
        {
          const toTitleCase = (input: string) => input
            .split(' ')
            .map((w) => w
              .split('-')
              .map((p) => p ? (p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()) : p)
              .join('-')
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
            <p className="font-medium text-green-600">
              {formatCurrency(cliente.valorCartera)}
            </p>
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
    const n = [u?.first_name || u?.nombre, u?.last_name || u?.apellidos].filter(Boolean).join(' ').trim();
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
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'activo': return 'success';
      case 'inactivo': return 'gray';
      case 'prospecto': return 'warning';
      case 'bloqueado': return 'failure';
      default: return 'gray';
    }
  };

  const getInitials = (nombre: string) => {
    return nombre.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
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

  const isAllSelected = currentClientes.length > 0 && currentClientes.every((c) => selectedIds.has(String(c.id)));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      currentClientes.forEach((c) => { if (c.id) next.add(String(c.id)); });
      setSelectedIds(next);
    }
  };
  const toggleSelectOne = (id?: string) => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const k = String(id);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDeleteClientes = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} cliente(s) seleccionados? Esta acción no se puede deshacer.`)) return;
    try {
      setLoading(true);
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(ids.map((id) => saasApi.deleteCliente(id)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      toast({
        title: "Eliminación masiva de clientes",
        description: `Eliminados: ${ok}. Fallidos: ${fail}.`,
      });
      clearSelection();
      await cargarClientes();
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
        ids.map((id) => clienteService.updateCliente(id, { estado: target as any }))
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      toast({
        title: "Cambio de estado masivo",
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


 

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-[10px]">
          {error}
        </div>
      )}
      
      {/* Estadísticas */}
      {estadisticasTotales && estadisticasTotales.total !== undefined && (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Clientes</p>
              <p className="text-lg md:text-2xl font-bold text-blue-600">{estadisticasTotales.total}</p>
            </div>
            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Activos</p>
              <p className="text-lg md:text-2xl font-bold text-green-600">{estadisticasTotales.activos}</p>
            </div>
            <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Prospectos</p>
              <p className="text-lg md:text-2xl font-bold text-orange-600">{estadisticasTotales.prospectos}</p>
            </div>
            <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 md:w-3 md:h-3 bg-orange-500 rounded-full"></div>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Valor Cartera</p>
              <p className="text-sm md:text-lg font-bold text-purple-600">{formatCurrency(estadisticasTotales.valorTotal)}</p>
            </div>
            <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-bold text-xs md:text-sm">$</span>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4 col-span-2 sm:col-span-3 md:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-gray-600">Pólizas Activas</p>
              <p className="text-lg md:text-2xl font-bold text-red-600">{estadisticasTotales.polizasTotal}</p>
            </div>
            <div className="w-6 h-6 md:w-8 md:h-8 bg-red-100 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
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
                  placeholder="Buscar por nombre, documento o email..."
                  value={filters.search || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('search', e.target.value)}
                  className="pl-10 h-10 text-sm rounded-[10px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="light"
                onClick={() => cargarClientes()}
                disabled={loading}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Actualizar"
              >
                <Icon icon="solar:refresh-bold-duotone" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button
                color="light"
                onClick={handleOpenFilterModal}
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
                onClick={() => setShowExportModal(true)}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Exportar clientes"
              >
                <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
              </Button>

              <Button
                color="light"
                onClick={() => {
                  if (visibleColumns.includes('polizas')) {
                    setVisibleColumns(['nombre', 'tipo', 'documento', 'genero', 'edad', 'contacto', 'ubicacion', 'estado']);
                  } else {
                    setVisibleColumns(['nombre', 'tipo', 'documento', 'genero', 'edad', 'contacto', 'ubicacion', 'estado', 'polizas', 'valorCartera']);
                  }
                }}
                className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                title="Mostrar/Ocultar más columnas"
              >
                <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
              </Button>

              <Link to="/apps/seguros/clientes/nuevo">
                <Button color="primary" className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]">
                  <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Nuevo Cliente</span>
                  <span className="sm:hidden">Nuevo</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de clientes */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner size="lg" />
            <span className="ml-2">Cargando clientes...</span>
          </div>
        ) : currentClientes.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Icon icon="solar:user-hands-bold-duotone" className="w-16 h-16 text-gray-300" />
              <p className="text-gray-500 text-lg font-medium">No tienes clientes registrados aún</p>
              <p className="text-gray-400 text-sm">Comienza creando tu primer cliente</p>
              <Link to="/apps/seguros/clientes/nuevo">
                <Button color="primary" className="mt-2">
                  <Icon icon="solar:user-plus-bold" className="w-4 h-4 mr-2" />
                  Crear primer cliente
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                <div className="text-sm text-blue-900">
                  {selectedIds.size} cliente(s) seleccionados
                </div>
                <div className="flex gap-2">
                  {deleteEnabled && (
                    <Button
                      color="failure"
                      size="sm"
                      onClick={handleBulkDeleteClientes}
                      className="rounded-[10px]"
                    >
                      <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="w-4 h-4 mr-1" />
                      Eliminar seleccionados
                    </Button>
                  )}
                  <Button
                    color="blue"
                    size="sm"
                    onClick={handleOpenBulkClientStateModal}
                    className="rounded-[10px]"
                  >
                    <Icon icon="solar:settings-bold-duotone" className="w-4 h-4 mr-1" />
                    Cambiar estado
                  </Button>
                  <Button
                    color="light"
                    size="sm"
                    onClick={clearSelection}
                    className="rounded-[10px]"
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto table-container-with-dropdowns">
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell className="w-10">
                    <Checkbox
                      checked={currentClientes.length > 0 && currentClientes.every(c => selectedIds.has(String(c.id)))}
                      onChange={() => toggleSelectAll()}
                    />
                  </Table.HeadCell>
                  {visibleColumns.map((columnKey) => {
                    const apiField = columnToApiField[columnKey];
                    const isSortable = !!apiField;
                    const isActive = isSortable && filters.sort_by === apiField;
                    const dir = isActive ? (filters.sort_dir || 'asc') : undefined;
                    return (
                      <Table.HeadCell key={columnKey} className={columnKey === 'nombre' ? 'w-[200px]' : ''}>
                        <div className={isSortable ? 'flex items-center gap-1 cursor-pointer select-none' : ''} onClick={() => isSortable && toggleSort(columnKey)}>
                          <span>{getColumnName(columnKey)}</span>
                          {isSortable && (
                            <Icon
                              icon={isActive ? (dir === 'asc' ? 'solar:arrow-up-bold-duotone' : 'solar:arrow-down-bold-duotone') : 'solar:sort-vertical-bold-duotone'}
                              className="w-4 h-4 text-gray-400"
                            />
                          )}
                        </div>
                      </Table.HeadCell>
                    );
                  })}
                  <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
                <Table.Body>
                  {currentClientes.map((cliente) => (
                    <Table.Row key={cliente.id}>
                      <Table.Cell>
                        <Checkbox
                          checked={selectedIds.has(String(cliente.id))}
                          onChange={() => toggleSelectOne(cliente.id)}
                        />
                      </Table.Cell>
                      {visibleColumns.map((columnKey) => (
                        <Table.Cell key={columnKey} className={`${columnKey === 'nombre' ? 'w-[200px]' : ''} whitespace-nowrap pr-8`}>
                          {renderTableCell(cliente, columnKey)}
                        </Table.Cell>
                      ))}
                      <Table.Cell>
                        <div className="relative inline-block">
                        <Dropdown
                          label=""
                          dismissOnClick={false}
                          placement="left-start"
                          className="z-50"
                          style={{ minWidth: '300px' }}
                          renderTrigger={() => (
                            <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                              <IconDots size={22} />
                            </span>
                          )}
                        >
                          <Dropdown.Item
                            className="flex gap-3 w-full justify-start text-left whitespace-nowrap"
                            onClick={() => handleViewCliente(cliente)}
                          >
                            <Icon icon="solar:eye-bold-duotone" height={18} />
                            <span>Ver Detalles</span>
                          </Dropdown.Item>
                          <Link 
                            to={`/apps/seguros/clientes/editar/${cliente.id}`}
                            onClick={() => {
                              
                              // Guardar en localStorage para debug
                              const debugInfo = {
                                timestamp: new Date().toISOString(),
                                action: 'CLICK_EDITAR',
                                clienteId: cliente.id,
                                clienteCompleto: cliente
                              };
                              localStorage.setItem('debug_last_cliente_edit', JSON.stringify(debugInfo));
                              
                              // También agregar al historial de debug
                              const historial = JSON.parse(localStorage.getItem('debug_historial') || '[]');
                              historial.push(debugInfo);
                              // Mantener solo los últimos 10
                              if (historial.length > 10) historial.shift();
                              localStorage.setItem('debug_historial', JSON.stringify(historial));
                            }}
                          >
                            <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                              <Icon icon="solar:pen-new-square-bold-duotone" height={18} />
                              <span>Editar</span>
                            </Dropdown.Item>
                          </Link>
                          <Dropdown.Item 
                            className="flex gap-3 w-full justify-start text-left"
                            onClick={() => handleCreatePoliza(cliente)}
                          >
                            <Icon icon="solar:document-add-bold-duotone" height={18} />
                            <span>Nueva Póliza</span>
                          </Dropdown.Item>
                          {deleteEnabled && (
                            <Dropdown.Item 
                              className="flex gap-3 w-full justify-start text-left text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteCliente(cliente)}
                            >
                              <Icon icon="solar:trash-bin-minimalistic-bold-duotone" height={18} />
                              <span>Eliminar</span>
                            </Dropdown.Item>
                          )}
                        </Dropdown>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            {/* Paginación (backend) */}
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex || 0} a {endIndex || 0} de {pagination.total || 0} clientes
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
                      setFilters(prev => ({ ...prev, per_page: val, page: 1 }));
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
                  onClick={() => {
                    const newPage = Math.max(1, (pagination.current_page || 1) - 1);
                    setFilters(prev => ({ ...prev, page: newPage }));
                  }}
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
                  onClick={() => {
                    const newPage = Math.min((pagination.last_page || 1), (pagination.current_page || 1) + 1);
                    setFilters(prev => ({ ...prev, page: newPage }));
                  }}
                  className="rounded-[10px]"
                >
                  <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      
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
              <Select value={(modalFilters.tipo || 'todos')} onValueChange={(value) => handleModalFilterChange('tipo', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {TIPOS_CLIENTE.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Select value={(modalFilters.estado || 'todos')} onValueChange={(value) => handleModalFilterChange('estado', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {ESTADOS_CLIENTE.map(estado => (
                    <SelectItem key={estado.value} value={estado.value}>{estado.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tipo_documento">Tipo de documento</Label>
              <Select value={(modalFilters.tipo_documento || 'todos')} onValueChange={(value) => handleModalFilterChange('tipo_documento', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TIPOS_DOCUMENTO.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="departamento">Departamento</Label>
              <Select value={(modalFilters.departamento || 'todos')} onValueChange={(value) => handleModalFilterChange('departamento', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos los departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los departamentos</SelectItem>
                  {departamentosDinamicos.map(depto => (
                    <SelectItem key={depto} value={depto}>{depto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* País eliminado del set de filtros */}
            <div>
              <Label htmlFor="agente">Agente</Label>
              <Select value={(modalFilters.agente || 'todos')} onValueChange={(value) => handleModalFilterChange('agente', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos los agentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los agentes</SelectItem>
                  <SelectItem value="Sin asignar">Sin asignar</SelectItem>
                  {usuarios.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{buildNombreUsuario(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Documento eliminado del set de filtros */}
            {/* Email eliminado del set de filtros */}
            {/* Teléfono eliminado del set de filtros */}
            <div>
              <Label htmlFor="ciudad">Ciudad</Label>
              <Select value={(modalFilters.ciudad || 'todos')} onValueChange={(value) => handleModalFilterChange('ciudad', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas las ciudades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las ciudades</SelectItem>
                  {ciudadesDinamicasModal.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="genero">Género</Label>
              <Select value={(modalFilters.genero || 'todos')} onValueChange={(value) => handleModalFilterChange('genero', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {GENEROS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edad_min">Edad mín.</Label>
                <Input id="edad_min" type="number" className="mt-1" value={modalFilters.edad_min}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleModalFilterChange('edad_min', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edad_max">Edad máx.</Label>
                <Input id="edad_max" type="number" className="mt-1" value={modalFilters.edad_max}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleModalFilterChange('edad_max', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fecha_desde">Fecha desde</Label>
                <Input id="fecha_desde" type="date" className="mt-1" value={modalFilters.fecha_desde}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleModalFilterChange('fecha_desde', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="fecha_hasta">Fecha hasta</Label>
                <Input id="fecha_hasta" type="date" className="mt-1" value={modalFilters.fecha_hasta}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleModalFilterChange('fecha_hasta', e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={(modalFilters.priority || 'todos')} onValueChange={(value) => handleModalFilterChange('priority', value)}>
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
          <Button color="gray" onClick={() => setModalFilters({
            search: '', tipo: '', tipo_documento: '', estado: '', departamento: '', agente: '', sort_by: '', sort_dir: '',
            ciudad: '', genero: '', edad_min: '', edad_max: '', fecha_desde: '', fecha_hasta: '', priority: '', page: 1, per_page: elementsPerPage,
          })} className="rounded-[10px]">
            <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
            Limpiar Filtros
          </Button>
          <Button color="blue" onClick={() => { setFilters({ ...modalFilters, page: 1 }); setShowFilterModal(false); }} className="rounded-[10px]">
            <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mr-2" />
            Aplicar Filtros
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Modal de Detalle */}
      <Modal show={showModal} onClose={handleCloseDetailsModal} size="5xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <Avatar placeholderInitials={selectedCliente ? getInitials(selectedCliente.nombre) : ''} rounded size="md" />
            <div>
              <h3 className="text-lg font-semibold">{selectedCliente?.nombre}</h3>
              <p className="text-sm text-gray-500">{selectedCliente?.tipoDocumento} {selectedCliente?.numeroDocumento}</p>
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
                        <h4 className="font-semibold text-gray-900 mb-3">Datos Generales</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tipo de Cliente:</span>
                            <div className="flex items-center gap-2">
                              <Icon icon={getTipoIcon(selectedCliente.tipoCliente)} className="w-4 h-4 text-gray-600" />
                              <span className="capitalize">{selectedCliente.tipoCliente}</span>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Estado:</span>
                            <Badge color={getEstadoBadge((fullCliente?.estado || selectedCliente.estado).toString().toLowerCase())} className="capitalize">
                              {(fullCliente?.estado || selectedCliente.estado).toString().toLowerCase()}
                            </Badge>
                          </div>
                          {fullCliente?.codigo_cliente ? (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Código Cliente:</span>
                              <span className="font-medium">{fullCliente.codigo_cliente}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between">
                            <span className="text-gray-600">Documento:</span>
                            <span className="font-medium">{selectedCliente.tipoDocumento} {selectedCliente.numeroDocumento}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fecha de Nacimiento:</span>
                            <span className="font-medium">{fullCliente?.persona?.fecha_nacimiento || selectedCliente.fechaNacimiento || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Fecha de Registro:</span>
                            <span className="font-medium">
                              {new Date(selectedCliente.fechaRegistro).toLocaleDateString('es-CO')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Contacto y Ubicación</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium">{fullCliente?.email || selectedCliente.email || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Teléfono:</span>
                            <span className="font-medium">{fullCliente?.telefono || selectedCliente.telefono || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Celular:</span>
                            <span className="font-medium">{fullCliente?.celular || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Dirección:</span>
                            <span className="font-medium">{fullCliente?.direccion || selectedCliente.direccion || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Ciudad:</span>
                            <span className="font-medium">{fullCliente?.ciudad || selectedCliente.ciudad || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Departamento:</span>
                            <span className="font-medium">{fullCliente?.departamento || selectedCliente.departamento || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">País:</span>
                            <span className="font-medium">{fullCliente?.pais || 'Colombia'}</span>
                          </div>
                          {fullCliente?.codigo_postal ? (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Código Postal:</span>
                              <span className="font-medium">{fullCliente.codigo_postal}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        {(fullCliente?.tipo === 'PERSONA' && fullCliente.persona) ? (
                          <>
                            <h4 className="font-semibold text-gray-900 mb-3">Datos de Persona</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Nombres:</span>
                                <div className="font-medium">{fullCliente.persona.nombres}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Apellidos:</span>
                                <div className="font-medium">{fullCliente.persona.apellidos}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Tipo Doc. / Número:</span>
                                <div className="font-medium">{fullCliente.persona.tipo_documento} {fullCliente.persona.documento}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Fecha Nacimiento:</span>
                                <div className="font-medium">{fullCliente.persona.fecha_nacimiento}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Género:</span>
                                <div className="font-medium">{fullCliente.persona.genero}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Estado Civil:</span>
                                <div className="font-medium">{fullCliente.persona.estado_civil}</div>
                              </div>
                              {fullCliente.persona.profesion ? (
                                <div>
                                  <span className="text-gray-600">Profesión:</span>
                                  <div className="font-medium">{fullCliente.persona.profesion}</div>
                                </div>
                              ) : null}
                              {typeof fullCliente.persona.ingresos_mensuales === 'number' ? (
                                <div>
                                  <span className="text-gray-600">Ingresos Mensuales:</span>
                                  <div className="font-medium">
                                    {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(fullCliente.persona.ingresos_mensuales)}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </>
                        ) : null}

                        {(fullCliente?.tipo === 'EMPRESA' && fullCliente.empresa) ? (
                          <>
                            <h4 className="font-semibold text-gray-900 mb-3">Datos de Empresa</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Razón Social:</span>
                                <div className="font-medium">{fullCliente.empresa.razon_social}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">NIT:</span>
                                <div className="font-medium">{fullCliente.empresa.nit}</div>
                              </div>
                              {fullCliente.empresa.nombre_comercial ? (
                                <div>
                                  <span className="text-gray-600">Nombre Comercial:</span>
                                  <div className="font-medium">{fullCliente.empresa.nombre_comercial}</div>
                                </div>
                              ) : null}
                              <div>
                                <span className="text-gray-600">Tipo de Empresa:</span>
                                <div className="font-medium">{fullCliente.empresa.tipo_empresa}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Representante Legal:</span>
                                <div className="font-medium">{fullCliente.empresa.representante_legal}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Doc. Representante:</span>
                                <div className="font-medium">{fullCliente.empresa.documento_representante}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Sector Económico:</span>
                                <div className="font-medium">{fullCliente.empresa.sector_economico}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Actividad Económica:</span>
                                <div className="font-medium">{fullCliente.empresa.actividad_economica}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">N° Empleados:</span>
                                <div className="font-medium">{fullCliente.empresa.numero_empleados}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Fecha Constitución:</span>
                                <div className="font-medium">{fullCliente.empresa.fecha_constitucion}</div>
                              </div>
                            </div>
                          </>
                        ) : null}

                        {(fullCliente?.tipo === 'CONSORCIO' && fullCliente.consorcio) ? (
                          <>
                            <h4 className="font-semibold text-gray-900 mb-3">Datos de Consorcio</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Nombre:</span>
                                <div className="font-medium">{fullCliente.consorcio.nombre_consorcio}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Objeto:</span>
                                <div className="font-medium">{fullCliente.consorcio.objeto_consorcio}</div>
                              </div>
                              <div>
                                <span className="text-gray-600">Duración:</span>
                                <div className="font-medium">{fullCliente.consorcio.duracion_consorcio}</div>
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
                    <div className="py-6 flex items-center gap-2 text-gray-500"><Spinner size="sm"/> Cargando pólizas...</div>
                  ) : polizasCliente.length === 0 ? (
                    <div className="py-6 text-gray-500">Sin pólizas para este cliente.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table hoverable>
                        <Table.Head>
                          <Table.HeadCell>Número</Table.HeadCell>
                          <Table.HeadCell>Aseguradora</Table.HeadCell>
                          <Table.HeadCell>Ramo</Table.HeadCell>
                          <Table.HeadCell>Prima</Table.HeadCell>
                          <Table.HeadCell>Estado</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                          {polizasCliente.map((p:any) => (
                            <Table.Row
                              key={p.id}
                              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                              onClick={() => {
                                handleCloseDetailsModal();
                                navigate(`/apps/seguros/polizas?open_poliza_id=${p.id}`);
                              }}
                            >
                              <Table.Cell>{p.numero_poliza || p.policy_number}</Table.Cell>
                              <Table.Cell>{(p as any).aseguradora_nombre || p.aseguradora || p.insurance_company}</Table.Cell>
                              <Table.Cell>{(p as any).ramo_nombre || p.ramo_principal || p.type}</Table.Cell>
                              <Table.Cell>{new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(p.prima_neta || p.premium_amount || 0)}</Table.Cell>
                              <Table.Cell>{p.estado || p.status}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    </div>
                  )}
                </Tabs.Item>
                <Tabs.Item title="Seguimientos">
                  {loadingTabs ? (
                    <div className="py-6 flex items-center gap-2 text-gray-500"><Spinner size="sm"/> Cargando seguimientos...</div>
                  ) : tareasCliente.length === 0 ? (
                    <div className="py-6 text-gray-500">Sin seguimientos registrados.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table hoverable>
                        <Table.Head>
                          <Table.HeadCell>Título</Table.HeadCell>
                          <Table.HeadCell>Tipo</Table.HeadCell>
                          <Table.HeadCell>Prioridad</Table.HeadCell>
                          <Table.HeadCell>Estado</Table.HeadCell>
                          <Table.HeadCell>Programado</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                          {tareasCliente.map((t:any) => (
                            <Table.Row key={t.id}>
                              <Table.Cell>{t.title}</Table.Cell>
                              <Table.Cell>{t.type}</Table.Cell>
                              <Table.Cell>{t.priority}</Table.Cell>
                              <Table.Cell>{t.status}</Table.Cell>
                              <Table.Cell>{t.scheduled_for ? new Date(t.scheduled_for).toLocaleString('es-CO') : '-'}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
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

      {/* Modal cambio de estado masivo */}
      <Modal show={showBulkStateModal} onClose={() => setShowBulkStateModal(false)} size="md">
        <Modal.Header>
          Cambiar estado a {selectedIds.size} cliente(s)
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-3">
            <Label>Nuevo estado</Label>
            <select
              className="w-full border rounded-md p-2 dark:bg-darkgray"
              value={bulkClientTargetState}
              onChange={(e) => setBulkClientTargetState(e.target.value)}
            >
              {ESTADOS_CLIENTE.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
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
    </div>
  );
};

export default Clientes;
