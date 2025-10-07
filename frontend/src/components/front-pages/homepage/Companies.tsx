import { Icon } from "@iconify/react";

const companies = [
  {
    name: "Seguros Sura",
    icon: "mdi:shield-account",
    color: "#e11d48"
  },
  {
    name: "Mapfre",
    icon: "mdi:shield-check",
    color: "#dc2626"
  },
  {
    name: "Bolivar Seguros",
    icon: "mdi:shield-star",
    color: "#0369a1"
  },
  {
    name: "La Previsora",
    icon: "mdi:shield-home",
    color: "#059669"
  },
  {
    name: "AXA Colpatria",
    icon: "mdi:shield-car",
    color: "#7c3aed"
  },
  {
    name: "Allianz",
    icon: "mdi:shield-crown",
    color: "#ea580c"
  },
];

const Companies = () => {
  return (
    <>
      <div className="dark:bg-dark">
        <div className="container-1218 mx-auto ">
          <div className="border-ld border-t lg:pt-14 pt-7">
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold text-ld opacity-70 mb-2">
                Empresas líderes que confían en Guro
              </h3>
            </div>
            <div className="flex flex-wrap md:justify-between justify-center items-center gap-8">
              {companies.map((item, index) => (
                <div key={index} className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity duration-300">
                  <Icon 
                    icon={item.icon} 
                    className="text-3xl" 
                    style={{ color: item.color }}
                  />
                  <span className="text-lg font-medium text-ld">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Companies;
