import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@iconify/react';
import VoiceAssistantModal from '../../../../components/voice-assistant/VoiceAssistantModal';

const MobilePreview = () => {
  const navigate = useNavigate();
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const handleMobileCustomizer = () => {
    navigate('/apps/customizer/mobile');
  };

  const handleVoiceAssistant = () => {
    setIsVoiceModalOpen(true);
  };

  return (
    <>
      <div className="flex gap-2">
        {/* Botón Micrófono - Resaltado (Primero) */}
        <div
          className="h-10 w-10 focus:ring-0 rounded-lg border-2 border-primary/20 flex justify-center items-center cursor-pointer text-white bg-primary dark:bg-primary shadow-md transition-all duration-200 hover:shadow-lg hover:scale-105 hover:bg-primary/90 hover:border-primary/30"
          onClick={handleVoiceAssistant}
          title="Asistente de Voz IA"
        >
          <span className="flex items-center">
            <Icon icon="solar:microphone-line-duotone" width="20" />
          </span>
        </div>

        {/* Botón Smartphone (Segundo) */}
        <div
          className="h-10 w-10 hover:text-primary hover:bg-lightprimary dark:hover:bg-darkminisidebar dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-darklink dark:text-white"
          onClick={handleMobileCustomizer}
          title="Personalizar App Móvil"
        >
          <span className="flex items-center">
            <Icon icon="solar:smartphone-line-duotone" width="20" />
          </span>
        </div>
      </div>

      {/* Modal del Asistente de Voz */}
      <VoiceAssistantModal 
        isOpen={isVoiceModalOpen} 
        onClose={() => setIsVoiceModalOpen(false)} 
      />
    </>
  );
};

export default MobilePreview; 