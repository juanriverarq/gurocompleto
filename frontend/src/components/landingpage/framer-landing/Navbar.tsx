import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import Lottie from 'lottie-react';
import SyncButton from './SyncButton';
import guroLogoAnimation from 'src/assets/LOTTIE.json';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from 'src/config/firebase';

type LinkItem = { name: string; href: string; desc?: string };
type MenuSection = { title?: string; links: LinkItem[] };
type MegaMenu = { name: string; sections: MenuSection[]; ctaLabel?: string; ctaHref?: string };

const PRODUCTO_MENU: MegaMenu = {
  name: 'Producto',
  sections: [
    {
      title: 'Plataforma',
      links: [
        { name: 'CRM para Corredores', href: '/crm-corredores-seguros', desc: 'Centraliza clientes, pólizas y renovaciones' },
        { name: 'Software para Corredores', href: '/software-corredores-seguros', desc: '9 módulos en una sola plataforma' },
        { name: 'Software para Agencias', href: '/software-agencias-seguros', desc: 'Visibilidad y control para dueños' },
      ],
    },
    {
      title: 'Por módulo',
      links: [
        { name: 'IA para Corredores', href: '/ia-para-corredores-seguros', desc: 'Predicción, voicebots, chatbots' },
        { name: 'WhatsApp Business', href: '/whatsapp-business-corredores-seguros', desc: 'API oficial Meta + chatbots' },
        { name: 'Renovaciones Automáticas', href: '/automatizacion-renovaciones-polizas', desc: 'IA + WhatsApp orquesta vencimientos' },
        { name: 'Liquidación Comisiones', href: '/gestion-comisiones-corredores-seguros', desc: 'Importa corte, concilia automático' },
        { name: 'Cotizador Embebido', href: '/cotizador-embebido-seguros', desc: 'Multi-aseguradora en tu web' },
        { name: 'Gestión Siniestros', href: '/gestion-siniestros-corredor', desc: 'Flujo WhatsApp + plantillas' },
      ],
    },
  ],
  ctaLabel: 'Ver demo',
  ctaHref: '/comenzar',
};

const COMPARATIVAS_MENU: MegaMenu = {
  name: 'Comparativas',
  sections: [
    {
      links: [
        { name: 'Ver todas', href: '/comparar', desc: 'Hub con las 6 comparativas' },
        { name: 'Guro vs ebroker', href: '/comparar/guro-vs-ebroker', desc: 'Líder corredurías España' },
        { name: 'Guro vs Sumavisos', href: '/comparar/guro-vs-sumavisos', desc: 'Tradicional Colombia' },
        { name: 'Guro vs Velneo', href: '/comparar/guro-vs-velneo', desc: 'Low-code generalista' },
        { name: 'Guro vs E2K', href: '/comparar/guro-vs-e2k', desc: 'Consolidado Colombia' },
        { name: 'Guro vs MAC Corredor', href: '/comparar/guro-vs-mac-corredor', desc: 'ERP corredurías LATAM' },
        { name: 'Guro vs HubSpot Insurance', href: '/comparar/guro-vs-hubspot-insurance', desc: 'CRM genérico adaptado' },
      ],
    },
  ],
};

const RECURSOS_MENU: MegaMenu = {
  name: 'Recursos',
  sections: [
    {
      title: 'Para corredores',
      links: [
        { name: 'Blog', href: '/blog', desc: 'Guías, plantillas y casos' },
        { name: 'Plan 90 días digitalización', href: '/blog/plan-90-dias-digitalizar-agencia-seguros' },
        { name: 'Cómo ser corredor en Colombia', href: '/blog/como-ser-corredor-de-seguros-colombia' },
        { name: 'Tabla de comisiones 2026', href: '/blog/tabla-comisiones-corredores-seguros-colombia' },
        { name: 'Glosario 80 términos', href: '/blog/glosario-seguros-corredores-80-terminos' },
      ],
    },
    {
      title: 'Tendencias',
      links: [
        { name: 'Qué es Insurtech', href: '/blog/que-es-insurtech-guia-corredores-latam' },
        { name: 'IA: 12 casos LATAM', href: '/blog/ia-corredores-seguros-12-casos-latam' },
        { name: 'WhatsApp Business para vender', href: '/blog/whatsapp-business-vender-seguros-guia' },
        { name: 'Mejor software corredores LATAM', href: '/blog/mejores-software-corredores-seguros-latam-2026' },
      ],
    },
  ],
};

const MEGA_MENUS: MegaMenu[] = [PRODUCTO_MENU, COMPARATIVAS_MENU, RECURSOS_MENU];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Cerrar mega-menú al cambiar de ruta
  useEffect(() => {
    setOpenMenu(null);
    setIsMobileMenuOpen(false);
    setOpenMobileSection(null);
  }, [location.pathname]);

  const displayName = user?.displayName || user?.email?.split('@')[0] || '';
  const firstName = displayName.split(' ')[0];

  const handleMenuEnter = (name: string) => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenMenu(name);
  };

  const handleMenuLeave = () => {
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 150);
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring' as const, stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? 'bg-gray-900/80 backdrop-blur-2xl shadow-lg' : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            {/* Logo */}
            <a href="/" className="flex items-center flex-shrink-0">
              <div style={{ width: 140, height: 60, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lottie
                  animationData={guroLogoAnimation}
                  loop
                  autoplay
                  style={{ width: 350, height: 350, flexShrink: 0, marginTop: -4 }}
                />
              </div>
            </a>

            {/* Center pill with nav links + mega menus */}
            <div className="hidden lg:flex items-center bg-white/10 backdrop-blur-md rounded-full px-1.5 py-1.5 gap-1">
              {MEGA_MENUS.map((menu) => (
                <div
                  key={menu.name}
                  className="relative"
                  onMouseEnter={() => handleMenuEnter(menu.name)}
                  onMouseLeave={handleMenuLeave}
                >
                  <button
                    type="button"
                    className="px-4 py-1.5 text-[13px] font-medium text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-all duration-200 tracking-wide inline-flex items-center gap-1"
                    aria-haspopup="true"
                    aria-expanded={openMenu === menu.name}
                  >
                    {menu.name}
                    <Icon icon="solar:alt-arrow-down-linear" className={`w-3 h-3 transition-transform ${openMenu === menu.name ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              ))}
              <a
                href="/precios"
                className="px-4 py-1.5 text-[13px] font-medium text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-all duration-200 tracking-wide"
              >
                Precios
              </a>
            </div>

            {/* Right side */}
            <div className="hidden lg:flex items-center gap-4">
              <a
                href="https://wa.me/573105360658?text=Hola%2C%20me%20interesa%20Guro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-white/70 hover:text-white uppercase tracking-[0.15em] transition-colors"
              >
                Contacto con ventas
              </a>

              {user ? (
                <a href="/apps" className="group relative inline-flex items-center bg-[#0d0d0d] rounded-xl h-[44px] overflow-hidden">
                  <span className="absolute inset-y-0 left-0 w-[44px] group-hover:w-full bg-[#573CFF] rounded-xl transition-all duration-300 ease-out" />
                  <span className="relative z-10 flex items-center justify-center w-[44px] h-full flex-shrink-0">
                    <Icon icon="solar:user-circle-bold" className="w-5 h-5 text-white" />
                  </span>
                  <span className="relative z-10 pl-2 pr-4 text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
                    {firstName}
                  </span>
                </a>
              ) : (
                <>
                  <a
                    href="/auth/login"
                    className="inline-flex items-center gap-2 bg-[#0d0d0d] rounded-xl h-[44px] px-4 hover:bg-[#1a1a1a] transition-colors"
                  >
                    <Icon icon="solar:user-circle-bold" className="w-4 h-4 text-white" />
                    <span className="text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">Ingresar</span>
                  </a>
                  <SyncButton href="/comenzar" size="sm">Crear cuenta</SyncButton>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="lg:hidden p-2 rounded-lg" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Icon
                icon={isMobileMenuOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'}
                className="w-6 h-6 text-white"
              />
            </button>
          </div>
        </div>

        {/* Mega-menu desktop dropdowns */}
        <AnimatePresence>
          {openMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="hidden lg:block absolute top-full left-0 right-0 mt-2 px-4"
              onMouseEnter={() => handleMenuEnter(openMenu)}
              onMouseLeave={handleMenuLeave}
            >
              <div className="max-w-[1100px] mx-auto bg-[#0f0f15]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8">
                {(() => {
                  const menu = MEGA_MENUS.find((m) => m.name === openMenu);
                  if (!menu) return null;
                  return (
                    <div className={`grid gap-8 ${menu.sections.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                      {menu.sections.map((section, si) => (
                        <div key={si}>
                          {section.title && (
                            <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] mb-4">{section.title}</h4>
                          )}
                          <ul className="space-y-2">
                            {section.links.map((link) => (
                              <li key={link.href}>
                                <a
                                  href={link.href}
                                  className="block px-4 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors group"
                                >
                                  <div className="text-white font-semibold text-sm group-hover:text-[#9c4dff] transition-colors">{link.name}</div>
                                  {link.desc && <div className="text-white/40 text-xs mt-0.5">{link.desc}</div>}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {menu.ctaHref && (
                        <div className="md:col-span-2 pt-4 border-t border-white/10 flex justify-end">
                          <a
                            href={menu.ctaHref}
                            className="inline-flex items-center gap-2 bg-[#573CFF] hover:bg-[#4530cc] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                          >
                            {menu.ctaLabel}
                            <Icon icon="solar:arrow-right-linear" className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 z-40 lg:hidden"
          >
            <div className="bg-[#1a1a2e]/95 backdrop-blur-2xl shadow-2xl mx-4 rounded-2xl p-4 border border-white/10 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col gap-1">
                {MEGA_MENUS.map((menu) => {
                  const isOpen = openMobileSection === menu.name;
                  return (
                    <div key={menu.name} className="border-b border-white/5 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setOpenMobileSection(isOpen ? null : menu.name)}
                        className="w-full flex items-center justify-between px-4 py-3 text-white font-semibold rounded-xl hover:bg-white/5"
                      >
                        <span>{menu.name}</span>
                        <Icon
                          icon="solar:alt-arrow-down-linear"
                          className={`w-4 h-4 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-3 pb-2 space-y-1">
                              {menu.sections.flatMap((s) => s.links).map((link) => (
                                <a
                                  key={link.href}
                                  href={link.href}
                                  className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg"
                                  onClick={() => setIsMobileMenuOpen(false)}
                                >
                                  {link.name}
                                </a>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                <a
                  href="/precios"
                  className="px-4 py-3 text-white font-semibold rounded-xl hover:bg-white/5"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Precios
                </a>

                <div className="h-px bg-white/10 my-2" />
                {user ? (
                  <a
                    href="/apps"
                    className="flex items-center justify-center gap-3 px-4 py-3 bg-[#573CFF] text-white font-bold rounded-xl text-center text-sm uppercase tracking-wider"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon icon="solar:user-circle-bold" className="w-4 h-4" />
                    {firstName}
                  </a>
                ) : (
                  <>
                    <a
                      href="/auth/login"
                      className="flex items-center justify-center gap-3 px-4 py-3 bg-[#0d0d0d] text-white font-bold rounded-xl text-center text-sm uppercase tracking-wider"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon icon="solar:user-circle-bold" className="w-4 h-4" />
                      Ingresar
                    </a>
                    <a
                      href="/comenzar"
                      className="flex items-center justify-center gap-3 px-4 py-3 bg-[#573CFF] text-white font-bold rounded-xl text-center text-sm uppercase tracking-wider"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
                      Crear cuenta
                    </a>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
