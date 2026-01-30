/**
 * Servicio para gestión de Chatbots de WhatsApp
 */

import api from '../config/api';

// ==================== TIPOS ====================

export interface Chatbot {
  id: number;
  broker_id: number;
  instance_id?: string;
  name: string;
  description?: string;
  is_active: boolean;
  welcome_message?: string;
  fallback_message?: string;
  goodbye_message?: string;
  out_of_hours_message?: string;
  ai_enabled: boolean;
  ai_provider: 'openai' | 'claude' | 'none';
  ai_model?: string;
  ai_system_prompt?: string;
  ai_temperature: number;
  ai_max_tokens: number;
  typing_delay_ms: number;
  response_delay_ms: number;
  session_timeout_minutes: number;
  max_fallback_count: number;
  business_hours_enabled: boolean;
  business_hours?: BusinessHours;
  timezone: string;
  created_at: string;
  updated_at: string;
  flows_count?: number;
  triggers_count?: number;
  sessions_count?: number;
  flows?: ChatbotFlow[];
  triggers?: ChatbotTrigger[];
  quick_responses?: ChatbotQuickResponse[];
}

export interface BusinessHours {
  monday?: { start: string; end: string };
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string };
  sunday?: { start: string; end: string };
}

export interface ChatbotFlow {
  id: number;
  chatbot_id: number;
  name: string;
  description?: string;
  is_default: boolean;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  nodes?: ChatbotNode[];
}

export interface ChatbotNode {
  id: number;
  flow_id: number;
  node_type: NodeType;
  name?: string;
  position_x: number;
  position_y: number;
  config: NodeConfig;
  next_node_id?: number;
  created_at: string;
  updated_at: string;
}

export type NodeType = 
  | 'start'
  | 'message'
  | 'options'
  | 'question' // deprecated, usar 'options'
  | 'input'
  | 'condition'
  | 'action'
  | 'ai_response'
  | 'transfer'
  | 'delay'
  | 'end';

export interface NodeConfig {
  // Común
  text?: string;
  
  // Nodo Inicio
  keywords?: string;
  trigger_first_message?: boolean;
  
  // Nodo Mensaje
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document';
  
  // Nodo Opciones (menú interactivo)
  options?: { 
    id: string; 
    text: string; 
    next_node_id?: string;  // ID del nodo al que salta esta opción
    next_flow_id?: number;  // ID del flujo al que salta (opcional)
    confirmation_message?: string;  // Mensaje después de seleccionar
    transfer_to?: {  // Transferir a empleado/departamento
      user_id?: number | null;
      department_id?: number | null;
    };
    transfer_message?: string;  // Mensaje al transferir
  }[];
  
  // Deprecated - usar options
  buttons?: { id: string; text: string; next_node_id?: number }[];
  list_items?: { id: string; title: string; description?: string; next_node_id?: number }[];
  
  // Nodo Entrada
  variable_name?: string;
  variable_value?: string;
  validation?: string;
  error_message?: string;
  contact_field?: 'first_name' | 'last_name' | 'document_id' | 'email' | 'phone_secondary' | 'company' | 'city' | 'notes';  // Campo de contacto a guardar
  
  // Nodo Condición (bifurcación Sí/No)
  variable?: string;
  condition_type?: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'regex';
  condition_value?: string;
  true_node_id?: string;   // Nodo si la condición es verdadera
  false_node_id?: string;  // Nodo si la condición es falsa
  true_flow_id?: number;   // Flujo si la condición es verdadera (opcional)
  false_flow_id?: number;  // Flujo si la condición es falsa (opcional)
  
  // Nodo Acción
  action_type?: 'set_variable' | 'http_request' | 'save_contact' | 'add_tag' | 'remove_tag' | 'notify_agent';
  action_config?: Record<string, any>;
  http_method?: 'GET' | 'POST' | 'PUT';
  http_url?: string;
  
  // Nodo IA
  ai_prompt?: string;
  ai_context?: string;
  
  // Nodo Transferir
  transfer_to?: string;
  transfer_to_user_id?: number;  // ID del usuario/empleado del broker al que se transfiere
  transfer_to_user_name?: string;  // Nombre del usuario para mostrar en UI
  transfer_message?: string;
  
  // Nodo Espera
  delay_ms?: number;
  delay_seconds?: number;
  
  // Nodo Fin
  goodbye_message?: string;
}

export interface ChatbotTrigger {
  id: number;
  chatbot_id: number;
  flow_id?: number;
  trigger_type: TriggerType;
  trigger_value?: string;
  is_case_sensitive: boolean;
  priority: number;
  is_active: boolean;
  conditions?: Record<string, any>;
  created_at: string;
  updated_at: string;
  flow?: ChatbotFlow;
}

export type TriggerType = 
  | 'keyword'
  | 'contains'
  | 'regex'
  | 'starts_with'
  | 'first_message'
  | 'button_reply'
  | 'list_reply'
  | 'media'
  | 'location'
  | 'schedule';

export interface ChatbotSession {
  id: number;
  chatbot_id: number;
  contact_phone: string;
  instance_id: string;
  current_flow_id?: number;
  current_node_id?: number;
  variables?: Record<string, any>;
  status: 'active' | 'waiting_input' | 'transferred' | 'completed' | 'expired';
  fallback_count: number;
  conversation_history?: ConversationMessage[];
  started_at: string;
  last_activity_at: string;
  expires_at?: string;
  current_flow?: ChatbotFlow;
  current_node?: ChatbotNode;
}

export interface ConversationMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
}

export interface ChatbotQuickResponse {
  id: number;
  chatbot_id: number;
  shortcut: string;
  title: string;
  response_text: string;
  media_url?: string;
  is_active: boolean;
  usage_count: number;
}

export interface ChatbotAnalytics {
  id: number;
  chatbot_id: number;
  date: string;
  total_sessions: number;
  completed_sessions: number;
  transferred_sessions: number;
  avg_session_duration_seconds: number;
  flow_stats?: Record<string, any>;
  trigger_stats?: Record<string, any>;
  satisfaction_ratings?: Record<string, any>;
}

export interface CreateChatbotRequest {
  name: string;
  description?: string;
  instance_id?: string;
  welcome_message?: string;
  fallback_message?: string;
  ai_enabled?: boolean;
  ai_provider?: 'openai' | 'claude' | 'none';
  ai_model?: string;
  ai_system_prompt?: string;
}

export interface UpdateChatbotRequest extends Partial<Omit<Chatbot, 'id' | 'broker_id' | 'created_at' | 'updated_at'>> {}

export interface CreateFlowRequest {
  name: string;
  description?: string;
  is_default?: boolean;
  priority?: number;
}

export interface CreateNodeRequest {
  node_type: NodeType;
  name?: string;
  position_x?: number;
  position_y?: number;
  config: NodeConfig;
  next_node_id?: number;
}

export interface CreateTriggerRequest {
  flow_id?: number;
  trigger_type: TriggerType;
  trigger_value?: string;
  is_case_sensitive?: boolean;
  priority?: number;
  conditions?: Record<string, any>;
}

// ==================== SERVICIO ====================

const chatbotService = {
  // ==================== CHATBOTS ====================
  
  /**
   * Listar todos los chatbots del broker
   */
  async getChatbots(): Promise<{ success: boolean; data?: Chatbot[]; message?: string }> {
    try {
      const response = await api.get('/saas/chatbots');
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo chatbots:', error);
      return { success: false, message: error.response?.data?.message || 'Error al obtener chatbots' };
    }
  },

  /**
   * Obtener un chatbot específico con todos sus datos
   */
  async getChatbot(id: number): Promise<{ success: boolean; data?: Chatbot; message?: string }> {
    try {
      const response = await api.get(`/saas/chatbots/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo chatbot:', error);
      return { success: false, message: error.response?.data?.message || 'Error al obtener chatbot' };
    }
  },

  /**
   * Crear un nuevo chatbot
   */
  async createChatbot(data: CreateChatbotRequest): Promise<{ success: boolean; data?: Chatbot; message?: string }> {
    try {
      const response = await api.post('/saas/chatbots', data);
      return response.data;
    } catch (error: any) {
      console.error('Error creando chatbot:', error);
      return { success: false, message: error.response?.data?.message || 'Error al crear chatbot' };
    }
  },

  /**
   * Actualizar un chatbot
   */
  async updateChatbot(id: number, data: UpdateChatbotRequest): Promise<{ success: boolean; data?: Chatbot; message?: string }> {
    try {
      const response = await api.put(`/saas/chatbots/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error actualizando chatbot:', error);
      return { success: false, message: error.response?.data?.message || 'Error al actualizar chatbot' };
    }
  },

  /**
   * Eliminar un chatbot
   */
  async deleteChatbot(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.delete(`/saas/chatbots/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error eliminando chatbot:', error);
      return { success: false, message: error.response?.data?.message || 'Error al eliminar chatbot' };
    }
  },

  /**
   * Duplicar un chatbot
   */
  async duplicateChatbot(id: number): Promise<{ success: boolean; data?: Chatbot; message?: string }> {
    try {
      const response = await api.post(`/saas/chatbots/${id}/duplicate`);
      return response.data;
    } catch (error: any) {
      console.error('Error duplicando chatbot:', error);
      return { success: false, message: error.response?.data?.message || 'Error al duplicar chatbot' };
    }
  },

  // ==================== FLOWS ====================

  /**
   * Listar flujos de un chatbot
   */
  async getFlows(chatbotId: number): Promise<{ success: boolean; data?: ChatbotFlow[]; message?: string }> {
    try {
      const response = await api.get(`/saas/chatbots/${chatbotId}/flows`);
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo flujos:', error);
      return { success: false, message: error.response?.data?.message || 'Error al obtener flujos' };
    }
  },

  /**
   * Crear un flujo
   */
  async createFlow(chatbotId: number, data: CreateFlowRequest): Promise<{ success: boolean; data?: ChatbotFlow; message?: string }> {
    try {
      const response = await api.post(`/saas/chatbots/${chatbotId}/flows`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error creando flujo:', error);
      return { success: false, message: error.response?.data?.message || 'Error al crear flujo' };
    }
  },

  /**
   * Actualizar un flujo
   */
  async updateFlow(flowId: number, data: Partial<ChatbotFlow>): Promise<{ success: boolean; data?: ChatbotFlow; message?: string }> {
    try {
      const response = await api.put(`/saas/chatbots/flows/${flowId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error actualizando flujo:', error);
      return { success: false, message: error.response?.data?.message || 'Error al actualizar flujo' };
    }
  },

  /**
   * Eliminar un flujo
   */
  async deleteFlow(flowId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.delete(`/saas/chatbots/flows/${flowId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error eliminando flujo:', error);
      return { success: false, message: error.response?.data?.message || 'Error al eliminar flujo' };
    }
  },

  // ==================== NODES ====================

  /**
   * Crear un nodo
   */
  async createNode(flowId: number, data: CreateNodeRequest): Promise<{ success: boolean; data?: ChatbotNode; message?: string }> {
    try {
      const response = await api.post(`/saas/chatbots/flows/${flowId}/nodes`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error creando nodo:', error);
      return { success: false, message: error.response?.data?.message || 'Error al crear nodo' };
    }
  },

  /**
   * Actualizar un nodo
   */
  async updateNode(nodeId: number, data: Partial<ChatbotNode>): Promise<{ success: boolean; data?: ChatbotNode; message?: string }> {
    try {
      const response = await api.put(`/saas/chatbots/nodes/${nodeId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error actualizando nodo:', error);
      return { success: false, message: error.response?.data?.message || 'Error al actualizar nodo' };
    }
  },

  /**
   * Actualizar nodos en lote (para el editor visual)
   */
  async updateNodesBulk(flowId: number, nodes: Partial<ChatbotNode>[]): Promise<{ success: boolean; data?: ChatbotNode[]; message?: string }> {
    try {
      const response = await api.put(`/saas/chatbots/flows/${flowId}/nodes/bulk`, { nodes });
      return response.data;
    } catch (error: any) {
      console.error('Error actualizando nodos:', error);
      return { success: false, message: error.response?.data?.message || 'Error al actualizar nodos' };
    }
  },

  /**
   * Eliminar un nodo
   */
  async deleteNode(nodeId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.delete(`/saas/chatbots/nodes/${nodeId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error eliminando nodo:', error);
      return { success: false, message: error.response?.data?.message || 'Error al eliminar nodo' };
    }
  },

  // ==================== TRIGGERS ====================

  /**
   * Listar triggers de un chatbot
   */
  async getTriggers(chatbotId: number): Promise<{ success: boolean; data?: ChatbotTrigger[]; message?: string }> {
    try {
      const response = await api.get(`/saas/chatbots/${chatbotId}/triggers`);
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo triggers:', error);
      return { success: false, message: error.response?.data?.message || 'Error al obtener triggers' };
    }
  },

  /**
   * Crear un trigger
   */
  async createTrigger(chatbotId: number, data: CreateTriggerRequest): Promise<{ success: boolean; data?: ChatbotTrigger; message?: string }> {
    try {
      const response = await api.post(`/saas/chatbots/${chatbotId}/triggers`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error creando trigger:', error);
      return { success: false, message: error.response?.data?.message || 'Error al crear trigger' };
    }
  },

  /**
   * Actualizar un trigger
   */
  async updateTrigger(triggerId: number, data: Partial<ChatbotTrigger>): Promise<{ success: boolean; data?: ChatbotTrigger; message?: string }> {
    try {
      const response = await api.put(`/saas/chatbots/triggers/${triggerId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error actualizando trigger:', error);
      return { success: false, message: error.response?.data?.message || 'Error al actualizar trigger' };
    }
  },

  /**
   * Eliminar un trigger
   */
  async deleteTrigger(triggerId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.delete(`/saas/chatbots/triggers/${triggerId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error eliminando trigger:', error);
      return { success: false, message: error.response?.data?.message || 'Error al eliminar trigger' };
    }
  },

  // ==================== SESSIONS ====================

  /**
   * Listar sesiones de un chatbot
   */
  async getSessions(chatbotId: number): Promise<{ success: boolean; data?: { data: ChatbotSession[]; total: number }; message?: string }> {
    try {
      const response = await api.get(`/saas/chatbots/${chatbotId}/sessions`);
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo sesiones:', error);
      return { success: false, message: error.response?.data?.message || 'Error al obtener sesiones' };
    }
  },

  /**
   * Terminar una sesión
   */
  async endSession(sessionId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.delete(`/saas/chatbots/sessions/${sessionId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error terminando sesión:', error);
      return { success: false, message: error.response?.data?.message || 'Error al terminar sesión' };
    }
  },

  // ==================== ANALYTICS ====================

  /**
   * Obtener analytics de un chatbot
   */
  async getAnalytics(chatbotId: number, from?: string, to?: string): Promise<{ success: boolean; data?: { daily: ChatbotAnalytics[]; totals: any }; message?: string }> {
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      
      const response = await api.get(`/saas/chatbots/${chatbotId}/analytics?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo analytics:', error);
      return { success: false, message: error.response?.data?.message || 'Error al obtener analytics' };
    }
  },

  /**
   * Obtener analytics detallados del chatbot (sesiones, nodos, etc.)
   */
  async getChatbotAnalytics(chatbotId: number, timeRange: 'today' | 'week' | 'month' | 'all' = 'week'): Promise<any> {
    try {
      const response = await api.get(`/saas/chatbots/${chatbotId}/analytics/detailed?range=${timeRange}`);
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('Error obteniendo analytics detallados:', error);
      throw error;
    }
  },

  // ==================== HELPERS ====================

  /**
   * Obtener configuración de nodo por tipo
   */
  getNodeTypeConfig(type: NodeType): { label: string; icon: string; color: string; description: string } {
    const configs: Record<NodeType, { label: string; icon: string; color: string; description: string }> = {
      start: { label: 'Inicio', icon: 'solar:play-circle-bold', color: 'green', description: 'Punto de inicio del flujo' },
      message: { label: 'Mensaje', icon: 'solar:chat-round-dots-bold', color: 'blue', description: 'Enviar un mensaje de texto' },
      options: { label: 'Opciones', icon: 'solar:list-check-bold', color: 'purple', description: 'Menú con opciones enlazables' },
      question: { label: 'Pregunta', icon: 'solar:question-circle-bold', color: 'purple', description: 'Pregunta con botones (deprecated)' },
      input: { label: 'Entrada', icon: 'solar:text-field-bold', color: 'cyan', description: 'Esperar entrada del usuario' },
      condition: { label: 'Condición', icon: 'solar:branching-paths-up-bold', color: 'orange', description: 'Bifurcación Sí/No' },
      action: { label: 'Acción', icon: 'solar:bolt-bold', color: 'yellow', description: 'Ejecutar una acción' },
      ai_response: { label: 'IA', icon: 'solar:magic-stick-3-bold', color: 'pink', description: 'Respuesta generada por IA' },
      transfer: { label: 'Transferir', icon: 'solar:user-hand-up-bold', color: 'red', description: 'Transferir a agente humano' },
      delay: { label: 'Espera', icon: 'solar:clock-circle-bold', color: 'gray', description: 'Esperar antes de continuar' },
      end: { label: 'Fin', icon: 'solar:stop-circle-bold', color: 'slate', description: 'Finalizar el flujo' },
    };
    return configs[type];
  },

  /**
   * Obtener configuración de trigger por tipo
   */
  getTriggerTypeConfig(type: TriggerType): { label: string; icon: string; description: string } {
    const configs: Record<TriggerType, { label: string; icon: string; description: string }> = {
      keyword: { label: 'Palabra clave exacta', icon: 'solar:text-bold', description: 'Coincidencia exacta con el mensaje' },
      contains: { label: 'Contiene', icon: 'solar:text-selection-bold', description: 'El mensaje contiene el texto' },
      regex: { label: 'Expresión regular', icon: 'solar:code-bold', description: 'Coincidencia con patrón regex' },
      starts_with: { label: 'Empieza con', icon: 'solar:text-italic-bold', description: 'El mensaje empieza con el texto' },
      first_message: { label: 'Primer mensaje', icon: 'solar:chat-round-bold', description: 'Primer mensaje de la conversación' },
      button_reply: { label: 'Respuesta de botón', icon: 'solar:cursor-bold', description: 'Usuario presionó un botón' },
      list_reply: { label: 'Respuesta de lista', icon: 'solar:list-bold', description: 'Usuario seleccionó de una lista' },
      media: { label: 'Archivo multimedia', icon: 'solar:gallery-bold', description: 'Usuario envió imagen/video/audio' },
      location: { label: 'Ubicación', icon: 'solar:map-point-bold', description: 'Usuario compartió ubicación' },
      schedule: { label: 'Programado', icon: 'solar:calendar-bold', description: 'Activación por horario' },
    };
    return configs[type];
  },
};

export default chatbotService;
