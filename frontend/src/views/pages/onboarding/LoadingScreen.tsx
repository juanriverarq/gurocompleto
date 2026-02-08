import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { Icon } from '@iconify/react';
import LogoSvg from 'src/assets/images/logos/Logo.svg';

interface LoadingScreenProps {
  onComplete: () => void;
}

const LOADING_STEPS = [
  { text: 'Creando tu espacio de trabajo', icon: 'solar:buildings-3-bold-duotone', sub: 'Configurando tu cuenta...' },
  { text: 'Activando aplicaciones', icon: 'solar:settings-bold-duotone', sub: 'Preparando tus herramientas...' },
  { text: 'Preparando panel de control', icon: 'solar:chart-square-bold-duotone', sub: 'Organizando tu dashboard...' },
  { text: 'Conectando inteligencia artificial', icon: 'solar:cpu-bolt-bold-duotone', sub: 'Entrenando tu asistente...' },
  { text: 'Optimizando experiencia', icon: 'solar:stars-minimalistic-bold-duotone', sub: 'Últimos ajustes...' },
  { text: '¡Todo listo!', icon: 'solar:rocket-2-bold-duotone', sub: 'Bienvenido a Guro' },
];

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Cambiar mensaje cada 1.5 segundos
    const messageInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 1500);

    // Mostrar confetti al final
    const confettiTimeout = setTimeout(() => {
      setShowConfetti(true);
      setIsComplete(true);
    }, (LOADING_STEPS.length - 1) * 1500);

    // Completar después de mostrar confetti
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, (LOADING_STEPS.length - 1) * 1500 + 2500);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(confettiTimeout);
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  const step = LOADING_STEPS[currentStep];
  const progress = ((currentStep + 1) / LOADING_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex" style={{ fontFamily: "'General Sans', sans-serif" }}>
      {/* Left — background image panel */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden">
        {/* Background image from landing */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url(https://framerusercontent.com/images/6vqDsl7xtgechRbMSo6yAkGE.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'bottom center',
            backgroundRepeat: 'no-repeat',
            transform: 'rotate(180deg)',
          }}
        />

        {/* Content over image */}
        <div className="relative z-10 flex flex-col p-12 xl:p-16 w-full h-full">
          {/* Logo */}
          <img src={LogoSvg} alt="Guro" className="h-10 w-auto" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Animated step checklist */}
          <div className="max-w-sm mb-16">
            <div className="space-y-3">
              {LOADING_STEPS.map((s, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{
                    opacity: i <= currentStep ? 1 : 0.3,
                    x: 0,
                  }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    i < currentStep
                      ? 'bg-white'
                      : i === currentStep
                        ? 'bg-white/20 ring-2 ring-white/40'
                        : 'bg-white/10'
                  }`}>
                    {i < currentStep ? (
                      <svg className="w-3.5 h-3.5 text-[#573CFF]" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : i === currentStep ? (
                      <motion.div
                        className="w-2 h-2 rounded-full bg-white"
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    )}
                  </div>
                  <span className={`text-sm font-medium transition-all duration-300 ${
                    i <= currentStep ? 'text-white' : 'text-white/30'
                  }`}>
                    {s.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="flex items-center gap-8">
            <div>
              <div className="text-2xl font-bold text-white">500+</div>
              <div className="text-xs text-white/50">Agencias activas</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <div className="text-2xl font-bold text-white">1M+</div>
              <div className="text-xs text-white/50">Pólizas gestionadas</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <div className="text-2xl font-bold text-white">4.8/5</div>
              <div className="text-xs text-white/50">Calificación</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right — loading content */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white relative overflow-hidden">
        {/* Subtle gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#573CFF]/[0.03] via-transparent to-[#573CFF]/[0.02]" />

        <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-md text-center">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <img src={LogoSvg} alt="Guro" className="h-8 w-auto" />
          </div>

          {/* Animated icon */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ duration: 0.4 }}
              className="mb-8"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="w-20 h-20 rounded-3xl bg-[#0d0d0d] flex items-center justify-center"
                  style={{ boxShadow: '0 20px 60px rgba(87,60,255,0.15)' }}
                >
                  <Icon icon={step.icon} className="text-white text-4xl" />
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="mb-10"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0d0d0d] tracking-[-0.02em] mb-2">
                {step.text}
              </h2>
              <p className="text-gray-400 text-sm">
                {step.sub}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Progress bar */}
          <div className="w-full max-w-xs">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #573CFF, #7c3aed)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-3">
              <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
              <span className="text-xs text-gray-400">Paso {currentStep + 1} de {LOADING_STEPS.length}</span>
            </div>
          </div>

          {/* Step dots — mobile */}
          <div className="flex gap-2 mt-8 lg:hidden">
            {LOADING_STEPS.map((_, i) => (
              <motion.div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= currentStep ? 'bg-[#573CFF] w-6' : 'bg-gray-200 w-1.5'
                }`}
              />
            ))}
          </div>

          {/* Redirect message */}
          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#573CFF]/5">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Icon icon="svg-spinners:ring-resize" className="text-[#573CFF] text-sm" />
                  </motion.div>
                  <span className="text-xs font-semibold text-[#573CFF]">Redirigiendo a tu panel de control...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
          gravity={0.3}
          colors={['#573CFF', '#7c3aed', '#a78bfa', '#c4b5fd', '#ffffff', '#60a5fa']}
        />
      )}
    </div>
  );
};

export default LoadingScreen;
