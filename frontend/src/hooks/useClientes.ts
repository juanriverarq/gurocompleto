import { useState, useEffect, useCallback } from 'react';
import api from '../config/api';

interface ClienteBasico {
  id: number;
  nombre: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
}

export const useClientes = () => {
  const [clientes, setClientes] = useState<Record<number, ClienteBasico>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/saas/clientes', { params: { per_page: 1000 } });
      
      if (response.data?.data) {
        const clientesMap: Record<number, ClienteBasico> = {};
        response.data.data.forEach((cliente: any) => {
          if (cliente.id) {
            clientesMap[cliente.id] = {
              id: cliente.id,
              nombre: cliente.nombre || '',
              apellidos: cliente.apellidos || '',
              email: cliente.email_principal || '',
              telefono: cliente.celular_principal || '',
            };
          }
        });
        setClientes(clientesMap);
      }
    } catch (err) {
      setError('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  const getClienteNombre = useCallback((clienteId: number): string => {
    const cliente = clientes[clienteId];
    if (!cliente) {
      return `Cliente ID: ${clienteId}`;
    }
    
    const nombre = cliente.nombre || '';
    const apellidos = cliente.apellidos || '';
    const nombreCompleto = `${nombre} ${apellidos}`.trim();
    return nombreCompleto || `Cliente ID: ${clienteId}`;
  }, [clientes]);

  const getCliente = useCallback((clienteId: number): ClienteBasico | null => {
    return clientes[clienteId] || null;
  }, [clientes]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  return {
    clientes,
    loading,
    error,
    getClienteNombre,
    getCliente,
    reload: loadClientes
  };
};
