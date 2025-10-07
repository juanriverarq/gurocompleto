import { useState, useEffect } from 'react';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';
import type {
  User,
  Role,
  Company,
  Sucursal,
  CreateUserForm,
  CreateRoleForm,
  CreateCompanyForm,
  UserFilters,
  ApiResponse,
  PaginatedResponse,
  AuditoriaLogin,
  AuditoriaCambios,
  LogAcciones,
  AdminStats
} from '../types/admin';

import { API_BASE_URL } from '../config/api';

// Hook base para peticiones autenticadas
export const useAuthenticatedRequest = () => {
  const { user } = useUnifiedAuth();

  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    try {
      const token = await user?.getIdToken();
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error en la petición');
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  return { makeRequest };
};

// Hook para gestión de usuarios
export const useUsers = (filters?: UserFilters) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 10,
    total: 0,
    last_page: 1
  });

  const { makeRequest } = useAuthenticatedRequest();

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: pagination.per_page.toString(),
        ...filters
      });

      const response = await makeRequest(`/admin/users?${queryParams}`);

      setUsers(response.data.data);
      setPagination({
        current_page: response.data.current_page,
        per_page: response.data.per_page,
        total: response.data.total,
        last_page: response.data.last_page
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: CreateUserForm): Promise<User> => {
    const formData = new FormData();
    
    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'foto_perfil' && value instanceof File) {
          formData.append(key, value);
        } else if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    const response = await makeRequest('/admin/users', {
      method: 'POST',
      body: formData,
      headers: {} // Eliminar Content-Type para FormData
    });

    await fetchUsers(); // Recargar lista
    return response.data;
  };

  const updateUser = async (id: string, userData: Partial<CreateUserForm>): Promise<User> => {
    const response = await makeRequest(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });

    await fetchUsers(); // Recargar lista
    return response.data;
  };

  const deleteUser = async (id: string): Promise<void> => {
    await makeRequest(`/admin/users/${id}`, {
      method: 'DELETE'
    });

    await fetchUsers(); // Recargar lista
  };

  const toggleUserStatus = async (id: string, status: User['estado']): Promise<User> => {
    const response = await makeRequest(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ estado: status })
    });

    await fetchUsers(); // Recargar lista
    return response.data;
  };

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  return {
    users,
    loading,
    error,
    pagination,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus
  };
};

// Hook para gestión de roles
export const useRoles = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { makeRequest } = useAuthenticatedRequest();

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await makeRequest('/admin/roles');
      setRoles(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar roles');
    } finally {
      setLoading(false);
    }
  };

  const createRole = async (roleData: CreateRoleForm): Promise<Role> => {
    const response = await makeRequest('/admin/roles', {
      method: 'POST',
      body: JSON.stringify(roleData)
    });

    await fetchRoles(); // Recargar lista
    return response.data;
  };

  const updateRole = async (id: string, roleData: Partial<CreateRoleForm>): Promise<Role> => {
    const response = await makeRequest(`/admin/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(roleData)
    });

    await fetchRoles(); // Recargar lista
    return response.data;
  };

  const deleteRole = async (id: string): Promise<void> => {
    await makeRequest(`/admin/roles/${id}`, {
      method: 'DELETE'
    });

    await fetchRoles(); // Recargar lista
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  return {
    roles,
    loading,
    error,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole
  };
};

// Hook para gestión de compañías
export const useCompanies = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { makeRequest } = useAuthenticatedRequest();

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await makeRequest('/admin/companies');
      setCompanies(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar compañías');
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async (companyData: CreateCompanyForm): Promise<Company> => {
    const formData = new FormData();
    
    Object.entries(companyData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'logo' && value instanceof File) {
          formData.append(key, value);
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    const response = await makeRequest('/admin/companies', {
      method: 'POST',
      body: formData,
      headers: {}
    });

    await fetchCompanies();
    return response.data;
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  return {
    companies,
    loading,
    error,
    fetchCompanies,
    createCompany
  };
};

// Hook para gestión de sucursales
export const useSucursales = (companyId?: string) => {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { makeRequest } = useAuthenticatedRequest();

  const fetchSucursales = async () => {
    try {
      setLoading(true);
      const endpoint = companyId ? `/admin/sucursales?company_id=${companyId}` : '/admin/sucursales';
      const response = await makeRequest(endpoint);
      setSucursales(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar sucursales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSucursales();
  }, [companyId]);

  return {
    sucursales,
    loading,
    error,
    fetchSucursales
  };
};

// Hook para auditoría de usuarios
export const useUserAudit = (userId: string) => {
  const [loginHistory, setLoginHistory] = useState<AuditoriaLogin[]>([]);
  const [changeHistory, setChangeHistory] = useState<AuditoriaCambios[]>([]);
  const [actionLogs, setActionLogs] = useState<LogAcciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { makeRequest } = useAuthenticatedRequest();

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      
      const [loginResponse, changesResponse, actionsResponse] = await Promise.all([
        makeRequest(`/admin/users/${userId}/audit/logins`),
        makeRequest(`/admin/users/${userId}/audit/changes`),
        makeRequest(`/admin/users/${userId}/audit/actions`)
      ]);

      setLoginHistory(loginResponse.data);
      setChangeHistory(changesResponse.data);
      setActionLogs(actionsResponse.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchAuditData();
    }
  }, [userId]);

  return {
    loginHistory,
    changeHistory,
    actionLogs,
    loading,
    error,
    fetchAuditData
  };
};

// Hook para estadísticas del dashboard
export const useAdminStats = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { makeRequest } = useAuthenticatedRequest();

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await makeRequest('/admin/stats');
      setStats(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    loading,
    error,
    fetchStats
  };
}; 

 