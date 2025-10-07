import { Icon } from "@iconify/react";
import { Link } from "react-router";

const Benefits = [
  {
    icon: "mdi:clock-fast",
    title: "70% Menos Tiempo",
    subtitle: "Reduce el tiempo de procesamiento de pólizas de horas a minutos con IA.",
    bgcolor: "bg-lighterror",
    color: "text-error",
  },
  {
    icon: "mdi:trending-up",
    title: "45% Más Ventas",
    subtitle: "Incrementa las ventas cruzadas con sugerencias inteligentes personalizadas.",
    bgcolor: "bg-lightprimary",
    color: "text-primary",
  },
  {
    icon: "mdi:accuracy",
    title: "98% Precisión",
    subtitle: "Extrae datos de documentos con precisión casi perfecta, sin errores manuales.",
    bgcolor: "bg-lightsuccess",
    color: "text-success",
  },
  {
    icon: "mdi:headset",
    title: "Soporte 24/7",
    subtitle: "Tu asistente IA nunca descansa, disponible para atender consultas siempre.",
    bgcolor: "bg-lightgray dark:bg-darkgray",
    color: "text-dark dark:text-white",
  },
];

const OurClients = () => {
  return (
    <>
      <div className="lg:py-24 py-12 dark:bg-dark">
        <div className="container-1218 mx-auto">
          <div className="grid grid-cols-12 gap-30">
            <div className="lg:col-span-5 col-span-12">
              <h2 className="sm:text-44 text-3xl font-bold !leading-[48px] text-darklink dark:text-white">
                Más de 50 clientes confían en Guro
              </h2>
              <p className="text-17 leading-[32px] text-ld opacity-80 py-6">
                Desde agentes independientes hasta grandes aseguradoras, profesionales de toda Latinoamérica están transformando sus negocios con nuestra IA.
              </p>
              <Link
                to="/auth/auth1/register"
                className="text-darklink dark:text-white text-15 font-bold underline decoration-2 underline-offset-[6px] text-primary-ld hover:text-primary transition-colors"
              >
                Únete a Guro Hoy
              </Link>
            </div>
            <div className="lg:col-span-7 col-span-12 lg:ps-5 ">
              <div className="grid grid-cols-12 md:gap-12 gap-6">
                {Benefits.map((item, index) => (
                  <div className="md:col-span-6 col-span-12" key={index}>
                    <div
                      className={`h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-tw ${item.bgcolor}`}
                    >
                      <Icon
                        icon={item.icon}
                        className={`${item.color}`}
                        height={24}
                      />
                    </div>
                    <h4 className="font-bold text-darklink dark:text-white py-5 text-22">
                      {item.title}
                    </h4>
                    <p className="text-15 text-ld opacity-80 md:pt-2 leading-6">
                      {item.subtitle}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OurClients;
