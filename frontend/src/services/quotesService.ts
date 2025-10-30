import { auth } from '../config/firebase';

export interface QuoteSubmission {
  slug: string;    // slug de la agencia
  tipo: string;    // tipo de producto (autos, salud, hogar, etc.)
  data: Record<string, any>; // payload de campos
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
const API_PREFIX_PUBLIC = '/public/quotes';
const LOCAL_KEY = 'quotes_submissions';

const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    return token;
  } catch {
    return null;
  }
};

async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  const defaultHeaders: HeadersInit = {};
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, config);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
    const msg = errorData?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  const data = await response.json();
  return data;
}

function saveLocal(submission: QuoteSubmission) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const arr: QuoteSubmission[] = raw ? JSON.parse(raw) : [];
    arr.push(submission);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export const quotesService = {
  async submitQuote(payload: QuoteSubmission): Promise<ApiResponse<{ id?: string }>> {
    try {
      const res = await makeRequest<{ id?: string }>(`${API_PREFIX_PUBLIC}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Espejo local SIEMPRE para que los cards de "Enlaces Activos" reflejen cotizaciones al instante
      saveLocal(payload);
      return res;
    } catch {
      // Fallback local si no hay backend
      saveLocal(payload);
      return { success: true, data: { id: undefined } };
    }
  },
};