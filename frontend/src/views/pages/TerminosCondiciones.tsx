import React from 'react';

const TerminosCondiciones = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="prose max-w-none">
          <h1 className="text-3xl font-bold mb-6">Términos y Condiciones de Uso - Guro</h1>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introducción</h2>
            <p className="mb-4">
              Bienvenido a Guro, la plataforma integral de gestión de seguros. Al acceder y utilizar nuestra plataforma,
              usted acepta estos términos y condiciones en su totalidad. Este acuerdo establece los términos legalmente
              vinculantes para el uso de nuestros servicios, incluyendo la integración con la API de WhatsApp de Meta para
              notificaciones, atención y comunicaciones automatizadas.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Definiciones</h2>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">"Plataforma" se refiere a Guro y todos sus servicios asociados, incluyendo la integración con WhatsApp Business API de Meta.</li>
              <li className="mb-2">"Usuario" se refiere a corredores de seguros, agentes, administradores y clientes que acceden a la plataforma.</li>
              <li className="mb-2">"Servicios" incluye la gestión de pólizas, siniestros, cotizaciones, renovaciones, notificaciones y comunicaciones vía WhatsApp.</li>
              <li className="mb-2">"Contenido" se refiere a toda la información, datos, documentos y archivos relacionados con seguros en la plataforma.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Uso de WhatsApp y Consentimiento</h2>
            <p className="mb-4">
              Al utilizar Guro, usted autoriza expresamente a la plataforma a enviarle notificaciones, recordatorios, alertas y mensajes informativos a través de WhatsApp, utilizando la API oficial de Meta. El usuario reconoce y acepta que:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Guro podrá enviar mensajes automáticos y personalizados a su número de WhatsApp registrado.</li>
              <li className="mb-2">El usuario puede solicitar en cualquier momento la baja de las notificaciones por WhatsApp, siguiendo las instrucciones en cada mensaje o contactando a soporte.</li>
              <li className="mb-2">El uso de WhatsApp está sujeto a los Términos de Servicio y Política de Privacidad de Meta Platforms, Inc.</li>
              <li className="mb-2">La información compartida a través de WhatsApp puede ser procesada y almacenada por Meta, conforme a sus políticas.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Servicios de la Plataforma</h2>
            <p className="mb-4">
              Guro proporciona los siguientes servicios principales:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Gestión integral de pólizas de seguros</li>
              <li className="mb-2">Procesamiento y seguimiento de siniestros</li>
              <li className="mb-2">Sistema de cotizaciones automatizado</li>
              <li className="mb-2">Gestión de renovaciones y vencimientos</li>
              <li className="mb-2">Herramientas de análisis y reportes</li>
              <li className="mb-2">Integración con aseguradoras</li>
              <li className="mb-2">Gestión de documentos y archivos digitales</li>
              <li className="mb-2">Notificaciones y comunicaciones vía WhatsApp</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Responsabilidades del Usuario</h2>
            <p className="mb-4">
              Al utilizar Guro, usted se compromete a:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Proporcionar información precisa y actualizada sobre pólizas, clientes y su número de WhatsApp.</li>
              <li className="mb-2">Mantener la confidencialidad de las credenciales de acceso.</li>
              <li className="mb-2">Cumplir con todas las regulaciones aplicables del sector asegurador y de protección de datos.</li>
              <li className="mb-2">Utilizar la plataforma de manera ética y profesional.</li>
              <li className="mb-2">Proteger la información confidencial de los clientes.</li>
              <li className="mb-2">Mantener actualizada la información de contacto y perfiles.</li>
              <li className="mb-2">No utilizar WhatsApp para fines ilícitos o no autorizados.</li>
              <li className="mb-2">Solicitar la eliminación de sus datos personales cuando lo desee (ver instrucciones abajo).</li>
            </ul>
          </section>

          <section className="mb-8 bg-gray-50 rounded p-4 border border-gray-200">
            <h2 className="text-2xl font-semibold mb-4">Eliminación de datos personales</h2>
            <p className="mb-4">Si deseas eliminar tu información personal de nuestra plataforma, sigue estos pasos:</p>
            <ol className="list-decimal pl-6 mb-4">
              <li>Envía un correo electrónico a <b>datos@guro.co</b> desde la dirección registrada en tu cuenta.</li>
              <li>En el asunto escribe: <b>Solicitud de eliminación de datos personales</b>.</li>
              <li>En el cuerpo del mensaje incluye tu nombre completo, número de documento y número de WhatsApp registrado.</li>
              <li>Nuestro equipo confirmará la recepción y procederá con la eliminación de tus datos en un plazo máximo de 10 días hábiles, notificándote por correo electrónico y/o WhatsApp.</li>
            </ol>
            <p>Si tienes dudas sobre este proceso, puedes contactarnos a privacidad@guro.co.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Privacidad y Seguridad</h2>
            <p className="mb-4">
              La seguridad y privacidad son fundamentales en Guro:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Implementamos encriptación de datos de extremo a extremo.</li>
              <li className="mb-2">Cumplimos con estándares internacionales de seguridad y las políticas de Meta para el uso de WhatsApp Business API.</li>
              <li className="mb-2">Realizamos copias de seguridad regulares.</li>
              <li className="mb-2">Mantenemos registros detallados de acceso y cambios.</li>
              <li className="mb-2">Protegemos la información sensible según normativas vigentes.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Propiedad Intelectual</h2>
            <p className="mb-4">
              Todo el contenido y software de Guro está protegido por derechos de autor y otras leyes de propiedad intelectual:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">La interfaz, diseño y funcionalidades son propiedad exclusiva de Guro.</li>
              <li className="mb-2">Los usuarios mantienen la propiedad de sus datos y documentos.</li>
              <li className="mb-2">Las integraciones y desarrollos personalizados son propiedad de Guro.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Limitación de Responsabilidad</h2>
            <p className="mb-4">
              Guro no será responsable por:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Errores en la información proporcionada por usuarios o aseguradoras.</li>
              <li className="mb-2">Interrupciones temporales del servicio por mantenimiento.</li>
              <li className="mb-2">Decisiones tomadas por usuarios basadas en la información de la plataforma.</li>
              <li className="mb-2">Pérdidas indirectas o consecuentes del uso de la plataforma.</li>
              <li className="mb-2">Mensajes no entregados o retrasados por causas ajenas a Guro o Meta.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Soporte y Contacto</h2>
            <p className="mb-4">
              Para asistencia y soporte:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Email: soporte@guro.co</li>
              <li className="mb-2">Teléfono: +57 322 7697874</li>
              <li className="mb-2">Chat en vivo: Disponible en horario laboral</li>
              <li className="mb-2">Centro de ayuda: help.guro.co</li>
              <li className="mb-2">Ciudad: Medellín, Colombia</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Modificaciones y Actualizaciones</h2>
            <p className="mb-4">
              Guro se reserva el derecho de actualizar estos términos:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Los cambios serán notificados con anticipación.</li>
              <li className="mb-2">Las actualizaciones importantes requerirán aceptación explícita.</li>
              <li className="mb-2">Los usuarios pueden revisar el historial de cambios.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Ley Aplicable</h2>
            <p className="mb-4">
              Estos términos se rigen por las leyes de Colombia y las políticas de Meta Platforms, Inc. para el uso de WhatsApp Business API:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Cumplimos con la regulación de seguros colombiana.</li>
              <li className="mb-2">Adherimos a las normas de protección de datos personales.</li>
              <li className="mb-2">Las disputas se resolverán en tribunales colombianos.</li>
            </ul>
          </section>

          <div className="mt-8 text-sm text-gray-600">
            <p>Última actualización: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminosCondiciones; 