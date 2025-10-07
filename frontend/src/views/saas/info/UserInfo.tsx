import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { Alert, AlertDescription } from '../../../components/shadcn-ui/Default-Ui/alert';
import { 
  Building2, 
  Users, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ArrowRight,
  LogOut
} from 'lucide-react';

const UserInfo: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateBroker = () => {
    navigate('/onboarding/create-broker');
  };

  const handleLogout = () => {
    localStorage.removeItem('saas_token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Estado de tu Cuenta GURO
          </h1>
          <p className="text-xl text-gray-600">
            Información sobre tu acceso al sistema SaaS
          </p>
        </div>

        {/* Main Alert */}
        <Alert className="mb-8 border-amber-200 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Acceso Restringido:</strong> Tu cuenta no tiene acceso completo al sistema SaaS. 
            Necesitas configurar tu broker para continuar.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 text-blue-600 mr-2" />
                Estado Actual
              </CardTitle>
              <CardDescription>
                Tu situación actual en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-green-800">Usuario Registrado</span>
                </div>
                <span className="text-green-600 font-medium">✓ Activo</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-green-800">Tipo de Usuario</span>
                </div>
                <span className="text-green-600 font-medium">MASTER</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-red-800">Broker Configurado</span>
                </div>
                <span className="text-red-600 font-medium">✗ Faltante</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-red-800">Acceso SaaS</span>
                </div>
                <span className="text-red-600 font-medium">✗ Bloqueado</span>
              </div>
            </CardContent>
          </Card>

          {/* What You Need */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 text-purple-600 mr-2" />
                Lo que Necesitas
              </CardTitle>
              <CardDescription>
                Pasos para acceder al sistema completo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border-2 border-dashed border-purple-200 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">
                  1. Crear tu Broker
                </h3>
                <p className="text-purple-700 text-sm mb-3">
                  Como usuario MASTER, necesitas crear tu propio broker para acceder al sistema SaaS.
                </p>
                <Button 
                  onClick={handleCreateBroker}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  Crear Broker Ahora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">
                  2. Configurar tu Empresa
                </h3>
                <p className="text-gray-700 text-sm">
                  Después de crear tu broker, podrás configurar tu empresa, 
                  crear empleados y gestionar pólizas.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Explanation */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 text-indigo-600 mr-2" />
              ¿Por qué necesito un Broker?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Multi-Tenant</h4>
                <p className="text-sm text-gray-600">
                  Cada broker es independiente con sus propios datos y configuraciones.
                </p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Seguridad</h4>
                <p className="text-sm text-gray-600">
                  Los datos están completamente aislados entre diferentes brokers.
                </p>
              </div>
              
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Gestión</h4>
                <p className="text-sm text-gray-600">
                  Puedes crear empleados y gestionar permisos dentro de tu broker.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={handleCreateBroker}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Building2 className="mr-2 h-5 w-5" />
            Crear mi Broker
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleLogout}
            size="lg"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Cerrar Sesión
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500">
          <p className="text-sm">
            ¿Necesitas ayuda? Contacta a nuestro equipo de soporte.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserInfo; 