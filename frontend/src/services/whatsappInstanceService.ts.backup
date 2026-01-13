/**
 * Servicio para gestionar instancias de WhatsApp con el backend Laravel
 * ARREGLADO: Usando la misma lógica de autenticación que campaignService
 */
import { auth } from '../config/firebase';

// Configuración base de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

// Helper para obtener el token de autenticación Firebase (IGUAL QUE CAMPAIGN SERVICE)
const getAuthToken = async (): Promise<string | null> => {
  try {
    console.log('🔍 [INSTANCE DEBUG] Getting Firebase auth token...');
    console.log('🔍 [INSTANCE DEBUG] auth object:', auth);
    
    const user = auth.currentUser;
    console.log('🔍 [INSTANCE DEBUG] Current user:', user);
    
    if (!user) {
      console.log('❌ [INSTANCE DEBUG] No current user found');
      return null;
    }
    
    console.log('✅ [INSTANCE DEBUG] User found, getting ID token...');
    const token = await user.getIdToken();
    console.log('✅ [INSTANCE DEBUG] Token obtained:', token ? 'YES' : 'NO');
    console.log('🔍 [INSTANCE DEBUG] Token preview:', token ? token.substring(0, 50) + '...' : 'null');
    
    return token;
  } catch (error) {
    console.error('❌ [INSTANCE DEBUG] Error getting auth token:', error);
    return null;
  }
};

// Interfaces para las instancias de WhatsApp
export interface WhatsAppInstance {
  id?: number;
  broker_id: number;
  instance_id: string;
  session_id?: string;
  phone_number?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_pending' | 'authenticated' | 'error';
  qr_code?: string;
  qr_expires_at?: string;
  session_data?: any;
  connection_info?: any;
  webhook_url?: string;
  settings?: any;
  last_connected_at?: string;
  last_activity_at?: string;
  error_message?: string;
  reconnect_attempts: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  broker?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateInstanceRequest {
  phone_number?: string;
  webhook_url?: string;
  settings?: any;
  broker_id?: number; // ✅ Opcional - Laravel lo obtiene del Firebase token
}

export interface InstanceStatusResponse {
  success: boolean;
  status: string;
  message?: string;
  data?: any;
}

export interface QRCodeResponse {
  success: boolean;
  qr?: string;
  message?: string;
  expires_at?: string;
}

class WhatsAppInstanceService {
  private baseUrl = `${API_BASE_URL}/saas/whatsapp-instances`;

  /**
   * Realizar petición HTTP a Laravel (USANDO EL MISMO PATRÓN QUE CAMPAIGN SERVICE)
   */
  private async makeRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    console.log('🚀 [INSTANCE DEBUG] makeRequest called with:', { endpoint, method, data });
    
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('🚀 [INSTANCE DEBUG] URL:', url);
    
    console.log('🚀 [INSTANCE DEBUG] About to call getAuthToken...');
    const token = await getAuthToken();
    console.log('🚀 [INSTANCE DEBUG] Token result:', token ? 'GOT TOKEN' : 'NO TOKEN');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const status = response.status;
      const contentType = response.headers.get('content-type') || '';
      console.log('📥 [INSTANCE DEBUG] Response meta:', { status, contentType });

      if (!response.ok) {
        // Leer como texto primero para evitar fallos en JSON vacío
        const errorText = await response.text().catch(() => '');
        let errorData: any = {};
        if (errorText && (contentType.includes('application/json') || errorText.trim().startsWith('{') || errorText.trim().startsWith('['))) {
          try { errorData = JSON.parse(errorText); } catch { /* ignore parse error */ }
        }
        throw new Error(`HTTP error! status: ${status}, message: ${errorData.message || errorText || 'Unknown error'}`);
      }

      // No Content
      if (status === 204) {
        console.log('✅ [INSTANCE DEBUG] 204 No Content: devolviendo { success: true }');
        return { success: true };
      }

      // Leer cuerpo como texto de forma segura
      const text = await response.text();
      if (!text || !text.trim()) {
        console.log('✅ [INSTANCE DEBUG] Cuerpo vacío: devolviendo { success: true }');
        return { success: true };
      }

      // Intentar parsear JSON si corresponde
      if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
        try {
          const json = JSON.parse(text);
          return json;
        } catch (parseErr) {
          console.warn('⚠️ [INSTANCE DEBUG] Falló parseo JSON; retornando texto como message');
          return { success: true, message: text };
        }
      }

      // Contenido no JSON
      return { success: true, message: text };
    } catch (error) {
      console.error('WhatsApp Instance Service Error:', error);
      throw new Error(`Error de conexión con backend: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtener todas las instancias de WhatsApp (FILTRADAS POR BROKER AUTOMÁTICAMENTE)
   */
  async getInstances(): Promise<{ success: boolean; data: WhatsAppInstance[]; message?: string }> {
    try {
      console.log('🔍 [INSTANCE DEBUG] Obteniendo instancias CON autenticación por broker...');
      
      const response = await this.makeRequest('/saas/whatsapp-instances');
      return {
        success: true,
        data: response.data || response || [],
        message: response.message || 'Instancias obtenidas exitosamente'
      };
    } catch (error: any) {
      console.error('❌ Error getting instances:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Error al obtener instancias'
      };
    }
  }

  /**
   * Crear nueva instancia de WhatsApp
   */
  async createInstance(instanceData: CreateInstanceRequest): Promise<{ success: boolean; data?: WhatsAppInstance; message?: string }> {
    try {
      console.log('🔄 [INSTANCE DEBUG] Creando instancia CON autenticación por broker:', instanceData);
      
      const response = await this.makeRequest('/saas/whatsapp-instances', 'POST', instanceData);
      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Instancia creada exitosamente'
      };
    } catch (error: any) {
      console.error('❌ Error creating instance:', error);
      return {
        success: false,
        message: error.message || 'Error al crear instancia'
      };
    }
  }

  /**
   * Obtener estado de una instancia específica
   */
  async getStatus(instanceId: number): Promise<InstanceStatusResponse> {
    try {
      console.log('🔍 [INSTANCE DEBUG] Obteniendo estado CON autenticación por broker:', instanceId);
      
      const response = await this.makeRequest(`/saas/whatsapp-instances/${instanceId}/status`);
      return {
        success: true,
        status: response.status || 'unknown',
        message: response.message || 'Estado obtenido exitosamente',
        data: response.data
      };
    } catch (error: any) {
      console.error('❌ Error getting instance status:', error);
      return {
        success: false,
        status: 'error',
        message: error.message || 'Error al obtener estado de instancia'
      };
    }
  }

  /**
   * Obtener código QR de una instancia
   */
  async getQRCode(instanceId: number): Promise<QRCodeResponse> {
    try {
      const response = await this.makeRequest(`/saas/whatsapp-instances/${instanceId}/qr`);
      return {
        success: true,
        qr: response.qr,
        expires_at: response.expires_at,
        message: response.message || 'QR obtenido exitosamente'
      };
    } catch (error: any) {
      console.error('❌ Error getting QR code:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener código QR'
      };
    }
  }

  /**
   * Eliminar una instancia
   */
  async deleteInstance(instanceId: number): Promise<{ success: boolean; message?: string }> {
    try {
      await this.makeRequest(`/saas/whatsapp-instances/${instanceId}`, 'DELETE');
      return {
        success: true,
        message: 'Instancia eliminada exitosamente'
      };
    } catch (error: any) {
      console.error('❌ Error deleting instance:', error);
      return {
        success: false,
        message: error.message || 'Error al eliminar instancia'
      };
    }
  }
}

// Crear instancia única del servicio
const whatsappInstanceService = new WhatsAppInstanceService();

export default whatsappInstanceService;