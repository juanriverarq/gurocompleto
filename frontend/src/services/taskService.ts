import { toast } from 'src/hooks/use-toast';
import { auth } from '../config/firebase';

// Configuración de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

// Usar las rutas SaaS
const API_PREFIX = '/saas/tasks';

// Interfaces
export interface Task {
  id?: number;
  titulo: string;
  descripcion: string;
  tipo:
    | 'Seguimiento Cliente'
    | 'Documentación'
    | 'Inspección'
    | 'Renovación'
    | 'Siniestro'
    | 'Cotización';
  prioridad: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  estado: 'Pendiente' | 'En Progreso' | 'Completada' | 'Vencida' | 'Cancelada';
  fecha_creacion?: string;
  fecha_vencimiento: string;
  asignado_a: string;
  cliente: string;
  numero_poliza?: string;
  progreso: number;
  observaciones?: string;
  ultima_actualizacion?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaskFilters {
  busqueda?: string;
  tipo?: string;
  estado?: string;
  prioridad?: string;
  asignado?: string;
  fecha_vencimiento?: string;
  page?: number;
  per_page?: number;
}

export interface TaskResponse {
  data: Task[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface TaskStats {
  total: number;
  pendientes: number;
  en_progreso: number;
  completadas: number;
  vencidas: number;
  vencen_hoy: number;
  vencen_semana: number;
}

export interface TaskOptions {
  tipos: string[];
  prioridades: string[];
  estados: string[];
  usuarios: Array<{
    id: number;
    name: string;
    email: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

// Helper para obtener el token de autenticación Firebase
const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    return null;
  }
};

// Helper para hacer peticiones HTTP con autenticación
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    // Obtener token de Firebase
    const token = await getAuthToken();

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Agregar token si existe
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));

      // Si hay errores de validación, mostrarlos
      if (errorData.errors) {
        const firstError = Object.values(errorData.errors)[0];
        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
        throw new Error(errorMessage || errorData.message || `HTTP ${response.status}`);
      }

      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
}

// Servicio de tareas
export const taskService = {
  /**
   * Obtener lista de tareas con filtros y paginación
   */
  async getTasks(filters: TaskFilters = {}): Promise<ApiResponse<TaskResponse>> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `${API_PREFIX}?${queryParams.toString()}`;
      const response = await makeRequest<TaskResponse>(endpoint);

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar tareas',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  /**
   * Obtener una tarea específica por ID
   */
  async getTask(id: number): Promise<ApiResponse<Task>> {
    try {
      const response = await makeRequest<Task>(`${API_PREFIX}/${id}`);
      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar tarea',
        description: error instanceof Error ? error.message : 'Tarea no encontrada',
      });
      throw error;
    }
  },

  /**
   * Crear una nueva tarea
   */
  async createTask(
    task: Omit<Task, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<ApiResponse<Task>> {
    try {
      const response = await makeRequest<Task>(API_PREFIX, {
        method: 'POST',
        body: JSON.stringify(task),
      });

      if (response.success) {
        toast({
          title: 'Tarea creada exitosamente',
          description: `La tarea "${task.titulo}" ha sido creada correctamente.`,
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al crear tarea',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  /**
   * Actualizar una tarea existente
   */
  async updateTask(id: number, task: Partial<Task>): Promise<ApiResponse<Task>> {
    try {
      const response = await makeRequest<Task>(`${API_PREFIX}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(task),
      });

      if (response.success) {
        toast({
          title: 'Tarea actualizada exitosamente',
          description: `La tarea ha sido actualizada correctamente.`,
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar tarea',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  /**
   * Eliminar una tarea
   */
  async deleteTask(id: number): Promise<ApiResponse<void>> {
    try {
      const response = await makeRequest<void>(`${API_PREFIX}/${id}`, {
        method: 'DELETE',
      });

      if (response.success) {
        toast({
          title: 'Tarea eliminada exitosamente',
          description: 'La tarea ha sido eliminada correctamente.',
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar tarea',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  /**
   * Marcar tarea como completada
   */
  async completeTask(id: number): Promise<ApiResponse<Task>> {
    try {
      const response = await makeRequest<Task>(`${API_PREFIX}/${id}/completar`, {
        method: 'POST',
      });

      if (response.success) {
        toast({
          title: 'Tarea completada exitosamente',
          description: 'La tarea ha sido marcada como completada.',
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al completar tarea',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  /**
   * Obtener estadísticas de tareas
   */
  async getStats(): Promise<ApiResponse<TaskStats>> {
    try {
      const response = await makeRequest<TaskStats>(`${API_PREFIX}/estadisticas`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener opciones para formularios
   */
  async getOptions(): Promise<ApiResponse<TaskOptions>> {
    try {
      const response = await makeRequest<TaskOptions>(`${API_PREFIX}/opciones`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Actualizar progreso de una tarea
   */
  async updateProgress(
    id: number,
    progreso: number,
    observaciones?: string,
  ): Promise<ApiResponse<Task>> {
    try {
      const response = await makeRequest<Task>(`${API_PREFIX}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          progreso,
          observaciones,
          estado: progreso === 100 ? 'Completada' : 'En Progreso',
        }),
      });

      if (response.success) {
        toast({
          title: 'Progreso actualizado exitosamente',
          description: 'El progreso de la tarea ha sido actualizado.',
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar progreso',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  /**
   * Exportar tareas a CSV
   */
  async exportTasks(filters: TaskFilters = {}): Promise<Blob> {
    try {
      const token = await getAuthToken();
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(
        `${API_BASE_URL}${API_PREFIX}/export?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Error al exportar datos');
      }

      const blob = await response.blob();
      return blob;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al exportar',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },
};

export default taskService;
