import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate, Link, useLocation } from 'react-router';
import { ModuleKey } from 'src/components/landingpage/pricing-calculator/modules';
import LogoSvg from 'src/assets/images/logos/Logo.svg';

const SURA_LOGO_URL =
  'https://www.sura.co/documents/43501/0/Logo-SURA-blanco+1.svg/8937a328-d03b-7aa7-79bd-a5308a3931b3?version=1.0&t=1704405886717';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import api from 'src/config/api';
import { auth } from 'src/config/firebase';
import LoadingScreen from './LoadingScreen';

// Tipos de negocio
const BUSINESS_TYPES = [
  { value: 'agente_dependiente', label: 'Agente dependiente' },
  { value: 'agente_independiente', label: 'Agente independiente' },
  { value: 'agencia_dependiente', label: 'Agencia dependiente' },
  { value: 'agencia_independiente', label: 'Agencia independiente' },
  { value: 'correduria', label: 'Correduría' },
];

// Rangos de empleados
const EMPLOYEE_RANGES = [
  { value: '1', label: '1 empleado (solo yo)' },
  { value: '2-5', label: '2-5 empleados' },
  { value: '6-10', label: '6-10 empleados' },
  { value: '11-20', label: '11-20 empleados' },
  { value: '21-50', label: '21-50 empleados' },
  { value: '50+', label: 'Más de 50 empleados' },
];

// Simple Eye Icons
const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeSlashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
  </svg>
);

const SignupFlow = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { registerWithEmail } = useUnifiedAuth();
  
  // Detectar flujo Sura (por URL o localStorage)
  const isSuraFlow = location.pathname.startsWith('/sura') || localStorage.getItem('guro_sura_flow') === '1';
  const basePath = isSuraFlow ? '/sura' : '/comenzar';
  
  // Cargar apps seleccionadas
  const [selectedApps, setSelectedApps] = useState<ModuleKey[]>();
  
  useEffect(() => {
    const saved = localStorage.getItem('guro_selected_apps');
    if (saved) {
      try {
        setSelectedApps(JSON.parse(saved));
      } catch {
        navigate(basePath);
      }
    } else {
      navigate(basePath);
    }
  }, [navigate, basePath]);

  // selectedModules se puede usar para mostrar las apps seleccionadas si se necesita
  // const selectedModules = useMemo(() => MODULES.filter(m => selectedApps.includes(m.key)), [selectedApps]);

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    employeeCount: '',
    businessType: '',
    accessCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validaciones
    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (!formData.phone || formData.phone.length < 7) {
      setError('Ingresa un número de teléfono válido');
      setLoading(false);
      return;
    }

    if (!formData.employeeCount) {
      setError('Selecciona la cantidad de empleados');
      setLoading(false);
      return;
    }

    if (!formData.businessType) {
      setError('Selecciona el tipo de negocio');
      setLoading(false);
      return;
    }

    if (formData.accessCode !== 'GuroTecnologia2026@') {
      setError('El código de acceso no es válido. Solicítalo por WhatsApp.');
      setLoading(false);
      return;
    }

    try {
      // Registrar con Firebase
      const response = await registerWithEmail(formData.email, formData.password, formData.fullName);

      if (response.success) {
        // Esperar a que Firebase esté listo y obtener token
        await auth.currentUser?.getIdToken(true);
        
        // Crear el broker directamente con los datos del formulario
        try {
          // Leer pricing selection para enviar users_count, storage_gb, period
          let pricingExtra: Record<string, any> = {};
          try {
            const ps = localStorage.getItem('guro_pricing_selection');
            if (ps) {
              const parsed = JSON.parse(ps);
              pricingExtra = {
                users_count: parsed.users,
                storage_gb: parsed.storageGB,
                period: parsed.period,
              };
            }
          } catch {}

          const brokerResponse = await api.post('/saas/onboarding/create-broker-simple', {
            phone: formData.phone,
            employeeCount: formData.employeeCount,
            businessType: formData.businessType,
            modules: selectedApps,
            ...pricingExtra,
          });

          if (!brokerResponse.data.success) {
            console.error('Error creando broker:', brokerResponse.data.message);
          }
        } catch (e) {
          console.error('Error creando broker:', e);
          // Continuar de todos modos, el broker se puede crear después
        }

        // Guardar también en subscription_intents para tracking
        try {
          // Obtener info del cupón Sura si existe
          let suraCoupon = null;
          try {
            const pricingData = localStorage.getItem('guro_pricing_selection');
            if (pricingData) {
              const parsed = JSON.parse(pricingData);
              suraCoupon = parsed.suraCoupon || null;
            }
          } catch {}
          
          await api.post('/pricing/subscription-intents', {
            modules: selectedApps,
            phone: formData.phone,
            employeeCount: formData.employeeCount,
            businessType: formData.businessType,
            source: isSuraFlow ? 'sura_onboarding_flow' : 'onboarding_flow',
            coupon: suraCoupon,
          });
        } catch (e) {
          // Ignorar errores de subscription intent
          console.error('Error saving subscription intent:', e);
        }

        // Limpiar localStorage
        localStorage.removeItem('guro_selected_apps');
        localStorage.removeItem('guro_sura_flow');
        
        // Mostrar pantalla de carga animada
        setLoading(false);
        setShowLoadingScreen(true);
      } else {
        setError(response.message || 'Error en el registro');
      }
    } catch (err) {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeApps = () => {
    navigate(basePath);
  };

  const handleLoadingComplete = () => {
    // Redirigir al dashboard después de la animación
    window.location.href = '/apps';
  };

  // Mostrar pantalla de carga si está activa
  if (showLoadingScreen) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <div
      className="dark su-dark-form relative min-h-screen overflow-x-hidden bg-black text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif", colorScheme: 'dark' }}
    >
      {/* Animaciones */}
      <style>{`
        @keyframes su-aurora-1 {
          0%, 100% { transform: translate3d(-8%, -6%, 0) scale(1); }
          33% { transform: translate3d(6%, 4%, 0) scale(1.08); }
          66% { transform: translate3d(-4%, 8%, 0) scale(0.96); }
        }
        @keyframes su-aurora-2 {
          0%, 100% { transform: translate3d(6%, 10%, 0) scale(1); }
          50% { transform: translate3d(-10%, -4%, 0) scale(1.12); }
        }
        @keyframes su-aurora-3 {
          0%, 100% { transform: translate3d(10%, -4%, 0) scale(0.95); }
          50% { transform: translate3d(-6%, 6%, 0) scale(1.1); }
        }
        @keyframes su-grad-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .su-grad-text {
          background: linear-gradient(90deg, #573CFF 0%, #7B61FF 22%, #A78BFA 45%, #fb923c 70%, #f97316 88%, #573CFF 100%);
          background-size: 220% 220%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: su-grad-flow 12s ease-in-out infinite;
        }
        @keyframes su-sync-spin { to { transform: rotate(360deg); } }
        .su-sync-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          border-radius: 9999px;
          padding: 2px;
          overflow: hidden;
          filter: drop-shadow(0 0 14px rgba(87, 60, 255, 0.45));
          transition: filter 0.35s ease;
          cursor: pointer;
          border: none;
        }
        .su-sync-btn:hover { filter: drop-shadow(0 0 22px rgba(87, 60, 255, 0.65)) drop-shadow(0 0 34px rgba(251, 146, 60, 0.3)); }
        .su-sync-btn:disabled { opacity: 0.6; cursor: not-allowed; filter: none; }
        .su-sync-btn .su-sync-track {
          position: absolute;
          inset: -60%;
          background: conic-gradient(from 0deg, #573CFF, #7B61FF, #A78BFA, #fb923c, #f97316, #573CFF);
          animation: su-sync-spin 3.8s linear infinite;
        }
        .su-sync-btn:hover .su-sync-track { animation-duration: 2.2s; }
        .su-sync-btn .su-sync-inner {
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
        }
        .su-sync-btn:hover:not(:disabled) .su-sync-inner {
          background:
            radial-gradient(ellipse 100% 80% at 50% 0%, rgba(87, 60, 255, 0.22) 0%, transparent 52%),
            linear-gradient(180deg, #1a1528 0%, #050508 100%);
          box-shadow:
            inset 0 0 28px rgba(123, 97, 255, 0.18),
            inset 0 -12px 32px rgba(251, 146, 60, 0.08),
            0 0 0 1px rgba(167, 139, 250, 0.12);
        }
        /* Overrides para inputs/selects dark del signup (ganarle al global form input) */
        .su-dark-form input[type="text"],
        .su-dark-form input[type="email"],
        .su-dark-form input[type="tel"],
        .su-dark-form input[type="password"],
        .su-dark-form input[type="number"],
        form.su-dark-form input {
          background-color: rgba(255,255,255,0.05) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .su-dark-form input::placeholder { color: rgba(255,255,255,0.3) !important; }
        .su-dark-form input:focus,
        .su-dark-form select:focus {
          background-color: rgba(255,255,255,0.08) !important;
          border-color: rgba(167,139,250,0.55) !important;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.18) !important;
        }
        .su-dark-form select {
          background-color: rgba(255,255,255,0.05) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        /* Labels siempre claros — gana al global 'html:not(.dark) label' (0,1,2)
           usando doble clase (0,2,1) */
        .dark.su-dark-form label,
        .dark.su-dark-form form label,
        .dark.su-dark-form div label {
          color: rgba(255, 255, 255, 0.9) !important;
        }
        /* Inputs con doble clase para mayor especificidad */
        .dark.su-dark-form input,
        .dark.su-dark-form form input {
          background-color: rgba(255,255,255,0.05) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
        .dark.su-dark-form input::placeholder,
        .dark.su-dark-form form input::placeholder {
          color: rgba(255,255,255,0.3) !important;
        }
        .dark.su-dark-form input:focus,
        .dark.su-dark-form form input:focus,
        .dark.su-dark-form select:focus {
          background-color: rgba(255,255,255,0.08) !important;
          border-color: rgba(167,139,250,0.55) !important;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.18) !important;
        }
        .dark.su-dark-form select {
          background-color: rgba(255,255,255,0.05) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
      `}</style>

      {/* Aurora background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute"
          style={{
            top: '-20%', left: '-15%', width: '75%', height: '85%',
            background: 'radial-gradient(closest-side, rgba(87,60,255,0.85), rgba(87,60,255,0.3) 45%, transparent 70%)',
            filter: 'blur(70px)',
            animation: 'su-aurora-1 22s ease-in-out infinite',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '5%', right: '-20%', width: '80%', height: '90%',
            background: 'radial-gradient(closest-side, rgba(249,115,22,0.5), rgba(251,146,60,0.2) 45%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'su-aurora-2 26s ease-in-out infinite',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: '-25%', left: '15%', width: '70%', height: '75%',
            background: 'radial-gradient(closest-side, rgba(167,139,250,0.6), rgba(167,139,250,0.22) 45%, transparent 70%)',
            filter: 'blur(90px)',
            animation: 'su-aurora-3 30s ease-in-out infinite',
          }}
        />
      </div>

      {/* Grid sutil */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.08]"
        style={{
          backgroundImage: 'linear-gradient(rgba(167,139,250,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.35) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Viñeta */}
      <div
        className="pointer-events-none fixed inset-0 z-[2]"
        style={{
          background: 'radial-gradient(ellipse at 50% 35%, transparent 30%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.9) 100%)',
        }}
      />

      {/* Noise grano — textura tipo landing */}
      <div
        className="pointer-events-none fixed inset-0 z-[3]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.55,
          mixBlendMode: 'overlay',
        }}
      />
      {/* Segunda capa de grano más fino */}
      <div
        className="pointer-events-none fixed inset-0 z-[3]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n2)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '140px 140px',
          opacity: 0.22,
        }}
      />

      {/* Header */}
      <header className="relative z-10 sticky top-0 backdrop-blur-xl border-b border-white/10 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <img src={LogoSvg} alt="Guro" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
          </a>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 opacity-60">
              <span className="w-6 h-6 rounded-full bg-[#573CFF]/30 border border-[#573CFF]/50 text-white text-xs font-bold flex items-center justify-center">✓</span>
              <span className="text-xs font-medium text-white/60 hidden sm:inline">Aplicaciones</span>
            </div>
            <div className="w-8 h-px bg-white/20" />
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-[#573CFF] text-white text-xs font-bold flex items-center justify-center shadow-[0_0_12px_rgba(87,60,255,0.6)]">2</span>
              <span className="text-xs font-semibold text-white hidden sm:inline">Registro</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-xl mx-auto px-4 py-10">
        {/* Banner Sura */}
        {isSuraFlow && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-[#0033A0] to-[#00A1E4] p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src={SURA_LOGO_URL} alt="Logo SURA" className="h-10 w-auto" />
                <div className="h-8 w-px bg-white/30 hidden sm:block" />
                <div>
                  <p className="text-white/80 text-xs font-medium">Convenio exclusivo</p>
                  <h2 className="text-white text-lg font-bold">SURA + Guro</h2>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                <span className="text-white text-sm font-bold">30% OFF</span>
                <span className="text-white/90 text-xs">aplicado</span>
              </div>
            </div>
          </div>
        )}

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-[2.75rem] font-bold mb-3 tracking-[-0.03em] leading-[1.05]">
            <span className="text-white">Comienza a usar </span>
            <span className="su-grad-text">Guro</span>
          </h1>
          <p className="text-white/50 text-base">
            Acceso gratis e instantáneo. No necesitas tarjeta de crédito.
          </p>
        </div>

        {/* Apps seleccionadas */}
        <div className="rounded-xl p-4 mb-6 flex items-center justify-between border border-white/10 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#573CFF]/20 border border-[#573CFF]/30 flex items-center justify-center">
              <Icon icon="solar:widget-2-bold" className="text-[#A78BFA] text-lg" />
            </div>
            <div>
              <span className="font-semibold text-white text-sm block">
                {selectedApps?.length || 0} aplicaciones seleccionadas
              </span>
              <span className="text-[11px] text-white/50">Personalizaste tu plan en el paso anterior</span>
            </div>
          </div>
          <button
            onClick={handleChangeApps}
            className="text-[#A78BFA] hover:text-white font-medium text-xs transition uppercase tracking-wider"
          >
            Cambiar
          </button>
        </div>

        {/* Glass card con formulario */}
        <div
          className="rounded-3xl p-6 sm:p-8 border border-white/10 backdrop-blur-xl"
          style={{
            background:
              'radial-gradient(120% 120% at 0% 0%, rgba(87, 60, 255, 0.1) 0%, transparent 50%), radial-gradient(120% 120% at 100% 100%, rgba(251, 146, 60, 0.06) 0%, transparent 50%), rgba(10, 10, 15, 0.72)',
            boxShadow: '0 20px 60px -15px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.05)',
          }}
        >
          {/* Formulario */}
          <form onSubmit={handleSubmit} className="su-dark-form space-y-4">
            {/* Nombre completo */}
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">Nombre completo</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Ej: Juan Rivera"
                required
                className="w-full px-4 h-12 rounded-xl !border !border-white/15 !bg-white/5 focus:!bg-white/10 focus:!border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition !text-white placeholder:!text-white/30"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">Correo electrónico</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="tu@correo.com"
                required
                className="w-full px-4 h-12 rounded-xl !border !border-white/15 !bg-white/5 focus:!bg-white/10 focus:!border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition !text-white placeholder:!text-white/30"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">Teléfono</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+57 300 123 4567"
                required
                className="w-full px-4 h-12 rounded-xl !border !border-white/15 !bg-white/5 focus:!bg-white/10 focus:!border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition !text-white placeholder:!text-white/30"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full px-4 h-12 pr-12 rounded-xl !border !border-white/15 !bg-white/5 focus:!bg-white/10 focus:!border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition !text-white placeholder:!text-white/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                >
                  {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Grid de selects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cantidad de empleados */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">Empleados</label>
                <select
                  name="employeeCount"
                  value={formData.employeeCount}
                  onChange={handleChange}
                  required
                  className="w-full px-4 h-12 rounded-xl !border !border-white/15 !bg-white/5 focus:!bg-white/10 focus:!border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition !text-white"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="" className="bg-[#0a0a0f] text-white/50">Selecciona...</option>
                  {EMPLOYEE_RANGES.map(range => (
                    <option key={range.value} value={range.value} className="bg-[#0a0a0f]">
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de negocio */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">Tipo de negocio</label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 h-12 rounded-xl !border !border-white/15 !bg-white/5 focus:!bg-white/10 focus:!border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition !text-white"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="" className="bg-[#0a0a0f] text-white/50">Selecciona...</option>
                  {BUSINESS_TYPES.map(type => (
                    <option key={type.value} value={type.value} className="bg-[#0a0a0f]">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Código de acceso */}
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">Código de acceso</label>
              <input
                type="text"
                name="accessCode"
                value={formData.accessCode}
                onChange={handleChange}
                placeholder="Ingresa tu código"
                required
                className="w-full px-4 h-12 rounded-xl !border !border-white/15 !bg-white/5 focus:!bg-white/10 focus:!border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/20 outline-none transition !text-white placeholder:!text-white/30"
              />
              <p className="mt-2 text-xs text-white/50">
                ¿No tienes código?{' '}
                <a
                  href="https://wa.me/573001009305?text=Hola%2C%20quiero%20solicitar%20el%20c%C3%B3digo%20de%20acceso%20para%20registrarme%20en%20Guro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#25D366] hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Solicítalo por WhatsApp
                </a>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm flex items-start gap-2">
                <Icon icon="solar:danger-triangle-bold" className="text-red-300 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Términos */}
            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/25 bg-white/5 accent-[#573CFF]"
              />
              <label htmlFor="terms" className="text-xs text-white/50 leading-relaxed">
                Al hacer clic en <strong className="text-white">Comienza ahora</strong>, aceptas nuestro{' '}
                <Link to="/terminos-condiciones" className="text-[#A78BFA] hover:text-white transition underline-offset-2 hover:underline">
                  Contrato de suscripción
                </Link>{' '}
                y{' '}
                <Link to="/politica-privacidad" className="text-[#A78BFA] hover:text-white transition underline-offset-2 hover:underline">
                  Política de privacidad
                </Link>
              </label>
            </div>

            {/* Submit — estilo hero de la landing */}
            <button
              type="submit"
              disabled={loading}
              className="su-sync-btn w-full h-[52px]"
              style={{ letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '12px', fontWeight: 700 }}
            >
              <span className="su-sync-track" />
              <span className="su-sync-inner">
                {loading ? (
                  <>
                    <Icon icon="svg-spinners:ring-resize" className="text-lg text-white" />
                    <span>Creando cuenta...</span>
                  </>
                ) : (
                  <>
                    <span>Comienza ahora</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </>
                )}
              </span>
            </button>

            {/* Login link */}
            <p className="text-center text-white/50 text-sm pt-2">
              ¿Ya tienes una cuenta?{' '}
              <Link to="/auth/login" className="text-[#A78BFA] hover:text-white font-semibold transition">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignupFlow;
