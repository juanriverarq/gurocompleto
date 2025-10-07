import React from 'react';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';

const AuthStatusDebug: React.FC = () => {
  const { 
    user, 
    usuarioSaas, 
    permisos, 
    tenant, 
    isAuthenticated, 
    hasCompleteSaasAccess,
    canAccessModule,
    hasPermission,
    loading 
  } = useUnifiedAuth();

  if (loading) {
    return <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
      <p>Cargando autenticación...</p>
    </div>;
  }

  // Lista de módulos del sidebar para probar
  const modulesToTest = [
    'dashboard',
    'clientes', 
    'cotizaciones',
    'polizas',
    'siniestros',
    'pipeline_ventas',
    'metas_objetivos',
    'leads',
    'email_marketing',
    'asistentes_ia',
    'voice_ai',
    'comisiones',
    'cartera_clientes',
    'contratos',
    'tienda_apps',
    'integraciones_externas',
    'gestion_usuarios',
    'roles_permisos',
    'configuracion_sistema'
  ];

  return (
    <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Estado de Autenticación y Permisos</h3>
      
      {/* Estado general */}
      <div className="mb-4">
        <p><strong>Usuario Firebase:</strong> {user ? `${user.email} (${user.emailVerified ? 'verificado' : 'no verificado'})` : 'No autenticado'}</p>
        <p><strong>Usuario SaaS:</strong> {usuarioSaas ? `${usuarioSaas.email} (${usuarioSaas.rol})` : 'No cargado'}</p>
        <p><strong>Tenant:</strong> {tenant ? tenant.nombre : 'No asignado'}</p>
        <p><strong>Autenticado:</strong> {isAuthenticated ? 'Sí' : 'No'}</p>
        <p><strong>Acceso SaaS completo:</strong> {hasCompleteSaasAccess ? 'Sí' : 'No'}</p>
      </div>

      {/* Permisos específicos */}
      {usuarioSaas && (
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Información del Usuario SaaS:</h4>
          <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(usuarioSaas, null, 2)}
          </pre>
        </div>
      )}

      {/* Test de acceso a módulos */}
      <div className="mb-4">
        <h4 className="font-semibold mb-2">Acceso a Módulos del Sidebar:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {modulesToTest.map(module => (
            <div 
              key={module}
              className={`p-2 rounded text-sm ${
                canAccessModule(module) 
                  ? 'bg-green-100 border border-green-400 text-green-800' 
                  : 'bg-red-100 border border-red-400 text-red-800'
              }`}
            >
              <span className="font-medium">{module}:</span>
              <span className="ml-1">{canAccessModule(module) ? '✅' : '❌'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Test de permisos específicos */}
      {usuarioSaas && (
        <div>
          <h4 className="font-semibold mb-2">Permisos Específicos (algunos ejemplos):</h4>
          <div className="grid grid-cols-2 gap-2">
            {['clientes', 'polizas', 'admin'].map(module => (
              ['ver', 'crear', 'editar', 'eliminar'].map(action => (
                <div 
                  key={`${module}-${action}`}
                  className={`p-1 rounded text-xs ${
                    hasPermission(module, action)
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {module}.{action}: {hasPermission(module, action) ? '✅' : '❌'}
                </div>
              ))
            ))}
          </div>
        </div>
      )}

      {/* Datos de permisos raw */}
      {permisos && (
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Permisos Raw:</h4>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-32">
            {JSON.stringify(permisos, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AuthStatusDebug; 