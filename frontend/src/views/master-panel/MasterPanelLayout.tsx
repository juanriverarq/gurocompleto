import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Icon as IconifyIcon } from '@iconify/react';
import { Tooltip } from 'flowbite-react';
import masterPanelService, { MasterUser } from '../../services/masterPanelService';

const MasterPanelLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<MasterUser | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!masterPanelService.isAuthenticated()) {
      navigate('/master-panel/login');
      return;
    }
    setUser(masterPanelService.getStoredUser());
  }, [navigate]);

  const handleLogout = async () => {
    await masterPanelService.logout();
    navigate('/master-panel/login');
  };

  const menuItems = [
    { path: '/master-panel/dashboard', icon: 'solar:chart-2-bold-duotone', label: 'Dashboard', tooltip: 'Dashboard' },
    { path: '/master-panel/brokers', icon: 'solar:buildings-2-bold-duotone', label: 'Brokers', tooltip: 'Gestión de Brokers' },
    { path: '/master-panel/usuarios', icon: 'solar:users-group-two-rounded-bold-duotone', label: 'Usuarios', tooltip: 'Usuarios Globales' },
    { path: '/master-panel/soporte', icon: 'solar:chat-round-call-bold-duotone', label: 'Soporte', tooltip: 'Centro de Soporte' },
    { path: '/master-panel/facturacion', icon: 'solar:bill-list-bold-duotone', label: 'Facturación', tooltip: 'Facturación y Pagos' },
    { path: '/master-panel/finanzas', icon: 'solar:wallet-bold-duotone', label: 'Finanzas', tooltip: 'Finanzas y Wallets' },
    { path: '/master-panel/llamadas', icon: 'solar:phone-calling-bold-duotone', label: 'Voz AI', tooltip: 'Llamadas de Voz AI' },
    { path: '/master-panel/campanas', icon: 'solar:chat-round-dots-bold-duotone', label: 'Campañas', tooltip: 'Campañas y Automatización' },
    { path: '/master-panel/configuracion', icon: 'solar:settings-bold-duotone', label: 'Config', tooltip: 'Configuración' },
    { path: '/master-panel/logs', icon: 'solar:code-bold-duotone', label: 'Logs', tooltip: 'Logs del Sistema' },
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-darkgray">
      {/* Mobile Header */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-dark border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <IconifyIcon icon={mobileMenuOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-line-duotone'} className="w-6 h-6 text-gray-700 dark:text-white" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/src/assets/images/logos/Logo.svg" alt="Guro" className="h-8" />
        </div>
        <div className="w-10" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="xl:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mini Icon Sidebar (Desktop) */}
      <aside className={`hidden xl:flex fixed top-0 left-0 z-40 h-screen flex-col bg-white dark:bg-dark border-e border-gray-200 dark:border-gray-700 ${sidebarCollapsed ? 'w-[70px]' : 'w-[70px]'}`}>
        {/* Toggle Button */}
        <div className="p-4 flex justify-center border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <IconifyIcon icon="solar:hamburger-menu-line-duotone" className="w-6 h-6 text-gray-700 dark:text-white" />
          </button>
        </div>

        {/* Menu Icons */}
        <div className="flex-1 py-4 flex flex-col items-center gap-2">
          {menuItems.map((item) => (
            <Tooltip key={item.path} content={item.tooltip} placement="right">
              <Link
                to={item.path}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  isActive(item.path)
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary'
                }`}
              >
                <IconifyIcon icon={item.icon} className="w-6 h-6" />
              </Link>
            </Tooltip>
          ))}
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Tooltip content="Cerrar Sesión" placement="right">
            <button
              onClick={handleLogout}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-all"
            >
              <IconifyIcon icon="solar:logout-2-bold-duotone" className="w-6 h-6" />
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Full Sidebar (Desktop) */}
      <aside className={`hidden xl:block fixed top-0 z-30 h-screen bg-white dark:bg-darkgray border-e border-gray-200 dark:border-gray-700 transition-all duration-300 ${sidebarCollapsed ? 'left-[70px] w-0 overflow-hidden' : 'left-[70px] w-[250px]'}`}>
        {/* Logo */}
        <div className="px-6 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
          <Link to="/master-panel/dashboard" className="flex items-center gap-2">
            <img src="/src/assets/images/logos/Logo.svg" alt="Guro" className="h-10" />
          </Link>
        </div>

        {/* Menu */}
        <div className="py-4 px-4 h-[calc(100vh-140px)] overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">Panel Master</p>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <IconifyIcon icon={item.icon} className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* User Info */}
        {user && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-darkgray">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar */}
      <aside className={`xl:hidden fixed top-14 left-0 z-40 h-[calc(100vh-56px)] w-72 bg-white dark:bg-dark border-e border-gray-200 dark:border-gray-700 transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="px-6 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
          <img src="/src/assets/images/logos/Logo.svg" alt="Guro" className="h-10" />
        </div>

        {/* Menu */}
        <div className="py-4 px-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">Panel Master</p>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <IconifyIcon icon={item.icon} className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* User Info & Logout */}
        {user && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors"
            >
              <IconifyIcon icon="solar:logout-2-bold-duotone" className="w-5 h-5" />
              <span className="text-sm font-medium">Cerrar Sesión</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'xl:ml-[70px]' : 'xl:ml-[320px]'}`}>
        {/* Top Bar */}
        <header className="bg-white dark:bg-dark border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 mt-14 xl:mt-0">
          <div className="px-4 lg:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-md flex-1">
                <IconifyIcon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar brokers, usuarios..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <IconifyIcon icon="solar:bell-bold-duotone" className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {user && (
                <div className="hidden md:flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                    {user.name.charAt(0)}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.name}</p>
                    <p className="text-xs text-gray-500">Superadmin</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MasterPanelLayout;
