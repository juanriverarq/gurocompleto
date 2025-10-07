import React, { useEffect, useMemo, useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import { Icon } from '@iconify/react';
import Chart from 'react-apexcharts';
import voiceCampaignService from 'src/services/voiceCampaignService';

interface AgentUsageRecord {
  name: string;
  count: number;
}

const AgentsUsageChart: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentUsage, setAgentUsage] = useState<AgentUsageRecord[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const history = await voiceCampaignService.getHybridCallHistory({ limit: 1000 });
        const calls = history?.success ? (history.calls || []) : [];

        const counts: Record<string, number> = {};
        for (const call of calls as any[]) {
          const agentName: string = call?.agent_name || call?.voice_campaign?.agent_name || call?.voice_campaign?.elevenlabs_agent_id || 'Sin agente';
          counts[agentName] = (counts[agentName] || 0) + 1;
        }

        const usage: AgentUsageRecord[] = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setAgentUsage(usage);
      } catch (err: any) {
        console.error('Error cargando uso de agentes:', err);
        setError('No se pudo cargar el ranking de agentes');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const chartConfig = useMemo(() => {
    const labels = agentUsage.map((a) => a.name);
    const data = agentUsage.map((a) => a.count);
    const total = data.reduce((acc, n) => acc + n, 0);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    return {
      options: {
        chart: {
          type: 'donut',
          height: 300,
          fontFamily: 'inherit',
          foreColor: '#adb0bb',
          toolbar: { show: false },
        },
        labels,
        colors,
        plotOptions: {
          pie: {
            donut: {
              size: '70%',
              labels: {
                show: true,
                name: {
                  show: true,
                  fontSize: '14px',
                  fontWeight: 600,
                  offsetY: -8,
                  formatter: (val: string) => val,
                },
                value: {
                  show: true,
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#3B82F6',
                  offsetY: 8,
                  formatter: (val: number) => `${val} llamadas`,
                },
                total: {
                  show: true,
                  label: 'Total',
                  fontSize: '13px',
                  color: '#9CA3AF',
                  formatter: () => `${total} llamadas`,
                },
              },
            },
          },
        },
        dataLabels: { enabled: false },
        legend: { show: false },
        stroke: { width: 2, colors: ['#ffffff'] },
        tooltip: {
          theme: 'dark',
          y: { formatter: (val: number) => `${val} llamadas` },
        },
        responsive: [
          {
            breakpoint: 480,
            options: {
              chart: { height: 250 },
              plotOptions: { pie: { donut: { labels: { value: { fontSize: '18px' } } } } },
            },
          },
        ],
      },
      series: data,
    } as any;
  }, [agentUsage]);

  if (error) {
    return (
      <CardBox>
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <Icon icon="solar:danger-circle-bold" className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        </div>
      </CardBox>
    );
  }

  if (loading) {
    return (
      <CardBox>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="h-5 bg-gray-200 rounded w-52 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-72 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
        </div>
      </CardBox>
    );
  }

  if (agentUsage.length === 0) {
    return (
      <CardBox>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Agentes más usados</h5>
            <p className="text-sm text-gray-600 dark:text-gray-400">Ranking por número de llamadas</p>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="solar:users-group-rounded-bold-duotone" width={20} className="text-indigo-600" />
          </div>
        </div>
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <Icon icon="solar:users-group-two-rounded-outline" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Sin datos de agentes</h3>
            <p className="text-gray-500">El ranking aparecerá cuando se registren llamadas</p>
          </div>
        </div>
      </CardBox>
    );
  }

  return (
    <CardBox>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Agentes más usados</h5>
          <p className="text-sm text-gray-600 dark:text-gray-400">Distribución por número de llamadas</p>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="solar:users-group-rounded-bold-duotone" width={20} className="text-indigo-600" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Gráfico */}
        <div className="flex-1 flex justify-center">
          <Chart options={chartConfig.options} series={chartConfig.series} type="donut" height={300} width={320} />
        </div>

        {/* Lista */}
        <div className="flex-1 w-full space-y-3">
          {agentUsage.map((a, idx) => {
            const total = agentUsage.reduce((acc, it) => acc + it.count, 0);
            const percent = total > 0 ? Math.round((a.count / total) * 1000) / 10 : 0;
            const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
            const color = colorPalette[idx % colorPalette.length];
            return (
              <div key={a.name} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{a.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{percent}% del total</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{a.count}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">llamadas</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CardBox>
  );
};

export default AgentsUsageChart;


