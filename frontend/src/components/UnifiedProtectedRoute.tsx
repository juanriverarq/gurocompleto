import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';

interface UnifiedProtectedRouteProps {
  children: React.ReactNode;
  requireCompleteAccess?: boolean;
}

const UnifiedProtectedRoute: React.FC<UnifiedProtectedRouteProps> = ({ 
  children, 
  requireCompleteAccess = true 
}) => {
  const { 
    isAuthenticated,
    isEmailVerified,
    tenant, 
    usuarioSaas, 
    needsOnboarding, 
    loading,
    isEmpleado,
    saasChecked
  } = useUnifiedAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Debug del estado para diagnosticar bloqueos o redirecciones inesperadas
  useEffect(() => {
    try {
      console.debug('[UnifiedProtectedRoute]', {
        isAuthenticated,
        loading,
        isEmpleado,
        tenantPresent: !!tenant,
        usuarioSaasPresent: !!usuarioSaas,
        needsOnboarding,
        saasChecked,
        requireCompleteAccess,
        path: location.pathname
      });
    } catch {}
  }, [
    isAuthenticated,
    loading,
    isEmpleado,
    tenant,
    usuarioSaas,
    needsOnboarding,
    saasChecked,
    requireCompleteAccess,
    location.pathname
  ]);

  const hasCompleteSaasAccess = isAuthenticated && !!tenant && (!!usuarioSaas || isEmpleado) && !needsOnboarding;

  useEffect(() => {
    if (loading) return; // Esperar hasta que termine de cargar

    const currentPath = location.pathname + location.search;
    // Si no hay usuario autenticado, decidir login destino o esperar restauración de empleado
    if (!isAuthenticated) {
      const currentPath = location.pathname + location.search;
      const hasEmpleadoLocal = typeof window !== 'undefined' && (!!localStorage.getItem('empleado_token') || !!localStorage.getItem('empleado_data'));
      if (hasEmpleadoLocal) {
        // Evitar redirección a Firebase login; esperar a que el contexto restaure la sesión del empleado
        return;
      }
      const isEmpContext = location.pathname.startsWith('/empleados') || location.pathname.startsWith('/auth/auth2');
      const target = isEmpContext ? '/empleados/login' : '/auth/auth1/login';
      navigate(`${target}?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Si el usuario necesita onboarding o no tiene tenant, mostrar error de conexión
    // (ya no redirigimos a /onboarding/create-broker)
    if (saasChecked && (needsOnboarding || (!tenant && isEmailVerified && !isEmpleado))) {
      // No redirigir - el UnifiedProtectedFullLayout mostrará el error de conexión
      return;
    }

    // Si el email no está verificado (solo para usuarios Firebase, no empleados), redirigir
    if (!isEmailVerified && !isEmpleado) {
      navigate('/auth/verification-prompt');
      return;
    }

    // Si se requiere acceso completo pero no lo tiene:
    // - Usuarios Firebase: redirigir a dashboard-building
    // - Empleados: permitir acceso aunque tenant aún no esté cargado
    if (requireCompleteAccess && !hasCompleteSaasAccess && !isEmpleado) {
      navigate(`/dashboard-building?returnTo=${encodeURIComponent(currentPath)}`);
      return;
    }

  }, [
    isAuthenticated,
    isEmailVerified,
    isEmpleado,
    loading, 
    needsOnboarding, 
    hasCompleteSaasAccess, 
    requireCompleteAccess, 
    navigate,
    tenant,
    usuarioSaas,
    saasChecked
  ]);

  // Mostrar pantalla de carga mientras se verifica el estado
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f7fb',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 24px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(99, 91, 255, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(99, 91, 255, 0.12)',
            borderTop: '2px solid rgba(99, 91, 255, 0.4)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ 
            color: '#64748b',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            🚀 Configurando tu cuenta...
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

  // Si no hay usuario, no mostrar nada (se redirigirá en el useEffect)
  if (!isAuthenticated) {
    return null;
  }

  // Si necesita onboarding, no mostrar nada (se redirigirá en el useEffect)
  if (needsOnboarding) {
    return null;
  }

  // Si el email no está verificado (solo para usuarios Firebase, no empleados), no mostrar nada
  if (!isEmailVerified && !isEmpleado) {
    return null;
  }

  // Si requiere acceso completo pero no lo tiene, no mostrar nada
  if (requireCompleteAccess && !hasCompleteSaasAccess) {
    // Permitir contenido si es empleado con tenant (acceso por rol)
    if (!(isEmpleado && tenant)) {
      return null;
    }
  }

  // Todo está bien, mostrar el contenido
  return <>{children}</>;
};

export default UnifiedProtectedRoute; 