import { Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useRef, useEffect, useState } from 'react';
import demoVideo from '/src/assets/videos/Guro Página web prueba final 2.mp4';
import type { ModuleItem } from './modules';

interface Props {
  open: boolean;
  onClose: () => void;
  module?: ModuleItem | null;
}

export default function ModuleInfoModal({ open, onClose, module }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (open) {
      el.muted = false;
      el.play().catch(() => {
        el.muted = true;
        setIsMuted(true);
        el.play().catch(() => {});
      });
    } else {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {}
      setIsMuted(false);
    }
  }, [open]);

  const title = module?.name || 'Módulo';
  const desc = module?.description || 'Descripción no disponible por el momento.';

  return (
    <Modal show={open} onClose={onClose} size="7xl" dismissible>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="text-sm text-gray-600 mt-1 max-w-3xl">{desc}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
            <Icon icon="solar:close-circle-bold" />
          </button>
        </div>
        <div className="relative w-full bg-black rounded-2xl overflow-hidden">
          {isMuted && (
            <button
              type="button"
              onClick={() => {
                const el = videoRef.current; if (!el) return; el.muted = false; setIsMuted(false); el.play().catch(() => {});
              }}
              className="absolute left-3 bottom-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
            >
              Activar sonido
            </button>
          )}
          <video ref={videoRef} src={demoVideo} controls playsInline autoPlay muted={isMuted} preload="metadata" className="w-full h-auto" />
        </div>
      </div>
    </Modal>
  );
}
