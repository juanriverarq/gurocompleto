import { useState, useEffect } from 'react';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';

const WELCOME_MODAL_KEY = 'guro_welcome_modal_shown';

interface UseWelcomeModalReturn {
  showWelcomeModal: boolean;
  closeWelcomeModal: () => void;
  userName: string;
}

export const useWelcomeModal = (isDashboard: boolean = false): UseWelcomeModalReturn => {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const { user, empleado, isAuthenticated, loading, hasCompleteSaasAccess, needsOnboarding } = useUnifiedAuth();

  // Obtener el nombre del usuario
  const getUserName = (): string => {
    if (empleado) {
      return `${empleado.nombres} ${empleado.apellidos}`.trim();
    }
    
    if (user) {
      return user.displayName || user.email?.split('@')[0] || 'Usuario';
    }
    
    return 'Usuario';
  };

  const userName = getUserName();

  // Función para cerrar la modal y marcar como vista
  const closeWelcomeModal = () => {
    setShowWelcomeModal(false);
    
    // Marcar como vista para este usuario específico
    const userId = empleado?.id?.toString() || user?.uid;
    if (userId) {
      const shownUsers = getShownUsers();
      shownUsers.add(userId);
      localStorage.setItem(WELCOME_MODAL_KEY, JSON.stringify([...shownUsers]));
    }
  };

  // Función para obtener usuarios que ya vieron la modal
  const getShownUsers = (): Set<string> => {
    try {
      const stored = localStorage.getItem(WELCOME_MODAL_KEY);
      if (stored) {
        const userIds = JSON.parse(stored);
        return new Set(Array.isArray(userIds) ? userIds : []);
      }
    } catch (error) {
      console.warn('Error al leer usuarios que vieron la modal:', error);
    }
    return new Set();
  };

  // Verificar si el usuario actual ya vio la modal
  const hasUserSeenModal = (): boolean => {
    const userId = empleado?.id?.toString() || user?.uid;
    if (!userId) return true; // Si no hay ID, no mostrar modal
    
    const shownUsers = getShownUsers();
    return shownUsers.has(userId);
  };

  // Efecto para determinar si mostrar la modal (solo en dashboard después del onboarding)
  useEffect(() => {
    // Solo funcionar si estamos en el dashboard
    if (!isDashboard) {
      setShowWelcomeModal(false);
      return;
    }

    // Solo proceder si no está cargando y el usuario está autenticado
    if (loading || !isAuthenticated) {
      setShowWelcomeModal(false);
      return;
    }

    // Solo mostrar si el usuario ha completado el onboarding
    if (needsOnboarding || !hasCompleteSaasAccess) {
      setShowWelcomeModal(false);
      return;
    }

    // Verificar si es un nuevo usuario (no ha visto la modal)
    if (!hasUserSeenModal()) {
      // Pequeño delay para asegurar que la UI esté lista
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setShowWelcomeModal(false);
    }
  }, [isDashboard, isAuthenticated, loading, needsOnboarding, hasCompleteSaasAccess, empleado?.id, user?.uid]);

  return {
    showWelcomeModal,
    closeWelcomeModal,
    userName
  };
};

export default useWelcomeModal;