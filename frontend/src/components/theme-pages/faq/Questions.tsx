
import { Accordion } from "flowbite-react";

const faqPage = [
  {
    question: "¿Cómo accedo a mi cuenta y verifico mi email?",
    answer:
      "Inicia sesión con tu cuenta de Google o correo y contraseña. Si es tu primer ingreso, te enviaremos un correo de verificación. Revisa tu bandeja y haz clic en el enlace para activar tu cuenta.",
  },
  {
    question: "¿Cómo creo o selecciono mi broker (agencia)?",
    answer:
      "Ve a Apps > SaaS > Dashboard. Si no tienes broker activo, sigue el asistente de onboarding para crearlo. Si ya tienes uno, se selecciona automáticamente como broker principal.",
  },
  {
    question: "¿Cómo registro clientes y gestiono sus datos?",
    answer:
      "Navega a Seguros > Clientes. Usa 'Nuevo Cliente' para crear uno y 'Lista de Clientes' para buscar, filtrar y editar. Todos los listados están paginados y filtrados por tu broker.",
  },
  {
    question: "¿Cómo emito pólizas y llevo el seguimiento?",
    answer:
      "Ingresa a Seguros > Pólizas. Desde 'Emitir Nueva Póliza' crea pólizas; en 'Gestión de Pólizas' puedes ver, filtrar y actualizar estados. Las renovaciones están en Seguros > Renovaciones.",
  },
  {
    question: "¿Cómo gestiono siniestros?",
    answer:
      "Accede a Seguros > Siniestros para reportar nuevos, ver activos y consultar historial. Puedes adjuntar documentos y ver estados de trámite.",
  },
  {
    question: "¿Cómo uso WhatsApp y envío mensajes masivos?",
    answer:
      "En Apps > SaaS > WhatsApp conecta tu instancia (QR). Para envíos masivos, usa las funciones habilitadas en Marketing > WhatsApp o módulos específicos. Respeta límites para evitar bloqueos.",
  },
  {
    question: "¿Cómo recargo saldo del Wallet y en qué moneda se muestra?",
    answer:
      "Abre el widget del Wallet en el encabezado. El saldo se muestra en la moneda configurada del broker (COP o USD). Para recargar, usa el botón de recarga (Wompi) y sigue las instrucciones.",
  },
  {
    question: "¿Cómo administrar empleados, roles y permisos?",
    answer:
      "Ve a Administración > Gestión de Usuarios y a SaaS > Empleados. Crea usuarios, asigna roles y limita accesos por módulo y acción.",
  },
  {
    question: "¿Cómo integro servicios externos (APIs, Webhooks)?",
    answer:
      "Abre Integraciones > Webhooks/APIs para gestionar tokens, endpoints y suscripciones. Revisa la documentación y prueba en sandbox antes de producción.",
  },
  {
    question: "¿Qué hacer si tengo errores de acceso o rendimiento?",
    answer:
      "Verifica tu conexión (o VPN), vuelve a iniciar sesión y borra caché del navegador. Si persiste, contacta soporte con fecha/hora del error y acción realizada.",
  },
];

const Questions = () => {
  return (
    <>
      <div className="flex justify-center py-10">
        <div className="max-w-xl ">
          <h2 className="text-2xl text-center mb-3">Preguntas Frecuentes (FAQ)</h2>
          <p className="text-bodytext text-base">Respuestas rápidas sobre el uso de la plataforma</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto bg-white rounded-tw dark:bg-darkgray">
        <Accordion collapseAll >
          {faqPage.map((faq, i) => (
            <Accordion.Panel key={i} className="bg-white dark:bg-dark">
              <Accordion.Title>{faq.question}</Accordion.Title>
              <Accordion.Content>{faq.answer}</Accordion.Content>
            </Accordion.Panel>
          ))}
        </Accordion>
      </div>
    </>
  );
};

export default Questions;
