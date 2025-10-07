import React from 'react';
import { Icon } from '@iconify/react';
import { Card, CardContent } from '../shadcn-ui/Default-Ui/card';

interface HeroMetricCardProps {
  title: string;
  value: string | number;
  trend?: number; // Porcentaje de cambio (positivo o negativo)
  trendLabel?: string; // Ej: "vs ayer", "vs semana anterior"
  icon: string;
  iconColor: string;
  iconBgColor: string;
  sparklineData?: number[]; // Datos para mini gráfico
  status?: 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
  onClick?: () => void;
}

const HeroMetricCard: React.FC<HeroMetricCardProps> = ({
  title,
  value,
  trend,
  trendLabel = 'vs ayer',
  icon,
  iconColor,
  iconBgColor,
  sparklineData,
  status,
  subtitle,
  onClick
}) => {
  // Determinar color del valor según status
  const getValueColor = () => {
    if (status === 'success') return 'text-green-600';
    if (status === 'warning') return 'text-yellow-600';
    if (status === 'danger') return 'text-red-600';
    if (status === 'info') return 'text-blue-600';
    return 'text-gray-900 dark:text-white';
  };

  // Determinar color de tendencia
  const getTrendColor = () => {
    if (trend === undefined || trend === null) return 'text-gray-500';
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  // Icono de tendencia
  const getTrendIcon = () => {
    if (trend === undefined || trend === null) return null;
    if (trend > 0) return 'solar:arrow-up-bold';
    if (trend < 0) return 'solar:arrow-down-bold';
    return 'solar:minus-bold';
  };

  // Generar path SVG para sparkline
  const generateSparklinePath = () => {
    if (!sparklineData || sparklineData.length === 0) return '';
    
    const width = 100;
    const height = 30;
    const max = Math.max(...sparklineData, 1);
    const min = Math.min(...sparklineData, 0);
    const range = max - min || 1;
    
    const points = sparklineData.map((value, index) => {
      const x = (index / (sparklineData.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  return (
    <Card 
      className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className={`text-4xl font-bold ${getValueColor()}`}>
                {value}
              </h2>
              {trend !== undefined && trend !== null && (
                <div className={`flex items-center gap-1 ${getTrendColor()}`}>
                  {getTrendIcon() && (
                    <Icon icon={getTrendIcon()!} className="w-4 h-4" />
                  )}
                  <span className="text-sm font-semibold">
                    {trend > 0 ? '+' : ''}{trend}%
                  </span>
                </div>
              )}
            </div>
            {(trend !== undefined || trendLabel) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {trendLabel}
              </p>
            )}
            {subtitle && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {subtitle}
              </p>
            )}
          </div>
          
          <div className={`p-3 rounded-xl ${iconBgColor}`}>
            <Icon icon={icon} className={`w-8 h-8 ${iconColor}`} />
          </div>
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4">
            <svg 
              width="100%" 
              height="40" 
              viewBox="0 0 100 30" 
              preserveAspectRatio="none"
              className="w-full"
            >
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={iconColor.replace('text-', '')} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={iconColor.replace('text-', '')} stopOpacity="0.05" />
                </linearGradient>
              </defs>
              
              {/* Área bajo la curva */}
              <path
                d={`${generateSparklinePath()} L 100,30 L 0,30 Z`}
                fill={`url(#gradient-${title})`}
              />
              
              {/* Línea principal */}
              <path
                d={generateSparklinePath()}
                fill="none"
                stroke={iconColor.includes('green') ? '#10B981' : 
                       iconColor.includes('blue') ? '#3B82F6' :
                       iconColor.includes('purple') ? '#8B5CF6' :
                       iconColor.includes('yellow') ? '#F59E0B' : '#6B7280'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HeroMetricCard;