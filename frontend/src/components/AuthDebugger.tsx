import React from 'react';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';
import { auth } from '../config/firebase';

const AuthDebugger: React.FC = () => {
  const { 
    user, 
    usuarioSaas, 
    empleado, 
    isEmpleado, 
    tenant,
    permisos
  } = useUnifiedAuth();

  const handleCheckToken = async () => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      
      // Decodificar el token manualmente
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
    }
  };

  const handleTestAPI = async () => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/saas/me-simple`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
      } catch (error) {
      }
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md">
      <h3 className="font-bold text-lg mb-2">Auth Debugger</h3>
      
      <div className="space-y-2 text-sm">
        <div>
          <strong>Firebase User:</strong>
          <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-1 rounded overflow-auto">
            {user ? JSON.stringify({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              emailVerified: user.emailVerified
            }, null, 2) : 'No user'}
          </pre>
        </div>
        
        <div>
          <strong>Usuario SaaS:</strong>
          <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-1 rounded overflow-auto">
            {usuarioSaas ? JSON.stringify(usuarioSaas, null, 2) : 'No SaaS user'}
          </pre>
        </div>
        
        <div>
          <strong>Tenant:</strong>
          <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-1 rounded overflow-auto">
            {tenant ? JSON.stringify({
              id: tenant.id,
              nombre: tenant.nombre,
              domain: tenant.domain
            }, null, 2) : 'No tenant'}
          </pre>
        </div>
        
        <div>
          <strong>Is Empleado:</strong> {isEmpleado ? 'Yes' : 'No'}
        </div>
        
        {empleado && (
          <div>
            <strong>Empleado:</strong>
            <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-1 rounded overflow-auto">
              {JSON.stringify(empleado, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div className="mt-4 space-x-2">
        <button 
          onClick={handleCheckToken}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
        >
          Check Token
        </button>
        <button 
          onClick={handleTestAPI}
          className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
        >
          Test API
        </button>
      </div>
    </div>
  );
};

export default AuthDebugger;
