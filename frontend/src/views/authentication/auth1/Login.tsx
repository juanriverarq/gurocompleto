import Logo from "src/assets/images/logos/Logo.svg"
import { Link, useNavigate, useSearchParams } from "react-router"
import { useState, useEffect } from "react"
import { useUnifiedAuth } from "src/context/UnifiedAuthContext"
import { Icon } from "@iconify/react"


const Login = () => {
  const { loginWithGoogle, loginWithEmail, isAuthenticated } = useUnifiedAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/apps';

  // Google state
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  // Email/password state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate(redirectUrl, { replace: true });
  }, [isAuthenticated, navigate, redirectUrl]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        navigate(redirectUrl);
      } else {
        setGoogleError(result.message);
      }
    } catch {
      setGoogleError('Error al conectar con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const response = await loginWithEmail(identifier, password);
      if (response.success) {
        navigate(redirectUrl, { replace: true });
      } else {
        setLoginError(response.message);
      }
    } catch (error: any) {
      setLoginError(error.message || 'Error en el login');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div
      className="dark relative min-h-screen overflow-hidden flex bg-black"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif", colorScheme: 'dark' }}
    >
      {/* Animaciones de la landing — auroras y grid */}
      <style>{`
        @keyframes login-aurora-1 {
          0%, 100% { transform: translate3d(-8%, -6%, 0) scale(1); }
          33% { transform: translate3d(6%, 4%, 0) scale(1.08); }
          66% { transform: translate3d(-4%, 8%, 0) scale(0.96); }
        }
        @keyframes login-aurora-2 {
          0%, 100% { transform: translate3d(6%, 10%, 0) scale(1); }
          50% { transform: translate3d(-10%, -4%, 0) scale(1.12); }
        }
        @keyframes login-aurora-3 {
          0%, 100% { transform: translate3d(10%, -4%, 0) scale(0.95); }
          50% { transform: translate3d(-6%, 6%, 0) scale(1.1); }
        }
        @keyframes login-grad-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .login-grad-text {
          background: linear-gradient(90deg, #573CFF 0%, #7B61FF 22%, #A78BFA 45%, #fb923c 70%, #f97316 88%, #573CFF 100%);
          background-size: 220% 220%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: login-grad-flow 12s ease-in-out infinite;
        }
      `}</style>

      {/* Aurora background (cubre toda la pantalla, detrás de todo) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute"
          style={{
            top: '-20%', left: '-15%', width: '75%', height: '85%',
            background: 'radial-gradient(closest-side, rgba(87,60,255,0.95), rgba(87,60,255,0.35) 45%, transparent 70%)',
            filter: 'blur(70px)',
            animation: 'login-aurora-1 22s ease-in-out infinite',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '5%', right: '-20%', width: '80%', height: '90%',
            background: 'radial-gradient(closest-side, rgba(249,115,22,0.55), rgba(251,146,60,0.22) 45%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'login-aurora-2 26s ease-in-out infinite',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: '-25%', left: '15%', width: '70%', height: '75%',
            background: 'radial-gradient(closest-side, rgba(167,139,250,0.65), rgba(167,139,250,0.25) 45%, transparent 70%)',
            filter: 'blur(90px)',
            animation: 'login-aurora-3 30s ease-in-out infinite',
          }}
        />
      </div>

      {/* Grid sutil */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.1]"
        style={{
          backgroundImage: 'linear-gradient(rgba(167,139,250,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.35) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)',
        }}
      />

      {/* Viñeta para oscurecer bordes */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Grain noise overlay como en la landing */}
      <div
        className="pointer-events-none absolute inset-0 z-[4]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.55,
          mixBlendMode: 'overlay',
        }}
      />
      {/* Segunda capa de ruido más fina */}
      <div
        className="pointer-events-none absolute inset-0 z-[4]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n2)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '140px 140px',
          opacity: 0.22,
        }}
      />

      {/* Left — panel visual (hero copy + stats) */}
      <div className="hidden lg:flex lg:w-[55%] relative z-10">
        <div className="relative z-10 flex flex-col p-12 xl:p-16 w-full h-full">
          {/* Logo top */}
          <a href="/" className="flex items-center">
            <img src={Logo} alt="Guro" className="h-10 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
          </a>

          {/* Spacer to push text lower */}
          <div className="flex-1" />

          {/* Center text */}
          <div className="max-w-lg mb-20">
            <h1
              className="text-4xl xl:text-[3.5rem] font-bold leading-[1.05] tracking-[-0.03em] mb-5"
            >
              <span className="text-white">El futuro de los</span>
              <br />
              <span className="login-grad-text">seguros, hoy.</span>
            </h1>
            <p className="text-white/60 text-lg leading-relaxed">
              Gestiona clientes, pólizas, siniestros y renovaciones con el poder de la inteligencia artificial. Todo en un solo lugar.
            </p>
          </div>

          {/* Bottom stats */}
          <div className="flex items-center gap-8">
            <div>
              <div className="text-2xl font-bold text-white">500+</div>
              <div className="text-xs text-white/50 mt-0.5 uppercase tracking-[0.12em]">Agencias activas</div>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div>
              <div className="text-2xl font-bold text-white">1M+</div>
              <div className="text-xs text-white/50 mt-0.5 uppercase tracking-[0.12em]">Pólizas gestionadas</div>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div>
              <div className="text-2xl font-bold text-white">4.8/5</div>
              <div className="text-xs text-white/50 mt-0.5 uppercase tracking-[0.12em]">Calificación</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right — login form dentro de card glass */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-12 py-12">
        <div className="max-w-[420px] w-full">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <a href="/" className="inline-flex">
              <img src={Logo} alt="Guro" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
            </a>
          </div>

          {/* Glass card */}
          <div
            className="relative rounded-3xl p-8 sm:p-10 border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6),0_0_0_1px_rgba(167,139,250,0.05)]"
            style={{
              background:
                'radial-gradient(120% 120% at 0% 0%, rgba(87, 60, 255, 0.12) 0%, transparent 50%), radial-gradient(120% 120% at 100% 100%, rgba(251, 146, 60, 0.08) 0%, transparent 50%), rgba(10, 10, 15, 0.72)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            {/* Header */}
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-[-0.02em] mb-2">
              Accede a Guro
            </h2>
            <p className="text-white/50 text-sm mb-8">
              Ingresa tus credenciales para continuar
            </p>

            {/* Google button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 h-[48px] rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/25 transition-all mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Icon icon="flat-color-icons:google" className="w-5 h-5" />
              )}
              {googleLoading ? 'Conectando...' : 'Continuar con Google'}
            </button>

            {googleError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg text-sm">
                {googleError}
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-white/40 uppercase tracking-[0.2em]">o</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Formulario email/password */}
            <form onSubmit={handleEmailLogin} className="login-dark-form space-y-4">
              {/* Redirect notice */}
              {searchParams.get('redirect') && (
                <div className="p-3 bg-[#573CFF]/10 border border-[#573CFF]/25 text-[#A78BFA] rounded-xl text-xs flex items-start gap-2">
                  <Icon icon="solar:info-circle-bold" className="flex-shrink-0 mt-0.5" />
                  <span>Necesitas iniciar sesión para acceder a esa página</span>
                </div>
              )}

              {/* Email o usuario */}
              <div>
                <label htmlFor="login-identifier" className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">
                  Email o usuario
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  autoComplete="username"
                  className="w-full px-4 h-12 rounded-xl border border-white/15 bg-white/5 focus:border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition text-white placeholder:text-white/30"
                />
              </div>

              {/* Contraseña */}
              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 h-12 pr-12 rounded-xl border border-white/15 bg-white/5 focus:border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition text-white placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Error */}
              {loginError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm flex items-start gap-2">
                  <Icon icon="solar:danger-triangle-bold" className="text-red-300 flex-shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Remember + forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/25 bg-white/5 accent-[#573CFF]"
                  />
                  <span className="text-xs text-white/70">Recordarme</span>
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs text-[#A78BFA] hover:text-white transition font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Submit — estilo hero de la landing */}
              <button
                type="submit"
                disabled={loginLoading}
                className="login-sync-btn w-full h-[48px]"
              >
                <span className="login-sync-track" />
                <span className="login-sync-inner">
                  {loginLoading ? (
                    <>
                      <Icon icon="svg-spinners:ring-resize" className="text-lg text-white" />
                      <span>Iniciando sesión...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar sesión</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>

          {/* Bottom link */}
          <div className="flex items-center justify-center gap-2 mt-8 text-sm">
            <span className="text-white/40">¿Nuevo en Guro?</span>
            <Link
              to="/comenzar"
              className="text-[#A78BFA] font-semibold hover:text-white transition-colors"
            >
              Crea tu cuenta
            </Link>
          </div>
        </div>
      </div>

      {/* Estilos del botón hero-sync (como en la landing) */}
      <style>{`
        @keyframes login-sync-spin { to { transform: rotate(360deg); } }
        .login-sync-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          padding: 2px;
          overflow: hidden;
          filter: drop-shadow(0 0 14px rgba(87, 60, 255, 0.45));
          transition: filter 0.35s ease;
          cursor: pointer;
          border: none;
          background: none;
        }
        .login-sync-btn:hover:not(:disabled) {
          filter: drop-shadow(0 0 22px rgba(87, 60, 255, 0.65)) drop-shadow(0 0 34px rgba(251, 146, 60, 0.3));
        }
        .login-sync-btn:disabled { opacity: 0.6; cursor: not-allowed; filter: none; }
        .login-sync-btn .login-sync-track {
          position: absolute;
          inset: -60%;
          background: conic-gradient(from 0deg, #573CFF, #7B61FF, #A78BFA, #fb923c, #f97316, #573CFF);
          animation: login-sync-spin 3.8s linear infinite;
        }
        .login-sync-btn:hover:not(:disabled) .login-sync-track { animation-duration: 2.2s; }
        .login-sync-btn .login-sync-inner {
          position: relative;
          z-index: 2;
          border-radius: 9999px;
          color: #fff;
          background: linear-gradient(180deg, #141414 0%, #000000 100%);
          transition: box-shadow 0.35s ease, background 0.35s ease;
          text-shadow: 0 1px 2px rgba(0,0,0,0.45);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          white-space: nowrap;
          width: 100%;
          height: 100%;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
        .login-sync-btn:hover:not(:disabled) .login-sync-inner {
          background:
            radial-gradient(ellipse 100% 80% at 50% 0%, rgba(87, 60, 255, 0.22) 0%, transparent 52%),
            linear-gradient(180deg, #1a1528 0%, #050508 100%);
          box-shadow:
            inset 0 0 28px rgba(123, 97, 255, 0.18),
            inset 0 -12px 32px rgba(251, 146, 60, 0.08),
            0 0 0 1px rgba(167, 139, 250, 0.12);
        }
        /* Overrides para inputs dark del login (ganarle al global form input) */
        .login-dark-form input[type="text"],
        .login-dark-form input[type="email"],
        .login-dark-form input[type="password"],
        form.login-dark-form input {
          background-color: rgba(255,255,255,0.05) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .login-dark-form input::placeholder { color: rgba(255,255,255,0.3) !important; }
        .login-dark-form input:focus {
          background-color: rgba(255,255,255,0.08) !important;
          border-color: rgba(167,139,250,0.55) !important;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.18) !important;
        }
      `}</style>
    </div>
  )
}

export default Login