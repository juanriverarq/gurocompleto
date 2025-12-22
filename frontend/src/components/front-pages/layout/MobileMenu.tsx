import  { useState } from "react";
import { Button, Drawer } from "flowbite-react";
import { IconMenu2 } from "@tabler/icons-react";
import Navigation from "./Navigation";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import { Link } from "react-router";

const MobileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => setIsOpen(false);
  
  return (
    <>
      <div className="xl:hidden flex">
        <Button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center text-dark  h-10 w-10 rounded-full bg-transparent hover:bg-lightprimary"
        >
          <IconMenu2 />
        </Button>
      </div>
      <Drawer open={isOpen} onClose={handleClose} className="h-full">
        <Drawer.Items className="p-6">
          <div className="mb-8">
            <FullLogo />
          </div>
          <div className="mb-8">
            <Navigation />
          </div>
          <div className="flex flex-col gap-4 mt-auto">
            <Button
              as={Link}
              to="/auth/auth1/login"
              className="font-bold w-full py-3"
              color={"light"}
              onClick={handleClose}
            >
              Iniciar Sesión
            </Button>
            <Button
              as={Link}
              to="/comenzar"
              className="font-bold w-full py-3"
              color={"primary"}
              onClick={handleClose}
            >
              Prueba 7 Días Gratis
            </Button>
          </div>
        </Drawer.Items>
      </Drawer>
    </>
  );
};

export default MobileMenu;
