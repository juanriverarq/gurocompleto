import React, { useContext, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Customizer } from './shared/customizer/Customizer';
import { CustomizerContext } from '../../context/CustomizerContext';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import Sidebar from './vertical/sidebar/Sidebar';
import Header from './vertical/header/Header';
import PartialTransitioning from 'src/components/headless-ui/Transition/PartialTransitioning';
import api from 'src/config/api';
import ScrollToTop from 'src/components/shared/ScrollToTop';

const UnifiedProtectedFullLayout: React.FC = () => {
  const { activeLayout, isLayout } = useContext(CustomizerContext);
  const {
    isAuthenticated,
    loading,
    hasCompleteSaasAccess,
    needsOnboarding,
    user,
    empleado,
    isEmpleado,
    usuarioSaas,
    tenant,
    saasChecked,
  } = useUnifiedAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Debug mínimo para inspeccionar estados y evitar "pantallas muertas"
  useEffect(() => {
    try {
      console.debug('[UnifiedProtectedFullLayout]', {
        isAuthenticated,
        loading,
        isEmpleado,
        hasCompleteSaasAccess,
        needsOnboarding,
        saasChecked,
        hasTenant: !!tenant,
        path: location.pathname,
      });
    } catch {}
  }, [
    isAuthenticated,
    loading,
    isEmpleado,
    hasCompleteSaasAccess,
    needsOnboarding,
    saasChecked,
    tenant,
    location.pathname,
  ]);

  // Todos los efectos deben ejecutarse antes de cualquier retorno condicional
  // Redirigir si no está autenticado
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const currentPath = location.pathname + location.search;
      // Solo considerar sesión válida de empleado si hay TOKEN
      const hasEmpleadoToken =
        typeof window !== 'undefined' && !!localStorage.getItem('empleado_token');
      const hasEmpleadoData =
        typeof window !== 'undefined' && !!localStorage.getItem('empleado_data');

      // Si hay datos antiguos sin token, limpiarlos para evitar pantallas muertas
      if (!hasEmpleadoToken && hasEmpleadoData) {
        try {
          localStorage.removeItem('empleado_data');
          console.warn('[UnifiedProtectedFullLayout] limpiado empleado_data sin token');
        } catch {}
      }

      if (hasEmpleadoToken) {
        return; // Esperar a que el contexto restaure la sesión de empleado con token válido
      }

      // Si parece un flujo de empleado, enviar a /empleados/login; caso contrario a auth1
      const isEmpContext =
        location.pathname.startsWith('/empleados') || location.pathname.startsWith('/auth/auth2');
      const target = isEmpContext ? '/empleados/login' : '/auth/auth1/login';
      navigate(`${target}?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [isAuthenticated, loading, location, navigate]);

  // Redirigir: si hay intención pendiente sin plan activo, ir a checkout primero; de lo contrario onboarding
  useEffect(() => {
    const maybeRedirect = async () => {
      if (
        !loading &&
        isAuthenticated &&
        !isEmpleado &&
        saasChecked &&
        (needsOnboarding || (!tenant && user && user.emailVerified))
      ) {
        try {
          // Consultar estado de billing
          const resp = await api.get('/billing/status', { validateStatus: () => true });
          if (resp.status === 200 && resp.data?.success) {
            const hasActive = !!resp.data.data?.has_active_subscription;
            const pending = resp.data.data?.pending_intent;
            if (!hasActive && pending) {
              window.location.replace('/checkout');
              return;
            }
          }
        } catch {}
        // Fallback: onboarding de broker
        const currentPath = location.pathname + location.search;
        window.location.replace(
          `/onboarding/create-broker?returnTo=${encodeURIComponent(currentPath)}`,
        );
      }
    };
    maybeRedirect();
  }, [
    needsOnboarding,
    loading,
    isAuthenticated,
    isEmpleado,
    tenant,
    user,
    saasChecked,
    location.pathname,
    location.search,
  ]);

  // Verificar acceso completo (Firebase users necesitan tenant + usuarioSaas)
  // PARA empleados: permitir acceso aunque aún no haya tenant (evitar bloqueo infinito)
  useEffect(() => {
    if (!loading && isAuthenticated && !needsOnboarding && !hasCompleteSaasAccess) {
      if (isEmpleado) {
        return; // empleados pueden continuar sin tenant cargado aún
      }
      const hasSavedEmpleado =
        typeof window !== 'undefined' && !!localStorage.getItem('empleado_data');
      if (hasSavedEmpleado) {
        return;
      }
      const currentPath = location.pathname + location.search;
      navigate(`/dashboard-building?returnTo=${encodeURIComponent(currentPath)}`);
    }
  }, [
    hasCompleteSaasAccess,
    loading,
    isAuthenticated,
    needsOnboarding,
    navigate,
    isEmpleado,
    tenant,
  ]);

  // Mostrar loading mientras verifica autenticación
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">
            {isEmpleado ? 'Verificando acceso de empleado...' : 'Verificando autenticación...'}
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Mostrar loading durante redirección de onboarding
  if (!isEmpleado && needsOnboarding) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Redirigiendo al onboarding...</p>
        </div>
      </div>
    );
  }

  if (!hasCompleteSaasAccess && !isEmpleado) {
    const hasSavedEmpleado =
      typeof window !== 'undefined' && !!localStorage.getItem('empleado_data');
    if (hasSavedEmpleado) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Cargando contexto de empleado...</span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex w-full min-h-screen dark:bg-darkgray">
      <div className="page-wrapper flex w-full min-w-0">
        {/* Header/sidebar */}
        {activeLayout == 'vertical' ? <Sidebar /> : null}
        <div className="page-wrapper-sub flex flex-col w-full min-w-0 dark:bg-darkgray">
          {/* Top Header  */}
          {activeLayout == 'horizontal' ? (
            <Header layoutType="horizontal" />
          ) : (
            <Header layoutType="vertical" />
          )}

          <div
            className={`bg-lightgray dark:bg-dark h-full ${
              activeLayout != 'horizontal' ? 'rounded-bb' : 'rounded-none'
            }`}
          >
            {/* Body Content  */}
            <div
              className={`${
                isLayout == 'full'
                  ? 'w-full py-8 md:py-10 px-4 md:px-6 xl:px-8 2xl:px-10'
                  : 'container mx-auto py-8 md:py-10'
              } ${activeLayout == 'horizontal' ? 'xl:mt-3' : ''} min-w-0 overflow-x-auto`}
            >
              <ScrollToTop>
                <Outlet />
              </ScrollToTop>
            </div>
            <Customizer />
            <PartialTransitioning />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedProtectedFullLayout;
