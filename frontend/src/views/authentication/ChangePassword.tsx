import React, { useState } from 'react';
import { Card, Button, Alert, TextInput, Label } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { API_BASE_URL } from '../../config/api';


const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const empleadoData = JSON.parse(localStorage.getItem('empleado_data') || '{}');
      
      const response = await fetch(`${API_BASE_URL}/empleado-auth/cambiar-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Empleado-Id': empleadoData.empleado?.id,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Contraseña actualizada exitosamente');
        
        // Redirigir al dashboard después de 2 segundos
        setTimeout(() => {
          navigate('/apps', { replace: true });
        }, 2000);
      } else {
        setError(data.message || 'Error al cambiar contraseña');
      }
    } catch (error: any) {
      setError(error.message || 'Error en la conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Icon icon="solar:shield-check-bold-duotone" className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Cambiar Contraseña
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Por seguridad, debes cambiar tu contraseña temporal
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="current_password" value="Contraseña Actual" />
              <TextInput
                id="current_password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Ingresa tu contraseña actual"
              />
            </div>

            <div>
              <Label htmlFor="new_password" value="Nueva Contraseña" />
              <TextInput
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <Label htmlFor="confirm_password" value="Confirmar Nueva Contraseña" />
              <TextInput
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repite la nueva contraseña"
              />
            </div>

            {error && (
              <Alert color="failure">
                <Icon icon="solar:danger-bold-duotone" className="mr-2" />
                {error}
              </Alert>
            )}

            {success && (
              <Alert color="success">
                <Icon icon="solar:check-circle-bold-duotone" className="mr-2" />
                {success}
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ChangePassword; 