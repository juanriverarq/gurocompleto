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
    [key: string]: any;
  };
}

const NavItems: React.FC<NavItemsProps> = ({ item }) => {
  const location = useLocation();
  const pathname = location.pathname;
  const { t } = useTranslation();

  const {setIsMobileSidebarOpen}  = useContext(DashboardContext);
  const { setIsCollapse, isCollapse } = useContext(CustomizerContext) || {};
  return (
    <>
      <Sidebar.Item
        to={item.href}
        as={Link}
        onClick = {() => { 
          setIsMobileSidebarOpen(false);
          // Solo comprimir automáticamente en sidebar completo; no afectar mini-sidebar
          if (setIsCollapse && isCollapse === "full-sidebar") setIsCollapse("mini-sidebar");
        }}
        className={`${
          item.href == pathname
            ? "text-white bg-primary rounded-xl  hover:text-white hover:bg-primary dark:hover:text-white shadow-btnshdw active"
            : "text-link bg-transparent group/link "
        } `}
      >
        <span className="flex gap-3 align-center items-center">
          {item.icon ? (
            <Icon icon={item.icon} className={`iconify iconify--solar dark:bg-blue ${item.color || ''}`} height={18} />
          ) : (
            <span
              className={`${
                item.href == pathname
                  ? "dark:bg-white rounded-full mx-1.5 group-hover/link:bg-primary !bg-primary h-[6px] w-[6px]"
                  : "h-[6px] w-[6px] bg-black/40 dark:bg-white rounded-full mx-1.5 group-hover/link:bg-primary"
              } `}
            ></span>
          )}
          <span
            className={`max-w-36 overflow-hidden`}
          >
            {t(`${item.title}`)}
          </span>
        </span> 
      </Sidebar.Item>
    </>
  );
};

export default NavItems;
