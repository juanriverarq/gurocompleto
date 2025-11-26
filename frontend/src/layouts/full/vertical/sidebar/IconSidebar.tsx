import { useContext, useMemo } from 'react';
import { Icon } from '@iconify/react';
import Miniicons from './MiniSidebar';
import SimpleBar from 'simplebar-react';
import { Button, HR, Tooltip } from 'flowbite-react';
import { Link } from 'react-router';
import { CustomizerContext } from 'src/context/CustomizerContext';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';

export const IconSidebar = () => {
  const { selectedIconId, setSelectedIconId, setIsCollapse, isCollapse } =
    useContext(CustomizerContext) || {};
  const { canAccessModule } = useUnifiedAuth();

  // Mapeo de íconos a módulos que habilitan su visibilidad
  const iconAccessMap: Record<number, string[]> = {
    1: ['dashboard'],
    2: ['clientes', 'polizas', 'siniestros', 'renovaciones', 'anexos_condiciones'],
    3: [
      'pipeline_ventas',
      'metas_objetivos',
      'equipos_ventas',
      'analisis_rendimiento',
      'embudo_ventas',
      'seguimiento_comercial',
    ],
    4: ['whatsapp_business', 'email_marketing'],
    5: [
      'leads',
      'sms_marketing',
      'enlaces_cotizacion',
      'plantillas_campana',
      'recordatorios_automaticos',
      'cartera_clientes',
      'comisiones',
      'reportes_financieros',
    ],
    6: ['asistentes_ia', 'voice_ai', 'analytics_predictivo'],
    7: ['contratos', 'proteccion_datos', 'documentos_clientes', 'cumplimiento_legal'],
    8: ['integraciones_externas', 'sincronizacion'],
    9: [
      'gestion_usuarios',
      'roles_permisos',
      'auditoria_accesos',
      'informacion_agencia',
      'aseguradoras',

      'mensajeros',
      'configuracion_sistema',
      'monitoreo_logs',
    ],
    10: [
      'sedes',
      'aseguradoras',
      'ramos',
      'vendedores',
      'coberturas',
      'tipos_afiliacion',
      'estados_siniestros',
      'motivos_estados_poliza',
    ],
  };

  const visibleIcons = useMemo(() => {
    return Miniicons.filter((mi) => {
      const modules = iconAccessMap[mi.id] || [];

      if (modules.length === 0) return true;
      console.log(
        modules.some((m) => canAccessModule(m)),
        'modules',
        modules,
      );
      return modules.some((m) => canAccessModule(m));
    });
  }, [canAccessModule]);

  // Handle icon click
  const handleClick = (id: any) => {
    setSelectedIconId(id);
    setIsCollapse('full-sidebar');
  };

  console.log(visibleIcons, 'visibleIcons');

  return (
    <>
      <div className="minisidebar-icon dark:bg-dark">
        <div className="barnd-logo">
          <Link
            to="#"
            className="nav-link"
            onClick={() => {
              if (isCollapse === 'full-sidebar') {
                setIsCollapse('mini-sidebar');
              } else {
                setIsCollapse('full-sidebar');
              }
            }}
          >
            <Icon
              icon="solar:hamburger-menu-line-duotone"
              height={24}
              className="text-black dark:text-white dark:hover:text-primary"
            />
          </Link>
        </div>
        <SimpleBar className="miniicons ">
          {visibleIcons.map((links, index) => (
            <Tooltip
              key={links.id}
              content={links.tooltip}
              placement="right"
              className="flowbite-tooltip"
            >
              <Button
                key={index}
                className={`h-12 w-12 hover:text-primary text-darklink dark:text-white/70 hover:bg-lightprimary rounded-tw flex justify-center items-center mx-auto mb-2 ${
                  links.id === selectedIconId
                    ? 'text-white bg-primary hover:bg-primaryemphasis hover:text-white dark:hover:text-white'
                    : 'text-darklink  bg-transparent'
                }`}
                type="button"
                onClick={() => handleClick(links.id)}
              >
                <Icon
                  icon={links.icon}
                  height={24}
                  className="iconify iconify--solar dark:bg-blue"
                />
              </Button>

              {index > 0 && (index + 1) % 3 === 0 && index + 1 !== visibleIcons.length && (
                <HR className="my-3"></HR>
              )}
            </Tooltip>
          ))}
        </SimpleBar>
      </div>
    </>
  );
};
