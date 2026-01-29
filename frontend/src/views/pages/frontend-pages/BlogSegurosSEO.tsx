import { Helmet } from "react-helmet";
import { Link } from "react-router";
import LpHeader from "src/components/landingpage/header/Header";
import Footer from "src/components/landingpage/footer/Footer";

const canonicalUrl = "https://www.guro.com.co/blog/software-seguros-colombia";
const pageTitle = "Software de seguros en Colombia: guía completa y preguntas frecuentes";
const pageDescription =
  "Guía experta sobre software de seguros en Colombia: mejores opciones, integraciones contables, nube, costos, IA y migraciones de datos. Todo lo esencial para corredurías pequeñas y medianas.";

const faqItems = [
  {
    id: "mejores-software",
    question: "¿Cuáles son los mejores software de seguros disponibles en Colombia?",
    answer:
      "Las corredurías en Colombia suelen evaluar Guro (enfoque integral y soporte local), SURA Office, Softseguros y Tia. Elige soluciones con hosting regional, cumplimiento de Habeas Data y conectores listos para aseguradoras y contabilidad.",
  },
  {
    id: "integracion-contable",
    question: "¿Qué software de seguros ofrece integración con plataformas contables?",
    answer:
      "Guro, Softseguros y SIA Servicios ofrecen conectores con Siigo, Alegra y QuickBooks. Verifica si incluye conciliación bancaria, centros de costo, impuestos locales y exportación a NIIF.",
  },
  {
    id: "correduria-pequena",
    question: "¿Cómo elegir un software de seguros para una correduría pequeña?",
    answer:
      "Prioriza planes modulares, implementación rápida, flujos guiados para pólizas, plantillas de cotización y soporte en español. Evita suites sobredimensionadas: busca usabilidad y costo mensual predecible.",
  },
  {
    id: "descargar-software-polizas",
    question: "¿Dónde puedo descargar software de seguros para manejo de pólizas?",
    answer:
      "La mayoría ofrece SaaS en la nube (sin descarga). Si necesitas on-premise, confirma requisitos de servidor y respaldos automáticos. Para pilotos, solicita acceso de prueba antes de instalar.",
  },
  {
    id: "caracteristicas-clave",
    question: "¿Cuáles son las características clave de un buen software de seguros?",
    answer:
      "Gestión integral de pólizas, siniestros y renovaciones, workflows configurables, reportes fiscales, API y roles/seguridad. Debe incluir alertas por vencimiento, trazabilidad y auditoría.",
  },
  {
    id: "soporte-espanol",
    question: "¿Existen opciones de software de seguros con soporte en español?",
    answer:
      "Sí. Guro, Softseguros y varios ERP locales ofrecen soporte en español, horarios de oficina en Colombia y documentación localizada. Confirma SLA y canales (chat, WhatsApp, teléfono).",
  },
  {
    id: "gestion-siniestros-online",
    question: "¿Qué software de seguros permite gestión de siniestros en línea?",
    answer:
      "Guro, SURA Office y Tia permiten radicación, seguimiento y carga de soportes en línea. Busca módulos con bitácora, estados personalizados y notificaciones al cliente.",
  },
  {
    id: "prueba-gratuita",
    question: "¿Dónde encontrar software de seguros con prueba gratuita?",
    answer:
      "Guro ofrece demo guiada y entorno sandbox; algunas suites permiten 14-30 días. Usa la prueba para validar flujos reales: emisión, endosos y conciliación de recibos.",
  },
  {
    id: "nube-colombia",
    question: "¿Es posible usar software de seguros basado en la nube en Colombia?",
    answer:
      "Sí. Las soluciones SaaS locales usan nubes con data centers en la región (ej. AWS Bogotá o São Paulo). Pregunta por redundancia, cifrado en tránsito y copias de seguridad diarias.",
  },
  {
    id: "costos-promedio",
    question: "¿Cuáles son los costos promedio de software de seguros para empresas medianas?",
    answer:
      "Rango típico: USD 10-35 por usuario/mes, o planes por volumen de pólizas. Considera costos de onboarding, integraciones y almacenamiento adicional.",
  },
  {
    id: "comparar-funcionalidades-precios",
    question: "¿Cómo comparar software de seguros según funcionalidades y precios?",
    answer:
      "Crea una matriz con módulos (pólizas, siniestros, cobranzas), integraciones, cumplimiento normativo y TCO a 24 meses. Puntúa usabilidad y soporte.",
  },
  {
    id: "especializado-vida",
    question: "¿Hay software de seguros especializado para seguros de vida?",
    answer:
      "Algunas suites (ej. Guro con flujos de vida y salud) permiten manejo de beneficiarios, cuestionarios médicos y renovaciones automáticas. Valida motor de reglas y cálculos actuariales.",
  },
  {
    id: "cotizaciones-digitales",
    question: "¿Qué software de seguros facilita la emisión de cotizaciones digitales?",
    answer:
      "Busca plantillas multiaseguradora, comparador de coberturas y firma electrónica. Guro incluye enlaces de cotización compartibles y seguimiento de apertura.",
  },
  {
    id: "soporte-local",
    question: "¿Dónde contratar software de seguros con soporte técnico local?",
    answer:
      "Proveedores como Guro y Softseguros ofrecen mesas de ayuda en Colombia. Pide SLA, tiempos de respuesta y capacitaciones incluidas en el contrato.",
  },
  {
    id: "gestion-clientes",
    question: "¿Existen plataformas de software de seguros que incluyan gestión de clientes?",
    answer:
      "Sí. Los CRM integrados permiten segmentar clientes, campañas de renovación, lead scoring y recordatorios automáticos. Asegura que soporten Habeas Data y consentimiento.",
  },
  {
    id: "tendencias-tecnologicas",
    question: "¿Cuáles son las tendencias tecnológicas en software de seguros?",
    answer:
      "Destacan la automatización con IA generativa, analítica de riesgo en tiempo real, APIs abiertas, emisión 100% digital y asistentes de voz para agentes.",
  },
  {
    id: "integrar-moviles",
    question: "¿Puedo integrar software de seguros con aplicaciones móviles para agentes?",
    answer:
      "Sí. Usa SDK o APIs para cotización, captura de documentos y seguimiento de leads. Valida autenticación segura (OAuth/2FA) y uso offline para visitas en campo.",
  },
  {
    id: "cumplimiento-colombia",
    question: "¿Hay software de seguros que cumpla con la regulación colombiana?",
    answer:
      "Verifica cumplimiento de la SFC, Habeas Data, facturación electrónica y retenciones. Pide evidencias de auditoría y bitácoras de acceso.",
  },
  {
    id: "tutoriales",
    question: "¿Dónde encontrar tutoriales para usar software de seguros?",
    answer:
      "Consulta academias en línea, centros de ayuda y webinars de cada proveedor. Un buen indicador es que incluyan rutas de aprendizaje para nuevos productores y equipo contable.",
  },
  {
    id: "corretaje-grande",
    question: "¿Qué software de seguros es recomendado para empresas de corretaje grandes?",
    answer:
      "Necesitan multi-sucursal, permisos avanzados, BI y SLAs estrictos. Guro Enterprise, Tia o Duck Creek son opciones si requieren alta escalabilidad.",
  },
  {
    id: "seguros-vehiculos",
    question: "¿Existen soluciones de software de seguros para gestión de seguros de vehículos?",
    answer:
      "Sí. Busca captura de placa y SOAT, integración con RUNT y formularios de inspección. Las alertas de vencimiento y mapas de siniestros son clave para autos y flotas.",
  },
  {
    id: "licencias-mensual",
    question: "¿Dónde comprar licencias de software de seguros con pago mensual?",
    answer:
      "Los modelos SaaS (Guro, Softseguros) ofrecen pago mensual o anual. Revisa políticas de usuarios flotantes, mínimos contratados y cargos por transacción.",
  },
  {
    id: "reportes-fiscales",
    question: "¿El software de seguros en Colombia ofrece soporte para reportes fiscales?",
    answer:
      "Debe generar retenciones, IVA/ICA, RUT y reportes de comisiones. Pide exportables a DIAN y conciliación con bancos locales.",
  },
  {
    id: "ia",
    question: "¿Cuáles son las mejores alternativas de software de seguros con inteligencia artificial?",
    answer:
      "Guro integra asistentes para cotización y sugerencia de coberturas; otras suites usan scoring de riesgo y detección de fraude. Evalúa trazabilidad de decisiones y datos usados.",
  },
  {
    id: "migrar-datos",
    question: "¿Cómo migrar datos desde un sistema antiguo a un nuevo software de seguros?",
    answer:
      "Define plantillas de importación (pólizas, clientes, siniestros), limpia duplicados y realiza pruebas de carga. Exige ambiente sandbox, respaldo previo y plan de reversa.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const blogPostingSchema = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: pageTitle,
  description: pageDescription,
  inLanguage: "es-CO",
  author: {
    "@type": "Organization",
    name: "Guro",
  },
  publisher: {
    "@type": "Organization",
    name: "Guro",
  },
  mainEntityOfPage: canonicalUrl,
  datePublished: "2024-01-01",
  dateModified: "2024-01-01",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Inicio",
      item: "https://www.guro.com.co/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Blog",
      item: canonicalUrl,
    },
  ],
};

const BlogSegurosSEO = () => {
  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta
          name="keywords"
          content="software de seguros, software correduria, seguros colombia, software siniestros, integracion contable seguros"
        />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content="es_CO" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <script type="application/ld+json">{JSON.stringify(blogPostingSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <LpHeader />

      <section className="bg-gradient-to-br from-primary to-primaryemphasis text-white py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80 mb-4">Blog y guía experta</p>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            Software de seguros en Colombia: guía completa, preguntas y mejores prácticas
          </h1>
          <p className="mt-4 text-lg text-white/90 max-w-3xl">
            Resolvemos las dudas más buscadas sobre software de seguros: integraciones contables, siniestros en línea,
            nube, costos y cumplimiento normativo. Optimizado para SEO en español (Colombia) y listo para compartir con
            tu equipo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="bg-blue-500/20 border border-blue-400/40 text-blue-100 px-3 py-1 rounded-full text-sm">
              Cumplimiento Habeas Data
            </span>
            <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 px-3 py-1 rounded-full text-sm">
              Integraciones contables
            </span>
            <span className="bg-indigo-500/20 border border-indigo-400/40 text-indigo-100 px-3 py-1 rounded-full text-sm">
              IA para corredores
            </span>
          </div>
          <div className="mt-8 flex flex-wrap gap-4 items-center">
            <Link
              to="/comenzar"
              className="bg-white text-slate-900 px-5 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-400/30 transition"
            >
              Agenda una demo guiada
            </Link>
            <a
              href="#indice"
              className="text-white/80 hover:text-white border border-white/25 px-4 py-2 rounded-xl"
            >
              Ver índice SEO
            </a>
          </div>
        </div>
      </section>

      <section id="indice" className="bg-slate-50 dark:bg-slate-950 py-12 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white mb-4">Índice rápido</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              Accede a cada pregunta frecuente. Incluimos buenas prácticas de compra, migración y cumplimiento para
              corredurías en Colombia.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {faqItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="group flex items-start gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-800 transition"
                >
                  <span className="text-blue-500 mt-0.5">●</span>
                  <span className="text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                    {item.question}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 space-y-8">
          {faqItems.map((item) => (
            <article
              key={item.id}
              id={item.id}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg"
            >
              <div className="flex flex-wrap justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-blue-500 mb-2">Guía práctica</p>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-white leading-snug">{item.question}</h2>
                </div>
                <a
                  href="#indice"
                  className="text-sm text-blue-600 dark:text-blue-300 hover:underline"
                  aria-label="Volver al índice"
                >
                  ↑ Volver
                </a>
              </div>
              <p className="text-slate-700 dark:text-slate-200 text-base leading-relaxed">{item.answer}</p>
              <div className="mt-4 grid md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-sm">Checklist rápido</h3>
                  <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2 list-disc list-inside">
                    <li>Valida integración con contabilidad y emisión.</li>
                    <li>Revisa SLA y soporte en español.</li>
                    <li>Solicita demo con tus flujos reales.</li>
                  </ul>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-sm">SEO insight</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Incluye palabras clave como "software de seguros Colombia", "integración contable" y "siniestros en
                    línea" en tus páginas de servicio y casos de éxito.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-sm">Acción sugerida</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                    Agenda una demo para probar emisión, cobranzas y reportes fiscales en un entorno sandbox.
                  </p>
                  <Link
                    to="/comenzar"
                    className="inline-flex items-center text-blue-600 dark:text-blue-300 font-semibold hover:underline"
                  >
                    Probar ahora →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-100 dark:bg-slate-950 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-500 mb-2">Checklist de compra</p>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                  ¿Listo para elegir software de seguros?
                </h3>
                <p className="text-slate-700 dark:text-slate-300 max-w-3xl">
                  Descarga nuestra lista de verificación: seguridad, integraciones, SLA, impuestos y plan de migración.
                  Úsala en tu proceso de RFP.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/comenzar"
                  className="bg-emerald-500 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/30 transition"
                >
                  Solicitar checklist
                </Link>
                <a
                  href="#indice"
                  className="border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-4 py-3 rounded-xl"
                >
                  Volver arriba
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
};

export default BlogSegurosSEO;
