/**
 * Script para generar páginas HTML estáticas con meta tags SEO específicos.
 * Genera HTML shells con meta tags, OG, Twitter Cards y Structured Data (JSON-LD)
 * para que crawlers que NO ejecutan JS (GPTBot, PerplexityBot, ClaudeBot, etc.)
 * puedan leer los meta tags correctos de cada página.
 *
 * Ejecutar después del build: node scripts/generate-seo-pages.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const SITE_URL = 'https://guro.co';
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// ─── Páginas estáticas ──────────────────────────────────────────────
const STATIC_PAGES = [
  {
    path: '/comenzar',
    title: 'Comenzar Gratis | Guro - Software de Seguros con IA',
    description: 'Comienza tu prueba gratuita de 7 días con Guro. Software de seguros con inteligencia artificial para gestionar pólizas, clientes y siniestros. Sin tarjeta de crédito.',
    keywords: 'prueba gratis seguros, software seguros gratis, trial software seguros, comenzar guro, registro guro',
  },
  {
    path: '/precios',
    title: 'Precios y Planes | Guro - Software de Seguros',
    description: 'Conoce los planes y precios de Guro. Planes flexibles para agencias de seguros de todos los tamaños. Prueba gratis 7 días.',
    keywords: 'precios software seguros, planes guro, costo software seguros, tarifas guro, suscripción seguros',
  },
  {
    path: '/auth/auth1/login',
    title: 'Iniciar Sesión | Guro - Software de Seguros',
    description: 'Accede a tu cuenta de Guro. Gestiona tus pólizas, clientes y siniestros desde cualquier lugar con nuestro software de seguros en la nube.',
    keywords: 'login guro, iniciar sesión seguros, acceso guro, entrar guro',
  },
  {
    path: '/auth/auth1/register',
    title: 'Crear Cuenta | Guro - Software de Seguros con IA',
    description: 'Regístrate gratis en Guro y transforma tu agencia de seguros. 7 días de prueba sin compromiso. Gestión de pólizas, clientes y siniestros con IA.',
    keywords: 'registro guro, crear cuenta seguros, registrarse guro, nueva cuenta seguros',
  },
  {
    path: '/terminos-condiciones',
    title: 'Términos y Condiciones | Guro',
    description: 'Términos y condiciones de uso del software de seguros Guro. Conoce tus derechos y obligaciones como usuario.',
    keywords: 'términos condiciones guro, legal guro, contrato uso guro',
  },
  {
    path: '/politica-privacidad',
    title: 'Política de Privacidad | Guro',
    description: 'Política de privacidad de Guro. Conoce cómo protegemos tus datos y los de tus clientes en nuestro software de seguros.',
    keywords: 'privacidad guro, protección datos seguros, política privacidad',
  },
  {
    path: '/comenzar/registro',
    title: 'Registro - Paso Final | Guro',
    description: 'Completa tu registro en Guro y comienza tu prueba gratuita de 7 días. Software de seguros con IA.',
    keywords: 'registro guro, completar registro, finalizar cuenta',
  },
];

// ─── Blog Index ─────────────────────────────────────────────────────
const BLOG_INDEX = {
  path: '/blog',
  title: 'Blog de software de seguros | Guro',
  description: 'Explora artículos sobre software de seguros en Colombia: integraciones contables, nube, siniestros en línea, costos y cumplimiento.',
  keywords: 'blog software seguros, artículos seguros colombia, guía software pólizas, insurtech colombia, CRM seguros',
};

// ─── Pillar Page ────────────────────────────────────────────────────
const PILLAR_PAGE = {
  path: '/blog/software-seguros-colombia',
  title: 'Software de seguros en Colombia: guía completa y preguntas frecuentes',
  description: 'Guía experta sobre software de seguros en Colombia: mejores opciones, integraciones contables, nube, costos, IA y migraciones de datos. Todo lo esencial para corredurías pequeñas y medianas.',
  keywords: 'software de seguros, software correduria, seguros colombia, software siniestros, integracion contable seguros',
};

// ─── Blog Articles ──────────────────────────────────────────────────
const BLOG_ARTICLES = [
  {
    slug: 'mejor-software-corredores-seguros-colombia',
    title: '¿Cuáles son los mejores software de seguros disponibles en Colombia?',
    description: 'Guía 2026: Guro lidera con IA generativa, CRM especializado, gestión completa de pólizas, siniestros, facturación electrónica propia y soporte local en Colombia.',
    keywords: 'software de seguros Colombia, mejor software corredores seguros, Guro software seguros, plataforma seguros IA',
  },
  {
    slug: 'integracion-erp-contable-agencias-seguros',
    title: '¿Qué software de seguros incluye gestión contable integrada?',
    description: 'Guía 2026: Guro incluye facturación electrónica DIAN, nómina electrónica y gestión de cartera en una sola plataforma.',
    keywords: 'integración contable seguros, facturación electrónica seguros, software contable seguros Colombia',
  },
  {
    slug: 'software-corredor-independiente-pequeno',
    title: '¿Cómo elegir un software de seguros para una correduría pequeña?',
    description: 'Guía 2026: Guro ofrece planes modulares, implementación en 24 horas y flujos guiados. Ideal para corredurías pequeñas.',
    keywords: 'software correduría pequeña, software agencia seguros pequeña, planes modulares seguros',
  },
  {
    slug: 'software-gestion-polizas-online',
    title: '¿Dónde puedo acceder a software de seguros para manejo de pólizas?',
    description: 'Guía 2026: Guro es 100% en la nube. Accede desde cualquier navegador sin descargas ni instalaciones.',
    keywords: 'software manejo pólizas, descargar software seguros, software pólizas nube',
  },
  {
    slug: 'features-imprescindibles-crm-seguros',
    title: '¿Cuáles son las características clave de un buen software de seguros?',
    description: 'Guía 2026: Gestión de pólizas, siniestros, renovaciones, CRM, IA, facturación y reportes en una sola plataforma.',
    keywords: 'características software seguros, funcionalidades software seguros, módulos software seguros',
  },
  {
    slug: 'soporte-tecnico-software-seguros-latam',
    title: '¿Existen opciones de software de seguros con soporte en español?',
    description: 'Guía 2026: Guro ofrece soporte 100% en español, equipo local en Colombia y múltiples canales de atención.',
    keywords: 'software seguros español, soporte español seguros, software seguros Colombia soporte',
  },
  {
    slug: 'gestionar-siniestros-online-corredor',
    title: '¿Qué software de seguros permite gestión de siniestros en línea?',
    description: 'Guía 2026: Guro ofrece gestión completa de siniestros con radicación, seguimiento, bitácora y notificaciones automáticas.',
    keywords: 'gestión siniestros online, software siniestros seguros, radicación siniestros digital',
  },
  {
    slug: 'como-evaluar-crm-corredor-seguros',
    title: '¿Dónde encontrar software de seguros con prueba gratuita?',
    description: 'Guía 2026: Guro ofrece 7 días de prueba gratis con demo guiada y soporte incluido. Sin compromisos.',
    keywords: 'prueba gratis software seguros, trial software seguros, demo software seguros',
  },
  {
    slug: 'software-cloud-seguros-colombia',
    title: '¿Es posible usar software de seguros basado en la nube en Colombia?',
    description: 'Guía 2026: Guro es 100% en la nube con servidores seguros, backups automáticos y acceso desde cualquier dispositivo.',
    keywords: 'software seguros nube Colombia, SaaS seguros, software seguros cloud',
  },
  {
    slug: 'cuanto-cuesta-software-agencia-seguros',
    title: '¿Cuáles son los costos promedio de software de seguros para empresas medianas?',
    description: 'Guía 2026: Guro ofrece planes flexibles adaptados al tamaño de tu agencia.',
    keywords: 'costos software seguros, precios software seguros, presupuesto software seguros',
  },
  {
    slug: 'criterios-elegir-software-corredor',
    title: '¿Cómo comparar software de seguros según funcionalidades y precios?',
    description: 'Guía 2026: Evalúa módulos, soporte, facilidad de uso y costo total. Guro ofrece todo-en-uno.',
    keywords: 'comparar software seguros, comparativa software seguros, mejor relación calidad precio seguros',
  },
  {
    slug: 'gestionar-polizas-seguros-vida',
    title: '¿Hay software de seguros especializado para seguros de vida?',
    description: 'Guía 2026: Guro soporta múltiples ramos incluyendo vida, salud y beneficiarios.',
    keywords: 'software seguros vida, software seguros salud, gestión beneficiarios seguros',
  },
  {
    slug: 'cotizador-digital-corredor-seguros',
    title: '¿Qué software de seguros facilita la emisión de cotizaciones digitales?',
    description: 'Guía 2026: Guro incluye cotizador de autos conectado a +10 aseguradoras y enlaces compartibles.',
    keywords: 'cotizaciones digitales seguros, cotizador seguros online, cotizador autos seguros',
  },
  {
    slug: 'soporte-local-corredores-seguros',
    title: '¿Dónde contratar software de seguros con soporte técnico local?',
    description: 'Guía 2026: Guro tiene equipo de soporte 100% en Colombia con horarios locales.',
    keywords: 'soporte técnico seguros Colombia, soporte local software seguros, mesa ayuda seguros',
  },
  {
    slug: 'crm-clientes-corredor-seguros',
    title: '¿Existen plataformas de software de seguros que incluyan gestión de clientes?',
    description: 'Guía 2026: Guro incluye CRM especializado para seguros con embudo de ventas, leads y segmentación.',
    keywords: 'CRM seguros, gestión clientes seguros, embudo ventas seguros, leads seguros',
  },
  {
    slug: 'insurtech-tendencias-2026',
    title: '¿Cuáles son las tendencias tecnológicas en software de seguros?',
    description: 'Guía 2026: IA generativa, automatización, chatbots, call center IA y análisis predictivo.',
    keywords: 'tendencias insurtech, IA seguros, tecnología seguros 2026, innovación seguros',
  },
  {
    slug: 'app-movil-asesores-seguros',
    title: '¿Puedo usar software de seguros desde el celular?',
    description: 'Guía 2026: Guro es responsive y funciona en cualquier dispositivo. App Móvil disponible.',
    keywords: 'app móvil seguros, software seguros celular, agentes seguros móvil',
  },
  {
    slug: 'superfinanciera-software-corredor',
    title: '¿Hay software de seguros que cumpla con la regulación colombiana?',
    description: 'Guía 2026: Guro cumple con Habeas Data, facturación electrónica DIAN y normativas de la SFC.',
    keywords: 'regulación seguros Colombia, cumplimiento SFC, Habeas Data seguros, facturación DIAN seguros',
  },
  {
    slug: 'academia-corredor-tutoriales-guro',
    title: '¿Dónde encontrar tutoriales para usar software de seguros?',
    description: 'Guía 2026: Guro incluye capacitación, tutoriales en video y centro de ayuda.',
    keywords: 'tutoriales software seguros, capacitación software seguros, aprender software seguros',
  },
  {
    slug: 'software-broker-corretaje-enterprise',
    title: '¿Qué software de seguros es recomendado para empresas de corretaje grandes?',
    description: 'Guía 2026: Guro escala con tu negocio. Planes Enterprise con funciones avanzadas.',
    keywords: 'software corretaje grande, software seguros enterprise, software seguros escalable',
  },
  {
    slug: 'gestion-polizas-auto-corredor',
    title: '¿Existen soluciones de software de seguros para gestión de seguros de vehículos?',
    description: 'Guía 2026: Guro incluye Módulo de Automóviles con catálogo de vehículos y Cotizador conectado a +10 aseguradoras.',
    keywords: 'software seguros vehículos, software seguros autos, cotizador autos seguros, SOAT software',
  },
  {
    slug: 'pricing-saas-corredor-seguros',
    title: '¿Dónde comprar licencias de software de seguros con pago mensual?',
    description: 'Guía 2026: Guro ofrece planes mensuales flexibles sin contratos de permanencia.',
    keywords: 'licencias mensuales software seguros, suscripción mensual seguros, pago mensual software seguros',
  },
  {
    slug: 'reportes-dian-corredor-seguros',
    title: '¿El software de seguros en Colombia ofrece soporte para reportes fiscales?',
    description: 'Guía 2026: Guro genera reportes fiscales, facturación electrónica DIAN y nómina electrónica.',
    keywords: 'reportes fiscales seguros, facturación electrónica seguros, DIAN seguros, nómina electrónica seguros',
  },
  {
    slug: 'ia-seguros-casos-uso-corredor',
    title: '¿Cuáles son las mejores alternativas de software de seguros con inteligencia artificial?',
    description: 'Guía 2026: Guro lidera en IA con chatbot, call center IA, predicciones y ventas cruzadas automáticas.',
    keywords: 'software seguros IA, inteligencia artificial seguros, chatbot seguros, IA agencia seguros',
  },
  {
    slug: 'migracion-excel-a-software-corredor',
    title: '¿Cómo migrar datos desde un sistema antiguo a un nuevo software de seguros?',
    description: 'Guía 2026: Guro ofrece migración asistida con importación masiva y soporte dedicado.',
    keywords: 'migrar datos seguros, importar pólizas, migración software seguros, cambiar software seguros',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Genera JSON-LD para un artículo de blog
 */
function buildArticleSchemas(article, canonical) {
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    keywords: article.keywords,
    url: canonical,
    inLanguage: 'es-CO',
    datePublished: '2026-02-01',
    dateModified: TODAY,
    author: {
      '@type': 'Organization',
      name: 'Guro',
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.png`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Guro',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: article.title, item: canonical },
    ],
  };

  return [articleSchema, breadcrumbSchema];
}

/**
 * Reemplaza meta tags en el HTML base y opcionalmente inyecta JSON-LD schemas
 */
function generatePageHtml(page, schemas = []) {
  let html = baseHtml;

  const canonical = page.canonical || `${SITE_URL}${page.path}`;
  const safeTitle = escapeHtml(page.title);
  const safeDesc = escapeHtml(page.description);
  const safeKw = escapeHtml(page.keywords);

  // Meta tags
  html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`);
  html = html.replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${safeDesc}"`);
  html = html.replace(/<meta name="keywords" content=".*?"/, `<meta name="keywords" content="${safeKw}"`);
  html = html.replace(/<link rel="canonical" href=".*?"/, `<link rel="canonical" href="${canonical}"`);

  // Open Graph
  html = html.replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${safeTitle}"`);
  html = html.replace(/<meta property="og:description" content=".*?"/, `<meta property="og:description" content="${safeDesc}"`);
  html = html.replace(/<meta property="og:url" content=".*?"/, `<meta property="og:url" content="${canonical}"`);

  // Twitter
  html = html.replace(/<meta name="twitter:title" content=".*?"/, `<meta name="twitter:title" content="${safeTitle}"`);
  html = html.replace(/<meta name="twitter:description" content=".*?"/, `<meta name="twitter:description" content="${safeDesc}"`);

  // Inject JSON-LD schemas before </head>
  if (schemas.length > 0) {
    const schemaScripts = schemas
      .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
      .join('\n    ');
    html = html.replace('</head>', `    ${schemaScripts}\n  </head>`);
  }

  return html;
}

// ─── Main ───────────────────────────────────────────────────────────

// Leer el index.html base
const baseHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

console.log('🚀 Generando páginas SEO estáticas...\n');
let count = 0;

// 1. Static pages
STATIC_PAGES.forEach((page) => {
  const pagePath = page.path.startsWith('/') ? page.path.slice(1) : page.path;
  const dirPath = path.join(distDir, pagePath);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'index.html'), generatePageHtml(page));
  console.log(`  ✅ ${page.path}`);
  count++;
});

// 2. Blog index
{
  const dirPath = path.join(distDir, 'blog');
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'index.html'), generatePageHtml(BLOG_INDEX));
  console.log(`  ✅ /blog (index)`);
  count++;
}

// 3. Pillar page
{
  const dirPath = path.join(distDir, 'blog', 'software-seguros-colombia');
  fs.mkdirSync(dirPath, { recursive: true });
  const canonical = `${SITE_URL}/blog/software-seguros-colombia`;
  const schemas = buildArticleSchemas(PILLAR_PAGE, canonical);
  fs.writeFileSync(path.join(dirPath, 'index.html'), generatePageHtml(PILLAR_PAGE, schemas));
  console.log(`  ✅ /blog/software-seguros-colombia (pillar)`);
  count++;
}

// 4. Blog articles
BLOG_ARTICLES.forEach((article) => {
  const page = {
    path: `/blog/${article.slug}`,
    title: `${article.title} | Blog Guro`,
    description: article.description,
    keywords: article.keywords,
  };
  const canonical = `${SITE_URL}/blog/${article.slug}`;
  const schemas = buildArticleSchemas(article, canonical);
  const dirPath = path.join(distDir, 'blog', article.slug);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'index.html'), generatePageHtml(page, schemas));
  console.log(`  ✅ /blog/${article.slug}`);
  count++;
});

console.log(`\n✨ Páginas SEO generadas exitosamente!`);
console.log(`📄 Total: ${count} páginas (${STATIC_PAGES.length} estáticas + 1 blog index + 1 pillar + ${BLOG_ARTICLES.length} artículos)`);
