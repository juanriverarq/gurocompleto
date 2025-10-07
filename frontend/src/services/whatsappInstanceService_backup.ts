/**
 * Servicio para gestionar instancias de WhatsApp con el backend Laravel
 */
import { auth } from '../config/firebase';

// Configuración base de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

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
  broker_id: number;
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

  // Usar la misma función de autenticación que campaignService (QUE SÍ FUNCIONA)
  private async getAuthToken(): Promise<string | null> {
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
      console.log(
        '🔍 [INSTANCE DEBUG] Token preview:',
        token ? token.substring(0, 50) + '...' : 'null',
      );

      return token;
    } catch (error) {
      console.error('❌ [INSTANCE DEBUG] Error getting auth token:', error);
      return null;
    }
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.getAuthToken();

    if (!token) {
      console.error('❌ [INSTANCE DEBUG] No se pudo obtener token de autenticación');
      throw new Error('No se pudo obtener token de autenticación');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        // Token expirado o inválido
        localStorage.removeItem('saas_token');
        window.location.href = '/login';
        throw new Error('Sesión expirada');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Obtener todas las instancias del broker actual
   */
  async getInstances(): Promise<{ success: boolean; data: WhatsAppInstance[]; message?: string }> {
    try {
      // USAR RUTA TEMPORAL PARA TESTING (sin autenticación)
      const testUrl = `${API_BASE_URL}/test/whatsapp-instances`;
      console.log('🧪 [TESTING] Obteniendo instancias desde ruta temporal:', testUrl);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📊 Response status para GET:', response.status);
      console.log('📊 Response ok para GET:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response text para GET:', errorText);

        return {
          success: false,
          data: [],
          message: `Error HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      console.log('📋 Instancias obtenidas:', result);

      // El controlador devuelve directamente el array de instancias
      return {
        success: true,
        data: Array.isArray(result) ? result : [],
      };
    } catch (error: any) {
      console.error('❌ Error fetching WhatsApp instances:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Error al obtener las instancias',
      };
    }
  }

  /**
   * Crear nueva instancia de WhatsApp
   */
  async createInstance(
    data: CreateInstanceRequest,
  ): Promise<{ success: boolean; instance?: WhatsAppInstance; message?: string }> {
    try {
      // USAR RUTA TEMPORAL PARA TESTING (sin autenticación)
      const testUrl = `${API_BASE_URL}/test/whatsapp-instances`;
      console.log('🧪 [TESTING] Usando ruta temporal SIN auth:', testUrl);
      console.log('📦 Datos enviados:', data);

      // Para la ruta temporal, solo necesitamos Content-Type
      const headers = {
        'Content-Type': 'application/json',
      };
      console.log('🔐 Headers (sin auth):', headers);

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response text:', errorText);

        return {
          success: false,
          message: `Error HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      console.log('📊 Resultado parseado:', result);

      // El controlador Laravel devuelve directamente la instancia, no en {success, data}
      return {
        success: true,
        instance: result, // La respuesta ES la instancia directamente
      };
    } catch (error: any) {
      console.error('❌ Error creating WhatsApp instance:', error);
      return {
        success: false,
        message: error.message || 'Error al crear la instancia',
      };
    }
  }

  /**
   * Obtener instancia específica
   */
  async getInstance(
    id: number,
  ): Promise<{ success: boolean; data?: WhatsAppInstance; message?: string }> {
    try {
      const response = await saasApi.get(`${this.baseUrl}/${id}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('Error fetching WhatsApp instance:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener la instancia',
      };
    }
  }

  /**
   * Actualizar instancia
   */
  async updateInstance(
    id: number,
    data: Partial<CreateInstanceRequest>,
  ): Promise<{ success: boolean; data?: WhatsAppInstance; message?: string }> {
    try {
      const response = await saasApi.put(`${this.baseUrl}/${id}`, data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('Error updating WhatsApp instance:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar la instancia',
      };
    }
  }

  /**
   * Eliminar instancia
   */
  async deleteInstance(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      await saasApi.delete(`${this.baseUrl}/${id}`);
      return {
        success: true,
        message: 'Instancia eliminada correctamente',
      };
    } catch (error: any) {
      console.error('Error deleting WhatsApp instance:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar la instancia',
      };
    }
  }

  /**
   * Obtener código QR para autenticación
   */
  async getQRCode(id: number): Promise<QRCodeResponse> {
    try {
      // USAR RUTA TEMPORAL PARA TESTING (sin autenticación)
      const testUrl = `${API_BASE_URL}/test/whatsapp-instances/${id}/qr`;
      console.log('🧪 [TESTING] Obteniendo QR desde ruta temporal:', testUrl);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📊 Response status para QR:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response text para QR:', errorText);

        return {
          success: false,
          message: `Error HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      console.log('🔲 QR obtenido:', result);

      // Si el microservicio indica que la instancia ya está conectada
      if (result.success === false) {
        return {
          success: false,
          message: result.message || 'La instancia ya está conectada',
          error: result.error,
        };
      }

      // Si hay QR disponible
      if (result.qr) {
        return {
          success: true,
          qr: result.qr,
          expires_at: result.expires_at,
        };
      }

      // Si no hay QR pero la respuesta fue exitosa
      return {
        success: false,
        message: 'No se pudo obtener el código QR',
      };
    } catch (error: any) {
      console.error('❌ Error getting QR code:', error);
      return {
        success: false,
        message: error.message || 'Error al obtener el código QR',
      };
    }
  }

  /**
   * Obtener estado de conexión de una instancia
   */
  async getStatus(id: number): Promise<InstanceStatusResponse> {
    try {
      // USAR RUTA TEMPORAL PARA TESTING (sin autenticación)
      const testUrl = `${API_BASE_URL}/test/whatsapp-instances/${id}/status`;
      console.log('🧪 [TESTING] Obteniendo status desde ruta temporal:', testUrl);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📊 Response status para STATUS:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response text para STATUS:', errorText);

        return {
          success: false,
          status: 'error',
          message: `Error HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      console.log('🔍 Status obtenido:', result);

      return {
        success: true,
        status: result.status,
        data: result,
      };
    } catch (error: any) {
      console.error('❌ Error getting instance status:', error);
      return {
        success: false,
        status: 'error',
        message: error.message || 'Error al obtener el estado',
      };
    }
  }

  /**
   * Reiniciar instancia de WhatsApp
   */
  async restartInstance(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await saasApi.post(`${this.baseUrl}/${id}/restart`);
      return {
        success: true,
        message: response.data.message || 'Instancia reiniciada correctamente',
      };
    } catch (error: any) {
      console.error('Error restarting instance:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al reiniciar la instancia',
      };
    }
  }

  /**
   * Desconectar instancia de WhatsApp
   */
  async disconnectInstance(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await saasApi.post(`${this.baseUrl}/${id}/disconnect`);
      return {
        success: true,
        message: response.data.message || 'Instancia desconectada correctamente',
      };
    } catch (error: any) {
      console.error('Error disconnecting instance:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al desconectar la instancia',
      };
    }
  }

  /**
   * Obtener estadísticas de instancias
   */
  async getInstancesStats(): Promise<{
    success: boolean;
    data?: {
      total_instances: number;
      connected_instances: number;
      connecting_instances: number;
      disconnected_instances: number;
      error_instances: number;
    };
    message?: string;
  }> {
    try {
      const instances = await this.getInstances();

      if (!instances.success) {
        return instances;
      }

      const stats = {
        total_instances: instances.data.length,
        connected_instances: instances.data.filter(
          (i) => i.status === 'connected' || i.status === 'authenticated',
        ).length,
        connecting_instances: instances.data.filter(
          (i) => i.status === 'connecting' || i.status === 'qr_pending',
        ).length,
        disconnected_instances: instances.data.filter((i) => i.status === 'disconnected').length,
        error_instances: instances.data.filter((i) => i.status === 'error').length,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      console.error('Error getting instances stats:', error);
      return {
        success: false,
        message: 'Error al obtener estadísticas',
      };
    }
  }

  /**
   * Obtener badge de estado con color apropiado
   */
  getStatusBadge(status: string): { variant: string; text: string; color: string } {
    switch (status) {
      case 'connected':
      case 'authenticated':
        return { variant: 'default', text: 'Conectado', color: 'green' };
      case 'connecting':
        return { variant: 'secondary', text: 'Conectando', color: 'blue' };
      case 'qr_pending':
        return { variant: 'outline', text: 'Esperando QR', color: 'orange' };
      case 'disconnected':
        return { variant: 'secondary', text: 'Desconectado', color: 'gray' };
      case 'error':
        return { variant: 'destructive', text: 'Error', color: 'red' };
      default:
        return { variant: 'outline', text: 'Desconocido', color: 'gray' };
    }
  }

  /**
   * Formatear fecha de última actividad
   */
  formatLastActivity(date?: string): string {
    if (!date) return 'Nunca';

    const now = new Date();
    const activityDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Hace un momento';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} minutos`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours} horas`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays} días`;
  }
}

// Exportar instancia única del servicio
const whatsappInstanceService = new WhatsAppInstanceService();
export default whatsappInstanceService;
