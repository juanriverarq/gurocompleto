import { Icon } from "@iconify/react";
export const Highlights = () => {
  const GuroFeatures1 = [
    {
      key: "feature1",
      icon: "mdi:robot-happy",
      title: "Asistente IA 24/7",
      bg: "bg-lightprimary",
      text: "text-primary",
    },
    {
      key: "feature2",
      icon: "mdi:file-eye",
      title: "Lectura Automática",
      bg: "bg-lightsecondary",
      text: "text-secondary",
    },
    {
      key: "feature3",
      icon: "mdi:chart-line",
      title: "Ventas Cruzadas IA",
      bg: "bg-lighterror",
      text: "text-error",
    },
    {
      key: "feature4",
      icon: "mdi:shield-check",
      title: "Gestión de Pólizas",
      bg: "bg-lightsuccess",
      text: "text-success",
    },
    {
      key: "feature5",
      icon: "mdi:account-multiple",
      title: "CRM Inteligente",
      bg: "bg-lightinfo",
      text: "text-info",
    },
    {
      key: "feature6",
      icon: "mdi:analytics",
      title: "Análisis Predictivo",
      bg: "bg-lightwarning",
      text: "text-warning",
    },
  ];
  
  const GuroFeatures2 = [
    {
      key: "feature1",
      icon: "mdi:clock-fast",
      title: "70% Menos Tiempo",
      bg: "bg-lightprimary",
      text: "text-primary",
    },
    {
      key: "feature2",
      icon: "mdi:trending-up",
      title: "45% Más Ventas",
      bg: "bg-lighterror",
      text: "text-error",
    },
    {
      key: "feature3",
      icon: "mdi:accuracy",
      title: "98% Precisión",
      bg: "bg-lightinfo",
      text: "text-info",
    },
    {
      key: "feature4",
      icon: "mdi:security",
      title: "100% Seguro",
      bg: "bg-lightsuccess",
      text: "text-success",
    },
  ];
  
  const GuroFeatures3 = [
    {
      key: "feature1",
      icon: "mdi:file-document-multiple",
      title: "Procesamiento Siniestros",
      bg: "bg-lightsecondary",
      text: "text-secondary",
    },
    {
      key: "feature2",
      icon: "mdi:chart-box",
      title: "Reportes Inteligentes",
      bg: "bg-lightwarning",
      text: "text-warning",
    },
    {
      key: "feature3",
      icon: "mdi:update",
      title: "Actualizaciones Automáticas",
      bg: "bg-lightsuccess",
      text: "text-success",
    },
    {
      key: "feature4",
      icon: "mdi:headset",
      title: "Soporte Especializado",
      bg: "bg-lightprimary",
      text: "text-primary",
    },
    {
      key: "feature5",
      icon: "mdi:calendar-clock",
      title: "Recordatorios IA",
      bg: "bg-lightinfo",
      text: "text-info",
    },
    {
      key: "feature6",
      icon: "mdi:integration",
      title: "Integraciones Fáciles",
      bg: "bg-lighterror",
      text: "text-error",
    },
  ];
  
  return (
    <>
      <div className="dark:bg-dark">
        <div className="container-1218 mx-auto ">
          <div className=" lg:pt-24 pt-12 rounded-md overflow-hidden">
            <div className="marquee1-group flex gap-6">
              {[0, 1, 2, 3].map((index) => {
                return (
                  <div key={index} className="flex gap-6 mb-6">
                    {GuroFeatures1.map((item) => {
                      return (
                        <div
                          key={item.key}
                          className={`py-5 px-8 rounded-[16px] flex gap-3 items-center ${item.bg}`}
                        >
                          <Icon
                            icon={item.icon}
                            className={`text-2xl shrink-0 ${item.text}`}
                          />
                          <p
                            className={`text-15 font-semibold whitespace-nowrap ${item.text}`}
                          >
                            {item.title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="marquee2-group flex gap-6">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                return (
                  <div key={index} className="flex gap-6 mb-6">
                    {GuroFeatures2.map((item) => {
                      return (
                        <div
                          key={item.key}
                          className={`py-5 px-8 rounded-[16px] flex gap-3 items-center ${item.bg}`}
                        >
                          <Icon
                            icon={item.icon}
                            className={`text-2xl shrink-0 ${item.text}`}
                          />
                          <p
                            className={`text-15 font-semibold whitespace-nowrap ${item.text}`}
                          >
                            {item.title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="marquee1-group flex gap-6">
              {[0, 1, 2, 3].map((index) => {
                return (
                  <div key={index} className="flex gap-6 mb-6">
                    {GuroFeatures3.map((item) => {
                      return (
                        <div
                          key={item.key}
                          className={`py-5 px-8 rounded-[16px] flex gap-3 items-center ${item.bg}`}
                        >
                          <Icon
                            icon={item.icon}
                            className={`text-2xl shrink-0 ${item.text}`}
                          />
                          <p
                            className={`text-15 font-semibold whitespace-nowrap ${item.text}`}
                          >
                            {item.title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
