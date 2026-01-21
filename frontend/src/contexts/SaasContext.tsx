import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SaasContext as ISaasContext, BrokerTenant, UsuarioSaaS } from '../types/saas';

// Configuración de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

interface SaasContextType extends ISaasContext {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
  updateUsuario: (usuario: Partial<UsuarioSaaS>) => void;
  updateTenant: (tenant: Partial<BrokerTenant>) => void;
  hasPermission: (module: string, action: string) => boolean;
  canAccessModule: (module: string) => boolean;
  isRole: (role: string) => boolean;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  getTenantBranding: () => BrokerTenant['branding'] | null;
}

const SaasContext = createContext<SaasContextType | undefined>(undefined);

export const useSaas = () => {
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useSaas debe ser usado dentro de un SaasProvider');
  }
  return context;
};

interface SaasProviderProps {
  children: ReactNode;
}

export const SaasProvider: React.FC<SaasProviderProps> = ({ children }) => {
  const [tenant, setTenant] = useState<BrokerTenant | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSaaS | null>(null);
  const [permisos, setPermisos] = useState<UsuarioSaaS['permisos'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inicializar contexto al cargar la aplicación
  useEffect(() => {
    initializeSaasContext();
  }, []);

  const initializeSaasContext = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Verificar si hay una sesión activa
      const token = localStorage.getItem('saas_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Obtener información del usuario y tenant
      const response = await fetch(`${API_BASE_URL}/saas/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Si es 403 y necesita onboarding, mostrar error (ya no redirigimos)
        if (response.status === 403) {
          const errorData = await response.json();
          if (errorData.needs_onboarding) {
            setError('Problemas de conexión con la base de datos. Recarga la página o intenta nuevamente en unos minutos.');
            return;
          }
        }
        throw new Error('Sesión inválida');
      }

      const data = await response.json();

      if (data.success) {
        setUsuario(data.data.user);
        setTenant(data.data.broker);
        setPermisos(data.data.user.permisos);

        // Aplicar branding del tenant
        applyTenantBranding(data.data.broker.branding);
      } else {
        throw new Error(data.message || 'Error al cargar datos del usuario');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Solo limpiar sesión si NO es un error de onboarding
      if (!(err instanceof Error && err.message.includes('broker'))) {
        localStorage.removeItem('saas_token');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/saas/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al iniciar sesión');
      }

      if (data.success) {
        // Guardar token
        localStorage.setItem('saas_token', data.data.token);

        // Establecer contexto
        setUsuario(data.data.user);
        setTenant(data.data.broker);
        setPermisos(data.data.user.permisos);

        // Aplicar branding
        applyTenantBranding(data.data.broker.branding);
      } else {
        throw new Error(data.message || 'Credenciales inválidas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('saas_token');
    setUsuario(null);
    setTenant(null);
    setPermisos(null);
    setError(null);

    // Remover branding personalizado
    removeTenantBranding();
  };

  const switchTenant = async (tenantId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('saas_token');
      const response = await fetch(`${API_BASE_URL}/saas/switch-tenant/${tenantId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al cambiar de tenant');
      }

      if (data.success) {
        setTenant(data.data.broker);
        setUsuario(data.data.user);
        setPermisos(data.data.user.permisos);

        // Aplicar nuevo branding
        applyTenantBranding(data.data.broker.branding);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUsuario = (usuarioUpdate: Partial<UsuarioSaaS>) => {
    if (usuario) {
      const updatedUsuario = { ...usuario, ...usuarioUpdate };
      setUsuario(updatedUsuario);

      if (usuarioUpdate.permisos) {
        setPermisos(usuarioUpdate.permisos);
      }
    }
  };

  const updateTenant = (tenantUpdate: Partial<BrokerTenant>) => {
    if (tenant) {
      const updatedTenant = { ...tenant, ...tenantUpdate };
      setTenant(updatedTenant);

      if (tenantUpdate.branding) {
        applyTenantBranding(tenantUpdate.branding);
      }
    }
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!permisos) return false;

    const modulePerms = permisos[module as keyof typeof permisos];
    if (!modulePerms) return false;

    return modulePerms[action as keyof typeof modulePerms] === true;
  };

  const canAccessModule = (module: string): boolean => {
    if (!permisos) return false;

    const modulePerms = permisos[module as keyof typeof permisos];
    if (!modulePerms) return false;

    // Si tiene al menos un permiso en el módulo, puede acceder
    return Object.values(modulePerms).some((permission) => permission === true);
  };

  const isRole = (role: string): boolean => {
    return usuario?.rol === role;
  };

  const isSuperAdmin = (): boolean => {
    return usuario?.rol === 'super_admin';
  };

  const isAdmin = (): boolean => {
    return usuario?.rol === 'admin' || isSuperAdmin();
  };

  const getTenantBranding = (): BrokerTenant['branding'] | null => {
    return tenant?.branding || null;
  };

  const applyTenantBranding = (branding: BrokerTenant['branding']) => {
    if (!branding) return;

    const root = document.documentElement;

    // Aplicar colores personalizados
    root.style.setProperty('--color-primary', branding.colores.primario);
    root.style.setProperty('--color-secondary', branding.colores.secundario);
    root.style.setProperty('--color-accent', branding.colores.acento);

    // Cambiar favicon si existe
    if (branding.favicon) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = branding.favicon;
      }
    }

    // Cambiar título de la página
    if (branding.nombre_comercial) {
      document.title = `${branding.nombre_comercial} - GURO`;
    }
  };

  const removeTenantBranding = () => {
    const root = document.documentElement;
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-secondary');
    root.style.removeProperty('--color-accent');

    // Restaurar favicon por defecto
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.href = '/favicon.ico';
    }

    // Restaurar título por defecto
    document.title = 'GURO - Plataforma de Seguros';
  };

  const value: SaasContextType = {
    tenant,
    usuario,
    permisos,
    isLoading,
    error,
    login,
    logout,
    switchTenant,
    updateUsuario,
    updateTenant,
    hasPermission,
    canAccessModule,
    isRole,
    isSuperAdmin,
    isAdmin,
    getTenantBranding,
  };

  return <SaasContext.Provider value={value}>{children}</SaasContext.Provider>;
};
