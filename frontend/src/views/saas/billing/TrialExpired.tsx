import React from 'react';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const TrialExpired: React.FC = () => {
  const { tenant, trialEndsAt, logout } = useUnifiedAuth();

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-lg shadow-lg p-8 border border-red-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-red-500 text-2xl">!</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Periodo de prueba finalizado</h1>
          <p className="mt-2 text-gray-600">
            {tenant?.nombre || tenant?.name || 'Tu agencia'} ha agotado los 14 días de prueba.
          </p>
          {trialEndsAt && (
            <p className="mt-1 text-sm text-gray-500">Fecha de finalización: {new Date(trialEndsAt).toLocaleString()}</p>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <a
            href="/apps/theme-pages/pricing"
            className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Ver planes y activar mi cuenta
          </a>
          <button
            onClick={() => logout()}
            className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
          >
            Cerrar sesión
          </button>
        </div>

        <p className="mt-4 text-xs text-center text-gray-400">
          Si crees que se trata de un error, contáctanos a soporte.
        </p>
      </div>
    </div>
  );
};

export default TrialExpired;



