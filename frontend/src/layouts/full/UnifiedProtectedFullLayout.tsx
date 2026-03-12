import React, { useContext, useEffect, useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Customizer } from './shared/customizer/Customizer';
import { CustomizerContext } from '../../context/CustomizerContext';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import Sidebar from './vertical/sidebar/Sidebar';
import Header from './vertical/header/Header';
import PartialTransitioning from 'src/components/headless-ui/Transition/PartialTransitioning';
import api from 'src/config/api';
import ScrollToTop from 'src/components/shared/ScrollToTop';
import FirstTimeOnboardingModal from 'src/components/modals/FirstTimeOnboardingModal';
import SubscriptionPaymentModal from 'src/components/modals/SubscriptionPaymentModal';
import GuroLoader from 'src/components/GuroLoader';
import { GuroTourProvider } from 'src/components/GuroTour/GuroTour';
import { GuroToastContainer } from 'src/components/GuroToast/GuroToast';
import ModuleGate from 'src/components/ModuleGate';

const UnifiedProtectedFullLayout: React.FC = () => {
  const { activeLayout } = useContext(CustomizerContext);
  const {
    isAuthenticated,
    loading,
    hasCompleteSaasAccess,
    needsOnboarding,
    user,
    isEmpleado,
    tenant,
    saasChecked,
    trialExpired,
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

  // Timeout para limpiar datos stale de empleado si el contexto nunca se restaura
  const [empleadoTimeout, setEmpleadoTimeout] = useState(false);
  useEffect(() => {
    if (!loading && isAuthenticated && !isEmpleado && !hasCompleteSaasAccess) {
      const hasData = !!localStorage.getItem('empleado_data');
      const hasToken = !!localStorage.getItem('empleado_token');
      if (hasData && hasToken) {
        const timer = setTimeout(() => {
          console.warn('[Layout] Timeout: limpiando datos stale de empleado');
          localStorage.removeItem('empleado_data');
          localStorage.removeItem('empleado_token');
          setEmpleadoTimeout(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, isAuthenticated, isEmpleado, hasCompleteSaasAccess]);

  // Estado para mostrar error de conexión
  const [connectionError, setConnectionError] = React.useState(false);
  
  // Estado para el modal de onboarding obligatorio
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [brokerProfileChecked, setBrokerProfileChecked] = useState(false);
  const [brokerProfileData, setBrokerProfileData] = useState<any>(null);
  
  // Verificar el perfil del broker directamente desde el endpoint
  useEffect(() => {
    const checkBrokerProfile = async () => {
      if (isEmpleado || !isAuthenticated || loading || !tenant) return;
      
      try {
        const response = await api.get('/saas/broker/profile');
        if (response.data) {
          setBrokerProfileData(response.data);
          console.debug('[OnboardingCheck] Broker profile from API:', response.data);
        }
      } catch (error) {
        console.error('[OnboardingCheck] Error fetching broker profile:', error);
      } finally {
        setBrokerProfileChecked(true);
      }
    };
    
    if (!brokerProfileChecked && tenant) {
      checkBrokerProfile();
    }
  }, [isEmpleado, isAuthenticated, loading, tenant, brokerProfileChecked]);
  
  // Verificar si el broker tiene datos incompletos (campos obligatorios vacíos o genéricos)
  const isBrokerDataIncomplete = useMemo(() => {
    // Solo aplicar a usuarios normales, no empleados
    if (isEmpleado || !tenant) return false;
    
    // Esperar a que se verifique el perfil del broker
    if (!brokerProfileChecked) return false;

    // Patrones de nombres genéricos/automáticos que indican datos no completados
    const genericNamePatterns = ['Broker de', '- Agencia', 'Mi Agencia'];

    // Helper: verificar si un objeto tiene datos completos del broker
    const isComplete = (t: any): boolean => {
      if (!t) return false;
      const name = (t.name || t.nombre || '').trim();
      const isGenericName = !name || genericNamePatterns.some(p => name.includes(p));
      if (!name || isGenericName) return false;
      const doc = (t.document_number || t.nit || '').trim();
      if (!doc || doc.length <= 3) return false;
      const phone = (t.phone || t.telefono || '').trim();
      if (!phone || phone.length <= 5) return false;
      const city = (t.city || t.ciudad || '').trim();
      if (!city || city.length <= 2) return false;
      return true;
    };

    // Si CUALQUIERA de las fuentes tiene datos completos, no mostrar modal
    if (isComplete(brokerProfileData)) return false;
    if (isComplete(tenant)) return false;

    console.debug('[OnboardingCheck] Broker data incomplete — neither API profile nor tenant have all fields');
    return true;
  }, [tenant, isEmpleado, brokerProfileChecked, brokerProfileData]);
  
  // OBLIGATORIO: Mostrar modal si los datos del broker están incompletos
  useEffect(() => {
    if (isBrokerDataIncomplete && !isEmpleado && isAuthenticated && !loading) {
      setShowOnboardingModal(true);
      // Limpiar el flag de onboarding completado
      localStorage.removeItem('guro_onboarding_completed');
    }
  }, [isBrokerDataIncomplete, isEmpleado, isAuthenticated, loading]);

  // Verificar si hay problemas de conexión con el backend
  useEffect(() => {
    if (
      !loading &&
      isAuthenticated &&
      !isEmpleado &&
      saasChecked &&
      !tenant &&
      user &&
      user.emailVerified
    ) {
      // Si no tiene tenant después de verificar, mostrar error de conexión
      console.warn('[UnifiedProtectedFullLayout] No se detectó broker - posible problema de conexión');
      setConnectionError(true);
    } else {
      setConnectionError(false);
    }
  }, [
    loading,
    isAuthenticated,
    isEmpleado,
    tenant,
    user,
    saasChecked,
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
    return <GuroLoader fullScreen size={100} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  // Si el trial expiró, mostrar el modal de pago obligatorio
  if (trialExpired && !isEmpleado) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
        <SubscriptionPaymentModal
          isOpen={true}
          onClose={() => {}}
          reason="trial_expired"
        />
      </div>
    );
  }

  // Mostrar error de conexión si no se puede cargar el broker
  if (connectionError) {
    return (
      <div className="fixed inset-0 bg-[#fafafa] flex items-center justify-center z-50" style={{ fontFamily: "'General Sans', sans-serif" }}>
        <div className="text-center max-w-md mx-4 p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#0d0d0d] mb-2 tracking-[-0.02em]">
            Problemas de conexión
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            No pudimos conectar con la base de datos. Por favor recarga la página o intenta nuevamente en unos minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-[#0d0d0d] hover:bg-[#1a1a2e] text-white text-sm font-semibold rounded-xl transition"
            >
              Recargar página
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/auth/login';
              }}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-xl transition"
            >
              Cerrar sesión
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Si el problema persiste, <a href="https://wa.me/573001009305?text=Hola,%20tengo%20problemas%20para%20conectar%20con%20Guro" target="_blank" rel="noopener noreferrer" className="text-[#573CFF] hover:underline">contacta a soporte por WhatsApp</a>.
          </p>
        </div>
      </div>
    );
  }

  if (!hasCompleteSaasAccess && !isEmpleado) {
    const hasSavedEmpleado =
      typeof window !== 'undefined' && !!localStorage.getItem('empleado_data');
    const hasSavedToken =
      typeof window !== 'undefined' && !!localStorage.getItem('empleado_token');
    if (hasSavedEmpleado && hasSavedToken && !empleadoTimeout) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#fafafa]" style={{ fontFamily: "'General Sans', sans-serif" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#573CFF]/10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#573CFF] border-t-transparent"></div>
            </div>
            <span className="text-gray-500 text-sm font-medium">Cargando contexto de empleado...</span>
          </div>
        </div>
      );
    }
    // Datos stale sin token: limpiar localStorage para evitar spinner infinito
    if (hasSavedEmpleado && !hasSavedToken) {
      localStorage.removeItem('empleado_data');
    }
    return null;
  }

  return (
    <GuroTourProvider>
      {/* Modal OBLIGATORIO para completar datos del broker */}
      <FirstTimeOnboardingModal
        isOpen={!isEmpleado && (showOnboardingModal || isBrokerDataIncomplete)}
        onClose={() => {
          // Solo permitir cerrar si los datos están completos
          if (!isBrokerDataIncomplete) {
            setShowOnboardingModal(false);
          }
          // Si los datos están incompletos, no hacer nada - el modal permanece abierto
        }}
        onComplete={() => {
          // Recargar la página para obtener los datos actualizados del broker
          window.location.reload();
        }}
      />
      
      {/* Modal OBLIGATORIO para pago cuando el trial expira */}
      <SubscriptionPaymentModal
        isOpen={trialExpired && !isEmpleado}
        onClose={() => {
          // No permitir cerrar - es obligatorio pagar
        }}
        reason="trial_expired"
      />
      
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
                className={`w-full py-8 md:py-10 px-4 md:px-6 xl:px-8 2xl:px-10 ${activeLayout == 'horizontal' ? 'xl:mt-3' : ''} min-w-0 overflow-x-auto`}
              >
                <ScrollToTop>
                  <ModuleGate>
                    <Outlet />
                  </ModuleGate>
                </ScrollToTop>
              </div>
              <Customizer />
              <PartialTransitioning />
            </div>
          </div>
        </div>
        {/* Chat flotante global - DESACTIVADO TEMPORALMENTE */}
        {/* <FloatingChat /> */}
      </div>
      <GuroToastContainer />
    </GuroTourProvider>
  );
};

export default UnifiedProtectedFullLayout;
