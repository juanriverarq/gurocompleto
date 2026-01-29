import { Helmet } from 'react-helmet';
import { Link } from 'react-router';
import LpHeader from 'src/components/landingpage/header/Header';
import Footer from 'src/components/landingpage/footer/Footer';
import { segurosArticles } from 'src/data/blog/segurosFaq';

const canonicalUrl = 'https://www.guro.com.co/blog';

const BlogIndex = () => {
  const pillar = {
    title: 'Software de seguros en Colombia: guía completa',
    description:
      'Pilar con checklist de integraciones, nube, siniestros y cumplimiento. Ideal para compartir con tu equipo.',
    href: '/blog/software-seguros-colombia',
  };

  return (
    <>
      <Helmet>
        <title>Blog de software de seguros | Guro</title>
        <meta
          name="description"
          content="Explora artículos sobre software de seguros en Colombia: integraciones contables, nube, siniestros en línea, costos y cumplimiento."
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <LpHeader />

      <section className="bg-gradient-to-br from-primary to-primaryemphasis text-white py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80 mb-3">Blog</p>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-white">
            Guía y noticias sobre software de seguros en Colombia
          </h1>
          <p className="mt-4 text-lg text-white/90 max-w-3xl">
            Encuentra respuestas prácticas para corredurías y equipos de seguros: integraciones contables, nube,
            siniestros, precios y cumplimiento normativo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="bg-white/15 border border-white/25 text-white px-3 py-1 rounded-full text-sm">Nube</span>
            <span className="bg-white/15 border border-white/25 text-white px-3 py-1 rounded-full text-sm">IA</span>
            <span className="bg-white/15 border border-white/25 text-white px-3 py-1 rounded-full text-sm">Integraciones</span>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-950 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 space-y-8">
          <div className="border border-white/20 bg-gradient-to-br from-primary to-primaryemphasis rounded-2xl p-6 md:p-8 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-white/15 border border-white/25 uppercase tracking-[0.2em]">Artículo destacado</span>
                <h2 className="text-2xl font-semibold leading-snug text-white">{pillar.title}</h2>
                <p className="text-white/85 mt-1 max-w-2xl">{pillar.description}</p>
              </div>
              <Link
                to={pillar.href}
                className="bg-white text-slate-900 px-5 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition border border-white/40"
              >
                Leer guía completa
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {segurosArticles.map((article) => (
              <article
                key={article.slug}
                className="border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition bg-white dark:bg-slate-900 flex flex-col gap-3"
              >
                <div className="flex gap-2 flex-wrap">
                  {article.tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary dark:bg-primary/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white leading-snug">{article.title}</h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed flex-1">{article.excerpt}</p>
                <Link
                  to={`/blog/${article.slug}`}
                  className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                  aria-label={`Leer ${article.title}`}
                >
                  Leer artículo
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default BlogIndex;
