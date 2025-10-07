import React from 'react';
import CardBox from 'src/components/shared/CardBox';
import Chart from 'react-apexcharts';
import { Icon } from "@iconify/react";
import { useVoiceAIData } from '../../hooks/useVoiceAIData';

const ConversationChart = () => {
  const { realStats, isLoading, error } = useVoiceAIData();

  if (error) {
    return (
      <CardBox>
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <Icon icon="solar:danger-circle-bold" className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 font-medium">Error al cargar idiomas</p>
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        </div>
      </CardBox>
    );
  }

  if (isLoading) {
    return (
      <CardBox>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="h-5 bg-gray-200 rounded w-40 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-60 animate-pulse"></div>
          </div>
        </div>
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
        </div>
      </CardBox>
    );
  }

  // Si no hay datos, mostrar mensaje
  if (realStats.totalCalls === 0) {
    return (
      <CardBox>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h5 className="text-lg font-semibold">Idioma</h5>
            <p className="text-sm text-gray-600">Distribución de idiomas en conversaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:global-bold-duotone" width={20} className="text-indigo-600" />
          </div>
        </div>
        
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <Icon icon="solar:global-outline" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Sin datos de idioma</h3>
            <p className="text-gray-500">
              La distribución de idiomas aparecerá cuando se registren conversaciones
            </p>
          </div>
        </div>
      </CardBox>
    );
  }

  // Datos de idiomas (para el contexto de seguros en México, principalmente español)
  const languageData = [
    { name: 'Español', value: 100.0, color: '#3B82F6' },
    // Se puede agregar otros idiomas en el futuro
  ];

  const ChartData: any = {
    series: languageData.map(lang => lang.value),
    labels: languageData.map(lang => lang.name),
    
    chart: {
      type: 'donut',
      height: 300,
      fontFamily: "inherit",
      foreColor: "#adb0bb",
    },
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '16px',
              fontWeight: 600,
              color: undefined,
              offsetY: -10,
              formatter: function (val: string) {
                return val;
              }
            },
            value: {
              show: true,
              fontSize: '24px',
              fontWeight: 700,
              color: '#3B82F6',
              offsetY: 10,
              formatter: function (val: string) {
                return val + '%';
              }
            },
            total: {
              show: true,
              showAlways: false,
              label: 'Total',
              fontSize: '14px',
              fontWeight: 400,
              color: '#9CA3AF',
              formatter: function (w: any) {
                return '100%';
              }
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
    stroke: {
      width: 2,
      colors: ['#ffffff']
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: function (val: number) {
          return val.toFixed(1) + "% de conversaciones";
        }
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          height: 250
        },
        plotOptions: {
          pie: {
            donut: {
              labels: {
                value: {
                  fontSize: '20px'
                }
              }
            }
          }
        }
      }
    }]
  };

  return (
    <CardBox>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Idioma</h5>
          <p className="text-sm text-gray-600 dark:text-gray-400">Distribución de idiomas en conversaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="solar:global-bold-duotone" width={20} className="text-indigo-600" />
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Gráfico */}
        <div className="flex-1 flex justify-center">
          <Chart
            options={ChartData}
            series={ChartData.series}
            type="donut"
            height="300px"
            width="300px"
          />
        </div>

        {/* Lista de idiomas */}
        <div className="flex-1 space-y-4">
          {languageData.map((lang, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: lang.color }}
                ></div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{lang.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Icon icon="solar:flag-bold-duotone" className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Idioma principal</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-gray-900 dark:text-white">{lang.value}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {realStats.totalCalls} llamadas
                </div>
              </div>
            </div>
          ))}
          
          {/* Información adicional */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-800 dark:text-blue-200">Configuración de idioma</span>
            </div>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Todos los agentes están configurados para conversar en español, 
              optimizados para el mercado mexicano de seguros.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex gap-6 items-center text-sm">
          <div className="flex items-center gap-2">
            <Icon icon="solar:chat-round-bold-duotone" className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Total de conversaciones: {realStats.totalCalls}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-green-500" />
            <span className="text-gray-600 dark:text-gray-400">Detección automática: Activa</span>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-blue-600">Monolingüe optimizado</span>
        </div>
      </div>
    </CardBox>
  );
};

export default ConversationChart; 