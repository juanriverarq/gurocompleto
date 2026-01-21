import { auth } from '../config/firebase';

// Tipos para las plantillas de campañas
export interface CampaignTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  category_name: string;
  description?: string;
  variables: Record<string, string>;
  variables_list: string[];
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  usage_count: number;
}

export interface CreateTemplateRequest {
  name: string;
  content: string;
  category: string;
  description?: string;
  variables?: Record<string, string>;
  is_active?: boolean;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// Configuración de la API
import { API_BASE_URL } from '../config/apiUrl';

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
      Accept: 'application/json',
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
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
}

// Servicio de plantillas de campañas
export const campaignTemplateService = {
  // Obtener todas las plantillas
  async getTemplates(
    filters: {
      category?: string;
      search?: string;
      active?: boolean;
    } = {},
  ): Promise<ApiResponse<CampaignTemplate[]>> {
    try {
      const queryParams = new URLSearchParams();

      if (filters.category) queryParams.append('category', filters.category);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.active !== undefined) queryParams.append('active', filters.active.toString());

      const endpoint = `/saas/campaign-templates?${queryParams.toString()}`;
      const response = await makeRequest<CampaignTemplate[]>(endpoint);

      return response;
    } catch (error) {
      console.error('Error loading campaign templates:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
        data: [],
      };
    }
  },

  // Obtener una plantilla específica
  async getTemplate(id: string): Promise<ApiResponse<CampaignTemplate>> {
    try {
      const endpoint = `/saas/campaign-templates/${id}`;
      const response = await makeRequest<CampaignTemplate>(endpoint);
      return response;
    } catch (error) {
      console.error('Error loading campaign template:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  // Crear una nueva plantilla
  async createTemplate(template: CreateTemplateRequest): Promise<ApiResponse<CampaignTemplate>> {
    try {
      const endpoint = '/saas/campaign-templates';
      const response = await makeRequest<CampaignTemplate>(endpoint, {
        method: 'POST',
        body: JSON.stringify(template),
      });

      return response;
    } catch (error) {
      console.error('Error creating campaign template:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  // Actualizar una plantilla
  async updateTemplate(
    id: string,
    template: UpdateTemplateRequest,
  ): Promise<ApiResponse<CampaignTemplate>> {
    try {
      const endpoint = `/saas/campaign-templates/${id}`;
      const response = await makeRequest<CampaignTemplate>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(template),
      });

      return response;
    } catch (error) {
      console.error('Error updating campaign template:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  // Eliminar una plantilla
  async deleteTemplate(id: string): Promise<ApiResponse<void>> {
    try {
      const endpoint = `/saas/campaign-templates/${id}`;
      const response = await makeRequest<void>(endpoint, {
        method: 'DELETE',
      });

      return response;
    } catch (error) {
      console.error('Error deleting campaign template:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  // Duplicar una plantilla
  async duplicateTemplate(id: string): Promise<ApiResponse<CampaignTemplate>> {
    try {
      const endpoint = `/saas/campaign-templates/${id}/duplicate`;
      const response = await makeRequest<CampaignTemplate>(endpoint, {
        method: 'POST',
      });

      return response;
    } catch (error) {
      console.error('Error duplicating campaign template:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  // Obtener categorías disponibles
  async getCategories(): Promise<ApiResponse<Record<string, string>>> {
    try {
      const endpoint = '/saas/campaign-templates/categories';
      const response = await makeRequest<Record<string, string>>(endpoint);
      return response;
    } catch (error) {
      console.error('Error loading template categories:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  // Previsualizar plantilla con datos de ejemplo
  async previewTemplate(id: string): Promise<
    ApiResponse<{
      template: CampaignTemplate;
      preview_content: string;
      sample_data: Record<string, string>;
    }>
  > {
    try {
      const endpoint = `/saas/campaign-templates/${id}/preview`;
      const response = await makeRequest<{
        template: CampaignTemplate;
        preview_content: string;
        sample_data: Record<string, string>;
      }>(endpoint, {
        method: 'POST',
      });

      return response;
    } catch (error) {
      console.error('Error previewing campaign template:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  // Reemplazar variables en el contenido de la plantilla
  replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  },

  // Extraer variables del contenido de la plantilla
  extractVariables(content: string): string[] {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];

    return [...new Set(matches.map((match) => match.slice(2, -2)))];
  },

  // Validar que todas las variables del contenido estén definidas
  validateTemplate(content: string, variables: Record<string, string>): boolean {
    const contentVars = this.extractVariables(content);
    const definedVars = Object.keys(variables);

    return contentVars.every((varName) => definedVars.includes(varName));
  },
};
