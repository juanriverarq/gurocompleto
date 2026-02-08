import { Checkbox, Label, TextInput } from "flowbite-react";
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
        <div className="mb-4 p-3 bg-[#573CFF]/10 border border-[#573CFF]/20 text-[#573CFF] rounded-xl text-sm">
          Necesitas iniciar sesión para acceder a esa página
        </div>
      )}

      
      <form onSubmit={handleLogin}>
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
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
            className="text-sm text-[#573CFF] hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            disabled={loading}
            className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[52px] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
          >
            <span className="absolute inset-y-0 left-0 w-[52px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
            <span className="relative z-10 flex items-center justify-center w-[52px] h-full flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </span>
            <span
              className="relative z-10 pr-6 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap"
              style={{ fontFamily: "'General Sans', sans-serif" }}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </span>
          </button>
        </div>
      </form>
    </>
  );
};

export default AuthLogin;
