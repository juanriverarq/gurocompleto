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
      setTimeout(() => {
        alert('Email de verificación enviado. Revisa tu bandeja de entrada.');
        setIsResending(false);
      }, 1000);
    } catch (error) {
      alert('Error enviando email de verificación');
      setIsResending(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-4 mb-5 flex items-center justify-between flex-wrap gap-4 shadow-sm font-['Manrope',sans-serif]">
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm mb-0.5">
          Verifica tu email para acceder a todas las funciones
        </p>
        <p className="text-white/80 text-xs truncate">
          {user?.email}
        </p>
      </div>
      
      <div className="flex gap-2 items-center">
        <button
          onClick={handleResendEmail}
          disabled={isResending}
          className={`
            bg-white/20 hover:bg-white/30 text-white text-xs font-medium
            px-3 py-1.5 rounded-md border border-white/30
            transition-all duration-200
            ${isResending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {isResending ? 'Enviando...' : 'Reenviar email'}
        </button>
        
        <button
          onClick={() => window.location.reload()}
          className="bg-white text-amber-600 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-white/90 transition-all duration-200"
        >
          Ya verifiqué
        </button>
        
        <button
          onClick={() => setIsDismissed(true)}
          className="text-white/70 hover:text-white p-1 transition-colors duration-200"
          title="Ocultar este mensaje"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default EmailVerificationBanner; 