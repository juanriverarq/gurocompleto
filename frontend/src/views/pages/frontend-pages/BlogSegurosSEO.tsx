import { Helmet } from "react-helmet";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import Navbar from "src/components/landingpage/framer-landing/Navbar";
import Footer from "src/components/landingpage/framer-landing/Footer";

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
    <div className="min-h-screen bg-[#0a0a0f]" style={{ fontFamily: "'General Sans', sans-serif" }}>
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
              <span className="text-white/60">Guía completa</span>
            </div>

            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-white/90 rounded-full text-[11px] font-bold uppercase tracking-[0.15em] mb-6">
              <Icon icon="solar:book-2-bold" className="w-4 h-4" />
              Guía experta
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-[1.15] tracking-[-0.02em] mb-6">
              Software de seguros en Colombia:{' '}
              <span className="bg-gradient-to-r from-[#635BFF] via-[#49A5FF] to-[#16CDC7] bg-clip-text text-transparent">
                guía completa
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-white/50 font-light leading-relaxed max-w-3xl">
              Resolvemos las dudas más buscadas sobre software de seguros: integraciones contables, siniestros en línea,
              nube, costos y cumplimiento normativo.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white/[0.05] text-white/50 border-white/[0.08]">Cumplimiento</span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white/[0.05] text-white/50 border-white/[0.08]">Integraciones</span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white/[0.05] text-white/50 border-white/[0.08]">IA</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-4 items-center">
              <a
                href="/comenzar"
                className="group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl h-[48px] overflow-hidden border border-white/10"
              >
                <span className="absolute inset-y-0 left-0 w-[48px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
                <span className="relative z-10 flex items-center justify-center w-[48px] h-full flex-shrink-0">
                  <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-white" />
                </span>
                <span className="relative z-10 pl-2 pr-5 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
                  Demo guiada
                </span>
              </a>
              <a
                href="#indice"
                className="text-white/50 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Icon icon="solar:list-bold" className="w-4 h-4" />
                Ver índice
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TOC Index */}
      <section id="indice" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[#12121a] rounded-2xl p-6 sm:p-8 border border-white/[0.06]"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-[-0.02em] mb-2">Índice rápido</h2>
            <p className="text-white/40 text-sm mb-6">
              Accede a cada pregunta frecuente. Incluimos buenas prácticas de compra, migración y cumplimiento.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {faqItems.map((item, index) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="group flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] hover:border-[#573CFF]/30 bg-white/[0.02] hover:bg-[#573CFF]/5 transition-all"
                >
                  <span className="text-[#573CFF] text-xs font-bold mt-0.5 w-5 flex-shrink-0">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-white/60 text-sm group-hover:text-white transition-colors leading-snug">
                    {item.question}
                  </span>
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Items */}
      <section className="pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto space-y-6">
          {faqItems.map((item, index) => (
            <motion.article
              key={item.id}
              id={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.4) }}
              className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6 sm:p-8 scroll-mt-24"
            >
              <div className="flex flex-wrap justify-between gap-4 mb-4">
                <div className="flex-1">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold bg-[#573CFF]/10 border border-[#573CFF]/20 text-[#573CFF] uppercase tracking-[0.15em] mb-3">
                    <Icon icon="solar:question-circle-bold" className="w-3 h-3" />
                    Pregunta {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug tracking-[-0.01em]">{item.question}</h2>
                </div>
                <a
                  href="#indice"
                  className="text-white/30 hover:text-[#573CFF] transition-colors flex items-center gap-1 text-sm flex-shrink-0"
                >
                  <Icon icon="solar:arrow-up-linear" className="w-3 h-3" />
                  Índice
                </a>
              </div>
              <p className="text-white/50 text-[15px] leading-[1.8] mb-6">{item.answer}</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="solar:checklist-bold" className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm">Checklist</h3>
                  </div>
                  <ul className="text-sm text-white/40 space-y-2">
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-400/60 flex-shrink-0 mt-0.5" />
                      Valida integración contable y emisión.
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-400/60 flex-shrink-0 mt-0.5" />
                      Revisa SLA y soporte en español.
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-400/60 flex-shrink-0 mt-0.5" />
                      Solicita demo con tus flujos reales.
                    </li>
                  </ul>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="solar:chart-bold" className="w-4 h-4 text-sky-400" />
                    <h3 className="font-bold text-white text-sm">SEO insight</h3>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed">
                    Incluye palabras clave como "software de seguros Colombia" e "integración contable" en tus páginas de servicio.
                  </p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon icon="solar:rocket-bold" className="w-4 h-4 text-[#573CFF]" />
                    <h3 className="font-bold text-white text-sm">Acción</h3>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed mb-3">
                    Prueba emisión, cobranzas y reportes en un entorno sandbox.
                  </p>
                  <Link
                    to="/comenzar"
                    className="inline-flex items-center gap-2 text-[#573CFF] font-bold text-sm hover:gap-3 transition-all"
                  >
                    Probar ahora
                    <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1100px] mx-auto">
          <div
            className="rounded-2xl p-6 sm:p-8 border border-white/10"
            style={{
              backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold bg-white/10 border border-white/20 text-white/80 uppercase tracking-[0.15em] mb-3">
                  <Icon icon="solar:shield-check-bold" className="w-3 h-3" />
                  Checklist de compra
                </span>
                <h3 className="text-2xl font-bold text-white tracking-[-0.02em]">
                  ¿Listo para elegir software de seguros?
                </h3>
                <p className="text-white/50 mt-2 max-w-2xl text-[15px] leading-relaxed">
                  Seguridad, integraciones, SLA, impuestos y plan de migración. Todo en una lista de verificación.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/comenzar"
                  className="group relative inline-flex items-center bg-white rounded-2xl h-[48px] overflow-hidden flex-shrink-0"
                >
                  <span className="absolute inset-y-0 left-0 w-[48px] group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out" />
                  <span className="relative z-10 flex items-center justify-center w-[48px] h-full flex-shrink-0">
                    <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-[#0d0d0d] group-hover:text-white transition-colors" />
                  </span>
                  <span className="relative z-10 pl-2 pr-5 text-[11px] font-bold text-[#0d0d0d] group-hover:text-white uppercase tracking-[0.15em] whitespace-nowrap transition-colors">
                    Comenzar
                  </span>
                </Link>
                <a
                  href="#indice"
                  className="text-white/40 hover:text-white text-sm font-medium transition-colors flex items-center gap-2 px-4"
                >
                  <Icon icon="solar:arrow-up-linear" className="w-4 h-4" />
                  Volver arriba
                </a>
              </div>
            </div>
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

export default BlogSegurosSEO;
