import React from 'react';

const UserInfo: React.FC = () => {
  const handleReload = () => {
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/auth/login';
  };

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
            onClick={handleReload}
            className="px-6 py-2.5 text-white font-medium rounded-lg transition"
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
};

export default UserInfo; 