import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useWhatsAppSocket, InboxMessageEvent, ConversationAssignedEvent } from 'src/hooks/useWhatsAppSocket';
import whatsappInboxService from 'src/services/whatsappInboxService';

export interface WhatsAppNotification {
  id: string;
  type: 'new_message' | 'new_conversation' | 'assignment';
  title: string;
  message: string;
  phone: string;
  conversationId?: number;
  timestamp: Date;
  read: boolean;
}

interface WhatsAppNotificationContextType {
  notifications: WhatsAppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<WhatsAppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  desktopNotificationsEnabled: boolean;
  setDesktopNotificationsEnabled: (enabled: boolean) => void;
  requestDesktopPermission: () => Promise<boolean>;
}

const WhatsAppNotificationContext = createContext<WhatsAppNotificationContextType | null>(null);

// Valores por defecto para cuando el hook se usa fuera del provider
const defaultContextValue: WhatsAppNotificationContextType = {
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  soundEnabled: true,
  setSoundEnabled: () => {},
  desktopNotificationsEnabled: false,
  setDesktopNotificationsEnabled: () => {},
  requestDesktopPermission: async () => false,
};

export const useWhatsAppNotifications = () => {
  const context = useContext(WhatsAppNotificationContext);
  // Retornar valores por defecto si no hay provider (ej: páginas de login)
  if (!context) {
    return defaultContextValue;
  }
  return context;
};

interface Props {
  children: React.ReactNode;
}

export const WhatsAppNotificationProvider: React.FC<Props> = ({ children }) => {
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('whatsapp_sound_enabled');
    return saved !== null ? saved === 'true' : false; // Desactivado por defecto
  });
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('whatsapp_desktop_notifications');
    return saved !== null ? saved === 'true' : false;
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inicializar audio - usar Web Audio API como fallback si no hay archivo
  useEffect(() => {
    // Intentar cargar archivo de sonido, si no existe usar Web Audio API
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    
    // Verificar si el archivo existe
    audio.addEventListener('error', () => {
      // Si no existe el archivo, usar Web Audio API para generar sonido
      audioRef.current = null;
    });
    
    audio.addEventListener('canplaythrough', () => {
      audioRef.current = audio;
    });
    
    // Intentar precargar
    audio.load();
  }, []);

  // Guardar preferencias
  useEffect(() => {
    localStorage.setItem('whatsapp_sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('whatsapp_desktop_notifications', String(desktopNotificationsEnabled));
  }, [desktopNotificationsEnabled]);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    
    // Si hay archivo de audio cargado, usarlo
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }
    
    // Fallback: usar Web Audio API para generar un sonido de notificación
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Frecuencia en Hz
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      // Ignorar errores de audio
    }
  }, [soundEnabled]);

  const showDesktopNotification = useCallback((title: string, body: string) => {
    if (desktopNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'whatsapp-message',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    }
  }, [desktopNotificationsEnabled]);

  const requestDesktopPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      setDesktopNotificationsEnabled(true);
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setDesktopNotificationsEnabled(true);
        return true;
      }
    }

    return false;
  }, []);

  const addNotification = useCallback((notification: Omit<WhatsAppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: WhatsAppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };

    console.log('🔔 [NotificationContext] Agregando notificación:', newNotification);
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Máximo 50 notificaciones
    // Sonido desactivado para evitar duplicados
    // playNotificationSound();
    showDesktopNotification(notification.title, notification.message);
  }, [playNotificationSound, showDesktopNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Handler para mensajes entrantes via WebSocket
  const handleInboxMessage = useCallback((data: InboxMessageEvent) => {
    // Solo notificar mensajes entrantes (de clientes)
    if (data.message?.direction === 'incoming') {
      addNotification({
        type: 'new_message',
        title: '📱 Nuevo mensaje de WhatsApp',
        message: data.message.content?.substring(0, 100) || '[Multimedia]',
        phone: data.phone || 'Desconocido',
        conversationId: data.conversationId,
      });
    }
  }, [addNotification]);

  // Handler para asignación de conversación via WebSocket
  const handleConversationAssigned = useCallback((data: ConversationAssignedEvent) => {
    const fromChatbot = data.fromChatbot ? ' (Chatbot)' : '';
    addNotification({
      type: 'assignment',
      title: `👤 Chat asignado${fromChatbot}`,
      message: `${data.contactName} fue asignado a ${data.assignedToName}`,
      phone: data.phone || 'Desconocido',
      conversationId: data.conversationId,
    });
  }, [addNotification]);

  // Conectar al WebSocket para recibir notificaciones (Baileys)
  useWhatsAppSocket({
    autoConnect: true,
    events: {
      onInboxMessage: handleInboxMessage,
      onConversationAssigned: handleConversationAssigned,
    }
  });

  // Polling para notificaciones (funciona con Cloud API y como fallback)
  const lastCheckedRef = useRef<string | null>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkForNewMessages = async () => {
      try {
        const response = await whatsappInboxService.getConversations({});
        const conversations = response.data || [];
        
        const unreadConvs = conversations.filter(c => c.unread_count > 0);
        console.log('🔔 [Polling] Conversaciones con mensajes no leídos:', unreadConvs.length);
        
        for (const conv of conversations) {
          // Si hay mensajes sin leer y es una conversación reciente
          if (conv.unread_count > 0 && conv.last_message_at) {
            const messageKey = `${conv.id}_${conv.last_message_at}`;
            
            // Evitar notificaciones duplicadas
            if (!processedMessageIdsRef.current.has(messageKey)) {
              processedMessageIdsRef.current.add(messageKey);
              
              // Solo notificar si es más reciente que la última verificación
              const isRecent = !lastCheckedRef.current || new Date(conv.last_message_at) > new Date(lastCheckedRef.current);
              console.log('🔔 [Polling] Nuevo mensaje detectado:', conv.phone, 'Es reciente:', isRecent);
              
              if (isRecent) {
                addNotification({
                  type: 'new_message',
                  title: '📱 Nuevo mensaje de WhatsApp',
                  message: (conv as any).last_message_preview || 'Nuevo mensaje recibido',
                  phone: conv.contact_push_name || conv.contact_name || conv.phone,
                  conversationId: conv.id,
                });
              }
            }
          }
        }
        
        lastCheckedRef.current = new Date().toISOString();
        
        // Limpiar IDs antiguos (mantener solo los últimos 100)
        if (processedMessageIdsRef.current.size > 100) {
          const idsArray = Array.from(processedMessageIdsRef.current);
          processedMessageIdsRef.current = new Set(idsArray.slice(-50));
        }
      } catch (err) {
        console.log('🔔 [Polling] Error:', err);
      }
    };

    // Verificar cada 10 segundos
    const interval = setInterval(checkForNewMessages, 10000);
    
    // Primera verificación después de 3 segundos
    const initialTimeout = setTimeout(checkForNewMessages, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [addNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <WhatsAppNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        soundEnabled,
        setSoundEnabled,
        desktopNotificationsEnabled,
        setDesktopNotificationsEnabled,
        requestDesktopPermission,
      }}
    >
      {children}
    </WhatsAppNotificationContext.Provider>
  );
};

export default WhatsAppNotificationContext;
