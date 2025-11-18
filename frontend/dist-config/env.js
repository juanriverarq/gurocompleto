// Runtime configuration for production
window.__ENV__ = Object.assign({}, window.__ENV__ || {}, {
  API_BASE_URL: "http://localhost:8081/api",
  CLIENTES_DELETE_ENABLED: false,
  VERSION: "prod",
  BUILD_TIME: new Date().toISOString()
});
