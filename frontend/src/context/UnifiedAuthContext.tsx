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

  // Métodos SaaS
  createBroker: (brokerData: any) => Promise<{ success: boolean; message: string }>;
  checkSaasStatus: () => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
  canAccessModule: (module: string) => boolean;
  isRole: (role: string) => boolean;

  // Utilidades
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  hasCompleteSaasAccess: boolean;
  saasChecked: boolean;
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType | undefined>(undefined);

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
    } catch {}
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
    } catch {}
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
    } catch {}
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
    } catch {}
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
      // Empleados no requieren verificación de email; no limpiar su estado SaaS
      if (isEmpleado) {
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
              setNeedsOnboarding(true);
              setOnboardingStep('create_broker');
              setSaasError('Usuario necesita crear un broker');
            }
          }
        } catch (error) {}
      }
    };

    // Ejecutar verificación después de un pequeño delay para evitar conflictos
    const timeoutId = setTimeout(checkBrokerId, 1000);
    return () => clearTimeout(timeoutId);
  }, [user, isEmpleado, saasLoading]);

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
        if (parsed.broker) setTenant(parsed.broker);
        if (parsed.permisos) setPermisos(parsed.permisos);
        if (savedToken) setEmpleadoToken(savedToken);
        setNeedsOnboarding(false);
        setSaasChecked(true);
        console.debug('[UnifiedAuthContext] checkEmpleadoSession() restored from localStorage', {
          empleadoId: parsed?.empleado?.id,
          hasBroker: !!parsed?.broker,
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
          `${
            import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
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
          // Si el endpoint devuelve needs_onboarding en 200 o no hay broker, activar onboarding
          const shouldOnboard = data?.data?.needs_onboarding === true || !data?.data?.broker;
          if (shouldOnboard) {
            setUsuarioSaas(data.data.user || null);
            setTenant(null);
            setPermisos(data?.data?.user?.permisos || data?.data?.user?.permissions || []);
            setNeedsOnboarding(true);
            setOnboardingStep('create_broker');
            setTrialExpired(false);
            setTrialEndsAt(null);
            setSaasChecked(true);
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

          // Apply tenant branding
          if (data.data.broker?.branding) {
            applyTenantBranding(data.data.broker.branding);
          }
        }
      } else if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.error_code === 'TRIAL_EXPIRED') {
          setTrialExpired(true);
          setTrialEndsAt(errorData.trial_ends_at || null);
          // Mantener usuario autenticado, pero bloquear módulos
        } else if (errorData.needs_onboarding) {
          setNeedsOnboarding(true);
          setOnboardingStep(errorData.onboarding_step || 'create_broker');
          setSaasError(errorData.message);
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

  // Aplicar branding del tenant
  const applyTenantBranding = (branding: any) => {
    try {
      if (branding?.primary_color) {
        document.documentElement.style.setProperty('--color-primary', branding.primary_color);
      }
      if (branding?.secondary_color) {
        document.documentElement.style.setProperty('--color-secondary', branding.secondary_color);
      }
      if (branding?.accent_color) {
        document.documentElement.style.setProperty('--color-accent', branding.accent_color);
      }
    } catch (error) {}
  };

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
      // Normalizar mensaje de error
      const backendMessage = err?.response?.data?.message || err?.response?.data?.error;
      const message = backendMessage || (err instanceof Error ? err.message : 'Error desconocido');
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
      // Empleado (Laravel): usar permisos normalizados si existen
      if (empleado) {
        const list = Array.isArray(permisos)
          ? (permisos as string[])
          : empleado.rol?.permisos || [];
        if (!Array.isArray(list)) return false;
        if (list.includes('*')) return true;
        if (list.includes(`${module}.*`)) return true;
        // Tener permiso de "ver" ya habilita visibilidad en UI
        if (list.includes(`${module}.ver`)) return true;
        return list.some((p: string) => p.startsWith(`${module}.`));
      }

      // Usuario SaaS (Firebase)
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
    [empleado, usuarioSaas, permisos, user],
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
        } catch (error) {}
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
    } catch (error) {}
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
    isRole,

    // Utilities
    isAuthenticated,
    isEmailVerified,
    hasCompleteSaasAccess,
    saasChecked,
  };

  return <UnifiedAuthContext.Provider value={value}>{children}</UnifiedAuthContext.Provider>;
};
