import api from '../config/api';

export interface EnlacePayload {
  nombre: string;
  tipo: string;
  descripcion?: string;
  mensaje_bienvenida?: string;
  config_campos?: any[];
  enlace_sugerido?: string;
}

export default {
  list(params: Record<string, string | number | boolean | undefined> = {}) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) usp.append(k, String(v));
    });
    return api.get(`/saas/enlaces-cotizacion?${usp.toString()}`).then((r) => r.data);
  },
  create(data: EnlacePayload) {
    return api.post(`/saas/enlaces-cotizacion`, data).then((r) => r.data);
  },
  update(id: number, data: Partial<EnlacePayload> & { activo?: boolean }) {
    return api.put(`/saas/enlaces-cotizacion/${id}`, data).then((r) => r.data);
  },
  remove(id: number) {
    return api.delete(`/saas/enlaces-cotizacion/${id}`).then((r) => r.data);
  },
  toggle(id: number) {
    return api.post(`/saas/enlaces-cotizacion/${id}/toggle`).then((r) => r.data);
  },
};
