import React, { useState, useEffect } from 'react';
import whatsappMicroservice from '@/services/whatsappMicroservice';

const WhatsappInstancesManager: React.FC = () => {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const response = await whatsappMicroservice.getInstances();
      if (response.success && response.data) {
        setInstances(response.data);
      } else {
        alert('Error al cargar instancias');
      }
    } catch (error) {
      console.error('Error al obtener instancias:', error);
      alert('Error al obtener instancias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Instancias de WhatsApp</h2>
      {loading ? (
        <p>Cargando instancias...</p>
      ) : (
        <ul>
          {instances.map((instance) => (
            <li key={instance.id}>
              {instance.phone_number} - {instance.status}
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={loadInstances}
        className="text-white px-4 py-2 rounded"
      >
        Actualizar
      </button>
    </div>
  );
};

export default WhatsappInstancesManager;

