import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import Lottie from 'lottie-react';
import SyncButton from './SyncButton';
import guroLogoAnimation from 'src/assets/LOTTIE.json';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from 'src/config/firebase';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const displayName = user?.displayName || user?.email?.split('@')[0] || '';
  const firstName = displayName.split(' ')[0];

  const navLinks = useMemo(() => {
    const prefix = isHome ? '' : '/';
    return [
      { name: 'Producto', href: `${prefix}#caracteristicas` },
      { name: 'Herramientas', href: `${prefix}#herramientas` },
      { name: 'Resultados', href: `${prefix}#resultados` },
      { name: 'Precios', href: `${prefix}#precios` },
      { name: 'Testimonios', href: `${prefix}#testimonios` },
    ];
  }, [isHome]);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring' as const, stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-gray-900/80 backdrop-blur-2xl shadow-lg'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            {/* Logo — Lottie animated */}
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

            {/* Center pill with nav links — like Creatify */}
            <div className="hidden lg:flex items-center bg-white/10 backdrop-blur-md rounded-full px-1.5 py-1.5">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="px-4 py-1.5 text-[13px] font-medium text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-all duration-200 tracking-wide"
                >
                  {link.name}
                </a>
              ))}
            </div>

            {/* Right side — auth-aware */}
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
                <a
                  href="/apps"
                  className="group relative inline-flex items-center bg-[#0d0d0d] rounded-xl h-[44px] overflow-hidden"
                >
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
                    <span className="text-[11px] font-bold text-white uppercase tracking-[0.15em] whitespace-nowrap">
                      Ingresar
                    </span>
                  </a>
                  <SyncButton href="/comenzar" size="sm">Crear cuenta</SyncButton>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 rounded-lg"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Icon
                icon={isMobileMenuOpen ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'}
                className="w-6 h-6 text-white"
              />
            </button>
          </div>
        </div>
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
            <div className="bg-[#1a1a2e]/95 backdrop-blur-2xl shadow-2xl mx-4 rounded-2xl p-4 border border-white/10">
              <div className="flex flex-col gap-1">
                {navLinks.map((link, index) => (
                  <motion.a
                    key={link.name}
                    href={link.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="px-4 py-3 text-white/70 font-medium rounded-xl hover:bg-white/10 hover:text-white transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </motion.a>
                ))}
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
