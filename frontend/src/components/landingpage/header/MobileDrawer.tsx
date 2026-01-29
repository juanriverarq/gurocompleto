import { useState } from "react";
import { Button, Drawer } from "flowbite-react";
import { IconMenu2 } from "@tabler/icons-react";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import { Link } from "react-router";

const MobileDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => setIsOpen(false);

  const menuItems = [
    { name: "Funciones", href: "#funciones", isLink: false },
    { name: "Características", href: "#caracteristicas", isLink: false },
    { name: "Testimonios", href: "#testimonios", isLink: false },
    { name: "Blog", href: "/blog", isLink: true },
    { name: "Precios", href: "/precios", isLink: true },
    { name: "FAQ", href: "#faq", isLink: false }
  ];

  return (
    <>
      <div className="xl:hidden flex">
        <Button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center text-dark h-10 w-10 rounded-full bg-transparent hover:bg-lightprimary"
          aria-label="Abrir menú de navegación"
        >
          <IconMenu2 aria-hidden="true" />
        </Button>
      </div>
      <Drawer open={isOpen} onClose={handleClose} className="h-full" aria-label="Menú de navegación principal">
        <Drawer.Items className="p-6">
          <FullLogo />
          
          <div className="mt-8">
            <nav className="space-y-2">
              {menuItems.map((item, index) => (
                item.isLink ? (
                  <Link
                    key={index}
                    to={item.href}
                    onClick={handleClose}
                    className="block py-3 px-2 text-base text-dark dark:text-white font-medium hover:text-primary hover:bg-lightprimary rounded-md transition-colors"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <a
                    key={index}
                    href={item.href}
                    onClick={handleClose}
                    className="block py-3 px-2 text-base text-dark dark:text-white font-medium hover:text-primary hover:bg-lightprimary rounded-md transition-colors"
                  >
                    {item.name}
                  </a>
                )
              ))}
            </nav>
          </div>

          <div className="mt-8 space-y-3">
            <Button
              color={"light"}
              className="w-full"
              as={Link}
              to="/auth/auth1/login"
              onClick={handleClose}
            >
              Iniciar Sesión
            </Button>
            <Button
              color={"primary"}
              className="w-full"
              as={Link}
              to="/comenzar"
              onClick={handleClose}
            >
              Prueba 7 Días Gratis
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              ¿Necesitas ayuda?
            </p>
            <p className="text-sm text-center mt-2">
              <a 
                href="mailto:soporte@guro.co" 
                className="text-primary hover:underline"
                onClick={handleClose}
              >
                Contáctanos
              </a>
            </p>
          </div>
        </Drawer.Items>
      </Drawer>
    </>
  );
};

export default MobileDrawer;
