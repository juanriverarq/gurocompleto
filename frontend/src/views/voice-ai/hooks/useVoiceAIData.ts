import { useState, useEffect, useCallback } from 'react';
import { 
  getConversationalAgents, 
  calculateTwilioCost,
  calculateProfit
} from '../../../services/elevenLabsService';
import voiceCampaignService from '../../../services/voiceCampaignService';

interface RealStats {
  totalCalls: number;
  successfulCalls: number;
  activeAgents: number;
  avgDuration: string;
  conversionRate: number;
  totalRevenue: number;
  totalCost: number;
  totalCostCredits: number;
  totalTwilioCost: number;
  totalTwilioMinutes: number;
  totalProfit: number;
  totalRevenueWithProfit: number;
  avgCostPerCall: number;
  avgTwilioCostPerCall: number;
  avgProfitPerCall: number;
  sentimentData: {
    positive: number;
    neutral: number;
    negative: number;
  };
  monthlyData: Array<{
    month: string;
    totalCalls: number;
    successfulCalls: number;
  }>;
  agentPerformance: Array<{
    name: string;
    conversionRate: number;
  }>;
  // Datos híbridos de VAPI
  vapiEnriched?: number;
  vapiCost?: number;
  vapiSuccessRate?: number;
  // Agregados correctos desde backend (COP)
  combined_cost_with_markup_cop?: number;
  avg_cost_with_markup_cop?: number;
}

export const useVoiceAIData = () => {
  const [realStats, setRealStats] = useState<RealStats>({
    totalCalls: 0,
    successfulCalls: 0,
    activeAgents: 0,
    avgDuration: '0:00',
    conversionRate: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalCostCredits: 0,
    totalTwilioCost: 0,
    totalTwilioMinutes: 0,
    totalProfit: 0,
    totalRevenueWithProfit: 0,
    avgCostPerCall: 0,
    avgTwilioCostPerCall: 0,
    avgProfitPerCall: 0,
    sentimentData: {
      positive: 0,
      neutral: 0,
      negative: 0
    },
    monthlyData: [],
    agentPerformance: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRealData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Cargar datos reales en paralelo desde nuestro backend (usando sistema híbrido)
      const [agentsData, campaignStatsData, callHistoryData] = await Promise.all([
        getConversationalAgents().catch(err => {          return [];
        }),
        voiceCampaignService.getHybridVoiceCampaignStats().catch(err => {          // Fallback a estadísticas normales
          return voiceCampaignService.getVoiceCampaignStats().catch(() => ({ success: false, stats: null }));
        }),
        voiceCampaignService.getHybridCallHistory({ limit: 1000 }).catch(err => {          // Fallback a solo BD
          return voiceCampaignService.getCallHistory({ limit: 1000 }).catch(() => ({ success: false, calls: [] }));
        })
      ]);

      const agents = Array.isArray(agentsData) ? agentsData : [];
      const campaignStats = campaignStatsData?.success ? campaignStatsData.stats : null;
      const calls = callHistoryData?.success ? callHistoryData.calls || [] : [];
      // Usar estadísticas del backend si están disponibles, sino calcular desde las llamadas
      let totalCalls, successfulCalls, avgDurationSecs, totalCost, totalTwilioCost;

      if (campaignStats && campaignStats.total_calls_made > 0) {
        // Usar datos del backend cuando hay información útil
        totalCalls = campaignStats.total_calls_made;
        successfulCalls = campaignStats.total_successful_calls || 0;
        avgDurationSecs = campaignStats.average_duration_seconds || 0;      } else {
        // Calcular desde las llamadas individuales
        totalCalls = calls.length;
        successfulCalls = calls.filter(call => {
          // Considerar exitosa si el call_result o status indica éxito
          return call.call_result === 'completed' || 
                 call.call_result === 'successful' ||
                 call.call_result === 'answered' ||
                 call.status === 'completed';
        }).length;
        
        const totalDurationSecs = calls.reduce((acc, call) => 
          acc + (call.duration_seconds || 0), 0
        );
        avgDurationSecs = totalCalls > 0 ? totalDurationSecs / totalCalls : 0;      }

      const avgDuration = `${Math.floor(avgDurationSecs / 60)}:${String(Math.floor(avgDurationSecs % 60)).padStart(2, '0')}`;
      const conversionRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
      
      // Calcular costos desde las llamadas usando valores del backend cuando existan
      // Sumas en COP con margen (preferidas)
      const combinedWithMarkupCopSum = calls.reduce((acc: number, call: any) => {
        const costs = (call as any).costs || {};
        const val = Number(costs.total_with_markup_cop ?? costs.total_cop ?? 0);
        return acc + (isFinite(val) ? val : 0);
      }, 0);

      // Para compatibilidad, mantener cálculos estimados USD si no hay costos del backend
      const totalCostCredits = calls.reduce((acc, call) => {
        const durationMinutes = (call.duration_seconds || 0) / 60;
        return acc + (durationMinutes * 100);
      }, 0);
      const avgCostPerCall = totalCalls > 0 ? totalCostCredits / totalCalls : 0;
      // Usar tasa oficial actualizada 0.0003 si fuese necesario; dejamos 0.000198 para compatibilidad
      totalCost = totalCostCredits * 0.000198;

      // Calcular Twilio estimado (fallback)
      totalTwilioCost = calls.reduce((acc, call) => acc + calculateTwilioCost(call.duration_seconds || 0), 0);
      const totalTwilioMinutes = calls.reduce((acc, call) => {
        return acc + Math.ceil((call.duration_seconds || 0) / 60);
      }, 0);
      const avgTwilioCostPerCall = totalCalls > 0 ? totalTwilioCost / totalCalls : 0;
      
      // Calcular ganancias (40% sobre costos totales)
      const totalCombinedCost = totalCost + totalTwilioCost;
      const totalProfit = calculateProfit(totalCombinedCost);
      const totalRevenueWithProfit = totalCombinedCost + totalProfit;
      const avgProfitPerCall = totalCalls > 0 ? totalProfit / totalCalls : 0;
      
      const totalRevenue = successfulCalls * 50; // $50 por conversión estimado

      // Análisis de sentimiento básico (distribuir proporcionalmente)
      const sentimentData = {
        positive: Math.round(successfulCalls * 0.7),
        neutral: Math.round((totalCalls - successfulCalls) * 0.6),
        negative: Math.round((totalCalls - successfulCalls) * 0.4)
      };

      // Agrupar por mes (últimos 12 meses)
      const monthlyData: Array<{month: string, totalCalls: number, successfulCalls: number}> = [];
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      
      for (let i = 0; i < 12; i++) {
        const monthIndex = (new Date().getMonth() - i + 12) % 12;
        monthlyData.unshift({
          month: months[monthIndex],
          totalCalls: 0,
          successfulCalls: 0
        });
      }

      // Distribuir llamadas por mes
      calls.forEach(call => {
        if (call.call_initiated_at || call.created_at) {
          const callDate = new Date(call.call_initiated_at || call.created_at);
          const monthIndex = callDate.getMonth();
          const dataEntry = monthlyData.find(m => m.month === months[monthIndex]);
          if (dataEntry) {
            dataEntry.totalCalls++;
            if (call.status === 'completed' && call.is_successful) {
              dataEntry.successfulCalls++;
            }
          }
        }
      });

      // Performance por agente (basado en agentes reales)
      const agentPerformance = agents.map(agent => ({
        name: agent.name || 'Agente sin nombre',
        conversionRate: Math.random() * 100 // Temporal hasta tener datos reales por agente
      }));

      const finalStats = {
        totalCalls,
        successfulCalls,
        activeAgents: agents.length,
        avgDuration,
        conversionRate: Math.round(conversionRate * 10) / 10,
        totalRevenue,
        totalCost: Math.round(totalCost * 100) / 100,
        totalCostCredits: Math.round(totalCostCredits),
        totalTwilioCost: Math.round(totalTwilioCost * 100) / 100,
        totalTwilioMinutes,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalRevenueWithProfit: Math.round(totalRevenueWithProfit * 100) / 100,
        avgCostPerCall: Math.round(avgCostPerCall * 100) / 100,
        avgTwilioCostPerCall: Math.round(avgTwilioCostPerCall * 100) / 100,
        avgProfitPerCall: Math.round(avgProfitPerCall * 100) / 100,
        sentimentData,
        monthlyData,
        agentPerformance,
        // Datos híbridos de VAPI
        vapiEnriched: campaignStats?.vapi_enriched_calls || campaignStats?.elevenlabs_enriched_calls || 0,
        vapiCost: campaignStats?.vapi_total_cost || campaignStats?.elevenlabs_total_cost || 0,
        vapiSuccessRate: campaignStats?.vapi_success_rate || campaignStats?.elevenlabs_success_rate || 0,
        // Agregados precisos en COP con margen desde backend
        combined_cost_with_markup_cop: Math.round(combinedWithMarkupCopSum * 100) / 100,
        avg_cost_with_markup_cop: Math.round(((totalCalls > 0 ? combinedWithMarkupCopSum / totalCalls : 0) * 100)) / 100,
      };      setRealStats(finalStats);

    } catch (error) {      setError('Error al cargar datos del sistema');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRealData();
  }, [loadRealData]);

  return {
    realStats,
    isLoading,
    error,
    refreshData: loadRealData
  };
}; 