import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icon } from '@iconify/react';

const pillars = [
  {
    icon: 'solar:rocket-2-bold-duotone',
    title: 'Cada renovación olvidada es dinero que se va',
    desc: 'Nuestras alertas automáticas y llamadas con IA han recuperado +40% de renovaciones que antes se perdían. Eso es dinero real de vuelta a tu bolsillo.',
  },
  {
    icon: 'solar:cpu-bolt-bold-duotone',
    title: 'Tu equipo pierde 80% del tiempo en tareas que una IA hace en segundos',
    desc: 'Cotizar, cobrar, registrar, reportar. Todo lo que hoy toma horas, Guro lo resuelve al instante. Tu equipo se dedica a vender.',
  },
  {
    icon: 'solar:users-group-two-rounded-bold-duotone',
    title: 'Tus clientes llaman a las 11pm y nadie contesta',
    desc: 'Con Guro, un chatbot y llamadas IA atienden 24/7 sin contratar a nadie más. Cero costos adicionales, cero clientes perdidos.',
  },
  {
    icon: 'solar:heart-bold-duotone',
    title: 'Las herramientas gringas no entienden tu mercado',
    desc: 'Guro nació en Colombia, para agencias latinas. Multi-moneda, regulación local, soporte en español. Hecho por gente que entiende tu negocio.',
  },
];

const Results = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      ref={ref}
      id="resultados"
      className="relative overflow-hidden min-h-[auto] sm:min-h-screen flex flex-col justify-center"
      style={{
        backgroundImage: 'url(https://framerusercontent.com/images/6vqDsl7xtgechRbMSo6yAkGE.png?scale-down-to=512&width=2160&height=1658)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="py-16 sm:py-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 sm:mb-20 px-4"
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-[#0d0d0d] sm:text-white leading-[1.1] tracking-[-0.02em] mb-4"
            style={{ fontFamily: "'General Sans', sans-serif" }}
          >
            Nuestro impacto en la
            <span className="hidden sm:inline"><br /></span>{' '}
            industria de seguros
          </h2>
          <p className="text-gray-500 sm:text-white/60 text-base sm:text-lg max-w-2xl mx-auto">
            Estamos trabajando para que cada agencia en Latinoamérica tenga acceso a tecnología de clase mundial. Este es solo el comienzo.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 lg:px-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.15 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.3 } }}
              className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg shadow-black/[0.06] flex flex-col cursor-default"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#573CFF]/10 flex items-center justify-center mb-5">
                <Icon icon={pillar.icon} className="w-6 h-6 text-[#573CFF]" />
              </div>

              {/* Title */}
              <h3
                className="text-lg font-bold text-[#0d0d0d] mb-2"
                style={{ fontFamily: "'General Sans', sans-serif" }}
              >
                {pillar.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-500 leading-relaxed">
                {pillar.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Results;
