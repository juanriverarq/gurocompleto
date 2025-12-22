import { useContext, useEffect } from 'react';
import { Sidebar } from 'flowbite-react';
import { IconSidebar } from './IconSidebar';
import { getFilteredMenuItems, BaseMenuitems } from './Sidebaritems';
import NavItems from './NavItems';
import NavCollapse from './NavCollapse';
import SimpleBar from 'simplebar-react';
import { CustomizerContext } from '../../../../context/CustomizerContext';
import { useLocation } from 'react-router';
import FullLogo from '../../shared/logo/FullLogo';
import React from 'react';
import { useUnifiedAuth } from '../../../../context/UnifiedAuthContext';
import { useTerminologia } from '../../../../context/TerminologiaContext';

const SidebarLayout = () => {
  const { selectedIconId, setSelectedIconId } = useContext(CustomizerContext) || {};
  const { hasPermission, canAccessModule } = useUnifiedAuth();
  const { terminologia } = useTerminologia();

  const location = useLocation();
  const pathname = location.pathname;

  // Obtener elementos del menú filtrados por permisos (visibilidad exige permiso "ver")
const filteredMenuitems = getFilteredMenuItems(hasPermission, canAccessModule, terminologia);

  function findActiveUrl(narray: any, targetUrl: any) {
    for (const item of narray) {
      // Check if the item has href and matches
      if (item.href === targetUrl) {
        return getSectionIdFromItem(item);
      }
      // Check if children array exists and search through it
      if (item.children) {
        for (const child of item.children) {
          if (child.href === targetUrl) {
            return getSectionIdFromItem(item);
          }
          // Check nested children
          if (child.children) {
            for (const nestedChild of child.children) {
              if (nestedChild.href === targetUrl) {
                return getSectionIdFromItem(item);
              }
            }
          }
        }
      }
    }
    return null; // Return null instead of 1 when no match is found
  }

  // Function to determine which section an item belongs to
  function getSectionIdFromItem(item: any) {
    // Get the index of the item in the menu to determine its section
    const itemIndex = filteredMenuitems.findIndex((menuItem) => menuItem.id === item.id);
    if (itemIndex === -1) return 1;

    // Count sections before this item
    let sectionCount = 0;
    for (let i = 0; i <= itemIndex; i++) {
      if (filteredMenuitems[i].navlabel) {
        sectionCount++;
      }
    }
    return sectionCount;
  }

  useEffect(() => {
    // Only auto-select from URL on initial load when no icon is selected
    if (!selectedIconId) {
      const result = findActiveUrl(filteredMenuitems, pathname);
      if (result) {
        setSelectedIconId(result);
      } else {
        setSelectedIconId(1); // Default to dashboard if no match
      }
    }
    // Never override manual selections - mini-sidebar should be independent of URL
  }, [pathname, filteredMenuitems, selectedIconId, setSelectedIconId]);

  // Filter menu items based on selected icon
  function getMenuItemsBySelectedIcon() {
    const sectionMap: { [key: number]: string[] } = {
      1: ['Panel de Control'], // Dashboard icon
      2: ['Operaciones de Seguros'], // Shield icon
      3: ['Gestión Comercial'], // Commercial icon
      4: ['Marketing Digital'], // Marketing icon
      5: ['Inteligencia Artificial'], // AI icon
      6: ['Gestión Financiera'], // Money icon
      7: ['Gestión Documental'], // Legal icon
      10: ['Administración'], // Settings icon
    };

    const targetSections = sectionMap[selectedIconId || 1] || [];
    const filteredItems: any[] = [];
    let currentSection = '';
    let currentSectionItems: any[] = [];

    for (const item of filteredMenuitems) {
      if (item.navlabel) {
        // Save previous section if it matches
        if (currentSection && targetSections.includes(currentSection)) {
          filteredItems.push({
            heading: currentSection,
            children: currentSectionItems,
          });
        }
        // Start new section
        currentSection = item.subheader || '';
        currentSectionItems = [];
      } else {
        // Add item to current section
        currentSectionItems.push(item);
      }
    }

    // Don't forget the last section
    if (currentSection && targetSections.includes(currentSection)) {
      filteredItems.push({
        heading: currentSection,
        children: currentSectionItems,
      });
    }

    return filteredItems;
  }

  const groupedItems = getMenuItemsBySelectedIcon();

  return (
    <>
      <div className="xl:block hidden">
        <div className="minisidebar-icon border-e border-ld  fixed start-0 z-[1]">
          <IconSidebar />
        </div>
        <Sidebar
          className="fixed menu-sidebar  bg-white dark:bg-darkgray rtl:pe-4 rtl:ps-0 "
          aria-label="Sidebar with multi-level dropdown example"
        >
          <div className="px-6 py-4 flex items-center sidebarlogo">
            <FullLogo />
          </div>
          <SimpleBar className="h-[calc(100vh_-_85px)]">
            <Sidebar.Items className="pe-4 rtl:pe-0 rtl:ps-4 px-5 mt-2">
              <Sidebar.ItemGroup className="sidebar-nav hide-menu">
                {groupedItems.map((section: any, index: number) => (
                  <div className="caption" key={section.heading + index}>
                    <React.Fragment key={index}>
                      <h5 className="text-link dark:text-white/70 font-semibold caption font-semibold leading-6 tracking-widest text-xs text-sm  pb-2 uppercase">
                        {section.heading}
                      </h5>
                      {section.children?.map((child: any, childIndex: number) => (
                        <React.Fragment key={child.id || childIndex}>
                          {child.children ? (
                            <NavCollapse item={child} />
                          ) : (
                            <NavItems item={child} />
                          )}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  </div>
                ))}
              </Sidebar.ItemGroup>
            </Sidebar.Items>
          </SimpleBar>
        </Sidebar>
      </div>
    </>
  );
};

export default SidebarLayout;
