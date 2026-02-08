import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import api from '../config/api';

interface BrokerData {
  id: number;
  name: string;
  email: string;
  plan: string;
  status: string;
  features: string[];
}

interface AuthContextType {
  user: User | null;
  broker: BrokerData | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [broker, setBroker] = useState<BrokerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrokerData = async () => {
    try {
      const response = await api.get('/saas/me-simple');
      console.log('Me-simple response:', JSON.stringify(response.data));
      if (response.data?.success && response.data?.broker) {
        setBroker(response.data.broker);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error fetching broker data:', err);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        await fetchBrokerData();
      } else {
        setBroker(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    setError(null);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase login success:', userCredential.user.email);
      
      const hasBroker = await fetchBrokerData();
      
      if (hasBroker) {
        return { success: true, message: 'Login exitoso' };
      } else {
        // No cerrar sesion, permitir acceso aunque no tenga broker
        return { success: true, message: 'Login exitoso (sin broker asociado)' };
      }
    } catch (err: any) {
      console.error('Login error:', err);
      let message = 'Error al iniciar sesion';
      
      if (err.code === 'auth/user-not-found') {
        message = 'No existe una cuenta con este correo';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Credenciales invalidas';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Correo electronico invalido';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Demasiados intentos. Intenta mas tarde';
      }
      
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setBroker(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, broker, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
