import { toast } from 'src/hooks/use-toast';
import { auth } from '../config/firebase';

// Configuración de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
const API_PREFIX = '/saas/siniestros';

// Helper para obtener el token de autenticación Firebase
const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    return null;
  }
};

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

export const siniestroDocumentsService = {
  /**
   * Listar documentos de un siniestro específico
   */
  async listarDocumentos(id: string): Promise<ApiResponse<any[]>> {
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents`, { headers });
      if (!res.ok) {
        let message = 'Error al listar documentos';
        if (res.status === 401) message = 'No autorizado. Inicia sesión para ver documentos.';
        else if (res.status === 403) message = 'Permisos insuficientes para listar documentos.';
        else if (res.status === 404) message = 'No se encontraron documentos.';
        toast({ variant: 'destructive', title: 'Documentos de siniestro', description: message });
        throw new Error(message);
      }
      return res.json();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      toast({ variant: 'destructive', title: 'Documentos de siniestro', description: error.message || 'Error desconocido' });
      throw error;
    }
  },

  /**
   * Listar documentos globales de todos los siniestros del broker
   */
  async listarDocumentosGlobal(filters: { search?: string; type?: string; siniestro_id?: string | number; per_page?: number; page?: number } = {}): Promise<ApiResponse<any>> {
    try {
      const token = await getAuthToken();
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/documents?${query.toString()}`, { headers });
      if (!res.ok) {
        const msg = res.status === 401
          ? 'No autorizado. Inicia sesión para ver documentos.'
          : res.status === 403
            ? 'Permisos insuficientes para ver documentos.'
            : 'Error al listar documentos';
        toast({ variant: 'destructive', title: 'Documentos', description: msg });
        throw new Error(msg);
      }
      return res.json();
    } catch (error) {
      if (error instanceof Error) {
        toast({ variant: 'destructive', title: 'Documentos', description: error.message || 'Error desconocido' });
      }
      throw error;
    }
  },

  /**
   * Obtener URL firmada para ver un documento
   */
  async getSignedUrl(id: string, args: { path?: string; name?: string }): Promise<string> {
    const token = await getAuthToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const query = new URLSearchParams();
    if (args.path) query.set('path', args.path);
    if (args.name) query.set('name', args.name);
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents/signed-url?${query.toString()}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success || !data?.data?.url) {
      const message = res.status === 401
        ? 'No autorizado para obtener URL firmada.'
        : res.status === 403
          ? 'Permisos insuficientes para ver el archivo.'
          : res.status === 404
            ? 'Archivo no encontrado.'
            : 'No se pudo obtener URL firmada';
      toast({ variant: 'destructive', title: 'Abrir documento', description: message });
      throw new Error(message);
    }
    return data.data.url as string;
  },

  /**
   * Eliminar un documento
   */
  async eliminarDocumento(id: string, args: { path?: string; name?: string }): Promise<ApiResponse<any[]>> {
    const token = await getAuthToken();
    const query = new URLSearchParams();
    if (args.path) query.set('path', args.path);
    if (args.name) query.set('name', args.name);
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents?${query.toString()}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const message = res.status === 401
        ? 'No autorizado para eliminar documentos.'
        : res.status === 403
          ? 'Permisos insuficientes para eliminar documentos.'
          : res.status === 404
            ? 'Documento no encontrado.'
            : 'Error al eliminar documento';
      toast({ variant: 'destructive', title: 'Eliminar documento', description: message });
      throw new Error(message);
    }
    return res.json();
  },

  /**
   * Subir documento(s) a un siniestro
   */
  async subirDocumento(
    id: string,
    files: File | File[],
    extra?: { type?: string },
    onProgress?: (p: { loaded: number; total: number; percent: number; index?: number; count?: number; file?: File }) => void
  ): Promise<ApiResponse<any[]>> {
    const token = await getAuthToken();
    const list = Array.isArray(files) ? files : [files];

    // Subida con progreso: si hay múltiples y se solicita progreso, subir secuencialmente por archivo
    const uploadSingle = (file: File, index: number, count: number): Promise<ApiResponse<any[]>> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}${API_PREFIX}/${id}/documents`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && onProgress) {
            const percent = Math.round((evt.loaded / evt.total) * 100);
            onProgress({ loaded: evt.loaded, total: evt.total, percent, index, count, file });
          }
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                resolve({ success: true, data: [] as any[] });
              }
            } else {
              let description = 'Error al subir archivo.';
              if (xhr.status === 413) description = 'Archivo demasiado grande (máx. 20 MB).';
              else if (xhr.status === 401) description = 'No autorizado. Inicia sesión para subir archivos.';
              else if (xhr.status === 403) description = 'Permisos insuficientes para subir archivos.';
              else if (xhr.status === 415) description = 'Tipo de archivo no soportado.';
              else if (xhr.status === 422) description = 'Validación fallida al subir archivo.';
              else if (xhr.status >= 500) description = 'Error del servidor al subir archivo.';
              toast({ variant: 'destructive', title: 'Subida de documento', description });
              try {
                const data = JSON.parse(xhr.responseText);
                reject(new Error(`${xhr.status} ${data.message || description}`));
              } catch (e) {
                reject(new Error(`${xhr.status} ${description}`));
              }
            }
          }
        };

        const formData = new FormData();
        formData.append('file', file);
        if (extra?.type) formData.append('type', extra.type);
        xhr.send(formData);
      });
    };

    if (onProgress && list.length > 1) {
      const aggregated: any[] = [];
      for (let i = 0; i < list.length; i++) {
        const res = await uploadSingle(list[i], i + 1, list.length);
        if (res?.data && Array.isArray(res.data)) aggregated.push(...res.data);
      }
      return { success: true, data: aggregated } as ApiResponse<any[]>;
    }

    if (onProgress && list.length === 1) {
      return uploadSingle(list[0], 1, 1);
    }

    // Sin progreso: enviar en un solo request (soporta múltiples)
    const formData = new FormData();
    if (list.length === 1) {
      formData.append('file', list[0]);
    } else {
      list.forEach((f) => formData.append('files[]', f));
    }
    if (extra?.type) formData.append('type', extra.type);

    const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) {
      let description = 'Error al subir archivo.';
      if (res.status === 413) description = 'Archivo demasiado grande (máx. 20 MB).';
      else if (res.status === 401) description = 'No autorizado. Inicia sesión para subir archivos.';
      else if (res.status === 403) description = 'Permisos insuficientes para subir archivos.';
      else if (res.status === 415) description = 'Tipo de archivo no soportado.';
      else if (res.status === 422) description = 'Validación fallida al subir archivo.';
      else if (res.status >= 500) description = 'Error del servidor al subir archivo.';
      toast({ variant: 'destructive', title: 'Subida de documento', description });
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || description);
    }
    return res.json();
  },
};
