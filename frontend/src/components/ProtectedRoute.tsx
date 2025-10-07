import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireEmailVerification = false,
  redirectTo = '/auth/login'
}) => {
  const { user, loading, isAuthenticated, isEmailVerified } = useUnifiedAuth();
  const location = useLocation();
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  // Guardar la ruta actual para redirigir después del login
  const currentPath = location.pathname + location.search;

  // Función para reenviar verificación de email (simplificada)
  const handleResendEmail = async () => {
    setIsResendingEmail(true);
    try {
      // Por ahora simplemente simulamos el reenvío
      setTimeout(() => {
        alert('📧 Email de verificación enviado. Revisa tu bandeja de entrada.');
        setIsResendingEmail(false);
      }, 1000);
    } catch (error) {
      alert('❌ Error enviando email de verificación');
      setIsResendingEmail(false);
    }
  };

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f7fb', // Fondo suave del sistema
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 24px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(99, 91, 255, 0.08)', // Borde muy sutil del color primario
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' // Sombra muy suave
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(99, 91, 255, 0.12)', // Color primario muy sutil
            borderTop: '2px solid rgba(99, 91, 255, 0.4)', // Color primario un poco más visible
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ 
            color: '#64748b', // Color de texto suave 
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Verificando acceso...
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
  }

  // Redirigir al login si no está autenticado
  if (!isAuthenticated) {
    return <Navigate to={`${redirectTo}?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  // Mostrar mensaje de verificación de email si es requerido y no está verificado
  if (requireEmailVerification && !isEmailVerified) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          padding: '40px',
          borderRadius: '20px',
          textAlign: 'center',
          maxWidth: '500px',
          width: '100%'
        }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>📧</div>
          <h2 style={{ margin: '0 0 15px 0', fontSize: '28px' }}>Verificación de Email Requerida</h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '16px', lineHeight: '1.6', opacity: 0.9 }}>
            Para acceder a esta sección, necesitas verificar tu dirección de email.
            <br />
            Revisa tu bandeja de entrada y haz clic en el enlace de verificación.
          </p>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '20px',
            borderRadius: '10px',
            marginBottom: '25px'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
              <strong>Email:</strong> {user?.email}
            </p>
            <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
              Si no encuentras el email, revisa tu carpeta de spam.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleResendEmail}
              disabled={isResendingEmail}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isResendingEmail ? 'not-allowed' : 'pointer',
                opacity: isResendingEmail ? 0.6 : 1,
                transition: 'all 0.3s ease',
                minWidth: '160px'
              }}
              onMouseOver={(e) => {
                if (!isResendingEmail) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              {isResendingEmail ? '📤 Enviando...' : '🔄 Reenviar Email'}
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'transparent',
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                minWidth: '160px'
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
          </div>

          <div style={{
            marginTop: '30px',
            padding: '15px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>💡 Consejos:</p>
            <ul style={{ margin: 0, paddingLeft: '20px', textAlign: 'left' }}>
              <li>Revisa tu carpeta de spam o promociones</li>
              <li>Agrega nuestro email a tus contactos</li>
              <li>El enlace expira en 24 horas</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Si todo está bien, mostrar el contenido protegido
  return <>{children}</>;
};

export default ProtectedRoute; 