import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useWhatsAppSocket, InboxMessageEvent, ConversationAssignedEvent } from 'src/hooks/useWhatsAppSocket';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
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
  assignmentAlert: ConversationAssignedEvent | null;
  dismissAssignmentAlert: () => void;
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
  assignmentAlert: null,
  dismissAssignmentAlert: () => {},
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
  const { usuarioSaas, empleado } = useUnifiedAuth();
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);
  const [assignmentAlert, setAssignmentAlert] = useState<ConversationAssignedEvent | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('whatsapp_sound_enabled');
    return saved !== null ? saved === 'true' : true; // Activado por defecto
  });
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('whatsapp_desktop_notifications');
    return saved !== null ? saved === 'true' : false;
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  // Inicializar audio con archivo real .mp3
  useEffect(() => {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.7;
    audio.preload = 'auto';
    
    audio.addEventListener('canplaythrough', () => {
      console.log('🔊 [Audio] notification.mp3 cargado correctamente');
      audioRef.current = audio;
    });
    
    audio.addEventListener('error', () => {
      console.warn('🔊 [Audio] notification.mp3 no encontrado, usando Web Audio API');
      audioRef.current = null;
    });
    
    audio.load();

    // Desbloquear audio al primer clic/teclado del usuario (política autoplay del browser)
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      
      // Reproducir y pausar inmediatamente para desbloquear
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current!.pause();
          audioRef.current!.currentTime = 0;
        }).catch(() => {});
      }
      
      // También crear y cerrar un AudioContext para desbloquearlo
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        console.log('🔊 [Audio] AudioContext desbloqueado por interacción del usuario');
      } catch { /* ignore */ }
    };

    document.addEventListener('click', unlockAudio, { once: false });
    document.addEventListener('keydown', unlockAudio, { once: false });
    document.addEventListener('touchstart', unlockAudio, { once: false });

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
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
    
    console.log('🔊 [Audio] Intentando reproducir sonido...', { hasFile: !!audioRef.current });
    
    // Si hay archivo de audio cargado, usarlo (más confiable)
    if (audioRef.current) {
      const audio = audioRef.current;
      audio.currentTime = 0;
      audio.volume = 0.7;
      audio.play().then(() => {
        console.log('🔊 [Audio] Sonido reproducido (mp3)');
      }).catch((err) => {
        console.warn('🔊 [Audio] Error reproduciendo mp3:', err.message);
        // Fallback a Web Audio API
        playWebAudioFallback();
      });
      return;
    }
    
    playWebAudioFallback();
  }, [soundEnabled]);

  const playWebAudioFallback = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Primer tono
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 960;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.6, audioContext.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.15);
      
      // Segundo tono (más alto, después del primero)
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1200;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.6, audioContext.currentTime + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      osc2.start(audioContext.currentTime + 0.18);
      osc2.stop(audioContext.currentTime + 0.4);
      
      console.log('🔊 [Audio] Sonido reproducido (Web Audio API)');
    } catch (err) {
      console.warn('🔊 [Audio] Error Web Audio API:', err);
    }
  }, []);

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
    playNotificationSound();
    showDesktopNotification(notification.title, notification.message);
    
    // Disparar evento custom para que WhatsAppToast lo reciba inmediatamente
    window.dispatchEvent(new CustomEvent('whatsapp-new-notification', { detail: newNotification }));
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

  const dismissAssignmentAlert = useCallback(() => setAssignmentAlert(null), []);

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

    // Mostrar modal centrado solo al usuario al que le asignaron
    const currentUserId = Number(usuarioSaas?.id ?? empleado?.id ?? 0);
    if (currentUserId && data.assignedTo === currentUserId) {
      setAssignmentAlert(data);
    }
  }, [addNotification, usuarioSaas, empleado]);

  // Conectar al WebSocket para recibir notificaciones (Baileys)
  useWhatsAppSocket({
    autoConnect: true,
    events: {
      onInboxMessage: handleInboxMessage,
      onConversationAssigned: handleConversationAssigned,
    }
  });

  // Polling para notificaciones (funciona con Cloud API/YCloud y como fallback)
  // Usa ref para addNotification para evitar que el useEffect se re-ejecute y cause fantasmas
  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;

  const snapshotRef = useRef<Map<number, string>>(new Map());
  const isFirstPollRef = useRef(true);
  const recentWebSocketIdsRef = useRef<Set<number>>(new Set());

  // Registrar conversationIds que llegan por WebSocket para no duplicar con polling
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.conversationId) {
        recentWebSocketIdsRef.current.add(detail.conversationId);
        // Limpiar después de 15 segundos
        setTimeout(() => recentWebSocketIdsRef.current.delete(detail.conversationId), 15000);
      }
    };
    window.addEventListener('whatsapp-new-notification', handler);
    return () => window.removeEventListener('whatsapp-new-notification', handler);
  }, []);

  useEffect(() => {
    const checkForNewMessages = async () => {
      try {
        const response = await whatsappInboxService.getConversations({});
        const conversations = response.data || [];
        
        if (isFirstPollRef.current) {
          // Primera ejecución: solo guardar snapshot, no notificar
          for (const conv of conversations) {
            if (conv.last_message_at) {
              snapshotRef.current.set(conv.id, conv.last_message_at);
            }
          }
          isFirstPollRef.current = false;
          return;
        }

        // Comparar con snapshot anterior para detectar mensajes NUEVOS
        for (const conv of conversations) {
          if (!conv.last_message_at || conv.unread_count === 0) continue;
          
          const prevTimestamp = snapshotRef.current.get(conv.id);
          const currentTimestamp = conv.last_message_at;
          
          // Solo notificar si last_message_at realmente cambió
          if (prevTimestamp && prevTimestamp === currentTimestamp) continue;
          
          // Si no existía en snapshot previo, puede ser una nueva conversación o el primer poll
          // Solo notificar si cambió (prevTimestamp existe pero difiere)
          if (!prevTimestamp) {
            // Conversación nueva — registrar pero no notificar si snapshot ya tenía datos
            if (snapshotRef.current.size > 0) {
              snapshotRef.current.set(conv.id, currentTimestamp);
              continue;
            }
          }
          
          // Evitar duplicados con WebSocket
          if (recentWebSocketIdsRef.current.has(conv.id)) continue;
          
          const contactName = (conv as any).contact_push_name || (conv as any).contact_name || conv.phone;
          console.log('🔔 [Polling] Mensaje nuevo:', contactName);
          
          addNotificationRef.current({
            type: 'new_message',
            title: '📱 Nuevo mensaje de WhatsApp',
            message: (conv as any).last_message_preview || 'Nuevo mensaje recibido',
            phone: contactName,
            conversationId: conv.id,
          });
        }
        
        // Actualizar snapshot (NO clear — actualizar in-place para no perder datos)
        for (const conv of conversations) {
          if (conv.last_message_at) {
            snapshotRef.current.set(conv.id, conv.last_message_at);
          }
        }
      } catch (err) {
        // Silencioso
      }
    };

    // Verificar cada 8 segundos (más conservador)
    const interval = setInterval(checkForNewMessages, 8000);
    
    // Primera verificación después de 3 segundos
    const initialTimeout = setTimeout(checkForNewMessages, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, []); // Sin dependencias — usa refs para todo

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
        assignmentAlert,
        dismissAssignmentAlert,
      }}
    >
      {children}

      {/* Modal global de asignación — visible desde cualquier página */}
      {assignmentAlert && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={dismissAssignmentAlert}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Franja verde superior */}
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #22c55e, #16a34a)' }} />

            <div className="p-6">
              {/* Icono + título */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon icon="solar:chat-round-dots-bold" className="text-green-400" width={26} />
                </div>
                <div>
                  <p className="text-xs font-medium text-green-400 uppercase tracking-wider">Nueva conversación asignada</p>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {assignmentAlert.contactName || assignmentAlert.phone}
                  </h3>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Icon icon="solar:phone-bold" width={14} className="text-slate-500" />
                  <span className="font-mono">{assignmentAlert.phone}</span>
                </div>
                {assignmentAlert.assignedByName && assignmentAlert.assignedByName !== assignmentAlert.assignedToName && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Icon icon="solar:user-bold" width={14} className="text-slate-500" />
                    <span>Asignado por <strong className="text-slate-300">{assignmentAlert.assignedByName}</strong></span>
                  </div>
                )}
                {assignmentAlert.fromChatbot && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Icon icon="solar:robot-bold" width={14} className="text-slate-500" />
                    <span>Viene del chatbot</span>
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    dismissAssignmentAlert();
                    window.location.href = `/apps/whatsapp/inbox?conversation=${assignmentAlert.conversationId}`;
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                >
                  <Icon icon="solar:chat-round-bold" width={16} />
                  Ver conversación
                </button>
                <button
                  onClick={dismissAssignmentAlert}
                  className="py-2.5 px-4 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </WhatsAppNotificationContext.Provider>
  );
};

export default WhatsAppNotificationContext;
