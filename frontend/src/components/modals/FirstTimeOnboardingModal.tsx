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

const FirstTimeOnboardingModal: React.FC<FirstTimeOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { tenant } = useUnifiedAuth();
  const [isLoading, setIsLoading] = useState(false);
  
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

  // Cargar datos existentes del broker (excepto valores genéricos)
  useEffect(() => {
    if (tenant) {
      const t = tenant as any;
      const currentName = t.name || t.nombre || '';
      
      // Patrones de nombres genéricos que no deben precargarse
      const genericNamePatterns = ['Broker de', '- Agencia', 'Mi Agencia'];
      const isGenericName = !currentName || genericNamePatterns.some(pattern => currentName.includes(pattern));
      
      setFormData({
        name: isGenericName ? '' : currentName,
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

  const [formError, setFormError] = useState('');

  const handleSaveBrokerData = async () => {
    setFormError('');
    
    // Validar campos obligatorios
    if (!formData.name.trim()) {
      setFormError('El nombre comercial es obligatorio');
      return;
    }
    if (!formData.document_number.trim()) {
      setFormError('El número de documento es obligatorio');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('El teléfono es obligatorio');
      return;
    }
    if (!formData.city.trim()) {
      setFormError('La ciudad es obligatoria');
      return;
    }
    
    setIsLoading(true);
    try {
      await api.put('/saas/broker/profile', formData);
      // Marcar onboarding como completado
      localStorage.setItem('guro_onboarding_completed', 'true');
      onComplete();
      onClose();
    } catch (error) {
      console.error('Error guardando datos del broker:', error);
      setFormError('Error guardando los datos. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // No permitir cerrar el modal - el usuario DEBE completar el formulario
  const handleModalClose = () => {
    // No hacer nada - el modal es obligatorio
  };

  return (
    <Modal
      show={isOpen}
      onClose={handleModalClose}
      size="lg"
      dismissible={false}
      className="font-['Manrope',sans-serif]"
    >
      <Modal.Body className="p-0">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <Icon icon="solar:buildings-3-bold-duotone" className="text-white text-2xl" />
            </div>
            <h2 className="text-xl font-bold text-dark dark:text-white mb-2">
              Completa los datos de tu empresa
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Esta información es obligatoria para continuar usando la plataforma
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Icon icon="solar:info-circle-bold" className="text-amber-600 text-sm" />
              <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                No podrás cerrar esta ventana hasta completar los datos
              </span>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Nombre comercial <span className="text-red-500">*</span>
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
                  Número de documento <span className="text-red-500">*</span>
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
                  Teléfono <span className="text-red-500">*</span>
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
                  Ciudad <span className="text-red-500">*</span>
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

          {/* Error message */}
          {formError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold" className="text-lg flex-shrink-0" />
              {formError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={handleSaveBrokerData}
              disabled={isLoading}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Icon icon="svg-spinners:ring-resize" className="text-lg" />
                  Guardando...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" className="text-lg" />
                  Guardar y Continuar
                </>
              )}
            </button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default FirstTimeOnboardingModal;
