import { Button, Label, TextInput } from "flowbite-react";
import { useNavigate } from "react-router";
import { useState } from "react";
import { useAuth } from "src/context/AuthContext";

const AuthEmailVerificationForm = () => {
  const navigate = useNavigate();
  const { verifyEmail, sendEmailVerification } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('Por favor ingresa el código de verificación');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await verifyEmail(code);
      
      if (response.success) {
        setMessage('¡Email verificado exitosamente! Redirigiendo...');
        setTimeout(() => {
          navigate('/auth/login');
        }, 2000);
      } else {
        setError(response.message || 'Error al verificar el email');
      }
    } catch (err) {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await sendEmailVerification();
      
      if (response.success) {
        setMessage('Código de verificación reenviado a tu email');
      } else {
        setError(response.message || 'Error al reenviar el código');
      }
    } catch (err) {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <>
      <form className="mt-6" onSubmit={handleSubmit}>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="code" value="Código de Verificación" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Hemos enviado un código de verificación de 6 dígitos a tu email. Ingrésalo a continuación:
          </p>
          <TextInput
            id="code"
            type="text"
            sizing="md"
            className="form-control text-center text-xl tracking-widest"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            required
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {message}
          </div>
        )}

        <Button
          type="submit"
          color="primary"
          className="rounded-md w-full mb-3"
          disabled={loading || !code.trim()}
        >
          {loading ? 'Verificando...' : 'Verificar Email'}
        </Button>

        <Button
          type="button"
          color="light"
          className="rounded-md w-full"
          onClick={handleResendCode}
          disabled={resendLoading}
        >
          {resendLoading ? 'Reenviando...' : 'Reenviar Código'}
        </Button>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            ¿No recibiste el código? Revisa tu carpeta de spam o solicita un nuevo código.
          </p>
        </div>
      </form>
    </>
  );
};

export default AuthEmailVerificationForm; 