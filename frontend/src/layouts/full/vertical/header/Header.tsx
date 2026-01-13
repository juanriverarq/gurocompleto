import  { useState, useEffect, useContext } from "react";
import { Navbar, Tooltip } from "flowbite-react";
import { useUnifiedAuth } from "src/context/UnifiedAuthContext";
import Search from "./Search";
import { Icon } from "@iconify/react";
import CreateButton from "./CreateButton";
import Notifications from "./Notifications";
import Profile from "./Profile";
import FullLogo from "../../shared/logo/FullLogo";
import MobileHeaderItems from "./MobileHeaderItems";
import { Drawer } from "flowbite-react";
import MobileSidebar from "../sidebar/MobileSidebar";
import HorizontalMenu from "../../horizontal/header/HorizontalMenu";
import { CustomizerContext } from "../../../../context/CustomizerContext";
import { DashboardContext } from "src/context/DashboardContext/DashboardContext";
import WalletWidget from "../../../../components/WalletWidget/WalletWidget";

interface HeaderPropsType {
  layoutType: string;
}

const Header = ({ layoutType }: HeaderPropsType) => {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const {  isLayout, activeMode, setActiveMode } =
    useContext(CustomizerContext);

    const {isMobileSidebarOpen,setIsMobileSidebarOpen} = useContext(DashboardContext);

  const [mobileMenu, setMobileMenu] = useState("");
  const { tenant, trialEndsAt } = useUnifiedAuth();

  const isTrialActive = () => {
    const status = (tenant as any)?.status || (tenant as any)?.estado;
    if (!status) return false;
    const normalized = String(status).toLowerCase();
    return normalized === 'trial' || normalized === 'en_trial' || normalized === 'prueba' || normalized === 'trial_active';
  };

  const getTrialDaysLeft = () => {
    try {
      if (!tenant || !isTrialActive()) return null;
      const endsSource = trialEndsAt || (tenant as any)?.trial_ends_at || null;
      if (!endsSource) return null;
      const now = new Date();
      const ends = new Date(endsSource);
      const diffMs = ends.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays < 0 ? 0 : diffDays;
    } catch {
      return null;
    }
  };

  const handleMobileMenu = () => {
    if (mobileMenu === "active") {
      setMobileMenu("");
    } else {
      setMobileMenu("active");
    }
  };

  const toggleMode = () => {
    setActiveMode((prevMode: string) =>
      prevMode === "light" ? "dark" : "light"
    );
  };

  // mobile-sidebar
  const handleClose = () => setIsMobileSidebarOpen(false);

  // Función para manejar el botón de referidos (ya no se usa, pero se mantiene por compatibilidad)
  const handleReferralClick = () => {
    // Aquí se puede agregar la lógica para mostrar un modal de referidos
  };

  return (
    <>
      <header
        className={`top-0 z-[10]  ${
          isSticky
            ? "bg-white dark:bg-darkgray sticky"
            : "bg-transparent"
        }`}
      >
        {/* Trial banner superior */}
        {(() => {
          if (!isTrialActive()) return null;
          const days = getTrialDaysLeft();
          if (typeof days === 'number') {
            return (
              <div className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white relative z-[10]">
                <div className={`mx-auto ${isLayout == "full" ? "w-full px-4" : "container"} py-0.5 text-center text-xs flex items-center justify-center gap-1`}>
                  <span className="hidden sm:inline">Estás usando la versión de prueba.</span>
                  <strong>{days} días restantes</strong>
                  <a href="/apps/billing/planes" className="ml-2 inline-flex items-center px-2 py-0 rounded-md bg-white/10 hover:bg-white/20 text-white border border-white">
                    Activar plan
                  </a>
                </div>
              </div>
            );
          }
          // Si no pudimos calcular días, igualmente mostrar CTA de trial activo
          return (
            <div className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white relative z-[10]">
              <div className={`mx-auto ${isLayout == "full" ? "w-full px-4" : "container"} py-0.5 text-center text-xs flex items-center justify-center gap-1`}>
                <span className="hidden sm:inline">Versión de prueba activa.</span>
                <a href="/apps/billing/planes" className="ml-2 inline-flex items-center px-2 py-0 rounded-md bg-white/10 hover:bg-white/20 text-white border border-white">
                  Activar plan
                </a>
              </div>
            </div>
          );
        })()}
        <Navbar
          fluid
          className={`rounded-none bg-transparent dark:bg-transparent py-4 sm:px-[15px] px-2 ${
            layoutType == "horizontal" ? "container mx-auto !px-6" : ""
          }  ${isLayout == "full" ? "!max-w-full " : ""}`}
        >
          {/* Mobile Toggle Icon */}
          <span
            onClick={() => setIsMobileSidebarOpen(true)}
            className="h-10 w-10 flex text-black dark:text-white text-opacity-65 xl:hidden hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer"
          >
            <Icon icon="solar:hamburger-menu-line-duotone" height={21} />
          </span>
          {/* Toggle Icon   */}
          <Navbar.Collapse className="xl:block ">
            <div className="flex gap-3 items-center relative">
              {layoutType == "horizontal" ? (
                <div className="me-3">
                  <FullLogo />
                </div>
              ) : null}

              {/* Search and Create Button */}

              <Search />
              {/* Botón Tienda de Apps - DESHABILITADO: Funcionalidad no implementada */}
              {/* <Tooltip content="Tienda de aplicaciones" placement="bottom" className="flowbite-tooltip">
                <a
                  href="/apps/app-store"
                  title="Tienda de Apps"
                  className="h-10 w-10 hover:text-primary hover:bg-lightprimary dark:hover:bg-darkminisidebar  dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-darklink  dark:text-white"
                >
                  <Icon icon="solar:widget-6-bold-duotone" width="20" />
                </a>
              </Tooltip> */}
              <CreateButton />
            </div>
          </Navbar.Collapse>

          {/* mobile-logo */}
          <div className="block xl:hidden">
            <FullLogo />
          </div>

          <Navbar.Collapse className="xl:block hidden">
            <div className="flex gap-3 items-center">
               {/* Widget de Wallet */}
               <WalletWidget />

              {/* Calendar Button */}
              <Tooltip content="Calendario" placement="bottom" className="flowbite-tooltip">
                <a
                  href="/apps/calendar"
                  title="Calendario"
                  className="h-10 w-10 hover:text-primary hover:bg-lightprimary dark:hover:bg-darkminisidebar dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-darklink dark:text-white"
                >
                  <Icon icon="solar:calendar-bold-duotone" width="20" />
                </a>
              </Tooltip>

              {/* Theme Toggle */}

              {/* Light Mode Button */}
              {activeMode === "light" ? (
                <div
                  className="h-10 w-10 hover:text-primary hover:bg-lightprimary dark:hover:bg-darkminisidebar  dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-darklink  dark:text-white"
                  onClick={toggleMode}
                >
                  <span className="flex items-center">
                    <Icon icon="solar:moon-line-duotone" width="20" />
                  </span>
                </div>
              ) : (
                // Dark Mode Button
                <div
                  className="h-10 w-10 hover:text-primary hover:bg-lightprimary dark:hover:bg-darkminisidebar  dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-darklink  dark:text-white"
                  onClick={toggleMode}
                >
                  <span className="flex items-center">
                    <Icon icon="solar:sun-bold-duotone" width="20" />
                  </span>
                </div>
              )}

              {/* Notification Dropdown */}
              <Notifications />

              {/* Profile Dropdown */}
              <Profile />
            </div>
          </Navbar.Collapse>
          {/* Mobile Toggle Icon */}
          <span
            className="h-10 w-10 flex xl:hidden hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer"
            onClick={handleMobileMenu}
          >
            <Icon icon="tabler:dots" height={21} />
          </span>
        </Navbar>
        <div
          className={`w-full  xl:hidden block mobile-header-menu ${mobileMenu}`}
        >
          <MobileHeaderItems />
        </div>

        {/* Horizontal Menu  */}
        {layoutType == "horizontal" ? (
          <div className="xl:border-t xl:border-ld">
            <div
              className={`${isLayout == "full" ? "w-full px-6" : "container"}`}
            >
              <HorizontalMenu />
            </div>
          </div>
        ) : null}
      </header>

      {/* Mobile Sidebar */}
      <Drawer open={isMobileSidebarOpen} onClose={handleClose} className="w-130">
        <Drawer.Items>
          <MobileSidebar />
        </Drawer.Items>
      </Drawer>
    </>
  );
};

export default Header;
