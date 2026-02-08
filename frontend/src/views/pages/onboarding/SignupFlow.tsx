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

    try {
      // Registrar con Firebase
      const response = await registerWithEmail(formData.email, formData.password, formData.fullName);

      if (response.success) {
        // Esperar a que Firebase esté listo y obtener token
        await auth.currentUser?.getIdToken(true);
        
        // Crear el broker directamente con los datos del formulario
        try {
          const brokerResponse = await api.post('/saas/onboarding/create-broker-simple', {
            phone: formData.phone,
            employeeCount: formData.employeeCount,
            businessType: formData.businessType,
            modules: selectedApps,
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
    <div className="min-h-screen bg-[#fafafa]" style={{ fontFamily: "'General Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/">
            <img src={LogoSvg} alt="Guro" className="h-8 w-auto" />
          </a>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 opacity-40">
              <span className="w-6 h-6 rounded-full bg-[#573CFF] text-white text-xs font-bold flex items-center justify-center">✓</span>
              <span className="text-xs font-medium text-gray-400">Aplicaciones</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-[#573CFF] text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-xs font-semibold text-[#0d0d0d]">Registro</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Banner Sura */}
        {isSuraFlow && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-[#0033A0] to-[#00A1E4] p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={SURA_LOGO_URL}
                  alt="Logo SURA"
                  className="h-10 w-auto"
                />
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
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0d0d0d] mb-3 tracking-[-0.02em]">
            Comienza a usar <span className="text-[#573CFF]">Guro</span>
          </h1>
          <p className="text-gray-500 text-base">
            Acceso gratis e instantáneo. No necesitas tarjeta de crédito.
          </p>
        </div>

        {/* Apps seleccionadas */}
        <div className="bg-white rounded-xl p-4 mb-6 flex items-center justify-between border border-gray-200 shadow-sm">
          <span className="font-semibold text-[#0d0d0d] text-sm">
            {selectedApps?.length || 0} aplicaciones seleccionadas
          </span>
          <button
            onClick={handleChangeApps}
            className="text-[#573CFF] hover:underline font-medium text-sm transition"
          >
            Cambiar
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nombre completo */}
          <div>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Nombre y apellidos"
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition text-[#0d0d0d] placeholder:text-gray-400"
            />
          </div>

          {/* Email */}
          <div>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Correo electrónico"
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition text-[#0d0d0d] placeholder:text-gray-400"
            />
          </div>

          {/* Teléfono */}
          <div>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Teléfono (ej: +57 300 123 4567)"
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition text-[#0d0d0d] placeholder:text-gray-400"
            />
          </div>

          {/* Contraseña */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Contraseña (mínimo 6 caracteres)"
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition pr-12 text-[#0d0d0d] placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark dark:hover:text-white"
            >
              {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
            </button>
          </div>

          {/* Cantidad de empleados */}
          <div>
            <select
              name="employeeCount"
              value={formData.employeeCount}
              onChange={handleChange}
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition text-[#0d0d0d]"
            >
              <option value="" className="text-gray-400">Cantidad de empleados</option>
              {EMPLOYEE_RANGES.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de negocio */}
          <div>
            <select
              name="businessType"
              value={formData.businessType}
              onChange={handleChange}
              required
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition text-[#0d0d0d]"
            >
              <option value="" className="text-gray-400">Tipo de negocio</option>
              {BUSINESS_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Términos */}
          <div className="flex items-start gap-3 pt-2">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#573CFF] focus:ring-[#573CFF]"
            />
            <label htmlFor="terms" className="text-sm text-gray-500 leading-relaxed">
              Al hacer clic en <strong className="text-[#0d0d0d]">Comienza ahora</strong>, aceptas nuestro{' '}
              <Link to="/terminos-condiciones" className="text-[#573CFF] hover:underline">
                Contrato de suscripción
              </Link>{' '}
              y{' '}
              <Link to="/politica-privacidad" className="text-[#573CFF] hover:underline">
                Política de privacidad
              </Link>
            </label>
          </div>

          {/* Submit — Hero style */}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full inline-flex items-center justify-center bg-[#0d0d0d] rounded-2xl h-[52px] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="absolute inset-y-0 left-0 w-[52px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
            <span className="relative z-10 flex items-center justify-center w-[52px] h-full flex-shrink-0">
              {loading ? (
                <Icon icon="svg-spinners:ring-resize" className="text-lg text-white" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              )}
            </span>
            <span
              className="relative z-10 pr-6 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap"
            >
              {loading ? 'Creando cuenta...' : 'Comienza ahora'}
            </span>
          </button>

          {/* Login link */}
          <p className="text-center text-gray-500 text-sm">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/auth/login" className="text-[#573CFF] hover:underline font-semibold">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignupFlow;
