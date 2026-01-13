/**
 * Servicio para la gestión de campañas de voz integrado con Laravel backend
 * Maneja campañas de llamadas automáticas usando ElevenLabs
 */

import { auth } from '../config/firebase';

// Configuración de la API de Laravel
const LARAVEL_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

// Helper para obtener el token de autenticación Firebase
const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (user) {      const token = await user.getIdToken();      return token;
    }

    // Fallback a token de empleado
    const empleadoToken = localStorage.getItem('empleado_token');
    if (empleadoToken) {      return empleadoToken;
    }    return null;
  } catch (error) {    return null;
  }
};

// Interfaces para campañas de voz
export interface VoiceCampaign {
  id: number;
  name: string;
  description: string;
  agent_id: string;
  agent_name?: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  type: 'immediate' | 'scheduled';
  contacts: VoiceCampaignContact[];
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  settings: {
    max_retries: number;
    retry_delay: number;
    call_timeout: number;
    simultaneous_calls: number;
    working_hours: {
      start: string;
      end: string;
      days: string[];
    };
  };
  statistics: {
    total_contacts: number;
    completed_calls: number;
    failed_calls: number;
    pending_calls: number;
    success_rate: number;
    avg_duration: number;
    total_cost: number;
  };
  created_at: string;
  updated_at: string;
}

export interface VoiceCampaignContact {
  id?: number;
  voice_campaign_id?: number;
  client_id?: string;
  name: string;
  phone_number: string;
  status: 'pending' | 'calling' | 'completed' | 'failed' | 'no_answer' | 'busy';
  custom_data?: Record<string, any>;
  call_id?: string;
  call_started_at?: string;
  call_completed_at?: string;
  call_duration?: number;
  call_cost?: number;
  error_message?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VoiceCampaignExecution {
  id: number;
  voice_campaign_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_contacts: number;
  completed_calls: number;
  failed_calls: number;
  pending_calls: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface VoiceCampaignCall {
  id: number;
  voice_campaign_execution_id: number;
  // Backend fields
  recipient_phone?: string;
  recipient_name?: string;
  elevenlabs_conversation_id?: string;
  call_result?: any;
  duration_seconds?: number;
  call_transcript?: string;
  call_recording_url?: string;
  elevenlabs_call_id?: string;
  status: 'pending' | 'calling' | 'completed' | 'failed' | 'no_answer' | 'busy';
  started_at?: string;
  completed_at?: string;
  duration?: number;
  cost?: number;
  transcript?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface VoiceCampaignStats {
  total_campaigns: number;
  active_campaigns: number;
  scheduled_campaigns: number;
  completed_campaigns: number;
  total_calls: number; // maps to total_calls_made backend
  successful_calls: number; // maps to total_successful_calls backend
  failed_calls: number; // derived
  overall_success_rate: number;
  total_cost: number;
  avg_call_duration: number; // maps to average_duration_seconds
  recent_activity: Array<{
    campaign_name: string;
    execution_date: string;
    calls_made: number;
    success_rate: number;
  }>;
}

export interface CreateVoiceCampaignRequest {
  name: string;
  description?: string;
  agent_id: string;
  type: 'immediate' | 'scheduled';
  priority: 'low' | 'medium' | 'high';
  scheduled_at?: string;
  contacts: Array<{
    name: string;
    phone_number: string;
    custom_data?: Record<string, any>;
  }>;
  settings?: {
    max_retries?: number;
    retry_delay?: number;
    call_timeout?: number;
    simultaneous_calls?: number;
    working_hours?: {
      start: string;
      end: string;
      days: string[];
    };
    post_call_tools?: {
      collect?: {
        email?: boolean | CollectFieldConfig;
        document_id?: boolean | CollectFieldConfig;
        address?: boolean | CollectFieldConfig;
        [k: string]: boolean | CollectFieldConfig | undefined;
      };
      whatsapp?: {
        enabled?: boolean;
        instance_id?: string;
        template?: string;
        [k: string]: string | boolean | undefined;
      };
      [k: string]: unknown;
    };
  };
}

/**
 * Disparadores (Triggers) - Tipos y payloads
 */
export interface VoiceCampaignTriggerInput {
  type: 'new_client' | 'new_policy' | 'policy_expiry' | 'new_lead' | 'new_siniestro';
  enabled?: boolean;
  window_config?: {
    days?: string[];
    start?: string; // "HH:mm"
    end?: string;   // "HH:mm"
    tz?: string;    // e.g. "America/Bogota"
  };
  limits?: {
    daily_quota?: number; // 0 = sin límite
    dedup_days?: number;  // 0 = sin dedup
  };
  filters?: Record<string, any>;
  expiry_offsets?: { // solo para type="policy_expiry"
    before_days?: number[];
    after_days?: number[];
  };
  mapping?: {
    phone_field?: string;
    alt_phone_field?: string;
    variables?: Record<string, any>; // { varName: string|{path:string,default?:any} }
  };
}

export interface ProcessTriggerEventPayload {
  type: VoiceCampaignTriggerInput['type'];
  entity: Record<string, any>;
  entity_type?: string;
  entity_id?: string | number;
}

export interface TestCallRequest {
  phone_number: string;
  customer_name: string;
  agent_id?: string;
  custom_message?: string;
}

// Tipado rico para campos de recolección post-llamada (coincide con lo que arma CampaignsManagementWidget)
export interface CollectFieldConfig {
  enabled: boolean;
  type: string;
  required?: boolean;
  instruction?: string;
  pattern?: string;
}
// Cache simple para optimizar llamadas a ElevenLabs
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresIn: number; // en milisegundos
}

class VoiceCampaignService {
  private baseUrl: string;
  private conversationCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  constructor() {
    this.baseUrl = LARAVEL_API_BASE_URL;
  }

  // ========================
  // MÉTODOS DE CACHÉ
  // ========================

  private getCachedData(key: string): any | null {
    const entry = this.conversationCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.expiresIn) {
      this.conversationCache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCachedData(key: string, data: any, customDuration?: number): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiresIn: customDuration || this.CACHE_DURATION,
    };

    this.conversationCache.set(key, entry);  }

  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.conversationCache) {
      if (now - entry.timestamp > entry.expiresIn) {
        this.conversationCache.delete(key);
      }
    }
  }

  /**
   * Realizar petición HTTP a Laravel
   */
  private async makeRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = await getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${
            errorData.message || 'Unknown error'
          }`,
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {      throw new Error(
        `Error de conexión con backend: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      );
    }
  }

  // ========================
  // GESTIÓN DE CAMPAÑAS DE VOZ
  // ========================

  /**
   * Obtener todas las campañas de voz
   */
  async getVoiceCampaigns(filters?: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; campaigns: VoiceCampaign[]; total: number }> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
      }

      const endpoint = `/saas/voice-campaigns${
        queryParams.toString() ? `?${queryParams.toString()}` : ''
      }`;
      const response = await this.makeRequest(endpoint);

      return {
        success: true,
        campaigns: response.data || response.campaigns || [],
        total: response.total || response.campaigns?.length || 0,
      };
    } catch (error) {      return { success: false, campaigns: [], total: 0 };
    }
  }

  /**
   * Obtener una campaña de voz específica
   */
  async getVoiceCampaign(
    id: number,
  ): Promise<{ success: boolean; campaign?: VoiceCampaign; message?: string }> {
    try {
      const response = await this.makeRequest(`/saas/voice-campaigns/${id}`);
      return { success: true, campaign: response.data || response };
    } catch (error) {      return { success: false, message: 'Error al obtener campaña de voz' };
    }
  }

  /**
   * Crear campaña de voz inmediata - usa directamente el endpoint del backend
   */
  async createImmediateVoiceCampaign(campaignData: any): Promise<{
    success: boolean;
    message: string;
    campaign?: any;
  }> {
    try {
      const response = await this.makeRequest(
        '/saas/voice-campaigns/immediate',
        'POST',
        campaignData,
      );
      return {
        success: true,
        message: 'Campaña de voz inmediata creada y ejecutada exitosamente',
        campaign: response.data || response.campaign,
      };
    } catch (error) {      return {
        success: false,
        message: `Error al crear campaña de voz inmediata: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Crear campaña de voz programada
   */
  async createScheduledVoiceCampaign(campaign: CreateVoiceCampaignRequest): Promise<{
    success: boolean;
    message: string;
    campaign?: VoiceCampaign;
  }> {
    try {
      const response = await this.makeRequest('/saas/voice-campaigns/scheduled', 'POST', campaign);
      return {
        success: true,
        message: 'Campaña de voz programada creada exitosamente',
        campaign: response.data || response.campaign,
      };
    } catch (error) {      return {
        success: false,
        message: `Error al crear campaña de voz programada: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Ejecutar campaña de voz manualmente
   */
  async executeVoiceCampaign(
    id: number,
  ): Promise<{ success: boolean; message: string; execution_id?: number }> {
    try {
      const response = await this.makeRequest(`/saas/voice-campaigns/${id}/execute`, 'POST');
      return {
        success: true,
        message: 'Campaña ejecutada exitosamente',
        execution_id: response.execution_id || response.data?.execution_id,
      };
    } catch (error) {      return {
        success: false,
        message: `Error al ejecutar campaña: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Activar/pausar campaña de voz
   */
  async toggleVoiceCampaign(
    id: number,
  ): Promise<{ success: boolean; message: string; is_active?: boolean }> {
    try {
      const response = await this.makeRequest(`/saas/voice-campaigns/${id}/toggle`, 'PATCH');
      return {
        success: true,
        message: response.is_active ? 'Campaña activada' : 'Campaña pausada',
        is_active: response.is_active,
      };
    } catch (error) {      return {
        success: false,
        message: `Error al cambiar estado de campaña: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }
  /**
   * Pausar campaña de voz
   */
  async pauseVoiceCampaign(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    try {      const response = await this.makeRequest(
        `/saas/voice-campaigns/${id}/pause`,
        'POST',
      );      return {
        success: true,
        message: response.message || 'Campaña pausada',
      };
    } catch (error) {      return {
        success: false,
        message: `Error al pausar campaña: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Reanudar campaña de voz
   */
  async resumeVoiceCampaign(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    try {      const response = await this.makeRequest(
        `/saas/voice-campaigns/${id}/resume`,
        'POST',
      );      return {
        success: true,
        message: response.message || 'Campaña reanudada',
      };
    } catch (error) {      return {
        success: false,
        message: `Error al reanudar campaña: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Cancelar campaña de voz
   */
  async cancelVoiceCampaign(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    try {      const response = await this.makeRequest(
        `/saas/voice-campaigns/${id}/cancel`,
        'POST',
      );      return {
        success: true,
        message: response.message || 'Campaña cancelada',
      };
    } catch (error) {      return {
        success: false,
        message: `Error al cancelar campaña: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Reiniciar/Repetir campaña de voz (para campañas completadas o canceladas)
   */
  async restartVoiceCampaign(
    id: number,
  ): Promise<{ success: boolean; message: string; execution_id?: number }> {
    try {
      const response = await this.makeRequest(
        `/saas/voice-campaigns/${id}/restart`,
        'POST',
      );
      return {
        success: true,
        message: response.message || 'Campaña reiniciada',
        execution_id: response.execution_id,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al reiniciar campaña: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  // ========================
  // ESTADÍSTICAS Y HISTORIAL
  // ========================

  /**
   * Obtener estadísticas de campañas de voz
   */
  async getVoiceCampaignStats(): Promise<{
    success: boolean;
    stats?: VoiceCampaignStats;
    message?: string;
  }> {
    try {
      const response = await this.makeRequest('/saas/voice-campaigns/stats');
      return { success: true, stats: response.data || response };
    } catch (error) {      return {
        success: false,
        message: `Error al obtener estadísticas: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Obtener historial de llamadas
   */
  async getCallHistory(filters?: {
    campaign_id?: number;
    status?: string;
    phone?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    calls?: VoiceCampaignCall[];
    total?: number;
    message?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
      }
      // Enriquecimiento opcional: por defecto sin enriquecer para rendimiento
      if ((filters as any)?.enrich) {
        queryParams.set('enrich', '1');
      }
      const endpoint = `/saas/voice-campaigns/call-history${`?${queryParams.toString()}`}`;
      const response = await this.makeRequest(endpoint);
      return {
        success: true,
        calls: response.data || response.calls || [],
        total: response.total || 0,
      };
    } catch (error) {      return {
        success: false,
        message: `Error al obtener historial de llamadas: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Obtener historial de llamadas híbrido (BD + ElevenLabs)
   */
  async getHybridCallHistory(filters?: {
    status?: string;
    phone?: string;
    date_from?: string;
    date_to?: string;
    campaign_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    calls?: VoiceCampaignCall[];
    total?: number;
    message?: string;
    metadata?: {
      total_calls: number;
      enriched_calls: number;
      db_calls: number;
    };
  }> {
    try {
      // Limpiar caché expirado antes de comenzar
      this.clearExpiredCache();

      // 1. Primero obtener datos base de nuestra BD
      const dbResponse = await this.getCallHistory({ ...(filters || {}), enrich: 1 } as any);

      if (!dbResponse.success || !dbResponse.calls) {
        return dbResponse;
      }
      // Los datos ya vienen completos del backend (VAPI), no necesitamos enriquecer con ElevenLabs
      const enrichedCalls = dbResponse.calls.map((call) => ({
        ...call,
        is_enriched: true,
      }));

      const enrichedCount = enrichedCalls.length;
      return {
        success: true,
        calls: enrichedCalls,
        total: dbResponse.total,
        metadata: {
          total_calls: enrichedCalls.length,
          enriched_calls: enrichedCount,
          db_calls: dbResponse.calls.length,
        },
      };
    } catch (error) {
      // Fallback a solo datos de BD
      return this.getCallHistory(filters);
    }
  }

  /**
   * Obtener estadísticas híbridas (BD + VAPI)
   */
  async getHybridVoiceCampaignStats(): Promise<{
    success: boolean;
    stats?: any;
    message?: string;
    metadata?: {
      source: 'database' | 'hybrid';
      vapi_enriched: boolean;
      enrichment_errors: string[];
    };
  }> {
    try {
      // 1. Obtener estadísticas base de nuestra BD
      const dbStatsResponse = await this.getVoiceCampaignStats();

      if (!dbStatsResponse.success || !dbStatsResponse.stats) {
        return dbStatsResponse;
      }

      const dbStats = dbStatsResponse.stats;
      // 2. Obtener datos enriquecidos de VAPI si es posible
      let vapiEnriched = false;
      const enrichmentErrors: string[] = [];
      let hybridStats = { ...dbStats };

      try {
        // Usar el método híbrido de llamadas para obtener datos más ricos
        const hybridCallsResponse = await this.getHybridCallHistory({ limit: 1000 });

        if (hybridCallsResponse.success && hybridCallsResponse.calls) {
          const enrichedCalls = hybridCallsResponse.calls.filter((call: any) => call.is_enriched);

          if (enrichedCalls.length > 0) {
            // Calcular estadísticas mejoradas basadas en datos de VAPI
            const totalVapiCost = enrichedCalls.reduce(
              (sum: number, call: any) => sum + (call.vapi_cost || call.elevenlabs_cost || 0),
              0,
            );

            // Calcular duración total más precisa de VAPI
            const totalVapiDuration = enrichedCalls.reduce(
              (sum: number, call: any) =>
                sum + (call.vapi_metadata?.call_duration_secs || call.duration_seconds || 0),
              0,
            );

            const avgVapiDuration =
              enrichedCalls.length > 0
                ? totalVapiDuration / enrichedCalls.length
                : (dbStats as any).average_duration_seconds || 0;

            // Análisis de éxito basado en VAPI
            const successfulVapiCalls = enrichedCalls.filter(
              (call: any) => call.vapi_analysis?.call_successful === true || call.elevenlabs_analysis?.call_successful === true,
            ).length;

            // Combinar estadísticas de BD con enriquecimiento de VAPI
            hybridStats = {
              ...dbStats,
              // Mejorar con datos de VAPI donde estén disponibles
              total_calls: Math.max(
                (dbStats as any).total_calls_made || (dbStats as any).total_calls || 0,
                hybridCallsResponse.calls.length,
              ),
              successful_calls: Math.max(
                (dbStats as any).total_successful_calls || (dbStats as any).successful_calls || 0,
                successfulVapiCalls,
              ),
              avg_call_duration:
                avgVapiDuration > 0
                  ? avgVapiDuration
                  : (dbStats as any).average_duration_seconds ||
                    (dbStats as any).avg_call_duration ||
                    0,
              // omit total_duration_seconds (no está en el tipo público)
              // Datos adicionales de VAPI (no tipados en interfaz pública)
              // Se omiten para mantener compatibilidad de tipos
            };

            // Recalcular tasa de éxito general
            hybridStats.overall_success_rate =
              (hybridStats as any).total_calls > 0
                ? ((hybridStats as any).successful_calls / (hybridStats as any).total_calls) * 100
                : 0;

            vapiEnriched = true;
          }
        }
      } catch (enrichError: any) {        enrichmentErrors.push(enrichError.message || 'Unknown enrichment error');
      }
      return {
        success: true,
        stats: hybridStats,
        metadata: {
          source: vapiEnriched ? 'hybrid' : 'database',
          vapi_enriched: vapiEnriched,
          enrichment_errors: enrichmentErrors,
        },
      };
    } catch (error: any) {
      // Fallback a solo estadísticas de BD
      return this.getVoiceCampaignStats();
    }
  }

  // ========================
  // SINCRONIZACIÓN DE LLAMADAS DESDE VAPI
  // ========================

  /**
   * Sincronizar llamadas pendientes desde VAPI (para recuperar datos de llamadas donde el webhook falló)
   */
  async syncPendingCallsFromVapi(): Promise<{
    success: boolean;
    synced?: number;
    errors?: Array<{ call_id: number; error: string }>;
    message?: string;
  }> {
    try {
      const response = await this.makeRequest('/saas/voice-campaigns/calls/sync-pending', 'POST');
      return {
        success: true,
        synced: response.synced || 0,
        errors: response.errors || [],
        message: response.message || 'Sincronización completada',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al sincronizar llamadas: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Sincronizar una llamada específica desde VAPI
   */
  async syncCallFromVapi(callId: number): Promise<{
    success: boolean;
    message?: string;
    before?: any;
    after?: any;
  }> {
    try {
      const response = await this.makeRequest(`/saas/voice-campaigns/calls/${callId}/sync-vapi`, 'POST');
      return {
        success: true,
        message: response.message || 'Llamada sincronizada',
        before: response.before,
        after: response.after,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al sincronizar llamada: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  /**
   * Sincronizar campaña en tiempo real desde VAPI API
   * Ideal para polling cada 3-5 segundos durante ejecución de campaña
   */
  async syncCampaignRealtime(campaignId: number): Promise<{
    success: boolean;
    campaign?: {
      id: number;
      status: string;
      calls_made: number;
      calls_successful: number;
      calls_failed: number;
      progress_percentage: number;
    };
    synced?: number;
    updated?: Array<{ call_id: number; old_status: string; new_status: string }>;
    campaign_completed?: boolean;
    remaining_active_calls?: number;
    message?: string;
  }> {
    try {
      const response = await this.makeRequest(`/saas/voice-campaigns/${campaignId}/sync-realtime`, 'POST');
      return {
        success: true,
        campaign: response.campaign,
        synced: response.synced || 0,
        updated: response.updated || [],
        campaign_completed: response.campaign_completed || false,
        remaining_active_calls: response.remaining_active_calls || 0,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al sincronizar campaña: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  // ========================
  // PRUEBAS DE LLAMADAS
  // ========================

  /**
   * Realizar prueba de llamada con VAPI
   */
  async testCall(request: TestCallRequest): Promise<{
    success: boolean;
    message: string;
    call_id?: string;
    call_data?: any;
  }> {
    try {
      const response = await this.makeRequest('/saas/voice-campaigns/test-call', 'POST', request);
      return {
        success: true,
        message: response.message || 'Llamada de prueba realizada exitosamente',
        call_id: response.call_id || response.data?.call_id,
        call_data: response.data || response,
      };
    } catch (error) {      return {
        success: false,
        message: `Error en llamada de prueba: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
    }
  }

  // ========================
  // DISPARADORES (TRIGGERS) DE CAMPAÑAS DE VOZ
  // ========================

  /**
   * Listar disparadores de una campaña
   */
  async listCampaignTriggers(campaignId: number): Promise<{
    success: boolean;
    data?: any[];
    message?: string;
  }> {
    try {
      const response = await this.makeRequest(`/saas/voice-campaigns/${campaignId}/triggers`);
      return { success: true, data: response.data || [] };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error al listar disparadores' };
    }
  }

  /**
   * Crear un disparador para una campaña
   */
  async createCampaignTrigger(
    campaignId: number,
    trigger: VoiceCampaignTriggerInput
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const response = await this.makeRequest(
        `/saas/voice-campaigns/${campaignId}/triggers`,
        'POST',
        trigger
      );
      return { success: true, data: response.data || response };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error al crear disparador' };
    }
  }

  /**
   * Actualizar un disparador
   */
  async updateCampaignTrigger(
    triggerId: number,
    patch: Partial<VoiceCampaignTriggerInput> & { status?: string }
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const response = await this.makeRequest(
        `/saas/voice-campaigns/triggers/${triggerId}`,
        'PUT',
        patch
      );
      return { success: true, data: response.data || response };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error al actualizar disparador' };
    }
  }

  /**
   * Eliminar un disparador
   */
  async deleteCampaignTrigger(triggerId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.makeRequest(
        `/saas/voice-campaigns/triggers/${triggerId}`,
        'DELETE'
      );
      return { success: true, message: response.message || 'Disparador eliminado' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error al eliminar disparador' };
    }
  }

  /**
   * Test-run de un disparador (evalúa y, si procede, dispara 1 llamada)
   */
  async testRunTrigger(
    triggerId: number,
    payload: { sample?: Record<string, any>; entity_type?: string; entity_id?: string | number }
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const response = await this.makeRequest(
        `/saas/voice-campaigns/triggers/${triggerId}/test-run`,
        'POST',
        payload
      );
      return { success: true, data: response.data || response };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error en test-run de disparador' };
    }
  }

  /**
   * Previsualización de targets candidatos para un disparador (no dispara llamadas)
   */
  async previewTriggerTargets(
    triggerId: number,
    limit: number = 10
  ): Promise<{ success: boolean; data?: any[]; meta?: any; message?: string }> {
    try {
      const response = await this.makeRequest(
        `/saas/voice-campaigns/triggers/${triggerId}/preview-targets`,
        'POST',
        { limit }
      );
      return {
        success: true,
        data: response.data || [],
        meta: response.meta || { limit }
      };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error al previsualizar objetivos' };
    }
  }

  /**
   * Procesar un evento de negocio contra todos los disparadores del broker para ese tipo
   */
  async processTriggerEvent(
    event: ProcessTriggerEventPayload
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const response = await this.makeRequest(
        `/saas/voice-campaigns/triggers/process-event`,
        'POST',
        event
      );
      return { success: true, data: response.data || response };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Error al procesar evento' };
    }
  }

  // ========================
  // MÉTODOS DE VALIDACIÓN
  // ========================

  /**
   * Actualizar campaña de voz
   */
  async updateVoiceCampaign(
    id: number,
    campaignData: Partial<CreateVoiceCampaignRequest>,
  ): Promise<{
    success: boolean;
    campaign?: VoiceCampaign;
    message?: string;
    errors?: any;
  }> {
    try {
      const response = await this.makeRequest(`/saas/voice-campaigns/${id}`, 'PUT', campaignData);
      return {
        success: true,
        campaign: response.campaign,
        message: response.message || 'Campaña actualizada exitosamente',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar la campaña',
        errors: error.response?.data?.errors || {},
      };
    }
  }

  /**
   * Eliminar campaña de voz
   */
  async deleteVoiceCampaign(id: number): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const response = await this.makeRequest(`/saas/voice-campaigns/${id}`, 'DELETE');
      return {
        success: true,
        message: response.message || 'Campaña eliminada exitosamente',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar la campaña',
      };
    }
  }

  /**
   * Validar configuración de campaña de voz
   */
  validateVoiceCampaignConfig(campaign: Partial<CreateVoiceCampaignRequest>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!campaign.name || campaign.name.trim().length === 0) {
      errors.push('El nombre de la campaña es requerido');
    }

    if (!campaign.agent_id || campaign.agent_id.trim().length === 0) {
      errors.push('El agente de voz es requerido');
    }

    if (!campaign.contacts || campaign.contacts.length === 0) {
      errors.push('Los contactos son requeridos');
    }

    if (campaign.type === 'scheduled' && !campaign.scheduled_at) {
      errors.push('La fecha de programación es requerida para campañas programadas');
    }

    // Validar números de teléfono
    if (campaign.contacts) {
      campaign.contacts.forEach((contact, index) => {
        if (!contact.phone_number || contact.phone_number.trim().length === 0) {
          errors.push(`El número de teléfono del contacto ${index + 1} es requerido`);
        }
        if (!contact.name || contact.name.trim().length === 0) {
          errors.push(`El nombre del contacto ${index + 1} es requerido`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Crear instancia única del servicio
const voiceCampaignService = new VoiceCampaignService();

export default voiceCampaignService;
