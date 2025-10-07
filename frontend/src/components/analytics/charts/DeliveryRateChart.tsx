import React, { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { RealtimeMetrics } from 'src/hooks/useRealtimeMetrics';

interface DeliveryRateChartProps {
  metrics: RealtimeMetrics;
  timeRange: '1h' | '24h' | '7d' | '30d';
  detailed?: boolean;
}

const DeliveryRateChart: React.FC<DeliveryRateChartProps> = ({
  metrics,
  timeRange,
  detailed = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Datos para el gráfico de dona
    const data = [
      { label: 'Entregados', value: metrics.whatsapp.messages_delivered, color: '#10b981' },
      { label: 'Leídos', value: metrics.whatsapp.messages_read, color: '#8b5cf6' },
      { label: 'Fallidos', value: metrics.whatsapp.messages_failed, color: '#ef4444' },
      { label: 'Pendientes', value: Math.max(0, metrics.whatsapp.messages_sent - metrics.whatsapp.messages_delivered - metrics.whatsapp.messages_failed), color: '#f59e0b' }
    ];

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return;

    // Configuración del gráfico de dona
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 40;
    const innerRadius = radius * 0.6;

    let currentAngle = -Math.PI / 2; // Empezar desde arriba

    // Dibujar segmentos
    data.forEach((segment) => {
      if (segment.value === 0) return;

      const sliceAngle = (segment.value / total) * 2 * Math.PI;
      
      // Dibujar segmento exterior
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();

      // Dibujar borde
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      currentAngle += sliceAngle;
    });

    // Texto central
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.round((metrics.whatsapp.messages_delivered / metrics.whatsapp.messages_sent) * 100)}%`,
      centerX,
      centerY - 5
    );
    
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Tasa de Entrega', centerX, centerY + 15);

  }, [metrics]);

  const data = [
    { 
      label: 'Entregados', 
      value: metrics.whatsapp.messages_delivered, 
      color: '#10b981',
      percentage: metrics.whatsapp.messages_sent > 0 ? Math.round((metrics.whatsapp.messages_delivered / metrics.whatsapp.messages_sent) * 100) : 0
    },
    { 
      label: 'Leídos', 
      value: metrics.whatsapp.messages_read, 
      color: '#8b5cf6',
      percentage: metrics.whatsapp.messages_delivered > 0 ? Math.round((metrics.whatsapp.messages_read / metrics.whatsapp.messages_delivered) * 100) : 0
    },
    { 
      label: 'Fallidos', 
      value: metrics.whatsapp.messages_failed, 
      color: '#ef4444',
      percentage: metrics.whatsapp.messages_sent > 0 ? Math.round((metrics.whatsapp.messages_failed / metrics.whatsapp.messages_sent) * 100) : 0
    },
    { 
      label: 'Pendientes', 
      value: Math.max(0, metrics.whatsapp.messages_sent - metrics.whatsapp.messages_delivered - metrics.whatsapp.messages_failed), 
      color: '#f59e0b',
      percentage: metrics.whatsapp.messages_sent > 0 ? Math.round((Math.max(0, metrics.whatsapp.messages_sent - metrics.whatsapp.messages_delivered - metrics.whatsapp.messages_failed) / metrics.whatsapp.messages_sent) * 100) : 0
    }
  ];

  const totalMessages = metrics.whatsapp.messages_sent;

  if (totalMessages === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Icon icon="solar:pie-chart-2-bold" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="font-medium">No hay datos de entrega</p>
          <p className="text-sm">Los datos aparecerán cuando se envíen mensajes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gráfico de dona */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="max-w-full"
        />
      </div>

      {/* Leyenda detallada */}
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium text-sm">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{item.value.toLocaleString()}</span>
              <span className="font-bold text-sm" style={{ color: item.color }}>
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Métricas adicionales si es vista detallada */}
      {detailed && (
        <div className="pt-4 border-t space-y-3">
          <h4 className="font-semibold text-sm">Métricas Detalladas</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tasa de Éxito:</span>
                <span className="font-bold text-green-600">
                  {Math.round(((metrics.whatsapp.messages_delivered + metrics.whatsapp.messages_read) / metrics.whatsapp.messages_sent) * 100)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tasa de Fallo:</span>
                <span className="font-bold text-red-600">
                  {Math.round((metrics.whatsapp.messages_failed / metrics.whatsapp.messages_sent) * 100)}%
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Engagement:</span>
                <span className="font-bold text-purple-600">
                  {metrics.whatsapp.messages_delivered > 0 ? Math.round((metrics.whatsapp.messages_read / metrics.whatsapp.messages_delivered) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tiempo Promedio:</span>
                <span className="font-bold text-blue-600">2.3 min</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryRateChart;