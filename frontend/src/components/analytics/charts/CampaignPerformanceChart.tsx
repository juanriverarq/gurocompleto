import React, { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';

interface CampaignProgress {
  id: number;
  name: string;
  progress: number;
  sent: number;
  total: number;
  status: string;
}

interface CampaignPerformanceChartProps {
  campaigns: CampaignProgress[];
  timeRange: '1h' | '24h' | '7d' | '30d';
}

const CampaignPerformanceChart: React.FC<CampaignPerformanceChartProps> = ({
  campaigns,
  timeRange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || campaigns.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Configuración
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    const barHeight = Math.min(40, chartHeight / campaigns.length - 10);
    const barSpacing = (chartHeight - campaigns.length * barHeight) / (campaigns.length + 1);

    // Colores para diferentes estados
    const getStatusColor = (status: string, progress: number) => {
      if (progress >= 100) return '#10b981'; // Verde para completadas
      if (status === 'active') return '#3b82f6'; // Azul para activas
      if (status === 'paused') return '#f59e0b'; // Amarillo para pausadas
      return '#6b7280'; // Gris para otras
    };

    // Dibujar barras de progreso
    campaigns.forEach((campaign, index) => {
      const y = padding + barSpacing + index * (barHeight + barSpacing);
      const progressWidth = (campaign.progress / 100) * chartWidth;
      
      // Barra de fondo
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(padding, y, chartWidth, barHeight);
      
      // Barra de progreso
      ctx.fillStyle = getStatusColor(campaign.status, campaign.progress);
      ctx.fillRect(padding, y, progressWidth, barHeight);
      
      // Texto del nombre de la campaña
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        campaign.name.length > 25 ? campaign.name.substring(0, 25) + '...' : campaign.name,
        padding + 8,
        y + barHeight / 2 + 4
      );
      
      // Texto del progreso
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      if (progressWidth > 50) {
        ctx.fillText(
          `${campaign.progress}%`,
          padding + progressWidth - 8,
          y + barHeight / 2 + 4
        );
      }
      
      // Texto de estadísticas
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${campaign.sent}/${campaign.total}`,
        width - padding - 8,
        y + barHeight / 2 + 4
      );
    });

    // Título del eje Y
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Campañas', 0, 0);
    ctx.restore();

    // Título del eje X
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Progreso (%)', width / 2, height - 10);

  }, [campaigns]);

  if (campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Icon icon="solar:chart-2-bold" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="font-medium">No hay campañas activas</p>
          <p className="text-sm">Las campañas aparecerán aquí cuando estén en progreso</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estadísticas resumen */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-bold text-blue-600">{campaigns.length}</div>
          <div className="text-xs text-gray-500">Campañas Activas</div>
        </div>
        <div>
          <div className="text-lg font-bold text-green-600">
            {Math.round(campaigns.reduce((acc, c) => acc + c.progress, 0) / campaigns.length)}%
          </div>
          <div className="text-xs text-gray-500">Progreso Promedio</div>
        </div>
        <div>
          <div className="text-lg font-bold text-purple-600">
            {campaigns.reduce((acc, c) => acc + c.sent, 0)}
          </div>
          <div className="text-xs text-gray-500">Total Enviados</div>
        </div>
      </div>

      {/* Gráfico de barras */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={Math.max(200, campaigns.length * 60)}
          className="w-full border border-gray-200 rounded"
        />
      </div>

      {/* Leyenda de estados */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span>Activa</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Completada</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>Pausada</span>
        </div>
      </div>
    </div>
  );
};

export default CampaignPerformanceChart;