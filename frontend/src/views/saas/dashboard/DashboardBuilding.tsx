import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const DashboardBuilding: React.FC = () => {
  const {
    saasChecked,
    checkSaasStatus,
    hasCompleteSaasAccess,
    tenant,
  } = useUnifiedAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const returnTo = search.get('returnTo') || '';
  
  // Estado para detectar si ya pasó tiempo suficiente y no hay conexión
  const [showConnectionError, setShowConnectionError] = useState(false);

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

  // Si después de verificar no hay tenant, mostrar error de conexión
  useEffect(() => {
    if (saasChecked && !tenant && !hasCompleteSaasAccess) {
      // Dar un pequeño delay antes de mostrar el error
      const timer = setTimeout(() => {
        setShowConnectionError(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [saasChecked, tenant, hasCompleteSaasAccess]);

  const handleReload = () => {
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/auth/login';
  };

  // Mostrar error de conexión si ya verificó y no hay tenant
  if (showConnectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg border p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Problemas de conexión</h1>
          <p className="text-gray-600 mb-6">
            No pudimos conectar con la base de datos. Por favor recarga la página o intenta nuevamente en unos minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleReload}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              Recargar página
            </button>
            <button
              onClick={handleLogout}
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

  // Pantalla de carga mientras verifica
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-md border p-8 w-full max-w-md text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
        <h1 className="text-xl font-semibold text-gray-900">Preparando tu Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Estamos terminando de cargar tu contexto y permisos. Esto puede tardar unos segundos.
        </p>
      </div>
    </div>
  );
};

export default DashboardBuilding;