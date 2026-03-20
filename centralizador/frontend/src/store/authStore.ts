import { create } from 'zustand';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface Agency {
  id: string;
  name: string;
}

interface AuthState {
  user: User | null;
  agency: Agency | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

interface RegisterData {
  agencyName: string;
  email: string;
  password: string;
  fullName: string;
  nit?: string;
  phone?: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  agency: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { user, agency, accessToken, refreshToken } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, agency, isAuthenticated: true });
  },

  register: async (registerData) => {
    const { data } = await api.post('/auth/register', registerData);
    const { user, agency, accessToken, refreshToken } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, agency, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, agency: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { data } = await api.get('/auth/me');
      set({ user: data.data.user, agency: data.data.agency, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, agency: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
