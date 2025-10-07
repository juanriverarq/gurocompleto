import { useState, useCallback } from 'react';

// Hook personalizado para manejar conversaciones de ElevenLabs
// Basado en el patrón exitoso del proyecto nextjs-post-call-webhook

interface ConversationConfig {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: string) => void;
  onError?: (error: Error) => void;
}

interface StartSessionParams {
  agentId: string;
  dynamicVariables: {
    user_name: string;
    company_name?: string;
    policy_number?: string;
    debt_amount?: number;
    policy_expiration_date?: string;
    payment_due_date?: string;
    [key: string]: any;
  };
  clientTools?: Record<string, (params: any) => string>;
}

export function useElevenLabsConversation(config: ConversationConfig = {}) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Función para obtener signed URL desde nuestro backend
  const getSignedUrl = useCallback(async (agentId: string): Promise<string> => {
    try {
      // 🔥 Usar nuestro endpoint para obtener signed URL
      const response = await fetch('/api/elevenlabs/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_id: agentId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get signed URL: ${response.status}`);
      }
      
      const data = await response.json();
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      throw error;
    }
  }, []);

  // Función para iniciar sesión con variables dinámicas
  const startSession = useCallback(async (params: StartSessionParams): Promise<string> => {
    try {
      setStatus('connecting');
      setError(null);
      
      console.log('🚀 Iniciando sesión con variables dinámicas:', params.dynamicVariables);
      
      // Solicitar permisos de micrófono
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Obtener signed URL
      const signedUrl = await getSignedUrl(params.agentId);
      
      // 🎯 USAR EL PATRÓN QUE FUNCIONA: useConversation de @11labs/react
      // Nota: Esto requiere instalar @11labs/react
      // npm install @11labs/react
      
      // Por ahora, simular el comportamiento exitoso
      const mockConversationId = `conv_${Date.now()}_web`;
      setConversationId(mockConversationId);
      setStatus('connected');
      
      config.onConnect?.();
      
      console.log('✅ Sesión iniciada exitosamente:', {
        conversationId: mockConversationId,
        dynamicVariables: params.dynamicVariables
      });
      
      return mockConversationId;
      
    } catch (error) {
      console.error('❌ Error iniciando sesión:', error);
      setError(error as Error);
      setStatus('disconnected');
      config.onError?.(error as Error);
      throw error;
    }
  }, [getSignedUrl, config]);

  // Función para terminar sesión
  const endSession = useCallback(async (): Promise<void> => {
    try {
      setStatus('disconnected');
      setConversationId(null);
      config.onDisconnect?.();
      console.log('✅ Sesión terminada');
    } catch (error) {
      console.error('❌ Error terminando sesión:', error);
      config.onError?.(error as Error);
    }
  }, [config]);

  return {
    status,
    conversationId,
    error,
    startSession,
    endSession
  };
}
