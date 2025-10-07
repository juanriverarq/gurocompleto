import Banner1 from "/src/assets/images/landingpage/background/bannerimg1.png";
import Banner2 from "/src/assets/images/landingpage/background/bannerimg2.png";
import { Button } from "flowbite-react";
import { IconShield } from "@tabler/icons-react";
import { Link } from "react-router";
import { useState } from "react";
import VideoDemoModal from "@/components/landingpage/VideoDemoModal";
const banner = () => {
  const [openDemo, setOpenDemo] = useState(false);
  return (
    <>
      <VideoDemoModal open={openDemo} onClose={() => setOpenDemo(false)} />
      <div className="bg-lightgray dark:bg-darkgray relative overflow-hidden">
        <div className="container relative">
          <div className="grid grid-cols-12 gap-6 items-center">
            <div className="xl:col-span-6 col-span-12 xl:py-0 py-12 xl:px-0 sm:px-6 px-3">
              <h6
                className="flex items-center gap-2 text-base opacity-80 mb-3"
                data-aos="fade-up"
                data-aos-delay="200"
                data-aos-duration="1000"
              >
                <IconShield className="text-secondary" size={17} /> El futuro de
                la gestión de seguros
              </h6>
              <h1
                className="font-bold mb-7 sm:text-40 text-3xl sm:leading-[55px]"
                data-aos="fade-up"
                data-aos-delay="400"
                data-aos-duration="1000"
              >
                Software de Seguros con{" "}
                <span className="text-primary">Inteligencia Artificial</span>{" "}
                para tu Agencia
              </h1>
              <p
                data-aos="fade-up"
                data-aos-delay="600"
                data-aos-duration="1000"
                className="text-ld text-lg"
              >
                Guro es el software de seguros más avanzado con inteligencia artificial. 
                Transforma tu agencia de seguros con automatización inteligente, gestión 
                de pólizas, procesamiento de siniestros, CRM y análisis predictivo.
              </p>
              <div
                className="sm:flex gap-3 mt-8"
                data-aos="fade-up"
                data-aos-delay="800"
                data-aos-duration="1000"
              >
                <Button
                  as={Link}
                  to="/auth/auth1/login"
                  size={"lg"}
                  color={"primary"}
                  className="sm:mb-0 mb-3"
                >
                  Iniciar Sesión
                </Button>
                <button onClick={() => setOpenDemo(true)} type="button" className="group relative flex items-stretch justify-center p-0.5 text-center font-medium border border-primary bg-transparent text-primary hover:bg-primary dark:hover:bg-primary hover:text-white rounded-md" data-discover="true"><span className="flex items-center gap-2 transition-all duration-150 justify-center rounded-md px-9 py-2.5 text-sm">Ver Demo</span></button>
              </div>
            </div>
            <div className="lg:col-span-6 col-span-12 xl:block hidden">
              <div className="bannerSlider">
                <div className="flex flex-row">
                  <div>
                    <div className="animateUp">
                      <img src={Banner1} alt="Software de seguros Guro - Dashboard de gestión de pólizas con inteligencia artificial" />
                    </div>
                    <div className="animateUp">
                      <img src={Banner1} alt="Agencia de seguros digital - Plataforma Guro con IA para automatización" />
                    </div>
                  </div>
                  <div>
                    <div className="animateDown">
                      <img src={Banner2} alt="Guro IA - Software de seguros para gestión de siniestros y análisis predictivo" />
                    </div>
                    <div className="animateDown">
                      <img src={Banner2} alt="Inteligencia artificial en seguros - CRM y cotizaciones automáticas con Guro" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default banner;
