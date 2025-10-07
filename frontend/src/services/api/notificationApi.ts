import { toast } from 'src/hooks/use-toast';
import { auth } from '../../config/firebase';

// Configuración de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

// Interfaces para notificaciones
export interface Notification {
  id: string;
  title: string;
  message: string;
  type:
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'poliza'
    | 'siniestro'
    | 'renovacion'
    | 'pago'
    | 'cliente';
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  expires_at?: string;
  action_url?: string;
  action_text?: string;
  related_entity?: {
    type: 'poliza' | 'cliente' | 'siniestro' | 'renovacion';
    id: string;
    name?: string;
  };
  metadata?: Record<string, any>;
}

export interface NotificationFilters {
  read?: boolean;
  type?: string;
  priority?: string;
  page?: number;
  per_page?: number;
  search?: string;
}

export interface NotificationResponse {
  success: boolean;
  data: Notification[];
  unread_count: number;
  total: number;
  current_page: number;
  last_page: number;
  message?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  today: number;
  this_week: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

// Función auxiliar para hacer peticiones autenticadas
async function makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const token = await user.getIdToken();
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error en petición autenticada:', error);
    throw error;
  }
}

// Servicio de notificaciones
export const notificationApi = {
  /**
   * Obtener lista de notificaciones con filtros
   */
  async getNotifications(filters: NotificationFilters = {}): Promise<NotificationResponse> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `/saas/notifications${
        queryParams.toString() ? `?${queryParams.toString()}` : ''
      }`;
      const response = await makeAuthenticatedRequest(endpoint);

      return {
        success: response.success || true,
        data: response.data || [],
        unread_count: response.unread_count || 0,
        total: response.total || 0,
        current_page: response.current_page || 1,
        last_page: response.last_page || 1,
        message: response.message,
      };
    } catch (error) {
      // En caso de error, devolver notificaciones mock para no romper la UI
      console.warn('Error obteniendo notificaciones, usando datos mock:', error);
      return this.getMockNotifications(filters);
    }
  },

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await makeAuthenticatedRequest(
        `/saas/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
        },
      );

      return {
        success: response.success || true,
        message: response.message,
      };
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
      return { success: false, message: 'Error al marcar como leída' };
    }
  },

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await makeAuthenticatedRequest('/saas/notifications/mark-all-read', {
        method: 'PATCH',
      });

      return {
        success: response.success || true,
        message: response.message,
      };
    } catch (error) {
      console.error('Error marcando todas las notificaciones como leídas:', error);
      return { success: false, message: 'Error al marcar todas como leídas' };
    }
  },

  /**
   * Eliminar notificación
   */
  async deleteNotification(
    notificationId: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await makeAuthenticatedRequest(`/saas/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      return {
        success: response.success || true,
        message: response.message,
      };
    } catch (error) {
      console.error('Error eliminando notificación:', error);
      return { success: false, message: 'Error al eliminar notificación' };
    }
  },

  /**
   * Eliminar todas las notificaciones
   */
  async deleteAllNotifications(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await makeAuthenticatedRequest('/saas/notifications', {
        method: 'DELETE',
      });

      return {
        success: response.success || true,
        message: response.message,
      };
    } catch (error) {
      console.error('Error eliminando todas las notificaciones:', error);
      return { success: false, message: 'Error al eliminar todas las notificaciones' };
    }
  },

  /**
   * Obtener estadísticas de notificaciones
   */
  async getNotificationStats(): Promise<NotificationStats> {
    try {
      const response = await makeAuthenticatedRequest('/saas/notifications/stats');

      return {
        total: response.total || 0,
        unread: response.unread || 0,
        today: response.today || 0,
        this_week: response.this_week || 0,
        by_type: response.by_type || {},
        by_priority: response.by_priority || {},
      };
    } catch (error) {
      console.warn('Error obteniendo estadísticas, usando datos mock:', error);
      return {
        total: 8,
        unread: 3,
        today: 2,
        this_week: 5,
        by_type: { poliza: 3, siniestro: 2, renovacion: 2, pago: 1 },
        by_priority: { low: 2, medium: 4, high: 2, urgent: 0 },
      };
    }
  },

  /**
   * Suscribirse a notificaciones en tiempo real (simulado)
   */
  subscribeToNotifications(callback: (notification: Notification) => void): () => void {
    // Por ahora simulamos con un intervalo
    // En producción esto podría usar WebSockets o Server-Sent Events
    const interval = setInterval(async () => {
      try {
        // Verificar si hay nuevas notificaciones cada 30 segundos
        const stats = await this.getNotificationStats();
        // La implementación real dependería del backend
      } catch (error) {
        // Error silencioso para no interrumpir la experiencia
      }
    }, 30000);

    return () => clearInterval(interval);
  },

  /**
   * Obtener notificaciones mock para desarrollo/fallback
   */
  getMockNotifications(filters: NotificationFilters = {}): NotificationResponse {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        title: 'Nueva Póliza Creada',
        message: 'Se ha creado una nueva póliza para Juan Pérez',
        type: 'poliza',
        read: false,
        priority: 'medium',
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
        action_url: '/polizas/12345',
        action_text: 'Ver Póliza',
        related_entity: {
          type: 'poliza',
          id: '12345',
          name: 'Póliza Auto - Juan Pérez',
        },
      },
      {
        id: '2',
        title: 'Renovación Próxima',
        message: 'La póliza de María García vence en 7 días',
        type: 'renovacion',
        read: false,
        priority: 'high',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        action_url: '/renovaciones/67890',
        action_text: 'Renovar',
        related_entity: {
          type: 'renovacion',
          id: '67890',
          name: 'Renovación - María García',
        },
      },
      {
        id: '3',
        title: 'Pago Recibido',
        message: 'Pago de $450.000 COP procesado exitosamente',
        type: 'pago',
        read: true,
        priority: 'low',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
        action_url: '/pagos/payment_123',
        action_text: 'Ver Recibo',
      },
      {
        id: '4',
        title: 'Siniestro Reportado',
        message: 'Nuevo siniestro reportado por Carlos López',
        type: 'siniestro',
        read: false,
        priority: 'urgent',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
        action_url: '/siniestros/sin_456',
        action_text: 'Atender',
        related_entity: {
          type: 'siniestro',
          id: 'sin_456',
          name: 'Siniestro - Carlos López',
        },
      },
      {
        id: '5',
        title: 'Cliente Nuevo',
        message: 'Ana Rodríguez se ha registrado en el sistema',
        type: 'cliente',
        read: true,
        priority: 'low',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
        action_url: '/clientes/cli_789',
        action_text: 'Ver Perfil',
        related_entity: {
          type: 'cliente',
          id: 'cli_789',
          name: 'Ana Rodríguez',
        },
      },
    ];

    // Aplicar filtros
    let filteredNotifications = mockNotifications;

    if (filters.read !== undefined) {
      filteredNotifications = filteredNotifications.filter((n) => n.read === filters.read);
    }

    if (filters.type) {
      filteredNotifications = filteredNotifications.filter((n) => n.type === filters.type);
    }

    if (filters.priority) {
      filteredNotifications = filteredNotifications.filter((n) => n.priority === filters.priority);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filteredNotifications = filteredNotifications.filter(
        (n) => n.title.toLowerCase().includes(search) || n.message.toLowerCase().includes(search),
      );
    }

    const unreadCount = mockNotifications.filter((n) => !n.read).length;

    return {
      success: true,
      data: filteredNotifications,
      unread_count: unreadCount,
      total: filteredNotifications.length,
      current_page: 1,
      last_page: 1,
    };
  },
};
