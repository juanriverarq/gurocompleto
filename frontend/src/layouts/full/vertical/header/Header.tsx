import  { useState, useContext } from "react";
import { usePWAInstall } from 'src/hooks/usePWAInstall';
import { Navbar, Tooltip } from "flowbite-react";
import { useUnifiedAuth } from "src/context/UnifiedAuthContext";
import Search from "./Search";
import { Icon } from "@iconify/react";
import CreateButton from "./CreateButton";
import Notifications from "./Notifications";
import WhatsAppInboxButton from "./WhatsAppInboxButton";
import Profile from "./Profile";
import FullLogo from "../../shared/logo/FullLogo";
import MobileHeaderItems from "./MobileHeaderItems";
import { Drawer } from "flowbite-react";
import MobileSidebar from "../sidebar/MobileSidebar";
import HorizontalMenu from "../../horizontal/header/HorizontalMenu";
import { CustomizerContext } from "../../../../context/CustomizerContext";
import { DashboardContext } from "src/context/DashboardContext/DashboardContext";
import WalletWidget from "../../../../components/WalletWidget/WalletWidget";
import InsurerStatus from "./InsurerStatus";
import FloatingAssistant from "../../../../components/FloatingAssistant/FloatingAssistant";

interface HeaderPropsType {
  layoutType: string;
}

const Header = ({ layoutType }: HeaderPropsType) => {
  // Header is static (not sticky)

  const {  isLayout, activeMode, setActiveMode } =
    useContext(CustomizerContext);

  const toggleTheme = () => {
    setActiveMode(activeMode === 'dark' ? 'light' : 'dark');
  };

    const {isMobileSidebarOpen,setIsMobileSidebarOpen} = useContext(DashboardContext);

  const [mobileMenu, setMobileMenu] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const { canInstall, install } = usePWAInstall();
  const { tenant, trialEndsAt } = useUnifiedAuth();

  const isTrialActive = () => {
    const status = (tenant as any)?.status || (tenant as any)?.estado;
    if (!status) return false;
    const normalized = String(status).toLowerCase();
    return normalized === 'trial' || normalized === 'en_trial' || normalized === 'prueba' || normalized === 'trial_active';
  };

  const isSubscriptionActive = () => {
    const status = (tenant as any)?.status || (tenant as any)?.estado;
    if (!status) return false;
    const normalized = String(status).toLowerCase();
    return normalized === 'active' || normalized === 'activo';
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

  const getSubscriptionDaysLeft = () => {
    try {
      if (!tenant || !isSubscriptionActive()) return null;
      const endsSource = (tenant as any)?.subscription_ends_at || null;
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

  // mobile-sidebar
  const handleClose = () => setIsMobileSidebarOpen(false);

  const openAssistant = () => {
    setHelpOpen(false);
    document.getElementById('guro-open-assistant')?.click();
  };

  // Función para manejar el botón de referidos (ya no se usa, pero se mantiene por compatibilidad)
  const handleReferralClick = () => {
    // Aquí se puede agregar la lógica para mostrar un modal de referidos
  };

  return (
    <>
      <header
        className={`z-[1] bg-transparent dark:bg-transparent`}
      >
        {/* Banner superior de trial o suscripción */}
        {(() => {
          // Primero verificar si está en trial
          if (isTrialActive()) {
            const days = getTrialDaysLeft();
            if (typeof days === 'number') {
              const isUrgent = days <= 2;
              
              return (
                <div className="w-full relative z-[10] overflow-hidden" style={{ fontFamily: "'General Sans', sans-serif" }}>
                  {/* Background image */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: isUrgent
                        ? undefined
                        : 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
                      backgroundSize: '160%',
                      backgroundPosition: 'center',
                      transform: 'rotate(180deg)',
                      backgroundColor: isUrgent ? '#dc2626' : undefined,
                    }}
                  />
                  <div className={`relative z-10 mx-auto ${isLayout == "full" ? "w-full px-4" : "container"} py-1 flex items-center justify-center gap-3`}>
                    <span className="text-white/80 text-xs font-medium hidden sm:inline">
                      {isUrgent ? '¡Tu prueba está por terminar!' : 'Versión de prueba'}
                    </span>
                    <span className="text-white text-xs font-bold bg-white/15 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                      {days} {days === 1 ? 'día' : 'días'}
                    </span>
                    <a href="/apps/billing/planes" className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white text-[#0d0d0d] text-[11px] font-bold hover:bg-white/90 transition-all">
                      Activar plan
                    </a>
                  </div>
                </div>
              );
            }
            // Si no pudimos calcular días, igualmente mostrar CTA de trial activo
            return (
              <div className="w-full relative z-[10] overflow-hidden" style={{ fontFamily: "'General Sans', sans-serif" }}>
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
                    backgroundSize: '160%',
                    backgroundPosition: 'center',
                    transform: 'rotate(180deg)',
                  }}
                />
                <div className={`relative z-10 mx-auto ${isLayout == "full" ? "w-full px-4" : "container"} py-1 flex items-center justify-center gap-3`}>
                  <span className="text-white/80 text-xs font-medium hidden sm:inline">Versión de prueba activa</span>
                  <a href="/apps/billing/planes" className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white text-[#0d0d0d] text-[11px] font-bold hover:bg-white/90 transition-all">
                    Activar plan
                  </a>
                </div>
              </div>
            );
          }
          
          // Si tiene suscripción activa, verificar si está próxima a vencer (5 días o menos)
          if (isSubscriptionActive()) {
            const days = getSubscriptionDaysLeft();
            if (typeof days === 'number' && days <= 5) {
              const isUrgent = days <= 1;
              
              const message = days === 0 
                ? '¡Tu suscripción vence hoy!'
                : days === 1 
                  ? 'Tu suscripción vence mañana'
                  : `Tu próximo pago es en ${days} días`;
              
              return (
                <div className="w-full relative z-[10] overflow-hidden" style={{ fontFamily: "'General Sans', sans-serif" }}>
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: isUrgent
                        ? undefined
                        : 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
                      backgroundSize: '160%',
                      backgroundPosition: 'center',
                      transform: 'rotate(180deg)',
                      backgroundColor: isUrgent ? '#dc2626' : undefined,
                    }}
                  />
                  <div className={`relative z-10 mx-auto ${isLayout == "full" ? "w-full px-4" : "container"} py-1 flex items-center justify-center gap-3`}>
                    <span className="text-white text-xs font-medium">{message}</span>
                    <a href="/apps/billing/suscripcion" className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white text-[#0d0d0d] text-[11px] font-bold hover:bg-white/90 transition-all">
                      Ver detalles
                    </a>
                  </div>
                </div>
              );
            }
          }
          
          return null;
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
            className="h-10 w-10 flex text-gray-500 xl:hidden hover:text-[#573CFF] hover:bg-[#573CFF]/10 rounded-xl justify-center items-center cursor-pointer transition-colors"
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
              <div className="relative">
                <Tooltip content="Ayuda" placement="bottom" className="flowbite-tooltip">
                  <button
                    type="button"
                    onClick={() => setHelpOpen((v) => !v)}
                    aria-label="Abrir ayuda"
                    className="h-10 w-10 hover:text-[#573CFF] hover:bg-[#573CFF]/10 focus:ring-0 rounded-xl flex justify-center items-center cursor-pointer text-gray-500 dark:text-gray-300 transition-colors"
                  >
                    <Icon icon="solar:question-circle-bold-duotone" width="22" />
                  </button>
                </Tooltip>
                {helpOpen && (
                  <div className="absolute right-0 top-12 z-[1000] w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-[#111111]">
                    <button
                      type="button"
                      onClick={openAssistant}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                    >
                      <Icon icon="solar:chat-round-dots-bold-duotone" width={18} className="text-[#573CFF]" />
                      Asistente virtual
                    </button>
                    <a
                      href="/apps/whatsapp"
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                      onClick={() => setHelpOpen(false)}
                    >
                      <Icon icon="solar:phone-calling-rounded-bold-duotone" width={18} className="text-emerald-500" />
                      WhatsApp
                    </a>
                    <a
                      href="/tutoriales"
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                      onClick={() => setHelpOpen(false)}
                    >
                      <Icon icon="solar:video-library-bold-duotone" width={18} className="text-orange-500" />
                      Tutoriales
                    </a>
                    {canInstall && (
                      <>
                        <div className="border-t border-gray-100 dark:border-neutral-800 mx-3" />
                        <button
                          type="button"
                          onClick={() => { setHelpOpen(false); install(); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                        >
                          <Icon icon="solar:monitor-smartphone-bold-duotone" width={18} className="text-[#573CFF]" />
                          <span>
                            Instalar app en escritorio
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <FloatingAssistant variant="topbar" trigger="none" />

               {/* Widget de Wallet */}
               <WalletWidget />

              {/* Calendar Button */}
              <Tooltip content="Calendario" placement="bottom" className="flowbite-tooltip">
                <a
                  href="/apps/calendar"
                  title="Calendario"
                  className="h-10 w-10 hover:text-[#573CFF] hover:bg-[#573CFF]/10 focus:ring-0 rounded-xl flex justify-center items-center cursor-pointer text-gray-500 dark:text-gray-300 transition-colors"
                >
                  <Icon icon="solar:calendar-bold-duotone" width="20" />
                </a>
              </Tooltip>

              {/* Theme toggle (claro / oscuro) */}
              <Tooltip
                content={activeMode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                placement="bottom"
                className="flowbite-tooltip"
              >
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label="Cambiar tema"
                  className="h-10 w-10 hover:text-[#573CFF] hover:bg-[#573CFF]/10 focus:ring-0 rounded-xl flex justify-center items-center cursor-pointer text-gray-500 dark:text-gray-300 transition-colors"
                >
                  <Icon
                    icon={activeMode === 'dark' ? 'solar:sun-bold-duotone' : 'solar:moon-bold-duotone'}
                    width="20"
                  />
                </button>
              </Tooltip>

              {/* Estado de conexiones y sincronizaciones */}
              <InsurerStatus />

              {/* WhatsApp Inbox Button */}
              <WhatsAppInboxButton />

              {/* Notification Dropdown */}
              <Notifications />

              {/* Profile Dropdown */}
              <Profile />
            </div>
          </Navbar.Collapse>
          {/* Mobile Toggle Icon */}
          <span
            className="h-10 w-10 flex xl:hidden hover:text-[#573CFF] hover:bg-[#573CFF]/10 rounded-xl justify-center items-center cursor-pointer text-gray-500 transition-colors"
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
