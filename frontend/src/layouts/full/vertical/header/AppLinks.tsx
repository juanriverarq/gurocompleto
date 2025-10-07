import { Icon } from "@iconify/react";
import { useState } from "react";
import * as AppsData from "./Data";
import { Drawer } from "flowbite-react";
import MegamenuImg from "/src/assets/images/backgrounds/mega-dd-bg.jpg";
import { Link, useNavigate } from "react-router";

const AppLinks = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  
  const handleClose = () => setIsOpen(false);

  const handleAppClick = (href: string, title: string) => {
    if (href && href !== "#") {
      navigate(href);
    } else {
      // Para funciones que aún no tienen implementación, mostrar mensaje
      alert(`Próximamente: ${title}`);
    }
    handleClose();
  };

  return (
    <>
      <div className="relative group ">
        <span className="h-10 w-10 text-darklink dark:text-white text-sm hover:text-primary hover:bg-lightprimary dark:hover:text-primary dark:hover:bg-darkminisidebar rounded-full flex justify-center items-center cursor-pointer group-hover:bg-lightprimary group-hover:text-primary xl:flex hidden">
          <Icon icon="solar:cpu-bolt-line-duotone" height={22} />
        </span>

        <span
          className="xl:hidden block h-10 w-10 hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer group-hover:bg-lightprimary group-hover:text-primary"
          onClick={() => setIsOpen(true)}
        >
          <Icon icon="solar:cpu-bolt-line-duotone" height={22} />
        </span>

        <div className="sm:w-[860px] w-screen dropdown invisible group-hover:visible absolute z-[10] transition-all duration-150 ease-in-out">
          <Drawer
            open={isOpen}
            onClose={handleClose}
            position="right"
            className="xl:relative xl:transform-none xl:h-auto xl:bg-transparent xl:z-[0] xl:w-[860px] w-64"
          >
            <div className="md:h-auto h-[calc(100vh_-_50px)] overflow-y-auto">
              <div className="grid grid-cols-12 w-full min-h-[400px]">
                <div className="xl:col-span-8 col-span-12 flex items-stretch p-6">
                  <div className="w-full">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-ld mb-2">Funciones IA de Guro</h4>
                      <p className="text-sm text-bodytext">Potencia tu negocio de seguros con inteligencia artificial</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full">
                      {AppsData.appsLink.map((links, index) => (
                        <div
                          className="col-span-1"
                          key={index}
                        >
                          <div
                            onClick={() => handleAppClick(links.href, links.title)}
                            className="flex gap-3 hover:text-primary group relative items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-150 cursor-pointer"
                          >
                            <span
                              className={`h-12 w-12 flex justify-center items-center rounded-lg ${links.iconbg} flex-shrink-0`}
                            >
                              <Icon
                                icon={links.icon}
                                height={20}
                                width={20}
                                className={`${links.iconcolor}`}
                              />
                            </span>
                            <div className="flex-1 min-w-0">
                              <h6 className="font-semibold text-15 text-ld hover:text-primary truncate">
                                {links.title}
                              </h6>
                              <p className="text-13 text-bodytext line-clamp-2">
                                {links.subtext}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t dark:border-darkborder">
                      <Link
                        to="/apps"
                        className="inline-flex items-center gap-2 text-primary hover:text-primary-dark font-medium text-sm"
                        onClick={handleClose}
                      >
                        Ver todas las aplicaciones
                        <Icon icon="solar:arrow-right-line-duotone" height={16} />
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="xl:col-span-4 col-span-12 flex items-stretch lg:block hidden">
                  <img
                    src={MegamenuImg}
                    alt="Funciones IA"
                    className="h-full w-full object-cover rounded-r-lg"
                  />
                </div>
              </div>
            </div>
          </Drawer>
        </div>
      </div>
    </>
  );
};

export default AppLinks;
