import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import SyncButton from './SyncButton';

const CTAGradient = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-14 sm:py-28 bg-transparent">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white/5 border border-white/10 rounded-[28px] overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row">
            {/* Left — text content */}
            <div className="flex-1 p-6 sm:p-12 lg:p-14 flex flex-col justify-center">
              <h2
                className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white leading-[1.1] tracking-[-0.02em] mb-5"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
              >
                Cada día sin Guro
                <span className="hidden sm:inline"><br /></span>{' '}
                <span className="landing-grad-text">es dinero que pierdes</span>
              </h2>
              <p className="text-white/60 text-[15px] leading-relaxed mb-8 max-w-md">
                Mientras sigues con Excel, tus competidores ya automatizan cobros, cierran renovaciones y atienden clientes con IA. Da el paso y ve resultados desde la primera semana.
              </p>

              <div>
                <SyncButton href="/comenzar" size="md">Comenzar</SyncButton>
              </div>
            </div>

            {/* Right — gradient image with decorative 3D elements */}
            <div className="relative lg:w-[45%] min-h-[280px] sm:min-h-[320px] overflow-hidden">
              {/* Gradient background */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              {/* Decorative floating elements */}
              <div className="relative z-10 flex items-center justify-center h-full p-8">
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(9)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                      animate={isInView ? {
                        opacity: 1,
                        scale: 1,
                        rotate: -10 + i * 5,
                        y: [0, i % 2 === 0 ? -6 : 6, 0],
                      } : {}}
                      transition={{
                        opacity: { delay: 0.3 + i * 0.06, duration: 0.4 },
                        scale: { delay: 0.3 + i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                        rotate: { delay: 0.3 + i * 0.06, duration: 0.5 },
                        y: { delay: 0.8 + i * 0.06, duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
                      }}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#573CFF]/80 backdrop-blur-sm shadow-lg"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTAGradient;
