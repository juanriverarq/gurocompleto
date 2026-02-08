import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const logos = [
  { name: 'SURA', url: 'https://images.seeklogo.com/logo-png/32/1/sura-logo-png_seeklogo-328191.png', highlight: true },
  { name: 'Seguros Bolívar', url: 'https://d1yjjnpx0p53s8.cloudfront.net/styles/logo-thumbnail/s3/032019/seguros_bolivar.jpg?Kv_sRIqG71PgCVryIyJxZ48DlEBN3xJt&itok=YAoRdSt8', big: true },
  { name: 'HDI Seguros', url: 'https://www.hdi.cl/media/506086/microsoftteams-image-58.png' },
  { name: 'Allianz', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Allianz.svg/1280px-Allianz.svg.png' },
  { name: 'MAPFRE', url: 'https://images.seeklogo.com/logo-png/19/1/mapfre-logo-png_seeklogo-192716.png' },
  { name: 'AXA Colpatria', url: 'https://1000logos.net/wp-content/uploads/2017/12/Color-Axa-logo.jpg' },
  { name: 'La Previsora', url: 'https://www.funcionpublica.gov.co/documents/d/guest/logo-previsora_mesa-de-trabajo-1-png' },
  { name: 'Seguros Mundial', url: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Logo_mundial_seguros.png' },
  { name: 'Seguros del Estado', url: 'https://static.wikia.nocookie.net/logopedia/images/c/cd/Seguros_del_Estado_S.A..svg/revision/latest/scale-to-width-down/310?cb=20240111195041' },
  { name: 'Equidad Seguros', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Equidad_Seguros_%28Colombia%29_logo.svg/512px-Equidad_Seguros_%28Colombia%29_logo.svg.png' },
];

const LogoStrip = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <section ref={ref} className="py-10 sm:py-14 bg-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Sura highlight badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-2 bg-[#573CFF]/5 border border-[#573CFF]/10 rounded-full px-4 py-1.5">
            <Icon icon="solar:verified-check-bold" className="w-4 h-4 text-[#573CFF]" />
            <span className="text-xs font-bold text-[#573CFF] uppercase tracking-[0.1em]">
              Proveedores oficiales de SURA
            </span>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center text-[11px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-8"
        >
          Integrados con las principales aseguradoras
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-10 sm:gap-14"
        >
          {logos.map((logo, i) => (
            <motion.div
              key={logo.name}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.2 + i * 0.05 }}
              className={`flex items-center justify-center ${
                logo.highlight
                  ? 'w-[120px] h-[60px] sm:w-[150px] sm:h-[66px]'
                  : logo.big
                    ? 'w-[160px] h-[80px] sm:w-[200px] sm:h-[88px]'
                    : 'w-[80px] h-[40px] sm:w-[100px] sm:h-[44px]'
              }`}
            >
              <img
                src={logo.url}
                alt={logo.name}
                className="max-w-full max-h-full object-contain"
                style={{ filter: 'grayscale(100%)', opacity: 0.35 }}
                loading="lazy"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default LogoStrip;
