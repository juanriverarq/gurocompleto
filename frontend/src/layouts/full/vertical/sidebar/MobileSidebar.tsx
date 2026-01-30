import { useContext, useEffect } from 'react';
import { Sidebar } from 'flowbite-react';
import { IconSidebar } from './IconSidebar';
import { getFilteredMenuItems, BaseMenuitems } from './Sidebaritems';
import NavItems from './NavItems';
import NavCollapse from './NavCollapse';
import SimpleBar from 'simplebar-react';
import { CustomizerContext } from '../../../../context/CustomizerContext';
import { useLocation } from 'react-router';
import React from 'react';
import { useUnifiedAuth } from '../../../../context/UnifiedAuthContext';
import { useTerminologia } from '../../../../context/TerminologiaContext';

const MobileSidebar = () => {
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
    return 1; // Default to first section
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
      if (result && setSelectedIconId) {
        setSelectedIconId(result);
      }
    }
    // Never override manual selections - mini-sidebar should be independent of URL
  }, [pathname, setSelectedIconId, filteredMenuitems, selectedIconId]);

  // Filter menu items based on selected icon - same logic as desktop sidebar
  function getMenuItemsBySelectedIcon() {
    const sectionMap: { [key: number]: string[] } = {
      1: ['Inicio'],
      2: ['Seguros'],
      3: ['Comercial'],
      4: ['Finanzas'],
      5: ['Comunicaciones'],
      6: ['Inteligencia Artificial'],
      7: ['Documentos'],
      8: ['Configuración'],
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
      <div>
        <div className="minisidebar-icon border-e border-ld bg-white dark:bg-darkgray fixed start-0 z-[1] ">
          <IconSidebar />
        </div>
        <Sidebar
          className="fixed menu-sidebar pt-8 bg-white dark:bg-darkgray transition-all"
          aria-label="Sidebar with multi-level dropdown example"
        >
          <SimpleBar className="h-[calc(100vh_-_85px)]">
            <Sidebar.Items className="ps-4 pe-4">
              <Sidebar.ItemGroup className="sidebar-nav">
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

export default MobileSidebar;
