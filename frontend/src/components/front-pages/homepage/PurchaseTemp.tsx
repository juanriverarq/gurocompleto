import Logo from "src/layouts/full/shared/logo/Logo";
import { Button } from "flowbite-react";
import { Link } from "react-router";
import { useState } from "react";
import VideoDemoModal from "@/components/landingpage/VideoDemoModal";
 
const PurchaseTemp = () => {
  const [openDemo, setOpenDemo] = useState(false);
  return (
    <>
      <VideoDemoModal open={openDemo} onClose={() => setOpenDemo(false)} />
      <div className="bg-primary lg:py-24 py-12">
        <div className="container-1218 mx-auto relative z-1">
          <div className="flex flex-col items-center justify-center text-center ">
            <div className="h-14 w-14 rounded-tw flex justify-center items-center bg-white shadow-elevation4">
              <Logo />
            </div>
            <h3 className="sm:text-44 text-3xl font-bold !leading-[48px] text-white lg:px-20 py-6">
              ¿Listo para revolucionar tu negocio de seguros?
            </h3>
            <p className="text-lg text-white lg:px-64 leading-8">
              Únete a cientos de profesionales que ya están transformando sus negocios con Guro.
              Comienza tu prueba gratuita de 7 días sin compromiso.
            </p>
            <div className="flex gap-4 mt-8">
              <Button 
                color={"outlinewhite"} 
                as={Link} 
                to="/comenzar" 
                className="px-6 py-3 sm:w-auto w-full font-semibold"
              >
                Probar 7 Días Gratis
              </Button>
              <Button 
                color={"white"}
                onClick={() => setOpenDemo(true)}
                className="px-6 py-3 sm:w-auto w-full font-semibold"
              >
                Ver Demo
              </Button>
            </div>
            <p className="text-sm text-white opacity-80 mt-4">
              No se requiere tarjeta de crédito • Configuración en menos de 5 minutos
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PurchaseTemp;
