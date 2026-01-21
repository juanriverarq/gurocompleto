import { Accordion } from "flowbite-react";
import { Link } from "react-router";


export const FAQ = () => {
  const Questions = [
    {
      key: "question1",
      question: "¿Qué incluye la prueba gratuita de 7 días?",
      answer:
        "Acceso completo a todos los módulos: gestión de clientes, pólizas, siniestros, renovaciones, CRM de ventas, cartera, comisiones, WhatsApp Marketing, Email Marketing y las herramientas de IA. Sin límites ni restricciones durante el trial.",
    },
    {
      key: "question2",
      question: "¿Cómo funciona el Lector de PDF con IA?",
      answer:
        "Sube cualquier póliza o documento en PDF y nuestra IA extrae automáticamente los datos clave: asegurado, vigencias, coberturas, primas y más. El sistema aprende y mejora con cada documento procesado.",
    },
    {
      key: "question3",
      question: "¿Puedo enviar mensajes masivos por WhatsApp?",
      answer:
        "Sí, el módulo de WhatsApp Marketing permite enviar campañas masivas, recordatorios de vencimiento y mensajes automáticos a tus clientes. Puedes escalar según tu necesidad.",
    },
    {
      key: "question4",
      question: "¿Cómo funciona el cálculo automático de comisiones?",
      answer:
        "Guro calcula automáticamente las comisiones por cada póliza según las reglas que configures: porcentajes por aseguradora, ramo, vendedor y tipo de negocio. Genera liquidaciones listas para pagar con un clic.",
    },
    {
      key: "question5",
      question: "¿Qué herramientas de IA incluye Guro?",
      answer:
        "Incluye: Chatbot IA 24/7 para atención al cliente, Call Center con agentes de voz IA, predicciones de renovación y riesgo de fuga, y recomendaciones inteligentes de ventas cruzadas basadas en el perfil del cliente.",
    },
    {
      key: "question6",
      question: "¿Cuántos usuarios puedo agregar a mi cuenta?",
      answer:
        "El primer usuario está incluido. Puedes agregar usuarios adicionales según tu plan, con descuentos por volumen a medida que crece tu equipo.",
    },
    {
      key: "question7",
      question: "¿Puedo personalizar Guro con mi marca?",
      answer:
        "Sí, con el módulo de Marca Blanca puedes usar tu logotipo, colores corporativos y dominio propio. Tus clientes verán tu marca, no la de Guro.",
    },
    {
      key: "question8",
      question: "¿Cómo me ayuda Guro con las renovaciones?",
      answer:
        "El sistema te alerta automáticamente de pólizas próximas a vencer, prioriza por riesgo de fuga, envía recordatorios automáticos al cliente por WhatsApp/Email, y te muestra métricas de renovación en tiempo real.",
    },
  ];
  return (
    <>
      <div className="dark:bg-dark" id="faq">
        <div className="max-w-[800px] mx-auto px-4 lg:py-24 py-12">
          <h2 className="sm:text-44 text-2xl font-bold sm:!leading-[48px] leading-tight text-darklink dark:text-white text-center mb-10 sm:mb-14">
            Preguntas Frecuentes sobre Guro
          </h2>
          <Accordion className="shadow-none dark:shadow-none divide-y-1 divide-b-0 divided:border-ld !rounded-none flex flex-col gap-4">
            {Questions.map((item,index) => {
              return (
               
                  <Accordion.Panel key={index}>
                    <Accordion.Title className="focus:ring-0 px-6  text-lg text-ld py-5 border border-ld rounded-md !border-b-none">
                      {item.question}
                    </Accordion.Title>
                    <Accordion.Content className="!p-0 px-0 pt-0 rounded-none">
                      <p className="text-base text-ld opacity-80 leading-7 border border-t-0 border-ld -mt-5 px-6 py-5 rounded-b-md">
                        {item.answer}
                      </p>
                    </Accordion.Content>
                  </Accordion.Panel>
               
              );
            })}
          </Accordion>
          <p className="mt-14 text-sm font-medium justify-center text-ld opacity-80 flex flex-wrap items-center gap-1 border border-dashed w-fit mx-auto px-3 py-1.5 rounded-md">
            ¿Tienes más preguntas?{" "}
            <Link
              to="/contacto"
              className="underline hover:text-primary"
            >
              Contáctanos
            </Link>{" "}
            <span>o</span>
            <Link
              to="#demo"
              className="underline hover:text-primary"
            >
              Solicita una Demo
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};
