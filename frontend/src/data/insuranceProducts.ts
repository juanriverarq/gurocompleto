// Definiciones compartidas de productos y campos de cotización
// Reutilizable por el panel de creación de enlaces y por la vista pública de formularios

import { AUTO_BRANDS_CO, MOTO_BRANDS_CO } from './brandsCO';

export interface ProductDef {
  value: string;
  label: string;
  icon: string;
  color: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select';
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
}

export const INSURANCE_PRODUCTS: ProductDef[] = [
  { value: 'autos', label: 'Seguro de Autos', icon: 'solar:car-bold-duotone', color: 'text-blue-500' },
  { value: 'salud', label: 'Seguro de Salud', icon: 'solar:heart-pulse-2-bold-duotone', color: 'text-pink-500' },
  { value: 'hogar', label: 'Seguro Hogar', icon: 'solar:home-bold-duotone', color: 'text-green-500' },
  { value: 'mascotas', label: 'Seguro de Mascotas', icon: 'solar:paw-bold-duotone', color: 'text-amber-500' },
  { value: 'motos', label: 'Seguro de Motos', icon: 'solar:scooter-bold-duotone', color: 'text-indigo-500' },
  { value: 'transporte-mercancias', label: 'Seguro de Transporte de Mercancías', icon: 'solar:box-bold-duotone', color: 'text-purple-500' },
  { value: 'viaje', label: 'Seguro de Viaje', icon: 'solar:airbuds-case-minimalistic-bold-duotone', color: 'text-cyan-500' },
  { value: 'vida', label: 'Seguro de Vida', icon: 'solar:heart-bold-duotone', color: 'text-red-500' },
  { value: 'vida-grupo', label: 'Seguro de Vida Grupo', icon: 'solar:users-group-two-rounded-bold-duotone', color: 'text-teal-500' },
];

const CURRENT_YEAR = new Date().getFullYear();

export const COMMON_FIELDS: FieldDef[] = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true },
  { key: 'telefono', label: 'Teléfono', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: false },
];

export const FIELDS_BY_TIPO: Record<string, FieldDef[]> = {
  autos: [
    { key: 'marca', label: 'Marca', type: 'select', options: AUTO_BRANDS_CO, required: true },
    { key: 'linea', label: 'Línea', type: 'text', required: true },
    { key: 'modelo', label: 'Modelo', type: 'number', min: 1980, max: CURRENT_YEAR, required: true },
    { key: 'placa', label: 'Placa', type: 'text', required: false },
    { key: 'uso', label: 'Uso', type: 'select', options: ['particular', 'publico', 'carga'], required: true },
    { key: 'ciudad', label: 'Ciudad', type: 'text', required: true },
    ...COMMON_FIELDS,
  ],
  motos: [
    { key: 'marca', label: 'Marca', type: 'select', options: MOTO_BRANDS_CO, required: true },
    { key: 'cilindraje', label: 'Cilindraje', type: 'select', options: ['110cc','125cc','150cc','200cc','250cc','300cc','400cc','600cc','1000cc'], required: true },
    { key: 'modelo', label: 'Modelo', type: 'number', min: 1990, max: CURRENT_YEAR, required: true },
    ...COMMON_FIELDS,
  ],
  salud: [
    { key: 'edad', label: 'Edad', type: 'number', min: 0, max: 120, required: true },
    { key: 'plan', label: 'Plan', type: 'select,', options: ['individual','familiar','empresarial'], required: true } as unknown as FieldDef,
    ...COMMON_FIELDS,
  ],
  hogar: [
    { key: 'tipo_inmueble', label: 'Tipo de inmueble', type: 'select', options: ['casa','apartamento'], required: true },
    { key: 'valor_asegurar', label: 'Valor a asegurar', type: 'number', required: true },
    { key: 'ciudad', label: 'Ciudad', type: 'text', required: true },
    ...COMMON_FIELDS,
  ],
  mascotas: [
    { key: 'especie', label: 'Especie', type: 'select', options: ['perro','gato'], required: true },
    { key: 'raza', label: 'Raza', type: 'text', required: false },
    { key: 'edad_mascota', label: 'Edad', type: 'number', min: 0, max: 30, required: true },
    ...COMMON_FIELDS,
  ],
  'transporte-mercancias': [
    { key: 'tipo_mercancia', label: 'Tipo de mercancía', type: 'text', required: true },
    { key: 'valor', label: 'Valor', type: 'number', required: true },
    { key: 'origen', label: 'Origen', type: 'text', required: true },
    { key: 'destino', label: 'Destino', type: 'text', required: true },
    ...COMMON_FIELDS,
  ],
  viaje: [
    { key: 'destino', label: 'Destino', type: 'text', required: true },
    { key: 'fecha_inicio', label: 'Fecha inicio', type: 'date', required: true },
    { key: 'fecha_fin', label: 'Fecha fin', type: 'date', required: true },
    { key: 'viajeros', label: 'Número de viajeros', type: 'number', min: 1, max: 50, required: true },
    ...COMMON_FIELDS,
  ],
  vida: [
    { key: 'edad', label: 'Edad', type: 'number', min: 18, max: 80, required: true },
    { key: 'suma_asegurada', label: 'Suma asegurada', type: 'number', required: true },
    ...COMMON_FIELDS,
  ],
  'vida-grupo': [
    { key: 'num_asegurados', label: 'Número de asegurados', type: 'number', min: 2, max: 500, required: true },
    { key: 'actividad', label: 'Actividad económica', type: 'text', required: true },
    ...COMMON_FIELDS,
  ],
};

export const getProductDef = (tipo: string): ProductDef | undefined =>
  INSURANCE_PRODUCTS.find((p) => p.value === tipo);