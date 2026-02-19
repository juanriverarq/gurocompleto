/**
 * Utilitario para manejo de permisos en el sistema
 */

import { MenuitemsType } from '../layouts/full/vertical/sidebar/Sidebaritems';

// Mapeo de rutas del sidebar a módulos de permisos
export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  // Panel de Control
  '/apps/': 'dashboard',
  '/apps/dashboard': 'dashboard',

  // Operaciones de Seguros
  '/apps/seguros/clientes': 'clientes',
  '/apps/seguros/clientes/nuevo': 'clientes',
  '/apps/seguros/seguimiento': 'seguimiento_comercial',

  '/apps/seguros/polizas': 'polizas',
  '/apps/seguros/polizas/nueva': 'polizas',
  // Renovaciones pertenece al módulo de pólizas (acción: renovar)
  '/apps/seguros/renovaciones': 'polizas',
  '/apps/seguros/automoviles': 'automoviles',

  '/apps/seguros/siniestros': 'siniestros',
  '/apps/seguros/siniestros/nuevo': 'siniestros',
  '/apps/seguros/documentos-siniestro': 'documentos_siniestro',
  '/apps/seguros/documentos-poliza': 'documentos_poliza',

  // Gestión Comercial
  '/apps/saas/sales-funnel': 'embudo_ventas',
  '/apps/saas/sales-funnel/kanban': 'embudo_ventas',
  '/apps/saas/sales-funnel/lista': 'embudo_ventas',
  '/apps/comercial/metas-objetivos': 'metas_objetivos',
  '/apps/comercial/equipos-ventas': 'equipos_ventas',
  '/apps/comercial/rendimiento': 'analisis_rendimiento',

  // WhatsApp
  '/apps/whatsapp/dashboard': 'whatsapp_business',
  '/apps/whatsapp/inbox': 'whatsapp_business',
  '/apps/whatsapp/contacts': 'whatsapp_business',
  '/apps/whatsapp/conexiones': 'whatsapp_business',
  '/apps/whatsapp/campanas': 'whatsapp_business',
  '/apps/whatsapp/campanas/nueva': 'whatsapp_business',
  '/apps/whatsapp/programados': 'whatsapp_business',
  '/apps/whatsapp/plantillas': 'whatsapp_business',
  '/apps/whatsapp/chatbots': 'whatsapp_business',
  '/apps/whatsapp/chatbots/nuevo': 'whatsapp_business',
  '/apps/whatsapp/chatbots/flujos': 'whatsapp_business',
  '/apps/whatsapp/chatbots/respuestas': 'whatsapp_business',
  '/apps/whatsapp/reportes': 'whatsapp_business',

  // Marketing Digital
  '/apps/marketing/sms': 'sms_marketing',
  '/apps/marketing/enlaces-cotizacion': 'enlaces_cotizacion',
  '/apps/marketing/plantillas': 'email_marketing',
  '/apps/marketing/mini-web': 'mini_web',
  '/apps/marketing/mi-web': 'mini_web',
  '/apps/marketing/comparador-seguros': 'whatsapp_business',
  '/apps/marketing/creador-contenido': 'creador_contenido',
  '/apps/saas/configuracion-masiva': 'whatsapp_business',

  // Inteligencia Artificial
  '/apps/ia/asistente': 'asistentes_ia',
  '/apps/ia/asistente/deepseek': 'asistentes_ia',
  '/apps/voice-ai/dashboard': 'voice_ai',
  '/apps/ia/analisis-predictivo/predicciones': 'analytics_predictivo',
  '/apps/ia/ventas-cruzadas': 'analytics_predictivo',
  '/apps/ia/robots': 'asistentes_ia',

  // Gestión Financiera
  '/apps/comisiones/por-poliza': 'comisiones',
  '/apps/comisiones/anticipos-ajustes': 'comisiones',
  '/apps/cartera/clientes': 'cartera_clientes',
  '/apps/cartera/estados-cuenta': 'estados_cuenta',
  '/apps/cartera/reportes-financieros': 'reportes_financieros',
  '/apps/cartera/liquidar-vendedores': 'comisiones',
  '/apps/finanzas/facturacion-electronica': 'reportes_financieros',
  '/apps/finanzas/nomina-electronica': 'reportes_financieros',

  // Recursos Humanos
  '/apps/recursos-humanos': 'rrhh',
  '/apps/recursos-humanos/personas': 'rrhh',
  '/apps/recursos-humanos/reclutamiento': 'rrhh',
  '/apps/recursos-humanos/desempeno': 'rrhh',
  '/apps/recursos-humanos/clima': 'rrhh',
  '/apps/recursos-humanos/nueva': 'rrhh',

  // Gestión Documental
  '/apps/legal/contratos': 'contratos',
  '/apps/legal/documentos-cliente': 'documentos_clientes',
  '/apps/legal/documentos-internos': 'cumplimiento_legal',

  // Integraciones
  '/apps/integraciones/conectores': 'integraciones_externas',
  '/apps/integraciones/webhooks': 'integraciones_externas',
  '/apps/integraciones/documentacion': 'integraciones_externas',
  '/apps/integraciones/sincronizacion': 'sincronizacion',
  '/apps/integraciones/historial': 'sincronizacion',

  // Administración
  '/apps/admin/usuarios': 'gestion_usuarios',
  '/apps/admin/roles': 'roles_permisos',
  '/apps/admin/demo-permisos': 'roles_permisos',
  '/apps/admin/auditoria': 'auditoria_accesos',

  '/apps/admin/informacion-agencia': 'informacion_agencia',
  '/apps/admin/sedes': 'sedes',
  '/apps/admin/aseguradoras': 'aseguradoras',
  '/apps/admin/ramos': 'ramos',
  '/apps/admin/vendedores': 'vendedores',
  '/apps/admin/coberturas': 'coberturas',
  '/apps/admin/tipo-afiliacion': 'tipos_afiliacion',
  '/apps/admin/estados-siniestros': 'estados_siniestros',
  '/apps/admin/motivos-estados-poliza': 'motivos_estados_poliza',
  '/apps/admin/mensajeros': 'mensajeros',

  '/apps/admin/configuracion': 'configuracion_sistema',
  '/apps/admin/personalizacion': 'configuracion_sistema',
  '/apps/admin/respaldos': 'configuracion_sistema',
  '/apps/admin/importacion-masiva': 'configuracion_sistema',

  '/apps/admin/logs': 'monitoreo_logs',
  '/apps/admin/monitoreo': 'monitoreo_logs',
};

// Función para verificar si un usuario puede acceder a una ruta específica
export const canAccessRoute = (
  route: string,
  hasPermission: (module: string, action: string) => boolean,
  _canAccessModule: (module: string) => boolean,
): boolean => {
  // Mantener compatibilidad: por defecto checkea 'ver'
  return canAccessRouteWithAction(route, 'ver', hasPermission, _canAccessModule);
};

// Versión con acción configurable (para usos del sidebar por ítem)
export const canAccessRouteWithAction = (
  route: string,
  action: 'ver' | 'crear' | 'editar' | 'eliminar' | 'renovar' | 'emitir',
  hasPermission: (module: string, action: string) => boolean,
  _canAccessModule: (module: string) => boolean,
): boolean => {
  const module = ROUTE_PERMISSION_MAP[route];
  if (!module) {
    // Si la ruta no está mapeada aún, permitir acceso por defecto
    return true;
  }
  return hasPermission(module, action);
};

// Función para verificar si un usuario puede realizar una acción específica
export const canPerformAction = (
  route: string,
  action: 'ver' | 'crear' | 'editar' | 'eliminar' | 'renovar' | 'emitir',
  hasPermission: (module: string, action: string) => boolean,
): boolean => {
  const module = ROUTE_PERMISSION_MAP[route];
  if (!module) {
    return true;
  }

  return hasPermission(module, action);
};

// Función para filtrar elementos del menú basado en permisos
// Items de módulos no contratados (feature gate) se mantienen visibles para que
// el ModuleGate muestre la modal de desenfoque al intentar acceder.
// Solo se ocultan items bloqueados por permisos de rol del empleado.
export const filterMenuItemsByPermissions = (
  menuItems: MenuitemsType[],
  hasPermission: (module: string, action: string) => boolean,
  canAccessModule: (module: string) => boolean,
  isModuleInPlan?: (module: string) => boolean,
): MenuitemsType[] => {
  return menuItems.filter((item) => {
    // Mantener labels de sección si hay elementos válidos después (se limpia abajo)
    if (item.navlabel) return true;

    // Siempre mostrar items con chip "Próximamente" (están deshabilitados pero visibles)
    if ((item as any).chip === 'Próximamente') return true;

    // Si tiene hijos, filtrar recursivamente
    if (item.children && item.children.length > 0) {
      const filteredChildren = filterMenuItemsByPermissions(
        item.children,
        hasPermission,
        canAccessModule,
        isModuleInPlan,
      );
      if (filteredChildren.length === 0) return false;
      item.children = filteredChildren;
      return true;
    }

    // Si es una ruta, verificar acceso
    if (item.href) {
      const module = ROUTE_PERMISSION_MAP[item.href];
      if (!module) return true;

      // Si el módulo NO está en el plan, mantener visible (ModuleGate mostrará la modal)
      if (isModuleInPlan && !isModuleInPlan(module)) {
        return true;
      }

      // Si el módulo SÍ está en el plan, verificar permisos de rol normalmente
      const requiredAction = (item as any).requiredAction || 'ver';
      return canAccessRouteWithAction(item.href, requiredAction, hasPermission, canAccessModule);
    }

    return true;
  });
};

// Función para limpiar separadores huérfanos (navlabels sin elementos)
export const cleanOrphanedNavLabels = (menuItems: any[]): any[] => {
  const result: any[] = [];

  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];

    if (item.navlabel) {
      // Buscar el siguiente elemento que no sea navlabel
      let hasNextValidItem = false;
      for (let j = i + 1; j < menuItems.length; j++) {
        if (!menuItems[j].navlabel) {
          hasNextValidItem = true;
          break;
        }
      }

      // Solo incluir el navlabel si hay elementos válidos después
      if (hasNextValidItem) {
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }

  return result;
};
