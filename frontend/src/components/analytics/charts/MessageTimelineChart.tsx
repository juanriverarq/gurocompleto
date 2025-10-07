import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { RealtimeMetrics } from 'src/hooks/useRealtimeMetrics';

interface MessageTimelineChartProps {
  metrics: RealtimeMetrics;
  timeRange: '1h' | '24h' | '7d' | '30d';
}

interface TimelineDataPoint {
  timestamp: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  hour?: number;
  day?: string;
}

const MessageTimelineChart: React.FC<MessageTimelineChartProps> = ({
  metrics,
  timeRange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timelineData, setTimelineData] = useState<TimelineDataPoint[]>([]);

  // Solo mostrar datos cuando haya métricas reales disponibles
  useEffect(() => {
    // TODO: Implementar carga de datos históricos reales desde la API
    // Por ahora mantener array vacío hasta que se implemente el backend
    setTimelineData([]);
  }, [timeRange, metrics]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || timelineData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Configuración
    const padding = 50;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Encontrar valores máximos
    const maxSent = Math.max(...timelineData.map(d => d.sent));
    const maxValue = Math.max(maxSent, 50);

    // Dibujar grid
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    
    // Líneas horizontales
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Líneas verticales
    const xStep = chartWidth / (timelineData.length - 1);
    for (let i = 0; i < timelineData.length; i += Math.ceil(timelineData.length / 8)) {
      const x = padding + i * xStep;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Función para dibujar línea
    const drawLine = (data: number[], color: string, lineWidth: number = 2) => {
      if (data.length < 2) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      data.forEach((value, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = height - padding - (value / maxValue) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Dibujar puntos
      ctx.fillStyle = color;
      data.forEach((value, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = height - padding - (value / maxValue) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    };

    // Dibujar líneas
    drawLine(timelineData.map(d => d.sent), '#3b82f6', 3);
    drawLine(timelineData.map(d => d.delivered), '#10b981', 2);
    drawLine(timelineData.map(d => d.read), '#8b5cf6', 2);

    // Etiquetas del eje Y
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue / 5) * i);
      const y = height - padding - (i / 5) * chartHeight;
      ctx.fillText(value.toString(), padding - 10, y + 4);
    }

    // Etiquetas del eje X
    ctx.textAlign = 'center';
    timelineData.forEach((point, index) => {
      if (index % Math.ceil(timelineData.length / 6) === 0) {
        const x = padding + (index / (timelineData.length - 1)) * chartWidth;
        let label = '';
        
        if (timeRange === '1h') {
          label = new Date(point.timestamp).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        } else if (timeRange === '24h') {
          label = `${point.hour}:00`;
        } else if (timeRange === '7d') {
          label = point.day || '';
        } else {
          label = point.day || '';
        }
        
        ctx.fillText(label, x, height - padding + 20);
      }
    });

  }, [timelineData]);

  return (
    <div className="space-y-4">
      {/* Controles de vista */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Enviados</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Entregados</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span>Leídos</span>
          </div>
        </div>
        
        <div className="text-xs text-gray-500">
          {timeRange === '1h' && 'Últimos 60 minutos'}
          {timeRange === '24h' && 'Últimas 24 horas'}
          {timeRange === '7d' && 'Últimos 7 días'}
          {timeRange === '30d' && 'Últimos 30 días'}
        </div>
      </div>

      {/* Gráfico */}
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full h-64 border border-gray-200 rounded"
      />

      {/* Estadísticas del período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">
            {timelineData.reduce((sum, d) => sum + d.sent, 0)}
          </div>
          <div className="text-xs text-gray-500">Total Enviados</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">
            {timelineData.reduce((sum, d) => sum + d.delivered, 0)}
          </div>
          <div className="text-xs text-gray-500">Total Entregados</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-purple-600">
            {timelineData.reduce((sum, d) => sum + d.read, 0)}
          </div>
          <div className="text-xs text-gray-500">Total Leídos</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-orange-600">
            {timelineData.length > 0 ? Math.round(timelineData.reduce((sum, d) => sum + d.sent, 0) / timelineData.length) : 0}
          </div>
          <div className="text-xs text-gray-500">Promedio por Período</div>
        </div>
      </div>
    </div>
  );
};

export default MessageTimelineChart;