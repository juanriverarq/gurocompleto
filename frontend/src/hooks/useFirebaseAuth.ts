import { useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  updateProfile,
  AuthError,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface FirebaseAuthHook extends AuthState {
  // Métodos de autenticación
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
  updateUserProfile: (
    displayName: string,
    photoURL?: string,
  ) => Promise<{ success: boolean; message: string }>;
  resendEmailVerification: () => Promise<{ success: boolean; message: string }>;
  clearError: () => void;
}

// Función para sincronizar usuario con Laravel usando Firebase Admin SDK
const syncUserWithLaravel = async (user: User, isNewUser: boolean = false) => {
  try {
    const token = await user.getIdToken();

    // Ahora solo enviamos el token, el middleware se encarga del resto
    const { API_URLS } = await import('../config/constants');
    // Adjuntar selección de pricing si existe para crear subscription_intents en el backend
    let pricingSelection: any = null;
    try {
      // Solo adjuntar selección cuando es un usuario nuevo para evitar duplicados
      const alreadySent = localStorage.getItem('guro_pricing_selection_sent') === '1';
      if (isNewUser && !alreadySent) {
        const raw = localStorage.getItem('guro_pricing_selection');
        if (raw) {
          pricingSelection = JSON.parse(raw);
          // Asegurar source para trazabilidad
          if (pricingSelection && typeof pricingSelection === 'object') {
            pricingSelection.source = 'sync_firebase_user';
          }
        }
      }
    } catch {}

    const response = await fetch(API_URLS.SYNC_FIREBASE_USER, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        pricingSelection
          ? {
              pricing_selection: pricingSelection,
            }
          : {},
      ),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return false;
    }

    const result = await response.json();
    // Si el backend creó la intención, marcar como enviada para evitar duplicados
    try {
      if (result?.subscription_intent_id) {
        localStorage.setItem('guro_pricing_selection_sent', '1');
        // Ya no redirigir a checkout - el usuario tiene 7 días de trial gratis
        // La intención de suscripción se guarda para cuando decida pagar
      }
    } catch {}

    // Mostrar notificación de éxito
    if (result.user && result.user.created_at === result.user.updated_at) {
    } else {
    }

    return true;
  } catch (error) {
    return false;
  }
};

export const useFirebaseAuth = (): FirebaseAuthHook => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Sincronizar usuario con Laravel cuando se autentica
        await syncUserWithLaravel(user, false);
      }

      setAuthState((prev) => ({
        ...prev,
        user,
        loading: false,
      }));
    });

    return () => unsubscribe();
  }, []);

  // Manejar errores de Firebase
  const handleFirebaseError = (error: AuthError): string => {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Usuario no encontrado';
      case 'auth/wrong-password':
        return 'Contraseña incorrecta';
      case 'auth/email-already-in-use':
        return 'El email ya está en uso';
      case 'auth/weak-password':
        return 'La contraseña es muy débil';
      case 'auth/invalid-email':
        return 'Email inválido';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intenta más tarde';
      case 'auth/network-request-failed':
        return 'Error de conexión. Verifica tu internet';
      case 'auth/popup-closed-by-user':
        return 'Ventana cerrada por el usuario';
      case 'auth/cancelled-popup-request':
        return 'Solicitud cancelada';
      default:
        return error.message || 'Error desconocido';
    }
  };

  // Login con email y contraseña
  const loginWithEmail = async (email: string, password: string) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));

      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      return {
        success: true,
        message: 'Login exitoso',
        user: userCredential.user,
      };
    } catch (error) {
      const errorMessage = handleFirebaseError(error as AuthError);
      setAuthState((prev) => ({ ...prev, error: errorMessage, loading: false }));

      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  // Registro con email y contraseña
  const registerWithEmail = async (email: string, password: string, name: string) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Actualizar el perfil con el nombre
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      // Sincronizar con Laravel como nuevo usuario
      const syncSuccess = await syncUserWithLaravel(userCredential.user, true);
      if (!syncSuccess) {
      }

      // Enviar verificación de email
      await sendEmailVerification(userCredential.user);

      // Mantener al usuario autenticado para permitir continuar al checkout

      return {
        success: true,
        message: 'Registro exitoso. Verifica tu email para continuar.',
        user: userCredential.user,
      };
    } catch (error) {
      const errorMessage = handleFirebaseError(error as AuthError);
      setAuthState((prev) => ({ ...prev, error: errorMessage, loading: false }));

      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  // Login con Google
  const loginWithGoogle = async () => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));

      const result = await signInWithPopup(auth, googleProvider);

      // Verificar si es un usuario nuevo
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;

      // Sincronizar con Laravel
      const syncSuccess = await syncUserWithLaravel(result.user, isNewUser);
      if (!syncSuccess) {
      }

      return {
        success: true,
        message: isNewUser ? 'Registro con Google exitoso' : 'Login con Google exitoso',
        user: result.user,
      };
    } catch (error) {
      const errorMessage = handleFirebaseError(error as AuthError);
      setAuthState((prev) => ({ ...prev, error: errorMessage, loading: false }));

      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {}
  };

  // Restablecer contraseña
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);

      return {
        success: true,
        message: 'Email de recuperación enviado',
      };
    } catch (error) {
      const errorMessage = handleFirebaseError(error as AuthError);

      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  // Actualizar perfil de usuario
  const updateUserProfile = async (displayName: string, photoURL?: string) => {
    try {
      if (!authState.user) {
        return {
          success: false,
          message: 'Usuario no autenticado',
        };
      }

      await updateProfile(authState.user, {
        displayName,
        ...(photoURL && { photoURL }),
      });

      return {
        success: true,
        message: 'Perfil actualizado exitosamente',
      };
    } catch (error) {
      const errorMessage = handleFirebaseError(error as AuthError);

      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  // Reenviar verificación de email
  const resendEmailVerification = async () => {
    try {
      if (!authState.user) {
        return {
          success: false,
          message: 'Usuario no autenticado',
        };
      }

      await sendEmailVerification(authState.user);

      return {
        success: true,
        message: 'Email de verificación reenviado',
      };
    } catch (error) {
      const errorMessage = handleFirebaseError(error as AuthError);

      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  // Limpiar error
  const clearError = () => {
    setAuthState((prev) => ({ ...prev, error: null }));
  };

  return {
    ...authState,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    resendEmailVerification,
    clearError,
  };
};
