import React, { useState } from 'react';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';

const EmailVerificationBanner: React.FC = () => {
  const { user, isEmailVerified } = useUnifiedAuth();
  const [isResending, setIsResending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // No mostrar si el email está verificado o si fue dismisseado
  if (isEmailVerified || isDismissed) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      // Por ahora simplemente simulamos el reenvío
      // En el futuro se puede agregar la funcionalidad de reenvío si es necesaria
      setTimeout(() => {
        alert('📧 Email de verificación enviado. Revisa tu bandeja de entrada.');
        setIsResending(false);
      }, 1000);
    } catch (error) {
      alert('❌ Error enviando email de verificación');
      setIsResending(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      color: 'white',
      padding: '16px 20px',
      borderRadius: '12px',
      margin: '0 0 20px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '15px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <div style={{ fontSize: '24px' }}>⚠️</div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
            Email no verificado
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            Verifica tu email ({user?.email}) para acceder a todas las funciones
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={handleResendEmail}
          disabled={isResending}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isResending ? 'not-allowed' : 'pointer',
            opacity: isResending ? 0.6 : 1,
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            if (!isResending) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          {isResending ? '📤 Enviando...' : '🔄 Reenviar'}
        </button>
        
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'transparent',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
        >
          ✅ Ya Verifiqué
        </button>
        
        <button
          onClick={() => setIsDismissed(true)}
          style={{
            background: 'transparent',
            color: 'white',
            border: 'none',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '18px',
            cursor: 'pointer',
            opacity: 0.7,
            transition: 'opacity 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.opacity = '0.7';
          }}
          title="Ocultar este mensaje"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default EmailVerificationBanner; 