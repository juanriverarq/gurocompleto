import { Icon } from "@iconify/react";

const WorkflowProcess = () => {
  const steps = [
    {
      step: "01",
      icon: "solar:user-plus-bold-duotone",
      title: "Captura de Leads",
      description: "Enlaces personalizados y formularios inteligentes capturan leads automáticamente desde múltiples canales.",
      color: "bg-blue-500"
    },
    {
      step: "02", 
      icon: "solar:cpu-bolt-bold-duotone",
      title: "Análisis IA",
      description: "Guro AI analiza el perfil del cliente y recomienda las mejores opciones de pólizas según sus necesidades.",
      color: "bg-purple-500"
    },
    {
      step: "03",
      icon: "solar:document-add-bold-duotone", 
      title: "Cotización Rápida",
      description: "Genera cotizaciones profesionales en segundos con precios actualizados de múltiples aseguradoras.",
      color: "bg-green-500"
    },
    {
      step: "04",
      icon: "solar:shield-check-bold-duotone",
      title: "Emisión de Póliza",
      description: "Proceso automatizado de emisión con documentos digitales y notificaciones automáticas al cliente.",
      color: "bg-orange-500"
    },
    {
      step: "05",
      icon: "solar:chart-2-bold-duotone",
      title: "Seguimiento Continuo",
      description: "Monitoreo automático de renovaciones, siniestros y oportunidades de venta cruzada.",
      color: "bg-red-500"
    }
  ];

  return (
    <>
      <div className="md:py-20 py-12 relative bg-white dark:bg-dark">
        <div className="container">
          <div className="lg:w-2/5 w-full mx-auto text-center mb-16">
            <p
              className="text-sm font-medium text-primary uppercase"
              data-aos="fade-up"
              data-aos-delay="200"
              data-aos-duration="1000"
            >
              Proceso Optimizado
            </p>
            <h2
              className="text-center sm:text-4xl text-2xl font-bold sm:!leading-[45px]"
              data-aos="fade-up"
              data-aos-delay="400"
              data-aos-duration="1000"
            >
              Cómo Funciona el Software de Seguros Guro con IA
            </h2>
            <p
              className="text-ld text-lg mt-4"
              data-aos="fade-up"
              data-aos-delay="600"
              data-aos-duration="1000"
            >
              Un flujo de trabajo inteligente que maximiza cada oportunidad de venta
            </p>
          </div>

          <div className="relative">
            {/* Línea conectora */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 via-green-500 via-orange-500 to-red-500 transform -translate-y-1/2 z-0"></div>
            
            <div className="grid grid-cols-12 gap-8 relative z-10">
              {steps.map((step, index) => (
                <div
                  className="lg:col-span-2 md:col-span-4 col-span-12 lg:col-start-auto md:col-start-auto"
                  key={index}
                  data-aos="fade-up"
                  data-aos-delay={200 + index * 150}
                  data-aos-duration="1000"
                  style={{
                    gridColumnStart: `${index * 2 + 2}`
                  }}
                >
                  <div className="text-center relative">
                    {/* Número de paso */}
                    <div className={`w-16 h-16 ${step.color} rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg shadow-lg`}>
                      {step.step}
                    </div>
                    
                    {/* Icono */}
                    <div className="bg-white dark:bg-darkgray w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-4 border-gray-100 dark:border-gray-700">
                      <Icon 
                        icon={step.icon} 
                        height={32} 
                        className="text-primary" 
                      />
                    </div>
                    
                    {/* Contenido */}
                    <h4 className="font-semibold text-lg text-dark dark:text-white mb-3">
                      {step.title}
                    </h4>
                    <p className="text-sm text-ld opacity-90 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Call to Action */}
          <div 
            className="text-center mt-16"
            data-aos="fade-up"
            data-aos-delay="800"
            data-aos-duration="1000"
          >
            <div className="bg-gradient-to-r from-primary to-secondary p-8 rounded-2xl text-white">
              <h3 className="text-2xl font-bold mb-4">
                ¿Listo para Revolucionar tu Agencia?
              </h3>
              <p className="text-lg mb-6 opacity-90">
                Únete a las 500+ agencias que ya confían en Guro para potenciar sus ventas
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <button className="bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                  Solicitar Demo
                </button>
                <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary transition-colors">
                  Ver Precios
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WorkflowProcess; 