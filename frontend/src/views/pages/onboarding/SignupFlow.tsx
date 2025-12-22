import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate, Link } from 'react-router';
import { ModuleKey } from 'src/components/landingpage/pricing-calculator/modules';
import Logo from 'src/layouts/full/shared/logo/Logo';
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
  const { registerWithEmail } = useUnifiedAuth();
  
  // Cargar apps seleccionadas
  const [selectedApps, setSelectedApps] = useState<ModuleKey[]>([]);
  
  useEffect(() => {
    const saved = localStorage.getItem('guro_selected_apps');
    if (saved) {
      try {
        setSelectedApps(JSON.parse(saved));
      } catch {
        navigate('/comenzar');
      }
    } else {
      navigate('/comenzar');
    }
  }, [navigate]);

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
          await api.post('/pricing/subscription-intents', {
            modules: selectedApps,
            phone: formData.phone,
            employeeCount: formData.employeeCount,
            businessType: formData.businessType,
            source: 'onboarding_flow',
          });
        } catch (e) {
          // Ignorar errores de subscription intent
          console.error('Error saving subscription intent:', e);
        }

        // Limpiar localStorage
        localStorage.removeItem('guro_selected_apps');
        
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
    navigate('/comenzar');
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
    <div className="min-h-screen bg-white dark:bg-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-dark border-b border-gray-200 dark:border-darkborder">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="text-sm text-gray-500 font-medium">
            Paso 2 de 2
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Título */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-dark dark:text-white mb-3">
            Comienza a usar <span className="text-primary">Guro</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-base">
            Acceso gratis e instantáneo. No necesitas tarjeta de crédito.
          </p>
        </div>

        {/* Apps seleccionadas */}
        <div className="bg-gray-50 dark:bg-darkgray rounded-xl p-4 mb-6 flex items-center justify-between">
          <span className="font-semibold text-dark dark:text-white text-sm">
            {selectedApps.length} aplicaciones seleccionadas
          </span>
          <button
            onClick={handleChangeApps}
            className="text-primary hover:text-primaryemphasis font-medium text-sm transition"
          >
            Cambiar las aplicaciones seleccionadas
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
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-darkborder bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-dark dark:text-white placeholder:text-gray-400"
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
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-darkborder bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-dark dark:text-white placeholder:text-gray-400"
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
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-darkborder bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-dark dark:text-white placeholder:text-gray-400"
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
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-darkborder bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition pr-12 text-dark dark:text-white placeholder:text-gray-400"
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
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-darkborder bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-dark dark:text-white"
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
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-darkborder bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-dark dark:text-white"
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
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
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
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Al hacer clic en <strong className="text-dark dark:text-white">Comienza ahora</strong>, aceptas nuestro{' '}
              <Link to="/terminos-condiciones" className="text-primary hover:underline">
                Contrato de suscripción
              </Link>{' '}
              y{' '}
              <Link to="/politica-privacidad" className="text-primary hover:underline">
                Política de privacidad
              </Link>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-3.5 px-6 rounded-xl font-semibold text-white transition-all
              ${loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-primary hover:bg-primaryemphasis cursor-pointer'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Icon icon="svg-spinners:ring-resize" className="text-lg" />
                Creando cuenta...
              </span>
            ) : (
              'Comienza ahora'
            )}
          </button>

          {/* Login link */}
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/auth/login" className="text-primary hover:underline font-medium">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignupFlow;
