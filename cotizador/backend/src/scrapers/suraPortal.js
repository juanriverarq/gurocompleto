const puppeteer = require('puppeteer');
const axios = require('axios');
const cache = require('../cache');

// ============================================================
// SURA Cotizador — Conectar a Chrome real del usuario
// cotizadores.sura.com detecta Puppeteer (incluso con stealth)
// Solución: el usuario abre Chrome con remote debugging,
// hace login manual, y nuestro backend se conecta al Chrome real
// para automatizar la cotización
// ============================================================

const COTIZADOR_URL = 'https://cotizadores.sura.com';
const DEBUG_PORT = 9222;

let browser = null;
let activePage = null;

async function connectToChrome() {
  // Conectar al Chrome real del usuario via remote debugging
  try {
    const { data } = await axios.get(`http://127.0.0.1:${DEBUG_PORT}/json/version`, { timeout: 3000 });
    const wsUrl = data.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No se encontró webSocketDebuggerUrl');

    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
    console.log('[SURA] Conectado a Chrome real');
    return browser;
  } catch (e) {
    throw new Error(
      `No se pudo conectar a Chrome. Cierre Chrome completamente y ábralo con:\n\n` +
      `  Mac: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${DEBUG_PORT}\n\n` +
      `Luego inicie sesión en cotizadores.sura.com manualmente.`
    );
  }
}

async function findCotizadorTab() {
  if (!browser || !browser.connected) return null;

  const pages = await browser.pages();
  for (const p of pages) {
    try {
      const url = p.url();
      if (url.includes('cotizadores.sura.com')) return p;
    } catch (e) { /* page closed */ }
  }
  return null;
}

async function testConnection() {
  try {
    // 1. Conectar al Chrome real
    const br = await connectToChrome();

    // 2. Buscar pestaña con cotizadores.sura.com
    const page = await findCotizadorTab();

    if (!page) {
      return {
        success: false,
        message: 'Chrome conectado pero no hay pestaña con cotizadores.sura.com abierta.\n' +
          'Abra cotizadores.sura.com en Chrome e inicie sesión, luego vuelva a probar.',
      };
    }

    const url = page.url();
    console.log(`[SURA] Pestaña encontrada: ${url}`);

    // 3. Verificar que estamos en el cotizador (no en login ni error)
    const pageInfo = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      return {
        bodyPreview: body.slice(0, 500),
        title: document.title,
        hasError: body.includes('no tiene permiso') || body.includes('Access Denied'),
      };
    });

    if (pageInfo.hasError) {
      return {
        success: false,
        message: 'La página muestra error de acceso. Verifique que su sesión esté activa en cotizadores.sura.com.',
      };
    }

    activePage = page;

    // 4. Capturar info del SPA
    const menuItems = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href], button, [role="menuitem"], nav a, .menu-item, .nav-link'))
        .map(el => ({ text: (el.textContent || '').trim().slice(0, 60), href: el.href || '' }))
        .filter(l => l.text && l.text.length > 2)
        .slice(0, 25)
    );
    console.log('[SURA] Menú del cotizador:', JSON.stringify(menuItems, null, 2));

    cache.saveSession('sura_portal', {
      loggedIn: true,
      userName: 'SURA (Chrome real)',
      loggedInAt: Date.now(),
    });

    return {
      success: true,
      message: `Conectado a cotizadores.sura.com — ${pageInfo.title}. Sesión activa.`,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function ensurePage() {
  // Verificar conexión existente
  if (activePage) {
    try {
      if (!activePage.isClosed()) {
        const url = activePage.url();
        if (url.includes('cotizadores.sura.com')) return activePage;
      }
    } catch (e) { /* disconnected */ }
    activePage = null;
  }

  // Reconectar
  try {
    await connectToChrome();
    const page = await findCotizadorTab();
    if (page) {
      activePage = page;
      return page;
    }
  } catch (e) {
    console.error('[SURA] Reconexión falló:', e.message);
  }
  return null;
}

async function getQuote(vehicleData, clientData) {
  const page = await ensurePage();

  if (!page) {
    return {
      success: false,
      error: 'Sin conexión a SURA. Abra Chrome con --remote-debugging-port=9222, ' +
        'inicie sesión en cotizadores.sura.com, y pruebe la conexión.',
      insurer: 'SURA',
    };
  }

  try {
    console.log('[SURA] Iniciando cotización...');

    // Interceptar TODAS las respuestas de API para capturar datos
    const apiResponses = [];
    const responseHandler = async (response) => {
      const url = response.url();
      if (url.includes('agw-pvp') || url.includes('apigateway') || url.includes('cotizador') ||
          url.includes('tarifa') || url.includes('prima') || url.includes('plan') ||
          url.includes('vehiculo') || url.includes('marca') || url.includes('cobertura')) {
        try {
          const text = await response.text().catch(() => '');
          if (text && text.startsWith('{') || text.startsWith('[')) {
            apiResponses.push({ url, status: response.status(), data: JSON.parse(text) });
          }
        } catch (e) { /* ignore */ }
      }
    };
    page.on('response', responseHandler);

    // Navegar al módulo de autos si no estamos ahí
    const currentUrl = page.url();
    console.log(`[SURA] URL actual: ${currentUrl}`);

    // Buscar y clickear módulo de Autos/Vehículos
    const navResult = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('a, button, span, div'));
      const found = [];
      for (const el of allEls) {
        const text = (el.textContent || '').trim().toLowerCase();
        if ((text.includes('auto') || text.includes('vehículo') || text.includes('vehiculo') || 
             text.includes('asesoría y venta')) && text.length < 40) {
          found.push({ text: el.textContent.trim(), tag: el.tagName, href: el.href || '' });
        }
      }
      return found;
    });
    console.log('[SURA] Elementos de navegación encontrados:', JSON.stringify(navResult));

    // Esperar carga
    await new Promise(r => setTimeout(r, 3000));
    page.off('response', responseHandler);

    // Capturar estado actual
    const pageTitle = await page.title();
    const pageUrl = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 1500) || '');

    // Por ahora retornamos debug info — el siguiente paso es implementar
    // el llenado del formulario de cotización de autos
    return {
      success: false,
      error: 'Conectado a cotizadores.sura.com. Cotización automática en desarrollo.',
      insurer: 'SURA',
      debug: {
        url: pageUrl,
        title: pageTitle,
        bodyPreview: bodyText.slice(0, 500),
        navElements: navResult,
        apiResponses,
      },
    };
  } catch (error) {
    console.error('[SURA] Error:', error.message);
    return { success: false, error: error.message, insurer: 'SURA' };
  }
}

async function cleanup() {
  activePage = null;
  // NO cerramos el browser — es el Chrome real del usuario
  if (browser) {
    browser.disconnect();
    browser = null;
  }
}

module.exports = { testConnection, getQuote, cleanup };
