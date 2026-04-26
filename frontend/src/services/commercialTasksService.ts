export interface CommercialTask {
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
  attachments?: Attachment[];
  external_reference?: string;
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Relaciones
  client?: Client;
  poliza?: Poliza;
  assigned_user?: User;
  creator?: User;

  // Atributos calculados
  type_name?: string;
  status_name?: string;
  priority_name?: string;
  result_name?: string;
  contact_method_name?: string;
  is_overdue?: boolean;
  is_due_today?: boolean;
  is_due_this_week?: boolean;
  days_until_due?: number;
  duration_in_minutes?: number;
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

export interface Client {
  id: number;
  name: string;
  document: string;
  email?: string;
  phone?: string;
}

export interface Poliza {
  id: number;
  numero_poliza: string;
  tipo_seguro: string;
  estado: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface TaskFilters {
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

export interface TasksResponse {
  data: CommercialTask[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface TaskStatistics {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  due_today: number;
  due_this_week: number;
  needing_follow_up: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  type: CommercialTask['type'];
  priority: CommercialTask['priority'];
  client_id?: number;
  poliza_id?: number;
  assigned_to?: number;
  due_date?: string;
  scheduled_for?: string;
  contact_method?: CommercialTask['contact_method'];
  contact_phone?: string;
  contact_email?: string;
  estimated_duration_minutes?: number;
  has_reminder?: boolean;
  reminder_at?: string;
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  status?: CommercialTask['status'];
  progress_percentage?: number;
  notes?: string;
  contact_notes?: string;
  result?: CommercialTask['result'];
  actual_duration_minutes?: number;
}

export interface CompleteTaskData {
  result?: CommercialTask['result'];
  notes?: string;
  actual_duration_minutes?: number;
}

export interface UpdateProgressData {
  progress_percentage: number;
  notes?: string;
}

export interface ScheduleFollowUpData {
  follow_up_date: string;
  notes?: string;
}

// Constantes para los tipos
export const TASK_TYPES = {
  seguimiento_cliente: 'Seguimiento Cliente',
  documentacion: 'Documentación',
  inspeccion: 'Inspección',
  renovacion: 'Renovación',
  siniestro: 'Siniestro',
  cotizacion: 'Cotización',
  llamada: 'Llamada',
  reunion: 'Reunión',
  email: 'Email',
  visita: 'Visita',
} as const;

export const TASK_STATUSES = {
  pendiente: 'Pendiente',
  en_progreso: 'En Progreso',
  completada: 'Completada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
  pausada: 'Pausada',
} as const;

export const TASK_PRIORITIES = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
} as const;

export const TASK_RESULTS = {
  exitoso: 'Exitoso',
  sin_respuesta: 'Sin Respuesta',
  rechazado: 'Rechazado',
  interesado: 'Interesado',
  reagendar: 'Reagendar',
  completado: 'Completado',
  cancelado: 'Cancelado',
} as const;

export const CONTACT_METHODS = {
  phone: 'Teléfono',
  email: 'Email',
  whatsapp: 'WhatsApp',
  in_person: 'Presencial',
  video_call: 'Videollamada',
} as const;

class CommercialTasksService {
  private baseUrl = `${
    import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
  }/saas/commercial-tasks`;

  private async getHeaders() {
    const { auth } = await import('../config/firebase');
    let token: string | null = null;
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // Obtener todas las tareas
  async getTasks(filters?: TaskFilters): Promise<TasksResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
    }

    const url = `${this.baseUrl}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener tareas: ${response.statusText}`);
    }

    return response.json();
  }

  // Reasignar tarea a otro usuario/empleado
  async reassignTask(id: number, assignedTo: number, reason?: string): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}/assign`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ assigned_to: assignedTo, reason: reason || null }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al reasignar la tarea');
    }
    const result = await response.json();
    return result.data;
  }

  // Agregar una nota a la bitácora
  async addNote(id: number, note: string, isPrivate = false): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/${id}/add-note`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ note, is_private: isPrivate }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Error al agregar la nota');
    }
    const result = await response.json();
    return result.data; // activity_log array
  }

  // Pausar tarea
  async pauseTask(id: number, reason?: string): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}/pause`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ reason: reason || null }),
    });
    if (!response.ok) throw new Error('Error al pausar la tarea');
    const result = await response.json();
    return result.data;
  }

  // Cancelar tarea
  async cancelTask(id: number, reason?: string): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}/cancel`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ reason: reason || null }),
    });
    if (!response.ok) throw new Error('Error al cancelar la tarea');
    const result = await response.json();
    return result.data;
  }

  // Obtener bitácora (activity_log) — usa getTask y extrae el campo
  async getActivityLog(id: number): Promise<any[]> {
    const task = await this.getTask(id);
    return (task as any).activity_log || [];
  }

  // Obtener una tarea por ID
  async getTask(id: number): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener tarea: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  // Crear nueva tarea
  async createTask(data: CreateTaskData): Promise<CommercialTask> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear tarea');
    }

    const result = await response.json();
    return result.data;
  }

  // Actualizar tarea
  async updateTask(id: number, data: UpdateTaskData): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar tarea');
    }

    const result = await response.json();
    return result.data;
  }

  // Eliminar tarea
  async deleteTask(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al eliminar tarea');
    }
  }

  // Iniciar tarea
  async startTask(id: number): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}/start`, {
      method: 'POST',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al iniciar tarea');
    }

    const result = await response.json();
    return result.data;
  }

  // Completar tarea
  async completeTask(id: number, data: CompleteTaskData): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}/complete`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al completar tarea');
    }

    const result = await response.json();
    return result.data;
  }

  // Actualizar progreso
  async updateProgress(id: number, data: UpdateProgressData): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}/progress`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar progreso');
    }

    const result = await response.json();
    return result.data;
  }

  // Programar seguimiento
  async scheduleFollowUp(id: number, data: ScheduleFollowUpData): Promise<CommercialTask> {
    const response = await fetch(`${this.baseUrl}/${id}/follow-up`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al programar seguimiento');
    }

    const result = await response.json();
    return result.data;
  }

  // Obtener estadísticas
  async getStatistics(): Promise<TaskStatistics> {
    const response = await fetch(`${this.baseUrl}/statistics`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener estadísticas: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  // Obtener tareas que requieren atención
  async getTasksNeedingAttention(): Promise<CommercialTask[]> {
    const response = await fetch(`${this.baseUrl}/needing-attention`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener tareas que requieren atención: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  // Obtener clientes disponibles
  async getClients(): Promise<Client[]> {
    const response = await fetch(`${this.baseUrl}/clients`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener clientes: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  // Obtener usuarios disponibles
  async getUsers(): Promise<User[]> {
    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener usuarios: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  // Formatear fecha para mostrar
  formatDate(dateString?: string): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // Formatear fecha y hora para mostrar
  formatDateTime(dateString?: string): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Obtener color para el estado
  getStatusColor(status: CommercialTask['status']): string {
    const colors = {
      pendiente: 'warning',
      en_progreso: 'info',
      completada: 'success',
      vencida: 'failure',
      cancelada: 'dark',
      pausada: 'gray',
    };
    return colors[status] || 'gray';
  }

  // Obtener color para la prioridad
  getPriorityColor(priority: CommercialTask['priority']): string {
    const colors = {
      baja: 'gray',
      media: 'warning',
      alta: 'info',
      critica: 'failure',
    };
    return colors[priority] || 'gray';
  }

  // Obtener color para el tipo
  getTypeColor(type: CommercialTask['type']): string {
    const colors = {
      seguimiento_cliente: 'blue',
      documentacion: 'purple',
      inspeccion: 'yellow',
      renovacion: 'green',
      siniestro: 'red',
      cotizacion: 'indigo',
      llamada: 'pink',
      reunion: 'teal',
      email: 'cyan',
      visita: 'orange',
    };
    return colors[type] || 'gray';
  }
}

export const commercialTasksService = new CommercialTasksService();
