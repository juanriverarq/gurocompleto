import { Button, Label, TextInput } from "flowbite-react";
import { Checkbox as UiCheckbox } from "src/components/shadcn-ui/Default-Ui/checkbox";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { useUnifiedAuth } from '../../../context/UnifiedAuthContext';

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

const AuthRegister = () => {
  const navigate = useNavigate();
  const { registerWithEmail } = useUnifiedAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validaciones básicas
    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
        // Usar Firebase Auth para hacer el registro
        const response = await registerWithEmail(
            formData.email,
            formData.password,
            formData.name
        );

        if (response.success) {
            setSuccess(true);
            // Firebase siempre requiere verificación de email para nuevos usuarios
            // Solo mostrar mensaje de verificación, SIN redirección automática
            // El usuario debe verificar su email y luego hacer login manualmente
        } else {
            setError(response.message || 'Error en el registro');
        }
    } catch (err) {
        setError('Error de conexión. Intenta nuevamente.');
    } finally {
        setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (success) {
    return (
      <div className="mt-6 text-center">
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h3 className="font-semibold mb-2">¡Registro exitoso!</h3>
          <p className="text-sm">
            Hemos enviado un email de verificación a <strong>{formData.email}</strong>.
          </p>
          <p className="text-sm mt-2">
            Por favor, revisa tu bandeja de entrada y haz clic en el enlace de verificación.
          </p>
        </div>
        <div className="mt-4 flex justify-center">
          <Button 
            color="primary" 
            className="rounded-md"
            onClick={() => navigate('/auth/auth1/login')}
          >
            Ir al Login
          </Button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Después de verificar tu email, podrás iniciar sesión.
        </p>
      </div>
    );
  }

  return (
    <>
      <form className="mt-6" onSubmit={handleSubmit}>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="name" value="Nombre completo" />
          </div>
          <TextInput
            id="name"
            name="name"
            type="text"
            sizing="md"
            className="form-control"
            placeholder="Ingresa tu nombre completo"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="email" value="Email" />
          </div>
          <TextInput
            id="email"
            name="email"
            type="email"
            sizing="md"
            className="form-control"
            placeholder="Ingresa tu email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="password" value="Contraseña" />
          </div>
          <div className="relative">
            <TextInput
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              sizing="md"
              className="form-control pr-10"
              placeholder="Mínimo 6 caracteres"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeSlashIcon />
              ) : (
                <EyeIcon />
              )}
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="confirmPassword" value="Confirmar contraseña" />
          </div>
          <div className="relative">
            <TextInput
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              sizing="md"
              className="form-control pr-10"
              placeholder="Confirma tu contraseña"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeSlashIcon />
              ) : (
                <EyeIcon />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex items-start gap-3 my-5">
          <UiCheckbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
            className="mt-1"
          />
          <Label
            htmlFor="terms"
            className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer leading-relaxed"
          >
            Acepto los{" "}
            <Link to="/terminos-condiciones" className="text-primary hover:underline font-medium">
              términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link to="/politica-privacidad" className="text-primary hover:underline font-medium">
              política de privacidad
            </Link>
          </Label>
        </div>

        <Button 
          type="submit" 
          color="primary" 
          className="rounded-md w-full"
          disabled={loading}
        >
          {loading ? "Registrando..." : "Crear Cuenta"}
        </Button>
      </form>
    </>
  );
};

export default AuthRegister;
