// Mapa completo de rutas del sistema Guro
export interface RouteInfo {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  synonyms: string[];
}

export const SYSTEM_ROUTES: RouteInfo[] = [
  // Dashboard
  {
    path: '/apps/',
    title: 'Dashboard Principal',
    description: 'Panel de control principal con métricas y resumen de actividades',
    keywords: ['dashboard', 'inicio', 'principal', 'panel', 'métricas'],
    category: 'dashboard',
    synonyms: ['home', 'inicio', 'panel principal', 'dashboard', 'escritorio']
  },
  {
    path: '/apps/dashboards/dashboard2',
    title: 'Dashboard Analítico',
    description: 'Dashboard con análisis detallado y tendencias',
    keywords: ['análisis', 'analytics', 'tendencias', 'estadísticas'],
    category: 'dashboard',
    synonyms: ['analytics', 'análisis', 'estadísticas', 'métricas avanzadas']
  },
  {
    path: '/apps/dashboards/dashboard3',
    title: 'Dashboard Ejecutivo',
    description: 'Vista ejecutiva con KPIs y resumen estratégico',
    keywords: ['ejecutivo', 'kpi', 'estratégico', 'resumen'],
    category: 'dashboard',
    synonyms: ['ejecutivo', 'gerencial', 'directivo', 'estratégico']
  },

  // Seguros - Pólizas
  {
    path: '/apps/seguros/polizas',
    title: 'Lista de Pólizas',
    description: 'Gestión completa de pólizas de seguros',
    keywords: ['pólizas', 'seguros', 'contratos', 'cobertura'],
    category: 'seguros',
    synonyms: ['pólizas', 'seguros', 'contratos', 'coberturas', 'asegurados']
  },
  {
    path: '/apps/seguros/polizas/nueva',
    title: 'Nueva Póliza',
    description: 'Crear nueva póliza de seguros',
    keywords: ['nueva', 'crear', 'póliza', 'emisión'],
    category: 'seguros',
    synonyms: ['crear póliza', 'nueva póliza', 'emitir póliza', 'generar póliza']
  },
  {
    path: '/apps/seguros/renovaciones',
    title: 'Renovaciones',
    description: 'Gestión de renovaciones de pólizas',
    keywords: ['renovaciones', 'vencimientos', 'renovar'],
    category: 'seguros',
    synonyms: ['renovaciones', 'renovar', 'vencimientos', 'próximos vencimientos']
  },

  // Seguros - Clientes
  {
    path: '/apps/seguros/clientes',
    title: 'Lista de Clientes',
    description: 'Gestión de cartera de clientes',
    keywords: ['clientes', 'asegurados', 'cartera', 'contactos'],
    category: 'seguros',
    synonyms: ['clientes', 'asegurados', 'contactos', 'cartera', 'usuarios']
  },
  {
    path: '/apps/seguros/clientes/nuevo',
    title: 'Nuevo Cliente',
    description: 'Registrar nuevo cliente',
    keywords: ['nuevo', 'cliente', 'registro', 'asegurado'],
    category: 'seguros',
    synonyms: ['nuevo cliente', 'crear cliente', 'registrar cliente', 'agregar cliente']
  },
  {
    path: '/apps/seguros/seguimiento',
    title: 'Seguimiento de Clientes',
    description: 'Seguimiento y gestión de relaciones con clientes',
    keywords: ['seguimiento', 'crm', 'relaciones', 'gestión'],
    category: 'seguros',
    synonyms: ['seguimiento', 'crm', 'gestión clientes', 'relaciones']
  },

  // Seguros - Siniestros
  {
    path: '/apps/seguros/siniestros',
    title: 'Siniestros Activos',
    description: 'Gestión de siniestros y reclamaciones',
    keywords: ['siniestros', 'reclamaciones', 'claims', 'incidentes'],
    category: 'seguros',
    synonyms: ['siniestros', 'reclamaciones', 'claims', 'incidentes', 'reportes']
  },
  {
    path: '/apps/seguros/siniestros/nuevo',
    title: 'Nuevo Siniestro',
    description: 'Reportar nuevo siniestro',
    keywords: ['nuevo', 'siniestro', 'reporte', 'incidente'],
    category: 'seguros',
    synonyms: ['nuevo siniestro', 'reportar siniestro', 'crear siniestro', 'registrar incidente']
  },
  {
    path: '/apps/seguros/historial',
    title: 'Historial de Siniestros',
    description: 'Historial completo de siniestros',
    keywords: ['historial', 'histórico', 'pasados', 'archivo'],
    category: 'seguros',
    synonyms: ['historial', 'histórico', 'archivo', 'siniestros pasados']
  },


  // Inteligencia Artificial
  {
    path: '/apps/ia/asistente',
    title: 'Chatbot',
    description: 'Guro AI Assistant (Chatbot)',
    keywords: ['chatbot', 'ia', 'asistente', 'virtual', 'inteligencia'],
    category: 'ia',
    synonyms: ['chatbot', 'asistente ia', 'guro ai assistant', 'ai', 'bot']
  },
  {
    path: '/apps/ia/lectura-automatica',
    title: 'Lectura Automática',
    description: 'Procesamiento automático de documentos',
    keywords: ['lectura', 'automática', 'ocr', 'documentos'],
    category: 'ia',
    synonyms: ['lectura automática', 'ocr', 'escaneo', 'procesamiento documentos']
  },
  {
    path: '/apps/ia/ventas-cruzadas',
    title: 'Ventas cruzadas',
    description: 'Recomendaciones inteligentes de productos',
    keywords: ['ventas', 'cruzadas', 'recomendaciones', 'productos'],
    category: 'ia',
    synonyms: ['ventas cruzadas', 'recomendaciones', 'cross-selling', 'productos adicionales']
  },

   // Marketing
    {
      path: '/apps/marketing/enlaces-cotizacion',
      title: 'Enlaces de Cotización',
      description: 'Gestión de enlaces para cotizaciones',
      keywords: ['enlaces', 'cotización', 'links', 'marketing'],
      category: 'marketing',
      synonyms: ['enlaces', 'links', 'cotización online', 'marketing digital']
    },
    {
      path: '/apps/marketing/mini-web',
      title: 'Mini Web',
      description: 'Creador de mini sitios tipo link-in-bio con enlaces, contacto y colores personalizados',
      keywords: ['mini web', 'link in bio', 'perfil', 'enlaces', 'marketing'],
      category: 'marketing',
      synonyms: ['mini web', 'link-in-bio', 'landing personal', 'link my bio']
    },
    {
      path: '/apps/marketing/recordatorios',
      title: 'Recordatorios',
      description: 'Sistema de recordatorios y notificaciones',
      keywords: ['recordatorios', 'notificaciones', 'alertas', 'avisos'],
      category: 'marketing',
      synonyms: ['recordatorios', 'notificaciones', 'alertas', 'avisos', 'seguimiento']
    },

  // Administración
  {
    path: '/apps/admin/usuarios',
    title: 'Usuarios',
    description: 'Gestión de usuarios del sistema',
    keywords: ['usuarios', 'permisos', 'acceso', 'roles'],
    category: 'admin',
    synonyms: ['usuarios', 'permisos', 'roles', 'accesos', 'cuentas']
  },
  {
    path: '/apps/admin/informacion-agencia',
    title: 'Información de Agencia',
    description: 'Configuración de datos de la agencia',
    keywords: ['agencia', 'información', 'configuración', 'datos'],
    category: 'admin',
    synonyms: ['agencia', 'empresa', 'información', 'datos empresa', 'configuración']
  },
  {
    path: '/apps/admin/sedes',
    title: 'Sedes',
    description: 'Gestión de sedes y sucursales',
    keywords: ['sedes', 'sucursales', 'oficinas', 'ubicaciones'],
    category: 'admin',
    synonyms: ['sedes', 'sucursales', 'oficinas', 'ubicaciones', 'puntos']
  },
  {
    path: '/apps/admin/aseguradoras',
    title: 'Aseguradoras',
    description: 'Gestión de compañías aseguradoras',
    keywords: ['aseguradoras', 'compañías', 'proveedores', 'carriers'],
    category: 'admin',
    synonyms: ['aseguradoras', 'compañías', 'carriers', 'proveedores', 'empresas seguros']
  },
  {
    path: '/apps/admin/ramos',
    title: 'Ramos',
    description: 'Configuración de ramos de seguros',
    keywords: ['ramos', 'tipos', 'categorías', 'productos'],
    category: 'admin',
    synonyms: ['ramos', 'tipos seguros', 'categorías', 'productos', 'líneas']
  },
  {
    path: '/apps/admin/vendedores',
    title: 'Vendedores',
    description: 'Gestión de equipo de ventas',
    keywords: ['vendedores', 'agentes', 'equipo', 'comercial'],
    category: 'admin',
    synonyms: ['vendedores', 'agentes', 'comerciales', 'equipo ventas', 'asesores']
  },
  {
    path: '/apps/admin/coberturas',
    title: 'Coberturas',
    description: 'Configuración de coberturas disponibles',
    keywords: ['coberturas', 'beneficios', 'protecciones', 'garantías'],
    category: 'admin',
    synonyms: ['coberturas', 'beneficios', 'protecciones', 'garantías', 'amparos']
  },

  // Apps Generales
  {
    path: '/apps/contacts',
    title: 'Contactos',
    description: 'Gestión de contactos y agenda',
    keywords: ['contactos', 'agenda', 'directorio', 'personas'],
    category: 'general',
    synonyms: ['contactos', 'agenda', 'directorio', 'personas', 'clientes']
  },
  {
    path: '/apps/chats',
    title: 'Chat',
    description: 'Sistema de mensajería y comunicación',
    keywords: ['chat', 'mensajes', 'comunicación', 'conversaciones'],
    category: 'general',
    synonyms: ['chat', 'mensajes', 'conversaciones', 'comunicación', 'mensajería']
  },
  {
    path: '/apps/email',
    title: 'Correo Electrónico',
    description: 'Gestión de correos electrónicos',
    keywords: ['email', 'correo', 'mensajes', 'comunicación'],
    category: 'general',
    synonyms: ['email', 'correo', 'correo electrónico', 'mail', 'mensajes']
  },
  {
    path: '/apps/calendar',
    title: 'Calendario',
    description: 'Gestión de calendario y citas',
    keywords: ['calendario', 'citas', 'agenda', 'eventos'],
    category: 'general',
    synonyms: ['calendario', 'agenda', 'citas', 'eventos', 'programación']
  },
  {
    path: '/apps/notes',
    title: 'Notas',
    description: 'Sistema de notas y recordatorios',
    keywords: ['notas', 'apuntes', 'recordatorios', 'memos'],
    category: 'general',
    synonyms: ['notas', 'apuntes', 'recordatorios', 'memos', 'anotaciones']
  },
  {
    path: '/apps/kanban',
    title: 'Gestión de Tareas',
    description: 'Tablero Kanban para gestión de proyectos',
    keywords: ['kanban', 'tareas', 'proyectos', 'gestión'],
    category: 'general',
    synonyms: ['kanban', 'tareas', 'proyectos', 'tablero', 'gestión proyectos']
  },
  {
    path: '/apps/tickets',
    title: 'Tickets de Soporte',
    description: 'Sistema de tickets y soporte técnico',
    keywords: ['tickets', 'soporte', 'ayuda', 'incidencias'],
    category: 'general',
    synonyms: ['tickets', 'soporte', 'ayuda', 'incidencias', 'support']
  },
  {
    path: '/apps/invoice/list',
    title: 'Facturas',
    description: 'Gestión de facturación y pagos',
    keywords: ['facturas', 'facturación', 'pagos', 'cobros'],
    category: 'general',
    synonyms: ['facturas', 'facturación', 'pagos', 'cobros', 'billing']
  }
];

// Función para buscar rutas por intención del usuario
export const findRouteByIntent = (userIntent: string): RouteInfo | null => {
  const intent = userIntent.toLowerCase().trim();
  
  // Buscar coincidencia exacta en synonyms
  for (const route of SYSTEM_ROUTES) {
    if (route.synonyms.some(synonym => 
      intent.includes(synonym.toLowerCase()) || 
      synonym.toLowerCase().includes(intent)
    )) {
      return route;
    }
  }
  
  // Buscar en keywords
  for (const route of SYSTEM_ROUTES) {
    if (route.keywords.some(keyword => 
      intent.includes(keyword.toLowerCase()) || 
      keyword.toLowerCase().includes(intent)
    )) {
      return route;
    }
  }
  
  // Buscar en título
  for (const route of SYSTEM_ROUTES) {
    if (intent.includes(route.title.toLowerCase()) || 
        route.title.toLowerCase().includes(intent)) {
      return route;
    }
  }
  
  return null;
};

// Función para obtener rutas por categoría
export const getRoutesByCategory = (category: string): RouteInfo[] => {
  return SYSTEM_ROUTES.filter(route => route.category === category);
};

// Función para obtener todas las categorías
export const getCategories = (): string[] => {
  return [...new Set(SYSTEM_ROUTES.map(route => route.category))];
}; 