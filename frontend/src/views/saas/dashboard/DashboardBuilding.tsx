import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const DashboardBuilding: React.FC = () => {
  const {
    saasChecked,
    checkSaasStatus,
    needsOnboarding,
    hasCompleteSaasAccess,
    isEmpleado,
  } = useUnifiedAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const returnTo = search.get('returnTo') || '';

  useEffect(() => {
    if (!saasChecked) {
      checkSaasStatus().catch(() => {});
    }
  }, [saasChecked, checkSaasStatus]);

  useEffect(() => {
    if (!isEmpleado && needsOnboarding) {
      const next = returnTo
        ? `/onboarding/create-broker?returnTo=${encodeURIComponent(returnTo)}`
        : '/onboarding/create-broker';
      navigate(next, { replace: true });
    } else if (hasCompleteSaasAccess) {
      const dest = returnTo || '/apps';
      navigate(dest, { replace: true });
    }
  }, [needsOnboarding, hasCompleteSaasAccess, isEmpleado, navigate, returnTo]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-md border p-8 w-full max-w-md text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
        <h1 className="text-xl font-semibold text-gray-900">Preparando tu Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Estamos terminando de cargar tu contexto y permisos. Esto puede tardar unos segundos.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => checkSaasStatus().catch(() => {})}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Reintentar
          </button>
          <button
            onClick={() => navigate(returnTo || '/apps', { replace: true })}
            className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Volver a mi ruta
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardBuilding;