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
    console.log('🔍 [VOICE CAMPAIGN DEBUG] Getting Firebase auth token...');

    const user = auth.currentUser;
    console.log('🔍 [VOICE CAMPAIGN DEBUG] Current user:', user);

    if (user) {
      console.log('✅ [VOICE CAMPAIGN DEBUG] User found, getting ID token...');
      const token = await user.getIdToken();
      console.log('✅ [VOICE CAMPAIGN DEBUG] Token obtained:', token ? 'YES' : 'NO');
      return token;
    }

    // Fallback a token de empleado
    const empleadoToken = localStorage.getItem('empleado_token');
    if (empleadoToken) {
      console.log('✅ [VOICE CAMPAIGN DEBUG] Using empleado token as fallback');
      return empleadoToken;
    }

    console.log('❌ [VOICE CAMPAIGN DEBUG] No auth token available');
    return null;
  } catch (error) {
    console.error('❌ [VOICE CAMPAIGN DEBUG] Error getting auth token:', error);
    return null;
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
        email?: boolean;
        document_id?: boolean;
        address?: boolean;
        [k: string]: boolean | undefined;
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

export interface TestCallRequest {
  phone_number: string;
  customer_name: string;
  agent_id?: string;
  custom_message?: string;
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

    console.log(`💾 [CACHE] Hit for key: ${key}`);
    return entry.data;
  }

  private setCachedData(key: string, data: any, customDuration?: number): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiresIn: customDuration || this.CACHE_DURATION,
    };

    this.conversationCache.set(key, entry);
    console.log(`💾 [CACHE] Stored key: ${key} (expires in ${entry.expiresIn}ms)`);
  }

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
    console.log('🚀 [VOICE CAMPAIGN DEBUG] makeRequest called with:', { endpoint, method, data });

    const url = `${this.baseUrl}${endpoint}`;
    console.log('🚀 [VOICE CAMPAIGN DEBUG] URL:', url);

    const token = await getAuthToken();
    console.log('🚀 [VOICE CAMPAIGN DEBUG] Token result:', token ? 'GOT TOKEN' : 'NO TOKEN');

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
    } catch (error) {
      console.error('Voice Campaign Service Error:', error);
      throw new Error(
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
    } catch (error) {
      console.error('Error fetching voice campaigns:', error);
      return { success: false, campaigns: [], total: 0 };
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
    } catch (error) {
      console.error('Error fetching voice campaign:', error);
      return { success: false, message: 'Error al obtener campaña de voz' };
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
      console.log('🎙️ [VOICE CAMPAIGN] Creating immediate campaign:', campaignData);

      const response = await this.makeRequest(
        '/saas/voice-campaigns/immediate',
        'POST',
        campaignData,
      );

      console.log('✅ [VOICE CAMPAIGN] Campaign created successfully:', response);

      return {
        success: true,
        message: 'Campaña de voz inmediata creada y ejecutada exitosamente',
        campaign: response.data || response.campaign,
      };
    } catch (error) {
      console.error('❌ [VOICE CAMPAIGN] Error creating immediate voice campaign:', error);
      return {
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
      console.log('🎙️ [VOICE CAMPAIGN] Creating scheduled campaign:', campaign);

      const response = await this.makeRequest('/saas/voice-campaigns/scheduled', 'POST', campaign);

      console.log('✅ [VOICE CAMPAIGN] Scheduled campaign created successfully:', response);

      return {
        success: true,
        message: 'Campaña de voz programada creada exitosamente',
        campaign: response.data || response.campaign,
      };
    } catch (error) {
      console.error('❌ [VOICE CAMPAIGN] Error creating scheduled voice campaign:', error);
      return {
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
      console.log('🚀 [VOICE CAMPAIGN] Executing campaign:', id);

      const response = await this.makeRequest(`/saas/voice-campaigns/${id}/execute`, 'POST');

      console.log('✅ [VOICE CAMPAIGN] Campaign executed successfully:', response);

      return {
        success: true,
        message: 'Campaña ejecutada exitosamente',
        execution_id: response.execution_id || response.data?.execution_id,
      };
    } catch (error) {
      console.error('❌ [VOICE CAMPAIGN] Error executing voice campaign:', error);
      return {
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
      console.log('🔄 [VOICE CAMPAIGN] Toggling campaign:', id);

      const response = await this.makeRequest(`/saas/voice-campaigns/${id}/toggle`, 'PATCH');

      console.log('✅ [VOICE CAMPAIGN] Campaign toggled successfully:', response);

      return {
        success: true,
        message: response.is_active ? 'Campaña activada' : 'Campaña pausada',
        is_active: response.is_active,
      };
    } catch (error) {
      console.error('❌ [VOICE CAMPAIGN] Error toggling voice campaign:', error);
      return {
        success: false,
        message: `Error al cambiar estado de campaña: ${
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
      console.log('📊 [VOICE CAMPAIGN] Getting stats...');

      const response = await this.makeRequest('/saas/voice-campaigns/stats');

      console.log('✅ [VOICE CAMPAIGN] Stats retrieved successfully:', response);

      return { success: true, stats: response.data || response };
    } catch (error) {
      console.error('❌ [VOICE CAMPAIGN] Error fetching voice campaign stats:', error);
      return {
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

      console.log('📞 [VOICE CAMPAIGN] Getting call history...');

      // Enriquecimiento opcional: por defecto sin enriquecer para rendimiento
      if ((filters as any)?.enrich) {
        queryParams.set('enrich', '1');
      }
      const endpoint = `/saas/voice-campaigns/call-history${`?${queryParams.toString()}`}`;
      const response = await this.makeRequest(endpoint);

      console.log('✅ [VOICE CAMPAIGN] Call history retrieved successfully:', response);

      return {
        success: true,
        calls: response.data || response.calls || [],
        total: response.total || 0,
      };
    } catch (error) {
      console.error('❌ [VOICE CAMPAIGN] Error fetching call history:', error);
      return {
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
      console.log('🔄 [HYBRID] Loading hybrid call history...');

      // Limpiar caché expirado antes de comenzar
      this.clearExpiredCache();

      // 1. Primero obtener datos base de nuestra BD
      const dbResponse = await this.getCallHistory({ ...(filters || {}), enrich: 1 } as any);

      if (!dbResponse.success || !dbResponse.calls) {
        return dbResponse;
      }

      console.log(`📊 [HYBRID] Found ${dbResponse.calls.length} calls in database`);

      // 2. Enriquecer con datos de ElevenLabs para llamadas que tienen conversation_id
      const enrichedCalls = await Promise.all(
        dbResponse.calls.map(async (call) => {
          try {
            // Solo intentar enriquecer si tenemos elevenlabs_conversation_id
            if ((call as any).elevenlabs_conversation_id) {
              const cacheKey = `conversation_${call.elevenlabs_conversation_id}`;

              // Primero verificar caché
              let elevenLabsData = this.getCachedData(cacheKey);

              if (!elevenLabsData) {
                console.log(`🔍 [HYBRID] Enriching call ${call.id} with ElevenLabs data...`);

                const { getConversationDetails } = await import('./elevenLabsService');
                elevenLabsData = await getConversationDetails(
                  (call as any).elevenlabs_conversation_id,
                );

                // Guardar en caché solo si obtuvimos datos válidos
                if (elevenLabsData) {
                  this.setCachedData(cacheKey, elevenLabsData);
                }
              } else {
                console.log(`💾 [HYBRID] Using cached data for call ${call.id}`);
              }

              if (elevenLabsData) {
                console.log(`✅ [HYBRID] Enriched call ${call.id} with ElevenLabs data`);

                // Combinar datos de BD con datos de ElevenLabs
                return {
                  ...call,
                  // Mantener datos de BD como prioritarios
                  duration_seconds:
                    (call as any).duration_seconds ||
                    elevenLabsData.metadata?.call_duration_secs ||
                    0,
                  call_transcript:
                    (call as any).call_transcript || elevenLabsData.transcript || null,
                  call_recording_url:
                    (call as any).call_recording_url ||
                    (elevenLabsData as any).recording_url ||
                    null,
                  call_result:
                    (call as any).call_result ||
                    (elevenLabsData.analysis?.call_successful ? 'completed' : 'failed'),
                  // Datos adicionales de ElevenLabs
                  elevenlabs_cost: elevenLabsData.metadata?.cost || 0,
                  elevenlabs_analysis: elevenLabsData.analysis || null,
                  elevenlabs_metadata: elevenLabsData.metadata || null,
                  // Marcar como enriquecido
                  is_enriched: true,
                };
              }
            }

            // Si no se puede enriquecer, devolver datos originales
            return {
              ...call,
              is_enriched: false,
            };
          } catch (enrichError) {
            console.warn(`⚠️ [HYBRID] Failed to enrich call ${call.id}:`, enrichError);
            return {
              ...call,
              is_enriched: false,
            };
          }
        }),
      );

      const enrichedCount = enrichedCalls.filter((call: any) => call.is_enriched).length;
      console.log(
        `✅ [HYBRID] Enriched ${enrichedCount}/${dbResponse.calls.length} calls with ElevenLabs data`,
      );

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
      console.error('❌ [HYBRID] Error getting hybrid call history:', error);

      // Fallback a solo datos de BD
      return this.getCallHistory(filters);
    }
  }

  /**
   * Obtener estadísticas híbridas (BD + ElevenLabs)
   */
  async getHybridVoiceCampaignStats(): Promise<{
    success: boolean;
    stats?: any;
    message?: string;
    metadata?: {
      source: 'database' | 'hybrid';
      elevenlabs_enriched: boolean;
      enrichment_errors: string[];
    };
  }> {
    try {
      console.log('🔄 [HYBRID STATS] Loading hybrid statistics...');

      // 1. Obtener estadísticas base de nuestra BD
      const dbStatsResponse = await this.getVoiceCampaignStats();

      if (!dbStatsResponse.success || !dbStatsResponse.stats) {
        return dbStatsResponse;
      }

      const dbStats = dbStatsResponse.stats;
      console.log('📊 [HYBRID STATS] Base DB stats loaded:', dbStats);

      // 2. Obtener datos enriquecidos de ElevenLabs si es posible
      let elevenlabsEnriched = false;
      const enrichmentErrors: string[] = [];
      let hybridStats = { ...dbStats };

      try {
        // Usar el método híbrido de llamadas para obtener datos más ricos
        const hybridCallsResponse = await this.getHybridCallHistory({ limit: 1000 });

        if (hybridCallsResponse.success && hybridCallsResponse.calls) {
          const enrichedCalls = hybridCallsResponse.calls.filter((call: any) => call.is_enriched);

          if (enrichedCalls.length > 0) {
            console.log(
              `📈 [HYBRID STATS] Found ${enrichedCalls.length} enriched calls for enhanced stats`,
            );

            // Calcular estadísticas mejoradas basadas en datos de ElevenLabs
            const totalElevenLabsCost = enrichedCalls.reduce(
              (sum: number, call: any) => sum + (call.elevenlabs_cost || 0),
              0,
            );

            const avgElevenLabsCost =
              enrichedCalls.length > 0 ? totalElevenLabsCost / enrichedCalls.length : 0;

            // Calcular duración total más precisa de ElevenLabs
            const totalElevenLabsDuration = enrichedCalls.reduce(
              (sum: number, call: any) =>
                sum + (call.elevenlabs_metadata?.call_duration_secs || call.duration_seconds || 0),
              0,
            );

            const avgElevenLabsDuration =
              enrichedCalls.length > 0
                ? totalElevenLabsDuration / enrichedCalls.length
                : (dbStats as any).average_duration_seconds || 0;

            // Análisis de éxito basado en ElevenLabs
            const successfulElevenLabsCalls = enrichedCalls.filter(
              (call: any) => call.elevenlabs_analysis?.call_successful === true,
            ).length;

            // Combinar estadísticas de BD con enriquecimiento de ElevenLabs
            hybridStats = {
              ...dbStats,
              // Mejorar con datos de ElevenLabs donde estén disponibles
              total_calls: Math.max(
                (dbStats as any).total_calls_made || (dbStats as any).total_calls || 0,
                hybridCallsResponse.calls.length,
              ),
              successful_calls: Math.max(
                (dbStats as any).total_successful_calls || (dbStats as any).successful_calls || 0,
                successfulElevenLabsCalls,
              ),
              avg_call_duration:
                avgElevenLabsDuration > 0
                  ? avgElevenLabsDuration
                  : (dbStats as any).average_duration_seconds ||
                    (dbStats as any).avg_call_duration ||
                    0,
              // omit total_duration_seconds (no está en el tipo público)
              // Datos adicionales de ElevenLabs (no tipados en interfaz pública)
              // Se omiten para mantener compatibilidad de tipos
            };

            // Recalcular tasa de éxito general
            hybridStats.overall_success_rate =
              (hybridStats as any).total_calls > 0
                ? ((hybridStats as any).successful_calls / (hybridStats as any).total_calls) * 100
                : 0;

            elevenlabsEnriched = true;
          }
        }
      } catch (enrichError: any) {
        console.warn('⚠️ [HYBRID STATS] ElevenLabs enrichment failed:', enrichError);
        enrichmentErrors.push(enrichError.message || 'Unknown enrichment error');
      }

      console.log(
        `✅ [HYBRID STATS] Stats computed. Enriched: ${elevenlabsEnriched}, Errors: ${enrichmentErrors.length}`,
      );

      return {
        success: true,
        stats: hybridStats,
        metadata: {
          source: elevenlabsEnriched ? 'hybrid' : 'database',
          elevenlabs_enriched: elevenlabsEnriched,
          enrichment_errors: enrichmentErrors,
        },
      };
    } catch (error: any) {
      console.error('❌ [HYBRID STATS] Error getting hybrid stats:', error);

      // Fallback a solo estadísticas de BD
      return this.getVoiceCampaignStats();
    }
  }

  // ========================
  // PRUEBAS DE LLAMADAS
  // ========================

  /**
   * Realizar prueba de llamada con ElevenLabs
   */
  async testCall(request: TestCallRequest): Promise<{
    success: boolean;
    message: string;
    call_id?: string;
    call_data?: any;
  }> {
    try {
      console.log('🧪 [VOICE CAMPAIGN] Testing call:', request);

      const response = await this.makeRequest('/saas/voice-campaigns/test-call', 'POST', request);

      console.log('✅ [VOICE CAMPAIGN] Test call completed:', response);

      return {
        success: true,
        message: response.message || 'Llamada de prueba realizada exitosamente',
        call_id: response.call_id || response.data?.call_id,
        call_data: response.data || response,
      };
    } catch (error) {
      console.error('❌ [VOICE CAMPAIGN] Error in test call:', error);
      return {
        success: false,
        message: `Error en llamada de prueba: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      };
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
      console.log('🔊 [VOICE CAMPAIGN UPDATE] Updating campaign', { id, campaignData });

      const response = await this.makeRequest(`voice-campaigns/${id}`, 'PUT', campaignData);

      console.log('✅ [VOICE CAMPAIGN UPDATE] Campaign updated successfully', response);

      return {
        success: true,
        campaign: response.campaign,
        message: response.message || 'Campaña actualizada exitosamente',
      };
    } catch (error: any) {
      console.error('❌ [VOICE CAMPAIGN UPDATE] Error updating campaign:', error);

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
      console.log('🔊 [VOICE CAMPAIGN DELETE] Deleting campaign', { id });

      const response = await this.makeRequest(`voice-campaigns/${id}`, 'DELETE');

      console.log('✅ [VOICE CAMPAIGN DELETE] Campaign deleted successfully', response);

      return {
        success: true,
        message: response.message || 'Campaña eliminada exitosamente',
      };
    } catch (error: any) {
      console.error('❌ [VOICE CAMPAIGN DELETE] Error deleting campaign:', error);

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
