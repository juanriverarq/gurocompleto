/**
 * Hook para manejar la conexión WebSocket con el microservicio de WhatsApp
 * Permite escuchar eventos en tiempo real como conexión exitosa, QR updates, etc.
 * 
 * IMPORTANTE: Este hook mantiene una conexión singleton para evitar reconexiones infinitas
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// URL del microservicio de WhatsApp (sin path - Socket.IO usa la raíz)
const WHATSAPP_MICROSERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3000';

// Extraer solo el origen (sin path) para Socket.IO
const getSocketUrl = () => {
  try {
    const url = new URL(WHATSAPP_MICROSERVICE_URL);
    return url.origin;
  } catch {
    return 'http://localhost:3000';
  }
};

// Singleton para mantener una única conexión global
let globalSocket: Socket | null = null;
let globalSocketConnected = false;
let connectionAttempted = false;

export interface WhatsAppSocketEvents {
  onConnected?: (data: { instanceId: string; timestamp: Date }) => void;
  onDisconnected?: (data: { instanceId: string; statusCode?: number; reason?: string }) => void;
  onQRCode?: (data: { instanceId: string; qrCode: string }) => void;
  onQRCleared?: (instanceId: string) => void;
  onInstanceUpdate?: (data: { instanceId: string; event: string; data: any }) => void;
  onNewMessage?: (data: { instanceId: string; phone: string; message: string; timestamp: Date }) => void;
  // Eventos del Inbox
  onInboxMessage?: (data: InboxMessageEvent) => void;
  onConversationUpdate?: (data: ConversationUpdateEvent) => void;
  onTypingIndicator?: (data: { conversationId: number; isTyping: boolean }) => void;
  onConversationAssigned?: (data: ConversationAssignedEvent) => void;
}

export interface ConversationAssignedEvent {
  conversationId: number;
  assignedTo: number;
  assignedToName: string;
  assignedBy: number;
  assignedByName: string;
  phone: string;
  contactName: string;
  fromChatbot?: boolean;
}

export interface InboxMessageEvent {
  conversationId: number;
  message: {
    id: number;
    message_id: string | null;
    direction: 'incoming' | 'outgoing';
    sender_type: 'client' | 'agent' | 'bot' | 'system';
    message_type: string;
    content: string | null;
    media?: any;
    created_at: string;
  };
  phone: string;
  instanceId: string;
}

export interface ConversationUpdateEvent {
  conversationId: number;
  updates: {
    status?: string;
    unread_count?: number;
    last_message_at?: string;
    assigned_to?: number | null;
  };
}

export interface UseWhatsAppSocketOptions {
  instanceId?: string;
  autoConnect?: boolean;
  events?: WhatsAppSocketEvents;
}

export interface UseWhatsAppSocketReturn {
  isConnected: boolean;
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
  subscribeToInstance: (instanceId: string) => void;
  unsubscribeFromInstance: (instanceId: string) => void;
}

export function useWhatsAppSocket(options: UseWhatsAppSocketOptions = {}): UseWhatsAppSocketReturn {
  const { instanceId, autoConnect = true, events } = options;
  const [isConnected, setIsConnected] = useState(globalSocketConnected);
  const subscribedInstancesRef = useRef<Set<string>>(new Set());
  const eventsRef = useRef(events);
  
  // Mantener referencia actualizada de events sin causar re-renders
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const connect = useCallback(() => {
    // Si ya hay conexión activa, no reconectar
    if (globalSocket?.connected) {
      setIsConnected(true);
      return;
    }

    // Si ya se intentó conectar y hay socket, esperar
    if (connectionAttempted && globalSocket) {
      return;
    }

    connectionAttempted = true;
    const socketUrl = getSocketUrl();
    console.log('🔌 [WhatsAppSocket] Conectando a:', socketUrl);

    globalSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    globalSocket.on('connect', () => {
      console.log('✅ [WhatsAppSocket] Conectado al microservicio');
      globalSocketConnected = true;
      setIsConnected(true);
    });

    globalSocket.on('disconnect', (reason) => {
      console.log('❌ [WhatsAppSocket] Desconectado:', reason);
      globalSocketConnected = false;
      setIsConnected(false);
    });

    globalSocket.on('connect_error', (error) => {
      console.error('❌ [WhatsAppSocket] Error de conexión:', error.message);
    });

    // Evento general de actualización de instancia
    globalSocket.on('instance_update', (data: { instanceId: string; event: string; data: any }) => {
      console.log('📡 [WhatsAppSocket] instance_update:', data);
      
      const currentEvents = eventsRef.current;
      if (currentEvents?.onInstanceUpdate) {
        currentEvents.onInstanceUpdate(data);
      }

      if (data.event === 'connected' && currentEvents?.onConnected) {
        currentEvents.onConnected({ instanceId: data.instanceId, timestamp: data.data?.timestamp || new Date() });
      } else if (data.event === 'disconnected' && currentEvents?.onDisconnected) {
        currentEvents.onDisconnected({ 
          instanceId: data.instanceId, 
          statusCode: data.data?.statusCode, 
          reason: data.data?.reason 
        });
      } else if (data.event === 'qr_code' && currentEvents?.onQRCode) {
        currentEvents.onQRCode({ instanceId: data.instanceId, qrCode: data.data });
      }
    });

    // =========================================================================
    // EVENTOS DEL INBOX (Tiempo Real)
    // =========================================================================

    // Nuevo mensaje en una conversación
    globalSocket.on('inbox_message', (data: InboxMessageEvent) => {
      console.log('📨 [WhatsAppSocket] inbox_message:', data);
      const currentEvents = eventsRef.current;
      if (currentEvents?.onInboxMessage) {
        currentEvents.onInboxMessage(data);
      }
    });

    // Actualización de conversación (estado, asignación, etc.)
    globalSocket.on('conversation_update', (data: ConversationUpdateEvent) => {
      console.log('🔄 [WhatsAppSocket] conversation_update:', data);
      const currentEvents = eventsRef.current;
      if (currentEvents?.onConversationUpdate) {
        currentEvents.onConversationUpdate(data);
      }
    });

    // Indicador de escritura
    globalSocket.on('typing_indicator', (data: { conversationId: number; isTyping: boolean }) => {
      const currentEvents = eventsRef.current;
      if (currentEvents?.onTypingIndicator) {
        currentEvents.onTypingIndicator(data);
      }
    });

    // Nueva conversación creada
    globalSocket.on('new_conversation', (data: any) => {
      console.log('🆕 [WhatsAppSocket] new_conversation:', data);
      const currentEvents = eventsRef.current;
      if (currentEvents?.onConversationUpdate) {
        currentEvents.onConversationUpdate({
          conversationId: data.id,
          updates: { status: 'pending', unread_count: 1 }
        });
      }
    });

    // Conversación asignada
    globalSocket.on('conversation_assigned', (data: ConversationAssignedEvent) => {
      console.log('👤 [WhatsAppSocket] conversation_assigned:', data);
      const currentEvents = eventsRef.current;
      if (currentEvents?.onConversationAssigned) {
        currentEvents.onConversationAssigned(data);
      }
    });
  }, []);

  const disconnect = useCallback(() => {
    // No desconectar el socket global - es compartido
    // Solo limpiar estado local si es necesario
  }, []);

  const subscribeToInstance = useCallback((instId: string) => {
    if (!instId || !globalSocket) return;
    
    // Evitar suscripciones duplicadas
    if (subscribedInstancesRef.current.has(instId)) {
      return;
    }

    subscribedInstancesRef.current.add(instId);
    console.log(`🔔 [WhatsAppSocket] Suscribiendo a eventos de instancia: ${instId}`);

    const handleConnectionStatus = (data: { connected: boolean }) => {
      console.log(`📡 [WhatsAppSocket] connection_status_${instId}:`, data);
      const currentEvents = eventsRef.current;
      if (data.connected && currentEvents?.onConnected) {
        currentEvents.onConnected({ instanceId: instId, timestamp: new Date() });
      } else if (!data.connected && currentEvents?.onDisconnected) {
        currentEvents.onDisconnected({ instanceId: instId });
      }
    };

    const handleQRCode = (qrCode: string | null) => {
      console.log(`📡 [WhatsAppSocket] qr_code_${instId}:`, qrCode ? 'QR recibido' : 'QR limpiado');
      const currentEvents = eventsRef.current;
      if (qrCode && currentEvents?.onQRCode) {
        currentEvents.onQRCode({ instanceId: instId, qrCode });
      } else if (!qrCode && currentEvents?.onQRCleared) {
        currentEvents.onQRCleared(instId);
      }
    };

    const handleNewMessage = (data: any) => {
      const currentEvents = eventsRef.current;
      if (currentEvents?.onNewMessage) {
        currentEvents.onNewMessage(data);
      }
    };

    globalSocket.on(`connection_status_${instId}`, handleConnectionStatus);
    globalSocket.on(`qr_code_${instId}`, handleQRCode);
    globalSocket.on(`new_message_${instId}`, handleNewMessage);
  }, []);

  const unsubscribeFromInstance = useCallback((instId: string) => {
    if (!instId || !globalSocket) return;

    subscribedInstancesRef.current.delete(instId);
    console.log(`🔕 [WhatsAppSocket] Desuscribiendo de eventos de instancia: ${instId}`);

    globalSocket.off(`connection_status_${instId}`);
    globalSocket.off(`qr_code_${instId}`);
    globalSocket.off(`new_message_${instId}`);
  }, []);

  // Auto-conectar una sola vez
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    // NO desconectar en cleanup - el socket es global
  }, [autoConnect, connect]);

  // Suscribirse a instancia específica
  useEffect(() => {
    if (instanceId && isConnected) {
      subscribeToInstance(instanceId);
      return () => {
        unsubscribeFromInstance(instanceId);
      };
    }
  }, [instanceId, isConnected, subscribeToInstance, unsubscribeFromInstance]);

  // Sincronizar estado con el socket global
  useEffect(() => {
    const checkConnection = () => {
      if (globalSocket?.connected !== isConnected) {
        setIsConnected(globalSocket?.connected ?? false);
      }
    };
    
    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  return {
    isConnected,
    socket: globalSocket,
    connect,
    disconnect,
    subscribeToInstance,
    unsubscribeFromInstance,
  };
}

export default useWhatsAppSocket;
