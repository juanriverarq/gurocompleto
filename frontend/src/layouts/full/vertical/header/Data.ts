//Apps Links Type & Data
interface appsLinkType {
  href: string;
  title: string;
  subtext: string;
  icon: string;
  iconbg: string;
  iconcolor: string;
}

const appsLink: appsLinkType[] = [
  {
    href: "#",
    title: "Asistente IA",
    subtext: "Consulta experta en seguros 24/7",
    icon: "solar:chat-round-line-bold-duotone",
    iconbg: "bg-lightprimary",
    iconcolor: "text-primary",
  },
  {
    href: "#",
    title: "Lectura Automática",
    subtext: "Procesamiento de documentos con IA",
    icon: "solar:document-text-bold-duotone",
    iconbg: "bg-lightsecondary",
    iconcolor: "text-secondary",
  },
  {
    href: "#",
    title: "Ventas Cruzadas IA",
    subtext: "Identifica oportunidades automáticamente",
    icon: "solar:chart-2-bold-duotone",
    iconbg: "bg-lightwarning",
    iconcolor: "text-warning",
  },
  {
    href: "#",
    title: "Análisis Predictivo",
    subtext: "Predicciones de riesgo y renovación",
    icon: "solar:graph-up-bold-duotone",
    iconbg: "bg-lighterror",
    iconcolor: "text-error",
  },
  {
    href: "#",
    title: "Automatización Siniestros",
    subtext: "Procesamiento inteligente de reclamaciones",
    icon: "solar:shield-check-bold-duotone",
    iconbg: "bg-lightsuccess",
    iconcolor: "text-success",
  },
  {
    href: "#",
    title: "Scoring de Clientes",
    subtext: "Evaluación automática de perfiles",
    icon: "solar:user-check-bold-duotone",
    iconbg: "bg-lightprimary",
    iconcolor: "text-primary",
  },
  {
    href: "#",
    title: "Alertas Inteligentes",
    subtext: "Notificaciones preventivas personalizadas",
    icon: "solar:bell-bing-bold-duotone",
    iconbg: "bg-lightsecondary",
    iconcolor: "text-secondary",
  },
  {
    href: "#",
    title: "Reportes IA",
    subtext: "Insights automáticos del negocio",
    icon: "solar:file-chart-bold-duotone",
    iconbg: "bg-lightwarning",
    iconcolor: "text-warning",
  },
];

// Quick Actions Data
const quickActions: appsLinkType[] = [
  {
    href: "#",
    title: "Nueva Póliza",
    subtext: "Crear póliza de seguro rápidamente",
    icon: "solar:document-add-bold-duotone",
    iconbg: "bg-lightprimary",
    iconcolor: "text-primary",
  },
  {
    href: "#",
    title: "Nuevo Siniestro",
    subtext: "Registrar reclamación de seguro",
    icon: "solar:danger-triangle-bold-duotone",
    iconbg: "bg-lighterror",
    iconcolor: "text-error",
  },
  {
    href: "#",
    title: "Nuevo Cliente",
    subtext: "Agregar cliente al sistema",
    icon: "solar:user-plus-bold-duotone",
    iconbg: "bg-lightsuccess",
    iconcolor: "text-success",
  },
  {
    href: "#",
    title: "Cotización Rápida",
    subtext: "Generar cotización instantánea",
    icon: "solar:calculator-bold-duotone",
    iconbg: "bg-lightwarning",
    iconcolor: "text-warning",
  },
  {
    href: "#",
    title: "Renovar Póliza",
    subtext: "Procesar renovación de póliza",
    icon: "solar:refresh-bold-duotone",
    iconbg: "bg-lightsecondary",
    iconcolor: "text-secondary",
  },
  {
    href: "#",
    title: "Pago Rápido",
    subtext: "Registrar pago de prima",
    icon: "solar:card-bold-duotone",
    iconbg: "bg-lightprimary",
    iconcolor: "text-primary",
  },
  {
    href: "#",
    title: "Enviar Email",
    subtext: "Comunicación con cliente",
    icon: "solar:letter-bold-duotone",
    iconbg: "bg-lightsuccess",
    iconcolor: "text-success",
  },
  {
    href: "#",
    title: "Generar Reporte",
    subtext: "Crear reporte personalizado",
    icon: "solar:printer-bold-duotone",
    iconbg: "bg-lightwarning",
    iconcolor: "text-warning",
  },
];

interface LinkType {
  href: string;
  title: string;
}

const pageLinks: LinkType[] = [
  {
    href: "/theme-pages/pricing",
    title: "Pricing Page",
  },
  {
    href: "/auth/auth1/login",
    title: "Authentication Design",
  },
  {
    href: "/auth/auth1/register",
    title: "Register Now",
  },
  {
    href: "/404",
    title: "404 Error Page",
  },
  {
    href: "/apps/kanban",
    title: "Kanban App",
  },
  {
    href: "/apps/user-profile/profile",
    title: "User Application",
  },
  {
    href: "/apps/blog/post",
    title: "Blog Design",
  },
  {
    href: "/apps/ecommerce/checkout",
    title: "Shopping Cart",
  },
];

//   Search Data
interface SearchType {
  href: string;
  title: string;
}

const SearchLinks: SearchType[] = [
  {
    title: "Dashboard Principal",
    href: "/dashboards/dashboard1",
  },
  {
    title: "Analytics",
    href: "/dashboards/analytics",
  },
  {
    title: "Dashboard CRM",
    href: "/dashboards/crm",
  },
  {
    title: "Mi Perfil",
    href: "/apps/user-profile/profile",
  },
  {
    title: "Configuración de Cuenta",
    href: "/theme-pages/account-settings",
  },
  {
    title: "Facturas",
    href: "/apps/invoice",
  },
  {
    title: "Kanban",
    href: "/apps/kanban",
  },
  {
    title: "Blog",
    href: "/apps/blog/post",
  },
  {
    title: "Precios",
    href: "/theme-pages/pricing",
  },
  {
    title: "Calendario",
    href: "/apps/calendar",
  },
];

//   Notification Data
interface NotificationType {
  id: string;
  title: string;
  icon: any;
  subtitle: string;
  bgcolor: string;
  color: string;
  time: string;
  type: 'poliza' | 'siniestro' | 'renovacion' | 'pago' | 'cliente' | 'sistema';
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
}

const Notification: NotificationType[] = [
  {
    id: '1',
    icon: "solar:file-smile-bold-duotone",
    bgcolor: "bg-lightprimary dark:bg-lightprimary",
    color: "text-primary",
    title: "Nueva Póliza Creada",
    subtitle: "Póliza de auto para Juan Pérez procesada exitosamente",
    time: "Hace 15 min",
    type: 'poliza',
    read: false,
    priority: 'medium',
    actionUrl: '/polizas'
  },
  {
    id: '2',
    icon: "solar:danger-triangle-bold-duotone",
    bgcolor: "bg-lighterror dark:bg-lighterror",
    color: "text-error",
    title: "Siniestro Urgente",
    subtitle: "Accidente reportado por María García - Requiere atención inmediata",
    time: "Hace 30 min",
    type: 'siniestro',
    read: false,
    priority: 'urgent',
    actionUrl: '/siniestros'
  },
  {
    id: '3',
    icon: "solar:refresh-bold-duotone",
    bgcolor: "bg-lightwarning dark:bg-lightwarning",
    color: "text-warning",
    title: "Renovación Próxima",
    subtitle: "La póliza de Carlos López vence en 5 días",
    time: "Hace 1 hora",
    type: 'renovacion',
    read: false,
    priority: 'high',
    actionUrl: '/renovaciones'
  },
  {
    id: '4',
    icon: "solar:card-bold-duotone",
    bgcolor: "bg-lightsuccess dark:bg-lightsuccess",
    color: "text-success",
    title: "Pago Recibido",
    subtitle: "Pago de $350.000 COP procesado para Ana Rodríguez",
    time: "Hace 2 horas",
    type: 'pago',
    read: true,
    priority: 'low',
    actionUrl: '/pagos'
  },
  {
    id: '5',
    icon: "solar:user-plus-bold-duotone",
    bgcolor: "bg-lightsecondary dark:bg-lightsecondary",
    color: "text-secondary",
    title: "Cliente Nuevo",
    subtitle: "Luis Martínez se ha registrado en el sistema",
    time: "Hace 3 horas",
    type: 'cliente',
    read: true,
    priority: 'low',
    actionUrl: '/clientes'
  },
  {
    id: '6',
    icon: "solar:bell-bing-bold-duotone",
    bgcolor: "bg-lightprimary dark:bg-lightprimary",
    color: "text-primary",
    title: "Recordatorio",
    subtitle: "Tienes 3 cotizaciones pendientes de seguimiento",
    time: "Hace 4 horas",
    type: 'sistema',
    read: true,
    priority: 'medium',
    actionUrl: '/cotizaciones'
  },
];

//  Profile Data
interface ProfileType {
  title: string;
  url: string;
  icon: string;
}

const profileDD: ProfileType[] = [
  {
    title: "Mi Perfil",
    url: "/apps/user-profile/profile",
    icon: "solar:user-bold-duotone",
  },
  {
    title: "Configuración",
    url: "/theme-pages/account-settings",
    icon: "solar:settings-bold-duotone",
  },
  {
    title: "Mis Facturas",
    url: "/apps/invoice",
    icon: "solar:bill-list-bold-duotone",
  },
  {
    title: "Suscripción",
    url: "/theme-pages/pricing",
    icon: "solar:crown-bold-duotone",
  },
  {
    title: "Ayuda y Soporte",
    url: "/apps/ayuda/faq",
    icon: "solar:help-bold-duotone",
  },
  {
    title: "Cerrar Sesión",
    url: "#",
    icon: "solar:logout-2-bold-duotone",
  },
];

export { appsLink, quickActions, pageLinks, SearchLinks, Notification, profileDD };
