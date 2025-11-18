import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from 'flowbite-react';

const NuevoLead: React.FC = () => {
  const navigate = useNavigate();
  
  // Redirigir a la lista inmediatamente
  useEffect(() => {
    navigate('/apps/saas/sales-funnel/lista');
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner size="lg" />
      <span className="ml-3">Redirigiendo...</span>
    </div>
  );
};

export default NuevoLead;
