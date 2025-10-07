import { Button, Checkbox, Label, TextInput } from "flowbite-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
import { useUnifiedAuth } from "src/context/UnifiedAuthContext";

/* usando configuración centralizada; eliminar hardcode de API_BASE_URL */

const AuthLogin = () => {
  const [identifier, setIdentifier] = useState(""); // Cambio email por identifier
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Separado: este formulario ya no maneja empleados
  
  const { loginWithEmail, isAuthenticated } = useUnifiedAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Obtener la URL de redirección del parámetro redirect
  const redirectUrl = searchParams.get('redirect') || '/apps';

  // Si ya está autenticado, redirigir automáticamente
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectUrl, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectUrl]);

  // Este login solo procesa administradores (Firebase)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await loginWithEmail(identifier, password);
      if (response.success) {
        navigate(redirectUrl, { replace: true });
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError(error.message || "Error en el login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Mensaje de redirección si viene de una página protegida */}
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
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Checkbox id="remember" />
            <Label htmlFor="remember" value="Recordarme" className="text-sm" />
          </div>
          <Link
            to="/auth/auth1/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="my-5">
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </Button>
        </div>
      </form>
    </>
  );
};

export default AuthLogin;
