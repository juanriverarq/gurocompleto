import React from 'react';
import { Icon } from '@iconify/react';
import { Card, CardContent } from '../shadcn-ui/Default-Ui/card';
import { Badge } from '../shadcn-ui/Default-Ui/badge';

interface SecondaryMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  trend?: number;
  onClick?: () => void;
}

const SecondaryMetricCard: React.FC<SecondaryMetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  iconBgColor,
  badge,
  trend,
  onClick
}) => {
  const getTrendColor = () => {
    if (trend === undefined || trend === null) return 'text-gray-500';
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getTrendIcon = () => {
    if (trend === undefined || trend === null) return null;
    if (trend > 0) return 'solar:arrow-up-bold';
    if (trend < 0) return 'solar:arrow-down-bold';
    return 'solar:minus-bold';
  };

  return (
    <Card 
      className={`overflow-hidden transition-all duration-200 hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {title}
              </p>
              {badge && (
                <Badge variant={badge.variant || 'default'} className="text-xs px-1.5 py-0">
                  {badge.text}
                </Badge>
              )}
            </div>
            
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </h3>
              {trend !== undefined && trend !== null && (
                <div className={`flex items-center gap-0.5 ${getTrendColor()}`}>
                  {getTrendIcon() && (
                    <Icon icon={getTrendIcon()!} className="w-3 h-3" />
                  )}
                  <span className="text-xs font-semibold">
                    {trend > 0 ? '+' : ''}{trend}%
                  </span>
                </div>
              )}
            </div>
            
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          
          <div className={`p-2 rounded-lg ${iconBgColor}`}>
            <Icon icon={icon} className={`w-6 h-6 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecondaryMetricCard;