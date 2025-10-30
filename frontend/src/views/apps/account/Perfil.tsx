import React, { useRef, useState } from 'react';
import { Card, Badge, Button } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useAuthenticatedAdminRequest } from 'src/hooks/useAdminCrudApi';
import api from 'src/config/api';
import { API_CONFIG } from 'src/config/constants';

const Perfil: React.FC = () => {
  const {
    user,
    usuarioSaas,
    empleado,
    isEmpleado,
    tenant,
    isAuthenticated,
    isEmailVerified,
    trialExpired,
    trialEndsAt,
  } = useUnifiedAuth();

  const navigate = useNavigate();
  const { makeRequest } = useAuthenticatedAdminRequest();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-lg text-center">
          <Icon icon="solar:lock-keyhole-bold-duotone" className="mx-auto mb-3 text-gray-400" height={40} />
          <h3 className="text-lg font-semibold mb-2">No has iniciado sesión</h3>
          <p className="text-gray-500 mb-4">
            Inicia sesión para ver y gestionar tu perfil.
          </p>
          <div className="flex gap-2 justify-center">
            <Button color="primary" onClick={() => navigate('/auth/auth1/login')}>Iniciar sesión</Button>
            <Button color="light" onClick={() => navigate('/')}>Ir al inicio</Button>
          </div>
        </Card>
      </div>
    );
  }

  const getEmpleadoNombre = () => {
    if (!empleado) return '';
    return `${empleado.nombres || ''} ${empleado.apellidos || ''}`.trim();
  };

  const displayName = isEmpleado
    ? getEmpleadoNombre()
    : (usuarioSaas?.nombre
        ? `${usuarioSaas.nombre} ${usuarioSaas.apellidos || ''}`.trim()
        : (user?.displayName || (user?.email ? user.email.split('@')[0] : 'Usuario')));

  const email = isEmpleado ? empleado?.email || '' : (usuarioSaas?.email || user?.email || '');
  const rawAvatar = isEmpleado ? (empleado?.avatar || '') : (usuarioSaas?.avatar || user?.photoURL || '');
  const avatar = avatarUrlOverride || rawAvatar;
  const rol = isEmpleado ? (empleado?.rol?.nombre || 'Empleado') : (usuarioSaas?.rol || 'Administrador');

  const initials = (name: string) => {
    try {
      const parts = (name || '').trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return `${(parts[0][0] || '').toUpperCase()}${(parts[parts.length - 1][0] || '').toUpperCase()}`;
    } catch {
      return 'U';
    }
  };

  const formatDate = (s?: string | null) => {
    if (!s) return '-';
    try {
      return new Date(s).toLocaleString('es-CO');
    } catch {
      return String(s);
    }
  };

  // Abrir selector de archivos
  const openFilePicker = () => fileInputRef.current?.click();

  // Manejar cambio de avatar (empleado Laravel y usuario SaaS/Firebase)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB.');
      return;
    }

    try {
      setUploadingAvatar(true);

      if (isEmpleado && empleado?.id) {
        // Empleado (Laravel): actualizar con FormData (campo foto_perfil)
        const formData = new FormData();
        formData.append('foto_perfil', file);

        const resp = await makeRequest(`/saas/empleados/${empleado.id}`, {
          method: 'PUT',
          body: formData,
        });

        if ((resp as any)?.success === false) {
          throw new Error((resp as any)?.message || 'No se pudo actualizar la foto de perfil.');
        }

        // Refrescar contexto de empleado para reflejar avatar en topbar
        try {
          const ctx = await makeRequest('/empleado-auth/contexto', { method: 'GET' });
          if (ctx?.success && ctx?.data) {
            const nuevo = {
              empleado: ctx.data.empleado,
              broker: ctx.data.broker,
              permisos: ctx.data.permisos,
            };
            localStorage.setItem('empleado_data', JSON.stringify(nuevo));
            setAvatarUrlOverride(URL.createObjectURL(file));
          } else {
            setAvatarUrlOverride(URL.createObjectURL(file));
          }
        } catch {
          setAvatarUrlOverride(URL.createObjectURL(file));
        }
      } else {
        // Usuario SaaS (Firebase): actualizar vía /auth/profile
        const toBase64 = (f: File) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(f);
          });

        const dataUrl = await toBase64(file);

        try {
          await api.put(API_CONFIG.ENDPOINTS.AUTH.PROFILE, { avatar_base64: dataUrl });
          setAvatarUrlOverride(URL.createObjectURL(file));
        } catch {
          await api.put(API_CONFIG.ENDPOINTS.AUTH.PROFILE, { avatar: dataUrl }).catch(() => {
            throw new Error('No se pudo actualizar la foto de perfil.');
          });
          setAvatarUrlOverride(URL.createObjectURL(file));
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Error actualizando la foto de perfil');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">Mi Perfil</h2>
          <p className="text-sm text-gray-500">Información de tu cuenta y organización</p>
        </div>
        <div className="flex gap-2">
          {isEmpleado && empleado?.id ? (
            <Button color="light" onClick={() => navigate(`/apps/saas/empleados/${empleado.id}/editar`)}>
              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 mr-2" />
              Editar mis datos
            </Button>
          ) : (
            <Button color="light" onClick={() => navigate('/apps/admin/informacion-agencia')}>
              <Icon icon="solar:settings-bold-duotone" className="w-4 h-4 mr-2" />
              Configuración
            </Button>
          )}
        </div>
      </div>

      {/* Perfil principal */}
      <Card>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-primary text-white flex items-center justify-center text-xl font-semibold">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span>{initials(displayName)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={openFilePicker}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-gray-50"
                title="Cambiar foto"
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <span className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                ) : (
                  <Icon icon="solar:camera-bold" className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{displayName}</h3>
                <Badge color="lightprimary" className="capitalize">{rol?.toString().replace(/_/g, ' ')}</Badge>
                {!isEmpleado && (
                  isEmailVerified ? (
                    <Badge color="lightsuccess" className="flex items-center gap-1">
                      <Icon icon="solar:check-circle-bold" className="w-3 h-3" /> Email verificado
                    </Badge>
                  ) : (
                    <Badge color="lightwarning">Email no verificado</Badge>
                  )
                )}
              </div>
              <div className="text-sm text-gray-600">{email}</div>
              {isEmpleado && empleado?.cargo && (
                <div className="text-xs text-gray-500">Cargo: {empleado.cargo}</div>
              )}
            </div>
          </div>

          <div className="md:ml-auto grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500">Tipo de Cuenta</div>
              <div className="text-sm font-medium">{isEmpleado ? 'Empleado' : 'Usuario SaaS'}</div>
            </div>
            <div className="p-3 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500">Broker</div>
              <div className="text-sm font-medium">{tenant?.nombre || '-'}</div>
            </div>
            <div className="p-3 rounded-md border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500">Estado Trial</div>
              <div className="text-sm font-medium">
                {trialExpired ? (
                  <span className="text-red-600">Expirado</span>
                ) : (tenant?.status === 'trial' ? 'Activo' : (tenant?.status || '-'))}
              </div>
            </div>
            {tenant?.status === 'trial' && (
              <div className="p-3 rounded-md border border-gray-200 dark:border-gray-700 col-span-2">
                <div className="text-xs text-gray-500">Fin del Trial</div>
                <div className="text-sm font-medium">{formatDate(trialEndsAt || undefined)}</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-blue-50 text-blue-600">
              <Icon icon="solar:shield-keyhole-bold-duotone" className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Seguridad</h4>
              <p className="text-sm text-gray-500 mb-3">Configura 2FA y métodos de seguridad</p>
              <Button color="light" size="sm" onClick={() => navigate('/apps/admin/2fa')}>
                Administrar seguridad
              </Button>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-purple-50 text-purple-600">
              <Icon icon="solar:settings-bold-duotone" className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Agencia</h4>
              <p className="text-sm text-gray-500 mb-3">Actualiza la información de tu agencia</p>
              <Button color="light" size="sm" onClick={() => navigate('/apps/admin/informacion-agencia')}>
                Ir a configuración
              </Button>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-emerald-50 text-emerald-600">
              <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Equipo</h4>
              <p className="text-sm text-gray-500 mb-3">Gestiona usuarios y permisos</p>
              <div className="flex gap-2">
                <Button color="light" size="sm" onClick={() => navigate('/apps/admin/usuarios')}>Usuarios</Button>
                <Button color="light" size="sm" onClick={() => navigate('/apps/admin/roles')}>Roles</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Perfil;