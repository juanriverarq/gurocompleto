import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Cargando...", 
  size = 'md',
  fullScreen = true 
}) => {
  const sizeConfig = {
    sm: { spinner: '12px', padding: '12px 16px', fontSize: '12px' },
    md: { spinner: '16px', padding: '16px 24px', fontSize: '14px' },
    lg: { spinner: '20px', padding: '20px 28px', fontSize: '16px' }
  };

  const config = sizeConfig[size];

  const containerStyle = fullScreen ? {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f7fb', // Fondo suave del sistema
    fontFamily: 'system-ui, -apple-system, sans-serif'
  } : {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  return (
    <div style={containerStyle}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: config.padding,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(99, 91, 255, 0.08)', // Borde muy sutil del color primario
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' // Sombra muy suave
      }}>
        <div style={{
          width: config.spinner,
          height: config.spinner,
          border: '2px solid rgba(99, 91, 255, 0.12)', // Color primario muy sutil
          borderTop: '2px solid rgba(99, 91, 255, 0.4)', // Color primario un poco más visible
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ 
          color: '#64748b', // Color de texto suave 
          fontSize: config.fontSize,
          fontWeight: '500'
        }}>
          {message}
        </span>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner; 