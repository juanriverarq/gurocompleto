import { useState, useEffect } from "react";
import "flowbite";
import { Navbar, Button } from "flowbite-react";
import MobileDrawer from "./MobileDrawer";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import { Link } from "react-router";

const Header = () => {
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

  return (
    <>
      <header
        className={`sticky top-0 z-50 ${
          isSticky
            ? "bg-white dark:bg-dark shadow-md "
            : "bg-white dark:bg-dark"
        }`}
      >
        <Navbar className="fluid py-6">
          <FullLogo />
          <MobileDrawer/>
          <Navbar.Collapse className="xl:block hidden">
            <Navbar.Link href="#funciones" className="rounded-md hover:text-primary">
              Funciones
            </Navbar.Link>
            <Navbar.Link href="#caracteristicas" className="rounded-md hover:text-primary">
              Características
            </Navbar.Link>
            <Navbar.Link href="#testimonios" className="rounded-md hover:text-primary">
              Testimonios
            </Navbar.Link>
            <Navbar.Link href="#precios" className="rounded-md hover:text-primary">
              Precios
            </Navbar.Link>
            <Navbar.Link href="#faq" className="rounded-md hover:text-primary">
              FAQ
            </Navbar.Link>
            <div className="flex items-center gap-3 ml-4">
              <Navbar.Link
                as={Link}
                to="/auth/auth1/login"
                className="text-primary hover:text-primaryemphasis font-medium"
              >
                Iniciar Sesión
              </Navbar.Link>
              <Button
                as={Link}
                to="/auth/auth1/register"
                color="primary"
                size="sm"
                className="px-4"
              >
                Comenzar Gratis
              </Button>
            </div>
          </Navbar.Collapse>
        </Navbar>
      </header>
    </>
  );
};

export default Header;
