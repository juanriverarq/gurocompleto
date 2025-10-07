import React from 'react';
import { Icon } from '@iconify/react';

interface ValidationMessageProps {
  message?: string;
  type?: 'error' | 'warning' | 'success';
  className?: string;
}

const ValidationMessage: React.FC<ValidationMessageProps> = ({ 
  message, 
  type = 'error', 
  className = '' 
}) => {
  if (!message) return null;

  const getIcon = () => {
    switch (type) {
      case 'error':
        return 'solar:close-circle-bold';
      case 'warning':
        return 'solar:info-circle-bold';
      case 'success':
        return 'solar:check-circle-bold';
      default:
        return 'solar:info-circle-bold';
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'warning':
        return 'text-orange-500 dark:text-orange-400';
      case 'success':
        return 'text-green-500 dark:text-green-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <div className={`flex items-center gap-2 text-xs mt-1 ${getStyles()} ${className}`}>
      <Icon icon={getIcon()} className="w-3 h-3 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

export default ValidationMessage; 