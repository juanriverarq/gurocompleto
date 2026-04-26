/**
 * Mapeo de códigos de ramo por aseguradora a nombres legibles.
 *
 * Cada aseguradora usa sus propios códigos. El mapeo se usa en las pantallas
 * de comisiones y cartera para mostrar nombres en vez de códigos crudos.
 *
 * Fuente:
 * - SURA: códigos 3-dígitos extraídos de las respuestas de /sura/comisiones,
 *   /sura/cartera y /sura/polizas. Ver `suraGuessRamoFromName` en
 *   `backend/app/Services/InsurerSyncService.php` para la convención inversa.
 */

type RamoMap = Record<string, string>;

const SURA_RAMOS: RamoMap = {
  // Cumplimiento / garantías
  '012': 'Cumplimiento',
  '013': 'Cumplimiento Privado',
  // Accidentes personales
  '028': 'Hogar',
  '030': 'Accidentes Personales',
  '031': 'Accidentes Personales Colectivo',
  // Autos
  '040': 'Autos Individual',
  '041': 'SOAT',
  '042': 'Autos Colectivo',
  '044': 'Motos',
  // Propiedad / incendio / sustracción
  '050': 'Incendio / Sustracción',
  '060': 'Hogar Integral',
  // Vida
  '080': 'Vida Grupo',
  '081': 'Vida Individual',
  '083': 'Vida Deudores',
  '085': 'Vida Colectivo',
  '086': 'Exequias',
  // Salud
  '090': 'Salud Individual',
  // Empresarial
  '100': 'Empresarial / PyMES',
  // ARL y RCE
  '181': 'ARL',
  '196': 'Responsabilidad Civil',
  // SOAT alternativos
  '210': 'SOAT',
};

const BOLIVAR_RAMOS: RamoMap = {
  // Bolívar puede usar códigos distintos; se irán poblando cuando aparezcan.
};

const HDI_RAMOS: RamoMap = {};
const EQUIDAD_RAMOS: RamoMap = {};
const AXA_RAMOS: RamoMap = {};
const ESTADO_RAMOS: RamoMap = {};
const MAPFRE_RAMOS: RamoMap = {};
const ALLIANZ_RAMOS: RamoMap = {};

const MAPS_BY_INSURER: Record<string, RamoMap> = {
  sura: SURA_RAMOS,
  bolivar: BOLIVAR_RAMOS,
  hdi: HDI_RAMOS,
  'la-equidad': EQUIDAD_RAMOS,
  'axa-colpatria': AXA_RAMOS,
  'seguros-del-estado': ESTADO_RAMOS,
  mapfre: MAPFRE_RAMOS,
  allianz: ALLIANZ_RAMOS,
};

/**
 * Devuelve el nombre legible del ramo dado su código y la aseguradora.
 * Si no encuentra match, retorna el código original como fallback.
 */
export function getRamoLabel(code: string | null | undefined, insurerCode: string): string {
  if (!code) return '—';
  const map = MAPS_BY_INSURER[insurerCode];
  if (map && map[code]) return map[code];
  // Fallback: intentar sin ceros a la izquierda
  const trimmed = code.replace(/^0+/, '');
  if (map && trimmed && map[trimmed]) return map[trimmed];
  return code;
}

/**
 * Versión corta del nombre (para badges angostos).
 * Ej: "Cumplimiento Privado" → "Cumplimiento"
 */
export function getRamoLabelShort(code: string | null | undefined, insurerCode: string): string {
  const full = getRamoLabel(code, insurerCode);
  if (!full || full === '—') return full;
  // Cortar en el primer separador natural
  const first = full.split(/[\/\-]/)[0].trim();
  // Si es "Algo Individual" o "Algo Colectivo", dejar el primer token
  return first.length > 18 ? first.split(' ')[0] : first;
}
