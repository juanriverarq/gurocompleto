import React from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const TrialExpired: React.FC = () => {
  const { tenant, trialEndsAt, logout } = useUnifiedAuth();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 font-['Manrope',sans-serif]">
      <div className="max-w-md w-full bg-white dark:bg-dark rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-darkborder">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Icon icon="solar:clock-circle-bold-duotone" className="text-3xl text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Periodo de prueba finalizado</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            <span className="font-semibold">{(tenant as any)?.nombre || (tenant as any)?.name || 'Tu agencia'}</span> ha completado los 7 días de prueba gratuita.
          </p>
          {trialEndsAt && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              Finalizó el {new Date(trialEndsAt).toLocaleDateString('es-CO', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <Link
            to="/apps/billing/planes"
            className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition"
          >
            <Icon icon="solar:card-bold" className="text-lg" />
            Activar mi plan
          </Link>
          <button
            onClick={() => logout()}
            className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-darkgray hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition"
          >
            <Icon icon="solar:logout-2-linear" className="text-lg" />
            Cerrar sesión
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-darkborder">
          <p className="text-xs text-center text-gray-500 dark:text-gray-500">
            ¿Tienes preguntas? <a href="mailto:soporte@guro.co" className="text-primary hover:underline">Contáctanos</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialExpired;



