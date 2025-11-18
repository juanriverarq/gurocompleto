import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from 'flowbite-react';

const EditarLead: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Redirigir a la lista inmediatamente
  useEffect(() => {
    navigate('/apps/saas/sales-funnel');
  }, [navigate, id]);

  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner size="lg" />
      <span className="ml-3">Redirigiendo...</span>
    </div>
  );
};

export default EditarLead;
