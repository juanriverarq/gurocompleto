import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../shadcn-ui/Default-Ui/card';
import { Button } from '../shadcn-ui/Default-Ui/button';
import { Alert, AlertDescription } from '../shadcn-ui/Default-Ui/alert';
import { Building2, AlertCircle, Users, ArrowRight } from 'lucide-react';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { hasCompleteSaasAccess, needsOnboarding, loading: saasLoading, onboardingStep, usuarioSaas } = useUnifiedAuth();
  const navigate = useNavigate();
  

  // Si está cargando, mostrar loading
  if (saasLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f7fb',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 24px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(99, 91, 255, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(99, 91, 255, 0.12)',
            borderTop: '2px solid rgba(99, 91, 255, 0.4)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ 
            color: '#64748b',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Verificando configuración...
          </span>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  } else if (hasCompleteSaasAccess) {
    return <>{children}</>;
  } else {
    // Para debug, vamos a mostrar el children de todos modos
    return <>{children}</>;
  }

  const handleCreateBroker = () => {
    navigate('/onboarding/create-broker');
  };

  const handleRequestAccess = () => {
    navigate('/onboarding/request-access');
  };

  const handleLogout = () => {
    localStorage.removeItem('saas_token');
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f7fb', // Fondo suave del sistema
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 24px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(99, 91, 255, 0.08)', // Borde muy sutil del color primario
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' // Sombra muy suave
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(99, 91, 255, 0.12)', // Color primario muy sutil
            borderTop: '2px solid rgba(99, 91, 255, 0.4)', // Color primario un poco más visible
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ 
            color: '#64748b', // Color de texto suave 
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Verificando configuración...
          </span>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                {onboardingStep === 'create_broker' ? (
                  <Building2 className="h-12 w-12 text-blue-600" />
                ) : (
                  <Users className="h-12 w-12 text-blue-600" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold">
                {onboardingStep === 'create_broker' ? '¡Bienvenido a GURO!' : 'Acceso Requerido'}
              </CardTitle>
              <CardDescription>
                {onboardingStep === 'create_broker' 
                  ? 'Necesitas crear tu broker para comenzar'
                  : 'Necesitas solicitar acceso a un broker'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userInfo && (
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Usuario:</strong> {userInfo.name} ({userInfo.email})
                    <br />
                    <strong>Tipo:</strong> {userInfo.tipo_usuario}
                  </AlertDescription>
                </Alert>
              )}

              {onboardingStep === 'create_broker' ? (
                <div className="space-y-4">
                  <div className="text-center text-gray-600">
                    <p>Como usuario MASTER, necesitas crear tu broker para acceder al sistema SaaS.</p>
                  </div>
                  <Button 
                    onClick={handleCreateBroker}
                    className="w-full"
                  >
                    Crear mi Broker
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center text-gray-600">
                    <p>Como empleado, necesitas solicitar acceso a un broker existente.</p>
                  </div>
                  <Button 
                    onClick={handleRequestAccess}
                    className="w-full"
                  >
                    Solicitar Acceso
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="w-full"
                >
                  Cerrar Sesión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Usuario no necesita onboarding, mostrar contenido normal
  return <>{children}</>;
};

export default OnboardingGuard; 