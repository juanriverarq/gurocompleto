import React, { useState, useEffect } from 'react';
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

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#fafafa] dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition text-sm text-[#0d0d0d] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ fontFamily: "'General Sans', sans-serif" }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header with background image */}
        <div className="relative overflow-hidden" style={{ minHeight: '160px' }}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
              backgroundSize: '200%',
              backgroundPosition: 'center',
              transform: 'rotate(180deg)',
            }}
          />
          <div className="relative z-10 p-6 pb-5 flex flex-col justify-end h-full" style={{ minHeight: '160px' }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm w-fit mb-3">
              <span className="w-4 h-4 rounded-full bg-white text-[#573CFF] text-[9px] font-bold flex items-center justify-center">3</span>
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wider">Último paso</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-[-0.02em] mb-1">
              Datos de tu empresa
            </h2>
            <p className="text-white/60 text-sm">
              Completa la información de tu agencia para configurar tu cuenta
            </p>
          </div>
        </div>

        {/* Form body — white */}
        <div className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0d0d0d] dark:text-gray-200 mb-1.5">
                  Nombre comercial <span className="text-[#573CFF]">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Mi Agencia de Seguros"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0d0d0d] dark:text-gray-200 mb-1.5">
                  Razón social
                </label>
                <input
                  type="text"
                  name="legal_name"
                  value={formData.legal_name}
                  onChange={handleChange}
                  placeholder="Mi Agencia S.A.S."
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0d0d0d] dark:text-gray-200 mb-1.5">
                  Tipo documento
                </label>
                <select
                  name="document_type"
                  value={formData.document_type}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="NIT" className="dark:bg-gray-800">NIT</option>
                  <option value="CC" className="dark:bg-gray-800">Cédula</option>
                  <option value="CE" className="dark:bg-gray-800">Cédula Extranjería</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#0d0d0d] dark:text-gray-200 mb-1.5">
                  Número de documento <span className="text-[#573CFF]">*</span>
                </label>
                <input
                  type="text"
                  name="document_number"
                  value={formData.document_number}
                  onChange={handleChange}
                  placeholder="900123456-7"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0d0d0d] dark:text-gray-200 mb-1.5">
                  Teléfono <span className="text-[#573CFF]">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+57 300 123 4567"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0d0d0d] dark:text-gray-200 mb-1.5">
                  Ciudad <span className="text-[#573CFF]">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Bogotá"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0d0d0d] dark:text-gray-200 mb-1.5">
                Dirección
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Calle 100 #15-20, Oficina 501"
                className={inputClass}
              />
            </div>
          </div>

          {/* Error message */}
          {formError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold" className="text-lg flex-shrink-0" />
              {formError}
            </div>
          )}

          {/* Submit button — Hero style */}
          <div className="mt-6">
            <button
              onClick={handleSaveBrokerData}
              disabled={isLoading}
              className="group relative w-full inline-flex items-center justify-center bg-[#0d0d0d] rounded-2xl h-[48px] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-y-0 left-0 w-[48px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
              <span className="relative z-10 flex items-center justify-center w-[48px] h-full flex-shrink-0">
                {isLoading ? (
                  <Icon icon="svg-spinners:ring-resize" className="text-lg text-white" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                )}
              </span>
              <span className="relative z-10 pr-5 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
                {isLoading ? 'Guardando...' : 'Guardar y Continuar'}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-gray-400 text-center mt-4">
            Podrás editar esta información después en Configuración → Perfil
          </p>
        </div>
      </div>
    </div>
  );
};

export default FirstTimeOnboardingModal;
