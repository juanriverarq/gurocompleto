import React, { useEffect, useMemo, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import Chart from 'react-apexcharts';
import { Icon } from "@iconify/react";
import { useVoiceAIData } from '../../hooks/useVoiceAIData';
import voiceCampaignService from '../../../../services/voiceCampaignService';

const CallsChart = () => {
  const { realStats, isLoading, error } = useVoiceAIData();

  // Hooks de datos diarios (deben declararse SIEMPRE antes de cualquier return condicional)
  const [dailyCategories, setDailyCategories] = useState<string[]>([]);
  const [dailyTotals, setDailyTotals] = useState<number[]>([]);
  const [dailySuccess, setDailySuccess] = useState<number[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await voiceCampaignService.getHybridCallHistory({ limit: 1000 });
        const calls = res?.success && Array.isArray(res.calls) ? res.calls : [];

        const today = new Date();
        const days: string[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setHours(12, 0, 0, 0);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          days.push(key);
        }
        const map: Record<string, { total: number; success: number }> = Object.fromEntries(
          days.map(k => [k, { total: 0, success: 0 }])
        );

        calls.forEach((call: any) => {
          const ts = call.call_initiated_at || call.created_at;
          if (!ts) return;
          const d = new Date(ts);
          d.setHours(12, 0, 0, 0);
          const key = d.toISOString().slice(0, 10);
          if (!map[key]) return;

          map[key].total += 1;
          const success = (call.status === 'completed') ||
            (typeof call.call_result === 'string' && ['success','completed','answered'].includes(call.call_result)) ||
            (typeof call.call_result === 'object' && (call.call_result?.result === 'success'));
          if (success) map[key].success += 1;
        });

        if (!isMounted) return;
        setDailyCategories(days);
        setDailyTotals(days.map(d => map[d]?.total || 0));
        setDailySuccess(days.map(d => map[d]?.success || 0));
      } catch (_) {
        if (!isMounted) return;
        const today = new Date();
        const days: string[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setHours(12, 0, 0, 0);
          d.setDate(d.getDate() - i);
          days.push(d.toISOString().slice(0, 10));
        }
        setDailyCategories(days);
        setDailyTotals(Array(30).fill(0));
        setDailySuccess(Array(30).fill(0));
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  if (error) {
    return (
      <CardBox>
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <Icon icon="solar:danger-circle-bold" className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 font-medium">Error al cargar datos de llamadas</p>
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
        </div>
      </CardBox>
    );
  }


  // Si no hay datos, mostrar gráfico vacío con mensaje
  if (realStats.totalCalls === 0) {
    return (
      <CardBox>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h5 className="text-lg font-semibold">Actividad de Llamadas</h5>
            <p className="text-sm text-gray-600">Seguimiento diario de conversaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:chart-2-bold-duotone" width={20} className="text-blue-600" />
          </div>
        </div>
        
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <Icon icon="solar:graph-outline" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Sin datos de llamadas</h3>
            <p className="text-gray-500">
              Los gráficos aparecerán cuando se registren las primeras conversaciones
            </p>
          </div>
        </div>
      </CardBox>
    );
  }

  const ChartData: any = {
    series: [
      {
        name: "Llamadas totales",
        data: dailyTotals,
      },
      {
        name: "Llamadas exitosas",
        data: dailySuccess,
      }
    ],

    chart: {
      id: 'calls-area-chart',
      fontFamily: 'inherit',
      foreColor: '#adb0bb',
      zoom: {
        enabled: true,
      },
      toolbar: {
        show: false,
      },
      height: 350,
      type: "area",
    },
    dataLabels: {
      enabled: false,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.2,
        opacity: 0.1,
        stops: [100],
      },
    },
    stroke: {
      width: '3',
      curve: 'smooth',
    },
    colors: ["var(--color-primary)", "var(--color-secondary)"],
    xaxis: {
      type: 'category',
      categories: dailyCategories,
      axisBorder: {
        color: "rgba(173,181,189,0.3)",
      },
      labels: {
        style: {
          fontSize: '12px'
        },
        formatter: (val: any) => {
          const s = typeof val === 'string' ? val : (val != null ? String(val) : '');
          if (!s || s.indexOf('-') === -1) return s || '';
          const parts = s.split('-');
          if (parts.length < 3) return s;
          const [y, m, d] = parts;
          return `${d}/${m}`;
        },
      }
    },
    yaxis: {
      opposite: false,
      labels: {
        show: true,
        formatter: function (val: number) {
          return Math.round(val).toString();
        },
      },
      title: {
        text: 'Número de llamadas',
        style: {
          fontSize: '12px',
          fontWeight: 500
        }
      }
    },
    legend: {
      show: true,
      position: 'bottom',
      width: '50px',
    },
    grid: {
      show: false,
    },
    tooltip: {
      theme: "dark",
      fillSeriesColor: false,
      y: {
        formatter: function (val: number) {
          return val + " llamadas";
        }
      },
      x: { formatter: (val: any) => (val != null ? String(val) : '') }
    },
  };

  return (
    <CardBox>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Actividad de Llamadas</h5>
          <p className="text-sm text-gray-600 dark:text-gray-400">Evolución diaria de conversaciones (últimos 30 días)</p>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="solar:chart-2-bold-duotone" width={20} className="text-blue-600" />
        </div>
      </div>
      
      <div className="-mx-2">
        <Chart
          options={ChartData}
          series={ChartData.series}
          type="area"
          height="350px"
          width="100%"
        />
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex gap-6 items-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Total: {realStats.totalCalls} llamadas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Exitosas: {Math.floor(realStats.totalCalls * (realStats.conversionRate / 100))} llamadas</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:clock-circle-bold-duotone" className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Duración promedio: {realStats.avgDuration}</span>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-blue-600">Datos en tiempo real</span>
        </div>
      </div>
    </CardBox>
  );
};

export default CallsChart; 