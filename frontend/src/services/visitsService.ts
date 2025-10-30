import { auth } from '../config/firebase';

export interface VisitData {
  slug: string;
  tipo?: string; // opcional, para formularios específicos
  userAgent?: string;
  referrer?: string;
  timestamp?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
const API_PREFIX_PUBLIC = '/public/visits';
const LOCAL_KEY = 'visits_log';

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

function saveLocal(visit: VisitData) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const arr: VisitData[] = raw ? JSON.parse(raw) : [];
    arr.push(visit);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export const visitsService = {
  async trackVisit(data: VisitData): Promise<ApiResponse<{ tracked: boolean }>> {
    try {
      const payload = {
        ...data,
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
      };
      const res = await makeRequest<{ tracked: boolean }>(`${API_PREFIX_PUBLIC}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res;
    } catch {
      // Fallback local
      saveLocal(data);
      return { success: true, data: { tracked: true } };
    }
  },
};