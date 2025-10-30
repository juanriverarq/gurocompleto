export type ModuleKey =
  | 'clientes'
  | 'polizas'
  | 'siniestros'
  | 'renovaciones'
  | 'automoviles'
  | 'crm'
  | 'seguimiento'
  | 'cartera'
  | 'comisiones'
  | 'reportes'
  | 'whatsapp'
  | 'email'
  | 'miniweb'
  | 'documentos'
  | 'ia_chatbot'
  | 'ia_callcenter'
  | 'ia_predicciones'
  | 'ia_ventas_cruzadas'
  | 'marca_blanca'
  | 'app_movil'
  | 'sitio_web'
  | 'facturacion_electronica'
  | 'nomina_electronica'
  | 'lector_pdf_ia';

export type ModuleItem = {
  key: ModuleKey;
  name: string;
  description: string;
  icon: string; // iconify name
  color: string; // tailwind bg-* color token
  pricePerUser: number; // COP por usuario al mes
  included?: boolean; // marked as recommended
  mandatory?: boolean; // incluido por obligación, no se puede desactivar
  longDescription?: string; // descripción extendida para modal
  videoSrc?: string; // url o ruta al video del módulo
  annualOnly?: boolean; // solo disponible en plan anual
  annualPrice?: number; // COP/año por cuenta cuando es solo anual
};

// Precios de referencia en COP (pueden ajustarse luego o venir desde backend)
export const BASE_PLATFORM_FEE = 83500; // COP/mes

export const MODULES: ModuleItem[] = [
  {
    key: 'clientes',
    name: 'Clientes',
    description: 'Gestión de clientes y contactos',
    icon: 'solar:users-group-two-rounded-bold-duotone',
    color: 'bg-lightprimary',
    pricePerUser: 6000,
    mandatory: true,
  },
  {
    key: 'polizas',
    name: 'Pólizas',
    description: 'Creación y administración de pólizas',
    icon: 'solar:shield-check-bold-duotone',
    color: 'bg-lightsuccess',
    pricePerUser: 12000,
    mandatory: true,
    longDescription:
      'Centraliza la gestión completa del ciclo de vida de las pólizas: emisión, anexos, endosos, renovaciones y control documental, con auditoría y trazabilidad.',
  },
  {
    key: 'siniestros',
    name: 'Siniestros',
    description: 'Registro y seguimiento de siniestros',
    icon: 'solar:danger-triangle-bold-duotone',
    color: 'bg-lighterror',
    pricePerUser: 9000,
    mandatory: true,
    longDescription:
      'Estandariza la recepción, validación y seguimiento de reclamaciones con estados, SLA, checklist de documentos y comunicación al cliente.',
  },
  {
    key: 'renovaciones',
    name: 'Renovaciones',
    description: 'Control de vencimientos y renovaciones',
    icon: 'solar:refresh-bold-duotone',
    color: 'bg-lightsecondary',
    pricePerUser: 6000,
    mandatory: true,
    longDescription:
      'Automatiza alertas, plantillas y tareas para renovar a tiempo. Priorización por riesgo de fuga y seguimiento de oportunidades.',
  },
  {
    key: 'automoviles',
    name: 'Automóviles',
    description: 'Módulo especializado de autos',
    icon: 'solar:car-bold-duotone',
    color: 'bg-lightwarning',
    pricePerUser: 6000,
    mandatory: true,
    longDescription:
      'Catálogo de vehículos, placas, chasis, motor, siniestros y vencimientos específicos del ramo de autos. Integraciones futuras con RUNT/aseguradoras.',
  },
  {
    key: 'crm',
    name: 'Negocios (CRM)',
    description: 'Embudo y oportunidades',
    icon: 'solar:target-bold-duotone',
    color: 'bg-lightwarning',
    pricePerUser: 9000,
    longDescription:
      'Gestiona leads, oportunidades y embudos por etapas. Actividades, notas, responsables y métricas de conversión.',
  },
  {
    key: 'seguimiento',
    name: 'Seguimiento',
    description: 'Tareas, recordatorios y agenda',
    icon: 'solar:clipboard-check-bold-duotone',
    color: 'bg-lightsecondary',
    pricePerUser: 6000,
    mandatory: true,
    longDescription:
      'Agenda compartida, tareas automáticas y recordatorios inteligentes para clientes, pólizas y siniestros.',
  },
  {
    key: 'cartera',
    name: 'Cartera',
    description: 'Cobros y estado de cuenta',
    icon: 'solar:wallet-bold-duotone',
    color: 'bg-lightprimary',
    pricePerUser: 6000,
    longDescription:
      'Control de recaudos, estados de cuenta, conciliaciones y reportes de morosidad con notificaciones.',
  },
  {
    key: 'comisiones',
    name: 'Comisiones',
    description: 'Cálculo y liquidación',
    icon: 'solar:dollar-minimalistic-bold-duotone',
    color: 'bg-lightwarning',
    pricePerUser: 9000,
  },
  {
    key: 'reportes',
    name: 'Reportes',
    description: 'Dashboards y KPIs',
    icon: 'solar:chart-square-bold-duotone',
    color: 'bg-lightsecondary',
    pricePerUser: 6000,
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp Marketing',
    description: 'Envíos masivos y bots',
    icon: 'solar:chat-round-dots-bold-duotone',
    color: 'bg-lightprimary',
    pricePerUser: 0,
    mandatory: true,
    longDescription:
      'Campañas y automatizaciones por WhatsApp, con plantillas y mensajes transaccionales. Se factura por consumo (envíos).',
  },
  {
    key: 'email',
    name: 'Email Marketing',
    description: 'Campañas y automatizaciones',
    icon: 'solar:letter-bold-duotone',
    color: 'bg-lightsecondary',
    pricePerUser: 0,
    mandatory: true,
    longDescription:
      'Email marketing y recordatorios automáticos. Se factura por consumo (envíos/volumen).',
  },
  {
    key: 'miniweb',
    name: 'Mini Web',
    description: 'Landing de cotización',
    icon: 'solar:smartphone-2-bold-duotone',
    color: 'bg-lightsuccess',
    pricePerUser: 3000,
  },
  {
    key: 'marca_blanca',
    name: 'Marca Blanca',
    description: 'Personaliza branding y dominio',
    icon: 'solar:palette-round-line-duotone',
    color: 'bg-lightsecondary',
    pricePerUser: 2000,
    longDescription: 'Personalización de logotipo, colores, dominio y marca para tu empresa.',
  },
  {
    key: 'facturacion_electronica',
    name: 'Facturación electrónica',
    description: 'Emisión y envío FE',
    icon: 'solar:bill-bold-duotone',
    color: 'bg-lightprimary',
    pricePerUser: 0,
    annualOnly: true,
    annualPrice: 336000,
    longDescription: 'Incluye hasta 100 facturas electrónicas al mes. Si necesitas más, podemos escalar el plan.'
  },
  {
    key: 'nomina_electronica',
    name: 'Nómina electrónica',
    description: 'Generación y soporte',
    icon: 'solar:bill-list-bold-duotone',
    color: 'bg-lightsecondary',
    pricePerUser: 0,
    annualOnly: true,
    annualPrice: 168000,
    longDescription: 'Módulo de nómina electrónica. Precio sujeto a plan/consumo. Consulta para una cotización personalizada.'
  },
  {
    key: 'lector_pdf_ia',
    name: 'Lector PDF con IA',
    description: 'Extrae datos de PDFs',
    icon: 'solar:document-text-bold-duotone',
    color: 'bg-lightsuccess',
    pricePerUser: 5000,
    longDescription: 'Procesa pólizas/soportes en PDF con IA para extraer campos clave y acelerar el registro. Incluye hasta 500 documentos por mes.'
  },
  {
    key: 'app_movil',
    name: 'App Móvil',
    description: 'App móvil para clientes y equipo',
    icon: 'solar:smartphone-2-bold-duotone',
    color: 'bg-lightprimary',
    pricePerUser: 0,
    annualOnly: true,
    annualPrice: 1423500,
    longDescription: 'Aplicación móvil con acceso a pólizas, siniestros y notificaciones push. Facturación solo anual.',
  },
  {
    key: 'sitio_web',
    name: 'Sitio Web',
    description: 'Sitio web institucional',
    icon: 'solar:global-line-duotone',
    color: 'bg-lightwarning',
    pricePerUser: 0,
    annualOnly: true,
    annualPrice: 700000,
    longDescription: 'Sitio web con páginas de productos, blog y captación de leads. Facturación solo anual.',
  },
  {
    key: 'documentos',
    name: 'Documentos',
    description: 'Gestión documental',
    icon: 'solar:folder-with-files-bold-duotone',
    color: 'bg-lightwarning',
    pricePerUser: 3000,
    mandatory: true,
    longDescription:
      'Repositorio central de documentos de clientes, pólizas y siniestros, con versiones y permisos.',
  },
  {
    key: 'ia_chatbot',
    name: 'IA Chatbot',
    description: 'Asistente IA para ventas/soporte',
    icon: 'solar:cpu-bolt-bold-duotone',
    color: 'bg-lightprimary',
    pricePerUser: 9000,
  },
  {
    key: 'ia_callcenter',
    name: 'IA Call Center',
    description: 'Atención telefónica con IA',
    icon: 'solar:phone-calling-rounded-outline',
    color: 'bg-lighterror',
    pricePerUser: 0,
    mandatory: true,
    longDescription:
      'Agentes de voz para llamadas entrantes y salientes con IA. Se factura por consumo (minutos).',
  },
  {
    key: 'ia_predicciones',
    name: 'IA Predicciones',
    description: 'Analítica predictiva',
    icon: 'solar:chart-square-bold-duotone',
    color: 'bg-lightsecondary',
    pricePerUser: 6000,
  },
  {
    key: 'ia_ventas_cruzadas',
    name: 'IA Ventas Cruzadas',
    description: 'Recomendaciones automáticas',
    icon: 'solar:graph-up-bold-duotone',
    color: 'bg-lightsuccess',
    pricePerUser: 6000,
  },
];

export type BillingPeriod = 'monthly' | 'annual';

export function calculateTotals(selected: Set<ModuleKey>, users: number, period: BillingPeriod) {
  // Costos base por cuenta
  const monthlyBase = BASE_PLATFORM_FEE;

  // Módulos por cuenta (no por usuario) con soporte de solo-anual.
  // Los módulos incluidos (mandatory) NO se cobran.
  const monthlyModules = MODULES.filter(m => selected.has(m.key)).reduce((acc, m) => {
    if (m.mandatory) return acc;
    return acc + (m.annualOnly ? 0 : m.pricePerUser);
  }, 0);
  const annualModules = MODULES.filter(m => selected.has(m.key)).reduce((acc, m) => {
    if (m.mandatory) return acc;
    return acc + (m.annualOnly ? (m.annualPrice || 0) : m.pricePerUser * 12);
  }, 0);

  // Usuarios (precio mensual por usuario por tramo). Primer usuario GRATIS.
  const perUserMonthly = getMonthlyPricePerUser(users);
  const billableUsers = Math.max(users - 1, 0);
  const usersMonthly = perUserMonthly * billableUsers;
  const usersAnnual = usersMonthly * 12;

  if (period === 'monthly') {
    const subtotalMonthly = monthlyBase + monthlyModules + usersMonthly;
    return {
      period,
      baseMonthly: monthlyBase,
      modulesMonthly: monthlyModules,
      users: {
        perUserMonthly,
        billableUsers,
        usersMonthly,
        usersAnnualTotal: usersAnnual,
      },
      subtotalMonthly,
      totalAnnualEquivalent: subtotalMonthly * 12, // sin descuento
    };
  }

  // Plan anual con 12% de ahorro sobre el equivalente anual
  const annualBeforeDiscount = monthlyBase * 12 + annualModules + usersAnnual;
  const annualAfterDiscount = Math.round(annualBeforeDiscount * 0.88);

  return {
    period,
    baseAnnual: monthlyBase * 12,
    modulesAnnual: annualModules,
    users: {
      perUserMonthly,
      billableUsers,
      usersMonthly,
      usersAnnualTotal: usersAnnual,
    },
    subtotalAnnual: annualAfterDiscount,
    discountAnnual: annualBeforeDiscount - annualAfterDiscount,
  };
}

// Tabla de escalado por cantidad de usuarios (precio mensual por usuario)
// 0-3: 25,000 COP/mes
// 4-10: 23,000 COP/mes
// 11-20: 20,000 COP/mes
// 20+: 18,000 COP/mes
export function getMonthlyPricePerUser(users: number) {
  if (users <= 3) return 25_000;
  if (users <= 10) return 23_000;
  if (users <= 20) return 20_000;
  return 18_000;
}

export function numberFormat(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}
