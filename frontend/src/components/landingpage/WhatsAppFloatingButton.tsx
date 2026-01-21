import { useState } from 'react';
import { Icon } from '@iconify/react';

const WHATSAPP_NUMBER = '573001009305';
const WHATSAPP_MESSAGE = 'Hola, me interesa conocer más sobre Guro';

const WhatsAppFloatingButton = () => {
  const [isHovered, setIsHovered] = useState(false);

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip */}
      <div
        className={`
          bg-white rounded-lg shadow-lg px-4 py-2 text-sm font-medium text-gray-700
          transition-all duration-300 transform
          ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
        `}
      >
        ¿Necesitas ayuda?
      </div>

      {/* Button */}
      <div className="relative">
        {/* Pulse animation */}
        <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-25" />
        
        {/* Main button */}
        <div className="relative w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
          <Icon 
            icon="logos:whatsapp-icon" 
            className="text-3xl"
          />
        </div>
      </div>
    </a>
  );
};

export default WhatsAppFloatingButton;
