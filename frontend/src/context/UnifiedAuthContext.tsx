import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { User } from 'firebase/auth';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { BrokerTenant, UsuarioSaaS } from '../types/saas';
import api, { API_BASE_URL } from '../config/api';
import { API_CONFIG } from '../config/constants';
// import { auth } from '../config/firebase';

// Tipos para empleados
interface EmpleadoData {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  usuario: string;
  cargo?: string;
  estado: string;
  broker_id: number;
  avatar?: string;
  rol?: {
    id: number;
    nombre: string;
    permisos: string[];
  };
}

interface UnifiedAuthContextType {
  // Firebase Auth
  user: User | null;
  loading: boolean;
  error: string | null;

  // Employee Auth
  empleado: EmpleadoData | null;
  empleadoToken: string | null;
  isEmpleado: boolean;

  // SaaS Data
  tenant: BrokerTenant | null;
  usuarioSaas: UsuarioSaaS | null;
  permisos: UsuarioSaaS['permisos'] | null;
  needsOnboarding: boolean;
  onboardingStep: string | null;
  // Estado de trial
  trialExpired: boolean;
  trialEndsAt: string | null;

  // Métodos de autenticación (Firebase)
  loginWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message: string; user?: User }>;
  registerWithEmail: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ success: boolean; message: string; user?: User }>;
  loginWithGoogle: () => Promise<{ success: boolean; message: string; user?: User }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  // Login empleado (session setter)
  setEmpleadoSession: (payload: {
    token: string;
    empleado: any;
    broker?: any;
    permisos?: string[];
  }) => void;

  // Update tenant data dynamically
  updateTenant: (newTenantData: Partial<BrokerTenant>) => void;

  // Métodos SaaS
  createBroker: (brokerData: any) => Promise<{ success: boolean; message: string }>;
  checkSaasStatus: () => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
  canAccessModule: (module: string) => boolean;
  isModuleInPlan: (module: string) => boolean;
  isRole: (role: string) => boolean;

  // Utilidades
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  hasCompleteSaasAccess: boolean;
  saasChecked: boolean;
}

export const UnifiedAuthContext = createContext<UnifiedAuthContextType | undefined>(undefined);

export const useUnifiedAuth = (): UnifiedAuthContextType => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useUnifiedAuth debe ser usado dentro de un UnifiedAuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const UnifiedAuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Firebase Auth State
  const {
    user,
    loading: firebaseLoading,
    error: firebaseError,
    loginWithEmail: firebaseLoginWithEmail,
    registerWithEmail: firebaseRegisterWithEmail,
    loginWithGoogle: firebaseLoginWithGoogle,
    logout: firebaseLogout,
    resetPassword: firebaseResetPassword,
  } = useFirebaseAuth();

  // Employee Auth State (inicializar desde localStorage para evitar pantallas intermedias)
  const [empleado, setEmpleado] = useState<EmpleadoData | null>(() => {
    try {
      const saved = localStorage.getItem('empleado_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.empleado || null;
      }
    } catch { }
    return null;
  });
  const [empleadoToken, setEmpleadoToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('empleado_token');
    } catch {
      return null;
    }
  });
  const [empleadoLoading, setEmpleadoLoading] = useState(false);

  // SaaS State (cargar broker/permisos del empleado si existen)
  const [tenant, setTenant] = useState<BrokerTenant | null>(() => {
    try {
      const saved = localStorage.getItem('empleado_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.broker || null;
      }
    } catch { }
    return null;
  });
  const [usuarioSaas, setUsuarioSaas] = useState<UsuarioSaaS | null>(null);
  const [permisos, setPermisos] = useState<UsuarioSaaS['permisos'] | null>(() => {
    try {
      const saved = localStorage.getItem('empleado_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.permisos || null;
      }
    } catch { }
    return null;
  });
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<string | null>(null);
  const [saasLoading, setSaasLoading] = useState(false);
  const [saasError, setSaasError] = useState<string | null>(null);
  const [saasChecked, setSaasChecked] = useState(() => {
    // Si hay sesión de empleado persistida o token, considerar SaaS chequeado para no bloquear UI
    try {
      const hasEmpleadoData = !!localStorage.getItem('empleado_data');
      const hasEmpleadoToken = !!localStorage.getItem('empleado_token');
      return hasEmpleadoData || hasEmpleadoToken ? true : false;
    } catch {
      return false;
    }
  });
  // Trial state
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  // Combined loading and error state
  const loading = firebaseLoading || saasLoading || empleadoLoading;
  const error = firebaseError || saasError;

  // Derived states
  // Considerar empleado autenticado solo si existe token válido
  const isEmpleado = !!empleadoToken;
  const isAuthenticated = !!user || isEmpleado;
  const isEmailVerified = isEmpleado ? true : user?.emailVerified ?? false; // Solo empleados no necesitan verificación
  const hasCompleteSaasAccess =
    isAuthenticated &&
    !!tenant &&
    (!!usuarioSaas || !!empleado) &&
    !needsOnboarding &&
    !trialExpired;

  // Verificar/restaurar sesión de empleado al cargar y cuando Firebase user cambie
  useEffect(() => {
    checkEmpleadoSession();
  }, [user]);

  // Refrescar contexto del empleado desde backend (rol/permisos actualizados sin reloguear)
  // const refreshEmpleadoContext = useCallback(async () => {
  //   try {
  //     if (!isEmpleado || !user) return;
  //     await user.getIdToken();
  //   } catch {}
  // }, [isEmpleado, user]);

  // Implementación real del refresco (separada para evitar tree-shaking)
  const doRefreshEmpleadoContext = useCallback(async () => {
    try {
      if (!isEmpleado || !user) return;
      const token = await user.getIdToken();
      // Primero preguntar por la versión y usar ETag para evitar payload si no cambió
      const versionResp = await fetch(`${API_BASE_URL}/empleado-auth/version`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      let etag = versionResp.headers.get('ETag') || undefined;
      // Si tenemos versión previa en memoria y no cambió, salir
      const currentVersion = (permisos as any)?.__version as string | undefined;
      const newVersion = versionResp.ok ? (await versionResp.json())?.version : undefined;
      if (currentVersion && newVersion && currentVersion === newVersion) {
        return;
      }
      const endpoint = `${API_BASE_URL}/empleado-auth/contexto`;
      const resp = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(etag ? { 'If-None-Match': etag } : {}),
        },
      });
      if (resp.ok) {
        const ctx = await resp.json();
        if (ctx?.success && ctx?.data) {
          const nuevo = {
            empleado: ctx.data.empleado,
            broker: ctx.data.broker,
            permisos: ctx.data.permisos,
          };
          localStorage.setItem('empleado_data', JSON.stringify(nuevo));
          setEmpleado(nuevo.empleado);
          setTenant(nuevo.broker);
          // adjuntar versión en memoria para comparaciones futuras
          (nuevo.permisos as any).__version = ctx.data.version;
          setPermisos(nuevo.permisos as any);
        }
      }
    } catch { }
  }, [isEmpleado, user]);

  // Auto-refresh: al recuperar foco de la ventana; quito intervalo para escala
  useEffect(() => {
    if (!isEmpleado) return;
    const onFocus = () => {
      doRefreshEmpleadoContext();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [isEmpleado, doRefreshEmpleadoContext]);

  // Check SaaS status when user authenticates
  useEffect(() => {
    if (user && !firebaseLoading) {
      // Empleados no requieren verificación de email; no limpiar su estado SaaS.
      // Verificar TANTO el state como localStorage para evitar race condition:
      // cuando Firebase onAuthStateChanged se dispara durante el primer login de empleado,
      // isEmpleado puede ser false porque setEmpleadoSession aún no se ha llamado.
      const hasEmpleadoInStorage = typeof window !== 'undefined' && (
        !!localStorage.getItem('empleado_token') || !!localStorage.getItem('empleado_data')
      );
      if (isEmpleado || hasEmpleadoInStorage) {
        // No hacemos checkSaasStatus para empleados; usan broker/permisos del login
        return;
      }
      // Usuarios Firebase requieren email verificado para cargar SaaS
      if (user.emailVerified) {
        checkSaasStatus();
      } else {
        // Limpiar datos SaaS si el email no está verificado
        setTenant(null);
        setUsuarioSaas(null);
        setPermisos(null);
        setNeedsOnboarding(false);
        setOnboardingStep(null);
        setTrialExpired(false);
        setTrialEndsAt(null);
        setSaasChecked(false);
      }
    } else if (!user && !isEmpleado) {
      // Clear SaaS data when user logs out
      setTenant(null);
      setUsuarioSaas(null);
      setPermisos(null);
      setNeedsOnboarding(false);
      setOnboardingStep(null);
      setTrialExpired(false);
      setTrialEndsAt(null);
      setSaasChecked(false);
    }
  }, [user, firebaseLoading, isEmpleado]);

  // Validación adicional para detectar usuarios sin broker_id
  useEffect(() => {
    const checkBrokerId = async () => {
      if (user && user.emailVerified && !isEmpleado && !saasLoading) {
        try {
          const token = await getFirebaseToken();
          if (!token) return;

          // Hacer una verificación directa del dashboard para obtener broker_id
          // Usar axios para conservar el mismo origen/headers
          const respDash = await api.get('/dashboard', {
            headers: {
              // redundante pero explícito
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            validateStatus: () => true,
          });
          const response = new Response(JSON.stringify(respDash.data), { status: respDash.status });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.needs_onboarding) {
              // Ya NO activamos onboarding - mostramos error de conexión
              setNeedsOnboarding(false);
              setOnboardingStep(null);
              setSaasError('Problemas de conexión con la base de datos');
            }
          }
        } catch (error) { }
      }
    };

    // Ejecutar verificación después de un pequeño delay para evitar conflictos
    const timeoutId = setTimeout(checkBrokerId, 1000);
    return () => clearTimeout(timeoutId);
  }, [user, isEmpleado, saasLoading]);

  // Aplicar branding del tenant (definido antes de checkEmpleadoSession para poder usarlo)
  const applyTenantBranding = (branding: any) => {
    try {
      // Soportar diferentes estructuras de branding
      const primaryColor = branding?.primary_color || branding?.colores?.primario;
      const secondaryColor = branding?.secondary_color || branding?.colores?.secundario;
      const accentColor = branding?.accent_color || branding?.colores?.acento;
      
      if (primaryColor) {
        // Aplicar con prioridad alta usando setProperty con priority
        document.documentElement.style.setProperty('--color-primary', primaryColor, 'important');
        document.documentElement.style.setProperty('--color-primary-emphasis', primaryColor, 'important');
        // Calcular versión clara del color para lightprimary
        document.documentElement.style.setProperty('--color-lightprimary', `${primaryColor}40`, 'important');
        // También aplicar a variables de Tailwind/Flowbite si existen
        document.documentElement.style.setProperty('--primary', primaryColor);
        console.log('🎨 Color primario aplicado:', primaryColor);
      }
      if (secondaryColor) {
        document.documentElement.style.setProperty('--color-secondary', secondaryColor, 'important');
      }
      if (accentColor) {
        document.documentElement.style.setProperty('--color-accent', accentColor, 'important');
      }
    } catch (error) {
      console.warn('Error aplicando branding:', error);
    }
  };

  // Verificar sesión de empleado guardada
  const checkEmpleadoSession = async () => {
    console.debug('[UnifiedAuthContext] checkEmpleadoSession() init');
    setEmpleadoLoading(true);
    try {
      const savedData = localStorage.getItem('empleado_data');
      const savedToken = localStorage.getItem('empleado_token');
      console.debug('[UnifiedAuthContext] checkEmpleadoSession() localStorage', {
        hasEmpleadoData: !!savedData,
        hasEmpleadoToken: !!savedToken,
      });

      // Restaurar siempre desde localStorage si existe (UI state), sin bloquear por Firebase
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setEmpleado(parsed.empleado || null);
        if (parsed.broker) {
          setTenant(parsed.broker);
          // Aplicar branding inmediatamente al restaurar
          if (parsed.broker.branding) {
            applyTenantBranding(parsed.broker.branding);
          }
        }
        if (parsed.permisos) setPermisos(parsed.permisos);
        if (savedToken) setEmpleadoToken(savedToken);
        setNeedsOnboarding(false);
        setSaasChecked(true);
        console.debug('[UnifiedAuthContext] checkEmpleadoSession() restored from localStorage', {
          empleadoId: parsed?.empleado?.id,
          hasBroker: !!parsed?.broker,
          logo_url: parsed?.broker?.logo_url,
          branding_logo: parsed?.broker?.branding?.logo,
          primary_color: parsed?.broker?.branding?.primary_color,
          permisosCount: Array.isArray(parsed?.permisos) ? parsed.permisos.length : 0,
        });

        // Intentar refrescar token si existe
        if (savedToken && savedToken !== 'FIREBASE') {
          try {
            console.debug(
              '[UnifiedAuthContext] checkEmpleadoSession() validating empleado token...',
            );
            const response = await fetch(`${API_BASE_URL}/empleado-auth/validar-token`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${savedToken}`,
                'Content-Type': 'application/json',
              },
            });
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.token && data.token !== savedToken) {
                // Token refrescado, actualizar
                localStorage.setItem('empleado_token', data.token);
                setEmpleadoToken(data.token);
                console.log('🔄 Token de empleado refrescado automáticamente');
              } else {
                console.debug(
                  '[UnifiedAuthContext] checkEmpleadoSession() token validado sin refresh',
                );
              }
            } else {
              console.warn(
                '[UnifiedAuthContext] checkEmpleadoSession() validar-token no OK',
                response.status,
              );
            }
          } catch (refreshError) {
            console.warn(
              '⚠️ No se pudo refrescar token de empleado, pero manteniendo sesión existente',
            );
          }
        } else if (savedToken === 'FIREBASE') {
          console.debug(
            '[UnifiedAuthContext] checkEmpleadoSession() sesión basada en Firebase; se omite validar-token',
          );
        }
        console.debug('[UnifiedAuthContext] checkEmpleadoSession() done (restored)');
        return;
      }

      // Flujo legacy: validar token simple solo si existe y no hay Firebase user
      if (!user && savedToken) {
        console.debug(
          '[UnifiedAuthContext] checkEmpleadoSession() legacy path: validating token without Firebase user',
        );
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
          }/empleado-auth/validar-token`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${savedToken}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setEmpleadoToken(savedToken);
            setEmpleado(data.data.empleado);
            setTenant(data.data.empleado.broker);
            setPermisos(data.data.permisos);
            setNeedsOnboarding(false);
            setSaasChecked(true);
            console.debug(
              '[UnifiedAuthContext] checkEmpleadoSession() legacy validated and restored',
            );
            return;
          }
        }
        console.warn(
          '[UnifiedAuthContext] checkEmpleadoSession() legacy validation failed, clearing session',
        );
        clearEmpleadoSession();
      }
    } catch (error) {
      clearEmpleadoSession();
    } finally {
      setEmpleadoLoading(false);
      console.debug('[UnifiedAuthContext] checkEmpleadoSession() finished');
    }
  };

  // Establecer sesión de empleado inmediatamente tras login
  const setEmpleadoSession = ({
    token,
    empleado,
    broker,
    permisos,
  }: {
    token: string;
    empleado: any;
    broker?: any;
    permisos?: string[];
  }) => {
    try {
      console.debug('[UnifiedAuthContext] setEmpleadoSession()', {
        empleadoId: empleado?.id,
        hasBroker: !!broker,
        permisosCount: Array.isArray(permisos) ? permisos.length : 0,
      });
      // Guardar siempre el token de empleado; este contexto se invoca solo para empleados
      if (token) {
        localStorage.setItem('empleado_token', token);
      }
      localStorage.setItem('empleado_data', JSON.stringify({ empleado, broker, permisos }));
      setEmpleadoToken(token);
      setEmpleado(empleado);
      if (broker) setTenant(broker);
      if (permisos) setPermisos(permisos as any);
      setSaasChecked(true);
      // Forzar refresh de permisos en UI
      setTimeout(() => {
        setPermisos((prev) => (prev ? { ...(prev as any) } : prev));
      }, 0);
    } catch (e) {
      console.warn('[UnifiedAuthContext] setEmpleadoSession() error', e);
    }
  };

  // Update tenant data dynamically and persist to localStorage if applicable
  const updateTenant = (newTenantData: Partial<BrokerTenant>) => {
    if (!tenant) return;

    // Merge profundo para branding
    const updatedBranding = newTenantData.branding 
      ? { ...(tenant.branding || {}), ...newTenantData.branding }
      : tenant.branding;

    const updatedTenant = { 
      ...tenant, 
      ...newTenantData,
      branding: updatedBranding 
    };
    
    console.log('🔄 updateTenant:', { 
      logo_url: updatedTenant.logo_url, 
      branding_logo: updatedTenant.branding?.logo,
      primary_color: updatedTenant.branding?.primary_color 
    });
    
    setTenant(updatedTenant as BrokerTenant);

    // Apply branding immediately
    if (updatedTenant.branding) {
      applyTenantBranding(updatedTenant.branding);
    }

    // Update localStorage - siempre intentar guardar
    try {
      const savedData = localStorage.getItem('empleado_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Actualizar broker con merge profundo
        parsed.broker = { 
          ...(parsed.broker || {}), 
          ...newTenantData,
          branding: updatedBranding
        };
        localStorage.setItem('empleado_data', JSON.stringify(parsed));
        console.log('✅ localStorage actualizado con nuevo tenant');
      } else {
        // Si no hay empleado_data, crear uno nuevo solo con broker
        localStorage.setItem('empleado_data', JSON.stringify({ 
          broker: updatedTenant,
          empleado: null,
          permisos: null
        }));
        console.log('✅ localStorage creado con nuevo tenant');
      }
    } catch (e) {
      console.warn('[UnifiedAuthContext] updateTenant() error updating localStorage', e);
    }
  };

  // Limpiar sesión de empleado
  const clearEmpleadoSession = () => {
    localStorage.removeItem('empleado_token');
    localStorage.removeItem('empleado_data');
    setEmpleado(null);
    setEmpleadoToken(null);
    if (!user) {
      setTenant(null);
      setPermisos(null);
    }
    setSaasChecked(true);
  };

  // Function to get Firebase token for API calls
  const getFirebaseToken = async (): Promise<string | null> => {
    if (!user) return null;
    // ==== AUTH DEBUG HELPERS ====
    const decodeJwt = (token: string | null) => {
      try {
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        // atob requiere padding correcto y reemplazo de URL-safe base64
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = atob(payload);
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    };

    const logAuthDebug = async (ctx: string) => {
      try {
        const idToken = user ? await user.getIdToken() : null;
        const claims = decodeJwt(idToken);
        const now = Math.floor(Date.now() / 1000);
        const exp = claims?.exp;
        const remaining = exp ? exp - now : null;

        console.groupCollapsed(`[AUTH DEBUG] ${ctx}`);
        console.table({
          baseURL: API_BASE_URL,
          endpoint_me_simple: API_CONFIG.ENDPOINTS.SAAS.ME,
          endpoint_onboarding: API_CONFIG.ENDPOINTS.SAAS.ONBOARDING,
          origin: typeof window !== 'undefined' ? window.location.origin : 'n/a',
          withCredentials: true,
          hasUser: !!user,
          email: user?.email || null,
          emailVerified: user?.emailVerified || false,
          tokenLength: idToken ? idToken.length : 0,
          tokenExp: exp || null,
          secondsToExpire: remaining,
        });
        if (claims) {
          console.log('[AUTH DEBUG] token claims:', claims);
        }
        console.log(
          '[AUTH DEBUG] cookies:',
          typeof document !== 'undefined' ? document.cookie : 'n/a',
        );
        console.groupEnd();
      } catch (e) {
        console.warn('[AUTH DEBUG] error logging context', e);
      }
    };
    // ==== END AUTH DEBUG HELPERS ====
    try {
      return await user.getIdToken();
    } catch (error) {
      return null;
    }
  };

  // Check SaaS status using Firebase token
  const checkSaasStatus = async () => {
    if (!user) {
      setSaasChecked(true);
      return;
    }

    try {
      setSaasLoading(true);
      setSaasError(null);

      const token = await getFirebaseToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de Firebase');
      }

      const { API_URLS } = await import('../config/constants');

      // Usar axios con interceptores para garantizar Authorization y refresh de token
      const responseAxios = await api.get(API_CONFIG.ENDPOINTS.SAAS.ME, {
        headers: {
          // redundante pero explícito (interceptor también lo agrega)
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        validateStatus: () => true, // manejar manualmente los 403
      });
      const response = new Response(JSON.stringify(responseAxios.data), {
        status: responseAxios.status,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Si el backend detectó que es un empleado (Firebase Custom Token con claims),
          // NO procesar como usuario SaaS — los permisos del empleado se manejan aparte.
          if (data.auth_type === 'empleado') {
            console.debug('[UnifiedAuthContext] checkSaasStatus() skipped: response is for empleado');
            setSaasChecked(true);
            return;
          }

          // Si no hay broker, NO activar onboarding - dejar que el layout muestre error de conexión
          if (!data?.data?.broker) {
            setUsuarioSaas(data.data.user || null);
            setTenant(null);
            setPermisos(data?.data?.user?.permisos || data?.data?.user?.permissions || []);
            setNeedsOnboarding(false); // Ya no activamos onboarding
            setOnboardingStep(null);
            setTrialExpired(false);
            setTrialEndsAt(null);
            setSaasChecked(true);
            setSaasError('No se pudo cargar la información del broker');
            return;
          }

          // Caso normal con broker existente: establecer contexto completo
          setUsuarioSaas(data.data.user);
          setTenant(data.data.broker);
          // Si está en trial, guardar fecha de fin
          const trialEnds = data.data.broker?.trial_ends_at || null;
          if (trialEnds && data.data.broker?.status === 'trial') {
            setTrialEndsAt(trialEnds);
          } else {
            setTrialEndsAt(null);
          }
          setPermisos(data.data.user.permisos || data.data.user.permissions || []);
          setNeedsOnboarding(false);
          setOnboardingStep(null);
          setTrialExpired(false);
          setTrialEndsAt(null);
          setSaasChecked(true);

          // Apply tenant branding (incluye color primario)
          if (data.data.broker?.branding) {
            applyTenantBranding(data.data.broker.branding);
          }
        }
      } else if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.error_code === 'TRIAL_EXPIRED') {
          setTrialExpired(true);
          setTrialEndsAt(errorData.trial_ends_at || null);
          // Establecer datos mínimos del broker para que el modal funcione
          setTenant({
            id: errorData.broker_id,
            name: errorData.broker_name,
            nombre: errorData.broker_name,
            status: 'trial_expired',
            trial_ends_at: errorData.trial_ends_at,
          } as any);
          // Establecer usuario mínimo para evitar loading infinito
          setUsuarioSaas({
            id: 0,
            nombre: user?.displayName || user?.email || 'Usuario',
            email: user?.email || '',
          } as any);
          setNeedsOnboarding(false);
          setSaasChecked(true);
          setSaasLoading(false);
          // Mantener usuario autenticado, pero bloquear módulos
        } else if (errorData.needs_onboarding) {
          // Ya NO activamos onboarding - mostramos error de conexión
          setNeedsOnboarding(false);
          setOnboardingStep(null);
          setSaasError('Problemas de conexión con la base de datos. Recarga la página o intenta nuevamente.');
        } else {
          throw new Error(errorData.message || 'Acceso denegado');
        }
      } else {
        await response.text();
        throw new Error('Error verificando estado SaaS');
      }
    } catch (err) {
      setSaasError(err instanceof Error ? err.message : 'Error desconocido');
      // Don't clear Firebase auth on SaaS errors
    } finally {
      setSaasLoading(false);
      setSaasChecked(true);
    }
  };

  // Aplicar branding al cargar el contexto (empleado o Firebase)
  useEffect(() => {
    if (tenant?.branding) {
      applyTenantBranding(tenant.branding);
    } else if ((tenant as any)?.branding) {
      applyTenantBranding((tenant as any).branding);
    }
  }, [tenant]);

  // Create broker (usar axios con interceptores para token/cookies)
  const createBroker = async (brokerData: any): Promise<{ success: boolean; message: string }> => {
    try {
      console.debug('[UnifiedAuthContext] createBroker() iniciando...', {
        hasUser: !!user,
        userEmail: user?.email,
        isEmailVerified: user?.emailVerified,
      });

      // Forzar refresh del token de Firebase para evitar 401 por expiración
      if (user) {
        try {
          await user.getIdToken(true);
        } catch (e) {
          console.warn('⚠️ No se pudo refrescar el token de Firebase', e);
        }
      }

      // 1) Sincronizar usuario Firebase en backend (asegura registro antes del onboarding)
      try {
        await api.post(API_CONFIG.ENDPOINTS.AUTH.SYNC_FIREBASE_USER, {});
        console.debug('[UnifiedAuthContext] createBroker() SYNC_FIREBASE_USER OK');
      } catch (e) {
        console.warn(
          '[UnifiedAuthContext] createBroker() SYNC_FIREBASE_USER falló (continuando):',
          e,
        );
      }

      // 2) Enviar onboarding vía axios api (interceptores agregan Authorization / refresh)
      const resp = await api.post(API_CONFIG.ENDPOINTS.SAAS.ONBOARDING, {
        ...brokerData,
        // asegurar que se use el email de la cuenta autenticada del contexto
        email: user?.email || brokerData.email || '',
      });

      const data = resp.data || {};
      console.debug('[UnifiedAuthContext] createBroker() respuesta recibida:', {
        status: resp.status,
        success: data.success,
        message: data.message,
      });

      if (resp.status === 200 && data.success) {
        await checkSaasStatus(); // Refresh SaaS status after creating broker
        return { success: true, message: data.message || 'Broker creado' };
      } else {
        console.error('[UnifiedAuthContext] createBroker() error en respuesta:', data);
        throw new Error(data.message || data.error || 'Error creando broker');
      }
    } catch (err: any) {
      // Normalizar mensaje de error, incluyendo errores de validación
      let message = 'Error desconocido';
      
      if (err?.response?.data?.errors) {
        // Errores de validación Laravel - extraer mensajes
        const errors = err.response.data.errors;
        const errorMessages: string[] = [];
        for (const field in errors) {
          const fieldErrors = errors[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((msg: string) => {
              // Traducir mensajes comunes
              if (msg.includes('has already been taken')) {
                if (field === 'document_number') {
                  errorMessages.push('El número de documento/NIT ya está registrado en el sistema');
                } else {
                  errorMessages.push(`El campo ${field} ya está en uso`);
                }
              } else {
                errorMessages.push(msg);
              }
            });
          }
        }
        message = errorMessages.length > 0 ? errorMessages.join('. ') : err?.response?.data?.message || 'Error de validación';
      } else if (err?.response?.data?.message) {
        message = err.response.data.message;
      } else if (err?.response?.data?.error) {
        message = err.response.data.error;
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      console.error('[UnifiedAuthContext] createBroker() excepción:', err);
      return { success: false, message };
    }
  };

  // Verificar permisos
  const hasPermission = (module: string, action: string): boolean => {
    // Empleado (Laravel): priorizar permisos normalizados del backend si existen
    if (empleado) {
      const employeePerms = Array.isArray(permisos)
        ? (permisos as string[])
        : empleado.rol?.permisos || [];
      if (Array.isArray(employeePerms)) {
        return (
          employeePerms.includes(`${module}.${action}`) ||
          employeePerms.includes(`${module}.*`) ||
          employeePerms.includes('*')
        );
      }
    }

    // Usuario SaaS (Firebase)
    if (usuarioSaas) {
      // MASTER/ADMIN: acceso total
      const isMasterOrAdmin =
        usuarioSaas.rol === 'admin' ||
        usuarioSaas.rol === 'ADMIN' ||
        usuarioSaas.rol === 'MASTER' ||
        usuarioSaas.rol === 'super_admin' ||
        (usuarioSaas as any)?.user_type === 'MASTER' ||
        (usuarioSaas as any)?.user_type === 'ADMIN' ||
        (usuarioSaas as any)?.user_type === 'super_admin' ||
        (usuarioSaas as any)?.user_type === 'admin';
      if (isMasterOrAdmin) return true;

      // permisos puede venir como array de strings o mapa por módulo
      if (Array.isArray(permisos)) {
        const list = permisos as string[];
        return (
          list.includes(`${module}.${action}`) || list.includes(`${module}.*`) || list.includes('*')
        );
      }
      if (permisos && (permisos as any)[module]) {
        const modList: string[] = (permisos as any)[module] || [];
        return modList.includes(action) || modList.includes('*');
      }
    }

    // Usuario Firebase durante carga de SaaS: permitir temporalmente
    if (user && !usuarioSaas) return true;

    return false;
  };

  // Verificar acceso a módulo
  const canAccessModule = useCallback(
    (module: string): boolean => {
      const alwaysAllowed = new Set([
        'dashboard', 'gestion_usuarios', 'roles_permisos', 'auditoria_accesos',
        'informacion_agencia', 'sedes', 'aseguradoras', 'ramos', 'vendedores',
        'coberturas', 'tipos_afiliacion', 'estados_siniestros', 'motivos_estados_poliza',
        'mensajeros', 'configuracion_sistema', 'monitoreo_logs',
        'integraciones_externas', 'sincronizacion', 'rrhh',
        'contratos', 'documentos_clientes', 'cumplimiento_legal',
        'reporte_actividades',
      ]);
      const featureMap: Record<string, string> = {
        clientes: 'clientes',
        polizas: 'polizas',
        siniestros: 'siniestros',
        renovaciones: 'renovaciones',
        automoviles: 'automoviles',
        seguimiento_comercial: 'seguimiento',
        documentos_siniestro: 'documentos',
        documentos_poliza: 'documentos',
        embudo_ventas: 'crm',
        metas_objetivos: 'crm',
        equipos_ventas: 'crm',
        analisis_rendimiento: 'crm',
        whatsapp_business: 'whatsapp',
        sms_marketing: 'whatsapp',
        email_marketing: 'email',
        enlaces_cotizacion: 'miniweb',
        mini_web: 'miniweb',
        pagina_web: 'miniweb',
        asistentes_ia: 'ia_chatbot',
        robots_ia: 'ia_chatbot',
        voice_ai: 'ia_callcenter',
        analytics_predictivo: 'ia_predicciones',
        comparador_autos: 'automoviles',
        comisiones: 'cartera',
        cartera_clientes: 'cartera',
        recibos_caja: 'cartera',
        estados_cuenta: 'cartera',
        reportes_financieros: 'cartera',
        creador_contenido: 'creador_contenido',
      };

      // Feature gate del plan: aplica a TODOS los usuarios (MASTER, empleados, etc.)
      // MASTER solo bypasea permisos de rol, NO el plan de features contratadas.
      if (tenant?.features && Array.isArray(tenant.features) && tenant.features.length > 0) {
        if (!alwaysAllowed.has(module)) {
          const featureKey = featureMap[module] || module;
          if (!tenant.features.includes(featureKey)) {
            return false;
          }
        }
      }

      // Usuario SaaS MASTER/ADMIN: acceso total a módulos del plan (evaluar ANTES de empleado
      // para evitar bloqueo cuando hay sesión de empleado mezclada con sesión Firebase)
      if (usuarioSaas) {
        const isMasterOrAdmin =
          usuarioSaas.rol === 'admin' ||
          usuarioSaas.rol === 'ADMIN' ||
          usuarioSaas.rol === 'MASTER' ||
          usuarioSaas.rol === 'super_admin' ||
          (usuarioSaas as any).user_type === 'MASTER' ||
          (usuarioSaas as any).user_type === 'ADMIN' ||
          (usuarioSaas as any).user_type === 'admin' ||
          (usuarioSaas as any).user_type === 'super_admin';
        if (isMasterOrAdmin) return true;
      }

      // Empleado (Laravel): acceso controlado por permisos de rol asignados por el admin.
      // WhatsApp es libre para todos los empleados.
      if (empleado) {
        if (module === 'whatsapp_business') return true;
        const list = Array.isArray(permisos)
          ? (permisos as string[])
          : empleado.rol?.permisos || [];
        if (!Array.isArray(list)) return false;
        if (list.includes('*')) return true;
        if (list.includes(`${module}.*`)) return true;
        if (list.includes(`${module}.ver`)) return true;
        return list.some((p: string) => p.startsWith(`${module}.`));
      }

      // Usuario SaaS (Firebase) no-MASTER: verificar permisos específicos
      if (usuarioSaas) {
        if (Array.isArray(permisos)) {
          const list = permisos as string[];
          return (
            list.includes('*') ||
            list.includes(`${module}.*`) ||
            list.includes(`${module}.ver`) ||
            list.some((p) => p.startsWith(`${module}.`))
          );
        }
        if (permisos && (permisos as any)?.[module]) {
          return true;
        }
      }

      // Usuario Firebase durante carga de SaaS
      if (user && !usuarioSaas) return true;

      return false;
    },
    [empleado, usuarioSaas, permisos, user, tenant],
  );

  // Verificar si un módulo está incluido en el plan del broker (independiente de permisos de rol)
  const isModuleInPlan = useCallback(
    (module: string): boolean => {
      const alwaysAllowed = new Set([
        'dashboard', 'gestion_usuarios', 'roles_permisos', 'auditoria_accesos',
        'informacion_agencia', 'sedes', 'aseguradoras', 'ramos', 'vendedores',
        'coberturas', 'tipos_afiliacion', 'estados_siniestros', 'motivos_estados_poliza',
        'mensajeros', 'configuracion_sistema', 'monitoreo_logs',
        'integraciones_externas', 'sincronizacion', 'rrhh',
        'contratos', 'documentos_clientes', 'cumplimiento_legal',
        'reporte_actividades',
      ]);
      if (alwaysAllowed.has(module)) return true;
      const featureMap: Record<string, string> = {
        clientes: 'clientes', polizas: 'polizas', siniestros: 'siniestros',
        renovaciones: 'renovaciones', automoviles: 'automoviles',
        seguimiento_comercial: 'seguimiento', documentos_siniestro: 'documentos',
        documentos_poliza: 'documentos', embudo_ventas: 'crm', metas_objetivos: 'crm',
        equipos_ventas: 'crm', analisis_rendimiento: 'crm', whatsapp_business: 'whatsapp',
        sms_marketing: 'whatsapp', email_marketing: 'email', enlaces_cotizacion: 'miniweb',
        mini_web: 'miniweb', pagina_web: 'miniweb', asistentes_ia: 'ia_chatbot', robots_ia: 'ia_chatbot',
        voice_ai: 'ia_callcenter', analytics_predictivo: 'ia_predicciones',
        comparador_autos: 'automoviles', comisiones: 'cartera',
        cartera_clientes: 'cartera', recibos_caja: 'cartera', estados_cuenta: 'cartera', reportes_financieros: 'cartera',
        creador_contenido: 'creador_contenido',
      };
      if (tenant?.features && Array.isArray(tenant.features) && tenant.features.length > 0) {
        const featureKey = featureMap[module] || module;
        return tenant.features.includes(featureKey);
      }
      // If no features defined, allow all (legacy/no plan set)
      return true;
    },
    [tenant],
  );

  // Verificar rol
  const isRole = (role: string): boolean => {
    if (empleado && empleado.rol) {
      return empleado.rol.nombre.toLowerCase() === role.toLowerCase();
    }

    return usuarioSaas?.rol === role;
  };

  // Logout unificado
  const logout = async (): Promise<void> => {
    try {
      // Logout empleado si está logueado
      if (isEmpleado) {
        try {
          await fetch(`${API_BASE_URL}/empleado-auth/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${empleadoToken}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) { }
        clearEmpleadoSession();
      }

      // Logout Firebase si está logueado
      if (user) {
        await firebaseLogout();
      }

      // Limpiar todos los estados
      setTenant(null);
      setUsuarioSaas(null);
      setPermisos(null);
      setNeedsOnboarding(false);
      setOnboardingStep(null);
      setTrialExpired(false);
      setTrialEndsAt(null);
    } catch (error) { }
  };

  const value: UnifiedAuthContextType = {
    // Firebase Auth
    user,
    loading,
    error,

    // Employee Auth
    empleado,
    empleadoToken,
    isEmpleado,

    // SaaS Data
    tenant,
    usuarioSaas,
    permisos,
    needsOnboarding,
    onboardingStep,
    trialExpired,
    trialEndsAt,

    // Auth Methods
    loginWithEmail: firebaseLoginWithEmail,
    registerWithEmail: firebaseRegisterWithEmail,
    loginWithGoogle: firebaseLoginWithGoogle,
    logout,
    resetPassword: firebaseResetPassword,
    setEmpleadoSession,

    // SaaS Methods
    createBroker,
    checkSaasStatus,
    hasPermission,
    canAccessModule,
    isModuleInPlan,
    isRole,

    // Utilities
    isAuthenticated,
    isEmailVerified,
    hasCompleteSaasAccess,
    saasChecked,
    updateTenant,
  };

  return <UnifiedAuthContext.Provider value={value}>{children}</UnifiedAuthContext.Provider>;
};
