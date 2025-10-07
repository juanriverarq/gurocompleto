import api from '../config/api';

export interface ContratoPayload {
  numero_contrato: string;
  aseguradora: string;
  tipo_contrato: 'intermediacion' | 'comision' | 'exclusividad' | 'marco';
  fecha_inicio: string; // YYYY-MM-DD
  fecha_vencimiento: string; // YYYY-MM-DD
  estado?: 'activo' | 'vencido' | 'por_vencer' | 'cancelado' | 'borrador';
  comision_base?: number;
  comision_adicional?: number;
  productos_autorizados?: string[];
  territorio?: string;
  responsable?: string;
  archivo_url?: string;
  fecha_firma?: string; // YYYY-MM-DD
  firmado_digitalmente?: boolean;
  renovacion_automatica?: boolean;
  valor_estimado_anual?: number;
  clausulas_especiales?: string[];
  observaciones?: string;
}

export default {
  list(params: Record<string, string | number | boolean | undefined> = {}) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) usp.append(k, String(v));
    });
    return api.get(`/saas/contratos?${usp.toString()}`).then((r) => r.data);
  },
  create(data: ContratoPayload) {
    return api.post(`/saas/contratos`, data).then((r) => r.data);
  },
  update(id: number, data: Partial<ContratoPayload>) {
    return api.put(`/saas/contratos/${id}`, data).then((r) => r.data);
  },
  remove(id: number) {
    return api.delete(`/saas/contratos/${id}`).then((r) => r.data);
  },
};
