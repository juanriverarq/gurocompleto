const express = require('express');
const cors = require('cors');
const cache = require('./cache');
const { getScraper, getAvailableScraperIds, cleanupAll } = require('./scrapers');
const { createQuote, getQuoteStatus } = require('./quoter');

const app = express();
app.use(cors());
app.use(express.json());

// ---- Health ----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', scrapers: getAvailableScraperIds() });
});

// ---- Aseguradoras disponibles ----
app.get('/api/insurers', (req, res) => {
  res.json(Object.values(cache.INSURERS));
});

// ---- Conexiones ----
app.get('/api/connections', (req, res) => {
  res.json(cache.getAllConnections());
});

app.post('/api/connections/:methodId/credentials', (req, res) => {
  try {
    const saved = cache.saveConnection(req.params.methodId, req.body);
    res.json({ success: true, connection: saved });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/connections/:methodId', (req, res) => {
  cache.removeConnection(req.params.methodId);
  res.json({ success: true });
});

app.post('/api/connections/:methodId/toggle', (req, res) => {
  cache.toggleConnection(req.params.methodId, req.body.active);
  res.json({ success: true });
});

app.post('/api/connections/:methodId/test', async (req, res) => {
  const { methodId } = req.params;
  const conn = cache.getConnection(methodId);
  if (!conn) return res.status(400).json({ error: 'Sin credenciales configuradas' });

  const scraper = getScraper(methodId);
  if (!scraper) return res.status(400).json({ error: `Scraper no disponible para ${methodId}` });

  try {
    const result = await scraper.testConnection(conn);
    cache.updateTestResult(methodId, result.success ? 'success' : 'failed');
    res.json(result);
  } catch (e) {
    cache.updateTestResult(methodId, 'error');
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---- Explorar API de SURA (debug) ----
app.get('/api/sura/explore', async (req, res) => {
  const session = cache.getSession('sura_portal');
  if (!session?.cookieHeader) return res.status(400).json({ error: 'Sin sesión SURA. Pegue cookies y pruebe conexión primero.' });

  const axios = require('axios');
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const base = 'https://apiasistentevirtualasesores.sura.com';
  const headers = { 'User-Agent': UA, 'Cookie': session.cookieHeader, 'Accept': 'application/json' };

  const results = {};

  // 1. Identity completo (incluye menú con endpoints)
  try {
    const id = await axios.get(`${base}/home/users/identity`, { headers, timeout: 10000 });
    results.identity = id.data;
  } catch (e) { results.identity = { error: e.message }; }

  // 2. Extraer XSRF token de las cookies
  const xsrf = session.cookieHeader.match(/XSRF-TOKEN=([^;]+)/)?.[1];
  results.xsrfToken = xsrf || 'no encontrado';

  // 3. Probar endpoints con XSRF header (el 403 puede ser por falta de este)
  const headersWithXsrf = { ...headers, 'X-XSRF-TOKEN': xsrf || '', 'X-Requested-With': 'XMLHttpRequest' };

  const testPaths = [
    { method: 'GET', path: '/home/users/identity' },
    { method: 'GET', path: '/ohs-mercadeo/cotizaciones' },
    { method: 'GET', path: '/ohs-mercadeo/cotizaciones/vehiculos' },
    { method: 'GET', path: '/home/menu' },
    { method: 'GET', path: '/home/modules' },
    { method: 'GET', path: '/ohs-mercadeo/marcas' },
    { method: 'GET', path: '/ohs-mercadeo/vehiculos' },
    { method: 'GET', path: '/ohs-mercadeo/lineas' },
    { method: 'GET', path: '/ohs-mercadeo/autos/marcas' },
    { method: 'GET', path: '/ohs-mercadeo/polizas' },
    { method: 'GET', path: '/ohs-mercadeo/dashboard' },
    { method: 'GET', path: '/asistente-virtual/cotizaciones' },
    { method: 'GET', path: '/asistente-virtual/vehiculos' },
    { method: 'GET', path: '/cotizador/vehiculos' },
    { method: 'GET', path: '/seguros/vehiculos' },
  ];

  results.endpoints = [];
  for (const t of testPaths) {
    try {
      const r = await axios({ method: t.method, url: `${base}${t.path}`, headers: headersWithXsrf, timeout: 8000, validateStatus: () => true, maxRedirects: 0 });
      results.endpoints.push({ ...t, status: r.status, contentType: r.headers['content-type'], preview: JSON.stringify(r.data).slice(0, 300) });
    } catch (e) {
      results.endpoints.push({ ...t, error: e.message });
    }
  }

  // 4. Probar el endpoint de cotización con XSRF token
  const quotePaths = [
    '/ohs-mercadeo/cotizaciones/vehiculos',
    '/ohs-mercadeo/cotizaciones',
  ];
  results.quoteTests = [];
  for (const p of quotePaths) {
    try {
      const r = await axios.post(`${base}${p}`, { test: true }, { headers: headersWithXsrf, timeout: 8000, validateStatus: () => true });
      results.quoteTests.push({ path: p, status: r.status, preview: JSON.stringify(r.data).slice(0, 300) });
    } catch (e) {
      results.quoteTests.push({ path: p, error: e.message });
    }
  }

  res.json(results);
});

// ---- Cotización ----
app.post('/api/quote', async (req, res) => {
  try {
    const { vehicle, client } = req.body;
    if (!vehicle || !client) {
      return res.status(400).json({ error: 'Se requieren datos de vehicle y client' });
    }
    const result = await createQuote(vehicle, client);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/quote/:id', (req, res) => {
  const quote = getQuoteStatus(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
  res.json({ id: req.params.id, ...quote });
});

app.get('/api/quotes', (req, res) => {
  res.json(cache.getAllQuotes());
});

// ---- Datos FASECOLDA (mock local) ----
const fasecolda = require('./fasecolda');
app.get('/api/vehicles/brands', (req, res) => {
  res.json(fasecolda.getBrands());
});
app.get('/api/vehicles/lines', (req, res) => {
  const { brand } = req.query;
  if (!brand) return res.status(400).json({ error: 'brand requerido' });
  res.json(fasecolda.getLines(brand));
});
app.get('/api/vehicles/models', (req, res) => {
  const { brand, line } = req.query;
  if (!brand || !line) return res.status(400).json({ error: 'brand y line requeridos' });
  res.json(fasecolda.getModels(brand, line));
});
app.get('/api/vehicles/search', (req, res) => {
  const { brand, line, model } = req.query;
  if (!brand) return res.status(400).json({ error: 'brand requerido' });
  res.json(fasecolda.search(brand, line, model ? parseInt(model) : null));
});

// ---- Cleanup on shutdown ----
process.on('SIGTERM', async () => {
  await cleanupAll();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await cleanupAll();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Cotizador Backend en http://localhost:${PORT}`);
  console.log(`   Scrapers disponibles: ${getAvailableScraperIds().join(', ')}`);
});
