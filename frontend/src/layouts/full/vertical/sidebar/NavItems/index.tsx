import React, { useContext } from "react";

import { Sidebar } from "flowbite-react";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { DashboardContext } from "src/context/DashboardContext/DashboardContext";
import { CustomizerContext } from "src/context/CustomizerContext";

interface NavItemsProps {
  item: {
    id?: string;
    title?: string;
    icon?: any;
    href?: string;
    children?: any[];
    chip?: string;
    chipColor?: string;
    [key: string]: any;
  };
}

const NavItems: React.FC<NavItemsProps> = ({ item }) => {
  const location = useLocation();
  const pathname = location.pathname;
  const { t } = useTranslation();

  const {setIsMobileSidebarOpen}  = useContext(DashboardContext);
  const { setIsCollapse, isCollapse } = useContext(CustomizerContext) || {};

  // Si tiene chip "Próximamente", está deshabilitado
  const isDisabled = item.chip === 'Próximamente' || item.href === '#';

  const handleClick = (e: React.MouseEvent) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    setIsMobileSidebarOpen(false);
    if (setIsCollapse && isCollapse === "full-sidebar") setIsCollapse("mini-sidebar");
  };

  return (
    <>
      <Sidebar.Item
        to={isDisabled ? undefined : item.href}
        as={isDisabled ? 'div' : Link}
        onClick={handleClick}
        className={`${
          isDisabled
            ? "text-gray-400 bg-transparent cursor-not-allowed opacity-60"
            : item.href == pathname
              ? "text-white bg-primary rounded-xl hover:text-white hover:bg-primary dark:hover:text-white shadow-btnshdw active"
              : "text-link bg-transparent group/link"
        } `}
      >
        <span className="flex gap-3 align-center items-center w-full">
          {item.icon ? (
            <Icon icon={item.icon} className={`iconify iconify--solar dark:bg-blue ${isDisabled ? 'opacity-50' : ''} ${item.color || ''}`} height={18} />
          ) : (
            <span
              className={`${
                item.href == pathname
                  ? "dark:bg-white rounded-full mx-1.5 group-hover/link:bg-primary !bg-primary h-[6px] w-[6px]"
                  : "h-[6px] w-[6px] bg-black/40 dark:bg-white rounded-full mx-1.5 group-hover/link:bg-primary"
              } `}
            ></span>
          )}
          <span className="flex flex-col">
            {item.chip && (
              <span className={`text-[8px] px-1 py-0 rounded-full whitespace-nowrap w-fit mb-0.5 ${
                item.chipColor === 'secondary' 
                  ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' 
                  : item.chipColor === 'primary'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {item.chip}
              </span>
            )}
            <span className={`max-w-36 overflow-hidden ${isDisabled ? 'text-gray-400' : ''}`}>
              {t(`${item.title}`)}
            </span>
          </span>
        </span> 
      </Sidebar.Item>
    </>
  );
};

export default NavItems;
