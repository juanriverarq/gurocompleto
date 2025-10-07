import  { useState } from "react";
import { Icon } from "@iconify/react";
import mainbanner from "/src/assets/images/front-pages/background/feature-image.png";
import { Accordion, Button, HR } from "flowbite-react";
import React from "react";

const FeatureTabs = () => {
  // Custom Tab
  const [activeTab, setActiveTab] = useState("Gestión de Clientes");
  const handleTabClick = (tab: React.SetStateAction<string>) => {
    setActiveTab(tab);
  };

  const GestionClientes = [
    {
      title: "Base de datos centralizada",
      desc: "Mantén toda la información de tus clientes organizada en un solo lugar con acceso instantáneo a historial, pólizas y comunicaciones.",
    },
    {
      title: "Seguimiento de interacciones",
      desc: "Registra automáticamente todas las llamadas, emails y reuniones para un seguimiento completo de cada cliente.",
    },
    {
      title: "Alertas inteligentes",
      desc: "Recibe notificaciones automáticas sobre renovaciones, vencimientos y oportunidades de contacto.",
    },
  ];

  const AsistenteIA = [
    {
      title: "Asistente conversacional 24/7",
      desc: "Tu asistente personal de seguros que responde preguntas, crea pólizas y genera reportes usando lenguaje natural.",
    },
    {
      title: "Automatización de tareas",
      desc: "Delega tareas repetitivas como envío de recordatorios, generación de reportes y seguimiento de clientes.",
    },
    {
      title: "Análisis predictivo",
      desc: "Obtén insights sobre tendencias de mercado, riesgos potenciales y oportunidades de crecimiento.",
    },
  ];

  const LecturaAutomatica = [
    {
      title: "Procesamiento de documentos",
      desc: "Extrae automáticamente datos de pólizas, contratos y documentos legales sin intervención manual.",
    },
    {
      title: "Validación inteligente",
      desc: "Verifica automáticamente la consistencia de datos y detecta posibles errores o inconsistencias.",
    },
    {
      title: "Integración instantánea",
      desc: "Los datos extraídos se integran directamente en tu sistema sin necesidad de digitación manual.",
    },
  ];

  const VentasCruzadas = [
    {
      title: "Análisis de perfiles",
      desc: "Analiza automáticamente el perfil de cada cliente para identificar productos que mejor se adapten a sus necesidades.",
    },
    {
      title: "Oportunidades en tiempo real",
      desc: "Recibe sugerencias de ventas cruzadas basadas en cambios en la vida del cliente y tendencias del mercado.",
    },
    {
      title: "Scoring de oportunidades",
      desc: "Prioriza oportunidades de venta con un sistema de puntuación que maximiza tus posibilidades de éxito.",
    },
  ];

  return (
    <>
      <div className="bg-lightgray dark:bg-darkgray lg:py-24 py-12">
        <div className="container-1218 mx-auto">
          <div className="text-center mb-12">
            <h2 className="sm:text-44 text-3xl font-bold text-darklink dark:text-white mb-4">
              Funcionalidades Inteligentes de Guro
            </h2>
            <p className="text-lg text-ld opacity-80 max-w-2xl mx-auto">
              Descubre cómo la inteligencia artificial puede transformar tu negocio de seguros
            </p>
          </div>
          
          {/* Tabs */}
          <div className="overflow-x-auto ">
            <div className="flex shrink-0 gap-4 md:pb-14 pb-8">
              <div
                onClick={() => handleTabClick("Gestión de Clientes")}
                className={` py-4 px-6 whitespace-nowrap w-full rounded-tw cursor-pointer text-dark text-base font-semibold text-center flex gap-2 justify-center items-center shadow-elevation2 ${
                  activeTab == "Gestión de Clientes"
                    ? "text-white bg-primary dark:bg-primary shadow-elevation3 hover:bg-primaryemphasis dark:hover:bg-primaryemphasis"
                    : "dark:text-white bg-white dark:bg-dark md:hover:bg-lightprimary md:dark:hover:bg-lightprimary md:hover:text-primary"
                }`}
              >
                <Icon
                  icon="mdi:account-multiple"
                  height={22}
                />
                Gestión de Clientes
              </div>
              <div
                onClick={() => handleTabClick("Asistente IA")}
                className={`py-4 px-6 whitespace-nowrap w-full rounded-tw cursor-pointer text-dark text-base font-semibold text-center flex gap-2 justify-center items-center shadow-elevation2 ${
                  activeTab == "Asistente IA"
                    ? "text-white bg-primary dark:bg-primary shadow-elevation3 hover:bg-primaryemphasis dark:hover:bg-primaryemphasis"
                    : "dark:text-white bg-white dark:bg-dark md:hover:bg-lightprimary md:dark:hover:bg-lightprimary md:hover:text-primary"
                }`}
              >
                <Icon
                  icon="mdi:robot-happy"
                  height={22}
                />{" "}
                Asistente IA
              </div>
              <div
                onClick={() => handleTabClick("Lectura Automática")}
                className={`py-4 px-6 whitespace-nowrap w-full rounded-tw cursor-pointer text-dark text-base font-semibold text-center flex gap-2 justify-center items-center  shadow-elevation2 ${
                  activeTab == "Lectura Automática"
                    ? "text-white bg-primary dark:bg-primary shadow-elevation3 hover:bg-primaryemphasis dark:hover:bg-primaryemphasis"
                    : "dark:text-white bg-white dark:bg-dark md:hover:bg-lightprimary md:dark:hover:bg-lightprimary md:hover:text-primary"
                }`}
              >
                <Icon
                  icon="mdi:file-eye"
                  height={22}
                />{" "}
                Lectura Automática
              </div>
              <div
                onClick={() => handleTabClick("Ventas Cruzadas")}
                className={`py-4 px-6 whitespace-nowrap w-full rounded-tw cursor-pointer text-dark text-base font-semibold text-center flex gap-2 justify-center items-center shadow-elevation2  ${
                  activeTab == "Ventas Cruzadas"
                    ? "text-white bg-primary dark:bg-primary shadow-elevation3 hover:bg-primaryemphasis dark:hover:bg-primaryemphasis"
                    : "dark:text-white bg-white dark:bg-dark md:hover:bg-lightprimary md:dark:hover:bg-lightprimary md:hover:text-primary"
                }`}
              >
                <Icon
                  icon="mdi:chart-line"
                  height={22}
                />{" "}
                Ventas Cruzadas
              </div>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-30 flex items-center">
            <div className="lg:col-span-6 col-span-12">
              <img src={mainbanner} className="w-full" alt="banner" />
            </div>
            <div className="lg:col-span-6 col-span-12 lg:ps-7">
              {/* Tabs Content */}
              {activeTab === "Gestión de Clientes" && (
                <>
                  <h2 className="sm:text-44 text-3xl font-bold !leading-[48px] text-darklink dark:text-white pb-6">
                    Centraliza y potencia tu cartera de clientes
                  </h2>
                  <Accordion className="shadow-none dark:shadow-none divide-y-0 !rounded-none">
                    {GestionClientes.map((item, i) => (
                      <Accordion.Panel
                        key={i}
                        className="bg-white dark:bg-dark"
                      >
                        <Accordion.Title className="focus:ring-0 px-0 text-17 font-semibold text-ld py-5 ">
                          {item.title}
                        </Accordion.Title>
                        <Accordion.Content className="px-0 pt-0 !rounded-none">
                          <p className="text-base text-ld opacity-80 leading-7 ">
                            {item.desc}
                          </p>
                        </Accordion.Content>
                        <HR className="my-0" />
                      </Accordion.Panel>
                    ))}
                  </Accordion>
                  <Button color={"primary"} className="font-bold mt-6">
                    Explorar Gestión de Clientes
                  </Button>
                </>
              )}
              {activeTab === "Asistente IA" && <>
                <h2 className="sm:text-44 text-3xl font-bold !leading-[48px] text-darklink dark:text-white pb-6">
                    Tu asistente personal de seguros que nunca descansa
                  </h2>
                  <Accordion className="shadow-none dark:shadow-none divide-y-0 !rounded-none">
                    {AsistenteIA.map((item, i) => (
                      <Accordion.Panel
                        key={i}
                        className="bg-white dark:bg-dark"
                      >
                        <Accordion.Title className="focus:ring-0 px-0 text-17 font-semibold text-ld py-5 ">
                          {item.title}
                        </Accordion.Title>
                        <Accordion.Content className="px-0 pt-0 !rounded-none">
                          <p className="text-base text-ld opacity-80 leading-7 ">
                            {item.desc}
                          </p>
                        </Accordion.Content>
                        <HR className="my-0" />
                      </Accordion.Panel>
                    ))}
                  </Accordion>
                  <Button color={"primary"} className="font-bold mt-6">
                    Conocer el Asistente IA
                  </Button>
              </>}

              {activeTab === "Lectura Automática" && <>
                <h2 className="sm:text-44 text-3xl font-bold !leading-[48px] text-darklink dark:text-white pb-6">
                    Automatiza el procesamiento de documentos
                  </h2>
                  <Accordion className="shadow-none dark:shadow-none divide-y-0 !rounded-none">
                    {LecturaAutomatica.map((item, i) => (
                      <Accordion.Panel
                        key={i}
                        className="bg-white dark:bg-dark"
                      >
                        <Accordion.Title className="focus:ring-0 px-0 text-17 font-semibold text-ld py-5 ">
                          {item.title}
                        </Accordion.Title>
                        <Accordion.Content className="px-0 pt-0 !rounded-none">
                          <p className="text-base text-ld opacity-80 leading-7 ">
                            {item.desc}
                          </p>
                        </Accordion.Content>
                        <HR className="my-0" />
                      </Accordion.Panel>
                    ))}
                  </Accordion>
                  <Button color={"primary"} className="font-bold mt-6">
                    Ver Lectura Automática
                  </Button>
              </>}

              {activeTab === "Ventas Cruzadas" && <>
                <h2 className="sm:text-44 text-3xl font-bold !leading-[48px] text-darklink dark:text-white pb-6">
                    Maximiza tus oportunidades de venta
                  </h2>
                  <Accordion className="shadow-none dark:shadow-none divide-y-0 !rounded-none">
                    {VentasCruzadas.map((item, i) => (
                      <Accordion.Panel
                        key={i}
                        className="bg-white dark:bg-dark"
                      >
                        <Accordion.Title className="focus:ring-0 px-0 text-17 font-semibold text-ld py-5 ">
                          {item.title}
                        </Accordion.Title>
                        <Accordion.Content className="px-0 pt-0 !rounded-none">
                          <p className="text-base text-ld opacity-80 leading-7 ">
                            {item.desc}
                          </p>
                        </Accordion.Content>
                        <HR className="my-0" />
                      </Accordion.Panel>
                    ))}
                  </Accordion>
                  <Button color={"primary"} className="font-bold mt-6">
                    Descubrir Ventas Cruzadas
                  </Button>
              </>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeatureTabs;
