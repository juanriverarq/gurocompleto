import img1 from "/src/assets/images/landingpage/demos/demo-main.jpg";
import img2 from "/src/assets/images/landingpage/demos/demo-dark.jpg";
import img3 from "/src/assets/images/landingpage/demos/demo-horizontal.jpg";
import img4 from "/src/assets/images/landingpage/demos/demo-mini.jpg";
import img5 from "/src/assets/images/landingpage/demos/demo-rtl.jpg";
import defaultdemo from "/src/assets/images/landingpage/demos/demo-default.jpg";

import img6 from "/src/assets/images/landingpage/apps/app-calendar.jpg";
import img7 from "/src/assets/images/landingpage/apps/app-chat.jpg";
import img8 from "/src/assets/images/landingpage/apps/app-contact.jpg";
import img9 from "/src/assets/images/landingpage/apps/app-user-profile.jpg";
import img10 from "/src/assets/images/landingpage/apps/app-note.jpg";
import img11 from "/src/assets/images/landingpage/apps/app-blog.jpg";
import img12 from "/src/assets/images/landingpage/apps/app-shop.jpg";
import img13 from "/src/assets/images/landingpage/apps/app-productlist.jpg";
import img14 from "/src/assets/images/landingpage/apps/app-invoice.jpg";
import img15 from "/src/assets/images/landingpage/apps/app-blog-detail.jpg";
import img16 from "/src/assets/images/landingpage/apps/app-product-detail.jpg";
import img17 from "/src/assets/images/landingpage/apps/app-kanban.jpg";

/*Front Pages Megamenu*/
import front1 from "/src/assets/images/landingpage/front-pages/front-homepage.jpg";
import front2 from "/src/assets/images/landingpage/front-pages/front-aboutus.jpg";
import front3 from "/src/assets/images/landingpage/front-pages/front-contactus.jpg";
import front4 from "/src/assets/images/landingpage/front-pages/front-portfolio.jpg";
import front5 from "/src/assets/images/landingpage/front-pages/front-pricing.jpg";
import front6 from "/src/assets/images/landingpage/front-pages/front-blog.jpg";

interface DemoTypes {
  link: string;
  img: string | any;
  name: string;
  type: boolean;
  include: string;
}

const Demos: DemoTypes[] = [
  {
    type: true,
    img: img1,
    name: "Dashboard Principal",
    link: "/apps/",
    include: "Demo",
  },
  {
    type: true,
    img: defaultdemo,
    name: "Gestión de Pólizas",
    link: "/apps/seguros/polizas",
    include: "Demo",
  },
  {
    type: true,
    img: img3,
    name: "CRM y Embudo de Ventas",
    link: "/apps/saas/sales-funnel",
    include: "Demo",
  },
];

interface ListFeatureTypes {
  featureicon: string;
  title: string;
  subtitle: string;
  category: string;
}

const listFeature: ListFeatureTypes[] = [
  // Módulos Core (Obligatorios)
  {
    featureicon: "solar:users-group-two-rounded-bold-duotone",
    title: "Gestión de Clientes",
    subtitle: "Base de datos completa de clientes y contactos con historial y seguimiento.",
    category: "Core",
  },
  {
    featureicon: "solar:shield-check-bold-duotone",
    title: "Gestión de Pólizas",
    subtitle: "Creación, administración y control del ciclo completo de pólizas.",
    category: "Core",
  },
  {
    featureicon: "solar:danger-triangle-bold-duotone",
    title: "Gestión de Siniestros",
    subtitle: "Registro, seguimiento y validación de reclamaciones con SLA.",
    category: "Core",
  },
  {
    featureicon: "solar:refresh-bold-duotone",
    title: "Control de Renovaciones",
    subtitle: "Alertas automáticas de vencimientos y seguimiento de renovaciones.",
    category: "Core",
  },
  {
    featureicon: "solar:transmission-circle-bold-duotone",
    title: "Módulo de Automóviles",
    subtitle: "Gestión especializada para seguros de autos con catálogo de vehículos.",
    category: "Core",
  },
  {
    featureicon: "solar:clipboard-check-bold-duotone",
    title: "Seguimiento y Tareas",
    subtitle: "Agenda compartida, tareas automáticas y recordatorios inteligentes.",
    category: "Core",
  },
  {
    featureicon: "solar:folder-with-files-bold-duotone",
    title: "Gestión Documental",
    subtitle: "Repositorio central de documentos con versiones y permisos.",
    category: "Core",
  },
  
  // Módulos de IA
  {
    featureicon: "solar:cpu-bolt-bold-duotone",
    title: "Chatbot con IA",
    subtitle: "Asistente inteligente para ventas, soporte y automatización de tareas.",
    category: "IA",
  },
  {
    featureicon: "solar:phone-calling-rounded-outline",
    title: "Call Center IA",
    subtitle: "Agentes de voz con IA para llamadas entrantes y salientes.",
    category: "IA",
  },
  {
    featureicon: "solar:chart-square-bold-duotone",
    title: "Predicciones con IA",
    subtitle: "Analítica predictiva para anticipar comportamiento de clientes.",
    category: "IA",
  },
  {
    featureicon: "solar:graph-up-bold-duotone",
    title: "Ventas Cruzadas IA",
    subtitle: "Recomendaciones automáticas de productos para cada cliente.",
    category: "IA",
  },
  {
    featureicon: "solar:document-text-bold-duotone",
    title: "Lector PDF con IA",
    subtitle: "Extrae datos de pólizas y documentos automáticamente con IA.",
    category: "IA",
  },
  
  // Módulos Comerciales
  {
    featureicon: "solar:target-bold-duotone",
    title: "CRM y Embudo de Ventas",
    subtitle: "Gestiona leads, oportunidades y pipeline con métricas de conversión.",
    category: "Comercial",
  },
  {
    featureicon: "solar:wallet-bold-duotone",
    title: "Gestión de Cartera",
    subtitle: "Control de recaudos, estados de cuenta y reportes de morosidad.",
    category: "Comercial",
  },
  {
    featureicon: "solar:dollar-minimalistic-bold-duotone",
    title: "Comisiones Automáticas",
    subtitle: "Cálculo y liquidación de comisiones para vendedores.",
    category: "Comercial",
  },
  {
    featureicon: "solar:chart-square-bold-duotone",
    title: "Reportes y Dashboards",
    subtitle: "KPIs en tiempo real y reportes personalizables para toma de decisiones.",
    category: "Comercial",
  },
  
  // Módulos de Marketing
  {
    featureicon: "solar:chat-round-dots-bold-duotone",
    title: "WhatsApp Marketing",
    subtitle: "Campañas masivas y automatizaciones por WhatsApp.",
    category: "Marketing",
  },
  {
    featureicon: "solar:letter-bold-duotone",
    title: "Email Marketing",
    subtitle: "Campañas de email y recordatorios automáticos.",
    category: "Marketing",
  },
  {
    featureicon: "solar:smartphone-2-bold-duotone",
    title: "Mini Web de Cotización",
    subtitle: "Landing page personalizada para cotizaciones online.",
    category: "Marketing",
  },
  
  // Módulos de Integración
  {
    featureicon: "solar:refresh-bold-duotone",
    title: "Sincronización con Aseguradoras",
    subtitle: "Sincronización automática de pólizas, clientes y cartera entre aseguradoras.",
    category: "Integración",
  },
  {
    featureicon: "solar:calculator-minimalistic-bold-duotone",
    title: "Cotizador de Autos",
    subtitle: "Conectado con más de 10 compañías de seguros para cotizaciones en menos de 2 minutos.",
    category: "Integración",
  },
  
  // Módulos Premium
  {
    featureicon: "solar:palette-round-line-duotone",
    title: "Marca Blanca",
    subtitle: "Personaliza logotipo, colores y dominio con tu marca.",
    category: "Premium",
  },
  {
    featureicon: "solar:bill-bold-duotone",
    title: "Facturación Electrónica",
    subtitle: "Emisión y envío de facturas electrónicas.",
    category: "Premium",
  },
  {
    featureicon: "solar:bill-list-bold-duotone",
    title: "Nómina Electrónica",
    subtitle: "Generación y soporte de nómina electrónica.",
    category: "Premium",
  },
  {
    featureicon: "solar:smartphone-2-bold-duotone",
    title: "App Móvil Personalizada",
    subtitle: "Aplicación móvil con acceso a pólizas y notificaciones push.",
    category: "Premium",
  },
  {
    featureicon: "solar:global-line-duotone",
    title: "Sitio Web Institucional",
    subtitle: "Sitio web completo con productos, blog y captación de leads.",
    category: "Premium",
  },
];

/*User Review Section*/
import review1 from "/src/assets/images/profile/user-2.jpg";
import review2 from "/src/assets/images/profile/user-3.jpg";
import review3 from "/src/assets/images/profile/user-4.jpg";

interface UserReviewTypes {
  img: any;
  review: string;
  title: string;
  subtitle: string;
}
const userReview: UserReviewTypes[] = [
  {
    img: review3,
    title: "Carlos Mendoza",
    subtitle: "Director Comercial - Seguros Alfa",
    review:
      "Guro transformó completamente nuestra operación. El asistente IA nos ayuda a procesar leads 3x más rápido y la gestión de pólizas es increíblemente intuitiva. ¡Altamente recomendado!",
  },
  {
    img: review1,
    title: "María González",
    subtitle: "Gerente de Siniestros - AseguraTodo",
    review:
      "La plataforma de Guro nos ha permitido reducir los tiempos de procesamiento de siniestros de días a horas. Los reportes automáticos son una maravilla para la toma de decisiones.",
  },
  {
    img: review2,
    title: "Roberto Silva",
    subtitle: "CEO - Protección Integral",
    review:
      "La calidad del sistema es excelente, la personalización y flexibilidad superan cualquier otra solución del mercado. Guro es el futuro de la gestión de seguros.",
  },
  {
    img: review3,
    title: "Ana Patricia López",
    subtitle: "Directora de Ventas - MegaSeguros",
    review:
      "El CRM de leads de Guro es espectacular. Hemos aumentado nuestra conversión un 45% y el seguimiento automatizado nos ahorra horas cada día. Una inversión que se paga sola.",
  },
  {
    img: review1,
    title: "Luis Fernando Castro",
    subtitle: "Agente Senior - Seguros Premium",
    review:
      "La app móvil personalizable me permite cotizar en campo de manera profesional. Mis clientes quedan impresionados con la rapidez y la presentación de las propuestas.",
  },
  {
    img: review2,
    title: "Sandra Morales",
    subtitle: "Gerente Regional - Protec Seguros",
    review:
      "Implementamos Guro en 5 sucursales y los resultados son increíbles. La centralización de datos y los reportes en tiempo real cambiaron nuestra forma de operar.",
  },
  {
    img: review3,
    title: "Diego Ramírez",
    subtitle: "Corredor de Seguros Independiente",
    review:
      "Como corredor independiente, Guro me da las herramientas de una gran aseguradora. El asistente IA es como tener un equipo completo trabajando 24/7.",
  },
  {
    img: review1,
    title: "Patricia Herrera",
    subtitle: "Jefe de Operaciones - Seguros Confianza",
    review:
      "La gestión de siniestros nunca fue tan eficiente. Nuestros clientes están más satisfechos y nosotros procesamos el doble de casos con el mismo equipo.",
  },
];

interface DemosMegaMenuTypes {
  img: any;
  name: string;
  link: string;
  include: string;
}

/*Demos Megamenu*/
const demosMegamenu: DemosMegaMenuTypes[] = [
  {
    img: img1,
    name: "Main",
    link: "https://matdash-react-tailwind-main.netlify.app/",
    include: "Demo",
  },
  {
    img: defaultdemo,
    name: "Default",
    link: "https://matdash-react-tailwind-default.netlify.app/",
    include: "Demo",
  },
  {
    img: img3,
    name: "Horizontal",
    link: "https://matdash-react-tailwind-horizontal.netlify.app/",
    include: "Demo",
  },
  {
    img: img4,
    name: "Minisidebar",
    link: "https://matdash-react-tailwind-minisidebar.netlify.app/",
    include: "Demo",
  },
  {
    img: img5,
    name: "RTL",
    link: "https://matdash-react-tailwind-rtl.netlify.app/",
    include: "Demo",
  },
];

const FrontMenu: DemosMegaMenuTypes[] = [];

const appsMegamenu: DemosMegaMenuTypes[] = [
  {
    img: img6,
    name: "Calandar App",
    link: "/apps/calendar",
    include: "",
  },
  {
    img: img7,
    name: "Chat App",
    link: "/apps/chats",
    include: "",
  },
  {
    img: img8,
    name: "Contact App",
    link: "/apps/contacts",
    include: "",
  },
  {
    img: img9,
    name: "User Profile App",
    link: "/apps/user-profile/profile",
    include: "",
  },
  {
    img: img10,
    name: "Notes App",
    link: "/apps/notes",
    include: "",
  },
];

export {
  Demos,
  listFeature,
  userReview,
  demosMegamenu,
  appsMegamenu,
  FrontMenu,
};
