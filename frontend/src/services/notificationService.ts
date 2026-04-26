import { auth } from '../config/firebase';
import { API_BASE_URL } from 'src/config/api';

export interface NotificationSettings {
  id?: number;
  user_id: number;
  task_priority: string;
  frequency_hours: number;
  frequency_minutes: number;
  is_active: boolean;
  color_code: string;
  sound_enabled: boolean;
  browser_notification: boolean;
  email_notification: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationRule {
  task_priority: string;
  frequency_hours: number;
  frequency_minutes: number;
  color_code: string;
  description: string;
}

class NotificationService {
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
   * Obtener configuración de notificaciones del usuario
   */
  async getNotificationSettings(): Promise<NotificationSettings[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/notification-settings`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error al obtener configuración de notificaciones:', error);
      throw error;
    }
  }

  /**
   * Crear o actualizar configuración de notificaciones
   */
  async saveNotificationSettings(settings: Omit<NotificationSettings, 'id' | 'created_at' | 'updated_at'>[]): Promise<NotificationSettings[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/notification-settings`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error al guardar configuración de notificaciones:', error);
      throw error;
    }
  }

  /**
   * Solicitar permiso para notificaciones del navegador
   */
  async requestBrowserPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones del sistema');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Enviar notificación del navegador
   */
  async sendBrowserNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    const hasPermission = await this.requestBrowserPermission();
    
    if (hasPermission) {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    }
  }

  /**
   * Programar recordatorio para una tarea
   */
  async scheduleTaskReminder(taskId: number, scheduledTime: Date, message: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/task-reminders`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          task_id: taskId,
          scheduled_time: scheduledTime.toISOString(),
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error al programar recordatorio:', error);
      throw error;
    }
  }

  /**
   * Obtener reglas de notificación predeterminadas por prioridad
   */
  getDefaultNotificationRules(): NotificationRule[] {
    return [
      {
        task_priority: 'critica',
        frequency_hours: 2,
        frequency_minutes: 0,
        color_code: '#EF4444',
        description: 'Tareas críticas: Recordatorio cada 2 horas'
      },
      {
        task_priority: 'alta',
        frequency_hours: 4,
        frequency_minutes: 0,
        color_code: '#F59E0B',
        description: 'Tareas altas: Recordatorio cada 4 horas'
      },
      {
        task_priority: 'media',
        frequency_hours: 8,
        frequency_minutes: 0,
        color_code: '#3B82F6',
        description: 'Tareas medias: Recordatorio cada 8 horas'
      },
      {
        task_priority: 'baja',
        frequency_hours: 24,
        frequency_minutes: 0,
        color_code: '#10B981',
        description: 'Tareas bajas: Recordatorio diario'
      },
    ];
  }

  /**
   * Calcular próxima hora de notificación según configuración
   */
  calculateNextNotificationTime(lastNotification: Date | null, frequencyHours: number, frequencyMinutes: number): Date {
    const now = new Date();
    const lastTime = lastNotification || new Date(0);
    
    const intervalMs = (frequencyHours * 60 * 60 * 1000) + (frequencyMinutes * 60 * 1000);
    const nextTime = new Date(lastTime.getTime() + intervalMs);
    
    // Si la próxima notificación ya pasó, programar desde ahora
    if (nextTime <= now) {
      return new Date(now.getTime() + intervalMs);
    }
    
    return nextTime;
  }

  /**
   * Verificar si se debe enviar notificación
   */
  shouldSendNotification(lastNotification: Date | null, frequencyHours: number, frequencyMinutes: number): boolean {
    if (!lastNotification) return true;
    
    const now = new Date();
    const intervalMs = (frequencyHours * 60 * 60 * 1000) + (frequencyMinutes * 60 * 1000);
    const timeSinceLast = now.getTime() - lastNotification.getTime();
    
    return timeSinceLast >= intervalMs;
  }

  /**
   * Iniciar servicio de notificaciones en segundo plano
   */
  startNotificationService(settings: NotificationSettings[]): void {
    // Verificar cada minuto si hay notificaciones pendientes
    setInterval(async () => {
      for (const setting of settings) {
        if (!setting.is_active) continue;
        
        try {
          // Aquí iría la lógica para verificar tareas de esta prioridad
          // y enviar notificaciones según la configuración
          console.log(`Verificando notificaciones para prioridad: ${setting.task_priority}`);
        } catch (error) {
          console.error('Error en servicio de notificaciones:', error);
        }
      }
    }, 60000); // Verificar cada minuto
  }
}

export default new NotificationService();
