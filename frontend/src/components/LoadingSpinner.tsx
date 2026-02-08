import React from 'react';
import GuroLoader from './GuroLoader';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const sizeMap = { sm: 60, md: 90, lg: 120 };

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Cargando...", 
  size = 'md',
  fullScreen = true 
}) => {
  return (
    <GuroLoader
      fullScreen={fullScreen}
      size={sizeMap[size]}
      message={message}
    />
  );
};

export default LoadingSpinner; 