import CardBox from "src/components/shared/CardBox";
import { Icon } from "@iconify/react";
import { Button } from "flowbite-react";
import { Link } from "react-router";
import user1 from "/src/assets/images/profile/user-2.jpg";
import user2 from "/src/assets/images/profile/user-3.jpg";
import user3 from "/src/assets/images/profile/user-4.jpg";

const InsuranceBenefits = () => {
  const keyFeatures = [
    {
      icon: "solar:cpu-bolt-bold-duotone",
      title: "Asistente de IA Avanzado",
      subtitle: "Respuestas inteligentes, análisis predictivo y automatización completa de procesos",
      highlight: "IA Generativa",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      icon: "solar:document-text-bold-duotone",
      title: "Gestión Integral de Pólizas",
      subtitle: "Desde cotización hasta renovación, todo automatizado con seguimiento en tiempo real",
      highlight: "Todo en Uno",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20"
    },
    {
      icon: "solar:users-group-rounded-bold-duotone",
      title: "CRM Inteligente para Seguros",
      subtitle: "Gestión avanzada de clientes, leads y vendedores con insights automáticos",
      highlight: "CRM Especializado",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    }
  ];

  const results = [
    { metric: "+300%", label: "Incremento en Ventas", icon: "solar:graph-up-bold-duotone" },
    { metric: "15h/sem", label: "Tiempo Ahorrado", icon: "solar:clock-circle-bold-duotone" },
    { metric: "95%", label: "Satisfacción Cliente", icon: "solar:heart-bold-duotone" },
    { metric: "3 meses", label: "ROI Garantizado", icon: "solar:dollar-minimalistic-bold-duotone" }
  ];

  return (
    <>
      <div className="md:py-24 py-16 relative bg-gradient-to-br from-primary/5 via-white to-secondary/5 dark:from-primary/10 dark:via-dark dark:to-secondary/10" id="funciones">
        <div className="container">
          {/* Header Principal */}
          <div className="lg:w-3/5 w-full mx-auto text-center mb-20">
            <div 
              className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-6"
              data-aos="fade-up"
              data-aos-delay="100"
              data-aos-duration="1000"
            >
              <Icon icon="solar:stars-bold-duotone" height={16} />
              Potenciado por Inteligencia Artificial
            </div>
            <h2
              className="text-center sm:text-5xl text-3xl font-bold sm:!leading-[55px] text-dark dark:text-white mb-6"
              data-aos="fade-up"
              data-aos-delay="200"
              data-aos-duration="1000"
            >
              Software de Seguros con IA para Agencias Digitales
            </h2>
            <p
              className="text-ld text-xl leading-relaxed"
              data-aos="fade-up"
              data-aos-delay="300"
              data-aos-duration="1000"
            >
              La plataforma de seguros más avanzada del mercado. <br />
              <strong className="text-primary">Todo lo que necesitas en un solo lugar.</strong>
            </p>
          </div>

          {/* Funciones Principales */}
          <div className="grid grid-cols-12 gap-8 mb-20">
            {keyFeatures.map((feature, index) => (
              <div
                className="xl:col-span-4 lg:col-span-6 col-span-12"
                key={index}
                data-aos="fade-up"
                data-aos-delay={200 + index * 100}
                data-aos-duration="1000"
              >
                <CardBox className={`p-8 h-full hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 ${feature.bgColor} border-0 relative overflow-hidden group`}>
                  {/* Highlight Badge */}
                  <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${feature.color} bg-white dark:bg-gray-800 shadow-lg`}>
                    {feature.highlight}
                  </div>
                  
                  <div className="mb-6">
                    <div className={`w-16 h-16 rounded-2xl ${feature.color.replace('text-', 'bg-').replace('-500', '-100')} dark:${feature.color.replace('text-', 'bg-').replace('-500', '-900/30')} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon 
                        icon={feature.icon} 
                        height={32} 
                        className={feature.color}
                      />
                    </div>
                  </div>
                  
                  <h5 className="font-bold text-xl text-dark dark:text-white mb-4 leading-tight">
                    {feature.title}
                  </h5>
                  <p className="text-ld opacity-90 leading-relaxed">
                    {feature.subtitle}
                  </p>
                  
                  {/* Decorative element */}
                  <div className={`absolute -bottom-2 -right-2 w-20 h-20 rounded-full ${feature.color.replace('text-', 'bg-').replace('-500', '-100')} opacity-20 group-hover:scale-150 transition-transform duration-500`}></div>
                </CardBox>
              </div>
            ))}
          </div>

          {/* Resultados Comprobados */}
          <div className="bg-white dark:bg-darkgray rounded-3xl p-12 shadow-2xl">
            <div className="text-center mb-12">
              <div className="flex justify-center items-center gap-3 mb-6">
                <div className="flex">
                  <div className="-ms-2 h-8 w-8">
                    <img
                      src={user1}
                      className="border-2 border-white dark:border-darkborder rounded-full"
                      alt="usuario"
                    />
                  </div>
                  <div className="-ms-2 h-8 w-8">
                    <img
                      src={user2}
                      className="border-2 border-white dark:border-darkborder rounded-full"
                      alt="usuario"
                    />
                  </div>
                  <div className="-ms-2 h-8 w-8">
                    <img
                      src={user3}
                      className="border-2 border-white dark:border-darkborder rounded-full"
                      alt="usuario"
                    />
                  </div>
                </div>
                <p className="text-ld text-lg">
                  Más de 50 clientes ya transformaron su negocio con Guro
                </p>
              </div>
              <h3 
                className="text-3xl font-bold text-dark dark:text-white mb-4"
                data-aos="fade-up"
                data-aos-delay="100"
                data-aos-duration="1000"
              >
                Resultados que Hablan por Sí Solos
              </h3>
            </div>
            
            <div className="grid grid-cols-12 gap-8">
              {results.map((result, index) => (
                <div 
                  className="lg:col-span-3 md:col-span-6 col-span-12 text-center"
                  key={index}
                  data-aos="fade-up"
                  data-aos-delay={200 + index * 100}
                  data-aos-duration="1000"
                >
                  <div className="mb-4">
                    <Icon 
                      icon={result.icon} 
                      height={40} 
                      className="text-primary mx-auto mb-3" 
                    />
                    <div className="text-4xl font-bold text-primary mb-2">
                      {result.metric}
                    </div>
                  </div>
                  <p className="text-ld font-medium">{result.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <div 
              className="sm:flex gap-3 justify-center items-center"
              data-aos="fade-up"
              data-aos-delay="300"
              data-aos-duration="1000"
            >
              <Button
                as={Link}
                to="/auth/auth1/register"
                size={"lg"}
                color={"primary"}
                className="sm:mb-0 mb-3"
              >
                🚀 Comenzar Prueba Gratuita
              </Button>
              <a 
                href="#demos" 
                type="button" 
                className="group relative flex items-stretch justify-center p-0.5 text-center font-medium border border-primary bg-transparent text-primary hover:bg-primary dark:hover:bg-primary hover:text-white rounded-md" 
                data-discover="true"
              >
                <span className="flex items-center gap-2 transition-all duration-150 justify-center rounded-md px-9 py-2.5 text-sm">
                  📞 Solicitar Demo
                </span>
              </a>
            </div>
            <p className="text-sm text-ld opacity-75 mt-4">
              Sin compromisos • Configuración en 24 horas • Soporte incluido
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default InsuranceBenefits; 