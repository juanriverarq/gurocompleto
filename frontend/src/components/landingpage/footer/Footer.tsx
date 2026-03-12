import Logo from "src/layouts/full/shared/logo/Logo";
import { Link } from "react-router";

const Footer = () => {
  return (
    <>
      <div className="bg-white dark:bg-dark">
        <div className="container px-4">
          <div className="py-8 sm:py-10 text-center">
            <div className="flex justify-center mb-4">
              <Logo />
            </div>
            <div className="mb-4">
              <nav className="flex flex-col sm:flex-row justify-center sm:space-x-4 space-y-2 sm:space-y-0">
                <Link
                  to="/terminos-condiciones"
                  className="text-gray-600 hover:text-primary-ld transition-colors"
                >
                  Términos y Condiciones
                </Link>
                <span className="text-gray-400">|</span>
                <Link
                  to="/politica-privacidad"
                  className="text-gray-600 hover:text-primary-ld transition-colors"
                >
                  Política de Privacidad
                </Link>
                <span className="text-gray-400">|</span>
                <Link
                  to="/trabaja-con-nosotros"
                  className="text-gray-600 hover:text-primary-ld transition-colors"
                >
                  Trabaja con Nosotros
                </Link>
              </nav>
            </div>
            <div>
              <p className="text-ld">
                <span className="opacity-90">
                  © {new Date().getFullYear()} Guro. Todos los derechos reservados.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Footer;
