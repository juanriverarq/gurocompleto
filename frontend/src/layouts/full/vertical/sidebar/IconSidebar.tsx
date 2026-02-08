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
    2: ['clientes', 'polizas', 'siniestros', 'renovaciones', 'automoviles'],
    3: ['embudo_ventas', 'seguimiento_comercial', 'metas_objetivos', 'analisis_rendimiento'],
    4: ['cartera_clientes', 'comisiones', 'reportes_financieros'],
    5: ['whatsapp_business', 'email_marketing', 'enlaces_cotizacion', 'mini_web'],
    6: ['asistentes_ia', 'voice_ai', 'analytics_predictivo'],
    7: ['documentos_clientes', 'documentos_poliza', 'documentos_siniestro', 'cumplimiento_legal'],
    8: [
      'gestion_usuarios',
      'roles_permisos',
      'informacion_agencia',
      'sedes',
      'aseguradoras',
      'ramos',
      'vendedores',
      'coberturas',
      'tipos_afiliacion',
      'estados_siniestros',
      'motivos_estados_poliza',
      'mensajeros',
      'configuracion_sistema',
      'integraciones_externas',
      'sincronizacion',
    ],
  };

  const visibleIcons = useMemo(() => {
    return Miniicons.filter((mi) => {
      const modules = iconAccessMap[mi.id] || [];

      if (modules.length === 0) return true;
      return modules.some((m) => canAccessModule(m));
    });
  }, [canAccessModule]);

  // Handle icon click
  const handleClick = (id: any) => {
    setSelectedIconId(id);
    setIsCollapse('full-sidebar');
  };

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
              height={22}
              className="text-gray-500 hover:text-[#573CFF] transition-colors"
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
                className={`h-11 w-11 hover:text-[#573CFF] hover:bg-[#573CFF]/10 rounded-xl flex justify-center items-center mx-auto mb-1.5 transition-all duration-200 ${
                  links.id === selectedIconId
                    ? 'text-white !bg-[#573CFF] hover:!bg-[#573CFF] hover:text-white shadow-md shadow-[#573CFF]/25'
                    : 'text-gray-400 bg-transparent'
                }`}
                type="button"
                onClick={() => handleClick(links.id)}
              >
                <Icon
                  icon={links.icon}
                  height={22}
                />
              </Button>

              {index > 0 && (index + 1) % 3 === 0 && index + 1 !== visibleIcons.length && (
                <HR className="my-2 opacity-50"></HR>
              )}
            </Tooltip>
          ))}
        </SimpleBar>
      </div>
    </>
  );
};
