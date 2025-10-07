import { Link } from "react-router";
import Banner from "/src/assets/images/landingpage/background/c2a.png";
import { Button } from "flowbite-react";

const LoginReg = () => {
  return (
    <div className="bg-white dark:bg-dark lg:pt-20 pt-8">
      <div className="bg-primary overflow-hidden ">
        <div className="container">
          <div className="lg:flex justify-between items-center">
            <div className="lg:w-1/2 lg:text-start text-center">
              <h2 className="font-bold lg:text-4xl text-3xl text-white mb-7 lg:pt-0 pt-10 sm:!leading-[50px]">
                Revoluciona tu Agencia de Seguros con Software de IA Avanzado
              </h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                Únete a más de 50 agencias de seguros que ya transformaron su negocio con Guro, 
                el software de seguros con inteligencia artificial más completo del mercado. 
                Comienza tu prueba gratuita hoy mismo.
              </p>
              <div className="sm:flex lg:justify-start justify-center gap-4">
                <Button
                  as={Link}
                  to="/auth/auth1/register"
                  color={"white"}
                  className="mb-3 sm:mb-0 px-0"
                  size={"lg"}
                >
                  🚀 Comenzar Prueba Gratuita
                </Button>
                <Button
                  as={Link}
                  to="/apps"
                  color={"outlinewhite"}
                  size={"lg"}
                  className="px-0"
                >
                  Iniciar Sesión
                </Button>
              </div>
              <p className="text-white/70 text-sm mt-4">
                ✓ 14 días gratis • ✓ Sin tarjeta de crédito • ✓ Configuración en 24h
              </p>
            </div>
            <div className="lg:w-[30%]">
              <div className="flex lg:justify-end justify-center">
                <img
                  src={Banner}
                  alt="Guro Dashboard"
                  className="w-auto lg:ms-auto  pt-7"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginReg;
