import React, { useRef, useState } from 'react';
import { Badge } from 'flowbite-react';
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
  const [activeTab, setActiveTab] = useState<'perfil' | 'seguridad' | 'notificaciones'>('perfil');

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md mx-4 p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
            <Icon icon="solar:lock-keyhole-bold-duotone" className="text-blue-600 dark:text-blue-400" height={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No has iniciado sesión</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Inicia sesión para ver y gestionar tu perfil.
          </p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => navigate('/auth/auth1/login')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition"
            >
              Iniciar sesión
            </button>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition"
            >
              Ir al inicio
            </button>
          </div>
        </div>
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
  const telefono = isEmpleado ? (empleado as any)?.telefono : (usuarioSaas as any)?.telefono;

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
      return new Date(s).toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return String(s);
    }
  };

  const getDaysRemaining = (endDate?: string | null) => {
    if (!endDate) return null;
    try {
      const end = new Date(endDate);
      const now = new Date();
      const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
    } catch {
      return null;
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

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
        const formData = new FormData();
        formData.append('foto_perfil', file);

        const resp = await makeRequest(`/saas/empleados/${empleado.id}`, {
          method: 'PUT',
          body: formData,
        });

        if ((resp as any)?.success === false) {
          throw new Error((resp as any)?.message || 'No se pudo actualizar la foto de perfil.');
        }

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

  const daysRemaining = getDaysRemaining(trialEndsAt);

  const quickActions = [
    {
      icon: 'solar:buildings-3-bold-duotone',
      title: 'Información de Agencia',
      description: 'Actualiza los datos de tu empresa',
      color: 'bg-blue-500',
      lightColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-600 dark:text-blue-400',
      onClick: () => navigate('/apps/admin/informacion-agencia'),
    },
    {
      icon: 'solar:users-group-rounded-bold-duotone',
      title: 'Gestión de Usuarios',
      description: 'Administra tu equipo',
      color: 'bg-emerald-500',
      lightColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      onClick: () => navigate('/apps/admin/usuarios'),
    },
    {
      icon: 'solar:shield-keyhole-bold-duotone',
      title: 'Roles y Permisos',
      description: 'Configura accesos del equipo',
      color: 'bg-purple-500',
      lightColor: 'bg-purple-50 dark:bg-purple-900/20',
      textColor: 'text-purple-600 dark:text-purple-400',
      onClick: () => navigate('/apps/admin/roles'),
    },
    {
      icon: 'solar:bill-list-bold-duotone',
      title: 'Facturación',
      description: 'Revisa tus facturas',
      color: 'bg-amber-500',
      lightColor: 'bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-600 dark:text-amber-400',
      onClick: () => navigate('/apps/billing/facturas'),
    },
    {
      icon: 'solar:crown-bold-duotone',
      title: 'Suscripción',
      description: 'Gestiona tu plan',
      color: 'bg-pink-500',
      lightColor: 'bg-pink-50 dark:bg-pink-900/20',
      textColor: 'text-pink-600 dark:text-pink-400',
      onClick: () => navigate('/apps/billing/suscripcion'),
    },
    {
      icon: 'solar:question-circle-bold-duotone',
      title: 'Ayuda y Soporte',
      description: 'Preguntas frecuentes',
      color: 'bg-cyan-500',
      lightColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      textColor: 'text-cyan-600 dark:text-cyan-400',
      onClick: () => navigate('/apps/ayuda/faq'),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header con gradiente */}
      <div className="relative mb-8">
        <div className="h-40 md:h-48 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        
        {/* Avatar y nombre */}
        <div className="absolute -bottom-12 left-6 md:left-10 flex items-end gap-4 md:gap-6">
          <div className="relative">
            <div className="h-28 w-28 md:h-32 md:w-32 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-800 shadow-xl flex items-center justify-center">
              {avatar ? (
                <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl md:text-4xl font-bold">
                  {initials(displayName)}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={openFilePicker}
              className="absolute -bottom-2 -right-2 h-10 w-10 rounded-xl bg-white dark:bg-gray-700 border-2 border-white dark:border-gray-800 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-all hover:scale-105"
              title="Cambiar foto"
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <span className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              ) : (
                <Icon icon="solar:camera-bold" className="w-5 h-5 text-gray-600 dark:text-gray-300" />
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
          
          <div className="pb-2 hidden md:block">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">{displayName}</h1>
            <p className="text-white/80 text-sm">{email}</p>
          </div>
        </div>

        {/* Botón editar */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => isEmpleado && empleado?.id 
              ? navigate(`/apps/saas/empleados/${empleado.id}/editar`)
              : navigate('/apps/admin/informacion-agencia')
            }
            className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-medium transition flex items-center gap-2"
          >
            <Icon icon="solar:pen-bold" className="w-4 h-4" />
            <span className="hidden sm:inline">Editar perfil</span>
          </button>
        </div>
      </div>

      {/* Info móvil */}
      <div className="md:hidden mb-6 mt-16 px-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{email}</p>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-16">
        {/* Columna izquierda - Info del perfil */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card de información */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon icon="solar:user-circle-bold-duotone" className="w-5 h-5 text-blue-500" />
                Información Personal
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <Icon icon="solar:user-bold" className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nombre completo</p>
                  <p className="font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Icon icon="solar:letter-bold" className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Correo electrónico</p>
                  <p className="font-medium text-gray-900 dark:text-white truncate">{email}</p>
                </div>
                {!isEmpleado && (
                  isEmailVerified ? (
                    <Badge color="success" className="shrink-0">
                      <Icon icon="solar:check-circle-bold" className="w-3 h-3 mr-1" />
                      Verificado
                    </Badge>
                  ) : (
                    <Badge color="warning" className="shrink-0">No verificado</Badge>
                  )
                )}
              </div>

              {telefono && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                    <Icon icon="solar:phone-bold" className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Teléfono</p>
                    <p className="font-medium text-gray-900 dark:text-white">{telefono}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <Icon icon="solar:shield-user-bold" className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Rol</p>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{rol?.toString().replace(/_/g, ' ')}</p>
                </div>
              </div>

              {isEmpleado && empleado?.cargo && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center">
                    <Icon icon="solar:case-bold" className="w-5 h-5 text-pink-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cargo</p>
                    <p className="font-medium text-gray-900 dark:text-white">{empleado.cargo}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card de organización */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon icon="solar:buildings-3-bold-duotone" className="w-5 h-5 text-purple-500" />
                Organización
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <Icon icon="solar:buildings-bold" className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Agencia</p>
                  <p className="font-medium text-gray-900 dark:text-white truncate">{tenant?.nombre || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center">
                  <Icon icon="solar:user-id-bold" className="w-5 h-5 text-cyan-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tipo de cuenta</p>
                  <p className="font-medium text-gray-900 dark:text-white">{isEmpleado ? 'Empleado' : 'Administrador'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card de suscripción */}
          {tenant?.status === 'trial' && (
            <div className={`rounded-2xl border overflow-hidden ${
              trialExpired 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      trialExpired ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                    }`}>
                      <Icon 
                        icon={trialExpired ? "solar:danger-triangle-bold" : "solar:crown-bold"} 
                        className={`w-6 h-6 ${trialExpired ? 'text-red-500' : 'text-amber-500'}`} 
                      />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${trialExpired ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {trialExpired ? 'Trial Expirado' : 'Período de Prueba'}
                      </h4>
                      <p className={`text-sm ${trialExpired ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'}`}>
                        {trialExpired 
                          ? 'Tu período de prueba ha terminado' 
                          : `${daysRemaining} días restantes`
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                {!trialExpired && daysRemaining !== null && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 mb-1">
                      <span>Progreso del trial</span>
                      <span>{Math.max(0, 7 - daysRemaining)} de 7 días</span>
                    </div>
                    <div className="h-2 bg-amber-200 dark:bg-amber-900/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((7 - daysRemaining) / 7) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Finaliza: {formatDate(trialEndsAt)}
                </p>

                <button
                  onClick={() => navigate('/apps/billing/suscripcion')}
                  className={`w-full py-2.5 rounded-xl font-medium transition ${
                    trialExpired 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                  }`}
                >
                  {trialExpired ? 'Activar suscripción' : 'Ver planes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha - Acciones rápidas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex border-b border-gray-100 dark:border-gray-700">
              {[
                { id: 'perfil', label: 'Acciones Rápidas', icon: 'solar:widget-5-bold-duotone' },
                { id: 'seguridad', label: 'Seguridad', icon: 'solar:shield-keyhole-bold-duotone' },
                { id: 'notificaciones', label: 'Actividad', icon: 'solar:bell-bold-duotone' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 px-4 py-4 text-sm font-medium transition flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon icon={tab.icon} className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'perfil' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.onClick}
                      className="group p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-md transition-all text-left flex items-start gap-4"
                    >
                      <div className={`w-12 h-12 rounded-xl ${action.lightColor} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                        <Icon icon={action.icon} className={`w-6 h-6 ${action.textColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {action.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {action.description}
                        </p>
                      </div>
                      <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'seguridad' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                        <Icon icon="solar:lock-password-bold-duotone" className="w-6 h-6 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">Contraseña</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Última actualización: hace 30 días</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                      Cambiar
                    </button>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                        <Icon icon="solar:shield-check-bold-duotone" className="w-6 h-6 text-purple-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">Autenticación de dos factores</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Añade una capa extra de seguridad</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/apps/admin/2fa')}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-lg transition"
                    >
                      Configurar
                    </button>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <Icon icon="solar:devices-bold-duotone" className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">Sesiones activas</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">1 dispositivo conectado</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                      Ver todas
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'notificaciones' && (
                <div className="space-y-4">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <Icon icon="solar:bell-off-bold-duotone" className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Sin actividad reciente</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Aquí aparecerá tu actividad reciente en la plataforma
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Soporte */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon icon="solar:headphones-round-bold-duotone" className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">¿Necesitas ayuda?</h3>
                  <p className="text-white/80 text-sm">Nuestro equipo está listo para asistirte</p>
                </div>
              </div>
              <a
                href="https://wa.me/573001009305?text=Hola,%20necesito%20ayuda%20con%20Guro"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition flex items-center gap-2 shrink-0"
              >
                <Icon icon="logos:whatsapp-icon" className="w-5 h-5" />
                Contactar soporte
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Perfil;