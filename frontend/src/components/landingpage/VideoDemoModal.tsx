import { Modal } from "flowbite-react";
import { useEffect, useRef, useState } from "react";
import demoVideo from "/src/assets/videos/Guro Página web prueba final 2.mp4";

type VideoDemoModalProps = {
  open: boolean;
  onClose: () => void;
};

const VideoDemoModal = ({ open, onClose }: VideoDemoModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (open) {
      // Intentar reproducir con sonido; si falla, fallback a mute
      el.muted = false;
      el.play().catch(() => {
        el.muted = true;
        setIsMuted(true);
        el.play().catch(() => {
          // si incluso con mute falla, dejar que el usuario pulse play
        });
      });
    } else {
      try {
        el.pause();
        el.currentTime = 0;
      } catch (_) {
        // noop
      }
      setIsMuted(false);
    }
  }, [open]);

  return (
    <Modal show={open} onClose={onClose} size="7xl" dismissible>
      <div className="p-0">
        <div className="relative w-full bg-black rounded-2xl overflow-hidden">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            ✕
          </button>
          {isMuted && (
            <button
              type="button"
              onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                el.muted = false;
                setIsMuted(false);
                el.play().catch(() => {
                  // si el navegador sigue bloqueando, el usuario puede usar los controles
                });
              }}
              className="absolute left-3 bottom-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
            >
              Activar sonido
            </button>
          )}
          <video
            ref={videoRef}
            src={demoVideo}
            controls
            playsInline
            autoPlay
            muted={isMuted}
            preload="metadata"
            className="w-full h-auto"
          />
        </div>
      </div>
    </Modal>
  );
};

export default VideoDemoModal;


