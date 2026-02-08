import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useEffect } from 'react';

interface CalendlyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CALENDLY_URL = 'https://calendly.com/gurocontable-info/30min?hide_event_type_details=1&hide_gdpr_banner=1';

const CalendlyModal = ({ isOpen, onClose }: CalendlyModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-4 sm:inset-8 md:inset-12 lg:inset-16 z-[9999] flex flex-col bg-white rounded-[24px] shadow-2xl overflow-hidden"
            style={{ fontFamily: "'General Sans', sans-serif" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#573CFF]/10 flex items-center justify-center">
                  <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-[#573CFF]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0d0d0d] tracking-[-0.01em]">Agenda una demo</h3>
                  <p className="text-xs text-gray-400">30 minutos con nuestro equipo</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <Icon icon="solar:close-circle-linear" className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Calendly iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={CALENDLY_URL}
                width="100%"
                height="100%"
                frameBorder="0"
                title="Agendar reunión con Guro"
                style={{ minHeight: '100%' }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CalendlyModal;
