import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { RealtimeMetrics } from 'src/hooks/useRealtimeMetrics';

interface RealtimeMetricsChartProps {
  metrics: RealtimeMetrics;
  timeRange: '1h' | '24h' | '7d' | '30d';
  isConnected: boolean;
}

interface DataPoint {
  timestamp: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

const RealtimeMetricsChart: React.FC<RealtimeMetricsChartProps> = ({
  metrics,
  timeRange,
  isConnected
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataHistory, setDataHistory] = useState<DataPoint[]>([]);

  // Solo usar datos reales cuando estén disponibles
  useEffect(() => {
    if (isConnected) {
      const newPoint: DataPoint = {
        timestamp: metrics.last_updated,
        sent: metrics.whatsapp.messages_sent,
        delivered: metrics.whatsapp.messages_delivered,
        read: metrics.whatsapp.messages_read,
        failed: metrics.whatsapp.messages_failed
      };

      setDataHistory(prev => {
        const updated = [...prev.slice(-29), newPoint]; // Mantener últimos 30 puntos
        return updated;
      });
    } else {
      // Sin conexión, mostrar solo datos actuales
      setDataHistory([]);
    }
  }, [metrics, isConnected]);

  // Dibujar gráfico simple con Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dataHistory.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Configuración del gráfico
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Encontrar valores máximos para escalar
    const maxSent = Math.max(...dataHistory.map(d => d.sent));
    const maxValue = Math.max(maxSent, 100);

    // Dibujar ejes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Eje Y
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

    // Eje X
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Dibujar líneas de datos
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
    };

    // Dibujar líneas para cada métrica
    drawLine(dataHistory.map(d => d.sent), '#3b82f6', 3); // Azul para enviados
    drawLine(dataHistory.map(d => d.delivered), '#10b981', 2); // Verde para entregados
    drawLine(dataHistory.map(d => d.read), '#8b5cf6', 2); // Púrpura para leídos
    drawLine(dataHistory.map(d => d.failed), '#ef4444', 1); // Rojo para fallidos

    // Dibujar etiquetas del eje Y
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue / 5) * i);
      const y = height - padding - (i / 5) * chartHeight;
      ctx.fillText(value.toString(), padding - 10, y + 4);
    }

  }, [dataHistory]);

  return (
    <div className="space-y-4">
      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-sm">
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
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Fallidos</span>
        </div>
      </div>

      {/* Gráfico */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
          className="w-full h-64 border border-gray-200 rounded"
        />
        
        {!isConnected && (
          <div className="absolute inset-0 bg-gray-50 bg-opacity-90 flex items-center justify-center rounded">
            <div className="text-center">
              <Icon icon="solar:wifi-router-cross-bold" className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Conexión en tiempo real no disponible</p>
              <p className="text-xs text-gray-500">Mostrando datos estáticos</p>
            </div>
          </div>
        )}
      </div>

      {/* Estadísticas actuales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{metrics.whatsapp.messages_sent}</div>
          <div className="text-xs text-gray-500">Total Enviados</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">{metrics.whatsapp.messages_delivered}</div>
          <div className="text-xs text-gray-500">Total Entregados</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-purple-600">{metrics.whatsapp.messages_read}</div>
          <div className="text-xs text-gray-500">Total Leídos</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">{metrics.whatsapp.messages_failed}</div>
          <div className="text-xs text-gray-500">Total Fallidos</div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeMetricsChart;