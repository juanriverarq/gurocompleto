import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import SubscriptionPaymentModal from 'src/components/modals/SubscriptionPaymentModal';
import { Icon } from '@iconify/react';
import Lottie from 'lottie-react';

import loaderAnimation from 'src/assets/LOTTIE-LOADING-2.json';

const BG_IMAGE = 'https://framerusercontent.com/images/6vqDsl7xtgechRbMSo6yAkGE.png';

const DashboardBuilding: React.FC = () => {
  const {
    saasChecked,
    checkSaasStatus,
    hasCompleteSaasAccess,
    tenant,
    trialExpired,
    logout,
    user,
  } = useUnifiedAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const returnTo = search.get('returnTo') || '';

  const [showConnectionError, setShowConnectionError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!saasChecked) {
      checkSaasStatus().catch(() => {});
    }
  }, [saasChecked, checkSaasStatus]);

  useEffect(() => {
    if (hasCompleteSaasAccess) {
      const dest = returnTo || '/apps';
      navigate(dest, { replace: true });
    }
  }, [hasCompleteSaasAccess, navigate, returnTo]);

  useEffect(() => {
    if (saasChecked && !tenant && !hasCompleteSaasAccess && !trialExpired) {
      const timer = setTimeout(() => {
        setShowConnectionError(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [saasChecked, tenant, hasCompleteSaasAccess, trialExpired]);

  if (trialExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <SubscriptionPaymentModal
          isOpen={true}
          onClose={() => {}}
          reason="trial_expired"
        />
      </div>
    );
  }

  const handleReload = async () => {
    setRetrying(true);
    try {
      await checkSaasStatus();
    } catch {}
    setTimeout(() => {
      if (!hasCompleteSaasAccess) window.location.reload();
    }, 1500);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {}
    localStorage.clear();
    window.location.href = '/';
  };

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';

  // Shared background wrapper
  const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        backgroundImage: `url(${BG_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'bottom center',
        backgroundRepeat: 'no-repeat',
        transform: 'rotate(180deg)',
        fontFamily: "'General Sans', sans-serif",
      }}
    >
      <div className="flex flex-col items-center w-full" style={{ transform: 'rotate(180deg)' }}>
        {children}
      </div>
    </div>
  );

  // Connection error state
  if (showConnectionError) {
    return (
      <PageWrapper>
        <div className="bg-white rounded-[28px] shadow-2xl p-8 sm:p-10 w-full max-w-md mx-4 text-center">
          {/* Error icon */}
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-50 flex items-center justify-center">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-8 h-8 text-red-500" />
          </div>

          <h1
            className="text-2xl font-bold text-[#0d0d0d] tracking-[-0.02em] mb-2"
          >
            Problemas de conexión
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            No pudimos conectar con el servidor. Recarga la página o intenta en unos minutos.
          </p>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleReload}
              disabled={retrying}
              className="group relative inline-flex items-center justify-center w-full bg-[#0d0d0d] rounded-2xl h-[52px] overflow-hidden transition-all"
            >
              <span className="absolute inset-y-0 left-0 w-[52px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
              <span className="relative z-10 flex items-center gap-2">
                {retrying ? (
                  <Icon icon="svg-spinners:ring-resize" className="w-4 h-4 text-white" />
                ) : (
                  <Icon icon="solar:refresh-bold" className="w-4 h-4 text-white" />
                )}
                <span className="text-[11px] font-bold text-white uppercase tracking-[0.15em]">
                  {retrying ? 'Reintentando...' : 'Reintentar conexión'}
                </span>
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 w-full bg-[#f5f5f5] hover:bg-[#ebebeb] rounded-2xl h-[48px] transition-colors"
            >
              <Icon icon="solar:logout-2-bold" className="w-4 h-4 text-gray-500" />
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-[0.15em]">
                Cerrar sesión
              </span>
            </button>
          </div>

          {/* WhatsApp support */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <a
              href="https://wa.me/573001009305?text=Hola,%20tengo%20problemas%20para%20conectar%20con%20Guro"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-green-600 transition-colors"
            >
              <Icon icon="mdi:whatsapp" className="w-4 h-4" />
              ¿Problemas? Contacta a soporte
            </a>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Loading state
  return (
    <PageWrapper>
      <div className="bg-white rounded-[28px] shadow-2xl p-8 sm:p-10 w-full max-w-md mx-4 text-center">
        {/* Lottie loader */}
        <div className="flex justify-center mb-6">
          <div className="bg-[#f5f5f5] rounded-full p-4">
            <Lottie
              animationData={loaderAnimation}
              loop
              autoplay
              style={{ width: 64, height: 64 }}
            />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#0d0d0d] tracking-[-0.02em] mb-2">
          {firstName ? `Hola, ${firstName}` : 'Preparando tu panel'}
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Estamos cargando tu espacio de trabajo. Esto solo toma unos segundos.
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#573CFF] animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </PageWrapper>
  );
};

export default DashboardBuilding;