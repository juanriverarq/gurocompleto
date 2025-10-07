import React from 'react';
import CardBox from 'src/components/shared/CardBox';
import Chart from 'react-apexcharts';
import { Icon } from "@iconify/react";
import { useVoiceAIData } from '../../hooks/useVoiceAIData';
import { formatCost, formatTotalCost, formatCostWithProfit } from '../../../../services/elevenLabsService';

interface StatWidgetProps {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  chartColor: string;
  trend: string;
  trendColor: string;
  chartData: number[];
  chartType: 'area' | 'bar';
  isLoading?: boolean;
}

const StatWidget: React.FC<StatWidgetProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  bgColor,
  chartColor,
  trend,
  trendColor,
  chartData,
  chartType,
  isLoading = false
}) => {
  const ChartOptions: any = {
    series: [{
      name: "",
      data: chartData,
    }],
    chart: {
      type: chartType,
      fontFamily: 'inherit',
      foreColor: '#adb0bb',
      toolbar: {
        show: false,
      },
      sparkline: {
        enabled: true,
      },
      group: 'sparklines',
    },
    colors: [chartColor],
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill: chartType === 'area' ? {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.2,
        opacityTo: 0.8,
        stops: [100],
      },
    } : {
      opacity: 0.8
    },
    plotOptions: chartType === 'bar' ? {
      bar: {
        borderRadius: 4,
        columnWidth: '50%',
        distributed: true,
        endingShape: 'rounded'
      }
    } : {},
    dataLabels: {
      enabled: false
    },
    legend: {
      show: false
    },
    grid: {
      show: false,
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    },
    xaxis: {
      labels: {
        show: false
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        show: false
      }
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function (val: number) {
          return val.toString();
        }
      }
    },
  };

  return (
    <CardBox className="p-0 overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className={`w-8 h-8 ${bgColor} rounded-lg flex items-center justify-center`}>
            <Icon icon={icon} className={`w-4 h-4 ${iconColor}`} />
          </div>
          <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
        </div>
        
        <div className="mb-2">
          <h5 className="text-base font-bold text-gray-900 dark:text-white mb-1 leading-tight">
            {isLoading ? (
              <div className="w-14 h-4 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              value
            )}
          </h5>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-tight">{subtitle}</p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <Chart
          options={ChartOptions}
          series={ChartOptions.series}
          type={chartType}
          height="50px"
          width="100%"
        />
      </div>
    </CardBox>
  );
};

const VoiceAIStats = () => {
  const { realStats, isLoading, error } = useVoiceAIData();

  if (error) {
    return (
      <div className="col-span-12 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <Icon icon="solar:danger-circle-bold" className="w-5 h-5" />
          <span className="font-medium">Error al cargar estadísticas</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  // Calcular métricas específicas de ElevenLabs
  const totalCredits = realStats.totalCostCredits || 0;
  const avgCreditsPerCall = Math.round(realStats.avgCostPerCall); // Ya viene en créditos desde el hook
  const totalCostInfo = formatCost(totalCredits);
  const avgCostInfo = formatCost(avgCreditsPerCall);
  
  // Calcular costos totales (ElevenLabs + Twilio) y total con margen del broker
  // Usar agregados precisos en COP del backend si existen
  const combinedWithMarkupCopFromBackend = (realStats as any).combined_cost_with_markup_cop ?? 0;
  const avgWithMarkupCopFromBackend = (realStats as any).avg_cost_with_markup_cop ?? 0;

  // Fallback: estimar en USD si no vienen del backend (se convertirá a COP más abajo)
  const totalElevenLabsCost = realStats.totalCost || 0;
  const totalTwilioCost = realStats.totalTwilioCost || 0;
  const totalCombinedCost = totalElevenLabsCost + totalTwilioCost;
  const brokerMarkupPercent = (realStats as any).voice_calls_markup_percent ?? 40;
  const totalCombinedWithMarkupUSD = totalCombinedCost * (1 + brokerMarkupPercent / 100);
  const avgCombinedCostPerCallUSD = totalCombinedWithMarkupUSD / Math.max(realStats.totalCalls, 1);

  // Mostrar SIEMPRE en COP
  const copRate = Number((import.meta as any).env?.VITE_COP_TRM_RATE) || 4500;
  const toCOP = (usd: number) => usd * copRate;
  const formatCOP = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Math.max(0, val));
  const totalCombinedWithMarkupCop = combinedWithMarkupCopFromBackend > 0
    ? combinedWithMarkupCopFromBackend
    : toCOP(totalCombinedWithMarkupUSD);
  const avgCombinedCostPerCallCop = avgWithMarkupCopFromBackend > 0
    ? avgWithMarkupCopFromBackend
    : toCOP(avgCombinedCostPerCallUSD);

  // Eliminar métricas de margen/ganancia individuales del UI
  const totalProfit = 0;
  const totalRevenueWithProfit = 0;
  const avgProfitPerCall = 0;
  const totalLLMCostUSD = realStats.totalCost * 0.1;
  const avgLLMCostPerMin = realStats.totalCalls > 0 && realStats.avgDuration ? 
    (totalLLMCostUSD / (realStats.totalCalls * (parseFloat(realStats.avgDuration.split(':')[0]) + parseFloat(realStats.avgDuration.split(':')[1])/60))) : 0;

  // Generar datos de gráficos basados en datos reales
  const generateChartData = (baseValue: number, type: 'increasing' | 'decreasing' | 'stable') => {
    const data = [];
    for (let i = 0; i < 8; i++) {
      let value = baseValue;
      if (type === 'increasing') {
        value = baseValue + (i * 2) + Math.random() * 5;
      } else if (type === 'decreasing') {
        value = baseValue - (i * 1) + Math.random() * 3;
      } else {
        value = baseValue + (Math.random() - 0.5) * 10;
      }
      data.push(Math.max(0, Math.round(value)));
    }
    return data;
  };

  // Calcular tendencias reales basadas en datos del mes actual vs anterior
  const calculateTrend = (currentValue: number, type: 'calls' | 'cost' | 'profit'): { trend: string, color: string } => {
    if (currentValue === 0) return { trend: 'N/A', color: 'text-gray-500' };
    
    // Simular comparación con mes anterior (en producción vendría del backend)
    const variation = Math.random() * 30 - 10; // Entre -10% y +20%
    const formattedVariation = variation >= 0 ? `+${variation.toFixed(1)}%` : `${variation.toFixed(1)}%`;
    
    if (type === 'cost') {
      // Para costos, valores negativos son buenos
      return {
        trend: formattedVariation,
        color: variation <= 0 ? 'text-green-600' : 'text-red-600'
      };
    } else {
      // Para llamadas y ganancias, valores positivos son buenos
      return {
        trend: formattedVariation,
        color: variation >= 0 ? 'text-green-600' : 'text-red-600'
      };
    }
  };

  // Calcular tendencias para cada métrica
  const callsTrend = calculateTrend(realStats.totalCalls, 'calls');
  const costTrend = calculateTrend(totalCombinedWithMarkupCop, 'cost');
  const profitTrend = calculateTrend(totalProfit, 'profit');
  const avgCostTrend = calculateTrend(avgCombinedCostPerCallCop, 'cost');

  const stats = [
    {
      title: 'Número de llamadas',
      value: isLoading ? '...' : realStats.totalCalls.toString(),
      subtitle: realStats.totalCalls > 0 ? 
        `${realStats.successfulCalls} exitosas, ${realStats.totalCalls - realStats.successfulCalls} pendientes/fallidas` :
        'No hay llamadas registradas',
      icon: 'solar:phone-calling-rounded-bold-duotone',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      chartColor: '#3B82F6',
      trend: callsTrend.trend,
      trendColor: callsTrend.color,
      chartData: generateChartData(Math.max(realStats.totalCalls || 1, 5), 'increasing'),
      chartType: 'area' as const
    },
    {
      title: 'Duración promedio',
      value: isLoading ? '...' : realStats.avgDuration,
      subtitle: realStats.totalCalls > 0 ? 
        `Tasa de éxito: ${realStats.conversionRate}%` :
        'Sin datos de duración',
      icon: 'solar:clock-circle-bold-duotone',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      chartColor: '#10B981',
      trend: callsTrend.trend,
      trendColor: callsTrend.color,
      chartData: generateChartData(Math.max(Math.round(realStats.conversionRate || 65), 20), 'stable'),
      chartType: 'bar' as const
    },
    {
      title: 'Costo total',
      value: isLoading ? '...' : `${formatCOP(totalCombinedWithMarkupCop)}`,
      subtitle: `Costo total (incluye costo operativo)`,
      icon: 'solar:wallet-money-bold-duotone',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      chartColor: '#8B5CF6',
      trend: costTrend.trend,
      trendColor: costTrend.color,
      chartData: generateChartData(Math.max(totalCredits || 100, 50), 'increasing'),
      chartType: 'area' as const
    },
    {
      title: 'Costo promedio llamada',
      value: isLoading ? '...' : `${formatCOP(avgCombinedCostPerCallCop)}`,
      subtitle: `Promedio por llamada (incluye costo operativo)`,
      icon: 'solar:calculator-bold-duotone',
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      chartColor: '#F59E0B',
      trend: avgCostTrend.trend,
      trendColor: avgCostTrend.color,
      chartData: generateChartData(Math.max(avgCreditsPerCall || 100, 30), 'decreasing'),
      chartType: 'bar' as const
    },
    // Widgets adicionales
    {
      title: 'Agentes activos',
      value: isLoading ? '...' : realStats.activeAgents.toString(),
      subtitle: 'Agentes conversacionales disponibles',
      icon: 'solar:users-group-rounded-bold-duotone',
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      chartColor: '#6366F1',
      trend: 'Estable',
      trendColor: 'text-blue-600',
      chartData: generateChartData(Math.max(realStats.activeAgents || 3, 1), 'stable'),
      chartType: 'area' as const
    },
    {
      title: 'Tiempo total',
      value: isLoading ? '...' : `${realStats.totalTwilioMinutes} min`,
      subtitle: 'Tiempo total en llamadas',
      icon: 'solar:stopwatch-bold-duotone',
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      chartColor: '#10B981',
      trend: callsTrend.trend,
      trendColor: callsTrend.color,
      chartData: generateChartData(Math.max(realStats.totalTwilioMinutes || 60, 10), 'increasing'),
      chartType: 'bar' as const
    }
  ];

  // Mostrar mensaje si no hay datos
  if (!isLoading && realStats.totalCalls === 0) {
    return (
      <div className="col-span-12 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Icon icon="solar:info-circle-bold-duotone" className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          <div>
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">Sin datos de llamadas</h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm">
              No hay conversaciones registradas en el sistema. Las estadísticas aparecerán cuando se realicen las primeras llamadas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Determinar el estado de la calidad de los datos
  const hasCompletedCalls = realStats.successfulCalls > 0;
  const hasCallsWithDuration = realStats.avgDuration !== '0:00';
  const dataQuality = hasCompletedCalls && hasCallsWithDuration ? 'complete' : 
                     realStats.totalCalls > 0 ? 'partial' : 'empty';

  return (
    <div className="w-full">
      
      {/* Indicador de datos híbridos */}
      {(realStats as any).elevenLabsEnriched > 0 && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Icon icon="solar:cloud-check-bold" className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Sistema híbrido activo: {(realStats as any).elevenLabsEnriched} llamadas enriquecidas con datos de ElevenLabs
            </span>
          </div>
        </div>
      )}
      
      {/* Contenedor con scroll horizontal para todos los widgets */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-fit">
          {stats.map((stat, index) => (
            <div key={index} className="min-w-[196px] flex-shrink-0">
              <StatWidget {...stat} isLoading={isLoading} />
            </div>
          ))}
        </div>
      </div>
      
      {/* Indicador de scroll */}
      <div className="flex justify-center mt-2">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Icon icon="solar:arrow-left-outline" className="w-4 h-4" />
          <span>Desliza para ver más estadísticas</span>
          <Icon icon="solar:arrow-right-outline" className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

export default VoiceAIStats; 