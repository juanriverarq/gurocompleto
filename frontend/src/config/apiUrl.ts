/**
 * Helper centralizado para obtener la URL base de la API
 * Detecta automáticamente si estamos en producción basándose en el hostname
 */
export const getApiBaseUrl = (): string => {
  // 1. Variable de entorno (build time)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. Runtime override via window.__ENV__
  if (typeof window !== 'undefined' && (window as any).__ENV__?.API_BASE_URL) {
    return (window as any).__ENV__.API_BASE_URL;
  }
  
  // 3. Detectar producción por hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'guro.co' || hostname === 'www.guro.co' || hostname.endsWith('.guro.co')) {
      return 'https://app.guro.co/api';
    }
  }
  
  // 4. Fallback para desarrollo local
  return 'http://localhost:8081/api';
};

export const API_BASE_URL = getApiBaseUrl();
