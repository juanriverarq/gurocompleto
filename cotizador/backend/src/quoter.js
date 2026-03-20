const cache = require('./cache');
const { getScraper } = require('./scrapers');
const crypto = require('crypto');

// ============================================================
// Quoter — Orquesta cotizaciones en paralelo a todas las
// aseguradoras activas y consolida resultados
// ============================================================

async function createQuote(vehicleData, clientData) {
  const quoteId = crypto.randomUUID();
  const activeConnections = cache.getActiveConnections();

  if (activeConnections.length === 0) {
    return {
      quoteId,
      status: 'error',
      error: 'No hay aseguradoras conectadas. Configure al menos una conexión.',
      results: [],
    };
  }

  // Guardar cotización en estado "processing"
  cache.saveQuote(quoteId, {
    status: 'processing',
    vehicle: vehicleData,
    client: clientData,
    results: [],
    totalInsurers: activeConnections.length,
    completedInsurers: 0,
  });

  // Lanzar cotizaciones en paralelo (no bloquea)
  runParallelQuotes(quoteId, activeConnections, vehicleData, clientData);

  return {
    quoteId,
    status: 'processing',
    totalInsurers: activeConnections.length,
    message: `Cotizando con ${activeConnections.length} aseguradora(s)...`,
  };
}

async function runParallelQuotes(quoteId, connections, vehicleData, clientData) {
  const promises = connections.map(async (conn) => {
    const scraper = getScraper(conn.methodId);
    if (!scraper) {
      return {
        methodId: conn.methodId,
        success: false,
        error: `Scraper no implementado para ${conn.methodId}`,
        insurer: conn.insurer_name || conn.methodId,
      };
    }
    try {
      const result = await scraper.getQuote(vehicleData, clientData);
      return { methodId: conn.methodId, ...result };
    } catch (error) {
      return {
        methodId: conn.methodId,
        success: false,
        error: error.message,
        insurer: conn.insurer_name || conn.methodId,
      };
    }
  });

  const results = await Promise.allSettled(promises);
  const processedResults = results.map(r =>
    r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message || 'Error desconocido' }
  );

  // Actualizar la cotización con los resultados
  const quote = cache.getQuote(quoteId);
  if (quote) {
    cache.saveQuote(quoteId, {
      ...quote,
      status: 'completed',
      results: processedResults,
      completedInsurers: processedResults.length,
      completedAt: Date.now(),
    });
  }
}

function getQuoteStatus(quoteId) {
  return cache.getQuote(quoteId);
}

module.exports = { createQuote, getQuoteStatus };
