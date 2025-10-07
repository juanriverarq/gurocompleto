import api from '../config/api';

export interface CarteraClientePayload {
  nombre: string;
  tipo_documento?: string;
  documento?: string;
  email?: string;
  telefono?: string;
  asesor?: string;
  polizas_activas?: number;
  prima_total?: number;
  comisiones_generadas?: number;
  ultima_renovacion?: string;
  proximo_vencimiento?: string;
  estado?: 'Activo' | 'Inactivo' | 'Prospecto';
  segmento?: 'Premium' | 'Estándar' | 'Básico';
  antiguedad?: number;
}

export default {
  list(params: Record<string, string | number | undefined> = {}) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) usp.append(k, String(v));
    });
    return api.get(`/saas/cartera-clientes?${usp.toString()}`).then((r) => r.data);
  },
  create(data: CarteraClientePayload) {
    return api.post(`/saas/cartera-clientes`, data).then((r) => r.data);
  },
  update(id: number, data: Partial<CarteraClientePayload>) {
    return api.put(`/saas/cartera-clientes/${id}`, data).then((r) => r.data);
  },
  remove(id: number) {
    return api.delete(`/saas/cartera-clientes/${id}`).then((r) => r.data);
  },
};
