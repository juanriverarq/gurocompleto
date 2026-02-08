import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const CTAGradient = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-14 sm:py-28 bg-white">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="bg-[#f5f5f5] rounded-[28px] overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row">
            {/* Left — text content */}
            <div className="flex-1 p-6 sm:p-12 lg:p-14 flex flex-col justify-center">
              <h2
                className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#0d0d0d] leading-[1.1] tracking-[-0.02em] mb-5"
                style={{ fontFamily: "'General Sans', sans-serif" }}
              >
                Cada día sin Guro
                <span className="hidden sm:inline"><br /></span>{' '}
                es dinero que pierdes
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mb-8 max-w-md">
                Mientras sigues con Excel, tus competidores ya automatizan cobros, cierran renovaciones y atienden clientes con IA. Empieza hoy gratis y ve resultados desde la primera semana.
              </p>

              {/* CTA button */}
              <div>
                <a
                  href="/comenzar"
                  className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[52px] overflow-hidden"
                >
                  <span className="absolute inset-y-0 left-0 w-[52px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
                  <span className="relative z-10 flex items-center justify-center w-[52px] h-full flex-shrink-0">
                    <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-white" />
                  </span>
                  <span className="relative z-10 pl-2 pr-5 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
                    Comienza gratis
                  </span>
                </a>
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
