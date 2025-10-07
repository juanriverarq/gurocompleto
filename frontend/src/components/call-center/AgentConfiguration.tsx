import React from 'react';

const AgentConfiguration: React.FC = () => {
  return (
    <div className="p-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold text-yellow-800 mb-2">
          Configuración de Agente en Mantenimiento
        </h2>
        <p className="text-yellow-700">
          Esta sección está temporalmente deshabilitada para completar el despliegue.
          Será restaurada en la próxima actualización.
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Próximamente disponible
        </h3>
        <p className="text-gray-600">
          La configuración completa del agente estará disponible después del despliegue.
        </p>
      </div>
    </div>
  );
};

export default AgentConfiguration;
