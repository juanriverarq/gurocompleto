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
    <div
      className="relative rounded-2xl p-5 mb-5 flex items-center justify-between flex-wrap gap-4 overflow-hidden"
      style={{ fontFamily: "'General Sans', sans-serif" }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
          backgroundSize: '160%',
          backgroundPosition: 'center',
          transform: 'rotate(180deg)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="text-white font-bold text-sm mb-0.5 tracking-[-0.01em]">
          Verifica tu email para acceder a todas las funciones
        </p>
        <p className="text-white/60 text-xs truncate">
          {user?.email}
        </p>
      </div>
      
      <div className="relative z-10 flex gap-2 items-center">
        <button
          onClick={handleResendEmail}
          disabled={isResending}
          className={`
            bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-semibold
            px-4 py-2 rounded-xl border border-white/20
            transition-all duration-200
            ${isResending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {isResending ? 'Enviando...' : 'Reenviar email'}
        </button>
        
        <button
          onClick={() => window.location.reload()}
          className="bg-white text-[#0d0d0d] text-xs font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-all duration-200"
        >
          Ya verifiqué
        </button>
        
        <button
          onClick={() => setIsDismissed(true)}
          className="text-white/50 hover:text-white p-1 transition-colors duration-200"
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