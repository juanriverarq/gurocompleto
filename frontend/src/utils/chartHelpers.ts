/**
 * Utilidades para limpiar datos de gráficas y prevenir errores NaN
 */

/**
 * Limpia un valor numérico para evitar NaN
 * @param value - El valor a limpiar
 * @param defaultValue - El valor por defecto si es NaN
 * @returns El valor limpio
 */
export const cleanNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined) return defaultValue;
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Limpia un array de datos para gráficas
 * @param data - Array de datos
 * @param defaultValue - Valor por defecto para elementos inválidos
 * @returns Array limpio
 */
export const cleanChartData = (data: any[], defaultValue: number = 0): number[] => {
  if (!Array.isArray(data)) return [];
  return data.map(item => cleanNumber(item, defaultValue));
};

/**
 * Limpia datos de series para ApexCharts
 * @param series - Array de series
 * @returns Series limpias
 */
export const cleanApexSeries = (series: any[]): any[] => {
  if (!Array.isArray(series)) return [];
  
  return series.map(serie => ({
    ...serie,
    data: cleanChartData(serie.data || [])
  }));
};

/**
 * Limpia categorías para gráficas
 * @param categories - Array de categorías
 * @returns Categorías limpias
 */
export const cleanCategories = (categories: any[]): string[] => {
  if (!Array.isArray(categories)) return [];
  return categories.map(cat => cat?.toString() || '');
};

/**
 * Valida si los datos están listos para una gráfica
 * @param data - Datos a validar
 * @returns true si los datos son válidos
 */
export const isChartDataValid = (data: any): boolean => {
  if (!data) return false;
  if (Array.isArray(data)) {
    return data.length > 0 && data.every(item => !isNaN(cleanNumber(item)));
  }
  return !isNaN(cleanNumber(data));
};

/**
 * Formatea datos para gráficas de barras/columnas
 * @param data - Datos originales
 * @param labelKey - Clave para etiquetas
 * @param valueKey - Clave para valores
 * @returns Datos formateados
 */
export const formatBarChartData = (
  data: any[], 
  labelKey: string = 'name', 
  valueKey: string = 'value'
): { categories: string[]; series: number[] } => {
  if (!Array.isArray(data)) {
    return { categories: [], series: [] };
  }

  const categories = data.map(item => item[labelKey]?.toString() || '');
  const series = data.map(item => cleanNumber(item[valueKey]));

  return { categories, series };
};

/**
 * Formatea datos para gráficas circulares
 * @param data - Datos originales
 * @param labelKey - Clave para etiquetas
 * @param valueKey - Clave para valores
 * @returns Datos formateados
 */
export const formatPieChartData = (
  data: any[], 
  labelKey: string = 'name', 
  valueKey: string = 'value'
): { labels: string[]; series: number[] } => {
  if (!Array.isArray(data)) {
    return { labels: [], series: [] };
  }

  const labels = data.map(item => item[labelKey]?.toString() || '');
  const series = data.map(item => cleanNumber(item[valueKey]));

  return { labels, series };
};

/**
 * Crea datos por defecto para cuando no hay información
 * @param type - Tipo de gráfica
 * @returns Datos por defecto
 */
export const getDefaultChartData = (type: 'bar' | 'pie' | 'line' | 'area') => {
  const defaultMessage = 'Sin datos';
  
  switch (type) {
    case 'bar':
      return {
        categories: [defaultMessage],
        series: [0]
      };
    case 'pie':
      return {
        labels: [defaultMessage],
        series: [1]
      };
    case 'line':
    case 'area':
      return {
        series: [{
          name: defaultMessage,
          data: [0]
        }],
        categories: [defaultMessage]
      };
    default:
      return {
        series: [0],
        categories: [defaultMessage]
      };
  }
};

/**
 * Valida y limpia opciones de ApexCharts
 * @param options - Opciones originales
 * @returns Opciones limpias
 */
export const cleanApexOptions = (options: any): any => {
  if (!options) return {};
  
  const cleanOptions = { ...options };
  
  // Limpiar xaxis si existe
  if (cleanOptions.xaxis?.categories) {
    cleanOptions.xaxis.categories = cleanCategories(cleanOptions.xaxis.categories);
  }
  
  // Limpiar yaxis si existe
  if (cleanOptions.yaxis?.min !== undefined) {
    cleanOptions.yaxis.min = cleanNumber(cleanOptions.yaxis.min);
  }
  if (cleanOptions.yaxis?.max !== undefined) {
    cleanOptions.yaxis.max = cleanNumber(cleanOptions.yaxis.max);
  }
  
  return cleanOptions;
};
