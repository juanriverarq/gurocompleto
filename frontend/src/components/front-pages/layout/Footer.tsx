import { Tooltip } from "flowbite-react";
import logo from "/src/assets/images/front-pages/background/white-icon-logo.svg";
import FullLogo from "/src/assets/images/front-pages/background/white-logo.svg";
import { Link } from "react-router";
import facebook from "/src/assets/images/front-pages/background/facebook.svg"
import twitter from "/src/assets/images/front-pages/background/twitter.svg"
import instagram from "/src/assets/images/front-pages/background/instagram.svg"

export const Footer = () => {
  const navLinks1 = [
    {
      key: "link1",
      title: "Asistente IA",
      link: "#asistente-ia",
    },
    {
      key: "link2",
      title: "Lectura Automática",
      link: "#lectura-automatica",
    },
    {
      key: "link3",
      title: "Ventas Cruzadas",
      link: "#ventas-cruzadas",
    },
    {
      key: "link4",
      title: "Gestión de Clientes",
      link: "#gestion-clientes",
    },
    {
      key: "link5",
      title: "Análisis Predictivo",
      link: "#analisis-predictivo",
    },
  ];
  const navLinks2 = [
    {
      key: "link1",
      title: "Plan Básico",
      link: "#plan-basico",
    },
    {
      key: "link2",
      title: "Plan Profesional",
      link: "#plan-profesional",
    },
    {
      key: "link3",
      title: "Plan Empresarial",
      link: "#plan-empresarial",
    },
    {
      key: "link4",
      title: "Personalizado",
      link: "#personalizado",
    },
    {
      key: "link5",
      title: "Comparar Planes",
      link: "#comparar-planes",
    },
  ];
  const navLinks3 = [
    {
      key: "link1",
      title: "Centro de Ayuda",
      link: "#ayuda",
    },
    {
      key: "link2",
      title: "Documentación",
      link: "#documentacion",
    },
    {
      key: "link3",
      title: "API",
      link: "#api",
    },
    {
      key: "link4",
      title: "Tutoriales",
      link: "#tutoriales",
    },
    {
      key: "link5",
      title: "Webinars",
      link: "#webinars",
    },
  ];
  
  return (
    <>
      <div className="bg-sky">
        <div className="container-1218 mx-auto ">
          <div className="border-b border-darkborder lg:py-24 py-12">
            <div className="grid grid-cols-12 gap-30 ">
              <div className="lg:col-span-3 sm:col-span-6 col-span-12">
                <img src={FullLogo} alt="logo" className="mb-8" />
                <p className="text-sm text-lightmuted mb-6 leading-relaxed">
                  Guro revoluciona la gestión de seguros con inteligencia artificial, 
                  automatizando procesos y maximizando oportunidades de venta.
                </p>
                <div className="flex flex-col gap-4">
                  {navLinks1.map((item) => {
                    return (
                      <Link
                        key={item.key}
                        to={item.link}
                        className="text-sm text-lightmuted hover:text-primary block"
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="lg:col-span-3 sm:col-span-6 col-span-12">
                <h4 className="text-17 text-white font-semibold mb-8">
                  Planes y Precios
                </h4>
                <div className="flex flex-col gap-4">
                  {navLinks2.map((item) => {
                    return (
                      <Link
                        key={item.key}
                        to={item.link}
                        className="text-sm text-lightmuted hover:text-primary block"
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="lg:col-span-3 sm:col-span-6 col-span-12">
                <h4 className="text-17 text-white font-semibold mb-8">
                  Recursos
                </h4>
                <div className="flex flex-col gap-4">
                  {navLinks3.map((item) => {
                    return (
                      <Link
                        key={item.key}
                        to={item.link}
                        className="text-sm text-lightmuted hover:text-primary block"
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="lg:col-span-3 sm:col-span-6 col-span-12">
                <h4 className="text-17 text-white font-semibold mb-8">
                  Síguenos
                </h4>
                <div className="flex items-center gap-5">
                  <Tooltip
                    content="Facebook"
                    placement="bottom"
                    className="shrink-0"
                  >
                    <Link to="https://facebook.com/guro">
                      <img
                        src={facebook}
                        height={22}
                        width={22}
                        alt="icon"
                      />
                    </Link>
                  </Tooltip>
                  <Tooltip
                    content="Twitter"
                    placement="bottom"
                    className="shrink-0"
                  >
                    <Link to="https://twitter.com/guro">
                      <img
                        src={twitter}
                        height={22}
                        width={22}
                        alt="icon"
                      />
                    </Link>
                  </Tooltip>
                  <Tooltip
                    content="Instagram"
                    placement="bottom"
                    className="shrink-0"
                  >
                    <Link to="https://instagram.com/guro">
                      <img
                        src={instagram}
                        height={22}
                        width={22}
                        alt="icon"
                      />
                    </Link>
                  </Tooltip>
                </div>
                <div className="mt-8">
                  <h5 className="text-15 text-white font-semibold mb-4">Contáctanos</h5>
                  <div className="flex flex-col gap-2 text-sm text-lightmuted">
                    <p>📧 contacto@guro.ai</p>
                    <p>📞 +57 300 123 4567</p>
                    <p>📍 Bogotá, Colombia</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:py-8 py-6">
            <div className="sm:flex justify-between items-center">
              <p className="text-sm text-lightmuted opacity-80 sm:mb-0 mb-4">
                © 2024 Guro. Todos los derechos reservados.
              </p>
              <div className="flex gap-6">
                <Link to="/privacidad" className="text-sm text-lightmuted hover:text-primary">
                  Política de Privacidad
                </Link>
                <Link to="/terminos" className="text-sm text-lightmuted hover:text-primary">
                  Términos de Uso
                </Link>
                <Link to="/cookies" className="text-sm text-lightmuted hover:text-primary">
                  Cookies
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
