/**
 * Servicio básico para WhatsApp usando whatsapp-web.js
 * Conecta con el backend para controlar el bot de WhatsApp
 */

const API_BASE_URL = `${
  import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
}/saas/whatsapp-basic`;

export interface WhatsAppStatus {
  success: boolean;
  isRunning: boolean;
  status: 'running' | 'stopped' | 'initializing';
  message: string;
}

export interface WhatsAppQR {
  success: boolean;
  hasQR: boolean;
  qrCodeBase64: string | null;
  status: string;
  isReady: boolean;
}

export interface WhatsAppInfo {
  success: boolean;
  system: {
    node_version: string;
    npm_version: string;
    service_path: string;
    service_exists: boolean;
  };
  features: {
    auto_response: boolean;
    qr_generation: boolean;
    basic_commands: string[];
  };
}

export interface WhatsAppLogs {
  success: boolean;
  logs: string[];
  count: number;
}

class WhatsAppBasicService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Realizar petición HTTP
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(
        `Error de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
    }
  }

  /**
   * Inicializar el servicio de WhatsApp
   */
  async initialize(): Promise<{ success: boolean; message: string; status: string }> {
    return this.makeRequest('POST', '/initialize');
  }

  /**
   * Obtener estado del servicio
   */
  async getStatus(): Promise<WhatsAppStatus> {
    return this.makeRequest('GET', '/status');
  }

  /**
   * Detener el servicio
   */
  async stop(): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', '/stop');
  }

  /**
   * Reiniciar el servicio
   */
  async restart(): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', '/restart');
  }

  /**
   * Obtener información del sistema
   */
  async getInfo(): Promise<WhatsAppInfo> {
    return this.makeRequest('GET', '/info');
  }

  /**
   * Limpiar autenticación (forzar nuevo QR)
   */
  async clearAuth(): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', '/clear-auth');
  }

  /**
   * Obtener logs recientes
   */
  async getLogs(): Promise<WhatsAppLogs> {
    return this.makeRequest('GET', '/logs');
  }

  /**
   * Obtener QR Code en tiempo real
   */
  async getQR(): Promise<WhatsAppQR> {
    return this.makeRequest('GET', '/qr');
  }

  /**
   * Verificar si el servicio está corriendo (método de utilidad)
   */
  async isServiceRunning(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.success && status.isRunning;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtener estado completo del servicio (método combinado)
   */
  async getFullStatus(): Promise<{
    isRunning: boolean;
    status: WhatsAppStatus;
    info: WhatsAppInfo | null;
    logs: WhatsAppLogs | null;
    qr: WhatsAppQR | null;
  }> {
    try {
      const [status, info, logs, qr] = await Promise.all([
        this.getStatus(),
        this.getInfo().catch(() => null),
        this.getLogs().catch(() => null),
        this.getQR().catch(() => null),
      ]);

      return {
        isRunning: status.success && status.isRunning,
        status,
        info,
        logs,
        qr,
      };
    } catch (error) {
      return {
        isRunning: false,
        status: {
          success: false,
          isRunning: false,
          status: 'stopped',
          message: 'Error de conexión',
        },
        info: null,
        logs: null,
        qr: null,
      };
    }
  }
}

// Crear instancia única del servicio
const whatsappBasicService = new WhatsAppBasicService();

export default whatsappBasicService;
