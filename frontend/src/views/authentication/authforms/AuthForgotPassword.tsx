import { Button, Label, TextInput } from "flowbite-react";
import { useState } from "react";
import { useAuth } from "src/context/AuthContext";
import { useNavigate } from "react-router";

const AuthForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await forgotPassword(email);
      
      if (response.success) {
        setSuccess(true);
        setShowResetForm(true);
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError(error.message || "Error al enviar código de recuperación");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validar que las contraseñas coincidan
    if (newPassword !== passwordConfirmation) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    try {
      const response = await resetPassword(email, resetCode, newPassword, passwordConfirmation);
      
      if (response.success) {
        alert("Contraseña restablecida exitosamente. Ahora puedes iniciar sesión.");
        navigate("/auth/auth1/login");
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      setError(error.message || "Error al restablecer contraseña");
    } finally {
      setLoading(false);
    }
  };

  if (showResetForm) {
    return (
      <>
        <form className="mt-6" onSubmit={handleResetPassword}>
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="resetCode" value="Código de Verificación" />
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Hemos enviado un código de verificación a: {email}
            </p>
            <TextInput
              id="resetCode"
              type="text"
              sizing="md"
              className="form-control"
              placeholder="Ingresa el código de 6 dígitos"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              maxLength={6}
              required
            />
          </div>
          
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="newPassword" value="Nueva Contraseña" />
            </div>
            <TextInput
              id="newPassword"
              type="password"
              sizing="md"
              className="form-control"
              placeholder="Ingresa tu nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <div className="mb-2 block">
              <Label htmlFor="passwordConfirmation" value="Confirmar Nueva Contraseña" />
            </div>
            <TextInput
              id="passwordConfirmation"
              type="password"
              sizing="md"
              className="form-control"
              placeholder="Confirma tu nueva contraseña"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <Button 
            type="submit" 
            color="primary" 
            className="rounded-md w-full"
            disabled={loading}
          >
            {loading ? "Restableciendo..." : "Restablecer Contraseña"}
          </Button>
          
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-primary text-sm font-medium hover:underline"
              onClick={() => {
                setShowResetForm(false);
                setResetCode("");
                setNewPassword("");
                setPasswordConfirmation("");
                setError("");
                setSuccess(false);
              }}
            >
              Enviar nuevo código
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <form className="mt-6" onSubmit={handleForgotPassword}>
        <div className="mb-6">
          <div className="mb-2 block">
            <Label htmlFor="email" value="Correo Electrónico" />
          </div>
          <TextInput
            id="email"
            type="email"
            sizing="md"
            className="form-control"
            placeholder="Ingresa tu correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ¡Código enviado! Revisa tu email e ingresa el código para restablecer tu contraseña.
          </div>
        )}
        
        <Button 
          type="submit" 
          color="primary" 
          className="rounded-md w-full"
          disabled={loading}
        >
          {loading ? "Enviando..." : "Enviar Código de Recuperación"}
        </Button>
      </form>
    </>
  );
};

export default AuthForgotPassword;
