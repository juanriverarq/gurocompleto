import { Button, Label, TextInput } from 'flowbite-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { signInWithCustomToken, getAuth } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

const EmpleadoLogin = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, setEmpleadoSession } = useUnifiedAuth();

  const redirectUrl = searchParams.get('redirect') || '/apps';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/empleado-auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 1) Iniciar sesión en Firebase con Custom Token
        const firebaseCustomToken = data.data.firebase_custom_token;
        if (!firebaseCustomToken) {
          throw new Error('No se recibió firebase_custom_token desde el backend');
        }
        const auth = getAuth();
        await signInWithCustomToken(auth, firebaseCustomToken);

        // 2) Guardar sesión del empleado (datos de contexto UI)
        setEmpleadoSession({
          token: firebaseCustomToken,
          empleado: data.data.empleado,
          broker: data.data.broker,
          permisos: data.data.permisos,
        });

        if (data.data.first_login || data.data.requiere_cambio_password) {
          navigate('/auth/empleado/cambiar-password', { replace: true });
        } else {
          navigate(redirectUrl, { replace: true });
        }
      } else {
        setError(data.message || 'Credenciales inválidas');
      }
    } catch (err: any) {
      setError(err?.message || 'Error en el login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {searchParams.get('redirect') && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
          🔐 Necesitas iniciar sesión para acceder a esa página
        </div>
      )}

      <form className="mt-6" onSubmit={handleLogin}>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="identifier" value="Email o Usuario" />
          </div>
          <TextInput
            id="identifier"
            type="text"
            sizing="md"
            className="form-control"
            placeholder="Ingresa tu email o usuario"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="password" value="Contraseña" />
          </div>
          <TextInput
            id="password"
            type="password"
            sizing="md"
            className="form-control"
            placeholder="Ingresa tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="my-5">
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </Button>
        </div>

        <div className="flex items-center justify-center">
          <Link to="/auth/auth1/login" className="text-sm text-primary hover:underline">
            ¿Eres administrador? Inicia sesión aquí
          </Link>
        </div>
      </form>
    </>
  );
};

export default EmpleadoLogin;
