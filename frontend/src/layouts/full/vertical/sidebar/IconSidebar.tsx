import { useContext, useMemo } from 'react';
import { Icon } from '@iconify/react';
import Miniicons from './MiniSidebar';
import { getFilteredMenuItems } from './Sidebaritems';
import SimpleBar from 'simplebar-react';
import { Button, HR, Tooltip } from 'flowbite-react';
import { Link } from 'react-router';
import { CustomizerContext } from 'src/context/CustomizerContext';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useTerminologia } from 'src/context/TerminologiaContext';

export const IconSidebar = () => {
  const { selectedIconId, setSelectedIconId, setIsCollapse, isCollapse } =
    useContext(CustomizerContext) || {};
  const { hasPermission, canAccessModule, isEmpleado, isModuleInPlan } = useUnifiedAuth();
  const { terminologia } = useTerminologia();

  // For employees: hide mini-sidebar icons for sections with zero visible pages.
  // For owners/admins: show all icons so they can see ModuleGate blur+modal.
  const visibleIcons = useMemo(() => {
    if (!isEmpleado) return Miniicons;

    const filteredMenu = getFilteredMenuItems(hasPermission, canAccessModule, terminologia, isModuleInPlan);

    // Map section names to mini-sidebar icon IDs
    const sectionMap: Record<string, number> = {
      'Inicio': 1,
      'Seguros': 2,
      'Comercial': 3,
      'Finanzas': 4,
      'Comunicaciones': 5,
      'Inteligencia Artificial': 6,
      'Documentos': 7,
      'Configuración': 8,
      'Cotizadores': 9,
    };

    // Determine which sections have at least one non-label item
    const sectionsWithContent = new Set<number>();
    sectionsWithContent.add(1); // Inicio always visible
    let currentSectionId = 0;
    for (const item of filteredMenu) {
      if (item.navlabel) {
        currentSectionId = sectionMap[item.subheader || ''] || 0;
      } else if (currentSectionId) {
        sectionsWithContent.add(currentSectionId);
      }
    }

    return Miniicons.filter((icon) => sectionsWithContent.has(icon.id));
  }, [isEmpleado, hasPermission, canAccessModule, terminologia, isModuleInPlan]);

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
