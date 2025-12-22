import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { Icon } from '@iconify/react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const LOADING_MESSAGES = [
  { text: 'Creando tu espacio de trabajo...', icon: 'solar:buildings-3-bold-duotone' },
  { text: 'Configurando tus aplicaciones...', icon: 'solar:settings-bold-duotone' },
  { text: 'Preparando tu panel de control...', icon: 'solar:chart-square-bold-duotone' },
  { text: 'Activando inteligencia artificial...', icon: 'solar:cpu-bolt-bold-duotone' },
  { text: 'Optimizando tu experiencia...', icon: 'solar:stars-minimalistic-bold-duotone' },
  { text: '¡Todo listo! Bienvenido a Guro', icon: 'solar:rocket-2-bold-duotone' },
];

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Cambiar mensaje cada 1.5 segundos
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        if (prev < LOADING_MESSAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1500);

    // Mostrar confetti al final
    const confettiTimeout = setTimeout(() => {
      setShowConfetti(true);
      setIsComplete(true);
    }, (LOADING_MESSAGES.length - 1) * 1500);

    // Completar después de mostrar confetti
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, (LOADING_MESSAGES.length - 1) * 1500 + 2500);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(confettiTimeout);
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  const currentMessage = LOADING_MESSAGES[currentMessageIndex];

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Fondo oscuro con gradientes */}
      <div className="absolute inset-0 bg-[#0a0a0f]">
        {/* Gradientes de fondo */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#635bff]/20 via-transparent to-[#7c3aed]/20" />
        
        {/* Orbes de luz animados */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99,91,255,0.3) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: ['-20%', '20%', '-20%'],
            y: ['-20%', '30%', '-20%'],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        <motion.div
          className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: ['20%', '-20%', '20%'],
            y: ['20%', '-30%', '20%'],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="absolute left-1/2 top-1/2 w-[400px] h-[400px] rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{
            background: 'radial-gradient(circle, rgba(99,91,255,0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Partículas flotantes */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#635bff]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.4,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Líneas de luz */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-[#635bff]/50 to-transparent"
            style={{ top: '30%' }}
            animate={{
              x: ['-100%', '100%'],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
          <motion.div
            className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-[#7c3aed]/40 to-transparent"
            style={{ top: '70%' }}
            animate={{
              x: ['100%', '-100%'],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'linear',
              delay: 1,
            }}
          />
        </div>
      </div>

      {/* Contenido central */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Mensaje actual con animación */}
        <div className="h-40 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMessageIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <motion.div
                className="mb-6 flex justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#635bff] to-[#7c3aed] flex items-center justify-center"
                  style={{
                    boxShadow: '0 0 40px rgba(99,91,255,0.4)',
                  }}
                >
                  <Icon icon={currentMessage.icon} className="text-white text-3xl" />
                </div>
              </motion.div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {currentMessage.text}
              </h2>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Barra de progreso */}
        <div className="w-64 sm:w-80 mt-8">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#635bff] to-[#7c3aed] rounded-full"
              initial={{ width: '0%' }}
              animate={{ 
                width: `${((currentMessageIndex + 1) / LOADING_MESSAGES.length) * 100}%` 
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <p className="text-white/40 text-sm mt-3 text-center">
            {Math.round(((currentMessageIndex + 1) / LOADING_MESSAGES.length) * 100)}% completado
          </p>
        </div>

        {/* Indicadores de pasos */}
        <div className="flex gap-2 mt-8">
          {LOADING_MESSAGES.map((_, index) => (
            <motion.div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index <= currentMessageIndex ? 'bg-[#635bff]' : 'bg-white/20'
              }`}
              animate={index === currentMessageIndex ? {
                scale: [1, 1.3, 1],
              } : {}}
              transition={{ duration: 0.5 }}
            />
          ))}
        </div>

        {/* Mensaje final */}
        <AnimatePresence>
          {isComplete && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white/60 text-sm mt-8"
            >
              Redirigiendo a tu panel de control...
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
          gravity={0.3}
          colors={['#635bff', '#7c3aed', '#a78bfa', '#c4b5fd', '#ffffff', '#60a5fa']}
        />
      )}
    </div>
  );
};

export default LoadingScreen;
