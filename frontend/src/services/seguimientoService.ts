import { auth } from '../config/firebase';
import { API_BASE_URL } from '../config/apiUrl';

export interface SeguimientoItem {
  id: number;
  broker_id: number;
  client_id?: number;
  poliza_id?: number;
  assigned_to?: number;
  created_by: number;
  title: string;
  description?: string;
  type:
    | 'seguimiento_cliente'
    | 'documentacion'
    | 'inspeccion'
    | 'renovacion'
    | 'siniestro'
    | 'cotizacion'
    | 'llamada'
    | 'reunion'
    | 'email'
    | 'visita';
  status: 'pendiente' | 'en_progreso' | 'completada' | 'vencida' | 'cancelada' | 'pausada';
  priority: 'baja' | 'media' | 'alta' | 'critica';
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  scheduled_for?: string;
  progress_percentage: number;
  notes?: string;
  activity_log?: ActivityLog[];
  contact_method?: 'phone' | 'email' | 'whatsapp' | 'in_person' | 'video_call';
  contact_phone?: string;
  contact_email?: string;
  contact_notes?: string;
  result?:
    | 'exitoso'
    | 'sin_respuesta'
    | 'rechazado'
    | 'interesado'
    | 'reagendar'
    | 'completado'
    | 'cancelado';
  next_follow_up?: string;
  follow_up_notes?: string;
  has_reminder: boolean;
  reminder_at?: string;
  reminder_sent: boolean;
  notifications_sent?: number;
  last_notification_at?: string;
  attachments?: Attachment[];
  external_reference?: string;
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Relaciones
  client?: {
    id: number;
    name: string;
    document: string;
    email?: string;
    phone?: string;
  };
  poliza?: {
    id: number;
    numero_poliza: string;
    tipo_seguro: string;
    estado: string;
  };
  assigned_user?: {
    id: number;
    name: string;
    email: string;
  };
  creator?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface ActivityLog {
  timestamp: string;
  activity: string;
  data?: any;
  user_id?: number;
}

export interface Attachment {
  filename: string;
  url: string;
  size?: number;
  uploaded_at: string;
  uploaded_by?: number;
}

export interface SeguimientoFilters {
  search?: string;
  type?: string;
  status?: string;
  priority?: string;
  assigned_to?: number;
  client_id?: number;
  due_date_from?: string;
  due_date_to?: string;
  overdue?: boolean;
  due_today?: boolean;
  due_this_week?: boolean;
  needing_follow_up?: boolean;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface SeguimientoResponse {
  data: SeguimientoItem[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface SeguimientoStatistics {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  cancelada: number;
  pausada: number;
  due_today: number;
  due_this_week: number;
  needing_follow_up: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

export interface CreateSeguimientoData {
  title: string;
  description?: string;
  type: SeguimientoItem['type'];
  priority: SeguimientoItem['priority'];
  client_id?: number;
  poliza_id?: number;
  assigned_to?: number;
  due_date?: string;
  scheduled_for?: string;
  contact_method?: SeguimientoItem['contact_method'];
  contact_phone?: string;
  contact_email?: string;
  estimated_duration_minutes?: number;
  has_reminder?: boolean;
  reminder_at?: string;
  assigned_company?: string;
  assigned_financial_entity?: string;
}

export interface UpdateSeguimientoData extends Partial<CreateSeguimientoData> {
  status?: SeguimientoItem['status'];
  progress_percentage?: number;
  notes?: string;
  contact_notes?: string;
  result?: SeguimientoItem['result'];
  actual_duration_minutes?: number;
}

const getAuthHeaders = async (): Promise<HeadersInit> => {
  let token: string | null = null;

  // Prioridad 1: Intentar obtener token de Firebase Auth
  try {
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
  } catch (error) {}

  // Fallback: Usar token SaaS si Firebase no está disponible
  if (!token) {
    token = localStorage.getItem('saas_token');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

export const seguimientoService = {
  // Obtener lista de seguimientos
  async getSeguimientos(
    filters: SeguimientoFilters = {},
    signal?: AbortSignal,
  ): Promise<SeguimientoResponse> {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks?${params}`, {
      headers: await getAuthHeaders(),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Obtener un seguimiento específico
  async getSeguimiento(id: number): Promise<{ data: SeguimientoItem }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/${id}`, {
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Crear nuevo seguimiento
  async createSeguimiento(
    data: CreateSeguimientoData,
  ): Promise<{ data: SeguimientoItem; message: string }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Actualizar seguimiento
  async updateSeguimiento(
    id: number,
    data: UpdateSeguimientoData,
  ): Promise<{ data: SeguimientoItem; message: string }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Eliminar seguimiento
  async deleteSeguimiento(id: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Iniciar tarea
  async startSeguimiento(id: number): Promise<{ data: SeguimientoItem; message: string }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/${id}/start`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Completar tarea
  async completeSeguimiento(
    id: number,
    data: { result?: string; notes?: string; actual_duration_minutes?: number },
  ): Promise<{ data: SeguimientoItem; message: string }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/${id}/complete`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Actualizar progreso
  async updateProgress(
    id: number,
    data: { progress_percentage: number; notes?: string },
  ): Promise<{ data: SeguimientoItem; message: string }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/${id}/progress`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Obtener estadísticas
  async getStatistics(): Promise<{ data: SeguimientoStatistics }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/statistics`, {
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Obtener clientes disponibles con búsqueda
  async getClients(
    search?: string,
    perPage: number = 50,
  ): Promise<{
    data: Array<{ id: number; name: string; document: string; email?: string; phone?: string }>;
  }> {
    const params = new URLSearchParams();
    if (search) {
      params.append('search', search);
    }
    params.append('per_page', perPage.toString());

    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/clients?${params}`, {
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Obtener usuarios disponibles
  async getUsers(): Promise<{ data: Array<{ id: number; name: string; email: string }> }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/users`, {
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },

  // Obtener tareas que necesitan atención
  async getTasksNeedingAttention(): Promise<{ data: SeguimientoItem[] }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/needing-attention`, {
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },
};

// Configuración de Prioridades ————————

export interface PriorityConfig {
  id: number;
  broker_id: number;
  priority_key: string;
  label: string;
  icon: string;
  color: string;
  bg_color: string;
  text_color: string;
  first_notification_minutes: number;
  repeat_every_minutes: number;
  max_notifications: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const priorityConfigService = {
  async getConfigs(): Promise<{ data: PriorityConfig[] }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/priority-configs`, {
      headers: await getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return response.json();
  },

  async updateConfig(priorityKey: string, data: Partial<PriorityConfig>): Promise<{ data: PriorityConfig; message: string }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/priority-configs/${priorityKey}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Error ${response.status}`);
    }
    return response.json();
  },

  async resetDefaults(): Promise<{ data: PriorityConfig[]; message: string }> {
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks/priority-configs/reset`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return response.json();
  },
};

// Helpers para UI
export function getPriorityStyle(config: PriorityConfig | undefined, fallback: { bg: string; text: string; icon: string; label: string }) {
  if (!config) return fallback;
  return {
    bg: config.bg_color || fallback.bg,
    text: config.text_color || fallback.text,
    icon: config.icon || fallback.icon,
    color: config.color || '#6B7280',
    label: config.label || fallback.label,
  };
}

export function getNextNotificationInfo(
  task: SeguimientoItem,
  config: PriorityConfig | undefined,
): { text: string; due: boolean; minutesRemaining: number | null } {
  if (!config || !config.enabled || task.status === 'completada' || task.status === 'cancelada') {
    return { text: '-', due: false, minutesRemaining: null };
  }

  const refDate = task.scheduled_for || task.due_date;
  if (!refDate) return { text: '-', due: false, minutesRemaining: null };

  const ref = new Date(refDate);
  const now = new Date();
  const minutesRemaining = Math.round((ref.getTime() - now.getTime()) / 60000);

  if (minutesRemaining <= 0) {
    return { text: 'Vencida', due: true, minutesRemaining: 0 };
  }

  // ¿Cuándo fue la última o primera notificación?
  const firstNotifyAt = new Date(ref.getTime() - config.first_notification_minutes * 60000);
  const nextRepeat = config.repeat_every_minutes > 0 && task.notifications_sent && task.notifications_sent > 0
    ? new Date(now.getTime() + config.repeat_every_minutes * 60000)
    : firstNotifyAt;

  const untilNotify = Math.round((nextRepeat.getTime() - now.getTime()) / 60000);

  if (untilNotify <= 0) {
    return { text: 'Notificación pendiente', due: true, minutesRemaining };
  }

  const h = Math.floor(untilNotify / 60);
  const m = untilNotify % 60;
  return {
    text: `Próxima notif. en ${h > 0 ? `${h}h ` : ''}${m}m`,
    due: false,
    minutesRemaining,
  };
}
