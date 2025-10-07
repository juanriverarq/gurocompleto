import { auth } from 'src/config/firebase';
import { toast } from 'src/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

async function getAuthToken(): Promise<string | null> {
  try {
    if (auth.currentUser) return await auth.currentUser.getIdToken();
  } catch {}
  return localStorage.getItem('empleado_token') || localStorage.getItem('saas_token') || null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const clienteDocumentsService = {
  async listarDocumentos(clienteId: string) {
    const headers = await getAuthHeaders();
    const url = `${API_BASE_URL}/saas/clientes/${clienteId}/documents`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      let backend: any = null;
      try {
        backend = await res.clone().json();
      } catch {
        try {
          backend = await res.clone().text();
        } catch {}
      }
      console.error('[ClienteDocs][listar] FAIL', { url, status: res.status, backend });
      let message = 'Error al listar documentos';
      if (res.status === 401) message = 'No autorizado. Inicia sesión para ver documentos.';
      else if (res.status === 403) message = 'Permisos insuficientes para listar documentos.';
      else if (res.status === 404) message = 'No se encontraron documentos.';
      else if (res.status >= 500)
        message = backend?.message || backend?.error || 'Error del servidor al listar documentos.';
      toast({ variant: 'destructive', title: 'Documentos del cliente', description: message });
      throw new Error(message);
    }
    return res.json();
  },

  /**
   * Listar documentos globales de todos los clientes del broker (rápido, una sola petición)
   * Filtros opcionales: search, type, cliente_id, per_page, page (aunque el backend retorna plano).
   */
  async listarDocumentosGlobal(
    filters: {
      search?: string;
      type?: string;
      cliente_id?: string | number;
      per_page?: number;
      page?: number;
    } = {},
  ) {
    const headers = await getAuthHeaders();
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    const url = `${API_BASE_URL}/saas/clientes/documents?${query.toString()}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      let backend: any = null;
      try {
        backend = await res.clone().json();
      } catch {
        try {
          backend = await res.clone().text();
        } catch {}
      }
      console.error('[ClienteDocs][listarGlobal] FAIL', { url, status: res.status, backend });
      const msg =
        res.status === 401
          ? 'No autorizado. Inicia sesión para ver documentos.'
          : res.status === 403
          ? 'Permisos insuficientes para ver documentos.'
          : backend?.message || backend?.error || 'Error al listar documentos';
      toast({ variant: 'destructive', title: 'Documentos', description: msg });
      throw new Error(msg);
    }
    return res.json();
  },

  async getSignedUrl(clienteId: string, params: { path?: string; name?: string }): Promise<string> {
    const headers = await getAuthHeaders();
    const query = new URLSearchParams();
    if (params.path) query.set('path', params.path);
    if (params.name) query.set('name', params.name);
    const url = `${API_BASE_URL}/saas/clientes/${clienteId}/documents/signed-url?${query}`;
    const res = await fetch(url, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[ClienteDocs][signedUrl] FAIL', { url, status: res.status, backend: data });
    }
    if (!res.ok || !data?.success || !data?.data?.url) {
      const message =
        res.status === 401
          ? 'No autorizado para obtener URL firmada.'
          : res.status === 403
          ? 'Permisos insuficientes para ver el archivo.'
          : res.status === 404
          ? 'Archivo no encontrado.'
          : data?.message || data?.error || 'No se pudo obtener URL firmada';
      toast({ variant: 'destructive', title: 'Abrir documento', description: message });
      throw new Error(message);
    }
    return data.data.url as string;
  },

  async eliminarDocumento(clienteId: string, body: { path?: string; name?: string }) {
    const headers = await getAuthHeaders();
    const query = new URLSearchParams();
    if (body.path) query.set('path', body.path);
    if (body.name) query.set('name', body.name);
    const url = `${API_BASE_URL}/saas/clientes/${clienteId}/documents?${query}`;
    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok) {
      let backend: any = null;
      try {
        backend = await res.clone().json();
      } catch {
        try {
          backend = await res.clone().text();
        } catch {}
      }
      console.error('[ClienteDocs][eliminar] FAIL', { url, status: res.status, backend });
      const message =
        res.status === 401
          ? 'No autorizado para eliminar documentos.'
          : res.status === 403
          ? 'Permisos insuficientes para eliminar documentos.'
          : res.status === 404
          ? 'Documento no encontrado.'
          : backend?.message || backend?.error || 'Error al eliminar documento';
      toast({ variant: 'destructive', title: 'Eliminar documento', description: message });
      throw new Error(message);
    }
    return res.json();
  },

  async subirDocumento(
    clienteId: string,
    files: File[] | FileList,
    options: { type?: string } = {},
    onProgress?: (progress: {
      percent: number;
      index?: number;
      count?: number;
      file?: File;
    }) => void,
  ) {
    const list = Array.isArray(files) ? files : Array.from(files);

    // Validación previa: tamaño y tipo
    const MAX_BYTES = 20 * 1024 * 1024; // 20MB
    const allowed = new Set<string>([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    const tooBig = list.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) {
      const names = tooBig.map((f) => f.name).join(', ');
      toast({
        variant: 'destructive',
        title: 'Subida de documento',
        description: `Archivo(s) demasiado grande(s) (>20MB): ${names}`,
      });
      throw new Error('Archivo demasiado grande (>20MB)');
    }
    const badTypes = list.filter((f) => f.type && !allowed.has(f.type));
    if (badTypes.length) {
      const names = badTypes.map((f) => `${f.name} (${f.type || 'desconocido'})`).join(', ');
      toast({
        variant: 'destructive',
        title: 'Subida de documento',
        description: `Tipo(s) de archivo no soportado(s): ${names}`,
      });
      throw new Error('Tipo de archivo no soportado');
    }

    const token = await getAuthToken();
    const uploadSingle = (file: File, index: number) =>
      new Promise<void>((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        if (options.type) formData.append('type', options.type);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/saas/clientes/${clienteId}/documents`, true);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress({ percent, index: index + 1, count: list.length, file });
          }
        };
        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              let backendMsg: string | undefined;
              try {
                const parsed = JSON.parse(xhr.responseText);
                backendMsg = parsed?.message || parsed?.error;
              } catch {}
              console.error('[ClienteDocs][upload] FAIL', {
                status: xhr.status,
                response: xhr.responseText,
              });
              let description = 'Error al subir archivo.';
              if (xhr.status === 413) description = 'Archivo demasiado grande (máx. 20 MB).';
              else if (xhr.status === 401)
                description = 'No autorizado. Inicia sesión para subir archivos.';
              else if (xhr.status === 403)
                description = 'Permisos insuficientes para subir archivos.';
              else if (xhr.status === 415) description = 'Tipo de archivo no soportado.';
              else if (xhr.status === 422) description = 'Validación fallida al subir archivo.';
              else if (xhr.status >= 500)
                description = backendMsg || 'Error del servidor al subir archivo.';
              toast({ variant: 'destructive', title: 'Subida de documento', description });
              reject(new Error(`${xhr.status} ${description}`));
            }
          }
        };
        xhr.onerror = () => {
          toast({
            variant: 'destructive',
            title: 'Subida de documento',
            description: 'Error de red al subir archivo.',
          });
          reject(new Error('Error de red al subir archivo'));
        };
        xhr.send(formData);
      });

    for (let i = 0; i < list.length; i++) {
      await uploadSingle(list[i], i);
    }
  },
};

export default clienteDocumentsService;
