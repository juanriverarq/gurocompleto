import { Cliente } from './clienteService';

// Tipos para segmentos
export interface SegmentFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty';
  value: any;
  value2?: any; // Para operador 'between'
}

export interface ClientSegment {
  id?: number;
  name: string;
  description?: string;
  filters: SegmentFilter[];
  color?: string;
  created_at?: string;
  updated_at?: string;
  client_count?: number;
}

export interface SegmentField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: Array<{ value: any; label: string }>;
}

// Campos disponibles para segmentación
const SEGMENT_FIELDS: SegmentField[] = [
  { key: 'nombre', label: 'Nombre', type: 'text' },
  { key: 'apellidos', label: 'Apellidos', type: 'text' },
  { key: 'email_principal', label: 'Email Principal', type: 'text' },
  { key: 'celular_principal', label: 'Celular Principal', type: 'text' },
  { key: 'ciudad', label: 'Ciudad', type: 'text' },
  { key: 'ocupacion', label: 'Ocupación', type: 'text' },
  { key: 'estado', label: 'Estado', type: 'select', options: [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
    { value: 'prospect', label: 'Prospecto' },
    { value: 'suspended', label: 'Suspendido' }
  ]},
  { key: 'tipo_cliente', label: 'Tipo de Cliente', type: 'select', options: [
    { value: 'individual', label: 'Individual' },
    { value: 'empresa', label: 'Empresa' },
    { value: 'premium', label: 'Premium' },
    { value: 'vip', label: 'VIP' }
  ]},
  { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento', type: 'date' },
  { key: 'created_at', label: 'Fecha de Registro', type: 'date' },
  { key: 'updated_at', label: 'Última Actualización', type: 'date' }
];

// Operadores disponibles por tipo de campo
const OPERATORS_BY_TYPE = {
  text: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'not_equals', label: 'No es igual a' },
    { value: 'contains', label: 'Contiene' },
    { value: 'not_contains', label: 'No contiene' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' }
  ],
  number: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'not_equals', label: 'No es igual a' },
    { value: 'greater_than', label: 'Mayor que' },
    { value: 'less_than', label: 'Menor que' },
    { value: 'between', label: 'Entre' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' }
  ],
  date: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'not_equals', label: 'No es igual a' },
    { value: 'greater_than', label: 'Después de' },
    { value: 'less_than', label: 'Antes de' },
    { value: 'between', label: 'Entre' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' }
  ],
  select: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'not_equals', label: 'No es igual a' },
    { value: 'in', label: 'Es uno de' },
    { value: 'not_in', label: 'No es uno de' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' }
  ],
  boolean: [
    { value: 'equals', label: 'Es' }
  ]
};

// Colores predefinidos para segmentos
const SEGMENT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280'  // Gray
];

class ClientSegmentService {
  private segments: ClientSegment[] = [];

  /**
   * Obtiene todos los segmentos
   */
  async getSegments(): Promise<ClientSegment[]> {
    
    
    // TODO: Implementar llamada real a la API
    return this.segments;
  }

  /**
   * Crea un nuevo segmento
   */
  async createSegment(segment: Omit<ClientSegment, 'id' | 'created_at' | 'updated_at'>): Promise<ClientSegment> {
    const newSegment: ClientSegment = {
      ...segment,
      id: Date.now(), // Mock ID
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      color: segment.color || this.getRandomColor()
    };

    this.segments.push(newSegment);
    return newSegment;
  }

  /**
   * Actualiza un segmento existente
   */
  async updateSegment(id: number, updates: Partial<ClientSegment>): Promise<ClientSegment> {
    const index = this.segments.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error('Segmento no encontrado');
    }

    this.segments[index] = {
      ...this.segments[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    return this.segments[index];
  }

  /**
   * Elimina un segmento
   */
  async deleteSegment(id: number): Promise<void> {
    const index = this.segments.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error('Segmento no encontrado');
    }

    this.segments.splice(index, 1);
  }

  /**
   * Aplica filtros de segmento a una lista de clientes
   */
  applySegmentFilters(clients: Cliente[], filters: SegmentFilter[]): Cliente[] {
    return clients.filter(client => {
      return filters.every(filter => this.evaluateFilter(client, filter));
    });
  }

  /**
   * Evalúa un filtro individual contra un cliente
   */
  private evaluateFilter(client: Cliente, filter: SegmentFilter): boolean {
    const fieldValue = this.getFieldValue(client, filter.field);
    
    switch (filter.operator) {
      case 'equals':
        return fieldValue === filter.value;
      
      case 'not_equals':
        return fieldValue !== filter.value;
      
      case 'contains':
        return String(fieldValue || '').toLowerCase().includes(String(filter.value || '').toLowerCase());
      
      case 'not_contains':
        return !String(fieldValue || '').toLowerCase().includes(String(filter.value || '').toLowerCase());
      
      case 'greater_than':
        if (this.isDate(fieldValue) && this.isDate(filter.value)) {
          return new Date(fieldValue) > new Date(filter.value);
        }
        return Number(fieldValue) > Number(filter.value);
      
      case 'less_than':
        if (this.isDate(fieldValue) && this.isDate(filter.value)) {
          return new Date(fieldValue) < new Date(filter.value);
        }
        return Number(fieldValue) < Number(filter.value);
      
      case 'between':
        if (this.isDate(fieldValue)) {
          const date = new Date(fieldValue);
          return date >= new Date(filter.value) && date <= new Date(filter.value2);
        }
        const num = Number(fieldValue);
        return num >= Number(filter.value) && num <= Number(filter.value2);
      
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      
      case 'not_in':
        return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
      
      case 'is_empty':
        return !fieldValue || fieldValue === '' || fieldValue === null || fieldValue === undefined;
      
      case 'is_not_empty':
        return fieldValue && fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
      
      default:
        return true;
    }
  }

  /**
   * Obtiene el valor de un campo de un cliente
   */
  private getFieldValue(client: Cliente, field: string): any {
    return (client as any)[field];
  }

  /**
   * Verifica si un valor es una fecha
   */
  private isDate(value: any): boolean {
    return value && !isNaN(Date.parse(value));
  }

  /**
   * Obtiene un color aleatorio para el segmento
   */
  private getRandomColor(): string {
    return SEGMENT_COLORS[Math.floor(Math.random() * SEGMENT_COLORS.length)];
  }

  /**
   * Obtiene los campos disponibles para segmentación
   */
  getAvailableFields(): SegmentField[] {
    return SEGMENT_FIELDS;
  }

  /**
   * Obtiene los operadores disponibles para un tipo de campo
   */
  getOperatorsForFieldType(fieldType: string): Array<{ value: string; label: string }> {
    return OPERATORS_BY_TYPE[fieldType as keyof typeof OPERATORS_BY_TYPE] || [];
  }

  /**
   * Obtiene los colores disponibles para segmentos
   */
  getAvailableColors(): string[] {
    return SEGMENT_COLORS;
  }

  /**
   * Valida un segmento antes de guardarlo
   */
  validateSegment(segment: Partial<ClientSegment>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!segment.name || segment.name.trim().length === 0) {
      errors.push('El nombre del segmento es requerido');
    }

    if (segment.name && segment.name.length > 100) {
      errors.push('El nombre del segmento no puede exceder 100 caracteres');
    }

    if (!segment.filters || segment.filters.length === 0) {
      errors.push('Debe agregar al menos un filtro');
    }

    if (segment.filters) {
      segment.filters.forEach((filter, index) => {
        if (!filter.field) {
          errors.push(`Filtro ${index + 1}: Debe seleccionar un campo`);
        }
        if (!filter.operator) {
          errors.push(`Filtro ${index + 1}: Debe seleccionar un operador`);
        }
        if (filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && !filter.value) {
          errors.push(`Filtro ${index + 1}: Debe especificar un valor`);
        }
        if (filter.operator === 'between' && !filter.value2) {
          errors.push(`Filtro ${index + 1}: Debe especificar el segundo valor para el rango`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Cuenta cuántos clientes coinciden con un segmento
   */
  countClientsInSegment(clients: Cliente[], segment: ClientSegment): number {
    return this.applySegmentFilters(clients, segment.filters).length;
  }

  
}

export const clientSegmentService = new ClientSegmentService();
export default clientSegmentService;