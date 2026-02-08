import React, { useState } from 'react';
import WelcomeModal from './modals/WelcomeModal';

const TestWelcomeModal: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  const handleOpenModal = () => {
    // Limpiar localStorage para simular un nuevo usuario
    localStorage.removeItem('guro_welcome_modal_shown');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Prueba de Modal de Bienvenida
        </h1>
        <p className="text-gray-600 mb-6">
          Haz clic en el botón para probar la modal de bienvenida para nuevos usuarios.
        </p>
        
        <div className="space-y-4">
          <button
            onClick={handleOpenModal}
            className="w-full px-4 py-2 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors"
          >
            Mostrar Modal de Bienvenida
          </button>
          
          <button
            onClick={() => localStorage.removeItem('guro_welcome_modal_shown')}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-4 focus:ring-gray-300 transition-colors"
          >
            Limpiar Estado (Simular Nuevo Usuario)
          </button>
          
          <div className="text-sm text-gray-500">
            <p><strong>Estado actual:</strong></p>
            <p>Modal vista: {localStorage.getItem('guro_welcome_modal_shown') ? 'Sí' : 'No'}</p>
          </div>
        </div>
      </div>

      <WelcomeModal 
        isOpen={showModal}
        onClose={handleCloseModal}
        userName="Usuario de Prueba"
      />
    </div>
  );
};

export default TestWelcomeModal;