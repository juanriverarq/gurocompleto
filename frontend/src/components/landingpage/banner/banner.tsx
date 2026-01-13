import Banner1 from "/src/assets/images/landingpage/background/bannerimg1.webp";
import Banner2 from "/src/assets/images/landingpage/background/bannerimg2.webp";
import { Button } from "flowbite-react";
import { IconShield } from "@tabler/icons-react";
import { Link } from "react-router";
import { useState } from "react";
import VideoDemoModal from "src/components/landingpage/VideoDemoModal";
const banner = () => {
  const [openDemo, setOpenDemo] = useState(false);
  return (
    <>
      <VideoDemoModal open={openDemo} onClose={() => setOpenDemo(false)} />
      <div className="bg-lightgray dark:bg-darkgray relative overflow-hidden">
        <div className="container relative">
          <div className="grid grid-cols-12 gap-6 items-center">
            <div className="xl:col-span-6 col-span-12 xl:py-0 py-8 xl:px-0 px-4">
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
                className="font-bold mb-6 sm:text-40 text-2xl sm:leading-[55px] leading-tight"
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
                className="text-ld sm:text-lg text-base leading-relaxed"
              >
                Guro es el software de seguros más avanzado con inteligencia artificial. 
                Transforma tu agencia de seguros con automatización inteligente, gestión 
                de pólizas, procesamiento de siniestros, CRM y análisis predictivo.
              </p>
              <div
                className="flex flex-col sm:flex-row gap-3 mt-6"
                data-aos="fade-up"
                data-aos-delay="800"
                data-aos-duration="1000"
              >
                <Button
                  as={Link}
                  to="/comenzar"
                  size={"lg"}
                  color={"primary"}
                  className="w-full sm:w-auto"
                >
                  Prueba 7 Días Gratis
                </Button>
                <button onClick={() => setOpenDemo(true)} type="button" className="w-full sm:w-auto group relative flex items-stretch justify-center p-0.5 text-center font-medium border border-primary bg-transparent text-primary hover:bg-primary dark:hover:bg-primary hover:text-white rounded-md" data-discover="true"><span className="flex items-center gap-2 transition-all duration-150 justify-center rounded-md px-9 py-2.5 text-sm">Ver Demo</span></button>
              </div>
            </div>
            <div className="lg:col-span-6 col-span-12 xl:block hidden">
              <div className="bannerSlider">
                <div className="flex flex-row">
                  <div>
                    <div className="animateUp">
                      <img 
                        src={Banner1} 
                        alt="Software de seguros Guro - Dashboard de gestión de pólizas con inteligencia artificial" 
                        width={368} 
                        height={836} 
                        fetchPriority="high"
                      />
                    </div>
                    <div className="animateUp">
                      <img 
                        src={Banner1} 
                        alt="Agencia de seguros digital - Plataforma Guro con IA para automatización" 
                        width={368} 
                        height={836} 
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="animateDown">
                      <img 
                        src={Banner2} 
                        alt="Guro IA - Software de seguros para gestión de siniestros y análisis predictivo" 
                        width={368} 
                        height={836} 
                        fetchPriority="high"
                      />
                    </div>
                    <div className="animateDown">
                      <img 
                        src={Banner2} 
                        alt="Inteligencia artificial en seguros - CRM y cotizaciones automáticas con Guro" 
                        width={368} 
                        height={836} 
                        loading="lazy"
                      />
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
