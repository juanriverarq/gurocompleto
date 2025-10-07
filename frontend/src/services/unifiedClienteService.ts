import { saasApi } from './saasApi';
import { ClienteSaaS, ApiResponse, PaginatedResponse, ClienteFilters } from '../types/saas';

/**
 * Servicio unificado para el manejo de clientes
 * Utiliza exclusivamente la API SaaS moderna
 */
export class UnifiedClienteService {
  
  // ===== OPERACIONES CRUD =====
  
  async getClientes(filters: ClienteFilters = {}): Promise<ApiResponse<PaginatedResponse<ClienteSaaS>>> {
    return await saasApi.getClientes(filters);
  }
  
  async getCliente(id: string): Promise<ApiResponse<ClienteSaaS>> {
    return await saasApi.getCliente(id);
  }
  
  async createCliente(data: Omit<ClienteSaaS, 'id' | 'codigo_cliente' | 'created_at' | 'updated_at'>): Promise<ApiResponse<ClienteSaaS>> {
    return await saasApi.createCliente(data);
  }
  
  async updateCliente(id: string, data: Partial<ClienteSaaS>): Promise<ApiResponse<ClienteSaaS>> {
    return await saasApi.updateCliente(id, data);
  }
  
  async deleteCliente(id: string): Promise<ApiResponse<void>> {
    return await saasApi.deleteCliente(id);
  }
  
  // ===== OPERACIONES ESPECIALES =====
  
  async asignarCliente(clienteId: string, asesorId: string): Promise<ApiResponse<ClienteSaaS>> {
    return await saasApi.asignarCliente(clienteId, asesorId);
  }
  
  async importarClientes(file: File) {
    return await saasApi.importarClientes(file);
  }
  
  async exportarClientes(filters: ClienteFilters = {}): Promise<Blob> {
    return await saasApi.exportarClientes(filters);
  }
  
  // ===== UTILIDADES =====
  
  /**
   * Convierte datos del formulario al formato de la API
   */
  formatFormDataToApi(formData: any): Omit<ClienteSaaS, 'id' | 'codigo_cliente' | 'created_at' | 'updated_at'> {
    return {
      broker_id: '', // Se asigna automáticamente en el backend
      tipo: formData.tipo_documento === 'NIT' ? 'EMPRESA' : 'PERSONA',
      estado: formData.estado?.toUpperCase() || 'PROSPECTO',
      email: formData.email_principal,
      telefono: formData.telefono || '',
      celular: formData.celular_principal,
      direccion: formData.domicilio_principal,
      ciudad: formData.ciudad,
      departamento: formData.departamento || '',
      pais: 'Colombia',
      asesor_asignado_id: formData.asesor_id,
      origen: 'WEB',
      persona: formData.tipo_documento !== 'NIT' ? {
        nombres: formData.nombre,
        apellidos: formData.apellidos,
        documento: formData.cuit,
        tipo_documento: formData.tipo_documento,
        fecha_nacimiento: formData.fecha_nacimiento,
        lugar_nacimiento: '',
        genero: formData.genero?.charAt(0).toUpperCase(),
        estado_civil: 'SOLTERO',
        profesion: formData.actividad,
        ingresos_mensuales: 0
      } : undefined,
      empresa: formData.tipo_documento === 'NIT' ? {
        razon_social: `${formData.nombre} ${formData.apellidos}`,
        nit: formData.cuit,
        tipo_empresa: 'SAS',
        representante_legal: formData.nombre,
        documento_representante: formData.cuit,
        sector_economico: formData.actividad || '',
        actividad_economica: formData.actividad || '',
        numero_empleados: 1,
        fecha_constitucion: new Date().toISOString().split('T')[0]
      } : undefined,
      observaciones: formData.observaciones,
      tags: [],
      documentos_adjuntos: [],
      total_polizas: 0,
      prima_total_anual: 0,
      fecha_ultima_actividad: new Date().toISOString()
    };
  }
  
  /**
   * Convierte datos de la API al formato del formulario
   */
  formatApiDataToForm(cliente: ClienteSaaS): any {
    return {
      nombre: cliente.persona?.nombres || cliente.empresa?.razon_social || '',
      apellidos: cliente.persona?.apellidos || '',
      cuit: cliente.persona?.documento || cliente.empresa?.nit || '',
      tipo_documento: cliente.persona?.tipo_documento || (cliente.empresa ? 'NIT' : 'CC'),
      fecha_nacimiento: cliente.persona?.fecha_nacimiento || '',
      genero: cliente.persona?.genero?.toLowerCase() || '',
      domicilio_principal: cliente.direccion,
      celular_principal: cliente.celular || '',
      telefono: cliente.telefono,
      email_principal: cliente.email,
      actividad: cliente.persona?.profesion || cliente.empresa?.actividad_economica || '',
      ciudad: cliente.ciudad,
      departamento: cliente.departamento,
      estado: cliente.estado.toLowerCase(),
      observaciones: cliente.observaciones || '',
      asesor_id: cliente.asesor_asignado_id
    };
  }
}

// Instancia singleton
export const unifiedClienteService = new UnifiedClienteService();
export default unifiedClienteService;
