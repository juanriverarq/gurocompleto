import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router';
import LpHeader from 'src/components/landingpage/header/Header';
import Footer from 'src/components/landingpage/footer/Footer';
import { segurosArticles } from 'src/data/blog/segurosFaq';

const BlogArticle = () => {
  const { slug } = useParams();
  const article = segurosArticles.find((a) => a.slug === slug);

  if (!article) {
    return (
      <>
        <LpHeader />
        <section className="py-16 bg-white dark:bg-slate-950">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-3">Artículo no encontrado</h1>
            <p className="text-slate-600 dark:text-slate-300 mb-6">El enlace que buscas no existe o fue movido.</p>
            <Link to="/blog" className="text-primary font-semibold hover:underline">
              Volver al blog
            </Link>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  const canonicalUrl = `https://www.guro.com.co/blog/${article.slug}`;
  const keywordsStr = article.keywords?.join(', ') || '';
  const imageUrl = article.image ? `https://www.guro.com.co${article.image.replace('/src', '')}` : 'https://www.guro.com.co/assets/images/blog/blog-img1.jpg';

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
      url: 'https://www.guro.com.co',
      logo: 'https://www.guro.com.co/assets/images/logos/guro-logo.png',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Guro',
      url: 'https://www.guro.com.co',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.guro.com.co/assets/images/logos/guro-logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    url: canonicalUrl,
    inLanguage: 'es-CO',
    datePublished: '2026-01-01',
    dateModified: '2026-01-25',
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: 'https://www.guro.com.co',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: 'https://www.guro.com.co/blog',
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
    <>
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
        <meta property="article:publisher" content="https://www.guro.com.co" />
        <meta property="article:published_time" content="2026-01-01" />
        <meta property="article:modified_time" content="2026-01-25" />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      <LpHeader />

      <section className="bg-gradient-to-br from-primary to-primaryemphasis text-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-10">
            <div className="flex-1">
              <p className="text-sm uppercase tracking-[0.2em] text-white/80 mb-3">Blog · Guía SEO</p>
              <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-white">{article.title}</h1>
              <p className="mt-4 text-lg text-white/90 max-w-2xl">{article.excerpt}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {article.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full text-xs bg-white/15 border border-white/25 text-white"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {article.image && (
              <div className="mt-6 lg:mt-0 lg:w-80 flex-shrink-0">
                <img
                  src={article.image}
                  alt={article.title}
                  className="rounded-2xl shadow-xl w-full h-48 lg:h-56 object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-950 py-12 md:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-10">
            {article.body && article.body.length > 0 && (
              <aside className="lg:w-64 flex-shrink-0 order-2 lg:order-1">
                <div className="sticky top-24 bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-3">Índice</p>
                  <nav className="space-y-2">
                    {article.body.map((section, idx) => (
                      <a
                        key={idx}
                        href={`#section-${idx}`}
                        className="block text-sm text-slate-700 dark:text-slate-300 hover:text-primary transition"
                      >
                        {section.title}
                      </a>
                    ))}
                    <a href="#cta" className="block text-sm text-primary font-semibold">
                      → Prueba gratis
                    </a>
                  </nav>
                </div>
              </aside>
            )}

            <article className="flex-1 order-1 lg:order-2 prose prose-lg max-w-none dark:prose-invert prose-headings:scroll-mt-24">
              {article.body ? (
                article.body.map((section, idx) => (
                  <section key={idx} id={`section-${idx}`} className="mb-10">
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{section.title}</h2>
                    {section.paragraphs?.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    {section.bullets && (
                      <ul className="list-disc list-inside space-y-1">
                        {section.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))
              ) : (
                <p>{article.answer}</p>
              )}

              {article.keywords && (
                <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Palabras clave</p>
                  <div className="flex flex-wrap gap-2">
                    {article.keywords.map((kw) => (
                      <span key={kw} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          </div>

          {article.cta && (
            <div
              id="cta"
              className="mt-12 p-6 md:p-8 border border-white/20 rounded-2xl bg-gradient-to-br from-primary to-primaryemphasis text-white flex flex-col md:flex-row md:items-center md:justify-between gap-6"
            >
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/80 mb-1">Siguiente paso</p>
                <h3 className="text-2xl font-semibold text-white">{article.cta.title}</h3>
                <p className="text-white/90 mt-2 max-w-2xl">{article.cta.text}</p>
              </div>
              <Link
                to="/comenzar"
                className="bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition whitespace-nowrap"
              >
                {article.cta.buttonLabel || 'Comenzar prueba gratis'}
              </Link>
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-4 items-center">
            <Link to="/blog" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
              ← Volver al blog
            </Link>
            <Link
              to="/comenzar"
              className="text-slate-900 dark:text-white font-semibold inline-flex items-center gap-1"
            >
              Agenda una demo →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default BlogArticle;
