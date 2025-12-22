import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import saasApi from 'src/services/saasApi';

interface Terminologia {
  vendedor: string;
  vendedorPlural: string;
}

interface TerminologiaContextType {
  terminologia: Terminologia;
  loading: boolean;
  refetch: () => Promise<void>;
}

const defaultTerminologia: Terminologia = {
  vendedor: 'Vendedor',
  vendedorPlural: 'Vendedores',
};

const TerminologiaContext = createContext<TerminologiaContextType>({
  terminologia: defaultTerminologia,
  loading: true,
  refetch: async () => {},
});

export const useTerminologia = () => useContext(TerminologiaContext);

// Helper para obtener el plural
const getPlural = (singular: string): string => {
  const plurales: Record<string, string> = {
    'Vendedor': 'Vendedores',
    'Asesor': 'Asesores',
    'Agente': 'Agentes',
    'Ejecutivo': 'Ejecutivos',
    'Comercial': 'Comerciales',
    'Representante': 'Representantes',
  };
  return plurales[singular] || `${singular}es`;
};

export const TerminologiaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [terminologia, setTerminologia] = useState<Terminologia>(defaultTerminologia);
  const [loading, setLoading] = useState(true);

  const fetchTerminologia = async () => {
    try {
      const headers = await saasApi.getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
        { headers }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data?.success && data?.data?.settings?.terminologia) {
          const term = data.data.settings.terminologia;
          setTerminologia({
            vendedor: term.vendedor || 'Vendedor',
            vendedorPlural: getPlural(term.vendedor || 'Vendedor'),
          });
        }
      }
    } catch (e) {
      console.warn('Error cargando terminología:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerminologia();
  }, []);

  return (
    <TerminologiaContext.Provider value={{ terminologia, loading, refetch: fetchTerminologia }}>
      {children}
    </TerminologiaContext.Provider>
  );
};

export default TerminologiaContext;
