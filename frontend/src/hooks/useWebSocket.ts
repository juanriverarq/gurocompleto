import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from 'src/hooks/use-toast';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  reconnectAttempts: number;
}

export const useWebSocket = (config: WebSocketConfig) => {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlersRef = useRef<Map<string, (data: any) => void>>(new Map());

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    reconnectAttempts: 0
  });

  const {
    url,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000
  } = config;

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('🔌 WebSocket conectado');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
          reconnectAttempts: 0
        }));
        startHeartbeat();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Ignorar pongs del heartbeat
          if (message.type === 'pong') {
            return;
          }

          setState(prev => ({ ...prev, lastMessage: message }));

          // Ejecutar handlers específicos por tipo de mensaje
          const handler = messageHandlersRef.current.get(message.type);
          if (handler) {
            handler(message.data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket desconectado:', event.code, event.reason);
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }));
        cleanup();

        // Intentar reconectar si no fue un cierre intencional
        if (event.code !== 1000 && state.reconnectAttempts < maxReconnectAttempts) {
          setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 Reintentando conexión WebSocket (${state.reconnectAttempts + 1}/${maxReconnectAttempts})`);
            connect();
          }, reconnectInterval);
        } else if (state.reconnectAttempts >= maxReconnectAttempts) {
          setState(prev => ({
            ...prev,
            error: 'Máximo número de intentos de reconexión alcanzado'
          }));
          toast({
            title: "Conexión perdida",
            description: "No se pudo restablecer la conexión en tiempo real. Las métricas pueden no estar actualizadas.",
            variant: "destructive"
          });
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ Error en WebSocket:', error);
        setState(prev => ({
          ...prev,
          error: 'Error de conexión WebSocket',
          isConnecting: false
        }));
      };

    } catch (error) {
      console.error('❌ Error creando WebSocket:', error);
      setState(prev => ({
        ...prev,
        error: 'Error al crear conexión WebSocket',
        isConnecting: false
      }));
    }
  }, [url, state.reconnectAttempts, maxReconnectAttempts, reconnectInterval, startHeartbeat, cleanup, toast]);

  const disconnect = useCallback(() => {
    cleanup();
    if (wsRef.current) {
      wsRef.current.close(1000, 'Desconexión intencional');
      wsRef.current = null;
    }
    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      lastMessage: null,
      reconnectAttempts: 0
    });
  }, [cleanup]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('⚠️ WebSocket no está conectado, no se puede enviar mensaje');
    return false;
  }, []);

  const subscribe = useCallback((messageType: string, handler: (data: any) => void) => {
    messageHandlersRef.current.set(messageType, handler);
    
    // Retornar función de cleanup
    return () => {
      messageHandlersRef.current.delete(messageType);
    };
  }, []);

  // Auto-conectar al montar el hook
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [url]); // Solo reconectar si cambia la URL

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [cleanup]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    subscribe
  };
};

export default useWebSocket;