import React from 'react';
import { Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  userName = 'Usuario'
}) => {
  const handleGetStarted = () => {
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="lg">
      <Modal.Header className="border-b-0 pb-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Icon icon="solar:hand-stars-bold" height={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            ¡Bienvenido a GURO!
          </span>
        </div>
      </Modal.Header>
      
      <Modal.Body className="pt-2">
        <div className="space-y-6">
          {/* Saludo personalizado */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              ¡Hola {userName}! 👋
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Nos alegra tenerte aquí. Te ayudaremos a comenzar con tu plataforma de seguros.
            </p>
          </div>

          {/* Características principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                <Icon icon="solar:shield-check-bold" height={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Gestión de Pólizas
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Administra todas tus pólizas de seguros en un solo lugar
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex-shrink-0">
                <Icon icon="solar:users-group-two-rounded-bold" height={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Clientes
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Mantén un registro completo de todos tus clientes
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex-shrink-0">
                <Icon icon="solar:document-text-bold" height={20} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Siniestros
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Gestiona y da seguimiento a los siniestros
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                <Icon icon="solar:chart-2-bold" height={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Reportes
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Analiza tu negocio con reportes detallados
                </p>
              </div>
            </div>
          </div>

          {/* Video tutorial */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-3">
              <Icon icon="solar:play-circle-bold" height={24} className="text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Tutorial: Figuro Engage
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Aprende a utilizar Figuro Engage en menos de 15 minutos con nuestro tutorial interactivo.
            </p>
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Icon icon="solar:clock-circle-bold" height={16} />
              <span>15 minutos</span>
              <span className="mx-2">•</span>
              <Icon icon="solar:eye-bold" height={16} />
              <span>Tutorial interactivo</span>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer className="border-t-0 pt-0">
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700 transition-colors"
          >
            Omitir por ahora
          </button>
          <button
            onClick={handleGetStarted}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-center gap-2">
              <span>¡Comenzar!</span>
              <Icon icon="solar:arrow-right-bold" height={16} />
            </div>
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default WelcomeModal;