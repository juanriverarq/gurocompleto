import { useState, useCallback } from 'react';
import api from '../config/api';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';

interface ApiState {
  loading: boolean;
  error: string | null;
}

interface ApiResponse<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const useApi = () => {
  const [state, setState] = useState<ApiState>({
    loading: false,
    error: null
  });
  
  const { user } = useUnifiedAuth();

  // Función genérica para hacer peticiones
  const makeRequest = useCallback(async <T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any
  ): Promise<ApiResponse<T>> => {
    if (!user) {
      return {
        data: null,
        loading: false,
        error: 'Usuario no autenticado'
      };
    }

    setState({ loading: true, error: null });

    try {
      const response = await api({
        method: method.toLowerCase(),
        url,
        ...(data && { data })
      });

      setState({ loading: false, error: null });
      
      return {
        data: response.data,
        loading: false,
        error: null
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Error en la petición';
      
      setState({ loading: false, error: errorMessage });
      
      return {
        data: null,
        loading: false,
        error: errorMessage
      };
    }
  }, [user]);

  // Métodos específicos
  const get = useCallback(<T = any>(url: string) => {
    return makeRequest<T>('GET', url);
  }, [makeRequest]);

  const post = useCallback(<T = any>(url: string, data?: any) => {
    return makeRequest<T>('POST', url, data);
  }, [makeRequest]);

  const put = useCallback(<T = any>(url: string, data?: any) => {
    return makeRequest<T>('PUT', url, data);
  }, [makeRequest]);

  const del = useCallback(<T = any>(url: string) => {
    return makeRequest<T>('DELETE', url);
  }, [makeRequest]);

  return {
    // Estado
    loading: state.loading,
    error: state.error,
    
    // Métodos
    get,
    post,
    put,
    delete: del,
    makeRequest,
    
    // Utilidades
    clearError: () => setState(prev => ({ ...prev, error: null }))
  };
};

// Hook específico para el dashboard
export const useDashboard = () => {
  const { get } = useApi();
  
  const getDashboardData = useCallback(async () => {
    return await get('/dashboard');
  }, [get]);
  
  return {
    getDashboardData
  };
};

// Hook específico para el perfil
export const useProfile = () => {
  const { get, put } = useApi();
  
  const getProfile = useCallback(async () => {
    return await get('/firebase/profile');
  }, [get]);
  
  const updateProfile = useCallback(async (profileData: any) => {
    return await put('/firebase/profile', profileData);
  }, [put]);
  
  return {
    getProfile,
    updateProfile
  };
}; 