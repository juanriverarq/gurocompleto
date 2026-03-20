// ============================================================
// Base de datos FASECOLDA local — Vehículos colombianos
// Datos de referencia para el cotizador (sin depender de APIs externas)
// En producción se podría cargar desde un CSV/JSON actualizado
// ============================================================

const VEHICLES = [
  // CHEVROLET
  { code: '04411', brand: 'CHEVROLET', line: 'SPARK GT 1.2 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1200', price: 52900000 },
  { code: '04411', brand: 'CHEVROLET', line: 'SPARK GT 1.2 MT', model: 2023, type: 'AUTOMOVIL', cylinder: '1200', price: 48500000 },
  { code: '04412', brand: 'CHEVROLET', line: 'SPARK GT 1.2 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1200', price: 57900000 },
  { code: '04415', brand: 'CHEVROLET', line: 'ONIX 1.2 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1200', price: 62900000 },
  { code: '04416', brand: 'CHEVROLET', line: 'ONIX 1.2 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1200', price: 67900000 },
  { code: '04420', brand: 'CHEVROLET', line: 'ONIX TURBO RS AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1000', price: 79900000 },
  { code: '04440', brand: 'CHEVROLET', line: 'TRACKER 1.2 TURBO MT', model: 2024, type: 'CAMIONETA', cylinder: '1200', price: 89900000 },
  { code: '04441', brand: 'CHEVROLET', line: 'TRACKER 1.2 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1200', price: 99900000 },
  { code: '04450', brand: 'CHEVROLET', line: 'CAPTIVA 1.5 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 119900000 },
  { code: '04460', brand: 'CHEVROLET', line: 'TRAVERSE 3.6 AT', model: 2024, type: 'CAMIONETA', cylinder: '3600', price: 199900000 },
  { code: '04470', brand: 'CHEVROLET', line: 'TAHOE 5.3 AT', model: 2024, type: 'CAMIONETA', cylinder: '5300', price: 349900000 },
  { code: '04480', brand: 'CHEVROLET', line: 'COLORADO 2.8 TD MT 4X4', model: 2024, type: 'PICK-UP', cylinder: '2800', price: 169900000 },
  { code: '04481', brand: 'CHEVROLET', line: 'COLORADO 2.8 TD AT 4X4', model: 2024, type: 'PICK-UP', cylinder: '2800', price: 189900000 },
  // RENAULT
  { code: '08200', brand: 'RENAULT', line: 'KWID ZEN 1.0 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1000', price: 47900000 },
  { code: '08201', brand: 'RENAULT', line: 'KWID OUTSIDER 1.0 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1000', price: 52900000 },
  { code: '08210', brand: 'RENAULT', line: 'SANDERO ZEN 1.6 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1600', price: 57900000 },
  { code: '08215', brand: 'RENAULT', line: 'STEPWAY ZEN 1.6 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1600', price: 65900000 },
  { code: '08220', brand: 'RENAULT', line: 'DUSTER ZEN 1.6 MT', model: 2024, type: 'CAMIONETA', cylinder: '1600', price: 79900000 },
  { code: '08221', brand: 'RENAULT', line: 'DUSTER INTENS 1.3 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1300', price: 99900000 },
  { code: '08230', brand: 'RENAULT', line: 'KOLEOS ZEN 2.5 AT', model: 2024, type: 'CAMIONETA', cylinder: '2500', price: 129900000 },
  { code: '08240', brand: 'RENAULT', line: 'LOGAN ZEN 1.6 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1600', price: 55900000 },
  // KIA
  { code: '12100', brand: 'KIA', line: 'PICANTO 1.0 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1000', price: 52900000 },
  { code: '12101', brand: 'KIA', line: 'PICANTO 1.2 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1200', price: 59900000 },
  { code: '12110', brand: 'KIA', line: 'RIO 1.4 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1400', price: 65900000 },
  { code: '12111', brand: 'KIA', line: 'RIO 1.4 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1400', price: 72900000 },
  { code: '12120', brand: 'KIA', line: 'SPORTAGE 2.0 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 129900000 },
  { code: '12121', brand: 'KIA', line: 'SPORTAGE 2.0 AT 4X4', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 149900000 },
  { code: '12130', brand: 'KIA', line: 'SORENTO 2.5 AT', model: 2024, type: 'CAMIONETA', cylinder: '2500', price: 179900000 },
  { code: '12140', brand: 'KIA', line: 'SELTOS 1.6 AT', model: 2024, type: 'CAMIONETA', cylinder: '1600', price: 99900000 },
  { code: '12150', brand: 'KIA', line: 'CERATO 2.0 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '2000', price: 89900000 },
  // HYUNDAI
  { code: '15100', brand: 'HYUNDAI', line: 'GRAND I10 1.2 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1200', price: 55900000 },
  { code: '15101', brand: 'HYUNDAI', line: 'GRAND I10 1.2 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1200', price: 62900000 },
  { code: '15110', brand: 'HYUNDAI', line: 'ACCENT 1.6 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1600', price: 69900000 },
  { code: '15120', brand: 'HYUNDAI', line: 'CRETA 1.6 AT', model: 2024, type: 'CAMIONETA', cylinder: '1600', price: 99900000 },
  { code: '15121', brand: 'HYUNDAI', line: 'CRETA 1.5 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 119900000 },
  { code: '15130', brand: 'HYUNDAI', line: 'TUCSON 2.0 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 139900000 },
  { code: '15131', brand: 'HYUNDAI', line: 'TUCSON HYBRID AT', model: 2024, type: 'CAMIONETA', cylinder: '1600', price: 169900000 },
  { code: '15140', brand: 'HYUNDAI', line: 'SANTA FE 2.5 AT', model: 2024, type: 'CAMIONETA', cylinder: '2500', price: 189900000 },
  // MAZDA
  { code: '18100', brand: 'MAZDA', line: 'MAZDA 2 1.5 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1500', price: 69900000 },
  { code: '18101', brand: 'MAZDA', line: 'MAZDA 2 1.5 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1500', price: 76900000 },
  { code: '18110', brand: 'MAZDA', line: 'MAZDA 3 2.0 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '2000', price: 99900000 },
  { code: '18120', brand: 'MAZDA', line: 'CX-30 2.0 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 109900000 },
  { code: '18130', brand: 'MAZDA', line: 'CX-5 2.0 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 139900000 },
  { code: '18131', brand: 'MAZDA', line: 'CX-5 2.5 AT TURBO', model: 2024, type: 'CAMIONETA', cylinder: '2500', price: 179900000 },
  // TOYOTA
  { code: '20100', brand: 'TOYOTA', line: 'YARIS 1.5 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1500', price: 72900000 },
  { code: '20110', brand: 'TOYOTA', line: 'COROLLA 2.0 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '2000', price: 109900000 },
  { code: '20111', brand: 'TOYOTA', line: 'COROLLA CROSS 2.0 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 129900000 },
  { code: '20112', brand: 'TOYOTA', line: 'COROLLA CROSS HYBRID AT', model: 2024, type: 'CAMIONETA', cylinder: '1800', price: 149900000 },
  { code: '20120', brand: 'TOYOTA', line: 'RAV4 2.5 AT', model: 2024, type: 'CAMIONETA', cylinder: '2500', price: 169900000 },
  { code: '20130', brand: 'TOYOTA', line: 'FORTUNER 2.7 AT', model: 2024, type: 'CAMIONETA', cylinder: '2700', price: 189900000 },
  { code: '20131', brand: 'TOYOTA', line: 'FORTUNER 2.8 TD AT 4X4', model: 2024, type: 'CAMIONETA', cylinder: '2800', price: 229900000 },
  { code: '20140', brand: 'TOYOTA', line: 'HILUX 2.4 TD MT 4X4', model: 2024, type: 'PICK-UP', cylinder: '2400', price: 159900000 },
  { code: '20141', brand: 'TOYOTA', line: 'HILUX 2.8 TD AT 4X4', model: 2024, type: 'PICK-UP', cylinder: '2800', price: 199900000 },
  // NISSAN
  { code: '22100', brand: 'NISSAN', line: 'MARCH 1.6 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1600', price: 55900000 },
  { code: '22110', brand: 'NISSAN', line: 'VERSA 1.6 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1600', price: 69900000 },
  { code: '22120', brand: 'NISSAN', line: 'KICKS 1.6 AT', model: 2024, type: 'CAMIONETA', cylinder: '1600', price: 99900000 },
  { code: '22130', brand: 'NISSAN', line: 'QASHQAI 2.0 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 129900000 },
  { code: '22140', brand: 'NISSAN', line: 'X-TRAIL 2.5 AT', model: 2024, type: 'CAMIONETA', cylinder: '2500', price: 149900000 },
  { code: '22150', brand: 'NISSAN', line: 'FRONTIER 2.5 TD MT 4X4', model: 2024, type: 'PICK-UP', cylinder: '2500', price: 159900000 },
  // SUZUKI
  { code: '24100', brand: 'SUZUKI', line: 'SWIFT 1.2 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1200', price: 59900000 },
  { code: '24110', brand: 'SUZUKI', line: 'VITARA 1.4 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1400', price: 99900000 },
  { code: '24120', brand: 'SUZUKI', line: 'JIMNY 1.5 MT 4X4', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 99900000 },
  { code: '24130', brand: 'SUZUKI', line: 'S-PRESSO 1.0 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1000', price: 44900000 },
  // VOLKSWAGEN
  { code: '26100', brand: 'VOLKSWAGEN', line: 'GOL 1.6 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1600', price: 59900000 },
  { code: '26110', brand: 'VOLKSWAGEN', line: 'T-CROSS 1.0 TSI AT', model: 2024, type: 'CAMIONETA', cylinder: '1000', price: 99900000 },
  { code: '26120', brand: 'VOLKSWAGEN', line: 'TAOS 1.4 TSI AT', model: 2024, type: 'CAMIONETA', cylinder: '1400', price: 129900000 },
  { code: '26130', brand: 'VOLKSWAGEN', line: 'TIGUAN 2.0 TSI AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 169900000 },
  { code: '26140', brand: 'VOLKSWAGEN', line: 'AMAROK 2.0 TDI AT 4X4', model: 2024, type: 'PICK-UP', cylinder: '2000', price: 179900000 },
  // FORD
  { code: '28100', brand: 'FORD', line: 'TERRITORY 1.5 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 109900000 },
  { code: '28110', brand: 'FORD', line: 'BRONCO SPORT 1.5 AT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 139900000 },
  { code: '28120', brand: 'FORD', line: 'RANGER 2.0 TD AT 4X4', model: 2024, type: 'PICK-UP', cylinder: '2000', price: 189900000 },
  // SUBARU
  { code: '30100', brand: 'SUBARU', line: 'IMPREZA 2.0 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '2000', price: 109900000 },
  { code: '30110', brand: 'SUBARU', line: 'FORESTER 2.0 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 149900000 },
  { code: '30120', brand: 'SUBARU', line: 'OUTBACK 2.5 AT', model: 2024, type: 'CAMIONETA', cylinder: '2500', price: 169900000 },
  // BMW
  { code: '40100', brand: 'BMW', line: 'SERIE 1 118i AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1500', price: 159900000 },
  { code: '40110', brand: 'BMW', line: 'SERIE 3 320i AT', model: 2024, type: 'AUTOMOVIL', cylinder: '2000', price: 219900000 },
  { code: '40120', brand: 'BMW', line: 'X1 SDRIVE18i AT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 199900000 },
  { code: '40130', brand: 'BMW', line: 'X3 SDRIVE20i AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 279900000 },
  // MERCEDES-BENZ
  { code: '42100', brand: 'MERCEDES-BENZ', line: 'A 200 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1300', price: 179900000 },
  { code: '42110', brand: 'MERCEDES-BENZ', line: 'C 200 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1500', price: 249900000 },
  { code: '42120', brand: 'MERCEDES-BENZ', line: 'GLA 200 AT', model: 2024, type: 'CAMIONETA', cylinder: '1300', price: 219900000 },
  { code: '42130', brand: 'MERCEDES-BENZ', line: 'GLC 300 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 319900000 },
  // AUDI
  { code: '44100', brand: 'AUDI', line: 'A3 1.4 TFSI AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1400', price: 169900000 },
  { code: '44110', brand: 'AUDI', line: 'Q3 1.4 TFSI AT', model: 2024, type: 'CAMIONETA', cylinder: '1400', price: 199900000 },
  { code: '44120', brand: 'AUDI', line: 'Q5 2.0 TFSI AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 289900000 },
  // MG
  { code: '46100', brand: 'MG', line: 'MG5 1.5 MT', model: 2024, type: 'AUTOMOVIL', cylinder: '1500', price: 59900000 },
  { code: '46110', brand: 'MG', line: 'ZS 1.5 MT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 72900000 },
  { code: '46120', brand: 'MG', line: 'HS 1.5 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 99900000 },
  // CHERY
  { code: '48100', brand: 'CHERY', line: 'TIGGO 2 1.5 MT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 62900000 },
  { code: '48110', brand: 'CHERY', line: 'TIGGO 4 PRO 1.5 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 89900000 },
  { code: '48120', brand: 'CHERY', line: 'TIGGO 8 PRO 1.6 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1600', price: 129900000 },
  // JAC
  { code: '50100', brand: 'JAC', line: 'JS2 1.5 MT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 59900000 },
  { code: '50110', brand: 'JAC', line: 'JS4 1.5 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1500', price: 79900000 },
  // PEUGEOT
  { code: '52100', brand: 'PEUGEOT', line: '208 ACTIVE 1.6 AT', model: 2024, type: 'AUTOMOVIL', cylinder: '1600', price: 79900000 },
  { code: '52110', brand: 'PEUGEOT', line: '2008 ACTIVE 1.6 AT', model: 2024, type: 'CAMIONETA', cylinder: '1600', price: 99900000 },
  // FIAT
  { code: '54100', brand: 'FIAT', line: 'PULSE DRIVE 1.3 MT', model: 2024, type: 'CAMIONETA', cylinder: '1300', price: 74900000 },
  { code: '54110', brand: 'FIAT', line: 'FASTBACK 1.3 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1300', price: 99900000 },
  // VOLVO
  { code: '56100', brand: 'VOLVO', line: 'XC40 T4 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 199900000 },
  { code: '56110', brand: 'VOLVO', line: 'XC60 T5 AT', model: 2024, type: 'CAMIONETA', cylinder: '2000', price: 279900000 },
  // JEEP
  { code: '58100', brand: 'JEEP', line: 'RENEGADE 1.3 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1300', price: 109900000 },
  { code: '58110', brand: 'JEEP', line: 'COMPASS 1.3 TURBO AT', model: 2024, type: 'CAMIONETA', cylinder: '1300', price: 149900000 },
  { code: '58120', brand: 'JEEP', line: 'GRAND CHEROKEE 3.6 AT', model: 2024, type: 'CAMIONETA', cylinder: '3600', price: 289900000 },
  // BYD (eléctricos)
  { code: '60100', brand: 'BYD', line: 'DOLPHIN MINI EV', model: 2024, type: 'AUTOMOVIL', cylinder: '0', price: 79900000 },
  { code: '60110', brand: 'BYD', line: 'YUAN PLUS EV', model: 2024, type: 'CAMIONETA', cylinder: '0', price: 139900000 },
  { code: '60120', brand: 'BYD', line: 'SEAL EV', model: 2024, type: 'AUTOMOVIL', cylinder: '0', price: 199900000 },
];

const CITIES = [
  'BOGOTA', 'MEDELLIN', 'CALI', 'BARRANQUILLA', 'CARTAGENA', 'BUCARAMANGA',
  'PEREIRA', 'MANIZALES', 'CUCUTA', 'IBAGUE', 'SANTA MARTA', 'VILLAVICENCIO',
  'PASTO', 'NEIVA', 'ARMENIA', 'POPAYAN', 'MONTERIA', 'VALLEDUPAR',
  'TUNJA', 'FLORENCIA', 'SINCELEJO', 'RIOHACHA', 'QUIBDO',
];

function getBrands() {
  const brands = [...new Set(VEHICLES.map(v => v.brand))].sort();
  return brands;
}

function getLines(brand) {
  const lines = [...new Set(VEHICLES.filter(v => v.brand === brand).map(v => v.line))].sort();
  return lines;
}

function getModels(brand, line) {
  const models = [...new Set(VEHICLES.filter(v => v.brand === brand && v.line === line).map(v => v.model))].sort((a, b) => b - a);
  return models;
}

function search(brand, line, model) {
  let results = VEHICLES.filter(v => v.brand === brand);
  if (line) results = results.filter(v => v.line.toLowerCase().includes(line.toLowerCase()));
  if (model) results = results.filter(v => v.model === model);
  return results;
}

function getByCode(code, model) {
  return VEHICLES.filter(v => v.code === code && (!model || v.model === model));
}

function getCities() {
  return CITIES;
}

module.exports = { getBrands, getLines, getModels, search, getByCode, getCities, VEHICLES };
