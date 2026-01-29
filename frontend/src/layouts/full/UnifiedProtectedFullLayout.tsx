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

const UnifiedProtectedFullLayout: React.FC = () => {
  const { activeLayout, isLayout } = useContext(CustomizerContext);
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
    
    // Usar datos del perfil del broker si están disponibles, sino usar tenant
    const t = brokerProfileData || tenant as any;
    
    // Patrones de nombres genéricos/automáticos que indican datos no completados
    const genericNamePatterns = [
      'Broker de',
      '- Agencia',
      'Mi Agencia',
    ];
    
    // El backend puede devolver 'name' o 'nombre', 'phone' o 'telefono', etc.
    const name = (t.name || t.nombre || '').trim();
    const isGenericName = !name || genericNamePatterns.some(pattern => name.includes(pattern));
    
    // Verificar campos obligatorios con datos reales
    const hasValidName = name && !isGenericName;
    const documentNumber = (t.document_number || t.nit || '').trim();
    const hasDocument = documentNumber && documentNumber.length > 3;
    const phone = (t.phone || t.telefono || '').trim();
    const hasPhone = phone && phone.length > 5;
    const city = (t.city || t.ciudad || '').trim();
    const hasCity = city && city.length > 2;
    
    // Debug: mostrar qué campos faltan
    console.debug('[OnboardingCheck] Broker validation:', {
      source: brokerProfileData ? 'API profile' : 'tenant',
      name,
      isGenericName,
      hasValidName,
      documentNumber,
      hasDocument,
      phone,
      hasPhone,
      city,
      hasCity,
      result: !hasValidName || !hasDocument || !hasPhone || !hasCity
    });
    
    return !hasValidName || !hasDocument || !hasPhone || !hasCity;
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
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
        <div className="text-center max-w-md mx-4 p-8 bg-white rounded-2xl shadow-lg border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Problemas de conexión
          </h2>
          <p className="text-gray-600 mb-6">
            No pudimos conectar con la base de datos. Por favor recarga la página o intenta nuevamente en unos minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition"
            >
              Recargar página
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/auth/login';
              }}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition"
            >
              Cerrar sesión
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Si el problema persiste, <a href="https://wa.me/573001009305?text=Hola,%20tengo%20problemas%20para%20conectar%20con%20Guro" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">contacta a soporte por WhatsApp</a>.
          </p>
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
    <>
      {/* Modal OBLIGATORIO para completar datos del broker */}
      <FirstTimeOnboardingModal
        isOpen={showOnboardingModal || isBrokerDataIncomplete}
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
        {/* Chat flotante global - DESACTIVADO TEMPORALMENTE */}
        {/* <FloatingChat /> */}
      </div>
    </>
  );
};

export default UnifiedProtectedFullLayout;
