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
  // 🏠 PANEL DE CONTROL
  {
    navlabel: true,
    subheader: 'Panel de Control',
  },
  {
    id: uniqueId(),
    title: 'Dashboard',
    icon: 'solar:widget-2-bold-duotone',
    href: '/apps/',
  },

  // 🛡️ OPERACIONES DE SEGUROS
  {
    navlabel: true,
    subheader: 'Operaciones de Seguros',
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
      {
        id: uniqueId(),
        title: 'Seguimiento Comercial',
        href: '/apps/seguros/seguimiento',
      },
      // Ítem removido: Embudo de Conversión
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

  // 💼 GESTIÓN COMERCIAL
  {
    navlabel: true,
    subheader: 'Gestión Comercial',
  },
  // Orden propuesto: Embudo, Seguimiento, Metas, Equipos, Rendimiento
  {
    id: uniqueId(),
    title: 'Negocios',
    icon: 'solar:target-bold-duotone',
    href: '/apps/saas/sales-funnel',
  },
  // Eliminado: Pipeline de Ventas (/apps/comercial/pipeline)
  {
    id: uniqueId(),
    title: 'Seguimiento Comercial',
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
    title: 'Equipos de Ventas',
    icon: 'solar:users-group-rounded-bold-duotone',
    href: '/apps/comercial/equipos-ventas',
  },
  {
    id: uniqueId(),
    title: 'Análisis de Rendimiento',
    icon: 'solar:graph-up-bold-duotone',
    href: '/apps/comercial/rendimiento',
  },

  // 💰 GESTIÓN FINANCIERA
  {
    navlabel: true,
    subheader: 'Gestión Financiera',
  },
  {
    id: uniqueId(),
    title: 'Cartera',
    icon: 'solar:wallet-bold-duotone',
    href: '/apps/cartera/clientes',
  },
  {
    id: uniqueId(),
    title: 'Comisiones',
    icon: 'solar:dollar-minimalistic-bold-duotone',
    href: '/apps/comisiones/por-poliza',
  },
  {
    id: uniqueId(),
    title: 'Liquidar Vendedor / Asesor',
    icon: 'solar:calculator-bold-duotone',
    href: '/apps/cartera/liquidar-vendedores',
  },
  {
    id: uniqueId(),
    title: 'Reportes Financieros',
    icon: 'solar:chart-square-bold-duotone',
    href: '/apps/cartera/reportes-financieros',
  },
  {
    id: uniqueId(),
    title: 'Anticipos y Ajustes',
    icon: 'solar:dollar-minimalistic-bold-duotone',
    href: '/apps/comisiones/anticipos-ajustes',
  },

  // 📢 MARKETING DIGITAL
  {
    navlabel: true,
    subheader: 'Marketing Digital',
  },
  {
    id: uniqueId(),
    title: 'WhatsApp Marketing',
    icon: 'solar:chat-round-dots-bold-duotone',
    href: '/apps/saas/configuracion-masiva',
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

  // 🤖 INTELIGENCIA ARTIFICIAL
  {
    navlabel: true,
    subheader: 'Inteligencia Artificial',
  },
  {
    id: uniqueId(),
    title: 'Chatbot',
    icon: 'solar:cpu-bolt-bold-duotone',
    href: '/apps/ia/asistente',
  },
  {
    id: uniqueId(),
    title: 'Call center IA',
    icon: 'solar:phone-calling-rounded-outline',
    href: '/apps/voice-ai/dashboard',
  },
  {
    id: uniqueId(),
    title: 'Predicciones de venta',
    icon: 'solar:chart-square-bold-duotone',
    href: '/apps/ia/analisis-predictivo/predicciones',
  },
  {
    id: uniqueId(),
    title: 'Ventas cruzadas',
    icon: 'solar:graph-up-bold-duotone',
    href: '/apps/ia/ventas-cruzadas',
  },

  // 📚 GESTIÓN DOCUMENTAL
  {
    navlabel: true,
    subheader: 'Gestión Documental',
  },

  {
    id: uniqueId(),
    title: 'Clientes',
    icon: 'solar:folder-with-files-bold-duotone',
    href: '/apps/legal/documentos-cliente',
  },
  {
    id: uniqueId(),
    title: 'Pólizas',
    icon: 'solar:folder-with-files-bold-duotone',
    href: '/apps/seguros/documentos-poliza',
  },
  {
    id: uniqueId(),
    title: 'Siniestros',
    icon: 'solar:folder-with-files-bold-duotone',
    href: '/apps/seguros/documentos-siniestro',
  },
  {
    id: uniqueId(),
    title: 'Internos',
    icon: 'solar:archive-bold-duotone',
    href: '/apps/legal/documentos-internos',
  },

  // 🔗 INTEGRACIONES
  {
    navlabel: true,
    subheader: 'Integraciones',
  },
  {
    id: uniqueId(),
    title: 'Integraciones Externas',
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
        title: 'Documentación API',
        href: '/apps/integraciones/documentacion',
      },
    ],
  },
  {
    id: uniqueId(),
    title: 'Sincronización',
    icon: 'solar:refresh-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Sincronización Auto',
        href: '/apps/integraciones/sincronizacion',
      },
      {
        id: uniqueId(),
        title: 'Historial de Sync',
        href: '/apps/integraciones/historial',
      },
    ],
  },

  // ⚙️ ADMINISTRACIÓN
  {
    navlabel: true,
    subheader: 'Administración',
  },
  {
    id: uniqueId(),
    title: 'Gestión de Usuarios',
    icon: 'solar:users-group-rounded-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Lista de Usuarios',
        href: '/apps/admin/usuarios',
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
    title: 'Configuración Agencia',
    icon: 'solar:buildings-3-bold-duotone',
    children: [
      {
        id: uniqueId(),
        title: 'Información de Agencia',
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
    title: 'Configuración del Sistema',
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
  terminologia?: { vendedor: string; vendedorPlural: string }
): MenuitemsType[] => {
  let items = [...BaseMenuitems];
  
  // Aplicar terminología si se proporciona
  if (terminologia) {
    items = applyTerminologia(items, terminologia);
  }
  
  const filteredItems = filterMenuItemsByPermissions(items, hasPermission, canAccessModule);
  const cleanedItems = cleanOrphanedNavLabels(filteredItems);
  return cleanedItems;
};

// Export BaseMenuitems for direct access
export { BaseMenuitems };
