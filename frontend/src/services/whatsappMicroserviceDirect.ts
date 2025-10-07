/**
 * Servicio directo para conectar con el microservicio de WhatsApp
 * Este servicio se conecta directamente al microservicio en localhost:3000
 */

const MICROSERVICE_URL = 'http://localhost:3000/api/v1';

export interface WhatsAppConnectionStatus {
  success: boolean;
  connected: boolean;
  connecting?: boolean;
  qrCode?: string;
  message?: string;
}

export interface QRCodeResponse {
  success: boolean;
  qr?: string;
  message?: string;
}

class WhatsAppMicroserviceDirect {
  private baseUrl: string;

  constructor() {
    this.baseUrl = MICROSERVICE_URL;
  }

  /**
   * Realizar petición HTTP al microservicio
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      console.log(`🔄 Haciendo petición a: ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Respuesta del microservicio:', result);
      return result;
    } catch (error) {
      console.error('❌ Error conectando con microservicio:', error);
      throw new Error(`Error de conexión con microservicio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtener estado de conexión de WhatsApp
   */
  async getConnectionStatus(): Promise<WhatsAppConnectionStatus> {
    try {
      const response = await this.makeRequest('GET', '/whatsapp/status');
      return response;
    } catch (error) {
      return {
        success: false,
        connected: false,
        message: 'Error al conectar con el microservicio'
      };
    }
  }

  /**
   * Obtener código QR para autenticación
   */
  async getQRCode(): Promise<QRCodeResponse> {
    try {
      const response = await this.makeRequest('GET', '/whatsapp/qr');
      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener código QR'
      };
    }
  }

  /**
   * Desconectar WhatsApp
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest('POST', '/whatsapp/disconnect');
      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Error al desconectar'
      };
    }
  }

  /**
   * Reconectar WhatsApp
   */
  async reconnect(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest('POST', '/whatsapp/reconnect');
      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Error al reconectar'
      };
    }
  }

  /**
   * Reset completo de conexión
   */
  async resetConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest('POST', '/whatsapp/reset');
      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Error al resetear conexión'
      };
    }
  }

  /**
   * Obtener estadísticas del servicio
   */
  async getStats(): Promise<any> {
    try {
      const response = await this.makeRequest('GET', '/whatsapp/stats');
      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener estadísticas'
      };
    }
  }

  /**
   * Enviar mensaje
   */
  async sendMessage(phone: string, message: string): Promise<{ success: boolean; message?: string; messageId?: string }> {
    try {
      const response = await this.makeRequest('POST', '/messages/send', { phone, message });
      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Error al enviar mensaje'
      };
    }
  }

  /**
   * Obtener contactos
   */
  async getContacts(): Promise<{ success: boolean; contacts?: any[] }> {
    try {
      const response = await this.makeRequest('GET', '/contacts');
      return response;
    } catch (error) {
      return {
        success: false,
        contacts: []
      };
    }
  }

  /**
   * Obtener mensajes
   */
  async getMessages(filters?: any): Promise<{ success: boolean; messages?: any[] }> {
    try {
      let endpoint = '/messages';
      if (filters) {
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
        if (queryParams.toString()) {
          endpoint += `?${queryParams.toString()}`;
        }
      }
      
      const response = await this.makeRequest('GET', endpoint);
      return response;
    } catch (error) {
      return {
        success: false,
        messages: []
      };
    }
  }

  /**
   * Verificar si el microservicio está disponible
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:3000/health');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtener información de salud del servicio
   */
  async getHealthCheck(): Promise<any> {
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        return await response.json();
      }
      return { status: 'error', message: 'Servicio no disponible' };
    } catch (error) {
      return { status: 'error', message: 'Error de conexión' };
    }
  }
}

// Crear instancia única del servicio
const whatsappMicroserviceDirect = new WhatsAppMicroserviceDirect();
export default whatsappMicroserviceDirect;
