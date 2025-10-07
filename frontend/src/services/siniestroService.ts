import api from '../config/api';

// Interfaces TypeScript
export interface Siniestro {
  id: number;
  broker_id: number;
  poliza_id: number;
  cliente_id: number;
  assigned_adjuster_id?: number;
  created_by: number;
  updated_by?: number;
  numero_siniestro: string;
  numero_poliza: string;
  numero_referencia_aseguradora?: string;
  tipo_seguro: string;
  tipo_siniestro: string;
  fecha_ocurrencia: string;
  fecha_reporte: string;
  fecha_asignacion?: string;
  fecha_inspeccion?: string;
  fecha_aprobacion?: string;
  fecha_rechazo?: string;
  fecha_pago?: string;
  fecha_cierre?: string;
  estado: string;
  fecha_ultimo_estado: string;
  prioridad: string;
  monto_reclamado: number;
  monto_aprobado?: number;
  monto_pagado?: number;
  monto_reserva?: number;
  monto_deducible?: number;
  monto_coaseguro?: number;
  descripcion_evento: string;
  causa_siniestro?: string;
  lugar_ocurrencia: string;
  ciudad_ocurrencia: string;
  departamento_ocurrencia: string;
  pais_ocurrencia: string;
  involucra_terceros: boolean;
  datos_terceros?: string;
  hay_heridos: boolean;
  informacion_heridos?: string;
  hay_danos_materiales: boolean;
  danos_materiales?: string;
  aseguradora: string;
  numero_poliza_aseguradora?: string;
  contacto_aseguradora?: string;
  email_aseguradora?: string;
  telefono_aseguradora?: string;
  nombre_ajustador?: string;
  empresa_ajustadora?: string;
  contacto_ajustador?: string;
  email_ajustador?: string;
  telefono_ajustador?: string;
  testigos?: Testigo[];
  documentos_recibidos?: Documento[];
  documentos_pendientes?: string[];
  total_documentos: number;
  historial_estados?: HistorialEstado[];
  comunicaciones?: Comunicacion[];
  observaciones?: Observacion[];
  evaluacion_inicial?: string;
  informe_investigacion?: string;
  informe_peritaje?: string;
  dictamen_final?: string;
  motivo_rechazo?: string;
  tipo_rechazo?: string;
  metodo_pago?: string;
  numero_cheque?: string;
  numero_transferencia?: string;
  cuenta_destino?: string;
  beneficiario_pago?: string;
  dias_tramite: number;
  dias_investigacion: number;
  dias_aprobacion: number;
  dias_pago: number;
  porcentaje_aprobacion?: number;
  calificacion_servicio?: number;
  comentarios_cliente?: string;
  cliente_satisfecho?: boolean;
  tiene_recuperacion: boolean;
  monto_recuperado?: number;
  detalles_recuperacion?: string;
  reabierto: boolean;
  motivo_reapertura?: string;
  fecha_reapertura?: string;
  datos_vehiculo?: DatosVehiculo;
  datos_inmueble?: DatosInmueble;
  datos_medicos?: DatosMedicos;
  datos_empresa?: DatosEmpresa;
  custom_fields?: Record<string, any>;
  archivos_adjuntos?: ArchivoAdjunto[];
  auditado: boolean;
  observaciones_auditoria?: string;
  fecha_auditoria?: string;
  auditado_por?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Relaciones
  cliente?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    mobile_phone: string;
    document_number: string;
    document_type: string;
    address: string;
    city: string;
    country: string;
    company: string;
    occupation: string;
    birth_date: string;
    gender: string;
    marital_status: string;
    monthly_income: number;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relationship: string;
    status: string;
    priority: string;
    source: string;
    notes: string;
    tags: string[];
    work_address: string;
    postal_code: string;
    state: string;
    broker_id: number;
    assigned_user_id: number;
    created_by: number;
    updated_by: number;
    created_at: string;
    updated_at: string;
    deleted_at: string;
    last_contact_at: string;
    next_follow_up_at: string;
    total_policies_count: number;
    total_policies_value: string;
    custom_fields: any;
  };
  poliza?: {
    id: number;
    numero_poliza: string;
    tipo_seguro: string;
    aseguradora: string;
  };
  assigned_adjuster?: {
    id: number;
    name: string;
    email: string;
  };
  created_by_user?: {
    id: number;
    name: string;
    email: string;
  };
  
  // Accessors calculados
  full_description?: string;
  estado_name?: string;
  prioridad_name?: string;
  tipo_seguro_name?: string;
  tipo_siniestro_name?: string;
  dias_tramite_calculated?: number;
  is_overdue?: boolean;
  is_critical?: boolean;
  progress_percentage?: number;
  has_documents_pending?: boolean;
  can_approve?: boolean;
  can_reject?: boolean;
  can_pay?: boolean;
  can_reopen?: boolean;
}

export interface Testigo {
  nombre: string;
  telefono: string;
  cedula: string;
  observaciones?: string;
}

export interface Documento {
  tipo: string;
  nombre: string;
  ruta: string;
  fecha_subida: string;
  subido_por: number;
}

export interface HistorialEstado {
  estado_anterior: string;
  nuevo_estado: string;
  fecha: string;
  observacion?: string;
  usuario_id: number;
}

export interface Comunicacion {
  tipo: string;
  contenido: string;
  fecha: string;
  usuario_id: number;
}

export interface Observacion {
  contenido: string;
  fecha: string;
  usuario_id: number;
}

export interface DatosVehiculo {
  marca: string;
  modelo: string;
  año: number;
  placa: string;
  color: string;
  cilindraje: string;
  vin?: string;
  numero_motor?: string;
  numero_chasis?: string;
}

export interface DatosInmueble {
  tipo: string;
  area: string;
  pisos: number;
  estrato: number;
  direccion: string;
  avaluo?: number;
}

export interface DatosMedicos {
  diagnostico: string;
  procedimiento?: string;
  medico_tratante: string;
  dias_hospitalizacion?: number;
  causa_muerte?: string;
  hospital?: string;
}

export interface DatosEmpresa {
  razon_social: string;
  nit: string;
  actividad: string;
  num_empleados?: number;
  area_afectada?: string;
}

export interface ArchivoAdjunto {
  nombre: string;
  ruta: string;
  tipo: string;
  tamaño: number;
  fecha_subida: string;
}

export interface SiniestroFilters {
  search?: string;
  estado?: string;
  tipo_seguro?: string;
  tipo_siniestro?: string;
  prioridad?: string;
  aseguradora?: string;
  assigned_adjuster_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  monto_min?: number;
  monto_max?: number;
  active_only?: boolean;
  needing_attention?: boolean;
  overdue?: boolean;
  high_value?: boolean;
  with_terceros?: boolean;
  with_heridos?: boolean;
  critical_only?: boolean;
  recently_reported?: boolean;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface SiniestroStatistics {
  total_siniestros: number;
  reportados: number;
  en_revision: number;
  investigacion: number;
  aprobados: number;
  pagados: number;
  rechazados: number;
  monto_total_reclamado: number;
  monto_total_aprobado: number;
  monto_total_pagado: number;
  promedio_dias_tramite: number;
  siniestros_criticos: number;
  siniestros_vencidos: number;
  con_terceros: number;
  con_heridos: number;
  necesitan_atencion: number;
}

export interface CreateSiniestroData {
  poliza_id: number;
  cliente_id: number;
  tipo_seguro: string;
  tipo_siniestro: string;
  fecha_ocurrencia: string;
  fecha_aviso: string;
  fecha_notificacion_aseguradora: string;
  monto_reclamo: number;
  descripcion_hechos: string;
  lugar_ocurrencia: string;
  ciudad_ocurrencia: string;
  departamento_ocurrencia: string;
  aseguradora: string;
  prioridad?: string;
  assigned_adjuster_id?: number;
  involucra_terceros?: boolean;
  hay_heridos?: boolean;
  hay_danos_materiales?: boolean;
  datos_terceros?: string;
  informacion_heridos?: string;
  danos_materiales?: string;
  causa_siniestro?: string;
  testigos?: Testigo[];
  datos_vehiculo?: DatosVehiculo;
  datos_inmueble?: DatosInmueble;
  datos_medicos?: DatosMedicos;
  datos_empresa?: DatosEmpresa;
  numero_siniestro?: string;
}

export interface UpdateSiniestroData {
  broker_id?: number;
  poliza_id?: number;
  cliente_id?: number;
  tipo_seguro?: string;
  tipo_siniestro?: string;
  fecha_ocurrencia?: string;
  monto_reclamado?: number;
  descripcion_evento?: string;
  lugar_ocurrencia?: string;
  ciudad_ocurrencia?: string;
  departamento_ocurrencia?: string;
  aseguradora?: string;
  prioridad?: string;
  assigned_adjuster_id?: number;
  involucra_terceros?: boolean;
  hay_heridos?: boolean;
  hay_danos_materiales?: boolean;
  datos_terceros?: string;
  informacion_heridos?: string;
  danos_materiales?: string;
  causa_siniestro?: string;
  testigos?: Testigo[];
  datos_vehiculo?: DatosVehiculo;
  datos_inmueble?: DatosInmueble;
  datos_medicos?: DatosMedicos;
  datos_empresa?: DatosEmpresa;
}

export interface Adjuster {
  id: number;
  name: string;
  email: string;
}

export interface SiniestroConstants {
  tipos_seguro: Record<string, string>;
  tipos_siniestro: Record<string, string>;
  estados: Record<string, string>;
  prioridades: Record<string, string>;
  tipos_rechazo: Record<string, string>;
}

// Constantes para tipos de datos
export const TIPOS_SEGURO = {
  'auto': 'Automóvil',
  'hogar': 'Hogar',
  'vida': 'Vida',
  'salud': 'Salud',
  'empresarial': 'Empresarial',
  'responsabilidad_civil': 'Responsabilidad Civil',
  'transporte': 'Transporte',
  'construccion': 'Construcción',
  'agropecuario': 'Agropecuario',
  'fianza': 'Fianza',
};

export const TIPOS_SINIESTRO = {
  'colision': 'Colisión',
  'robo_total': 'Robo Total',
  'robo_parcial': 'Robo Parcial',
  'incendio': 'Incendio',
  'vandalismo': 'Vandalismo',
  'fenomenos_naturales': 'Fenómenos Naturales',
  'accidente_laboral': 'Accidente Laboral',
  'responsabilidad_civil': 'Responsabilidad Civil',
  'daños_terceros': 'Daños a Terceros',
  'muerte': 'Muerte',
  'incapacidad': 'Incapacidad',
  'enfermedad': 'Enfermedad',
  'hospitalizacion': 'Hospitalización',
  'cirugia': 'Cirugía',
  'daños_agua': 'Daños por Agua',
  'explosion': 'Explosión',
  'terremoto': 'Terremoto',
  'inundacion': 'Inundación',
  'granizo': 'Granizo',
  'vientos_fuertes': 'Vientos Fuertes',
  'otro': 'Otro',
};

export const ESTADOS = {
  'reportado': 'Reportado',
  'asignado': 'Asignado',
  'en_revision': 'En Revisión',
  'investigacion': 'Investigación',
  'peritaje': 'Peritaje',
  'documentos_pendientes': 'Documentos Pendientes',
  'aprobado': 'Aprobado',
  'aprobado_parcial': 'Aprobado Parcial',
  'rechazado': 'Rechazado',
  'pagado': 'Pagado',
  'cerrado': 'Cerrado',
};

export const PRIORIDADES = {
  'baja': 'Baja',
  'media': 'Media',
  'alta': 'Alta',
  'critica': 'Crítica',
};

export const TIPOS_RECHAZO = {
  'documentos_insuficientes': 'Documentos Insuficientes',
  'fuera_cobertura': 'Fuera de Cobertura',
  'fraude': 'Fraude',
  'exclusion_poliza': 'Exclusión de Póliza',
  'prescripcion': 'Prescripción',
  'causa_no_cubierta': 'Causa No Cubierta',
  'falta_pago_prima': 'Falta de Pago de Prima',
  'otro': 'Otro',
};

// Utilidades de formateo
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getEstadoColor = (estado: string): string => {
  const colors: Record<string, string> = {
    'reportado': 'blue',
    'asignado': 'indigo',
    'en_revision': 'yellow',
    'investigacion': 'orange',
    'peritaje': 'purple',
    'documentos_pendientes': 'amber',
    'aprobado': 'green',
    'aprobado_parcial': 'lime',
    'rechazado': 'red',
    'pagado': 'emerald',
    'cerrado': 'gray',
  };
  return colors[estado] || 'gray';
};

export const getPrioridadColor = (prioridad: string): string => {
  const colors: Record<string, string> = {
    'baja': 'gray',
    'media': 'yellow',
    'alta': 'orange',
    'critica': 'red',
  };
  return colors[prioridad] || 'gray';
};

export const getTipoSeguroIcon = (tipoSeguro: string): string => {
  const icons: Record<string, string> = {
    'auto': 'solar:car-bold-duotone',
    'hogar': 'solar:home-angle-bold-duotone',
    'vida': 'solar:user-heart-bold-duotone',
    'salud': 'solar:health-bold-duotone',
    'empresarial': 'solar:buildings-3-bold-duotone',
    'responsabilidad_civil': 'solar:shield-user-bold-duotone',
    'transporte': 'solar:delivery-bold-duotone',
    'construccion': 'solar:hammer-bold-duotone',
    'agropecuario': 'solar:leaf-bold-duotone',
    'fianza': 'solar:document-medicine-bold-duotone',
  };
  return icons[tipoSeguro] || 'solar:shield-check-bold-duotone';
};

export const calculateProgressPercentage = (estado: string): number => {
  const estados = ['reportado', 'asignado', 'en_revision', 'investigacion', 'peritaje', 'aprobado', 'pagado'];
  const estadoIndex = estados.indexOf(estado);
  
  if (estado === 'rechazado' || estado === 'cerrado') {
    return 100;
  }
  
  return estadoIndex !== -1 ? ((estadoIndex + 1) / estados.length) * 100 : 0;
};

export const getDaysInWords = (days: number): string => {
  if (days === 0) return 'Hoy';
  if (days === 1) return '1 día';
  if (days < 30) return `${days} días`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? '1 mes' : `${months} meses`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? '1 año' : `${years} años`;
};

// Usar la configuración de API centralizada

// Servicio principal de siniestros
export const siniestroService = {
  // CRUD básico
  async getSiniestros(filters: SiniestroFilters = {}): Promise<{ data: Siniestro[]; total: number; current_page: number; last_page: number }> {
    try {
      const response = await api.get('/saas/siniestros', { params: filters });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getSiniestro(id: number): Promise<Siniestro> {
    try {
      const response = await api.get(`/saas/siniestros/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async createSiniestro(data: CreateSiniestroData): Promise<Siniestro> {
    try {
      const response = await api.post('/saas/siniestros', data);
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async updateSiniestro(id: number, data: UpdateSiniestroData): Promise<Siniestro> {
    try {
      const response = await api.put(`/saas/siniestros/${id}`, data);
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async deleteSiniestro(id: number): Promise<void> {
    try {
      await api.delete(`/saas/siniestros/${id}`);
    } catch (error) {
      throw error;
    }
  },

  // Estadísticas
  async getStatistics(): Promise<SiniestroStatistics> {
    try {
      const response = await api.get('/saas/siniestros/statistics');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getNeedingAttention(): Promise<Siniestro[]> {
    try {
      const response = await api.get('/saas/siniestros/needing-attention');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Gestión de estados
  async changeState(id: number, estado: string, observacion?: string): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/change-state`, {
        estado,
        observacion,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async assignAdjuster(id: number, adjusterId: number, observacion?: string): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/assign-adjuster`, {
        adjuster_id: adjusterId,
        observacion,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async approve(id: number, montoAprobado: number, observacion?: string): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/approve`, {
        monto_aprobado: montoAprobado,
        observacion,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async reject(id: number, motivo: string, tipoRechazo?: string): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/reject`, {
        motivo,
        tipo_rechazo: tipoRechazo,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async pay(id: number, montoPagado: number, metodoPago: string, datosPago: any = {}): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/pay`, {
        monto_pagado: montoPagado,
        metodo_pago: metodoPago,
        ...datosPago,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async reopen(id: number, motivo: string): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/reopen`, {
        motivo,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async close(id: number, observacion?: string): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/close`, {
        observacion,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  // Comunicaciones y observaciones
  async addCommunication(id: number, tipo: string, contenido: string): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/add-communication`, {
        tipo,
        contenido,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  async addObservation(id: number, observacion: string): Promise<Siniestro> {
    try {
      const response = await api.post(`/saas/siniestros/${id}/add-observation`, {
        observacion,
      });
      return response.data.siniestro;
    } catch (error) {
      throw error;
    }
  },

  // Datos auxiliares
  async getAvailableAdjusters(): Promise<Adjuster[]> {
    try {
      const response = await api.get('/saas/siniestros/adjusters');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getConstants(): Promise<SiniestroConstants> {
    try {
      const response = await api.get('/saas/siniestros/constants');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async exportarSiniestros(filters: SiniestroFilters = {}, formato: 'excel' | 'csv' = 'excel'): Promise<void> {
    try {
      // Normalizamos params para Axios, preservando 1/0 para booleanos como en el backend
      const paramsObj: Record<string, string | number> = { formato };
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value === 'boolean') {
            paramsObj[key] = value ? '1' : '0';
          } else {
            paramsObj[key] = value as any;
          }
        }
      });

      // Usamos el cliente api (incluye headers de auth) y pedimos blob
      const response = await api.get('/saas/siniestros/exportar', {
        params: paramsObj,
        responseType: 'blob',
      });

      // Intentamos extraer nombre de archivo del header
      const disposition = (response.headers as any)['content-disposition'] as string | undefined;
      let filename = `siniestros_${new Date().toISOString().slice(0, 10)}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
      if (disposition) {
        const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }

      const blob = new Blob([response.data], { type: (response.headers as any)['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw error;
    }
  },
};

export default siniestroService; 