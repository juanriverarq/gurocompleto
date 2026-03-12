import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';
import { ROUTE_PERMISSION_MAP } from '../utils/permissionUtils';
import { MODULES } from './landingpage/pricing-calculator/modules';

const FEATURE_MAP: Record<string, string> = {
  clientes: 'clientes',
  polizas: 'polizas',
  siniestros: 'siniestros',
  renovaciones: 'renovaciones',
  automoviles: 'automoviles',
  seguimiento_comercial: 'seguimiento',
  documentos_siniestro: 'documentos',
  documentos_poliza: 'documentos',
  embudo_ventas: 'crm',
  metas_objetivos: 'crm',
  equipos_ventas: 'crm',
  analisis_rendimiento: 'crm',
  whatsapp_business: 'whatsapp',
  sms_marketing: 'whatsapp',
  email_marketing: 'email',
  enlaces_cotizacion: 'miniweb',
  mini_web: 'miniweb',
  pagina_web: 'miniweb',
  asistentes_ia: 'ia_chatbot',
  robots_ia: 'ia_chatbot',
  voice_ai: 'ia_callcenter',
  analytics_predictivo: 'ia_predicciones',
  comparador_autos: 'automoviles',
  comisiones: 'cartera',
  cartera_clientes: 'cartera',
  recibos_caja: 'cartera',
  estados_cuenta: 'cartera',
  reportes_financieros: 'cartera',
  creador_contenido: 'creador_contenido',
};

interface ModuleGateProps {
  children: React.ReactNode;
}

const ModuleGate: React.FC<ModuleGateProps> = ({ children }) => {
  const location = useLocation();
  const { canAccessModule, tenant, isEmpleado, loading } = useUnifiedAuth();

  const gateResult = useMemo(() => {
    // No bloquear mientras el contexto de auth está cargando
    if (loading) return { allowed: true };

    const path = location.pathname;

    let matchedModule: string | null = null;
    let longestMatch = 0;
    for (const [route, mod] of Object.entries(ROUTE_PERMISSION_MAP)) {
      if (path.startsWith(route) && route.length > longestMatch) {
        matchedModule = mod;
        longestMatch = route.length;
      }
    }

    if (!matchedModule) return { allowed: true };

    const allowed = canAccessModule(matchedModule);
    if (allowed) return { allowed: true };

    const featureKey = FEATURE_MAP[matchedModule] || matchedModule;
    const moduleInfo = MODULES.find(m => m.key === featureKey);

    return {
      allowed: false,
      moduleName: moduleInfo?.name || matchedModule,
      moduleIcon: moduleInfo?.icon || 'solar:lock-keyhole-bold-duotone',
    };
  }, [location.pathname, canAccessModule, tenant, isEmpleado, loading]);

  if (gateResult.allowed) {
    return <>{children}</>;
  }

  const { moduleName, moduleIcon } = gateResult as any;
  const waLink = `https://wa.me/573001009305?text=${encodeURIComponent(`Hola, quiero activar el módulo de ${moduleName} en mi cuenta de Guro`)}`;

  return (
    <div className="relative">
      {/* Blurred content behind */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: 'blur(5px)', opacity: 0.3 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Centered card — positioned absolute within content area, NOT fixed */}
      <div className="absolute inset-0 flex items-start justify-center pt-20 pointer-events-none">
        <div className="pointer-events-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 max-w-sm w-full mx-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <Icon icon={moduleIcon} className="text-2xl text-gray-400" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-4">
            <Icon icon="solar:lock-keyhole-bold" className="text-amber-500 text-xs" />
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {isEmpleado ? 'Sin permisos' : 'Módulo no disponible'}
            </span>
          </div>

          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{moduleName}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            {isEmpleado
              ? 'No tienes permisos para acceder a este módulo. Contacta a tu administrador.'
              : 'Tu plan actual no incluye este módulo. Comunícate con soporte para habilitarlo.'}
          </p>

          {!isEmpleado && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#25D366] hover:bg-[#1fb855] text-white font-semibold rounded-xl transition text-sm"
            >
              <Icon icon="mdi:whatsapp" className="text-lg" />
              Contactar soporte
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModuleGate;
