import React, { useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

const MobileAuthPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  useEffect(() => {
    // Obtener parámetros de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdParam = urlParams.get('sessionId');
    const redirectUriParam = urlParams.get('redirectUri');
    
    console.log('🌐 Parámetros recibidos:', { sessionIdParam, redirectUriParam });
    
    setSessionId(sessionIdParam);
    setRedirectUri(redirectUriParam);
    
    // Auto-iniciar el login cuando se carga la página
    handleGoogleSignIn();
  }, []);

  const handleSimulatedGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🌐 Simulando Google Sign-In para app móvil...');
      
      // Simular tiempo de carga realista
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simular usuario exitoso
      const userData = {
        id: 'google-123456789',
        email: 'juanriverarq@gmail.com',
        name: 'Juan Rivera',
        photo: 'https://lh3.googleusercontent.com/a/default-user',
        success: true
      };

      console.log('🌐 Login simulado exitoso:', userData);
      
      // Guardar para la app móvil
      localStorage.setItem('mobileAuthResult', JSON.stringify(userData));
      
      // Mostrar resultado exitoso
      window.location.hash = '#success';
      
    } catch (error: any) {
      console.error('🌐 Error en login simulado:', error);
      setError('Error en la simulación de login');
      window.location.hash = '#error';
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🌐 Iniciando Google Sign-In desde web...');
      console.log('🌐 Redirect URI disponible:', redirectUri);
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      console.log('🌐 Usuario autenticado:', {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        photo: user.photoURL
      });

      // Si tenemos redirectUri, redirigir a la app móvil con los datos
      if (redirectUri) {
        const params = new URLSearchParams({
          success: 'true',
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || '',
          photo: user.photoURL || ''
        });
        
        const redirectUrl = `${redirectUri}?${params.toString()}`;
        console.log('🌐 Redirigiendo a app móvil:', redirectUrl);
        
        // Mostrar mensaje antes de redirigir
        window.location.hash = '#redirecting';
        
        // Redirigir después de un breve delay
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 2000);
        
      } else {
        // Fallback: guardar en localStorage y mostrar éxito
        const userData = {
          id: user.uid,
          email: user.email,
          name: user.displayName,
          photo: user.photoURL,
          success: true
        };
        
        localStorage.setItem('mobileAuthResult', JSON.stringify(userData));
        window.location.hash = '#success';
      }
      
    } catch (error: any) {
      console.error('🌐 Error en Google Sign-In:', error);
      setError(error.message || 'Error al iniciar sesión');
      
      if (redirectUri) {
        // Redirigir con error
        const params = new URLSearchParams({
          success: 'false',
          error: error.message || 'Error al iniciar sesión'
        });
        
        const redirectUrl = `${redirectUri}?${params.toString()}`;
        console.log('🌐 Redirigiendo con error:', redirectUrl);
        
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 2000);
      } else {
        // Fallback: guardar error en localStorage
        const errorData = {
          success: false,
          error: error.message || 'Error al iniciar sesión'
        };
        
        localStorage.setItem('mobileAuthResult', JSON.stringify(errorData));
        window.location.hash = '#error';
      }
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#6366f1',
          marginBottom: '16px'
        }}>
          GURO
        </div>
        
        <div style={{
          fontSize: '18px',
          color: '#374151',
          marginBottom: '24px'
        }}>
          Autenticación para App Móvil
        </div>

        {loading && (
          <div>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #f3f4f6',
              borderTop: '3px solid #6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            <p style={{ color: '#6b7280' }}>Iniciando sesión con Google...</p>
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {window.location.hash === '#success' && (
          <div style={{
            backgroundColor: '#d1fae5',
            color: '#059669',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            ¡Login exitoso! Puedes cerrar esta ventana.
          </div>
        )}

        {window.location.hash === '#redirecting' && (
          <div style={{
            backgroundColor: '#dbeafe',
            color: '#1d4ed8',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            ¡Login exitoso! Regresando a la app móvil...
          </div>
        )}

        {!loading && !window.location.hash && (
          <button
            onClick={handleGoogleSignIn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              color: '#374151',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: '12px' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </button>
        )}
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

export default MobileAuthPage;
