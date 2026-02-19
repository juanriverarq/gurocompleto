export interface JanoTemplate {
  id: string;
  name: string;
  description: string;
  route: string; // Jano SPA route
  category: 'business' | 'creative' | 'landing' | 'portfolio';
  preview: string; // thumbnail path
}

export const janoTemplates: JanoTemplate[] = [
  {
    id: 'insurance',
    name: 'Seguros Clásico',
    description: 'Página principal con hero, servicios de seguros, testimonios y contacto.',
    route: '/',
    category: 'business',
    preview: '/website-builder/images/media/img_01.jpg',
  },
  {
    id: 'web-hosting',
    name: 'Planes y Coberturas',
    description: 'Muestra planes de seguros con precios, FAQ y formulario de contacto.',
    route: '/home/web-hosting',
    category: 'business',
    preview: '/website-builder/images/media/img_02.jpg',
  },
  {
    id: 'education',
    name: 'Centro de Seguros',
    description: 'Plataforma informativa con tipos de coberturas y testimonios de clientes.',
    route: '/home/education',
    category: 'business',
    preview: '/website-builder/images/media/img_03.jpg',
  },
  {
    id: 'charity',
    name: 'Protección Social',
    description: 'Enfoque solidario con llamados a la acción y comunidad asegurada.',
    route: '/home/charity',
    category: 'business',
    preview: '/website-builder/images/media/img_04.jpg',
  },
  {
    id: 'real-estate',
    name: 'Seguro Patrimonial',
    description: 'Búsqueda de pólizas para propiedades con listados y filtros.',
    route: '/home/real-estate',
    category: 'business',
    preview: '/website-builder/images/media/img_05.jpg',
  },
  {
    id: 'sass-product',
    name: 'Plataforma Digital',
    description: 'Landing moderna con features de la plataforma de seguros y precios.',
    route: '/home/sass-product',
    category: 'landing',
    preview: '/website-builder/images/media/img_06.jpg',
  },
  {
    id: 'app-landing',
    name: 'App de Seguros',
    description: 'Landing para la app móvil de gestión de pólizas y siniestros.',
    route: '/home/app-landing',
    category: 'landing',
    preview: '/website-builder/images/media/img_07.jpg',
  },
  {
    id: 'crypto',
    name: 'Seguros Confiables',
    description: 'Diseño moderno con estadísticas de cobertura y confianza.',
    route: '/home/crypto',
    category: 'landing',
    preview: '/website-builder/images/media/img_08.jpg',
  },
  {
    id: 'personal-portfolio',
    name: 'Asesor de Seguros',
    description: 'Perfil de asesor con experiencia, habilidades y casos de éxito.',
    route: '/home/personal-portfolio',
    category: 'portfolio',
    preview: '/website-builder/images/media/img_09.jpg',
  },
  {
    id: 'agency-modern',
    name: 'Agencia Moderna',
    description: 'Agencia de seguros moderna con equipo y portafolio de servicios.',
    route: '/home/agency-modern',
    category: 'creative',
    preview: '/website-builder/images/media/img_10.jpg',
  },
  {
    id: 'seo-agency',
    name: 'Agencia Digital',
    description: 'Agencia de seguros digital con servicios y casos de éxito.',
    route: '/home/seo-agency',
    category: 'creative',
    preview: '/website-builder/images/media/img_11.jpg',
  },
  {
    id: 'design-agency',
    name: 'Agencia Creativa',
    description: 'Diseño creativo para agencia de seguros con portafolio visual.',
    route: '/home/design-agency',
    category: 'creative',
    preview: '/website-builder/images/media/img_12.jpg',
  },
  {
    id: 'lead-generation',
    name: 'Captación de Clientes',
    description: 'Landing de captación de prospectos con formularios y llamados a la acción.',
    route: '/home/lead-generation',
    category: 'landing',
    preview: '/website-builder/images/media/img_13.jpg',
  },
];

export const templateCategories = [
  { id: 'all', label: 'Todos' },
  { id: 'business', label: 'Negocios' },
  { id: 'creative', label: 'Creativos' },
  { id: 'landing', label: 'Landing Pages' },
  { id: 'portfolio', label: 'Portfolio' },
] as const;

