import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';

export interface TutorialSection {
  label: string;
  seconds: number | string;
}

interface OnboardingTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  title?: string;
  subtitle?: string;
  sections: TutorialSection[];
}

const formatTime = (totalSeconds: number) => {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

const parseTimeToSeconds = (value: number | string): number => {
  if (typeof value === 'number') return Math.max(0, Math.floor(value));
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const minutes = parseInt(m[1], 10);
  const seconds = parseInt(m[2], 10);
  return minutes * 60 + seconds;
};

const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({
  isOpen,
  onClose,
  videoId = 'jP9d9fq-9_A',
  title = 'Tutorial: Guro',
  subtitle = 'Aprende a utilizar Guro en menos de 15 minutos',
  sections = [
    { label: 'Aseguradoras', seconds: '0:00' },
    { label: 'Ramos', seconds: '0:00' },
    { label: 'Clientes', seconds: '0:00' },
  ],
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoSrc, setVideoSrc] = useState('');

  // Videos tutoriales en el orden especificado
  const tutorialVideos = [
    { id: 'jP9d9fq-9_A', title: 'Aseguradoras', duration: '1:45' },
    { id: 'KNasyaCDbxA', title: 'Ramos', duration: '1:44' },
    { id: 'JQqMV4r2TF4', title: 'Clientes', duration: '2:03' },
  ];

  const baseEmbedUrl = useMemo(() => {
    const currentVideoId = tutorialVideos[activeIndex]?.id || videoId;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `https://www.youtube.com/embed/${currentVideoId}?rel=0&controls=1&modestbranding=1&origin=${encodeURIComponent(
      origin,
    )}`;
  }, [activeIndex, videoId]);

  const normalizedSections = useMemo(
    () => tutorialVideos.map(video => ({ label: video.title, seconds: parseTimeToSeconds(video.duration) })),
    []
  );

  useEffect(() => {
    setVideoSrc(`${baseEmbedUrl}&start=0&autoplay=1`);
  }, [baseEmbedUrl]);

  useEffect(() => {
    // Reiniciar al abrir
    if (isOpen) {
      setActiveIndex(0);
    }
  }, [isOpen]);

  const handleSelectSection = (idx: number) => {
    setActiveIndex(idx);
    // El video se actualizará automáticamente por el useEffect
  };

  const onKeyDownSelect = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectSection(idx);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="6xl" className="onboarding-modal-overlay">
      <Modal.Header className="border-b-0 pb-2">
        <div className="flex items-center gap-3">
          <Icon icon="solar:play-circle-bold" height={24} className="text-blue-600 dark:text-blue-400" />
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="pt-2 pb-4">

        {/* Layout en 2 columnas con altura igual */}
        <div className="grid grid-cols-2 gap-4 h-[400px]">
          {/* Video a la izquierda */}
          <div className="h-full">
            <div className="w-full h-full rounded-lg overflow-hidden shadow border border-gray-200 dark:border-gray-700 bg-black">
              <iframe
                key={videoSrc}
                width="100%"
                height="100%"
                src={videoSrc}
                title="Tutorial Guro"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Secciones a la derecha */}
          <div className="h-full">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900 h-full flex flex-col">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Secciones</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Haz clic para ir directamente</p>

              <div className="space-y-1 flex-1 overflow-auto">
                {normalizedSections.map((s, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={`${s.label}-${s.seconds}`}
                      type="button"
                      onClick={() => handleSelectSection(idx)}
                      onKeyDown={(e) => onKeyDownSelect(e, idx)}
                      className={[
                        'w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition focus:outline-none focus:ring-1 focus:ring-blue-500',
                        isActive
                          ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                          : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700',
                      ].join(' ')}
                      aria-current={isActive ? 'step' : undefined}
                      aria-selected={isActive}
                    >
                      <span
                        className={[
                          'inline-flex min-w-[44px] justify-center items-center rounded px-1.5 py-0.5 text-xs font-mono font-semibold',
                          'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                        ].join(' ')}
                      >
                        {formatTime(s.seconds)}
                      </span>

                      <span className="flex-1 text-xs text-gray-800 dark:text-gray-200 truncate">{s.label}</span>

                      <Icon
                        icon={isActive ? 'solar:pause-bold' : 'solar:play-bold'}
                        className="text-gray-400 dark:text-gray-500 flex-shrink-0"
                        height={12}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default OnboardingTutorialModal;