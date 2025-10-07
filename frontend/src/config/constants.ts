// Configuración centralizada de la aplicación
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8081/api',
  ENDPOINTS: {
    AUTH: {
      SYNC_FIREBASE_USER: '/auth/sync-firebase-user',
      PROFILE: '/auth/profile',
      LOGOUT: '/auth/logout',
    },
    SAAS: {
      ME: '/saas/me-simple',
      ROLES: '/saas/roles',
      ONBOARDING: '/saas/onboarding/create-broker',
      POLIZAS: '/saas/polizas',
      CLIENTES: '/saas/clientes',
      SINIESTROS: '/saas/siniestros',
    },
  },
};

// URL completas para facilitar el uso
export const API_URLS = {
  SYNC_FIREBASE_USER: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.SYNC_FIREBASE_USER}`,
  SAAS_ME: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.ME}`,
  SAAS_ROLES: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.ROLES}`,
  SAAS_ONBOARDING: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.ONBOARDING}`,
  SAAS_POLIZAS: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.POLIZAS}`,
  SAAS_CLIENTES: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.CLIENTES}`,
  SAAS_SINIESTROS: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.SINIESTROS}`,
};

export default API_CONFIG;
