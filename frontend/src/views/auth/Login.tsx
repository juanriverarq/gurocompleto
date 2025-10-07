import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import { Label } from '../../components/shadcn-ui/Default-Ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Alert, AlertDescription } from '../../components/shadcn-ui/Default-Ui/alert';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { user, loading: contextLoading } = useUnifiedAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/apps';

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (user && !contextLoading) {
      navigate(from, { replace: true });
    }
  }, [user, contextLoading, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Redirigir al login de Firebase Auth
    navigate('/auth/auth1/login', { replace: true });
  };

  if (contextLoading) {
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
            Inicializando...
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo y Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Bienvenido a GURO
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Plataforma SaaS para Brokers de Seguros
          </p>
        </div>

        {/* Formulario de Login */}
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-center">
              Ingresa tus credenciales para acceder a tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              {/* Recordar y Olvidé contraseña */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <Label htmlFor="remember" className="ml-2 block text-sm text-gray-900">
                    Recordarme
                  </Label>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-500 font-medium">
              Solicitar Demo
            </Link>
          </p>
        </div>

        {/* Demo Credentials */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-yellow-800 mb-2">
              🚀 Credenciales de Demo
            </h3>
            <div className="space-y-1 text-sm text-yellow-700">
              <p><strong>SaaS Admin:</strong> ceo@codigox.co / password123</p>
              <p><strong>Broker:</strong> Broker de Juan Rivera</p>
              <p><strong>Plan:</strong> Professional</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login; 