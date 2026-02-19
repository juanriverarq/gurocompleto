export interface Widget {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  html: string;
}

export const widgetCategories = [
  { id: 'hero', label: 'Hero / Banner', icon: 'solar:monitor-bold-duotone' },
  { id: 'feature', label: 'Características', icon: 'solar:widget-5-bold-duotone' },
  { id: 'content', label: 'Contenido', icon: 'solar:document-text-bold-duotone' },
  { id: 'cta', label: 'Call to Action', icon: 'solar:cursor-bold-duotone' },
  { id: 'testimonial', label: 'Testimonios', icon: 'solar:chat-round-dots-bold-duotone' },
  { id: 'pricing', label: 'Precios', icon: 'solar:tag-price-bold-duotone' },
  { id: 'faq', label: 'FAQ', icon: 'solar:question-circle-bold-duotone' },
  { id: 'contact', label: 'Contacto', icon: 'solar:letter-bold-duotone' },
  { id: 'stats', label: 'Estadísticas', icon: 'solar:chart-bold-duotone' },
  { id: 'team', label: 'Equipo', icon: 'solar:users-group-rounded-bold-duotone' },
];

export const widgets: Widget[] = [
  {
    id: 'hero-centered', name: 'Hero Centrado', category: 'hero',
    icon: 'solar:monitor-bold-duotone', description: 'Banner con título y botón centrado',
    html: `<div class="pt-200 lg-pt-120 pb-100 lg-pb-60" style="background:#f8f9fa"><div class="container"><div class="row"><div class="col-xl-8 m-auto text-center"><h1 class="fw-bold tx-dark mb-30">Tu Título Principal Aquí</h1><p class="text-lg tx-dark mb-40">Describe tu propuesta de valor en una o dos líneas convincentes.</p><a href="#" class="btn-twentyTwo fw-500 tran3s">Comenzar Ahora</a></div></div></div></div>`,
  },
  {
    id: 'hero-split', name: 'Hero con Imagen', category: 'hero',
    icon: 'solar:monitor-bold-duotone', description: 'Texto izquierda, imagen derecha',
    html: `<div class="pt-150 lg-pt-100 pb-100 lg-pb-60"><div class="container"><div class="row align-items-center"><div class="col-lg-6"><h1 class="fw-bold tx-dark mb-20">Soluciones que Impulsan tu Negocio</h1><p class="text-lg tx-dark mb-40">Herramientas innovadoras para el siguiente nivel.</p><a href="#" class="btn-twentyTwo fw-500 tran3s">Ver Más</a></div><div class="col-lg-6 text-center"><img src="/images/media/img_01.jpg" alt="hero" class="img-fluid rounded-3" style="max-height:400px;object-fit:cover"></div></div></div></div>`,
  },
  {
    id: 'features-3col', name: '3 Características', category: 'feature',
    icon: 'solar:widget-5-bold-duotone', description: 'Tres columnas con icono y texto',
    html: `<div class="pt-100 lg-pt-60 pb-100 lg-pb-60"><div class="container"><div class="row justify-content-center mb-60"><div class="col-lg-7 text-center"><h2 class="fw-bold tx-dark">Nuestras Características</h2><p class="text-lg tx-dark mt-15">Todo lo que necesitas en un solo lugar</p></div></div><div class="row"><div class="col-lg-4 col-sm-6 mb-40"><div class="p-4 rounded-3" style="background:#fffee7"><div class="mb-20" style="font-size:40px">⚡</div><h4 class="fw-bold tx-dark">Rápido</h4><p class="tx-dark mt-10">Rendimiento optimizado para la mejor experiencia.</p></div></div><div class="col-lg-4 col-sm-6 mb-40"><div class="p-4 rounded-3" style="background:#f0f7ff"><div class="mb-20" style="font-size:40px">🔒</div><h4 class="fw-bold tx-dark">Seguro</h4><p class="tx-dark mt-10">Protección con los más altos estándares.</p></div></div><div class="col-lg-4 col-sm-6 mb-40"><div class="p-4 rounded-3" style="background:#f5f0ff"><div class="mb-20" style="font-size:40px">🎯</div><h4 class="fw-bold tx-dark">Preciso</h4><p class="tx-dark mt-10">Resultados exactos y confiables.</p></div></div></div></div></div>`,
  },
  {
    id: 'content-text-image', name: 'Texto + Imagen', category: 'content',
    icon: 'solar:document-text-bold-duotone', description: 'Texto izquierda, imagen derecha',
    html: `<div class="pt-100 lg-pt-60 pb-100 lg-pb-60"><div class="container"><div class="row align-items-center"><div class="col-lg-6 mb-40"><h6 class="text-uppercase" style="color:#6366f1;letter-spacing:2px">Sobre Nosotros</h6><h2 class="fw-bold tx-dark mt-10 mb-20">Conoce Nuestra Historia</h2><p class="text-lg tx-dark mb-30">Somos un equipo apasionado por crear soluciones transformadoras.</p></div><div class="col-lg-6 text-center"><img src="/images/media/img_02.jpg" alt="about" class="img-fluid rounded-3" style="max-height:400px;object-fit:cover"></div></div></div></div>`,
  },
  {
    id: 'cta-banner', name: 'Banner CTA', category: 'cta',
    icon: 'solar:cursor-bold-duotone', description: 'Llamada a la acción con fondo de color',
    html: `<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;margin:40px 20px"><div class="container"><div class="row align-items-center py-80 lg-py-40"><div class="col-lg-8 text-center text-lg-start"><h2 class="fw-bold text-white mb-10">¿Listo para empezar?</h2><p class="text-white" style="opacity:0.85">Únete a miles de empresas que confían en nosotros.</p></div><div class="col-lg-4 text-center text-lg-end mt-20 mt-lg-0"><a href="#" class="btn-twentyTwo fw-500 tran3s" style="background:#fff;color:#6366f1">Comenzar Gratis</a></div></div></div></div>`,
  },
  {
    id: 'testimonials-cards', name: 'Testimonios', category: 'testimonial',
    icon: 'solar:chat-round-dots-bold-duotone', description: 'Tres tarjetas de testimonios',
    html: `<div class="pt-100 lg-pt-60 pb-80 lg-pb-40" style="background:#f8f9fa"><div class="container"><div class="row justify-content-center mb-60"><div class="col-lg-7 text-center"><h2 class="fw-bold tx-dark">Lo que dicen nuestros clientes</h2></div></div><div class="row"><div class="col-lg-4 mb-40"><div class="bg-white p-4 rounded-3 shadow-sm h-100"><p class="tx-dark mb-20" style="font-style:italic">"Excelente servicio. Superaron todas nuestras expectativas."</p><h6 class="fw-bold tx-dark mb-0">María García</h6><span class="tx-dark" style="font-size:13px">CEO, TechCorp</span></div></div><div class="col-lg-4 mb-40"><div class="bg-white p-4 rounded-3 shadow-sm h-100"><p class="tx-dark mb-20" style="font-style:italic">"La mejor inversión. Nuestro negocio creció un 200%."</p><h6 class="fw-bold tx-dark mb-0">Carlos López</h6><span class="tx-dark" style="font-size:13px">Director, InnovaLab</span></div></div><div class="col-lg-4 mb-40"><div class="bg-white p-4 rounded-3 shadow-sm h-100"><p class="tx-dark mb-20" style="font-style:italic">"Profesionales y con atención al detalle impresionante."</p><h6 class="fw-bold tx-dark mb-0">Ana Martínez</h6><span class="tx-dark" style="font-size:13px">Fundadora, CreativeHub</span></div></div></div></div></div>`,
  },
  {
    id: 'pricing-3col', name: 'Tabla de Precios', category: 'pricing',
    icon: 'solar:tag-price-bold-duotone', description: 'Tres planes de precios',
    html: `<div class="pt-100 lg-pt-60 pb-80 lg-pb-40"><div class="container"><div class="row justify-content-center mb-60"><div class="col-lg-7 text-center"><h2 class="fw-bold tx-dark">Planes y Precios</h2></div></div><div class="row"><div class="col-lg-4 mb-40"><div class="bg-white p-4 rounded-3 shadow-sm text-center h-100"><h5 class="fw-bold tx-dark">Básico</h5><h2 class="fw-bold mt-20 mb-20" style="color:#6366f1">$9<span style="font-size:16px;color:#999">/mes</span></h2><p class="tx-dark mb-20">5 Proyectos · 10 GB · Email</p><a href="#" class="btn-twentyTwo fw-500 tran3s d-block">Elegir</a></div></div><div class="col-lg-4 mb-40"><div class="p-4 rounded-3 text-center h-100" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"><h5 class="fw-bold text-white">Pro</h5><h2 class="fw-bold text-white mt-20 mb-20">$29<span style="font-size:16px;opacity:0.7">/mes</span></h2><p class="text-white mb-20" style="opacity:0.85">Ilimitado · 100 GB · Prioritario</p><a href="#" class="btn-twentyTwo fw-500 tran3s d-block" style="background:#fff;color:#6366f1">Elegir</a></div></div><div class="col-lg-4 mb-40"><div class="bg-white p-4 rounded-3 shadow-sm text-center h-100"><h5 class="fw-bold tx-dark">Empresa</h5><h2 class="fw-bold mt-20 mb-20" style="color:#6366f1">$79<span style="font-size:16px;color:#999">/mes</span></h2><p class="tx-dark mb-20">Todo Pro · 1 TB · 24/7</p><a href="#" class="btn-twentyTwo fw-500 tran3s d-block">Elegir</a></div></div></div></div></div>`,
  },
  {
    id: 'faq-simple', name: 'FAQ', category: 'faq',
    icon: 'solar:question-circle-bold-duotone', description: 'Preguntas frecuentes',
    html: `<div class="pt-100 lg-pt-60 pb-80 lg-pb-40"><div class="container"><div class="row justify-content-center mb-60"><div class="col-lg-7 text-center"><h2 class="fw-bold tx-dark">Preguntas Frecuentes</h2></div></div><div class="row justify-content-center"><div class="col-lg-8"><div class="mb-30 p-4 bg-white rounded-3 shadow-sm"><h5 class="fw-bold tx-dark mb-10">¿Cómo puedo empezar?</h5><p class="tx-dark">Regístrate y sigue el asistente. En 5 minutos tendrás todo listo.</p></div><div class="mb-30 p-4 bg-white rounded-3 shadow-sm"><h5 class="fw-bold tx-dark mb-10">¿Ofrecen período de prueba?</h5><p class="tx-dark">Sí, 14 días gratis sin tarjeta de crédito.</p></div><div class="mb-30 p-4 bg-white rounded-3 shadow-sm"><h5 class="fw-bold tx-dark mb-10">¿Puedo cancelar en cualquier momento?</h5><p class="tx-dark">Sin contratos. Cancela cuando quieras.</p></div></div></div></div></div>`,
  },
  {
    id: 'contact-form', name: 'Contacto', category: 'contact',
    icon: 'solar:letter-bold-duotone', description: 'Formulario de contacto',
    html: `<div class="pt-100 lg-pt-60 pb-100 lg-pb-60" style="background:#f8f9fa"><div class="container"><div class="row justify-content-center mb-60"><div class="col-lg-7 text-center"><h2 class="fw-bold tx-dark">Contáctanos</h2></div></div><div class="row justify-content-center"><div class="col-lg-8"><div class="bg-white p-5 rounded-3 shadow-sm"><div class="row"><div class="col-md-6 mb-20"><input type="text" placeholder="Nombre" class="form-control" style="height:50px;border-radius:8px"></div><div class="col-md-6 mb-20"><input type="email" placeholder="Email" class="form-control" style="height:50px;border-radius:8px"></div><div class="col-12 mb-20"><textarea placeholder="Tu mensaje..." class="form-control" rows="5" style="border-radius:8px"></textarea></div><div class="col-12 text-center"><button class="btn-twentyTwo fw-500 tran3s">Enviar</button></div></div></div></div></div></div></div>`,
  },
  {
    id: 'stats-counters', name: 'Contadores', category: 'stats',
    icon: 'solar:chart-bold-duotone', description: 'Estadísticas con números',
    html: `<div class="pt-80 lg-pt-40 pb-80 lg-pb-40" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"><div class="container"><div class="row text-center text-white"><div class="col-lg-3 col-sm-6 mb-30"><h2 class="fw-bold" style="font-size:48px">500+</h2><p style="opacity:0.85">Clientes</p></div><div class="col-lg-3 col-sm-6 mb-30"><h2 class="fw-bold" style="font-size:48px">1200+</h2><p style="opacity:0.85">Proyectos</p></div><div class="col-lg-3 col-sm-6 mb-30"><h2 class="fw-bold" style="font-size:48px">50+</h2><p style="opacity:0.85">Países</p></div><div class="col-lg-3 col-sm-6 mb-30"><h2 class="fw-bold" style="font-size:48px">99%</h2><p style="opacity:0.85">Satisfacción</p></div></div></div></div>`,
  },
  {
    id: 'team-cards', name: 'Equipo', category: 'team',
    icon: 'solar:users-group-rounded-bold-duotone', description: 'Tarjetas del equipo',
    html: `<div class="pt-100 lg-pt-60 pb-80 lg-pb-40"><div class="container"><div class="row justify-content-center mb-60"><div class="col-lg-7 text-center"><h2 class="fw-bold tx-dark">Nuestro Equipo</h2></div></div><div class="row"><div class="col-lg-3 col-sm-6 mb-40 text-center"><img src="/images/media/img_01.jpg" alt="team" class="rounded-circle mb-15" style="width:120px;height:120px;object-fit:cover"><h5 class="fw-bold tx-dark mb-5">Juan Pérez</h5><p class="tx-dark">CEO</p></div><div class="col-lg-3 col-sm-6 mb-40 text-center"><img src="/images/media/img_02.jpg" alt="team" class="rounded-circle mb-15" style="width:120px;height:120px;object-fit:cover"><h5 class="fw-bold tx-dark mb-5">Ana García</h5><p class="tx-dark">Diseño</p></div><div class="col-lg-3 col-sm-6 mb-40 text-center"><img src="/images/media/img_03.jpg" alt="team" class="rounded-circle mb-15" style="width:120px;height:120px;object-fit:cover"><h5 class="fw-bold tx-dark mb-5">Carlos Ruiz</h5><p class="tx-dark">CTO</p></div><div class="col-lg-3 col-sm-6 mb-40 text-center"><img src="/images/media/img_04.jpg" alt="team" class="rounded-circle mb-15" style="width:120px;height:120px;object-fit:cover"><h5 class="fw-bold tx-dark mb-5">Laura S.</h5><p class="tx-dark">Marketing</p></div></div></div></div>`,
  },
];
