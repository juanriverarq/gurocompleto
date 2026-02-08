import api from '../config/api';

export interface WhatsAppConversation {
  id: number;
  phone: string;
  contact_name: string;
  contact_push_name: string;
  subject: string;
  status: string;
  priority: string;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  assigned_to: number | null;
  department_id: number | null;
  department?: {
    id: number;
    name: string;
    color: string;
  };
  assigned_agent?: {
    id: number;
    name: string;
  };
  messages_count: number;
  lastMessage?: {
    id: number;
    content: string;
    body?: string;
    message_type: string;
    direction: string;
    created_at: string;
  };
  last_message?: {
    id: number;
    content: string;
    body?: string;
    message_type: string;
    direction: string;
    created_at: string;
  };
  latest_message?: {
    id: number;
    content: string;
    body?: string;
    message_type: string;
    direction: string;
    created_at: string;
  };
}

export interface WhatsAppMessage {
  id: number;
  conversation_id: number;
  message_id: string;
  from_me: boolean;
  type: string;
  body: string;
  media_url: string | null;
  media_type: string | null;
  status: string;
  created_at: string;
  sender?: {
    id: number;
    name: string;
  };
}

export interface ConversationsResponse {
  data: WhatsAppConversation[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface MessagesResponse {
  data: WhatsAppMessage[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export const getConversations = async (params: {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
} = {}): Promise<ConversationsResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params.status) queryParams.append('status', params.status);
  if (params.search) queryParams.append('search', params.search);
  
  const response = await api.get(`/saas/whatsapp-inbox/conversations?${queryParams.toString()}`);
  return response.data;
};

export const getConversationMessages = async (
  conversationId: number, 
  params: { page?: number; per_page?: number } = {}
): Promise<MessagesResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  
  const response = await api.get(`/saas/whatsapp-inbox/conversations/${conversationId}/messages?${queryParams.toString()}`);
  return response.data;
};

export const sendMessage = async (conversationId: number, message: string) => {
  const response = await api.post(`/saas/whatsapp-inbox/conversations/${conversationId}/messages`, { message });
  return response.data;
};

export const sendMediaMessage = async (
  conversationId: number, 
  uri: string, 
  messageType: 'image' | 'audio' | 'document',
  filename?: string
) => {
  const formData = new FormData();
  
  const uriParts = uri.split('.');
  const fileExtension = uriParts[uriParts.length - 1];
  
  let mimeType = 'application/octet-stream';
  if (messageType === 'image') {
    mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
  } else if (messageType === 'audio') {
    mimeType = `audio/${fileExtension === 'm4a' ? 'mp4' : fileExtension}`;
  } else if (messageType === 'document') {
    mimeType = 'application/octet-stream';
  }

  formData.append('file', {
    uri,
    name: filename || `file_${Date.now()}.${fileExtension}`,
    type: mimeType,
  } as any);
  formData.append('message_type', messageType);
  if (filename) {
    formData.append('caption', filename);
  }

  const response = await api.post(
    `/saas/whatsapp-inbox/conversations/${conversationId}/media`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};
