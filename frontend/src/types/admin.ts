// Tipos para el sistema de administración de usuarios

export interface User {
  id: string; // UUID único del sistema
  firebase_uid?: string;
  nombre_completo: string;
  tipo_documento: 'CC' | 'NIT' | 'CE' | 'PASAPORTE';
  numero_documento: string;
  correo_corporativo: string;
  telefono_movil: string;
  telefono_fijo?: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  rol_id: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO' | 'EN_REVISION';
  foto_perfil?: string;
  fecha_ingreso: string;
  fecha_ultima_conexion?: string;
  tipo_vinculacion: 'PLANTA' | 'INDEPENDIENTE' | 'FREELANCE' | 'EXTERNO';
  aseguradoras_permitidas?: string[];
  sucursal_id?: string;
  supervisor_id?: string;
  compania_id: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: Permission[];
  modulos_acceso: string[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  nombre: string;
  descripcion: string;
  modulo: string;
  acciones: {
    crear: boolean;
    leer: boolean;
    actualizar: boolean;
    eliminar: boolean;
  };
}

export interface Company {
  id: string;
  nombre: string;
  nit: string;
  representante_legal: string;
  correo_general: string;
  ciudad: string;
  direccion: string;
  logo?: string;
  subdominio?: string;
  created_at: string;
  updated_at: string;
}

export interface Sucursal {
  id: string;
  nombre: string;
  ciudad: string;
  telefono: string;
  encargado_id?: string;
  compania_id: string;
  created_at: string;
  updated_at: string;
}

export interface FirmaElectronica {
  id: string;
  usuario_id: string;
  tipo_firma: 'SIMPLE' | 'DIGITAL_CERTIFICADO' | 'MANUSCRITA' | 'BIOMETRICA';
  proveedor?: string; // Certicámara, Valid, Adobe Sign
  documentos_autorizados: string[];
  estado: 'VIGENTE' | 'REVOCADO' | 'EXPIRADO';
  created_at: string;
  updated_at: string;
}

export interface AuditoriaLogin {
  id: string;
  usuario_id: string;
  fecha_hora: string;
  ip_acceso: string;
  navegador: string;
  dispositivo: string;
  resultado: 'EXITO' | 'FALLO' | 'SOSPECHOSO';
  ubicacion?: string;
}

export interface AuditoriaCambios {
  id: string;
  usuario_id: string;
  tipo_cambio: 'PERFIL' | 'CONTRASEÑA' | 'ROL' | 'ESTADO';
  datos_anteriores: any;
  datos_nuevos: any;
  usuario_modificador_id: string;
  fecha_cambio: string;
  ip_modificacion: string;
}

export interface LogAcciones {
  id: string;
  usuario_id: string;
  accion: string;
  modulo: string;
  descripcion: string;
  datos_afectados?: any;
  fecha_accion: string;
  ip_origen: string;
}

// Tipos para formularios
export interface CreateUserForm {
  nombre_completo: string;
  tipo_documento: 'CC' | 'NIT' | 'CE' | 'PASAPORTE';
  numero_documento: string;
  correo_corporativo: string;
  telefono_movil: string;
  telefono_fijo?: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  rol_id: string;
  tipo_vinculacion: 'PLANTA' | 'INDEPENDIENTE' | 'FREELANCE' | 'EXTERNO';
  aseguradoras_permitidas?: string[];
  sucursal_id?: string;
  supervisor_id?: string;
  foto_perfil?: File;
}

export interface CreateRoleForm {
  nombre: string;
  descripcion: string;
  permisos: string[];
  modulos_acceso: string[];
}

export interface CreateCompanyForm {
  nombre: string;
  nit: string;
  representante_legal: string;
  correo_general: string;
  ciudad: string;
  direccion: string;
  logo?: File;
  subdominio?: string;
}

// Tipos para filtros y búsquedas
export interface UserFilters {
  estado?: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO' | 'EN_REVISION';
  rol_id?: string;
  sucursal_id?: string;
  tipo_vinculacion?: 'PLANTA' | 'INDEPENDIENTE' | 'FREELANCE' | 'EXTERNO';
  compania_id?: string;
  search?: string;
}

// Tipos para respuestas de API
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number;
  to: number;
}

// Constantes para el sistema
export const ROLES_SISTEMA = [
  'ADMINISTRADOR_GENERAL',
  'GERENTE_COMERCIAL',
  'SUPERVISOR',
  'AGENTE_ASESOR',
  'ASISTENTE_OPERATIVO',
  'AUDITOR',
  'CLIENTE_EXTERNO',
] as const;

export const MODULOS_SISTEMA = [
  'CLIENTES',
  'SINIESTROS',
  'RENOVACIONES',
  'CRM',
  'COMISIONES',
  'CONFIGURACION',
  'BI',
  'AUDITORIA',
] as const;

export const PERMISOS_BASE = [
  'VER_POLIZAS',
  'EDITAR_POLIZAS',
  'CREAR_SINIESTROS',
  'APROBAR_SINIESTROS',
  'VER_REPORTES',
  'ACCESO_REPORTES_FINANCIEROS',
  'CONFIGURACION_SISTEMA',
  'VER_COMISIONES',
  'GESTION_USUARIOS',
] as const;

// Tipo para estadísticas del dashboard administrativo
export interface AdminStats {
  total_usuarios: number;
  usuarios_activos: number;
  usuarios_inactivos: number;
  usuarios_suspendidos: number;
  total_roles: number;
  total_companias: number;
  total_sucursales: number;
  logins_ultimo_mes: number;
  usuarios_por_vinculacion: {
    [key: string]: number;
  };
  usuarios_por_rol: {
    [key: string]: number;
  };
}

// Tipos de Afiliación
export interface TipoAfiliacion {
  id: string;
  nombre: string;
  broker_id: string;
  created_at: string;
  updated_at: string;
}

export interface TipoAfiliacionCreate {
  nombre: string;
}

// Coberturas
export interface Cobertura {
  id: string;
  nombre: string;
  broker_id: string;
  created_at: string;
  updated_at: string;
}

export interface CoberturaCreate {
  nombre: string;
}

// Estados de Siniestros
export interface EstadoSiniestro {
  id: string;
  nombre: string;
  color: string;
  broker_id: string;
  created_at: string;
  updated_at: string;
}

export interface EstadoSiniestroCreate {
  nombre: string;
  color: string;
}

// Motivos Estados Póliza
export interface MotivoEstadoPoliza {
  id: string;
  nombre: string;
  cancelacion: boolean;
  no_renovacion: boolean;
  creacion_anexo: boolean;
  broker_id: string;
  created_at: string;
  updated_at: string;
}

export interface MotivoEstadoPolizaCreate {
  nombre: string;
  cancelacion: boolean;
  no_renovacion: boolean;
  creacion_anexo: boolean;
}

// Sedes
export interface Sede {
  id: string;
  nombre: string;
  email: string;
  direccion: string;
  telefono: string;
  broker_id: string;
  created_at: string;
  updated_at: string;
}

export interface SedeCreate {
  nombre: string;
  email: string;
  direccion: string;
  telefono: string;
}

// Aseguradoras
export interface Aseguradora {
  id: string;
  nombre: string;
  cuit: string; // NIT
  email: string;
  direccion: string;
  telefono: string;
  cuenta_bancaria: string;
  link_pago: string;
  codigo_intermediario: string;
  retencion: number;
  iva: number;
  retencion_iva: number;
  broker_id: string;
  created_at: string;
  updated_at: string;
}

export interface AseguradoraCreate {
  nombre: string;
  cuit: string; // NIT
  email: string;
  direccion: string;
  telefono: string;
  cuenta_bancaria: string;
  link_pago: string;
  codigo_intermediario: string;
  retencion: number;
  iva: number;
  retencion_iva: number;
}

// Vendedores
export interface Vendedor {
  id: string;
  nombres: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  celular: string;
  email: string;
  cuenta_bancaria: string;
  tipo_persona: 'natural' | 'juridica';
  tipo_retencion?: 'natural_ss' | 'natural_sin_ss_rf10' | 'juridica_simplificado' | 'juridica_no_simplificado_rf11';
  es_agencia: boolean;
  porcentaje_comision: number;
  calcular_comision_sobre: 'agencia' | 'prima_neta';
  porcentaje_retencion: number;
  porcentaje_retencion_ica: number;
  porcentaje_iva: number;
  porcentaje_retencion_iva: number;
  comisiones_diferentes_por_ano: boolean;
  fecha_vinculacion?: string;
  broker_id: string;
  created_at: string;
  updated_at: string;
}

export interface VendedorCreate {
  nombres: string;
  tipo_documento?: string | null;
  numero_documento: string;
  telefono?: string | null;
  celular?: string | null;
  email?: string | null;
  cuenta_bancaria?: string | null;
  tipo_persona: 'natural' | 'juridica';
  tipo_retencion?: string | null;
  es_agencia: boolean;
  porcentaje_comision: number;
  calcular_comision_sobre: 'agencia' | 'prima_neta';
  porcentaje_retencion: number;
  porcentaje_retencion_ica: number;
  porcentaje_iva: number;
  porcentaje_retencion_iva: number;
  comisiones_diferentes_por_ano: boolean;
  fecha_vinculacion?: string | null;
}

// Ramos
export interface ComisionAseguradora {
  aseguradora_id: string;
  aseguradora_nombre: string;
  porcentaje_iva: number;
  porcentaje_comision: number;
  pri_a_pre_por_defecto: number;
}

export interface Ramo {
  id: string;
  nombre: string;
  subramo: string[];
  calcular_iva_pri_a_pre: boolean;
  vista_mapa_oportunidad: boolean;
  comisiones_aseguradoras: ComisionAseguradora[];
  broker_id: string;
  created_at: string;
  updated_at: string;
}

export interface RamoCreate {
  nombre: string;
  subramo: string[];
  calcular_iva_pri_a_pre: boolean;
  vista_mapa_oportunidad: boolean;
  comisiones_aseguradoras: Omit<ComisionAseguradora, 'aseguradora_nombre'>[];
}

// Mensajero types
export interface Mensajero {
  id: number;
  nombre: string;
  telefono?: string;
  celular?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  vehiculo?: string;
  activo: boolean;
  tarifa_base?: number;
  observaciones?: string;
  broker_id: number;
  created_at: string;
  updated_at: string;
  vehiculo_nombre?: string;
  estado_text?: string;
  telefono_principal?: string;
}

export interface MensajeroCreate {
  nombre: string;
  telefono?: string;
  celular?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  vehiculo?: string;
  activo: boolean;
  tarifa_base?: number;
  observaciones?: string;
}

// RolBroker types
export interface RolBroker {
  id: number;
  nombre: string;
  slug: string;
  descripcion?: string;
  permisos: string[];
  color: string;
  activo: boolean;
  nivel_acceso: number;
  es_admin: boolean;
  broker_id: number;
  created_at: string;
  updated_at: string;
  nivel_acceso_nombre?: string;
  estado_text?: string;
  cantidad_empleados?: number;
  empleados_count?: number;
}

export interface RolBrokerCreate {
  nombre: string;
  slug?: string;
  descripcion?: string;
  permisos?: string[];
  color?: string;
  activo: boolean;
  nivel_acceso: number;
  es_admin: boolean;
}

// EmpleadoBroker types
export interface EmpleadoBroker {
  id: number;
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  email: string;
  telefono?: string;
  celular?: string;
  fecha_nacimiento?: string;
  direccion?: string;
  ciudad?: string;
  cargo?: string;
  departamento?: string;
  fecha_ingreso?: string;
  fecha_salida?: string;
  estado: string;
  tipo_vinculacion: string;
  salario?: number;
  usuario: string;
  password_changed_at?: string;
  requiere_cambio_password: boolean;
  ultimo_acceso?: string;
  acceso_activo: boolean;
  rol_id?: number;
  broker_id: number;
  avatar?: string;
  permisos_adicionales?: string[];
  observaciones?: string;
  creado_por?: number;
  actualizado_por?: number;
  created_at: string;
  updated_at: string;
  // Accessors
  nombre_completo?: string;
  tipo_documento_nombre?: string;
  estado_nombre?: string;
  tipo_vinculacion_nombre?: string;
  telefono_principal?: string;
  antiguedad?: number;
  edad?: number;
  // Relationships
  rol?: RolBroker;
}

export interface EmpleadoBrokerCreate {
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  email: string;
  usuario: string;
  telefono?: string;
  celular?: string;
  fecha_nacimiento?: string;
  direccion?: string;
  ciudad?: string;
  cargo?: string;
  departamento?: string;
  fecha_ingreso?: string;
  estado: string;
  tipo_vinculacion: string;
  salario?: number;
  acceso_activo: boolean;
  rol_id?: number;
  observaciones?: string;
  // Credenciales (opcionales)
  password?: string;
  password_confirmation?: string;
  requiere_cambio_password?: boolean;
}
