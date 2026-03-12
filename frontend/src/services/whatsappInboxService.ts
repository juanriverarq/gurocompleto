import { auth } from '../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
};

// Interfaces
export interface WhatsAppDepartment {
  id: number;
  broker_id: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  is_active: boolean;
  priority: number;
  auto_assign_rules: Record<string, any> | null;
  active_conversations?: number;
  members_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConversation {
  id: number;
  broker_id: number;
  whatsapp_instance_id: number;
  department_id: number | null;
  assigned_to: number | null;
  client_id: number | null;
  phone: string;
  contact_name: string | null;
  contact_push_name: string | null;
  // Campos de contacto capturados por chatbot
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_document_id: string | null;
  contact_email: string | null;
  contact_phone_secondary: string | null;
  contact_company: string | null;
  contact_city: string | null;
  contact_notes: string | null;
  contact_custom_fields: Record<string, any> | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string | null;
  classification_reason: string | null;
  first_message_at: string | null;
  last_message_at: string | null;
  assigned_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  unread_count: number;
  message_count: number;
  metadata: Record<string, any> | null;
  tags: string[] | null;
  department?: WhatsAppDepartment;
  assigned_agent?: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
  };
  instance?: {
    id: number;
    instance_id: string;
    status: string;
  };
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: number;
  conversation_id: number;
  message_id: string | null;
  direction: 'incoming' | 'outgoing';
  sender_type: 'client' | 'agent' | 'bot' | 'system';
  sender_user_id: number | null;
  message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker' | 'interactive' | 'template';
  content: string | null;
  media: Record<string, any> | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  read_at: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sender?: {
    id: number;
    name: string;
    avatar?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface WhatsAppQuickReply {
  id: number;
  broker_id: number;
  department_id: number | null;
  shortcut: string;
  title: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  is_active: boolean;
  usage_count: number;
}

export interface InboxStats {
  total_conversations: number;
  pending: number;
  in_progress: number;
  resolved_today: number;
  unassigned: number;
  my_conversations: number;
  my_unread: number;
}

export interface ConversationFilters {
  status?: string;
  department_id?: number;
  assigned_to?: string | number;
  priority?: string;
  tag?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface WhatsAppTag {
  id: number;
  broker_id: number;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

class WhatsAppInboxService {
  private async makeRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await getAuthToken();
    
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

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error || responseData.message || 'Error en la solicitud');
    }

    return responseData;
  }

  // ==========================================
  // ESTADÍSTICAS
  // ==========================================

  async getStats(): Promise<InboxStats> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/stats');
    return response.stats;
  }

  // ==========================================
  // DEPARTAMENTOS
  // ==========================================

  async getDepartments(): Promise<WhatsAppDepartment[]> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/departments');
    return response.departments;
  }

  async createDepartment(data: Partial<WhatsAppDepartment>): Promise<WhatsAppDepartment> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/departments', 'POST', data);
    return response.department;
  }

  async updateDepartment(id: number, data: Partial<WhatsAppDepartment>): Promise<WhatsAppDepartment> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/departments/${id}`, 'PUT', data);
    return response.department;
  }

  async deleteDepartment(id: number): Promise<void> {
    await this.makeRequest(`/saas/whatsapp-inbox/departments/${id}`, 'DELETE');
  }

  async addMemberToDepartment(departmentId: number, userId: number, options?: { is_supervisor?: boolean; max_concurrent_conversations?: number }): Promise<any> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/departments/${departmentId}/members`, 'POST', {
      user_id: userId,
      ...options,
    });
    return response.member;
  }

  async removeMemberFromDepartment(departmentId: number, userId: number): Promise<void> {
    await this.makeRequest(`/saas/whatsapp-inbox/departments/${departmentId}/members/${userId}`, 'DELETE');
  }

  // ==========================================
  // CONVERSACIONES
  // ==========================================

  async getConversations(filters?: ConversationFilters): Promise<{ data: WhatsAppConversation[]; total: number; current_page: number; last_page: number }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.makeRequest(`/saas/whatsapp-inbox/conversations${query}`);
  }

  async getMyConversations(): Promise<WhatsAppConversation[]> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/conversations/mine');
    return response.conversations;
  }

  async getConversation(id: number): Promise<WhatsAppConversation> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${id}`);
    return response.conversation;
  }

  async updateConversation(id: number, data: Partial<WhatsAppConversation>): Promise<WhatsAppConversation> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${id}`, 'PUT', data);
    return response.conversation;
  }

  async getConversationMessages(conversationId: number, page: number = 1, perPage: number = 50, latest: boolean = true): Promise<{ data: WhatsAppMessage[]; total: number; current_page: number; last_page: number }> {
    return await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/messages?page=${page}&per_page=${perPage}&latest=${latest ? '1' : '0'}`);
  }

  async searchMessages(conversationId: number, query: string, page: number = 1): Promise<{ data: WhatsAppMessage[]; total: number; current_page: number; last_page: number }> {
    return await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/messages/search?q=${encodeURIComponent(query)}&page=${page}`);
  }

  async sendMessage(conversationId: number, message: string, options?: { message_type?: string; media_url?: string }): Promise<WhatsAppMessage> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/messages`, 'POST', {
      message,
      ...options,
    });
    return response.data;
  }

  async sendMediaMessage(conversationId: number, file: File, caption?: string): Promise<WhatsAppMessage> {
    console.log('📤 [sendMediaMessage] Starting', { conversationId, fileName: file.name, fileType: file.type, fileSize: file.size, caption });
    
    const token = await getAuthToken();
    if (!token) {
      console.error('📤 [sendMediaMessage] No auth token');
      throw new Error('No autenticado');
    }

    const formData = new FormData();
    formData.append('file', file);
    if (caption) {
      formData.append('caption', caption);
    }

    // Determinar tipo de mensaje basado en el archivo
    let messageType = 'document';
    if (file.type.startsWith('image/')) {
      messageType = 'image';
    } else if (file.type.startsWith('video/')) {
      messageType = 'video';
    } else if (file.type.startsWith('audio/')) {
      messageType = 'audio';
    }
    formData.append('message_type', messageType);

    const url = `${API_BASE_URL}/saas/whatsapp-inbox/conversations/${conversationId}/media`;
    console.log('📤 [sendMediaMessage] Sending to:', url, 'type:', messageType);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('📤 [sendMediaMessage] Response status:', response.status, 'content-type:', response.headers.get('content-type'));
      
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();
      
      // Si no es JSON, mostrar lo que devolvió el servidor
      if (!contentType.includes('application/json')) {
        console.error('📤 [sendMediaMessage] Server returned non-JSON:', responseText.substring(0, 500));
        throw new Error(`Error del servidor (${response.status}): Respuesta no válida. Intenta de nuevo.`);
      }

      const responseData = JSON.parse(responseText);
      console.log('📤 [sendMediaMessage] Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || 'Error al enviar archivo');
      }

      return responseData.data;
    } catch (err: any) {
      console.error('📤 [sendMediaMessage] Error:', err.message, err);
      throw err;
    }
  }

  async assignConversation(conversationId: number, userId: number, reason?: string): Promise<WhatsAppConversation> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/assign`, 'POST', {
      user_id: userId,
      reason,
    });
    return response.conversation;
  }

  async assignToDepartment(conversationId: number, departmentId: number, autoAssign: boolean = true, reason?: string): Promise<WhatsAppConversation> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/assign-department`, 'POST', {
      department_id: departmentId,
      auto_assign: autoAssign,
      reason,
    });
    return response.conversation;
  }

  async resolveConversation(conversationId: number): Promise<WhatsAppConversation> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/resolve`, 'POST');
    return response.conversation;
  }

  async getNotes(conversationId: number): Promise<any[]> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/notes`);
    return response.notes;
  }

  async addNote(conversationId: number, content: string, isPinned: boolean = false): Promise<any> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/notes`, 'POST', {
      content,
      is_pinned: isPinned,
    });
    return response.note;
  }

  // ==========================================
  // AGENTES
  // ==========================================

  async getClientByPhone(phone: string): Promise<{ client: any; policies: any[] }> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/client-by-phone?phone=${encodeURIComponent(phone)}`);
    return { client: response.client, policies: response.policies };
  }

  async searchClients(query: string): Promise<any[]> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/search-clients?q=${encodeURIComponent(query)}`);
    return response.clients;
  }

  async linkClientPhone(clientId: number, phone: string): Promise<any> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/link-client-phone', 'POST', { client_id: clientId, phone });
    return response;
  }

  async getAgents(): Promise<{ id: number; name: string; email: string; role: string }[]> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/agents');
    return response.agents;
  }

  // ==========================================
  // RESPUESTAS RÁPIDAS
  // ==========================================

  async getQuickReplies(departmentId?: number): Promise<WhatsAppQuickReply[]> {
    const query = departmentId ? `?department_id=${departmentId}` : '';
    const response = await this.makeRequest(`/saas/whatsapp-inbox/quick-replies${query}`);
    return response.quick_replies;
  }

  async createQuickReply(data: Partial<WhatsAppQuickReply>): Promise<WhatsAppQuickReply> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/quick-replies', 'POST', data);
    return response.quick_reply;
  }

  async updateQuickReply(id: number, data: Partial<WhatsAppQuickReply>): Promise<WhatsAppQuickReply> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/quick-replies/${id}`, 'PUT', data);
    return response.quick_reply;
  }

  async deleteQuickReply(id: number): Promise<void> {
    await this.makeRequest(`/saas/whatsapp-inbox/quick-replies/${id}`, 'DELETE');
  }

  // ==========================================
  // ETIQUETAS (TAGS)
  // ==========================================

  async getTags(): Promise<WhatsAppTag[]> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/tags');
    return response.tags;
  }

  async createTag(name: string, color: string = 'blue'): Promise<WhatsAppTag> {
    const response = await this.makeRequest('/saas/whatsapp-inbox/tags', 'POST', { name, color });
    return response.tag;
  }

  async updateTag(tagId: number, data: { name?: string; color?: string }): Promise<WhatsAppTag> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/tags/${tagId}`, 'PUT', data);
    return response.tag;
  }

  async deleteTag(tagId: number): Promise<void> {
    await this.makeRequest(`/saas/whatsapp-inbox/tags/${tagId}`, 'DELETE');
  }

  async addTagToConversation(conversationId: number, tag: string): Promise<string[]> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/tags`, 'POST', { tag });
    return response.tags;
  }

  async removeTagFromConversation(conversationId: number, tag: string): Promise<string[]> {
    const response = await this.makeRequest(`/saas/whatsapp-inbox/conversations/${conversationId}/tags`, 'DELETE', { tag });
    return response.tags;
  }
}

export const whatsappInboxService = new WhatsAppInboxService();
export default whatsappInboxService;
