import React from 'react';
import CardBox from 'src/components/shared/CardBox';
import { Icon } from "@iconify/react";
import { useVoiceAIData } from '../../hooks/useVoiceAIData';
import { formatCost, formatTotalCost, formatCostWithProfit } from '../../../services/elevenLabsService';

const VoiceAIBanner = () => {
  const { realStats, isLoading } = useVoiceAIData();
  
  // Obtener hora actual para el saludo
  const currentHour = new Date().getHours();
  const getGreeting = () => {
    if (currentHour < 12) return 'Buenos días';
    if (currentHour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Obtener periodo actual
  const getCurrentPeriod = () => {
    const now = new Date();
    const currentMonth = now.toLocaleDateString('es-ES', { month: 'long' });
    return `Este mes (${currentMonth})`;
  };

  return (
    <CardBox className="relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700"></div>
      <div className="absolute inset-0 bg-black/20"></div>
      
      {/* Patrón decorativo */}
      <div className="absolute top-0 right-0 w-96 h-96 opacity-10">
        <Icon icon="solar:phone-calling-rounded-bold-duotone" className="w-full h-full text-white" />
      </div>

      {/* Contenido */}
      <div className="relative z-10 p-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Información principal */}
          <div className="text-white">
            <div className="mb-2">
              <h1 className="text-3xl font-bold mb-1">Mi Workspace</h1>
              <p className="text-blue-100 text-lg">
                {getGreeting()}, Juan Rivera
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5 text-blue-200" />
                <span className="text-blue-100">Todos los agentes</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-blue-200" />
                <span className="text-blue-100">{getCurrentPeriod()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:global-bold-duotone" className="w-5 h-5 text-blue-200" />
                <span className="text-blue-100">Idioma: Español (100%)</span>
              </div>
            </div>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-white">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="text-2xl font-bold">
                {isLoading ? '...' : realStats.totalCalls}
              </div>
              <div className="text-blue-100 text-sm">Número de llamadas</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="text-2xl font-bold">
                {isLoading ? '...' : realStats.avgDuration}
              </div>
              <div className="text-blue-100 text-sm">Duración promedio</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="text-2xl font-bold">
                {isLoading ? '...' : `$${(realStats.totalCost + realStats.totalTwilioCost).toFixed(4)}`}
              </div>
              <div className="text-blue-100 text-sm">Costo total</div>
              <div className="text-blue-200 text-xs">EL: {formatCost(realStats.totalCostCredits).usd} | TW: ${realStats.totalTwilioCost?.toFixed(4) || '0.0000'}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="text-2xl font-bold text-green-300">
                {isLoading ? '...' : `$${realStats.totalProfit?.toFixed(4) || '0.0000'}`}
              </div>
              <div className="text-green-200 text-sm">Ganancia (40%)</div>
              <div className="text-green-300 text-xs">Margen de beneficio</div>
            </div>
          </div>
        </div>


      </div>
    </CardBox>
  );
};

export default VoiceAIBanner; 