import React from 'react';

const PoliticaPrivacidad = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="prose max-w-none">
          <h1 className="text-3xl font-bold mb-6">Política de Privacidad - Guro</h1>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introducción</h2>
            <p className="mb-4">
              En Guro, la protección de sus datos personales es una prioridad. Esta política de privacidad
              describe cómo recopilamos, utilizamos, almacenamos y protegemos la información de nuestros
              usuarios en el contexto de nuestros servicios de gestión de seguros, incluyendo la integración
              con la API de WhatsApp de Meta para notificaciones y comunicaciones.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Información que Recopilamos</h2>
            <p className="mb-4">Recopilamos los siguientes tipos de información:</p>
            <h3 className="text-xl font-semibold mb-2">2.1 Información Personal</h3>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Nombres y apellidos</li>
              <li className="mb-2">Documentos de identificación</li>
              <li className="mb-2">Información de contacto (email, teléfono, dirección, número de WhatsApp)</li>
              <li className="mb-2">Información financiera relacionada con pólizas</li>
            </ul>
            <h3 className="text-xl font-semibold mb-2">2.2 Información de Seguros</h3>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Detalles de pólizas</li>
              <li className="mb-2">Historial de siniestros</li>
              <li className="mb-2">Información de beneficiarios</li>
              <li className="mb-2">Documentación de reclamos</li>
            </ul>
            <h3 className="text-xl font-semibold mb-2">2.3 Información de Mensajería</h3>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Consentimiento para recibir mensajes por WhatsApp</li>
              <li className="mb-2">Historial de notificaciones enviadas</li>
              <li className="mb-2">Preferencias de comunicación</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Uso de la Información</h2>
            <p className="mb-4">Utilizamos su información para:</p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Gestionar pólizas y siniestros</li>
              <li className="mb-2">Procesar cotizaciones y renovaciones</li>
              <li className="mb-2">Comunicar actualizaciones importantes</li>
              <li className="mb-2">Enviar notificaciones y recordatorios por WhatsApp</li>
              <li className="mb-2">Mejorar nuestros servicios</li>
              <li className="mb-2">Cumplir con requisitos legales</li>
              <li className="mb-2">Prevenir fraudes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Consentimiento para WhatsApp</h2>
            <p className="mb-4">
              Al registrar su número de WhatsApp en Guro, usted otorga su consentimiento explícito para recibir mensajes informativos, notificaciones, recordatorios y alertas a través de la API oficial de WhatsApp de Meta. Puede revocar este consentimiento en cualquier momento contactando a soporte o siguiendo las instrucciones en cada mensaje.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Protección de Datos</h2>
            <p className="mb-4">
              Implementamos medidas de seguridad robustas:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Encriptación de datos en tránsito y en reposo</li>
              <li className="mb-2">Autenticación de dos factores</li>
              <li className="mb-2">Monitoreo continuo de seguridad</li>
              <li className="mb-2">Copias de seguridad regulares</li>
              <li className="mb-2">Acceso restringido a datos sensibles</li>
              <li className="mb-2">Cumplimiento de las políticas de Meta para el uso de WhatsApp Business API</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Compartir Información</h2>
            <p className="mb-4">Compartimos información solo con:</p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Aseguradoras asociadas (para gestión de pólizas)</li>
              <li className="mb-2">Meta Platforms, Inc. (para el envío de mensajes por WhatsApp)</li>
              <li className="mb-2">Autoridades reguladoras (cuando sea requerido)</li>
              <li className="mb-2">Proveedores de servicios autorizados</li>
              <li className="mb-2">Terceros con consentimiento explícito</li>
            </ul>
            <p className="mb-4">
              La información transmitida a través de WhatsApp puede ser procesada y almacenada por Meta, conforme a sus políticas de privacidad.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Derechos del Usuario</h2>
            <p className="mb-4">Usted tiene derecho a:</p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Acceder a sus datos personales</li>
              <li className="mb-2">Corregir información inexacta</li>
              <li className="mb-2">Solicitar la eliminación de datos (ver instrucciones abajo)</li>
              <li className="mb-2">Limitar el procesamiento</li>
              <li className="mb-2">Recibir sus datos en formato portable</li>
              <li className="mb-2">Oponerse al procesamiento</li>
              <li className="mb-2">Revocar el consentimiento para recibir mensajes por WhatsApp</li>
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
            <h2 className="text-2xl font-semibold mb-4">8. Retención de Datos</h2>
            <p className="mb-4">
              Mantenemos sus datos mientras:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Las pólizas estén activas</li>
              <li className="mb-2">Sea requerido por ley</li>
              <li className="mb-2">Existan obligaciones pendientes</li>
              <li className="mb-2">Sea necesario para proteger derechos legales</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Cookies y Tecnologías de Seguimiento</h2>
            <p className="mb-4">
              Utilizamos cookies para:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Mantener sesiones activas</li>
              <li className="mb-2">Recordar preferencias</li>
              <li className="mb-2">Analizar uso de la plataforma</li>
              <li className="mb-2">Mejorar la experiencia del usuario</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Cambios en la Política</h2>
            <p className="mb-4">
              Podemos actualizar esta política:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Notificaremos cambios importantes</li>
              <li className="mb-2">Publicaremos actualizaciones en la plataforma</li>
              <li className="mb-2">Mantendremos versiones anteriores accesibles</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contacto</h2>
            <p className="mb-4">
              Para consultas sobre privacidad o para ejercer sus derechos:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2">Email: privacidad@guro.co</li>
              <li className="mb-2">Teléfono: +57 322 7697874</li>
              <li className="mb-2">Oficial de Protección de Datos: Juan Rivera</li>
              <li className="mb-2">Ciudad: Medellín, Colombia</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Enlaces y Políticas de Meta</h2>
            <p className="mb-4">
              Para más información sobre cómo Meta procesa los datos en WhatsApp, consulte:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li className="mb-2"><a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Política de Privacidad de WhatsApp</a></li>
              <li className="mb-2"><a href="https://www.facebook.com/policy.php" target="_blank" rel="noopener noreferrer">Política de Privacidad de Meta</a></li>
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

export default PoliticaPrivacidad; 