import  { useEffect, useState } from "react";
import NavItems from "../NavItems";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { CustomCollapse } from "../CustomCollapse";
import React from "react";
// import { CustomizerContext } from "src/context/CustomizerContext";

interface NavCollapseProps {
  item: {
    id?: string;
    title?: string;
    icon?: any;
    href?: string;
    children?: any[];
    [key: string]: any;
  };
}

const NavCollapse: React.FC<NavCollapseProps> = ({ item }: any) => {
  const location = useLocation();
  const pathname = location.pathname;

  // Determine if any child matches the current path
  const activeDD = item.children?.find((t: { href: string }) => t.href === pathname);
  
  const { t, i18n } = useTranslation();
  const [translatedLabel, setTranslatedLabel] = useState<string | null>(null);

  // Manage open/close state for the collapse
  const [isOpen, setIsOpen] = useState<boolean>(!!activeDD);

  useEffect(() => {
    const loadTranslation = async () => {
      const label = t(`${item.title}`);
      setTranslatedLabel(label);
    };
    loadTranslation();
  }, [i18n.language, item.title, t]);

  // Toggle the collapse
  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  // Nota: No auto-comprimir aquí; sólo manejar desde NavItems al hacer clic

  return (
    <CustomCollapse
      label={translatedLabel || `${item.title}`}
      open={isOpen}
      onClick={handleToggle}
      icon={item.icon} 
      className={
        Boolean(activeDD)
          ? "!text-white bg-primary rounded-xl hover:bg-primary hover:text-white shadow-btnshdw"
          : "rounded-xl dark:text-white/80 hover:text-primary"
      }
    >
      {/* Render child items */}
      {item.children && (
        <div className="sidebar-dropdown">
          {item.children.map((child: any) => (
            <React.Fragment key={child.id}>
              {child.children ? (
                <NavCollapse item={child} /> // Recursive call for nested collapse
              ) : (
                <NavItems item={child} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </CustomCollapse>
  );
};

export default NavCollapse;
