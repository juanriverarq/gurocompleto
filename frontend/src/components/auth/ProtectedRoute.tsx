import React from 'react';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: {
    module: string;
    action: string;
  };
  requiredRole?: string;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  redirectTo = '/auth/auth1/login'
}) => {
  const { usuarioSaas, loading, hasPermission, isRole } = useUnifiedAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!usuarioSaas) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission.module, requiredPermission.action)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredRole && !isRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 