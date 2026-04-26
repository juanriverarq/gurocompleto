import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const MediaSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-16 sm:py-24 bg-transparent">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10 sm:mb-14"
        >
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#573CFF] mb-3">
            Medios
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white leading-[1.1] tracking-[-0.02em]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
          >
            Hablan <span className="landing-grad-text">de nosotros</span>
          </h2>
        </motion.div>

        <motion.a
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -6, transition: { duration: 0.3 } }}
          href="https://www.elcolombiano.com/informes-comerciales/las-marcas-hablan/guro-empresa-colombiana-cerebro-tecnologico-sector-asegurador-KI34873988"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="group block max-w-4xl mx-auto bg-white/5 rounded-2xl border border-white/10 hover:border-[#573CFF]/50 hover:bg-white/[0.07] hover:shadow-2xl hover:shadow-[#573CFF]/10 transition-all duration-300 overflow-hidden"
        >
          <div className="flex flex-col md:flex-row">
            {/* Team photo */}
            <div className="relative w-full md:w-[55%] aspect-[4/3] md:aspect-auto md:min-h-[320px] overflow-hidden bg-white/5">
              <img
                src="https://estaticos.elcolombiano.com/binrepository/780x601/1c0/780d565/none/11101/QTBK/foto-equipo-guro_50223610_20260324111035.webp"
                alt="Equipo Guro en El Colombiano"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
            </div>

            {/* Text content */}
            <div className="flex-1 p-6 sm:p-10 flex flex-col justify-center">
              <img
                src="https://www.elcolombiano.com/base-portlet/webrsrc/theme/a8ba17da88bdcd36a128f3553b116de7.svg"
                alt="El Colombiano"
                className="h-8 sm:h-10 w-auto object-contain self-start mb-5 brightness-0 invert"
                loading="lazy"
              />
              <h3
                className="text-[1.25rem] sm:text-[1.5rem] font-bold text-white leading-[1.2] tracking-tight mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
              >
                Guro, la empresa colombiana que es el cerebro tecnológico del sector asegurador
              </h3>
              <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#573CFF] group-hover:gap-3 transition-all duration-300">
                Leer artículo
                <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
              </div>
            </div>
          </div>
        </motion.a>
      </div>
    </section>
  );
};

export default MediaSection;
