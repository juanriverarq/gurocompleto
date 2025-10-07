import Logo from "src/layouts/full/shared/logo/Logo";
import { Link } from "react-router";

const Footer = () => {
  return (
    <>
      <div className="bg-white dark:bg-dark">
        <div className="container">
          <div className="py-10 text-center">
            <div className="flex justify-center mb-4">
              <Logo />
            </div>
            <div className="mb-4">
              <nav className="flex justify-center space-x-4">
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
