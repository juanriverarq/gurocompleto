import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Tipos para el contexto de autenticación
interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: string;
  email_verified_at?: string;
  two_step_verification_enabled: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  register: (name: string, email: string, password: string, password_confirmation: string) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<MessageResponse>;
  resetPassword: (email: string, code: string, password: string, password_confirmation: string) => Promise<MessageResponse>;
  sendTwoStepsCode: (email: string) => Promise<MessageResponse>;
  verifyTwoStepsCode: (email: string, code: string) => Promise<LoginResponse>;
  sendEmailVerification: () => Promise<MessageResponse>;
  verifyEmail: (code: string) => Promise<MessageResponse>;
  updateProfile: (data: Partial<User>) => Promise<ProfileResponse>;
  refreshProfile: () => Promise<void>;
}

interface LoginResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
  requires_two_step?: boolean;
  masked_phone?: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
  requires_email_verification?: boolean;
}

interface MessageResponse {
  success: boolean;
  message: string;
}

interface ProfileResponse {
  success: boolean;
  message: string;
  user?: User;
}

// URL base del backend Laravel
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

// Crear contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Proveedor del contexto
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Función para hacer peticiones HTTP con autenticación
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers as Record<string, string>,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      mode: 'cors',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición');
    }

    return data;
  };

  // Cargar token del localStorage al iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem('guro_token');
    const savedUser = localStorage.getItem('guro_user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    
    setLoading(false);
  }, []);

  // Función de login
  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.success && !response.requires_two_step) {
        setUser(response.user);
        setToken(response.token);
        localStorage.setItem('guro_token', response.token);
        localStorage.setItem('guro_user', JSON.stringify(response.user));
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error en el login',
      };
    }
  };

  // Función de registro
  const register = async (
    name: string, 
    email: string, 
    password: string, 
    password_confirmation: string
  ): Promise<RegisterResponse> => {
    try {
      const response = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, password_confirmation }),
      });

      if (response.success) {
        setUser(response.user);
        setToken(response.token);
        localStorage.setItem('guro_token', response.token);
        localStorage.setItem('guro_user', JSON.stringify(response.user));
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error en el registro',
      };
    }
  };

  // Función de logout
  const logout = async (): Promise<void> => {
    try {
      if (token) {
        await apiRequest('/auth/logout', { method: 'POST' });
      }
    } catch (error) {
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('guro_token');
      localStorage.removeItem('guro_user');
    }
  };

  // Función para olvidé mi contraseña
  const forgotPassword = async (email: string): Promise<MessageResponse> => {
    try {
      const response = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al enviar código de recuperación',
      };
    }
  };

  // Función para restablecer contraseña
  const resetPassword = async (
    email: string, 
    code: string, 
    password: string, 
    password_confirmation: string
  ): Promise<MessageResponse> => {
    try {
      const response = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, password, password_confirmation }),
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al restablecer contraseña',
      };
    }
  };

  // Función para enviar código de verificación en dos pasos
  const sendTwoStepsCode = async (email: string): Promise<MessageResponse> => {
    try {
      const response = await apiRequest('/auth/two-steps/send', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al enviar código de verificación',
      };
    }
  };

  // Función para verificar código de dos pasos
  const verifyTwoStepsCode = async (email: string, code: string): Promise<LoginResponse> => {
    try {
      const response = await apiRequest('/auth/two-steps/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      if (response.success) {
        setUser(response.user);
        setToken(response.token);
        localStorage.setItem('guro_token', response.token);
        localStorage.setItem('guro_user', JSON.stringify(response.user));
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error en la verificación de dos pasos',
      };
    }
  };

  // Función para enviar verificación de email
  const sendEmailVerification = async (): Promise<MessageResponse> => {
    try {
      const response = await apiRequest('/auth/email/send-verification', {
        method: 'POST',
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al enviar verificación de email',
      };
    }
  };

  // Función para verificar email
  const verifyEmail = async (code: string): Promise<MessageResponse> => {
    try {
      const response = await apiRequest('/auth/email/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      
      if (response.success && user) {
        const updatedUser = { ...user, email_verified_at: new Date().toISOString() };
        setUser(updatedUser);
        localStorage.setItem('guro_user', JSON.stringify(updatedUser));
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al verificar email',
      };
    }
  };

  // Función para actualizar perfil
  const updateProfile = async (data: Partial<User>): Promise<ProfileResponse> => {
    try {
      const response = await apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (response.success) {
        setUser(response.user);
        localStorage.setItem('guro_user', JSON.stringify(response.user));
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al actualizar perfil',
      };
    }
  };

  // Función para refrescar datos del perfil
  const refreshProfile = async (): Promise<void> => {
    try {
      const response = await apiRequest('/auth/profile');
      if (response.success) {
        setUser(response.user);
        localStorage.setItem('guro_user', JSON.stringify(response.user));
      }
    } catch (error) {
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    sendTwoStepsCode,
    verifyTwoStepsCode,
    sendEmailVerification,
    verifyEmail,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 