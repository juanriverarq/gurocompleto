const puppeteer = require('puppeteer');
const cache = require('../cache');

// ============================================================
// Bolívar Bolnet — Scraping directo del portal de intermediarios
// Login: https://www.segurosbolivar.com → Bolnet intermediarios
// ============================================================

const LOGIN_URL = 'https://aplicaciones.segurosbolivar.com/bolnet/';
const PORTAL_BASE = 'https://aplicaciones.segurosbolivar.com';

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

async function testConnection(credentials) {
  const { username, password } = credentials;
  let page = null;
  try {
    const br = await getBrowser();
    page = await br.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Esperar formulario de login
    await page.waitForSelector('input[type="text"], input[name="usuario"], #usuario', { timeout: 10000 });

    const inputs = await page.$$('input[type="text"], input[type="password"]');
    if (inputs.length >= 2) {
      await inputs[0].type(username, { delay: 50 });
      await inputs[1].type(password, { delay: 50 });
    }

    const submitBtn = await page.$('input[type="submit"], button[type="submit"], .btn-login, #btnIngresar');
    if (submitBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null),
        submitBtn.click(),
      ]);
    }

    const currentUrl = page.url();
    const cookies = await page.cookies();

    if (currentUrl.includes('bolnet') && !currentUrl.includes('login')) {
      cache.saveSession('bolivar_bolnet', {
        cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain })),
        loggedInAt: Date.now(),
      });
      return { success: true, message: 'Conexión exitosa con Bolívar Bolnet' };
    }

    const pageContent = await page.content();
    if (pageContent.includes('incorrecto') || pageContent.includes('inválid') || pageContent.includes('error')) {
      return { success: false, message: 'Credenciales incorrectas' };
    }

    return { success: false, message: `No se pudo verificar login. URL: ${currentUrl}` };
  } catch (error) {
    return { success: false, message: `Error de conexión: ${error.message}` };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function getQuote(vehicleData, clientData) {
  const session = cache.getSession('bolivar_bolnet');
  if (!session) {
    return { success: false, error: 'No hay sesión activa. Pruebe la conexión primero.', insurer: 'BOLIVAR' };
  }

  let page = null;
  try {
    const br = await getBrowser();
    page = await br.newPage();

    for (const cookie of session.cookies) {
      await page.setCookie(cookie).catch(() => {});
    }

    // Navegar al cotizador de vehículos de Bolnet
    await page.goto(`${PORTAL_BASE}/bolnet/cotizador/vehiculos`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // TODO: Completar el formulario de cotización de Bolnet
    // Por ahora retornamos placeholder
    return {
      success: false,
      error: 'Cotización Bolívar en desarrollo — se necesita mapear el formulario del portal',
      insurer: 'BOLIVAR',
    };
  } catch (error) {
    return { success: false, error: error.message, insurer: 'BOLIVAR' };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

function normalizePlans(rawData) {
  if (Array.isArray(rawData)) {
    return rawData.map(plan => ({
      name: plan.nombrePlan || plan.nombre || 'Plan Bolívar',
      premium: plan.prima || plan.valorPrima || 0,
      deductible: plan.deducible || 0,
      coverages: (plan.coberturas || []).map(c => ({
        name: c.nombre || '',
        value: c.valor || 0,
        limit: c.limite || '',
      })),
    }));
  }
  return [];
}

async function cleanup() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

module.exports = { testConnection, getQuote, cleanup };
