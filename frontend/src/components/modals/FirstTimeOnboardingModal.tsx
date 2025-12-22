import React, { useState, useEffect } from 'react';
import { Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import api from '../../config/api';

interface FirstTimeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Videos tutoriales
const TUTORIAL_VIDEOS = [
  { id: 'jP9d9fq-9_A', title: 'Aseguradoras', duration: '1:45' },
  { id: 'KNasyaCDbxA', title: 'Ramos', duration: '1:44' },
  { id: 'JQqMV4r2TF4', title: 'Clientes', duration: '2:03' },
];

const FirstTimeOnboardingModal: React.FC<FirstTimeOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { tenant } = useUnifiedAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  
  // Form data para completar el broker
  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    document_type: 'NIT',
    document_number: '',
    phone: '',
    address: '',
    city: '',
  });

  // Cargar datos existentes del broker
  useEffect(() => {
    if (tenant) {
      const t = tenant as any;
      setFormData({
        name: t.name || t.nombre || '',
        legal_name: t.legal_name || '',
        document_type: t.document_type || 'NIT',
        document_number: t.document_number || '',
        phone: t.phone || '',
        address: t.address || '',
        city: t.city || '',
      });
    }
  }, [tenant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSaveBrokerData = async () => {
    setIsLoading(true);
    try {
      await api.put('/saas/broker/profile', formData);
      // Marcar onboarding como completado
      localStorage.setItem('guro_onboarding_completed', 'true');
      setCurrentStep(2);
    } catch (error) {
      console.error('Error guardando datos del broker:', error);
      // Continuar de todos modos
      setCurrentStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipToTutorials = () => {
    setCurrentStep(2);
  };

  const handleFinish = () => {
    localStorage.setItem('guro_onboarding_completed', 'true');
    onComplete();
    onClose();
  };

  const videoSrc = `https://www.youtube.com/embed/${TUTORIAL_VIDEOS[activeVideoIndex]?.id}?rel=0&controls=1&modestbranding=1`;

  return (
    <Modal
      show={isOpen}
      onClose={onClose}
      size={currentStep === 1 ? 'lg' : '4xl'}
      dismissible={false}
      className="font-['Manrope',sans-serif]"
    >
      <Modal.Body className="p-0">
        {/* Step 1: Completar datos del broker */}
        {currentStep === 1 && (
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Icon icon="solar:buildings-3-bold-duotone" className="text-white text-2xl" />
              </div>
              <h2 className="text-xl font-bold text-dark dark:text-white mb-2">
                Completa los datos de tu negocio
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Esta información aparecerá en tus documentos y comunicaciones
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700" />
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400 flex items-center justify-center text-sm font-semibold">
                2
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Nombre comercial *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Mi Agencia de Seguros"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-sm text-dark dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Razón social
                  </label>
                  <input
                    type="text"
                    name="legal_name"
                    value={formData.legal_name}
                    onChange={handleChange}
                    placeholder="Mi Agencia S.A.S."
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-sm text-dark dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Tipo documento
                  </label>
                  <select
                    name="document_type"
                    value={formData.document_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-sm text-dark dark:text-white"
                  >
                    <option value="NIT">NIT</option>
                    <option value="CC">Cédula</option>
                    <option value="CE">Cédula Extranjería</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Número de documento *
                  </label>
                  <input
                    type="text"
                    name="document_number"
                    value={formData.document_number}
                    onChange={handleChange}
                    placeholder="900123456-7"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-sm text-dark dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+57 300 123 4567"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-sm text-dark dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Bogotá"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-sm text-dark dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Calle 100 #15-20, Oficina 501"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-darkgray focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition text-sm text-dark dark:text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleSkipToTutorials}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition"
              >
                Completar después
              </button>
              <button
                onClick={handleSaveBrokerData}
                disabled={isLoading}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Icon icon="svg-spinners:ring-resize" className="text-lg" />
                    Guardando...
                  </>
                ) : (
                  <>
                    Continuar
                    <Icon icon="solar:arrow-right-linear" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Tutoriales */}
        {currentStep === 2 && (
          <div className="flex flex-col lg:flex-row">
            {/* Video Section */}
            <div className="flex-1 bg-black">
              <div className="aspect-video">
                <iframe
                  className="w-full h-full"
                  src={videoSrc}
                  title="Tutorial Guro"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-72 bg-white dark:bg-dark p-4 flex flex-col">
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Icon icon="solar:check-circle-bold" className="text-green-600 text-sm" />
                  </div>
                  <span className="text-xs text-green-600 font-medium">Paso 2 de 2</span>
                </div>
                <h3 className="text-lg font-bold text-dark dark:text-white">
                  Tutoriales rápidos
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Aprende lo básico en minutos
                </p>
              </div>

              {/* Video List */}
              <div className="flex-1 space-y-2">
                {TUTORIAL_VIDEOS.map((video, index) => (
                  <button
                    key={video.id}
                    onClick={() => setActiveVideoIndex(index)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left ${
                      activeVideoIndex === index
                        ? 'bg-primary/10 border border-primary/30'
                        : 'bg-gray-50 dark:bg-darkgray hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      activeVideoIndex === index
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}>
                      {activeVideoIndex === index ? (
                        <Icon icon="solar:play-bold" className="text-sm" />
                      ) : (
                        <span className="text-xs font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        activeVideoIndex === index
                          ? 'text-primary'
                          : 'text-dark dark:text-white'
                      }`}>
                        {video.title}
                      </p>
                      <p className="text-xs text-gray-400">{video.duration}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Finish Button */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleFinish}
                  className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                >
                  Comenzar a usar Guro
                  <Icon icon="solar:arrow-right-linear" />
                </button>
                <button
                  onClick={handleFinish}
                  className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  Ver tutoriales después
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default FirstTimeOnboardingModal;
