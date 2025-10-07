import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

interface AuthContextType {
  // Estado
  user: User | null;
  loading: boolean;
  error: string | null;
  
  // Métodos de autenticación
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; user?: User }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; message: string; user?: User }>;
  loginWithGoogle: () => Promise<{ success: boolean; message: string; user?: User }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (displayName: string, photoURL?: string) => Promise<{ success: boolean; message: string }>;
  resendEmailVerification: () => Promise<{ success: boolean; message: string }>;
  clearError: () => void;
  
  // Utilidades
  isAuthenticated: boolean;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const {
    user,
    loading,
    error,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    resendEmailVerification,
    clearError
  } = useFirebaseAuth();

  // Estados derivados
  const isAuthenticated = !!user;
  const isEmailVerified = user?.emailVerified ?? false;

  // Wrapper para el login que mantiene la misma interfaz
  const login = async (email: string, password: string) => {
    return await loginWithEmail(email, password);
  };

  // Wrapper para el registro que mantiene la misma interfaz
  const register = async (email: string, password: string, name: string) => {
    return await registerWithEmail(email, password, name);
  };

  // Wrapper para forgot password
  const forgotPassword = async (email: string) => {
    return await resetPassword(email);
  };

  // Wrapper para update profile
  const updateProfile = async (displayName: string, photoURL?: string) => {
    return await updateUserProfile(displayName, photoURL);
  };

  const value: AuthContextType = {
    // Estado
    user,
    loading,
    error,
    
    // Métodos
    login,
    register,
    loginWithGoogle,
    logout,
    forgotPassword,
    updateProfile,
    resendEmailVerification,
    clearError,
    
    // Utilidades
    isAuthenticated,
    isEmailVerified
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 