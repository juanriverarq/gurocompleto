// Tipos base para el sistema SaaS multi-tenant

export interface BrokerTenant {
  id: string;
  nombre: string;
  nit?: string;
  email: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais?: string;
  dominio?: string; // broker.guro.app
  estado?: 'ACTIVO' | 'SUSPENDIDO' | 'INACTIVO';
  status?: 'active' | 'trial' | 'suspended' | 'inactive';
  trial_ends_at?: string; // ISO string date
  logo?: string;
  logo_url?: string;
  branding: {
    logo?: string;
    favicon?: string;
    // Soportar ambas estructuras de colores (backend puede devolver cualquiera)
    colores?: {
      primario: string;
      secundario: string;
      acento: string;
    };
    // Estructura alternativa del backend
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    nombre_comercial?: string;
    slogan?: string;
  };
  features?: string[]; // Active module keys (e.g. 'clientes', 'polizas', 'crm', etc.)
  max_users?: number;
  max_clients?: number;
  max_policies?: number;
  plan: 'starter' | 'professional' | 'business' | 'custom';
  configuraciones?: {
    modulos_activos: string[];
    limites: {
      usuarios: number;
      clientes: number;
      polizas_mes: number;
      almacenamiento_gb: number;
    };
    integraciones: {
      email: boolean;
      sms: boolean;
      apis_aseguradoras: string[];
    };
  };
  facturacion?: {
    plan_actual: string;
    fecha_vencimiento: string;
    metodo_pago?: string;
    estado_pago: 'AL_DIA' | 'VENCIDO' | 'SUSPENDIDO';
  };
  created_at?: string;
  updated_at?: string;
}

export interface UsuarioSaaS {
  id: string;
  broker_id: string; // tenant_id
  email: string;
  nombre: string;
  apellidos: string;
  telefono?: string;
  avatar?: string;
  rol: string; // 'super_admin' | 'admin' | 'supervisor' | 'asesor' | 'vendedor' | custom
  estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';

  // Permisos granulares
  permisos: {
    dashboard: {
      ver_metricas_generales: boolean;
      ver_metricas_equipo: boolean;
      ver_metricas_propias: boolean;
    };
    clientes: {
      ver_todos: boolean;
      ver_propios: boolean;
      ver_equipo: boolean;
      crear: boolean;
      editar: boolean;
      eliminar: boolean;
      exportar: boolean;
      importar: boolean;
    };
    polizas: {
      ver_todas: boolean;
      ver_propias: boolean;
      ver_equipo: boolean;
      crear: boolean;
      editar: boolean;
      eliminar: boolean;
      renovar: boolean;
      cancelar: boolean;
    };
    siniestros: {
      ver_todos: boolean;
      ver_propios: boolean;
      crear: boolean;
      gestionar: boolean;
    };
    comisiones: {
      ver_propias: boolean;
      ver_equipo: boolean;
      ver_todas: boolean;
      gestionar: boolean;
    };
    reportes: {
      generar: boolean;
      ver_financieros: boolean;
      exportar: boolean;
    };
    usuarios: {
      ver: boolean;
      crear: boolean;
      editar: boolean;
      eliminar: boolean;
      gestionar_roles: boolean;
    };
    configuracion: {
      empresa: boolean;
      sistema: boolean;
      integraciones: boolean;
      facturacion: boolean;
    };
  };

  // Asignaciones y territorios
  asignaciones?: {
    clientes_asignados: string[];
    territorios: string[];
    supervisor_id?: string;
    equipo_ids: string[];
  };

  // Configuraciones personales
  configuraciones: {
    notificaciones: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    dashboard_layout: any;
    tema: 'light' | 'dark' | 'auto';
  };

  ultimo_acceso?: string;
  created_at: string;
  updated_at: string;
}

export interface ClienteSaaS {
  id: string;
  broker_id: string; // tenant_id
  codigo_cliente: string; // Generado automáticamente
  tipo: 'PERSONA' | 'EMPRESA' | 'CONSORCIO';
  estado: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO';

  // Datos comunes
  email: string;
  telefono: string;
  celular?: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  pais: string;
  codigo_postal?: string;

  // Asignación y gestión
  asesor_asignado_id?: string;
  supervisor_id?: string;
  fecha_asignacion?: string;
  origen: 'REFERIDO' | 'WEB' | 'TELEFONO' | 'PRESENCIAL' | 'REDES_SOCIALES' | 'OTRO';

  // Datos específicos por tipo
  persona?: {
    nombres: string;
    apellidos: string;
    documento: string;
    tipo_documento: 'CC' | 'CE' | 'TI' | 'PP' | 'RC';
    fecha_nacimiento: string;
    lugar_nacimiento: string;
    genero: 'M' | 'F' | 'OTRO';
    estado_civil: 'SOLTERO' | 'CASADO' | 'UNION_LIBRE' | 'DIVORCIADO' | 'VIUDO';
    profesion?: string;
    ingresos_mensuales?: number;
  };

  empresa?: {
    razon_social: string;
    nombre_comercial?: string;
    nit: string;
    tipo_empresa: 'SAS' | 'LTDA' | 'SA' | 'COOPERATIVA' | 'FUNDACION' | 'OTRO';
    representante_legal: string;
    documento_representante: string;
    sector_economico: string;
    actividad_economica: string;
    numero_empleados: number;
    ingresos_anuales?: number;
    fecha_constitucion: string;
  };

  consorcio?: {
    nombre_consorcio: string;
    objeto_consorcio: string;
    empresas_miembro: {
      nombre: string;
      nit: string;
      participacion: number;
      representante: string;
    }[];
    representante_legal: string;
    documento_representante: string;
    duracion_consorcio: string;
  };

  // Información adicional
  observaciones?: string;
  tags: string[];
  documentos_adjuntos: {
    tipo: string;
    nombre: string;
    url: string;
    fecha_subida: string;
  }[];

  // Métricas
  total_polizas: number;
  prima_total_anual: number;
  ultima_poliza?: string;
  fecha_ultima_actividad: string;

  created_at: string;
  updated_at: string;
}

export interface RolPersonalizado {
  id: string;
  broker_id: string;
  nombre: string;
  descripcion: string;
  permisos: UsuarioSaaS['permisos'];
  es_predeterminado: boolean;
  created_at: string;
  updated_at: string;
}

// Contexto de la aplicación
export interface SaasContext {
  tenant: BrokerTenant | null;
  usuario: UsuarioSaaS | null;
  permisos: UsuarioSaaS['permisos'] | null;
  isLoading: boolean;
  error: string | null;
}

// Filtros y búsquedas
export interface ClienteFilters {
  search?: string;
  tipo?: 'PERSONA' | 'EMPRESA' | 'CONSORCIO' | '';
  estado?: 'ACTIVO' | 'INACTIVO' | 'PROSPECTO' | '';
  asesor_id?: string;
  ciudad?: string;
  origen?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  tags?: string[];
  page?: number;
  per_page?: number;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  // Papelera: 'only' devuelve únicamente clientes soft-deleted
  trashed?: 'only' | 'none';
  // Otros campos sueltos que el builder de Clientes.tsx pasa al API
  [key: string]: any;
}

export interface UsuarioFilters {
  search?: string;
  rol?: string;
  estado?: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO' | '';
  supervisor_id?: string;
  ultimo_acceso_desde?: string;
  page?: number;
  per_page?: number;
}

// Respuestas de API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
} 