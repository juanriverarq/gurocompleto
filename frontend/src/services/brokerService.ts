import { toast } from 'src/hooks/use-toast';
import { auth } from '../config/firebase';

// Tipos para los brokers
export interface Broker {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

// Configuración de la API
import { API_BASE_URL } from '../config/apiUrl';

// Usar las nuevas rutas SaaS
const API_PREFIX = '/saas/brokers';

// Helper para obtener el token de autenticación Firebase
const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    return null;
  }
};

// Helper para hacer peticiones HTTP con autenticación
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken();
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));

      if (errorData.errors) {
        const firstError = Object.values(errorData.errors)[0];
        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
        throw new Error(errorMessage || errorData.message || `HTTP ${response.status}`);
      }

      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
}

// Servicio de brokers
export const brokerService = {
  async getBrokers(): Promise<ApiResponse<Broker[]>> {
    try {
      const endpoint = `${API_PREFIX}`;
      const response = await makeRequest<Broker[]>(endpoint);
      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar brokers',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  async createBroker(
    broker: Omit<Broker, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<ApiResponse<Broker>> {
    try {
      const endpoint = `${API_PREFIX}`;
      const response = await makeRequest<Broker>(endpoint, {
        method: 'POST',
        body: JSON.stringify(broker),
      });

      toast({
        variant: 'success',
        title: 'Broker creado',
        description: 'El broker se ha creado exitosamente.',
      });

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al crear broker',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  async getActiveBroker(): Promise<ApiResponse<Broker>> {
    try {
      const endpoint = `${API_PREFIX}/active`;
      const response = await makeRequest<Broker>(endpoint);
      return response;
    } catch (error) {
      // No mostrar toast para este error ya que es común cuando no hay broker activo
      throw error;
    }
  },

  async checkBrokerStatus(): Promise<{ hasActiveBroker: boolean; broker?: Broker }> {
    try {
      const response = await this.getActiveBroker();
      return {
        hasActiveBroker: response.success && !!response.data,
        broker: response.data,
      };
    } catch (error) {
      return {
        hasActiveBroker: false,
      };
    }
  },
};
