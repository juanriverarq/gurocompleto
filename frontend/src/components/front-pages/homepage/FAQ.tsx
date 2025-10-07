import { Accordion } from "flowbite-react";
import { Link } from "react-router";


export const FAQ = () => {
  const Questions = [
    {
      key: "question1",
      question: "¿Cómo funciona el asistente de IA en Guro?",
      answer:
        "Nuestro asistente de IA está entrenado específicamente en el sector de seguros. Puedes pedirle que cree pólizas, genere reportes, analice perfiles de clientes, e incluso que asigne tareas a tu equipo usando lenguaje natural.",
    },
    {
      key: "question2",
      question: "¿Qué tan precisa es la lectura automática de documentos?",
      answer:
        "Nuestra tecnología de IA tiene una precisión del 98% en la extracción de datos de pólizas, contratos y documentos legales. El sistema aprende continuamente y mejora con cada documento procesado.",
    },
    {
      key: "question3",
      question: "¿Cómo identifica Guro las oportunidades de ventas cruzadas?",
      answer:
        "Guro analiza automáticamente el perfil completo de cada cliente: edad, historial de pólizas, cambios de vida, patrones de pago y más. Usando IA predictiva, identifica qué productos tienen mayor probabilidad de éxito para cada cliente específico.",
    },
    {
      key: "question4",
      question: "¿Mis datos están seguros en Guro?",
      answer:
        "Absolutamente. Utilizamos encriptación de grado bancario, cumplimos con todas las regulaciones de protección de datos y nunca compartimos información confidencial. Tus datos permanecen completamente privados y seguros.",
    },
    {
      key: "question5",
      question: "¿Puedo integrar Guro con mis sistemas actuales?",
      answer:
        "Sí, Guro está diseñado para integrarse fácilmente con los principales sistemas de gestión de seguros, CRMs y bases de datos. Nuestro equipo te ayuda con la migración sin interrumpir tu operación.",
    },
    {
      key: "question6",
      question: "¿Necesito entrenar a mi equipo para usar Guro?",
      answer:
        "Guro está diseñado para ser intuitivo. La mayoría de nuestros clientes empiezan a ver resultados el primer día. Incluimos capacitación personalizada y soporte continuo para maximizar tu inversión.",
    },
  ];
  return (
    <>
      <div className="dark:bg-dark" id="faq">
        <div className="max-w-[800px] mx-auto px-5 lg:py-24 py-12">
          <h2 className="sm:text-44 text-3xl font-bold !leading-[48px] text-darklink dark:text-white text-center mb-14">
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
