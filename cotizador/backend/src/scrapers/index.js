const suraPortal = require('./suraPortal');
const bolivarBolnet = require('./bolivarBolnet');

// ============================================================
// Registry de scrapers — mapea method ID a su implementación
// ============================================================

const scrapers = {
  sura_portal: suraPortal,
  bolivar_bolnet: bolivarBolnet,
  // Se irán agregando más:
  // allianz_portal: allianzPortal,
  // liberty_portal: libertyPortal,
  // hdi_portal: hdiPortal,
  // mapfre_portal: mapfrePortal,
};

function getScraper(methodId) {
  return scrapers[methodId] || null;
}

function getAvailableScraperIds() {
  return Object.keys(scrapers);
}

async function cleanupAll() {
  for (const scraper of Object.values(scrapers)) {
    if (scraper.cleanup) await scraper.cleanup().catch(() => {});
  }
}

module.exports = { getScraper, getAvailableScraperIds, cleanupAll };
