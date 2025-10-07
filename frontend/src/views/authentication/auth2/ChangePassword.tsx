import React, { useState, useMemo } from 'react';
import Logo from 'src/layouts/full/shared/logo/Logo';
import LeftSidebarPart from '../LeftSidebarPart';
import { Card, Button, Alert, TextInput, Label } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

const ChangePasswordAuth2 = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const { tenant } = useUnifiedAuth();

  const branding = useMemo(() => {
    const defaults = {
      primary_color: '#635BFF',
      secondary_color: '#16CDC7',
      accent_color: '#36c96c',
      logo_url: undefined as string | undefined,
      name: undefined as string | undefined,
    };
    const b = (tenant as any)?.branding || {};
    return {
      ...defaults,
      ...b,
      logo_url: b.logo_url || (tenant as any)?.logo_url || defaults.logo_url,
      name: (tenant as any)?.name || defaults.name,
    };
  }, [tenant]);

  const backgroundStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(to bottom right, ${branding.primary_color}0D, ${branding.secondary_color}1A)`,
  };

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
        // Reautenticar sesión de empleado: nada que cambiar porque ya tenemos token
        // Solo limpiar flags en localStorage para que el layout no redirija
        try {
          const saved = JSON.parse(localStorage.getItem('empleado_data') || '{}');
          if (saved?.empleado) {
            saved.empleado.first_login = false;
            saved.empleado.requiere_cambio_password = false;
            localStorage.setItem('empleado_data', JSON.stringify(saved));
          }
        } catch (e) {}

        setTimeout(() => {
          navigate('/apps', { replace: true });
        }, 800);
      } else {
        setError(data.message || 'Error al cambiar contraseña');
      }
    } catch (err: any) {
      setError(err?.message || 'Error en la conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden h-screen" style={backgroundStyle}>
      <div className="grid grid-cols-12 gap-3 h-screen bg-white/60 dark:bg-darkgray">
        <div className="xl:col-span-4 lg:col-span-6 col-span-12 sm:px-12 px-4">
          <div className="flex h-screen items-center px-3 lg:justify-start justify-center">
            <div className="max-w-md w-full mx-auto">
              <div className="flex items-center gap-3 mb-2">
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt="logo" className="h-10 w-auto" />
                ) : (
                  <Logo />
                )}
                {branding.name && <span className="text-sm text-gray-600">{branding.name}</span>}
              </div>
              <h3 className="text-2xl font-bold my-3 mt-5">Cambiar Contraseña</h3>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Por seguridad, debes cambiar tu contraseña temporal
              </p>

              <Card className="mt-4 shadow-xl border-0">
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
        </div>
        <div className="xl:col-span-8 lg:col-span-6 col-span-12 bg-[#0A2540] dark:bg-dark lg:block hidden relative overflow-hidden">
          <LeftSidebarPart />
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordAuth2;
