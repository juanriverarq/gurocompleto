// ============================================================
// In-Memory Cache — credenciales, sesiones, cotizaciones
// Sin base de datos, todo vive en memoria del proceso
// ============================================================

const store = {
  connections: {},
  sessions: {},
  quotes: {},
  vehicles: { brands: [], lastFetch: 0 },
};

const INSURERS = {
  sura: {
    id: 'sura',
    name: 'Seguros SURA',
    nit: '890903407',
    logo: '/logos/sura.png',
    color: '#0033A0',
    methods: [
      {
        id: 'sura_portal',
        name: 'SURA Cotizador',
        type: 'scraping',
        description: 'Conecta a su Chrome real con cotizadores.sura.com abierto',
        helpText: '1. Cierre Chrome completamente\n2. Abra Terminal y ejecute:\n   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222\n3. En Chrome, vaya a cotizadores.sura.com e inicie sesión\n4. Vuelva aquí y pruebe la conexión',
        fields: [],
      },
    ],
  },
  bolivar: {
    id: 'bolivar',
    name: 'Seguros Bolívar',
    nit: '860002180',
    logo: '/logos/bolivar.png',
    color: '#003366',
    methods: [
      {
        id: 'bolivar_bolnet',
        name: 'Bolívar Bolnet',
        type: 'scraping',
        description: 'Conexión al portal Bolnet de intermediarios',
        fields: [
          { key: 'username', label: 'Usuario', placeholder: 'Usuario Bolnet', type: 'text' },
          { key: 'password', label: 'Contraseña', placeholder: 'Contraseña Bolnet', type: 'password' },
        ],
      },
    ],
  },
  allianz: {
    id: 'allianz',
    name: 'Allianz Seguros',
    nit: '860026182',
    logo: '/logos/allianz.png',
    color: '#003781',
    methods: [
      {
        id: 'allianz_portal',
        name: 'Allianz Allia2Net',
        type: 'scraping',
        description: 'Conexión al portal Allia2Net de intermediarios',
        fields: [
          { key: 'username', label: 'Usuario', placeholder: 'Usuario Allia2Net', type: 'text' },
          { key: 'password', label: 'Contraseña', placeholder: 'Contraseña Allia2Net', type: 'password' },
        ],
      },
    ],
  },
  liberty: {
    id: 'liberty',
    name: 'Liberty Seguros',
    nit: '860039988',
    logo: '/logos/liberty.png',
    color: '#FFD100',
    methods: [
      {
        id: 'liberty_portal',
        name: 'Liberty Express',
        type: 'scraping',
        description: 'Conexión al portal Liberty Express',
        fields: [
          { key: 'username', label: 'Usuario', placeholder: 'Usuario Liberty', type: 'text' },
          { key: 'password', label: 'Contraseña', placeholder: 'Contraseña Liberty', type: 'password' },
        ],
      },
    ],
  },
  hdi: {
    id: 'hdi',
    name: 'HDI Seguros',
    nit: '860004875',
    logo: '/logos/hdi.png',
    color: '#006B3F',
    methods: [
      {
        id: 'hdi_portal',
        name: 'HDI Portal Electrónico',
        type: 'scraping',
        description: 'Conexión al portal de póliza electrónica HDI',
        fields: [
          { key: 'username', label: 'Usuario', placeholder: 'Usuario HDI', type: 'text' },
          { key: 'password', label: 'Contraseña', placeholder: 'Contraseña HDI', type: 'password' },
        ],
      },
    ],
  },
  mapfre: {
    id: 'mapfre',
    name: 'Mapfre Seguros',
    nit: '891700037',
    logo: '/logos/mapfre.png',
    color: '#DA291C',
    methods: [
      {
        id: 'mapfre_portal',
        name: 'Mapfre Oficina Virtual',
        type: 'scraping',
        description: 'Conexión a la oficina virtual Mapfre',
        fields: [
          { key: 'username', label: 'Usuario', placeholder: 'Usuario Mapfre', type: 'text' },
          { key: 'password', label: 'Contraseña', placeholder: 'Contraseña Mapfre', type: 'password' },
        ],
      },
    ],
  },
};

// ---- Conexiones (credenciales guardadas) ----

function saveConnection(methodId, credentials) {
  store.connections[methodId] = {
    ...credentials,
    methodId,
    active: true,
    testResult: null,
    savedAt: Date.now(),
  };
  return store.connections[methodId];
}

function getConnection(methodId) {
  return store.connections[methodId] || null;
}

function getAllConnections() {
  const result = [];
  for (const insurer of Object.values(INSURERS)) {
    for (const method of insurer.methods) {
      const conn = store.connections[method.id];
      result.push({
        ...method,
        insurerId: insurer.id,
        insurerName: insurer.name,
        insurerColor: insurer.color,
        configured: !!conn,
        active: conn?.active || false,
        testResult: conn?.testResult || null,
      });
    }
  }
  return result;
}

function removeConnection(methodId) {
  delete store.connections[methodId];
}

function toggleConnection(methodId, active) {
  if (store.connections[methodId]) {
    store.connections[methodId].active = active;
  }
}

function updateTestResult(methodId, result) {
  if (store.connections[methodId]) {
    store.connections[methodId].testResult = result;
  }
}

function getActiveConnections() {
  return Object.values(store.connections).filter(c => c.active);
}

// ---- Sesiones de scraping ----

function saveSession(methodId, sessionData) {
  store.sessions[methodId] = { ...sessionData, updatedAt: Date.now() };
}

function getSession(methodId) {
  return store.sessions[methodId] || null;
}

// ---- Cotizaciones ----

function saveQuote(quoteId, data) {
  store.quotes[quoteId] = { ...data, createdAt: Date.now() };
}

function getQuote(quoteId) {
  return store.quotes[quoteId] || null;
}

function getAllQuotes() {
  return Object.entries(store.quotes)
    .map(([id, q]) => ({ id, ...q }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  INSURERS,
  saveConnection,
  getConnection,
  getAllConnections,
  removeConnection,
  toggleConnection,
  updateTestResult,
  getActiveConnections,
  saveSession,
  getSession,
  saveQuote,
  getQuote,
  getAllQuotes,
  store,
};
