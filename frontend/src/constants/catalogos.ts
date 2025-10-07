// Catálogos centralizados para selects (pueden ser reemplazados por endpoints en el futuro)

export const TIPOS_CLIENTE = [
  { value: 'persona', label: 'Persona' },
  { value: 'empresa', label: 'Empresa' },
];

// Nota: mantenemos los mismos valores usados actualmente en filtros/creación para evitar inconsistencias
export const TIPOS_DOCUMENTO = [
  { value: 'CC', label: 'Cédula de ciudadanía (CC)' },
  { value: 'CE', label: 'Cédula de extranjería (CE)' },
  { value: 'NIT', label: 'NIT' },
  { value: 'TI', label: 'Tarjeta de identidad (TI)' },
  { value: 'PA', label: 'Pasaporte (PA)' },
];

export const GENEROS = [
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Femenino', label: 'Femenino' },
];

// Estados de cliente unificados para filtros y visualización
// Valores: 'activo' | 'inactivo' | 'prospecto'
export const ESTADOS_CLIENTE = [
  { value: 'activo', label: 'Activo', color: 'success' },
  { value: 'inactivo', label: 'Inactivo', color: 'gray' },
  { value: 'prospecto', label: 'Prospecto', color: 'warning' },
  { value: 'bloqueado', label: 'Bloqueado', color: 'error' },
];
