import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import Navbar from 'src/components/landingpage/framer-landing/Navbar';
import Footer from 'src/components/landingpage/framer-landing/Footer';
import { segurosArticles } from 'src/data/blog/segurosFaq';

const tagStyle = 'bg-white/[0.05] text-white/50 border-white/[0.08]';

const BlogArticle = () => {
  const { slug } = useParams();
  const article = segurosArticles.find((a) => a.slug === slug);

  if (!article) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: "'General Sans', sans-serif" }}>
        <Navbar />
        <section className="pt-40 pb-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <Icon icon="solar:document-text-broken" className="w-16 h-16 text-white/20 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-3">Artículo no encontrado</h1>
            <p className="text-white/50 mb-8">El enlace que buscas no existe o fue movido.</p>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 bg-[#573CFF] text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-[#4530cc] transition-colors"
            >
              <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
              Volver al blog
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const canonicalUrl = `https://guro.co/blog/${article.slug}`;
  const keywordsStr = article.keywords?.join(', ') || '';
  const imageUrl = article.image ? `https://guro.co${article.image.replace('/src', '')}` : 'https://guro.co/assets/images/blog/blog-img1.jpg';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    keywords: keywordsStr,
    image: imageUrl,
    author: {
      '@type': 'Organization',
      name: 'Guro',
      url: 'https://guro.co',
      logo: 'https://guro.co/assets/images/logos/guro-logo.png',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Guro',
      url: 'https://guro.co',
      logo: {
        '@type': 'ImageObject',
        url: 'https://guro.co/assets/images/logos/guro-logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    url: canonicalUrl,
    inLanguage: 'es-CO',
    datePublished: '2026-02-01',
    dateModified: '2026-02-12',
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: 'https://guro.co',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: 'https://guro.co/blog',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: canonicalUrl,
      },
    ],
  };

  const faqSchema = article.body && article.body.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.body.slice(0, 5).map((section) => ({
      '@type': 'Question',
      name: section.title,
      acceptedAnswer: {
        '@type': 'Answer',
        text: section.paragraphs?.join(' ') || section.bullets?.join('. ') || '',
      },
    })),
  } : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: "'General Sans', sans-serif" }}>
      <Helmet>
        <title>{article.title} | Blog Guro</title>
        <meta name="description" content={article.excerpt} />
        {keywordsStr && <meta name="keywords" content={keywordsStr} />}
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={`${article.title} | Blog Guro`} />
        <meta property="og:description" content={article.excerpt} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content="es_CO" />
        {article.image && <meta property="og:image" content={article.image} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.excerpt} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="author" content="Guro" />
        <meta property="article:publisher" content="https://guro.co" />
        <meta property="article:published_time" content="2026-02-01" />
        <meta property="article:modified_time" content="2026-02-12" />
        <meta property="article:section" content="Software de Seguros" />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      <Navbar />

      {/* Hero */}
      <section
        className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 overflow-hidden"
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
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <Link to="/" className="hover:text-white transition-colors">Inicio</Link>
              <Icon icon="solar:alt-arrow-right-linear" className="w-3 h-3" />
              <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
              <Icon icon="solar:alt-arrow-right-linear" className="w-3 h-3" />
              <span className="text-white/60 truncate max-w-[200px]">Artículo</span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {article.tags?.map((tag) => (
                <span
                  key={tag}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${tagStyle}`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-[1.15] tracking-[-0.02em] mb-6">
              {article.title}
            </h1>
            <p className="text-lg sm:text-xl text-white/50 font-light leading-relaxed max-w-3xl">
              {article.excerpt}
            </p>

            {/* Meta */}
            <div className="mt-8 flex items-center gap-4 text-white/30 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#635BFF] to-[#16CDC7] flex items-center justify-center text-white text-xs font-bold">G</div>
                <span className="text-white/50">Guro</span>
              </div>
              <span>·</span>
              <span>Enero 2026</span>
              {article.body && (
                <>
                  <span>·</span>
                  <span>{Math.max(3, Math.ceil(article.body.length * 1.5))} min lectura</span>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Sidebar TOC */}
            {article.body && article.body.length > 0 && (
              <motion.aside
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="lg:w-[260px] flex-shrink-0 order-2 lg:order-1"
              >
                <div className="sticky top-24 bg-[#12121a] rounded-2xl p-5 border border-white/[0.06]">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-bold mb-4">Índice</p>
                  <nav className="space-y-1">
                    {article.body.map((section, idx) => (
                      <a
                        key={idx}
                        href={`#section-${idx}`}
                        className="block text-sm text-white/40 hover:text-[#573CFF] py-1.5 transition-colors leading-snug"
                      >
                        {section.title}
                      </a>
                    ))}
                    <div className="h-px bg-white/[0.06] my-3" />
                    <a href="#cta" className="flex items-center gap-2 text-sm text-[#573CFF] font-bold py-1.5">
                      <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                      Prueba gratis
                    </a>
                  </nav>
                </div>
              </motion.aside>
            )}

            {/* Article Body */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex-1 order-1 lg:order-2"
            >
              {article.body ? (
                article.body.map((section, idx) => (
                  <section key={idx} id={`section-${idx}`} className="mb-12 scroll-mt-24">
                    <h2 className="text-2xl font-bold text-white tracking-[-0.01em] mb-4">{section.title}</h2>
                    {section.paragraphs?.map((p, i) => (
                      <p key={i} className="text-white/50 text-[15px] leading-[1.8] mb-4">{p}</p>
                    ))}
                    {section.bullets && (
                      <ul className="space-y-2 mt-4 mb-4">
                        {section.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-3 text-white/50 text-[15px] leading-relaxed">
                            <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-[#573CFF] flex-shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))
              ) : (
                <p className="text-white/50 text-[15px] leading-[1.8]">{article.answer}</p>
              )}

              {/* Keywords */}
              {article.keywords && (
                <div className="mt-10 p-5 bg-[#12121a] rounded-2xl border border-white/[0.06]">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-bold mb-3">Palabras clave</p>
                  <div className="flex flex-wrap gap-2">
                    {article.keywords.map((kw) => (
                      <span key={kw} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.05] text-white/50 border border-white/[0.08]">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.article>
          </div>

          {/* CTA */}
          {article.cta && (
            <motion.div
              id="cta"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-16 p-6 sm:p-8 rounded-2xl border border-white/10 scroll-mt-24"
              style={{
                backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold bg-white/10 border border-white/20 text-white/80 uppercase tracking-[0.15em] mb-3">
                    <Icon icon="solar:rocket-bold" className="w-3 h-3" />
                    Siguiente paso
                  </span>
                  <h3 className="text-2xl font-bold text-white tracking-[-0.02em]">{article.cta.title}</h3>
                  <p className="text-white/50 mt-2 max-w-2xl text-[15px] leading-relaxed">{article.cta.text}</p>
                </div>
                <Link
                  to="/comenzar"
                  className="group relative inline-flex items-center bg-white rounded-2xl h-[48px] overflow-hidden flex-shrink-0"
                >
                  <span className="absolute inset-y-0 left-0 w-[48px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
                  <span className="relative z-10 flex items-center justify-center w-[48px] h-full flex-shrink-0">
                    <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-[#0d0d0d] group-hover:text-white transition-colors" />
                  </span>
                  <span className="relative z-10 pl-2 pr-5 text-[10px] sm:text-[11px] font-bold text-[#0d0d0d] group-hover:text-white uppercase tracking-[0.15em] whitespace-nowrap transition-colors">
                    {article.cta.buttonLabel || 'Comenzar gratis'}
                  </span>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Related Articles */}
          {article.relatedSlugs && article.relatedSlugs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-16"
            >
              <h2 className="text-xl font-bold text-white tracking-[-0.01em] mb-6">Artículos relacionados</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {article.relatedSlugs.map((relSlug) => {
                  const rel = segurosArticles.find((a) => a.slug === relSlug);
                  if (!rel) return null;
                  return (
                    <Link
                      key={relSlug}
                      to={`/blog/${relSlug}`}
                      className="group block p-5 bg-[#12121a] rounded-2xl border border-white/[0.06] hover:border-[#573CFF]/30 transition-all duration-300 hover:-translate-y-1"
                    >
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {rel.tags?.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/[0.05] text-white/40 border border-white/[0.06]">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-sm font-bold text-white/70 group-hover:text-white leading-snug transition-colors line-clamp-3">
                        {rel.title}
                      </h3>
                      <p className="mt-2 text-xs text-white/30 leading-relaxed line-clamp-2">{rel.excerpt}</p>
                      <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold text-[#573CFF] uppercase tracking-wider">
                        Leer más
                        <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Navigation */}
          <div className="mt-12 flex flex-wrap gap-6 items-center">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-white/40 hover:text-white font-medium text-sm transition-colors"
            >
              <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
              Volver al blog
            </Link>
            <a
              href="https://wa.me/573105360658?text=Hola%2C%20me%20interesa%20Guro"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white/40 hover:text-white font-medium text-sm transition-colors"
            >
              <Icon icon="mdi:whatsapp" className="w-4 h-4 text-[#25D366]" />
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

export default BlogArticle;
