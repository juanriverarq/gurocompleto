import { uniqueId } from 'lodash';
import {
  filterMenuItemsByPermissions,
  cleanOrphanedNavLabels,
} from '../../../../utils/permissionUtils';

export interface MenuitemsType {
  [x: string]: any;
  id?: string;
  navlabel?: boolean;
  subheader?: string;
  title?: string;
  icon?: any;
  href?: string;
  children?: MenuitemsType[];
  // Acción requerida para visibilidad en el menú (por defecto 'ver')
  requiredAction?: 'ver' | 'crear' | 'editar' | 'eliminar' | 'renovar' | 'emitir';
  chip?: string;
  chipColor?: string;
  variant?: string;
  external?: boolean;
  level?: number;
  onClick?: React.MouseEvent<HTMLButtonElement, MouseEvent>;
}

const BaseMenuitems: MenuitemsType[] = [
  // ═══════════════════════════════════════════════════════════════
  // 1. 🏠 INICIO
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Inicio',
  },
  {
    id: uniqueId(),
    title: 'Inicio',
    icon: 'solar:home-smile-bold-duotone',
    href: '/apps/',
  },
  {
    id: uniqueId(),
    title: 'Dashboard',
    icon: 'solar:widget-2-bold-duotone',
    href: '/apps/dashboard',
  },

  // ═══════════════════════════════════════════════════════════════
  // 2. 🛡️ SEGUROS (Core del negocio)
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Seguros',
  },
  {
    id: uniqueId(),
    title: 'Clientes',
    icon: 'solar:users-group-two-rounded-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Lista de Clientes',
        href: '/apps/seguros/clientes',
      },
      {
        id: uniqueId(),
        title: 'Nuevo Cliente',
        href: '/apps/seguros/clientes/nuevo',
        requiredAction: 'crear',
      },
    ],
  },
  {
    id: uniqueId(),
    title: 'Pólizas',
    icon: 'solar:shield-check-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Gestión de Pólizas',
        href: '/apps/seguros/polizas',
      },
      {
        id: uniqueId(),
        title: 'Nueva Póliza',
        href: '/apps/seguros/polizas/nueva',
        requiredAction: 'crear',
      },
      {
        id: uniqueId(),
        title: 'Renovaciones',
        href: '/apps/seguros/renovaciones',
        requiredAction: 'renovar',
      },
      {
        id: uniqueId(),
        title: 'Automóviles',
        href: '/apps/seguros/automoviles',
      },
      {
        id: uniqueId(),
        title: 'Cumplimiento',
        href: '/apps/seguros/cumplimiento',
      },
    ],
  },
  {
    id: uniqueId(),
    title: 'Siniestros',
    icon: 'solar:danger-triangle-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Gestión de Siniestros',
        href: '/apps/seguros/siniestros',
      },
      {
        id: uniqueId(),
        title: 'Reportar Siniestro',
        href: '/apps/seguros/siniestros/nuevo',
        requiredAction: 'crear',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 3. 💼 COMERCIAL (Ventas y tareas)
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Comercial',
  },
  {
    id: uniqueId(),
    title: 'Embudo de Ventas',
    icon: 'solar:chart-2-bold-duotone',
    href: '/apps/saas/sales-funnel',
  },
  {
    id: uniqueId(),
    title: 'Tareas',
    icon: 'solar:clipboard-check-bold-duotone',
    href: '/apps/seguros/seguimiento',
  },
  {
    id: uniqueId(),
    title: 'Metas y Objetivos',
    icon: 'solar:target-bold-duotone',
    href: '/apps/comercial/metas-objetivos',
  },
  {
    id: uniqueId(),
    title: 'Rendimiento',
    icon: 'solar:graph-up-bold-duotone',
    href: '/apps/comercial/rendimiento',
  },

  // ═══════════════════════════════════════════════════════════════
  // 4. 💰 FINANZAS
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Finanzas',
  },
  {
    id: uniqueId(),
    title: 'Cartera',
    icon: 'solar:wallet-bold-duotone',
    href: '/apps/cartera',
  },
  {
    id: uniqueId(),
    title: 'Cartera Aseguradoras',
    icon: 'solar:buildings-3-bold-duotone',
    href: '/apps/cartera/aseguradoras',
  },
  {
    id: uniqueId(),
    title: 'Comisiones Aseguradoras',
    icon: 'solar:dollar-minimalistic-bold-duotone',
    href: '/apps/comisiones/aseguradoras',
  },

  // ═══════════════════════════════════════════════════════════════
  // 5. 📱 COMUNICACIONES (WhatsApp + Marketing unificados)
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Comunicaciones',
  },
  {
    id: uniqueId(),
    title: 'WhatsApp',
    icon: 'solar:chat-round-dots-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Inbox',
        href: '/apps/whatsapp/inbox',
        chip: 'Pro',
        chipColor: 'primary',
      },
      {
        id: uniqueId(),
        title: 'Dashboard',
        href: '/apps/whatsapp/dashboard',
      },
      {
        id: uniqueId(),
        title: 'Conexiones',
        href: '/apps/whatsapp/conexiones',
      },
      {
        id: uniqueId(),
        title: 'Campañas',
        href: '/apps/whatsapp/campanas',
      },
      {
        id: uniqueId(),
        title: 'Contactos',
        href: '/apps/whatsapp/contactos',
      },
      {
        id: uniqueId(),
        title: 'Chatbots',
        href: '/apps/whatsapp/chatbots',
      },
      {
        id: uniqueId(),
        title: 'Plantillas',
        href: '/apps/whatsapp/plantillas',
      },
    ],
  },
  {
    id: uniqueId(),
    title: 'Email Marketing',
    icon: 'solar:letter-bold-duotone',
    href: '/apps/marketing/plantillas',
  },
  {
    id: uniqueId(),
    title: 'Enlaces de Cotización',
    icon: 'solar:link-bold-duotone',
    href: '/apps/marketing/enlaces-cotizacion',
  },
  {
    id: uniqueId(),
    title: 'Mini Web',
    icon: 'solar:smartphone-2-bold-duotone',
    href: '/apps/marketing/mini-web',
  },
  {
    id: uniqueId(),
    title: 'Mi Página Web',
    icon: 'solar:globe-bold-duotone',
    href: '/apps/marketing/mi-web',
    chip: 'Nuevo',
    chipColor: 'primary',
  },
  {
    id: uniqueId(),
    title: 'Creador de Contenido',
    icon: 'solar:pallete-2-bold-duotone',
    href: '/apps/marketing/creador-contenido',
    chip: 'Nuevo',
    chipColor: 'success',
  },
  // {
  //   id: uniqueId(),
  //   title: 'Comparador de Seguros',
  //   icon: 'solar:car-bold-duotone',
  //   href: '/apps/marketing/comparador-seguros',
  // },

  // ═══════════════════════════════════════════════════════════════
  // 6. 🤖 INTELIGENCIA ARTIFICIAL
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Inteligencia Artificial',
  },
  {
    id: uniqueId(),
    title: 'Asistente IA',
    icon: 'solar:cpu-bolt-bold-duotone',
    href: '/apps/ia/asistente',
  },
  {
    id: uniqueId(),
    title: 'Call Center IA',
    icon: 'solar:phone-calling-rounded-outline',
    href: '/apps/voice-ai/dashboard',
  },
  {
    id: uniqueId(),
    title: 'Ventas Cruzadas',
    icon: 'solar:graph-up-bold-duotone',
    href: '/apps/ia/ventas-cruzadas',
  },
  {
    id: uniqueId(),
    title: 'Robots',
    icon: 'solar:robot-bold-duotone',
    href: '/apps/ia/robots',
  },

  // ═══════════════════════════════════════════════════════════════
  // 7. 📁 DOCUMENTOS
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Documentos',
  },
  {
    id: uniqueId(),
    title: 'De Clientes',
    icon: 'solar:folder-with-files-bold-duotone',
    href: '/apps/legal/documentos-cliente',
  },
  {
    id: uniqueId(),
    title: 'De Pólizas',
    icon: 'solar:folder-with-files-bold-duotone',
    href: '/apps/seguros/documentos-poliza',
  },
  {
    id: uniqueId(),
    title: 'De Siniestros',
    icon: 'solar:folder-with-files-bold-duotone',
    href: '/apps/seguros/documentos-siniestro',
  },
  {
    id: uniqueId(),
    title: 'Internos',
    icon: 'solar:archive-bold-duotone',
    href: '/apps/legal/documentos-internos',
  },

  // ═══════════════════════════════════════════════════════════════
  // 9. 🧮 COTIZADORES
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Cotizadores',
  },
  {
    id: uniqueId(),
    title: 'Autos',
    icon: 'solar:car-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Comparador',
        href: '/apps/cotizadores/autos/comparador',
        chip: 'Nuevo',
        chipColor: 'success',
      },
      {
        id: uniqueId(),
        title: 'Solo Bolívar',
        href: '/apps/cotizadores/autos/bolivar',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 8. ⚙️ CONFIGURACIÓN (Admin simplificado)
  // ═══════════════════════════════════════════════════════════════
  {
    navlabel: true,
    subheader: 'Configuración',
  },
  {
    id: uniqueId(),
    title: 'Mi Agencia',
    icon: 'solar:buildings-3-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Información',
        href: '/apps/admin/informacion-agencia',
      },
      {
        id: uniqueId(),
        title: 'Sedes',
        href: '/apps/admin/sedes',
      },
      {
        id: uniqueId(),
        title: 'Aseguradoras',
        href: '/apps/admin/aseguradoras',
      },
      {
        id: uniqueId(),
        title: 'Ramos',
        href: '/apps/admin/ramos',
      },
    ],
  },
  {
    id: uniqueId(),
    title: 'Usuarios y Roles',
    icon: 'solar:users-group-rounded-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Usuarios',
        href: '/apps/admin/usuarios',
      },
      {
        id: uniqueId(),
        title: 'Reportes de Actividad',
        href: '/apps/admin/usuarios/reportes',
        chip: 'Nuevo',
        chipColor: 'success',
      },
      {
        id: uniqueId(),
        title: 'Roles y Permisos',
        href: '/apps/admin/roles',
      },
    ],
  },
  {
    id: uniqueId(),
    title: 'Catálogos',
    icon: 'solar:notebook-bookmark-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Vendedor / Asesor',
        href: '/apps/admin/vendedores',
      },
      {
        id: uniqueId(),
        title: 'Coberturas',
        href: '/apps/admin/coberturas',
      },
      {
        id: uniqueId(),
        title: 'Tipos de Afiliación',
        href: '/apps/admin/tipo-afiliacion',
      },
      {
        id: uniqueId(),
        title: 'Estados de Siniestros',
        href: '/apps/admin/estados-siniestros',
      },
      {
        id: uniqueId(),
        title: 'Motivos Estados Póliza',
        href: '/apps/admin/motivos-estados-poliza',
      },
      {
        id: uniqueId(),
        title: 'Mensajeros',
        href: '/apps/admin/mensajeros',
      },
    ],
  },
  {
    id: uniqueId(),
    title: 'Integraciones',
    icon: 'solar:programming-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Conectores API',
        href: '/apps/integraciones/conectores',
      },
      {
        id: uniqueId(),
        title: 'Webhooks',
        href: '/apps/integraciones/webhooks',
      },
      {
        id: uniqueId(),
        title: 'Sincronización',
        href: '/apps/integraciones/sincronizacion',
      },
    ],
  },
  {
    id: uniqueId(),
    title: 'Sistema',
    icon: 'solar:settings-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Copias de Seguridad',
        href: '/apps/admin/respaldos',
      },
      {
        id: uniqueId(),
        title: 'Importación Masiva',
        href: '/apps/admin/importacion-masiva',
      },
    ],
  },
];

// Función para aplicar terminología dinámica a los items del menú
const applyTerminologia = (items: MenuitemsType[], terminologia: { vendedor: string; vendedorPlural: string }): MenuitemsType[] => {
  return items.map(item => {
    let newItem = { ...item };
    
    // Reemplazar títulos que contienen "Vendedor / Asesor" o "Vendedor"
    if (newItem.title) {
      if (newItem.title === "Vendedor / Asesor") {
        newItem.title = terminologia.vendedorPlural;
      } else if (newItem.title === "Liquidar Vendedor / Asesor") {
        newItem.title = `Liquidar ${terminologia.vendedor}`;
      }
    }
    
    // Aplicar recursivamente a children
    if (newItem.children) {
      newItem.children = applyTerminologia(newItem.children, terminologia);
    }
    
    return newItem;
  });
};

// Función para obtener menú filtrado por permisos
export const getFilteredMenuItems = (
  hasPermission: (module: string, action: string) => boolean,
  canAccessModule: (module: string) => boolean,
  terminologia?: { vendedor: string; vendedorPlural: string },
  isModuleInPlan?: (module: string) => boolean,
): MenuitemsType[] => {
  let items = [...BaseMenuitems];
  
  // Aplicar terminología si se proporciona
  if (terminologia) {
    items = applyTerminologia(items, terminologia);
  }
  
  const filteredItems = filterMenuItemsByPermissions(items, hasPermission, canAccessModule, isModuleInPlan);
  const cleanedItems = cleanOrphanedNavLabels(filteredItems);
  return cleanedItems;
};

// Export BaseMenuitems for direct access
export { BaseMenuitems };
