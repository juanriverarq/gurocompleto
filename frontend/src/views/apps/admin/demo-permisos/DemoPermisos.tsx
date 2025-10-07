import React from 'react';
import { Card, Alert, Badge, Button } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useUnifiedAuth } from '../../../../context/UnifiedAuthContext';
import { PermissionGate, usePagePermissions, PermissionButton } from '../../../../components/PermissionGate';
import { ROUTE_PERMISSION_MAP } from '../../../../utils/permissionUtils';

const DemoPermisos: React.FC = () => {
  const { user, empleado, usuarioSaas, permisos, hasPermission, canAccessModule, isEmpleado } = useUnifiedAuth();
  
  // Obtener permisos para esta página específica
  const { canView, canCreate, canEdit, canDelete, canAccess, module } = usePagePermissions('/apps/admin/demo-permisos');

  // Módulos de prueba para verificar acceso
  const testModules = [
    'gestion_usuarios',
    'roles_permisos',
    'sedes',
    'aseguradoras',
    'polizas',
    'clientes',
    'dashboard'
  ];

  // Rutas de prueba para verificar mapeo
  const testRoutes = [
    '/apps/admin/usuarios',
    '/apps/admin/roles',
    '/apps/admin/sedes', 
    '/apps/admin/aseguradoras',
    '/apps/seguros/polizas',
    '/apps/seguros/clientes',
    '/apps/'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Demo Sistema de Permisos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Página de prueba para verificar el funcionamiento del sistema de permisos granulares
          </p>
        </div>
      </div>

      {/* Estado de Autenticación */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Icon icon="solar:user-bold-duotone" className="mr-2" />
            Estado de Autenticación
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">Tipo de Usuario:</h3>
              {isEmpleado ? (
                <Badge color="success">Empleado (Laravel Auth)</Badge>
              ) : user ? (
                <Badge color="info">Usuario Firebase</Badge>
              ) : (
                <Badge color="failure">No Autenticado</Badge>
              )}
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Información del Usuario:</h3>
              {isEmpleado && empleado ? (
                <div className="text-sm">
                  <p><strong>Nombre:</strong> {empleado.nombre} {empleado.apellido}</p>
                  <p><strong>Email:</strong> {empleado.email}</p>
                  <p><strong>Rol:</strong> {empleado.rol?.nombre}</p>
                  <p><strong>Broker:</strong> {empleado.broker?.nombre}</p>
                </div>
              ) : user && usuarioSaas ? (
                <div className="text-sm">
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Rol:</strong> {usuarioSaas.rol}</p>
                  <p><strong>Broker:</strong> {usuarioSaas.broker?.nombre}</p>
                </div>
              ) : (
                <p className="text-gray-500">Sin información disponible</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Permisos de la Página Actual */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Icon icon="solar:shield-check-bold-duotone" className="mr-2" />
            Permisos para esta Página
          </h2>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p><strong>Ruta:</strong> /apps/admin/demo-permisos</p>
            <p><strong>Módulo mapeado:</strong> {module || 'No mapeado'}</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <Badge color={canView ? "success" : "failure"}>
                {canView ? "✓" : "✗"} Ver
              </Badge>
            </div>
            <div className="text-center">
              <Badge color={canCreate ? "success" : "failure"}>
                {canCreate ? "✓" : "✗"} Crear
              </Badge>
            </div>
            <div className="text-center">
              <Badge color={canEdit ? "success" : "failure"}>
                {canEdit ? "✓" : "✗"} Editar
              </Badge>
            </div>
            <div className="text-center">
              <Badge color={canDelete ? "success" : "failure"}>
                {canDelete ? "✓" : "✗"} Eliminar
              </Badge>
            </div>
            <div className="text-center">
              <Badge color={canAccess ? "success" : "failure"}>
                {canAccess ? "✓" : "✗"} Acceso
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Test de Módulos */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Icon icon="solar:settings-bold-duotone" className="mr-2" />
            Test de Acceso a Módulos
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testModules.map((moduleKey) => {
              const hasAccess = canAccessModule(moduleKey);
              const hasViewPermission = hasPermission(moduleKey, 'ver');
              const hasCreatePermission = hasPermission(moduleKey, 'crear');
              
              return (
                <div key={moduleKey} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{moduleKey}</span>
                    <Badge color={hasAccess ? "success" : "failure"} size="xs">
                      {hasAccess ? "✓" : "✗"}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Ver: <Badge color={hasViewPermission ? "success" : "failure"} size="xs">{hasViewPermission ? "✓" : "✗"}</Badge></div>
                    <div>Crear: <Badge color={hasCreatePermission ? "success" : "failure"} size="xs">{hasCreatePermission ? "✓" : "✗"}</Badge></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Test de Mapeo de Rutas */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Icon icon="solar:routing-bold-duotone" className="mr-2" />
            Test de Mapeo de Rutas
          </h2>
          
          <div className="space-y-2">
            {testRoutes.map((route) => {
              const mappedModule = ROUTE_PERMISSION_MAP[route];
              const hasAccess = mappedModule ? canAccessModule(mappedModule) : false;
              
              return (
                <div key={route} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1">
                    <span className="font-mono text-sm">{route}</span>
                    <span className="text-gray-500 ml-2">→ {mappedModule || 'Sin mapear'}</span>
                  </div>
                  <Badge color={hasAccess ? "success" : "failure"} size="xs">
                    {hasAccess ? "Acceso ✓" : "Sin acceso ✗"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Demo de Componentes con Permisos */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Icon icon="solar:widget-2-bold-duotone" className="mr-2" />
            Demo de Componentes con Permisos
          </h2>
          
          <div className="space-y-4">
            {/* PermissionGate Demo */}
            <div>
              <h3 className="font-medium mb-2">PermissionGate (solo visible si tienes permiso 'crear' en 'roles_permisos'):</h3>
              <PermissionGate 
                module="roles_permisos" 
                action="crear"
                fallback={<Alert color="warning">No tienes permiso para crear roles</Alert>}
              >
                <Alert color="success">
                  <Icon icon="solar:check-circle-bold" className="mr-2" />
                  ¡Tienes permiso para crear roles!
                </Alert>
              </PermissionGate>
            </div>

            {/* PermissionButton Demo */}
            <div>
              <h3 className="font-medium mb-2">PermissionButtons:</h3>
              <div className="flex flex-wrap gap-2">
                <PermissionButton 
                  module="gestion_usuarios" 
                  action="crear"
                  color="success"
                >
                  <Icon icon="solar:user-plus-bold" className="mr-2" />
                  Crear Usuario
                </PermissionButton>
                
                <PermissionButton 
                  module="roles_permisos" 
                  action="editar"
                  color="warning"
                >
                  <Icon icon="solar:pen-bold" className="mr-2" />
                  Editar Rol
                </PermissionButton>
                
                <PermissionButton 
                  module="sedes" 
                  action="eliminar"
                  color="failure"
                >
                  <Icon icon="solar:trash-bin-minimalistic-bold" className="mr-2" />
                  Eliminar Sede
                </PermissionButton>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Información de Debug */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Icon icon="solar:bug-bold-duotone" className="mr-2" />
            Información de Debug
          </h2>
          
          <div className="space-y-2">
            <details className="border rounded p-2">
              <summary className="cursor-pointer font-medium">Permisos Raw (Empleado)</summary>
              <pre className="text-xs mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                {empleado?.rol?.permisos ? JSON.stringify(empleado.rol.permisos, null, 2) : 'No disponible'}
              </pre>
            </details>
            
            <details className="border rounded p-2">
              <summary className="cursor-pointer font-medium">Permisos Raw (Firebase User)</summary>
              <pre className="text-xs mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                {permisos ? JSON.stringify(permisos, null, 2) : 'No disponible'}
              </pre>
            </details>
            
            <details className="border rounded p-2">
              <summary className="cursor-pointer font-medium">Mapeo de Rutas</summary>
              <pre className="text-xs mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                {JSON.stringify(ROUTE_PERMISSION_MAP, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DemoPermisos; 