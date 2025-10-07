import React from 'react';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';
import { ROUTE_PERMISSION_MAP } from '../utils/permissionUtils';

interface PermissionGateProps {
  children: React.ReactNode;
  /** Ruta de la página actual para mapear al módulo de permisos */
  route?: string;
  /** Módulo de permisos específico (si no se quiere usar route mapping) */
  module?: string;
  /** Acción requerida (ver, crear, editar, eliminar) */
  action: 'ver' | 'crear' | 'editar' | 'eliminar';
  /** Contenido alternativo a mostrar si no tiene permisos */
  fallback?: React.ReactNode;
}

/**
 * Componente que renderiza condicionalmente sus hijos basado en los permisos del usuario
 * @param children - Elementos a renderizar si el usuario tiene permisos
 * @param route - Ruta actual para mapear al módulo de permisos
 * @param module - Módulo específico (alternativa a route)
 * @param action - Acción que se requiere verificar
 * @param fallback - Contenido a mostrar si no tiene permisos
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  route,
  module,
  action,
  fallback = null
}) => {
  const { hasPermission, canAccessModule } = useUnifiedAuth();

  // Determinar el módulo a usar
  let targetModule = module;
  if (!targetModule && route) {
    targetModule = ROUTE_PERMISSION_MAP[route];
  }

  if (!targetModule) {
    return <>{children}</>;
  }

  // Verificar permisos
  const hasAccess = hasPermission(targetModule, action);

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

interface ActionButtonProps {
  /** Texto del botón */
  children: React.ReactNode;
  /** Función a ejecutar al hacer clic */
  onClick: () => void;
  /** Variante del botón */
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  /** Tamaño del botón */
  size?: 'sm' | 'md' | 'lg';
  /** Icono del botón */
  icon?: React.ReactNode;
  /** Props adicionales del botón */
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

/**
 * Hook para verificar permisos CRUD en una página específica
 * @param route - Ruta de la página actual
 * @param module - Módulo alternativo específico
 */
export const usePagePermissions = (route?: string, module?: string) => {
  const { hasPermission, canAccessModule } = useUnifiedAuth();

  // Determinar el módulo
  let targetModule = module;
  if (!targetModule && route) {
    targetModule = ROUTE_PERMISSION_MAP[route];
  }

  return {
    canView: targetModule ? hasPermission(targetModule, 'ver') : true,
    canCreate: targetModule ? hasPermission(targetModule, 'crear') : true,
    canEdit: targetModule ? hasPermission(targetModule, 'editar') : true,
    canDelete: targetModule ? hasPermission(targetModule, 'eliminar') : true,
    canAccess: targetModule ? canAccessModule(targetModule) : true,
    module: targetModule
  };
};

/**
 * Botón con verificación de permisos integrada
 */
export const PermissionButton: React.FC<ActionButtonProps & {
  route?: string;
  module?: string;
  action: 'crear' | 'editar' | 'eliminar' | 'ver';
}> = ({
  children,
  onClick,
  route,
  module,
  action,
  variant = 'primary',
  size = 'md',
  icon,
  buttonProps,
  ...props
}) => {
  const { hasPermission } = useUnifiedAuth();

  // Determinar el módulo
  let targetModule = module;
  if (!targetModule && route) {
    targetModule = ROUTE_PERMISSION_MAP[route];
  }

  if (!targetModule) {
    return null;
  }

  // Verificar permisos
  const hasAccess = hasPermission(targetModule, action);

  if (!hasAccess) {
    return null;
  }

  // Estilos del botón según la variante
  const getButtonClasses = () => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };

    const variantClasses = {
      primary: 'bg-primary text-white hover:bg-primary-dark focus:ring-primary',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
    };

    return `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]}`;
  };

  return (
    <button
      onClick={onClick}
      className={getButtonClasses()}
      {...buttonProps}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export default PermissionGate; 