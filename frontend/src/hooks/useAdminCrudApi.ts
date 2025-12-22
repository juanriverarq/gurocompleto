import { useState, useEffect } from 'react';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';
import type {
  TipoAfiliacion,
  TipoAfiliacionCreate,
  Cobertura,
  CoberturaCreate,
  EstadoSiniestro,
  EstadoSiniestroCreate,
  MotivoEstadoPoliza,
  MotivoEstadoPolizaCreate,
  Sede,
  SedeCreate,
  Aseguradora,
  AseguradoraCreate,
  Vendedor,
  VendedorCreate,
  Ramo,
  RamoCreate,
  Mensajero,
  MensajeroCreate,
  RolBroker,
  RolBrokerCreate,
  EmpleadoBroker,
  EmpleadoBrokerCreate,
} from '../types/admin';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

// Hook base para peticiones autenticadas
export const useAuthenticatedAdminRequest = () => {
  const { user, empleadoToken, isEmpleado } = useUnifiedAuth();

  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    try {
      // Resolver token con tolerancia a inicialización de Firebase tras signInWithCustomToken
      const resolveAuthToken = async (): Promise<string> => {
        // Si es empleado y el usuario Firebase aún no está listo, esperar brevemente
        const maxAttempts = 10;
        const delayMs = 100;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (isEmpleado) {
            if (user) {
              return await user.getIdToken();
            }
            // Si tenemos un token de empleado no-sentinela, usarlo (HS256/legacy)
            if (empleadoToken && empleadoToken !== 'FIREBASE') {
              return empleadoToken;
            }
          } else if (user) {
            return await user.getIdToken();
          }
          // Esperar y reintentar (para casos donde user aún no está listo)
          await new Promise((res) => setTimeout(res, delayMs));
        }
        // Último intento
        if (isEmpleado) {
          if (user) {
            return await user.getIdToken();
          }
          if (empleadoToken && empleadoToken !== 'FIREBASE') {
            return empleadoToken;
          }
        } else if (user) {
          return await user.getIdToken();
        }
        throw new Error('No hay token de autenticación disponible');
      };

      const token = await resolveAuthToken();

      // En local/dev, aportar broker_id del empleado vía encabezado para facilitar scoping si hace falta
      const extraHeaders: Record<string, string> = {};
      if (isEmpleado) {
        try {
          const raw = localStorage.getItem('empleado_profile');
          if (raw) {
            const prof = JSON.parse(raw);
            if (prof?.broker_id) {
              extraHeaders['X-Dev-Broker-Id'] = String(prof.broker_id);
            }
          }
        } catch {
          // ignorar errores de parsing/localStorage
        }
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...extraHeaders,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Intentar construir un mensaje de validación más útil
        let details = '';
        if (data && data.errors && typeof data.errors === 'object') {
          const parts: string[] = [];
          Object.entries(data.errors).forEach(([field, msgs]) => {
            const first = Array.isArray(msgs) ? msgs[0] : String(msgs);
            const label = field === 'cuit' ? 'NIT' : field;
            parts.push(`${label}: ${first}`);
          });
          if (parts.length) {
            details = ' (' + parts.join('; ') + ')';
          }
        }
        const message = (data && data.message ? data.message : 'Error en la petición') + details;
        const err: any = new Error(message);
        err.status = response.status;
        err.errors = data?.errors || null;
        err.payload = data;
        throw err;
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  return { makeRequest };
};

// ==========================================
// TIPOS DE AFILIACIÓN
// ==========================================
export const useTiposAfiliacion = () => {
  const [tiposAfiliacion, setTiposAfiliacion] = useState<TipoAfiliacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();

  const fetchTiposAfiliacion = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest('/saas/tipos-afiliacion');
      setTiposAfiliacion(response.data || []);
    } catch (err) {
      setError('Error al cargar tipos de afiliación');
    } finally {
      setLoading(false);
    }
  };

  const createTipoAfiliacion = async (data: TipoAfiliacionCreate) => {
    try {
      const response = await makeRequest('/saas/tipos-afiliacion', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchTiposAfiliacion();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const updateTipoAfiliacion = async (id: string, data: TipoAfiliacionCreate) => {
    try {
      const response = await makeRequest(`/saas/tipos-afiliacion/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await fetchTiposAfiliacion();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteTipoAfiliacion = async (id: string) => {
    try {
      const response = await makeRequest(`/saas/tipos-afiliacion/${id}`, {
        method: 'DELETE',
      });
      await fetchTiposAfiliacion();
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchTiposAfiliacion();
  }, []);

  return {
    tiposAfiliacion,
    loading,
    error,
    fetchTiposAfiliacion,
    createTipoAfiliacion,
    updateTipoAfiliacion,
    deleteTipoAfiliacion,
  };
};

// ==========================================
// COBERTURAS
// ==========================================
export const useCoberturas = () => {
  const [coberturas, setCoberturas] = useState<Cobertura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();

  const fetchCoberturas = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest('/saas/coberturas');
      setCoberturas(response.data || []);
    } catch (err) {
      setError('Error al cargar coberturas');
    } finally {
      setLoading(false);
    }
  };

  const createCobertura = async (data: CoberturaCreate) => {
    try {
      const response = await makeRequest('/saas/coberturas', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchCoberturas();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const updateCobertura = async (id: string, data: CoberturaCreate) => {
    try {
      const response = await makeRequest(`/saas/coberturas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await fetchCoberturas();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteCobertura = async (id: string) => {
    try {
      const response = await makeRequest(`/saas/coberturas/${id}`, {
        method: 'DELETE',
      });
      await fetchCoberturas();
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchCoberturas();
  }, []);

  return {
    coberturas,
    loading,
    error,
    fetchCoberturas,
    createCobertura,
    updateCobertura,
    deleteCobertura,
  };
};

// ==========================================
// ESTADOS DE SINIESTROS
// ==========================================
export const useEstadosSiniestros = () => {
  const [estadosSiniestros, setEstadosSiniestros] = useState<EstadoSiniestro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();
  const { isEmpleado } = useUnifiedAuth();

  const fetchEstadosSiniestros = async () => {
    try {
      setLoading(true);
      setError(null);
      const adminEndpoint = '/saas/estados-siniestros';
      const catalogEndpoint = '/saas/catalogos/estados-siniestros';
      try {
        const response = await makeRequest(isEmpleado ? catalogEndpoint : adminEndpoint);
        setEstadosSiniestros(response.data || []);
      } catch (err: any) {
        if (isEmpleado && (err?.status === 401 || err?.status === 403)) {
          const response = await makeRequest(catalogEndpoint);
          setEstadosSiniestros(response.data || []);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError('Error al cargar estados de siniestros');
    } finally {
      setLoading(false);
    }
  };

  const createEstadoSiniestro = async (data: EstadoSiniestroCreate) => {
    try {
      const response = await makeRequest('/saas/estados-siniestros', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchEstadosSiniestros();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const updateEstadoSiniestro = async (id: string, data: EstadoSiniestroCreate) => {
    try {
      const response = await makeRequest(`/saas/estados-siniestros/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await fetchEstadosSiniestros();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteEstadoSiniestro = async (id: string) => {
    try {
      const response = await makeRequest(`/saas/estados-siniestros/${id}`, {
        method: 'DELETE',
      });
      await fetchEstadosSiniestros();
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchEstadosSiniestros();
  }, []);

  return {
    estadosSiniestros,
    loading,
    error,
    fetchEstadosSiniestros,
    createEstadoSiniestro,
    updateEstadoSiniestro,
    deleteEstadoSiniestro,
  };
};

// ==========================================
// MOTIVOS ESTADOS PÓLIZA
// ==========================================
export const useMotivosEstadosPoliza = () => {
  const [motivosEstadosPoliza, setMotivosEstadosPoliza] = useState<MotivoEstadoPoliza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();
  const { isEmpleado } = useUnifiedAuth();

  const fetchMotivosEstadosPoliza = async () => {
    try {
      setLoading(true);
      setError(null);
      const adminEndpoint = '/saas/motivos-estados-poliza';
      const catalogEndpoint = '/saas/catalogos/motivos-estados-poliza';
      try {
        const response = await makeRequest(isEmpleado ? catalogEndpoint : adminEndpoint);
        setMotivosEstadosPoliza(response.data || []);
      } catch (err: any) {
        if (isEmpleado && (err?.status === 401 || err?.status === 403)) {
          const response = await makeRequest(catalogEndpoint);
          setMotivosEstadosPoliza(response.data || []);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError('Error al cargar motivos de estados de póliza');
    } finally {
      setLoading(false);
    }
  };

  const createMotivoEstadoPoliza = async (data: MotivoEstadoPolizaCreate) => {
    try {
      const response = await makeRequest('/saas/motivos-estados-poliza', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchMotivosEstadosPoliza();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const updateMotivoEstadoPoliza = async (id: string, data: MotivoEstadoPolizaCreate) => {
    try {
      const response = await makeRequest(`/saas/motivos-estados-poliza/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await fetchMotivosEstadosPoliza();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteMotivoEstadoPoliza = async (id: string) => {
    try {
      const response = await makeRequest(`/saas/motivos-estados-poliza/${id}`, {
        method: 'DELETE',
      });
      await fetchMotivosEstadosPoliza();
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchMotivosEstadosPoliza();
  }, []);

  return {
    motivosEstadosPoliza,
    loading,
    error,
    fetchMotivosEstadosPoliza,
    createMotivoEstadoPoliza,
    updateMotivoEstadoPoliza,
    deleteMotivoEstadoPoliza,
  };
};

// ==========================================
// SEDES
// ==========================================
export const useSedes = () => {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();
  const { isEmpleado } = useUnifiedAuth();

  const fetchSedes = async () => {
    try {
      setLoading(true);
      setError(null);
      const adminEndpoint = '/saas/sedes';
      const catalogEndpoint = '/saas/catalogos/sedes';
      try {
        const response = await makeRequest(isEmpleado ? catalogEndpoint : adminEndpoint);
        setSedes(response.data || []);
      } catch (err: any) {
        if (isEmpleado && (err?.status === 401 || err?.status === 403)) {
          const response = await makeRequest(catalogEndpoint);
          setSedes(response.data || []);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError('Error al cargar sedes');
    } finally {
      setLoading(false);
    }
  };

  const createSede = async (data: SedeCreate) => {
    try {
      const response = await makeRequest('/saas/sedes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchSedes();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const updateSede = async (id: string, data: SedeCreate) => {
    try {
      const response = await makeRequest(`/saas/sedes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await fetchSedes();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteSede = async (id: string) => {
    try {
      const response = await makeRequest(`/saas/sedes/${id}`, {
        method: 'DELETE',
      });
      await fetchSedes();
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchSedes();
  }, []);

  return {
    sedes,
    loading,
    error,
    fetchSedes,
    createSede,
    updateSede,
    deleteSede,
  };
};

// ==========================================
// ASEGURADORAS
// ==========================================
export const useAseguradoras = () => {
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();
  const { isEmpleado } = useUnifiedAuth();

  const fetchAseguradoras = async () => {
    try {
      setLoading(true);
      setError(null);
      // Traer todo para evitar duplicados no detectados en la UI (paginación)
      const adminEndpoint = '/saas/aseguradoras?all=true';
      const catalogEndpoint = '/saas/catalogos/aseguradoras?all=true';
      try {
        const response = await makeRequest(isEmpleado ? catalogEndpoint : adminEndpoint);
        setAseguradoras(response.data || []);
      } catch (err: any) {
        if (isEmpleado && (err?.status === 401 || err?.status === 403)) {
          const response = await makeRequest(catalogEndpoint);
          setAseguradoras(response.data || []);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError('Error al cargar aseguradoras');
    } finally {
      setLoading(false);
    }
  };

  const createAseguradora = async (data: AseguradoraCreate) => {
    try {
      const response = await makeRequest('/saas/aseguradoras', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchAseguradoras();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const updateAseguradora = async (id: string, data: AseguradoraCreate) => {
    try {
      const response = await makeRequest(`/saas/aseguradoras/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await fetchAseguradoras();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteAseguradora = async (id: string) => {
    try {
      const response = await makeRequest(`/saas/aseguradoras/${id}`, {
        method: 'DELETE',
      });
      await fetchAseguradoras();
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchAseguradoras();
  }, []);

  return {
    aseguradoras,
    loading,
    error,
    fetchAseguradoras,
    createAseguradora,
    updateAseguradora,
    deleteAseguradora,
  };
};

// ==========================================
// VENDEDORES
// ==========================================
export const useVendedores = () => {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();
  const { isEmpleado } = useUnifiedAuth();

  const fetchVendedores = async () => {
    try {
      setLoading(true);
      setError(null);
      // Pedir todos los vendedores sin paginación para selectores
      const adminEndpoint = '/saas/vendedores?all=true';
      const catalogEndpoint = '/saas/catalogos/vendedores?all=true';
      try {
        const response = await makeRequest(isEmpleado ? catalogEndpoint : adminEndpoint);
        setVendedores(response.data || []);
      } catch (err: any) {
        if (isEmpleado && (err?.status === 401 || err?.status === 403)) {
          const response = await makeRequest(catalogEndpoint);
          setVendedores(response.data || []);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError('Error al cargar vendedores');
    } finally {
      setLoading(false);
    }
  };

  const createVendedor = async (data: VendedorCreate) => {
    try {
      const response = await makeRequest('/saas/vendedores', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchVendedores();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const updateVendedor = async (id: string, data: VendedorCreate) => {
    try {
      const response = await makeRequest(`/saas/vendedores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await fetchVendedores();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteVendedor = async (id: string) => {
    try {
      const response = await makeRequest(`/saas/vendedores/${id}`, {
        method: 'DELETE',
      });
      await fetchVendedores();
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchVendedores();
  }, []);

  return {
    vendedores,
    loading,
    error,
    fetchVendedores,
    createVendedor,
    updateVendedor,
    deleteVendedor,
  };
};

// ==========================================
// RAMOS
// ==========================================
export const useRamos = () => {
  const [ramos, setRamos] = useState<Ramo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();
  const { isEmpleado } = useUnifiedAuth();

  const fetchRamos = async () => {
    try {
      setLoading(true);
      setError(null);
      const adminEndpoint = '/saas/ramos?all=true';
      const catalogEndpoint = '/saas/catalogos/ramos?all=true';
      try {
        const response = await makeRequest(isEmpleado ? catalogEndpoint : adminEndpoint);
        setRamos(response.data || []);
      } catch (err: any) {
        if (isEmpleado && (err?.status === 401 || err?.status === 403)) {
          const response = await makeRequest(catalogEndpoint);
          setRamos(response.data || []);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError('Error al cargar ramos');
    } finally {
      setLoading(false);
    }
  };

  const createRamo = async (data: RamoCreate) => {
    try {
      const response = await makeRequest('/saas/ramos', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await fetchRamos();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const updateRamo = async (id: string, data: RamoCreate) => {
    try {
      const response = await makeRequest(`/saas/ramos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await fetchRamos();
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteRamo = async (id: string) => {
    try {
      const response = await makeRequest(`/saas/ramos/${id}`, {
        method: 'DELETE',
      });
      await fetchRamos();
      return response;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchRamos();
  }, []);

  return {
    ramos,
    loading,
    error,
    fetchRamos,
    createRamo,
    updateRamo,
    deleteRamo,
  };
};

// Hook para gestión de Mensajeros
export const useMensajeros = () => {
  const [mensajeros, setMensajeros] = useState<Mensajero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();

  // Obtener mensajeros
  const fetchMensajeros = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest('/saas/mensajeros');
      setMensajeros(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mensajeros');
      setMensajeros([]);
    } finally {
      setLoading(false);
    }
  };

  // Crear mensajero
  const createMensajero = async (data: MensajeroCreate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest('/saas/mensajeros', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        await fetchMensajeros(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear mensajero');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar mensajero
  const updateMensajero = async (id: number, data: MensajeroCreate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/mensajeros/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (response.success) {
        await fetchMensajeros(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar mensajero');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Eliminar mensajero
  const deleteMensajero = async (id: number): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/mensajeros/${id}`, {
        method: 'DELETE',
      });

      if (response.success) {
        await fetchMensajeros(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar mensajero');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMensajeros();
  }, []);

  return {
    mensajeros,
    loading,
    error,
    createMensajero,
    updateMensajero,
    deleteMensajero,
    refreshMensajeros: fetchMensajeros,
  };
};

// Hook para gestión de Roles Broker
export const useRolesBroker = () => {
  const [roles, setRoles] = useState<RolBroker[]>([]);
  const [permisosDisponibles, setPermisosDisponibles] = useState<any>({});
  const [nivelesAcceso, setNivelesAcceso] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();

  // Obtener roles
  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest('/saas/roles');
      setRoles(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar roles');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  // Obtener permisos disponibles
  const fetchPermisosDisponibles = async () => {
    try {
      const response = await makeRequest('/saas/roles/permisos');
      setPermisosDisponibles(response.data || {});
    } catch (err) {}
  };

  // Obtener niveles de acceso
  const fetchNivelesAcceso = async () => {
    try {
      const response = await makeRequest('/saas/roles/niveles-acceso');
      setNivelesAcceso(response.data || []);
    } catch (err) {}
  };

  // Crear rol
  const createRol = async (data: RolBrokerCreate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest('/saas/roles', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        await fetchRoles(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear rol');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar rol
  const updateRol = async (id: number, data: RolBrokerCreate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (response.success) {
        await fetchRoles(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar rol');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Eliminar rol
  const deleteRol = async (id: number): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/roles/${id}`, {
        method: 'DELETE',
      });

      if (response.success) {
        await fetchRoles(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar rol');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermisosDisponibles();
    fetchNivelesAcceso();
  }, []);

  return {
    roles,
    permisosDisponibles,
    nivelesAcceso,
    loading,
    error,
    createRol,
    updateRol,
    deleteRol,
    refreshRoles: fetchRoles,
  };
};

// Hook para gestión de Empleados Broker
export const useEmpleadosBroker = () => {
  const [empleados, setEmpleados] = useState<EmpleadoBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { makeRequest } = useAuthenticatedAdminRequest();

  // Obtener empleados
  const fetchEmpleados = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest('/saas/empleados');
      setEmpleados(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empleados');
      setEmpleados([]);
    } finally {
      setLoading(false);
    }
  };

  // Crear empleado
  const createEmpleado = async (data: EmpleadoBrokerCreate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest('/saas/empleados', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        await fetchEmpleados(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear empleado');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar empleado
  const updateEmpleado = async (id: number, data: EmpleadoBrokerCreate): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/empleados/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (response.success) {
        await fetchEmpleados(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar empleado');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Eliminar empleado
  const deleteEmpleado = async (id: number): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/empleados/${id}`, {
        method: 'DELETE',
      });

      if (response.success) {
        await fetchEmpleados(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar empleado');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Cambiar contraseña de empleado
  const cambiarPasswordEmpleado = async (
    id: number,
    data: { password: string; password_confirmation: string; requiere_cambio_password?: boolean },
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/empleados/${id}/cambiar-password`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (response.success) {
        await fetchEmpleados(); // Recargar la lista
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar contraseña');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Generar contraseña temporal
  const generarPasswordTemporal = async (
    id: number,
  ): Promise<{ success: boolean; password?: string; message?: string }> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/empleados/${id}/generar-password-temporal`, {
        method: 'POST',
      });

      if (response.success) {
        await fetchEmpleados(); // Recargar la lista
        return {
          success: true,
          password: response.data.password_temporal,
          message: 'Contraseña temporal generada exitosamente',
        };
      }
      return { success: false, message: 'Error al generar contraseña temporal' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar contraseña temporal';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Resetear contraseña
  const resetPasswordEmpleado = async (
    id: number,
  ): Promise<{ success: boolean; nueva_password?: string; message?: string }> => {
    try {
      setLoading(true);
      setError(null);
      const response = await makeRequest(`/saas/empleados/${id}/reset-password`, {
        method: 'POST',
      });

      if (response.success) {
        await fetchEmpleados(); // Recargar la lista
        return {
          success: true,
          nueva_password: response.data.nueva_password,
          message: 'Contraseña reseteada exitosamente',
        };
      }
      return { success: false, message: 'Error al resetear contraseña' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al resetear contraseña';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpleados();
  }, []);

  return {
    empleados,
    loading,
    error,
    createEmpleado,
    updateEmpleado,
    deleteEmpleado,
    cambiarPasswordEmpleado,
    generarPasswordTemporal,
    resetPasswordEmpleado,
    refreshEmpleados: fetchEmpleados,
  };
};
