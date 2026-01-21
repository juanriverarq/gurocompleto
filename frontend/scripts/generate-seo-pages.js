/**
 * Script para generar páginas HTML estáticas con meta tags SEO específicos
 * Ejecutar después del build: node scripts/generate-seo-pages.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

// Configuración de páginas públicas con sus meta tags específicos
const SEO_PAGES = [
  {
    path: '/comenzar',
    title: 'Comenzar Gratis | Guro - Software de Seguros con IA',
    description: 'Comienza tu prueba gratuita de 7 días con Guro. Software de seguros con inteligencia artificial para gestionar pólizas, clientes y siniestros. Sin tarjeta de crédito.',
    keywords: 'prueba gratis seguros, software seguros gratis, trial software seguros, comenzar guro, registro guro',
    canonical: 'https://guro.co/comenzar',
  },
  {
    path: '/precios',
    title: 'Precios y Planes | Guro - Software de Seguros',
    description: 'Conoce los planes y precios de Guro. Desde $29.900 COP/mes. Planes flexibles para agencias de seguros de todos los tamaños. Prueba gratis 7 días.',
    keywords: 'precios software seguros, planes guro, costo software seguros, tarifas guro, suscripción seguros',
    canonical: 'https://guro.co/precios',
  },
  {
    path: '/auth/auth1/login',
    title: 'Iniciar Sesión | Guro - Software de Seguros',
    description: 'Accede a tu cuenta de Guro. Gestiona tus pólizas, clientes y siniestros desde cualquier lugar con nuestro software de seguros en la nube.',
    keywords: 'login guro, iniciar sesión seguros, acceso guro, entrar guro',
    canonical: 'https://guro.co/auth/auth1/login',
  },
  {
    path: '/auth/auth1/register',
    title: 'Crear Cuenta | Guro - Software de Seguros con IA',
    description: 'Regístrate gratis en Guro y transforma tu agencia de seguros. 7 días de prueba sin compromiso. Gestión de pólizas, clientes y siniestros con IA.',
    keywords: 'registro guro, crear cuenta seguros, registrarse guro, nueva cuenta seguros',
    canonical: 'https://guro.co/auth/auth1/register',
  },
  {
    path: '/auth/login',
    title: 'Iniciar Sesión | Guro',
    description: 'Inicia sesión en Guro para acceder a tu panel de gestión de seguros.',
    keywords: 'login guro, iniciar sesión',
    canonical: 'https://guro.co/auth/login',
  },
  {
    path: '/auth/register',
    title: 'Registrarse | Guro',
    description: 'Crea tu cuenta en Guro y comienza a gestionar tu agencia de seguros.',
    keywords: 'registro guro, crear cuenta',
    canonical: 'https://guro.co/auth/register',
  },
  {
    path: '/empleados/login',
    title: 'Acceso Empleados | Guro - Portal de Colaboradores',
    description: 'Portal de acceso para empleados de agencias de seguros que usan Guro. Gestiona tus tareas, clientes y comisiones.',
    keywords: 'login empleados seguros, acceso colaboradores guro, portal empleados',
    canonical: 'https://guro.co/empleados/login',
  },
  {
    path: '/terminos-condiciones',
    title: 'Términos y Condiciones | Guro',
    description: 'Términos y condiciones de uso del software de seguros Guro. Conoce tus derechos y obligaciones como usuario.',
    keywords: 'términos condiciones guro, legal guro, contrato uso guro',
    canonical: 'https://guro.co/terminos-condiciones',
  },
  {
    path: '/politica-privacidad',
    title: 'Política de Privacidad | Guro',
    description: 'Política de privacidad de Guro. Conoce cómo protegemos tus datos y los de tus clientes en nuestro software de seguros.',
    keywords: 'privacidad guro, protección datos seguros, política privacidad',
    canonical: 'https://guro.co/politica-privacidad',
  },
  {
    path: '/comenzar/registro',
    title: 'Registro - Paso Final | Guro',
    description: 'Completa tu registro en Guro y comienza tu prueba gratuita de 7 días. Software de seguros con IA.',
    keywords: 'registro guro, completar registro, finalizar cuenta',
    canonical: 'https://guro.co/comenzar/registro',
  },
];

// Leer el index.html base
const baseHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

// Función para generar HTML con meta tags específicos
function generatePageHtml(page) {
  let html = baseHtml;
  
  // Reemplazar título
  html = html.replace(
    /<title>.*?<\/title>/,
    `<title>${page.title}</title>`
  );
  
  // Reemplazar meta description
  html = html.replace(
    /<meta name="description" content=".*?"/,
    `<meta name="description" content="${page.description}"`
  );
  
  // Reemplazar meta keywords
  html = html.replace(
    /<meta name="keywords" content=".*?"/,
    `<meta name="keywords" content="${page.keywords}"`
  );
  
  // Reemplazar canonical URL
  html = html.replace(
    /<link rel="canonical" href=".*?"/,
    `<link rel="canonical" href="${page.canonical}"`
  );
  
  // Reemplazar Open Graph title
  html = html.replace(
    /<meta property="og:title" content=".*?"/,
    `<meta property="og:title" content="${page.title}"`
  );
  
  // Reemplazar Open Graph description
  html = html.replace(
    /<meta property="og:description" content=".*?"/,
    `<meta property="og:description" content="${page.description}"`
  );
  
  // Reemplazar Open Graph URL
  html = html.replace(
    /<meta property="og:url" content=".*?"/,
    `<meta property="og:url" content="${page.canonical}"`
  );
  
  // Reemplazar Twitter title
  html = html.replace(
    /<meta name="twitter:title" content=".*?"/,
    `<meta name="twitter:title" content="${page.title}"`
  );
  
  // Reemplazar Twitter description
  html = html.replace(
    /<meta name="twitter:description" content=".*?"/,
    `<meta name="twitter:description" content="${page.description}"`
  );
  
  return html;
}

// Crear directorios y archivos HTML
console.log('🚀 Generando páginas SEO estáticas...\n');

SEO_PAGES.forEach(page => {
  const pagePath = page.path.startsWith('/') ? page.path.slice(1) : page.path;
  const dirPath = path.join(distDir, pagePath);
  const filePath = path.join(dirPath, 'index.html');
  
  // Crear directorio si no existe
  fs.mkdirSync(dirPath, { recursive: true });
  
  // Generar y escribir HTML
  const html = generatePageHtml(page);
  fs.writeFileSync(filePath, html);
  
  console.log(`✅ ${page.path} -> ${filePath}`);
});

console.log('\n✨ Páginas SEO generadas exitosamente!');
console.log(`📄 Total: ${SEO_PAGES.length} páginas`);
