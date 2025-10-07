import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationApi, type Notification, type NotificationFilters } from '../services/api/notificationApi';
import { useToast } from './use-toast';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadNotifications: (filters?: NotificationFilters) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  refreshNotifications: () => void;
  
  // Real-time features
  subscribeToRealTime: () => () => void;
}

export const useNotifications = (
  autoLoad = true,
  pollingInterval = 60000, // 1 minuto por defecto
  filters?: NotificationFilters
): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup en unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const loadNotifications = useCallback(async (customFilters?: NotificationFilters) => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await notificationApi.getNotifications({
        per_page: 50,
        ...filters,
        ...customFilters
      });
      
      if (response.success && mountedRef.current) {
        setNotifications(response.data);
        setUnreadCount(response.unread_count);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Error cargando notificaciones';
        setError(errorMessage);
        console.error('Error loading notifications:', err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await notificationApi.markAsRead(notificationId);
      
      if (response.success && mountedRef.current) {
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        toast({
          title: "Notificación marcada como leída",
          description: "La notificación ha sido marcada como leída"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error marcando notificación';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
    }
  }, [toast]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await notificationApi.markAllAsRead();
      
      if (response.success && mountedRef.current) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        
        toast({
          title: "Notificaciones marcadas",
          description: "Todas las notificaciones han sido marcadas como leídas"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error marcando notificaciones';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
    }
  }, [toast]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await notificationApi.deleteNotification(notificationId);
      
      if (response.success && mountedRef.current) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        
        // Actualizar contador si la notificación era no leída
        const deletedNotification = notifications.find(n => n.id === notificationId);
        if (deletedNotification && !deletedNotification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        
        toast({
          title: "Notificación eliminada",
          description: "La notificación ha sido eliminada"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error eliminando notificación';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
    }
  }, [notifications, toast]);

  const deleteAllNotifications = useCallback(async () => {
    try {
      const response = await notificationApi.deleteAllNotifications();
      
      if (response.success && mountedRef.current) {
        setNotifications([]);
        setUnreadCount(0);
        
        toast({
          title: "Notificaciones eliminadas",
          description: "Todas las notificaciones han sido eliminadas"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error eliminando notificaciones';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
    }
  }, [toast]);

  const refreshNotifications = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  const subscribeToRealTime = useCallback(() => {
    // Configurar polling para simular tiempo real
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = setInterval(() => {
      if (mountedRef.current) {
        loadNotifications();
      }
    }, pollingInterval);

    // Suscribirse a notificaciones del API (cuando esté disponible)
    const unsubscribe = notificationApi.subscribeToNotifications((newNotification) => {
      if (mountedRef.current) {
        setNotifications(prev => [newNotification, ...prev]);
        if (!newNotification.read) {
          setUnreadCount(prev => prev + 1);
        }
        
        // Mostrar notificación toast para notificaciones importantes
        if (newNotification.priority === 'urgent' || newNotification.priority === 'high') {
          toast({
            title: newNotification.title,
            description: newNotification.message,
            variant: newNotification.type === 'error' ? 'destructive' : 'default'
          });
        }
      }
    });

    // Devolver función de cleanup
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      unsubscribe();
    };
  }, [pollingInterval, loadNotifications, toast]);

  // Auto-cargar notificaciones al montar
  useEffect(() => {
    if (autoLoad) {
      loadNotifications();
    }
  }, [autoLoad, loadNotifications]);

  // Configurar polling si está habilitado
  useEffect(() => {
    if (pollingInterval > 0) {
      const cleanup = subscribeToRealTime();
      return cleanup;
    }
  }, [pollingInterval, subscribeToRealTime]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refreshNotifications,
    subscribeToRealTime
  };
};
