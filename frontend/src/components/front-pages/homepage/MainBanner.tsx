import user1 from "/src/assets/images/profile/user-2.jpg";
import user2 from "/src/assets/images/profile/user-3.jpg";
import user3 from "/src/assets/images/profile/user-4.jpg";

import mainbanner from "/src/assets/images/front-pages/background/main-banner.png";
import { Button, Tooltip } from "flowbite-react";
import { Link } from "react-router";
import { Icon } from "@iconify/react";
import { useState } from "react";
import VideoDemoModal from "@/components/landingpage/VideoDemoModal";


const MainBanner = () => {
  const userImg = [
    {
      user: user1,
    },
    {
      user: user2,
    },
    {
      user: user3,
    },
  ];

  const Features = [
    {
      icon: "mdi:shield-check",
      tooltip: "Gestión de Pólizas",
      color: "#2563eb"
    },
    {
      icon: "mdi:account-multiple",
      tooltip: "Gestión de Clientes",
      color: "#059669"
    },
    {
      icon: "mdi:file-document-multiple",
      tooltip: "Procesamiento de Siniestros",
      color: "#dc2626"
    },
    {
      icon: "mdi:brain",
      tooltip: "Inteligencia Artificial",
      color: "#7c3aed"
    },
    {
      icon: "mdi:robot-happy",
      tooltip: "Asistente IA",
      color: "#ea580c"
    },
    {
      icon: "mdi:chart-line",
      tooltip: "Ventas Cruzadas IA",
      color: "#0891b2"
    },
    {
      icon: "mdi:file-eye",
      tooltip: "Lectura Automática",
      color: "#be185d"
    },
  ];
  
  const [openDemo, setOpenDemo] = useState(false);

  return (
    <>
      <VideoDemoModal open={openDemo} onClose={() => setOpenDemo(false)} />
      <div className="bg-lightgray dark:bg-darkgray">
        <div className="container-1218 mx-auto sm:pt-10 pt-6 xl:pb-0 pb-10">
          <div className="grid grid-cols-12 gap-30 flex items-center ">
            <div className="xl:col-span-6 col-span-12 lg:text-start text-center">
              <div className="mb-4">
                <h1 className="lg:text-56 text-4xl text-darklink dark:text-white lg:leading-[64px] leading-[50px] font-bold mb-4">
                  Guro
                </h1>
                <h2 className="lg:text-2xl text-xl text-primary dark:text-primary font-semibold mb-6">
                  El futuro de la gestión de seguros, potenciado por IA
                </h2>
              </div>
              
              <p className="text-lg text-ld opacity-90 mb-6 leading-relaxed">
                Revoluciona tu negocio de seguros con nuestro asistente inteligente que automatiza 
                la gestión de pólizas, procesa documentos al instante y encuentra oportunidades 
                de ventas cruzadas que nunca imaginaste.
              </p>

    
              
              <ul className="flex flex-wrap lg:justify-start justify-center gap-5 pb-7 md:pt-4 ml-0">
                {Features.map((item, index) => (
                  <Tooltip
                    content={item.tooltip}
                    className="!text-xs"
                    placement="bottom"
                    key={index}
                  >
                    <li
                      className="md:h-14 md:w-14 h-10 w-10 bg-white dark:bg-darkmuted rounded-[16px] flex justify-center items-center shadow-elevation1 hover:shadow-elevation2 transition-all duration-200"
                    >
                      <Icon 
                        icon={item.icon} 
                        className="md:text-2xl text-lg" 
                        style={{ color: item.color }}
                      />
                    </li>
                  </Tooltip>
                ))}
              </ul>
              
              <div className="flex lg:justify-start justify-center gap-4">
                <Button
                  color={"primary"}
                  as={Link}
                  to="/auth/auth1/login"
                  className="px-6 py-3 font-bold sm:w-fit w-full text-lg"
                >
                  Comenzar Ahora
                </Button>
                <Button
                  color={"light"}
                  onClick={() => setOpenDemo(true)}
                  className="px-6 py-3 font-bold sm:w-fit w-full text-lg"
                >
                  Ver Demo
                </Button>
              </div>
            </div>
            <div className="lg:col-span-6 col-span-12 xl:block hidden">
              <div className="min-w-[1300px] max-h-[700px] h-[calc(100vh_-_100px)] overflow-hidden ">
                <img src={mainbanner} className="rtl:scale-x-[-1]" alt="banner" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MainBanner;
