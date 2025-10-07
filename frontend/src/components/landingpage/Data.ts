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
    link: "/",
    include: "Demo",
  },
  {
    type: true,
    img: defaultdemo,
    name: "Gestión de Pólizas",
    link: "/apps/polizas",
    include: "Demo",
  },
  {
    type: true,
    img: img3,
    name: "CRM de Leads",
    link: "/apps/marketing/leads",
    include: "Demo",
  },
];

interface ListFeatureTypes {
  featureicon: string;
  title: string;
  subtitle: string;
}

const listFeature: ListFeatureTypes[] = [
  {
    featureicon: "solar:shield-check-bold-duotone",
    title: "Gestión de Pólizas",
    subtitle: "Sistema completo para crear, gestionar y renovar pólizas de seguros.",
  },
  {
    featureicon: "solar:users-group-two-rounded-bold-duotone",
    title: "CRM de Leads",
    subtitle: "Herramientas avanzadas para capturar, calificar y convertir leads.",
  },
  {
    featureicon: "solar:danger-triangle-bold-duotone",
    title: "Gestión de Siniestros",
    subtitle: "Seguimiento completo del proceso de siniestros y reclamaciones.",
  },
  {
    featureicon: "solar:chart-square-bold-duotone",
    title: "Reportes Inteligentes",
    subtitle: "Dashboards y reportes automatizados con insights de negocio.",
  },
  {
    featureicon: "solar:cpu-bolt-bold-duotone",
    title: "Asistente IA",
    subtitle: "Guro AI te ayuda con consultas, análisis y automatización.",
  },
  {
    featureicon: "solar:smartphone-bold-duotone",
    title: "App Móvil Personalizable",
    subtitle:
      "Customiza tu app móvil con colores, logos y configuraciones específicas.",
  },
  {
    featureicon: "solar:link-bold-duotone",
    title: "Enlaces de Cotización",
    subtitle: "Genera y gestiona enlaces personalizados para cotizaciones rápidas.",
  },
  {
    featureicon: "solar:mailbox-bold-duotone",
    title: "Email Marketing",
    subtitle: "Campañas automatizadas, recordatorios y templates personalizados.",
  },
  {
    featureicon: "solar:buildings-2-bold-duotone",
    title: "Multi-Sede",
    subtitle:
      "Gestiona múltiples sedes, vendedores y aseguradoras desde un solo lugar.",
  },

  {
    featureicon: "solar:document-text-bold-duotone",
    title: "Gestión de Documentos",
    subtitle:
      "Almacena, organiza y gestiona todos los documentos de pólizas y siniestros.",
  },
  {
    featureicon: "solar:calendar-mark-bold-duotone",
    title: "Calendario Integrado",
    subtitle:
      "Programa citas, seguimientos y recordatorios automáticos para clientes.",
  },
  {
    featureicon: "solar:notification-unread-bold-duotone",
    title: "Notificaciones Smart",
    subtitle:
      "Sistema de alertas inteligentes para vencimientos, pagos y seguimientos.",
  },

  {
    featureicon: "solar:graph-up-bold-duotone",
    title: "Analytics Avanzado",
    subtitle: "Métricas detalladas de ventas, conversión y rendimiento del negocio.",
  },

  {
    featureicon: "solar:shield-star-bold-duotone",
    title: "Seguridad Empresarial",
    subtitle:
      "Protección de datos con encriptación y cumplimiento de normativas.",
  },

  {
    featureicon: "solar:headphones-round-sound-bold-duotone",
    title: "Soporte 24/7",
    subtitle:
      "Asistencia técnica especializada y capacitación continua para tu equipo.",
  },
  {
    featureicon: "solar:widget-4-bold-duotone",
    title: "Integraciones API",
    subtitle:
      "Conecta con sistemas existentes, bancos y plataformas de pago fácilmente.",
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

const FrontMenu: DemosMegaMenuTypes[] = [
  {
    img: front1,
    name: "Homepage",
    link: "/frontend-pages/homepage",
    include: "Frontend Pages",
  },
  {
    img: front2,
    name: "About Us",
    link: "/frontend-pages/aboutus",
    include: "Frontend Pages",
  },
  {
    img: front3,
    name: "Contact Us",
    link: "/frontend-pages/contact",
    include: "Frontend Pages",
  },
  {
    img: front4,
    name: "Portfolio",
    link: "/frontend-pages/portfolio",
    include: "Frontend Pages",
  },
  {
    img: front5,
    name: "Pricing",
    link: "/frontend-pages/pricing",
    include: "Frontend Pages",
  },
  {
    img: front6,
    name: "Blog",
    link: "/frontend-pages/blog",
    include: "Frontend Pages",
  },
];

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
