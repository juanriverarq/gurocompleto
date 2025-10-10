/* Runtime configuration for the frontend (editable without rebuild)
   Copy/adjust this file per environment (dev/staging/production).
   Values here are read at runtime via window.__ENV__.
*/
window.__ENV__ = Object.assign({}, window.__ENV__ || {}, {
  // Habilita la opción de eliminar clientes en UI
  CLIENTES_DELETE_ENABLED: true,

  // URL base del backend en producción (override runtime para API)
  // ⚠️ COMENTADO PARA DESARROLLO LOCAL - Descomentar solo en producción
  // API_BASE_URL: 'https://app.guro.co/api',
  
  // Para desarrollo local, se usa VITE_API_URL del .env.local
  // API_BASE_URL: 'http://localhost:8001/api',
});
