export interface PageMetadata {
  title: string;
  description: string;
  keywords: string;
  ogTitle?: string;
  ogDescription?: string;
}

export const pageMetadata: Record<string, PageMetadata> = {
  // Dashboard
  dashboard: {
    title: 'Dashboard Principal',
    description: 'Panel de control principal del software de seguros Guro con métricas de agencia, análisis de rendimiento y resumen de actividades de seguros.',
    keywords: 'dashboard seguros, métricas agencia, software seguros, análisis rendimiento, KPI seguros, gestión agencia'
  },
  
  dashboard2: {
    title: 'Dashboard Analítico',
    description: 'Dashboard avanzado con análisis detallado de pólizas, siniestros y tendencias del mercado de seguros.',
    keywords: 'análisis, tendencias, mercado, seguros, estadísticas'
  },
  
  dashboard3: {
    title: 'Dashboard Ejecutivo',
    description: 'Vista ejecutiva con indicadores clave de rendimiento y resumen estratégico del negocio de seguros.',
    keywords: 'ejecutivo, estratégico, KPI, rendimiento, negocio'
  },

  // Seguros
  'seguros-polizas': {
    title: 'Gestión de Pólizas',
    description: 'Administra todas las pólizas de seguros con el software Guro: consulta, edita y gestiona el ciclo de vida completo de las pólizas con inteligencia artificial.',
    keywords: 'gestión pólizas, software seguros, administración pólizas, ciclo vida pólizas, IA seguros, automatización pólizas'
  },
  
  'seguros-polizas-nueva': {
    title: 'Nueva Póliza',
    description: 'Crea nuevas pólizas de seguros con nuestro sistema inteligente de cotización y emisión automática.',
    keywords: 'nueva póliza, crear, emisión, cotización, seguros'
  },
  
  'seguros-clientes': {
    title: 'Gestión de Clientes',
    description: 'Administra tu cartera de clientes, historial de pólizas y perfil de riesgo de cada asegurado.',
    keywords: 'clientes, cartera, historial, perfil de riesgo, asegurados'
  },
  
  'seguros-clientes-nuevo': {
    title: 'Nuevo Cliente',
    description: 'Registra nuevos clientes en el sistema con validación automática de datos y análisis de riesgo.',
    keywords: 'nuevo cliente, registro, validación, análisis de riesgo'
  },
  
  'seguros-siniestros': {
    title: 'Gestión de Siniestros',
    description: 'Administra siniestros activos, seguimiento de casos y proceso de liquidación de reclamaciones.',
    keywords: 'siniestros, reclamaciones, liquidación, seguimiento, casos'
  },
  
  'seguros-siniestros-nuevo': {
    title: 'Nuevo Siniestro',
    description: 'Registra nuevos siniestros con evaluación automática de daños y estimación de costos.',
    keywords: 'nuevo siniestro, registro, evaluación, daños, costos'
  },
  
  
  'seguros-renovaciones': {
    title: 'Renovaciones',
    description: 'Gestiona el proceso de renovación de pólizas con recordatorios automáticos y ofertas personalizadas.',
    keywords: 'renovaciones, recordatorios, ofertas personalizadas, pólizas'
  },
  
  'seguros-seguimiento': {
    title: 'Seguimiento',
    description: 'Monitorea el estado de pólizas, pagos pendientes y actividades de seguimiento de clientes.',
    keywords: 'seguimiento, monitoreo, pagos, actividades, clientes'
  },
  
  'seguros-historial': {
    title: 'Historial',
    description: 'Consulta el historial completo de transacciones, cambios en pólizas y actividades del sistema.',
    keywords: 'historial, transacciones, cambios, actividades, auditoría'
  },

  // IA
  'ia-asistente': {
    title: 'Chatbot',
    description: 'Guro AI Assistant - Asistente de inteligencia artificial para consultas sobre seguros, análisis de riesgos y recomendaciones automatizadas.',
    keywords: 'chatbot seguros, asistente IA seguros, consultas seguros, análisis riesgos, recomendaciones IA, inteligencia artificial seguros'
  },
  
  'ia-lectura-automatica': {
    title: 'Lectura Automática',
    description: 'Procesamiento automático de documentos con IA para extracción de datos y clasificación inteligente.',
    keywords: 'lectura automática, IA, documentos, extracción de datos'
  },
  
  'ia-ventas-cruzadas': {
    title: 'Ventas cruzadas',
    description: 'Identificación inteligente de oportunidades de ventas cruzadas basada en análisis predictivo.',
    keywords: 'ventas cruzadas, IA, oportunidades, análisis predictivo'
  },
  
  'ia-predicciones': {
    title: 'Predicciones de venta',
    description: 'Predicciones avanzadas de ventas, riesgo y tendencias del mercado con IA.',
    keywords: 'predicciones de venta, análisis predictivo, riesgo, tendencias'
  },
  
  'ia-modelos': {
    title: 'Modelos de IA',
    description: 'Gestión y configuración de modelos de inteligencia artificial para diferentes tipos de análisis.',
    keywords: 'modelos IA, configuración, análisis, machine learning'
  },

  // Marketing
  'marketing-enlaces': {
    title: 'Enlaces de Cotización',
    description: 'Crea y gestiona enlaces personalizados para cotizaciones online con seguimiento de conversiones.',
    keywords: 'enlaces, cotización online, conversiones, marketing digital'
  },
  
  'marketing-recordatorios': {
    title: 'Recordatorios',
    description: 'Sistema de recordatorios automáticos para renovaciones, pagos y seguimiento de clientes.',
    keywords: 'recordatorios, automáticos, renovaciones, pagos, seguimiento'
  },

  // Administración
  'admin-usuarios': {
    title: 'Gestión de Usuarios',
    description: 'Administra usuarios del sistema, permisos, roles y control de acceso a funcionalidades.',
    keywords: 'usuarios, permisos, roles, control de acceso, administración'
  },
  
  'admin-informacion-agencia': {
    title: 'Información de Agencia',
    description: 'Configuración y datos principales de la agencia de seguros, información corporativa y contacto.',
    keywords: 'agencia, información corporativa, configuración, datos'
  },
  
  'admin-sedes': {
    title: 'Gestión de Sedes',
    description: 'Administra las diferentes sedes y sucursales de la agencia con información de contacto y ubicación.',
    keywords: 'sedes, sucursales, ubicación, contacto, agencia'
  },
  
  'admin-aseguradoras': {
    title: 'Gestión de Aseguradoras',
    description: 'Administra las compañías aseguradoras asociadas, productos disponibles y condiciones comerciales.',
    keywords: 'aseguradoras, compañías, productos, condiciones comerciales'
  },
  
  'admin-ramos': {
    title: 'Gestión de Ramos',
    description: 'Configuración de ramos de seguros disponibles, coberturas y características de cada producto.',
    keywords: 'ramos, seguros, coberturas, productos, configuración'
  },
  
  'admin-vendedores': {
    title: 'Gestión de Vendedores',
    description: 'Administra el equipo de ventas, asignación de carteras y seguimiento de performance comercial.',
    keywords: 'vendedores, equipo de ventas, carteras, performance comercial'
  },
  
  'admin-estados-siniestros': {
    title: 'Estados de Siniestros',
    description: 'Configuración de estados del proceso de siniestros y flujo de trabajo para reclamaciones.',
    keywords: 'estados siniestros, proceso, flujo de trabajo, reclamaciones'
  },
  
  'admin-estados-arl': {
    title: 'Estados ARL',
    description: 'Gestión de estados específicos para seguros de Accidentes de Trabajo y Enfermedades Laborales.',
    keywords: 'ARL, accidentes trabajo, enfermedades laborales, estados'
  },
  
  'admin-motivos-estados-poliza': {
    title: 'Motivos de Estados de Póliza',
    description: 'Configuración de motivos y razones para cambios de estado en pólizas de seguros.',
    keywords: 'motivos, estados póliza, cambios, razones, configuración'
  },
  
  'admin-tipo-afiliacion': {
    title: 'Tipos de Afiliación',
    description: 'Gestión de tipos de afiliación para diferentes modalidades de seguros y coberturas.',
    keywords: 'tipos afiliación, modalidades, seguros, coberturas'
  },
  
  'admin-mensajeros': {
    title: 'Gestión de Mensajeros',
    description: 'Administra servicios de mensajería para entrega de documentos y correspondencia de seguros.',
    keywords: 'mensajeros, entrega, documentos, correspondencia, servicios'
  },
  
  'admin-coberturas': {
    title: 'Gestión de Coberturas',
    description: 'Configuración de coberturas disponibles, límites, deducibles y condiciones especiales.',
    keywords: 'coberturas, límites, deducibles, condiciones especiales'
  },

  // Customizador
  'customizer-mobile': {
    title: 'Customizador de App Móvil',
    description: 'Personaliza la apariencia de tu aplicación móvil: colores, logos, iconos y configuración visual.',
    keywords: 'customizador, app móvil, personalización, colores, logos, iconos'
  },

  // Apps generales
  'apps-contacts': {
    title: 'Contactos',
    description: 'Gestión de contactos y directorio de clientes, proveedores y colaboradores.',
    keywords: 'contactos, directorio, clientes, proveedores, colaboradores'
  },
  
  'apps-email': {
    title: 'Email',
    description: 'Sistema de correo electrónico integrado para comunicación con clientes y equipo de trabajo.',
    keywords: 'email, correo electrónico, comunicación, clientes'
  },
  
  'apps-calendar': {
    title: 'Calendario',
    description: 'Calendario de citas, recordatorios de renovaciones y programación de actividades comerciales.',
    keywords: 'calendario, citas, recordatorios, renovaciones, actividades'
  },
  
  'apps-notes': {
    title: 'Notas',
    description: 'Sistema de notas y observaciones para seguimiento detallado de clientes y procesos.',
    keywords: 'notas, observaciones, seguimiento, clientes, procesos'
  }
};

export const getPageMetadata = (key: string): PageMetadata => {
  return pageMetadata[key] || {
    title: 'Guro Dashboard',
    description: 'El futuro de la gestión de seguros, potenciado por IA',
    keywords: 'seguros, IA, gestión, dashboard'
  };
}; 