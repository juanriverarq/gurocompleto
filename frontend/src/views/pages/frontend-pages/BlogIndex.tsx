import { Helmet } from 'react-helmet';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import Navbar from 'src/components/landingpage/framer-landing/Navbar';
import Footer from 'src/components/landingpage/framer-landing/Footer';
import { segurosArticles } from 'src/data/blog/segurosFaq';

const canonicalUrl = 'https://guro.co/blog';

const tagStyle = 'bg-white/[0.05] text-white/50 border-white/[0.08]';

const BlogIndex = () => {
  const pillar = {
    title: 'Software de seguros en Colombia: guía completa',
    description:
      'Pilar con checklist de integraciones, nube, siniestros y cumplimiento. Ideal para compartir con tu equipo.',
    href: '/blog/software-seguros-colombia',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: "'General Sans', sans-serif" }}>
      <Helmet>
        <title>Blog de software de seguros | Guro</title>
        <meta
          name="description"
          content="Explora artículos sobre software de seguros en Colombia: integraciones contables, nube, siniestros en línea, costos y cumplimiento."
        />
        <meta name="keywords" content="blog software seguros, artículos seguros colombia, guía software pólizas, insurtech colombia, CRM seguros" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Blog de software de seguros | Guro" />
        <meta property="og:description" content="Explora artículos sobre software de seguros en Colombia: integraciones contables, nube, siniestros en línea, costos y cumplimiento." />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content="es_CO" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Blog de software de seguros | Guro" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
      </Helmet>

      <Navbar />

      {/* Hero */}
      <section
        className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden"
        style={{
          backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 z-[1] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 200px',
            opacity: 0.18,
          }}
        />
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-white/90 rounded-full text-[11px] font-bold uppercase tracking-[0.15em] mb-6">
              <Icon icon="solar:pen-new-round-bold" className="w-4 h-4" />
              Blog
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-[-0.02em] mb-6">
              Guía y noticias sobre software de seguros
            </h1>
            <p className="text-lg sm:text-xl text-white/60 font-light leading-relaxed max-w-2xl mx-auto">
              Encuentra respuestas prácticas para corredurías y equipos de seguros: integraciones, nube,
              siniestros, precios y cumplimiento normativo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {['Nube', 'IA', 'Integraciones', 'CRM', 'Colombia'].map((tag) => (
                <span key={tag} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tagStyle}`}>
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Article */}
      <section className="relative z-10 -mt-10 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-[1200px] mx-auto"
        >
          <Link
            to={pillar.href}
            className="group block bg-gradient-to-br from-[#1a1a2e] to-[#16162a] rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-[#573CFF]/40 transition-all duration-300 shadow-2xl shadow-black/30"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-3 flex-1">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold bg-[#573CFF]/15 border border-[#573CFF]/30 text-[#573CFF] uppercase tracking-[0.15em]">
                  <Icon icon="solar:star-bold" className="w-3 h-3" />
                  Artículo destacado
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-[-0.02em] group-hover:text-[#573CFF] transition-colors">
                  {pillar.title}
                </h2>
                <p className="text-white/50 text-[15px] leading-relaxed max-w-2xl">{pillar.description}</p>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center gap-2 bg-[#573CFF] text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider group-hover:bg-[#4530cc] transition-colors">
                  Leer guía
                  <Icon icon="solar:arrow-right-linear" className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </section>

      {/* Articles Grid */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {segurosArticles.map((article, index) => (
              <motion.article
                key={article.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.5) }}
                className="group relative bg-[#12121a] rounded-2xl border border-white/[0.06] hover:border-white/15 transition-all duration-300 overflow-hidden flex flex-col"
              >
                <div className="p-6 flex flex-col flex-1 gap-4">
                  <div className="flex gap-2 flex-wrap">
                    {article.tags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${tagStyle}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-lg font-bold text-white leading-snug tracking-[-0.01em] group-hover:text-[#573CFF] transition-colors line-clamp-3">
                    {article.title}
                  </h2>
                  <p className="text-white/40 text-sm leading-relaxed flex-1 line-clamp-3">
                    {article.excerpt}
                  </p>
                  <Link
                    to={`/blog/${article.slug}`}
                    className="inline-flex items-center gap-2 text-[#573CFF] font-bold text-sm hover:gap-3 transition-all"
                    aria-label={`Leer ${article.title}`}
                  >
                    Leer artículo
                    <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                  </Link>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#573CFF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.02em] mb-4">
            ¿Listo para transformar tu agencia?
          </h2>
          <p className="text-white/50 text-lg mb-8">
            Prueba Guro gratis por 7 días. Sin tarjeta de crédito.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/comenzar"
              className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[52px] overflow-hidden border border-white/10"
            >
              <span className="absolute inset-y-0 left-0 w-[52px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
              <span className="relative z-10 flex items-center justify-center w-[52px] h-full flex-shrink-0">
                <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-white" />
              </span>
              <span className="relative z-10 pl-2 pr-6 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
                Comenzar gratis
              </span>
            </a>
            <a
              href="https://wa.me/573105360658?text=Hola%2C%20me%20interesa%20Guro"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm font-medium transition-colors"
            >
              <Icon icon="mdi:whatsapp" className="w-5 h-5 text-[#25D366]" />
              Hablar con ventas
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div
        style={{
          backgroundImage: 'url(https://framerusercontent.com/images/hwuS8TidtTCFW9uCzecWzF4NiU.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          transform: 'scaleY(-1)',
        }}
      >
        <div style={{ transform: 'scaleY(-1)' }}>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default BlogIndex;
