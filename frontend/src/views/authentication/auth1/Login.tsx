import Logo from "src/assets/images/logos/Logo.svg"
import { Link, useNavigate } from "react-router"
import { useState } from "react"
import AuthLogin from "../authforms/AuthLogin"
import { useUnifiedAuth } from "src/context/UnifiedAuthContext"
import { Icon } from "@iconify/react"


const Login = () => {
  const { loginWithGoogle } = useUnifiedAuth();
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        navigate('/apps');
      } else {
        setGoogleError(result.message);
      }
    } catch {
      setGoogleError('Error al conectar con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden flex" style={{ fontFamily: "'General Sans', sans-serif" }}>
      {/* Left — gradient visual panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: 'rotate(180deg)',
          }}
        />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col p-12 xl:p-16 w-full h-full">
          {/* Logo top */}
          <a href="/">
            <img src={Logo} alt="Guro" className="h-10 w-auto" />
          </a>

          {/* Spacer to push text lower */}
          <div className="flex-1" />

          {/* Center text — positioned in lower third */}
          <div className="max-w-lg mb-20">
            <h1
              className="text-4xl xl:text-[3.5rem] font-bold text-white leading-[1.08] tracking-[-0.03em] mb-5"
              style={{ fontFamily: "'General Sans', sans-serif" }}
            >
              El futuro de los
              <br />
              seguros, hoy.
            </h1>
            <p className="text-white/80 text-lg leading-relaxed">
              Gestiona clientes, pólizas, siniestros y renovaciones con el poder de la inteligencia artificial. Todo en un solo lugar.
            </p>
          </div>

          {/* Bottom stats */}
          <div className="flex items-center gap-8">
            <div>
              <div className="text-2xl font-bold text-white" style={{ fontFamily: "'General Sans', sans-serif" }}>500+</div>
              <div className="text-xs text-white/70 mt-0.5">Agencias activas</div>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div>
              <div className="text-2xl font-bold text-white" style={{ fontFamily: "'General Sans', sans-serif" }}>1M+</div>
              <div className="text-xs text-white/70 mt-0.5">Pólizas gestionadas</div>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div>
              <div className="text-2xl font-bold text-white" style={{ fontFamily: "'General Sans', sans-serif" }}>4.8/5</div>
              <div className="text-xs text-white/70 mt-0.5">Calificación</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 sm:px-12">
        <div className="max-w-[400px] w-full">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <img src={Logo} alt="Guro" className="h-8 w-auto" />
          </div>

          {/* Header */}
          <h2
            className="text-2xl sm:text-3xl font-bold text-[#0d0d0d] tracking-[-0.02em] mb-2"
            style={{ fontFamily: "'General Sans', sans-serif" }}
          >
            Accede a Guro
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Ingresa tus credenciales para continuar
          </p>

          {/* Google button — uses real loginWithGoogle */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 h-[48px] rounded-xl border border-gray-200 text-sm font-semibold text-[#0d0d0d] hover:bg-gray-50 transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
            ) : (
              <Icon icon="flat-color-icons:google" className="w-5 h-5" />
            )}
            {googleLoading ? 'Conectando...' : 'Continuar con Google'}
          </button>

          {googleError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {googleError}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">o</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Auth form — all backend logic preserved */}
          <AuthLogin />

          {/* Bottom link */}
          <div className="flex items-center justify-center gap-2 mt-8 text-sm">
            <span className="text-gray-400">¿Nuevo en Guro?</span>
            <Link
              to="/comenzar"
              className="text-[#573CFF] font-semibold hover:underline"
            >
              Crea tu cuenta
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login