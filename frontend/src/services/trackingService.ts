import { auth } from '../config/firebase';
import { API_BASE_URL } from 'src/config/api';

export interface TrackingEntry {
  id?: number;
  task_id?: number;
  event_id?: number;
  user_id: number;
  action: string;
  description: string;
  previous_state?: any;
  new_state?: any;
  created_at?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface TaskNote {
  id?: number;
  task_id?: number;
  event_id?: number;
  user_id: number;
  note: string;
  is_private: boolean;
  created_at?: string;
  updated_at?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface BitacoraEntry {
  id: number;
  task_id?: number;
  event_id?: number;
  title: string;
  description: string;
  action: string;
  timestamp: string;
  user: string;
  changes?: {
    field: string;
    previous: any;
    new: any;
  }[];
  notes?: string;
  priority?: string;
}

class TrackingService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    let token: string | null = null;

    try {
      const user = auth.currentUser;
      if (user) {
        token = await user.getIdToken();
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Registrar una acción de seguimiento
   */
  async trackAction(entry: Omit<TrackingEntry, 'id' | 'created_at' | 'user'>): Promise<TrackingEntry> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/tracking`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || entry;
    } catch (error) {
      console.error('Error al registrar acción de seguimiento:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de seguimiento de una tarea
   */
  async getTaskHistory(taskId: number): Promise<TrackingEntry[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/tracking/task/${taskId}`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error al obtener historial de tarea:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de seguimiento de un evento del calendario
   */
  async getEventHistory(eventId: number): Promise<TrackingEntry[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/tracking/event/${eventId}`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error al obtener historial de evento:', error);
      throw error;
    }
  }

  /**
   * Añadir una nota a una tarea
   */
  async addNote(note: Omit<TaskNote, 'id' | 'created_at' | 'updated_at' | 'user'>): Promise<TaskNote> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/task-notes`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(note),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || note;
    } catch (error) {
      console.error('Error al añadir nota:', error);
      throw error;
    }
  }

  /**
   * Obtener notas de una tarea
   */
  async getTaskNotes(taskId: number): Promise<TaskNote[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/task-notes/${taskId}`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error al obtener notas de tarea:', error);
      throw error;
    }
  }

  /**
   * Actualizar una nota
   */
  async updateNote(noteId: number, note: Partial<TaskNote>): Promise<TaskNote> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/task-notes/${noteId}`, {
        method: 'PUT',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(note),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || note;
    } catch (error) {
      console.error('Error al actualizar nota:', error);
      throw error;
    }
  }

  /**
   * Eliminar una nota
   */
  async deleteNote(noteId: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/task-notes/${noteId}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error al eliminar nota:', error);
      throw error;
    }
  }

  /**
   * Generar bitácora completa de un elemento
   */
  async generateBitacora(taskId?: number, eventId?: number): Promise<BitacoraEntry[]> {
    try {
      let url = `${API_BASE_URL}/saas/bitacora`;
      const params = new URLSearchParams();
      
      if (taskId) params.append('task_id', taskId.toString());
      if (eventId) params.append('event_id', eventId.toString());
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error al generar bitácora:', error);
      throw error;
    }
  }

  /**
   * Obtener acciones de seguimiento disponibles
   */
  getAvailableActions(): { [key: string]: string } {
    return {
      'task_created': 'Tarea Creada',
      'task_updated': 'Tarea Actualizada',
      'task_completed': 'Tarea Completada',
      'task_cancelled': 'Tarea Cancelada',
      'task_reassigned': 'Tarea Reasignada',
      'task_priority_changed': 'Prioridad Cambiada',
      'task_status_changed': 'Estado Cambiado',
      'task_scheduled': 'Tarea Programada',
      'task_rescheduled': 'Tarea Reprogramada',
      'note_added': 'Nota Añadida',
      'note_updated': 'Nota Actualizada',
      'note_deleted': 'Nota Eliminada',
      'reminder_set': 'Recordatorio Configurado',
      'reminder_sent': 'Recordatorio Enviado',
      'event_created': 'Evento Creado',
      'event_updated': 'Evento Actualizado',
      'event_deleted': 'Evento Eliminado',
      'event_rescheduled': 'Evento Reprogramado',
    };
  }

  /**
   * Formatear entrada de bitácora para visualización
   */
  formatBitacoraEntry(entry: TrackingEntry, notes: TaskNote[] = []): BitacoraEntry {
    const actions = this.getAvailableActions();
    const actionText = actions[entry.action] || entry.action;
    
    // Buscar notas relacionadas
    const relatedNotes = notes.filter(note => 
      note.task_id === entry.task_id || note.event_id === entry.event_id
    );

    return {
      id: entry.id || 0,
      task_id: entry.task_id,
      event_id: entry.event_id,
      title: actionText,
      description: entry.description,
      action: entry.action,
      timestamp: entry.created_at || new Date().toISOString(),
      user: entry.user?.name || 'Usuario',
      changes: entry.previous_state && entry.new_state ? 
        this.extractChanges(entry.previous_state, entry.new_state) : undefined,
      notes: relatedNotes.map(note => note.note).join('\n'),
      priority: entry.new_state?.priority || entry.previous_state?.priority,
    };
  }

  /**
   * Extraer cambios entre estados
   */
  private extractChanges(previous: any, current: any): { field: string; previous: any; new: any }[] {
    const changes: { field: string; previous: any; new: any }[] = [];
    
    const fieldNames: { [key: string]: string } = {
      'title': 'Título',
      'description': 'Descripción',
      'status': 'Estado',
      'priority': 'Prioridad',
      'assigned_user_id': 'Usuario Asignado',
      'scheduled_for': 'Fecha Programada',
      'due_date': 'Fecha Límite',
      'type': 'Tipo',
    };

    for (const key in current) {
      if (previous[key] !== current[key] && fieldNames[key]) {
        changes.push({
          field: fieldNames[key],
          previous: previous[key],
          new: current[key],
        });
      }
    }

    return changes;
  }

  /**
   * Crear resumen de actividad
   */
  createActivitySummary(entries: BitacoraEntry[]): {
    total: number;
    byAction: { [key: string]: number };
    byUser: { [key: string]: number };
    recent: BitacoraEntry[];
  } {
    const summary = {
      total: entries.length,
      byAction: {} as { [key: string]: number },
      byUser: {} as { [key: string]: number },
      recent: entries.slice(0, 10), // Últimas 10 entradas
    };

    entries.forEach(entry => {
      // Contar por acción
      summary.byAction[entry.action] = (summary.byAction[entry.action] || 0) + 1;
      
      // Contar por usuario
      summary.byUser[entry.user] = (summary.byUser[entry.user] || 0) + 1;
    });

    return summary;
  }
}

export default new TrackingService();
