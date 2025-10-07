import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { Label } from 'src/components/shadcn-ui/Default-Ui/label';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { useToast } from 'src/hooks/use-toast';
import empleadoAuth from '../../services/empleadoAuth';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import { API_BASE_URL } from '../../config/api';
import { auth } from '../../config/firebase';
import { getIdToken } from 'firebase/auth';

const EmpleadoLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { setEmpleadoSession } = useUnifiedAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión de empleado, redirigir
  useEffect(() => {
    if (empleadoAuth.isAuthenticated()) {
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || '/apps';
      navigate(redirect, { replace: true });
    }
  }, [location.search, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Datos incompletos',
        description: 'Ingresa correo y contraseña.',
      });
      return;
    }
    setLoading(true);
    try {
      const res = await empleadoAuth.login(email.trim(), password);
      if (!res.success) {
        toast({
          variant: 'destructive',
          title: 'No se pudo iniciar sesión',
          description: res.message || 'Credenciales inválidas',
        });
        return;
      }
      // Intentar obtener contexto (broker y permisos) inmediatamente para evitar pantalla de "Cargando contexto..."
      // Si el backend devolvió Firebase Custom Token, el Authorization debe ser el ID Token de Firebase, no 'FIREBASE'
      const tokenSentinel = res.token || empleadoAuth.getToken() || '';
      let apiAuthToken = tokenSentinel;
      let broker: any | undefined;
      let permisos: string[] | undefined;

      try {
        if (auth.currentUser) {
          apiAuthToken = await getIdToken(auth.currentUser);
        } else if (tokenSentinel === 'FIREBASE') {
          // pequeño delay para permitir que Firebase termine de establecer la sesión
          await new Promise((r) => setTimeout(r, 250));
          if (auth.currentUser) {
            apiAuthToken = await getIdToken(auth.currentUser);
          }
        }

        const ctxResp = await fetch(`${API_BASE_URL}/empleado-auth/contexto`, {
          headers: {
            'Authorization': `Bearer ${apiAuthToken}`,
            'Accept': 'application/json',
          },
        });
        if (ctxResp.ok) {
          const ctx = await ctxResp.json().catch(() => ({} as any));
          if (ctx?.success && ctx?.data) {
            broker = ctx.data.broker;
            permisos = ctx.data.permisos;
          }
        }
      } catch {}

      // Guardar sesión en el contexto unificado (incluyendo broker/permisos si se obtuvieron)
      setEmpleadoSession({
        token: tokenSentinel, // guardamos 'FIREBASE' como sentinela cuando aplica
        empleado: res.empleado || {},
        broker,
        permisos,
      });
      toast({
        title: 'Bienvenido',
        description: res.empleado?.nombres
          ? `Hola ${res.empleado.nombres}`
          : 'Sesión iniciada',
      });
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || '/apps';
      navigate(redirect, { replace: true });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error de autenticación',
        description: err?.message || 'Error inesperado al iniciar sesión',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Acceso Empleados</h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">Inicia sesión con tu cuenta de empleado del broker</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="identifier">Usuario o email</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              placeholder="usuario o correo"
              className="mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-[10px] text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPwd ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          <p>
            ¿Eres usuario SaaS?{' '}
            <Link to="/auth/login" className="text-primary hover:underline">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmpleadoLogin;