import { Icon } from '@iconify/react';
import Lottie from 'lottie-react';
import guroLogoAnimation from 'src/assets/LOTTIE.json';
import SyncButton from './SyncButton';

const Footer = () => {

  const columns = [
    {
      title: 'Producto',
      links: [
        { name: 'Gestión de Pólizas', href: '#caracteristicas' },
        { name: 'Asistente IA', href: '#caracteristicas' },
        { name: 'CRM de Ventas', href: '#caracteristicas' },
        { name: 'Reportes', href: '#resultados' },
        { name: 'Herramientas', href: '#herramientas' },
      ],
    },
    {
      title: 'Soluciones',
      links: [
        { name: 'Agentes independientes', href: '#precios' },
        { name: 'Agencias', href: '#precios' },
        { name: 'Corredores', href: '#precios' },
        { name: 'Aseguradoras', href: 'https://wa.me/573105360658' },
      ],
    },
    {
      title: 'Recursos',
      links: [
        { name: 'Centro de ayuda', href: 'mailto:soporte@guro.co' },
        { name: 'Blog', href: '/blog' },
        { name: 'Comenzar', href: '/comenzar' },
        { name: 'Iniciar sesión', href: '/auth/login' },
      ],
    },
    {
      title: 'Empresa',
      links: [
        { name: 'Sobre nosotros', href: '#resultados' },
        { name: 'Contacto', href: 'https://wa.me/573105360658' },
        { name: 'Testimonios', href: '#testimonios' },
        { name: 'Precios', href: '#precios' },
      ],
    },
  ];

  const socialLinks = [
    { icon: 'mdi:linkedin', href: 'https://www.linkedin.com/company/gurotecnologia' },
    { icon: 'mdi:instagram', href: 'https://www.instagram.com/guro.tecnologia/' },
  ];

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <>
    <footer className="bg-transparent text-white">
      {/* Main footer content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        {/* Top row — brand + CTA */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-14 pb-10 border-b border-white/20">
          <div className="flex items-center gap-4">
            <a href="/" onClick={scrollToTop}>
              <div style={{ width: 120, height: 50, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lottie
                  animationData={guroLogoAnimation}
                  loop
                  autoplay
                  style={{ width: 280, height: 280, flexShrink: 0 }}
                />
              </div>
            </a>
            <p className="text-white/70 text-sm max-w-[280px] leading-relaxed hidden sm:block">
              El software de seguros más inteligente de Latinoamérica.
            </p>
          </div>
          <SyncButton href="/comenzar" size="sm">Comenzar</SyncButton>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-14">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] font-bold text-white/90 uppercase tracking-[0.15em] mb-5">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      target={link.href.startsWith('http') || link.href.startsWith('mailto') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-sm text-white/60 hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Social + newsletter row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-10 border-b border-white/20">
          <div className="flex gap-3">
            {socialLinks.map((s) => (
              <a
                key={s.icon}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200"
              >
                <Icon icon={s.icon} className="w-5 h-5" />
              </a>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-2 text-sm text-white/50">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:shield-check-bold" className="w-4 h-4 text-[#573CFF]" />
              <span>SOC 2 Compliant</span>
            </div>
            <span className="hidden sm:inline mx-1">·</span>
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:lock-bold" className="w-4 h-4 text-[#573CFF]" />
              <span>SSL Encrypted</span>
            </div>
            <span className="hidden sm:inline mx-1">·</span>
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:server-bold" className="w-4 h-4 text-[#573CFF]" />
              <span>99.9% Uptime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-white/40">© {new Date().getFullYear()} Guro. Todos los derechos reservados.</p>
        <div className="flex items-center gap-5 text-xs text-white/40">
          <a href="/terminos-condiciones" className="hover:text-white transition-colors">Términos</a>
          <a href="/politica-privacidad" className="hover:text-white transition-colors">Privacidad</a>
          <a href="/politica-privacidad" className="hover:text-white transition-colors">Cookies</a>
          <a href="/trabaja-con-nosotros" className="hover:text-white transition-colors">Trabaja con Nosotros</a>
          <button onClick={scrollToTop} className="hover:text-white transition-colors flex items-center gap-1">
            <Icon icon="solar:arrow-up-linear" className="w-3 h-3" />
            Volver arriba
          </button>
        </div>
      </div>
    </footer>

    </>
  );
};

export default Footer;
