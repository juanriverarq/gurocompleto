<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChatbotNode;
use App\Models\ChatbotFlow;
use Illuminate\Support\Facades\DB;

$flow = ChatbotFlow::whereHas('chatbot', fn($q) => $q->where('broker_id', 53))->where('is_default', true)->first();
if (!$flow) { echo "Flow not found\n"; exit(1); }

DB::beginTransaction();
try {

$nodes = ChatbotNode::where('flow_id', $flow->id)->get()->keyBy('name');

function updateText($nodes, $name, $newText) {
    $node = $nodes->get($name);
    if (!$node) { echo "⚠️  Not found: {$name}\n"; return; }
    $config = $node->config;
    $config['text'] = $newText;
    $node->update(['config' => $config]);
    echo "✅ {$name}\n";
}

// ==========================================
// BIENVENIDA Y MENÚ PRINCIPAL
// ==========================================

updateText($nodes, 'Bienvenida',
    "¡Hola! 👋 Bienvenido a *Celeste Oriente Seguros*.\n\nSoy tu asistente y estoy aquí para ayudarte con todo lo que necesites sobre tus pólizas y seguros. 😊"
);

updateText($nodes, 'Menú Principal',
    "¿En qué te puedo colaborar hoy? Cuéntame qué necesitas 👇"
);

// ==========================================
// MENÚ SURA
// ==========================================

updateText($nodes, 'Menú Sura',
    "Perfecto, vamos con *Seguros SURA* 💙\n\n¿Qué necesitas? Escoge una opción y te guío:"
);

updateText($nodes, 'Volver Sura',
    "¿Necesitas algo más con *SURA*? Con gusto te sigo ayudando 😊"
);

// --- Contacto ---
updateText($nodes, 'Sura Contacto',
    "📞 Te comparto los datos de contacto de *SURA*. ¿Qué prefieres?"
);

updateText($nodes, 'Sura Línea',
    "Para comunicarte directamente con SURA puedes marcar al *#888* desde tu celular, es totalmente gratis 📱\n\nTambién puedes llamar al *(604) 444 0449* si prefieres línea fija."
);

updateText($nodes, 'Sura Canales',
    "Aquí tienes los canales digitales de SURA donde puedes hacer gestiones:\n\n🌐 *Portal web:* https://www.segurossura.com.co\n📲 *App SURA:* Descárgala en tu tienda de aplicaciones\n📧 *Correo:* servicioalcliente@segurossura.com.co\n\n¡Son súper prácticos para consultas rápidas!"
);

// --- Cancelaciones ---
updateText($nodes, 'Sura Cancelaciones',
    "Entiendo, necesitas cancelar una póliza. Cuéntame, ¿de qué tipo es? 👇"
);

updateText($nodes, 'Cancel Info General',
    "Para tramitar tu cancelación necesito que me envíes estos datos:\n\n📝 *Tus datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n\nEnvíamelos por aquí y en máximo *30 minuticos* te estaremos contactando para completar el trámite ✅"
);

updateText($nodes, 'Cancel Autos',
    "Para cancelar tu póliza de *Autos* necesito estos datos:\n\n📝 *Tus datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• Placa del vehículo\n\nEnvíamelos y en *30 minuticos* te contactamos 🚗"
);

updateText($nodes, 'Cancel Hogar/Emp',
    "Para cancelar tu póliza de *Hogar o Empresarial* necesito:\n\n📝 *Tus datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• Dirección del inmueble\n\nPásame esa info y en *30 minuticos* nos comunicamos contigo 🏠"
);

// --- Consultas ---
updateText($nodes, 'Sura Consultas',
    "¡Claro! ¿Qué consulta necesitas hacer? Te ayudo con lo que sea 💡"
);

updateText($nodes, 'Volver Consultas',
    "¿Te queda alguna otra duda? Estoy aquí para ayudarte 😊"
);

updateText($nodes, 'Sura Pagos',
    "💳 Para pagar tu póliza SURA puedes hacerlo fácilmente aquí:\n\n🔗 https://www.segurossura.com.co/paginas/pagos/inicio.aspx\n\nSi tienes algún problema con el pago, cuéntame y te echo una mano 🤝"
);

updateText($nodes, 'Sura Directorio',
    "Aquí te dejo el directorio médico de SURA para que busques tus especialistas y centros de atención:\n\n🔗 https://www.segurossura.com.co/paginas/directorio-medico/inicio.aspx\n\nPuedes filtrar por ciudad, especialidad y todo lo que necesites 🏥"
);

updateText($nodes, 'Sura Modificación',
    "Para modificar tu póliza necesito que me envíes:\n\n📝 *Tus datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• ¿Qué cambio necesitas hacer?\n\nEnvíame esa información y en *30 minuticos* te contactamos para hacer el ajuste ✏️"
);

updateText($nodes, 'Sura SOAT',
    "🚗 Para comprar o renovar tu *SOAT* con SURA, hazlo directamente aquí:\n\n🔗 https://www.segurossura.com.co/paginas/movilidad/soat/compra-tu-soat.aspx\n\n¡Es rápido y quedas asegurado al instante!"
);

updateText($nodes, 'Sura Vencimiento',
    "Para consultar la fecha de vencimiento de tu póliza necesito:\n\n📝 *Tus datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n\nCon esos datos verifico y te cuento en *30 minuticos* 📅"
);

updateText($nodes, 'Sura Pérdida Cob',
    "Si necesitas consultar sobre pérdida de cobertura, envíame:\n\n📝 *Tus datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n\nReviso tu caso y en *30 minuticos* te damos respuesta 📋"
);

// --- Coberturas ---
updateText($nodes, 'Sura Coberturas',
    "¿De qué tipo de seguro quieres conocer las coberturas? 🛡️"
);

updateText($nodes, 'Cob Salud',
    "Aquí puedes consultar todas las coberturas del plan de *Salud SURA*:\n\n🔗 https://www.segurossura.com.co/paginas/personas/salud/planes-de-salud.aspx\n\nSi tienes alguna duda específica sobre tu plan, con gusto te la resuelvo 💚"
);

updateText($nodes, 'Cob Vida',
    "Consulta las coberturas de tu seguro de *Vida SURA* aquí:\n\n🔗 https://www.segurossura.com.co/paginas/personas/vida/seguro-de-vida.aspx\n\nCualquier pregunta me cuentas 💛"
);

updateText($nodes, 'Cob Hogar',
    "Estas son las coberturas del seguro de *Hogar SURA*:\n\n🔗 https://www.segurossura.com.co/paginas/personas/hogar/seguro-del-hogar.aspx\n\nSi necesitas más detalle sobre alguna en particular, pregúntame 🏠"
);

updateText($nodes, 'Cob Autos',
    "Aquí encuentras todas las coberturas del seguro de *Autos SURA*:\n\n🔗 https://www.segurossura.com.co/paginas/movilidad/autos/seguro-de-autos.aspx\n\n¡Tu carro bien protegido! 🚗"
);

// --- Sedes ---
updateText($nodes, 'Sura Sedes',
    "¿Qué tipo de sede necesitas ubicar? 📍"
);

updateText($nodes, 'Sedes Salud',
    "Encuentra las sedes y centros médicos de SURA cerca de ti:\n\n🔗 https://www.segurossura.com.co/paginas/directorio-medico/inicio.aspx\n\nPuedes buscar por ciudad y especialidad 🏥"
);

updateText($nodes, 'AutoSura',
    "Ubica los centros de servicio de autos (AutoSura) aquí:\n\n🔗 https://www.segurossura.com.co/paginas/movilidad/autos/centros-de-servicio/inicio.aspx\n\nEncuentra talleres, centros de diagnóstico y más 🔧"
);

// --- Cotizaciones ---
updateText($nodes, 'Sura Cotizaciones',
    "¡Genial que quieras cotizar! 💰 ¿Qué tipo de seguro te interesa?"
);

updateText($nodes, 'Volver Cotizaciones',
    "¿Te gustaría cotizar algo más? Estoy a la orden 😊"
);

updateText($nodes, 'Cot Vida/Salud',
    "¡Excelente elección! Para cotizarte *Vida o Salud* necesito estos datos:\n\n📝 *Datos personales:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección de residencia\n• Estado civil\n• Correo electrónico\n\nEnvíamelos por aquí y en *30 minuticos* te tenemos la cotización lista 🎯"
);

updateText($nodes, 'Cot Autos',
    "Para cotizarte el seguro de *Autos* necesito:\n\n📝 *Tus datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• Estado civil y correo electrónico\n\n🚗 *Del vehículo:*\n• Marca y línea\n• Modelo (año)\n• Ciudad de circulación\n• Placa\n\nPásame esa info y en *30 minuticos* te tengo la cotización 💪"
);

updateText($nodes, 'Cot Hogar',
    "Para cotizar tu seguro de *Hogar* necesito:\n\n📝 *Tus datos:*\n• Nombres y apellidos, identificación, contacto\n• Fecha de nacimiento, dirección, estado civil, correo\n\n🏠 *Del inmueble:*\n• Dirección completa\n• Ciudad y estrato\n• Valor de la vivienda\n• Valor de los contenidos\n\nEnvíame todo y en *30 minuticos* te cotizamos 🏡"
);

updateText($nodes, 'Cot Mascotas',
    "🐾 ¡Qué bueno que quieras proteger a tu peludo!\n\nPuedes cotizar directamente aquí:\n🔗 https://surapet.com.co/asesorcliente/6486\n\nO si prefieres, envíame estos datos:\n• Nombre, edad y sexo de tu mascota\n• Raza\n• ¿Perro o gato?\n• ¿Ha tenido alguna enfermedad?\n\nY te ayudamos con la cotización 🐶🐱"
);

updateText($nodes, 'Cot Empresarial',
    "Para cotizar un seguro *Empresarial* necesito:\n\n📝 *Datos del responsable:*\n• Nombres y apellidos, identificación, contacto\n\n🏢 *De la empresa:*\n• NIT\n• Dirección\n• Actividad económica\n\nEnvíame la información y en *30 minuticos* nos comunicamos contigo con la propuesta 📊"
);

// --- Reclamaciones ---
updateText($nodes, 'Sura Reclamaciones',
    "Lamento que tengas que hacer una reclamación 😔 Pero no te preocupes, te guío paso a paso. ¿Qué tipo de reclamación es?"
);

updateText($nodes, 'Volver Reclamaciones',
    "¿Necesitas hacer otra reclamación o tienes alguna duda adicional? Estoy aquí para apoyarte 🤗"
);

updateText($nodes, 'Rec Vida',
    "Para tu reclamación de *Vida* necesito que me envíes:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n\n📋 *Documentos:*\n• Historia clínica\n• Incapacidad (si aplica)\n• Número de cuenta o certificación bancaria\n\nEnvíame todo y en *30 minuticos* nos ponemos en contacto contigo para acompañarte en el proceso 💙"
);

updateText($nodes, 'Rec Hogar Daños',
    "Para tu reclamación de *daños en hogar* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos, identificación, contacto\n• Dirección del inmueble\n\n📋 *Documentos:*\n• Carta de reclamo\n• Informe técnico del daño\n• Fotos de los daños\n• Cotización de reparación\n\nEnvíame todo y en *30 minuticos* te contactamos para seguir con el trámite 🏠"
);

updateText($nodes, 'Rec Hogar Hurtos',
    "Para tu reclamación de *hurto en hogar* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos, identificación, contacto\n• Dirección del inmueble\n\n📋 *Documentos:*\n• Carta de reclamo\n• Denuncia ante la Fiscalía\n• Cotización de reposición de los bienes\n\nSé que es una situación difícil, pero estamos para ayudarte. Envíame la documentación y en *30 minuticos* te contactamos 🤝"
);

updateText($nodes, 'Rec Autos Sura',
    "🚗 Para reportar un siniestro de *Autos SURA*, lo más rápido es comunicarte directamente al *#888* desde tu celular.\n\nEllos te guían en todo el proceso al instante. ¡Ánimo, que todo tiene solución! 💪"
);

// --- Reembolsos ---
updateText($nodes, 'Sura Reembolsos',
    "Entendido, necesitas un reembolso. ¿De qué tipo es? Te cuento qué necesitas 💸"
);

updateText($nodes, 'Volver Reembolsos',
    "¿Necesitas algo más con reembolsos? Pregúntame lo que sea 😊"
);

updateText($nodes, 'Reemb Terapia',
    "Para tu reembolso de *terapias* voy a enviarte un video explicativo que te muestra el paso a paso 📹\n\n📋 *Documentos que necesitas tener listos:*\n• Planilla de asistencia a las terapias\n• Factura de pago\n• Orden médica\n\nSi tienes alguna duda después de ver el video, me escribes 😊"
);

updateText($nodes, 'Reemb Consulta',
    "Para tu reembolso de *consultas médicas* te voy a compartir un video con el paso a paso 📹\n\n📋 *Lo que necesitas:*\n• Factura de la atención\n\n¡Es un trámite sencillo! Si te surge alguna pregunta, aquí estoy 👍"
);

updateText($nodes, 'Reemb Pagos',
    "Para gestionar tu reembolso de *pagos* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n\nEnvíamelos y en *30 minuticos* nos comunicamos para resolver tu caso 💰"
);

// --- Solicitudes ---
updateText($nodes, 'Sura Solicitudes',
    "¿Qué solicitud necesitas hacer? Te ayudo con el trámite 📝"
);

updateText($nodes, 'Volver Solicitudes',
    "¿Hay algo más que pueda hacer por ti? Estoy para servirte 😊"
);

updateText($nodes, 'Sol Domicilio',
    "🏥 Para solicitar *Salud en casa* puedes llamar directamente a SURA al *#888 opción 0*.\n\nTe atienden rápido y coordinan todo contigo. ¡Cuídate mucho! 💚"
);

updateText($nodes, 'Sol Autorizaciones',
    "Para tramitar una *autorización* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n\n📋 *Documentos:*\n• Orden médica\n• Historia clínica\n\nEnvíame todo por aquí y en *30 minuticos* te contactamos para darle trámite 📋"
);

updateText($nodes, 'Sol EPS',
    "Para *transcribir una incapacidad* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n\n📋 *Documentos:*\n• Historia clínica\n• Epicrisis\n• Incapacidad\n\nPásame esa info y en *30 minuticos* nos comunicamos contigo ✅"
);

updateText($nodes, 'Sol Medicamentos',
    "💊 Para lo de *medicamentos* te voy a compartir un instructivo paso a paso que te explica todo el proceso.\n\n¡Es muy fácil! Si después tienes alguna duda, me escribes 😊"
);

updateText($nodes, 'Sol Odonto',
    "🦷 Para *urgencias odontológicas* te comparto la información y puedes comunicarte al *#888 opción 0* para agendar.\n\n¡No dejes pasar la molestia, atiéndela rápido! 💪"
);

updateText($nodes, 'Sol Muestras',
    "🩺 Para solicitar *toma de muestras a domicilio* puedes hacerlo directamente aquí:\n\n🔗 https://seguros.comunicaciones.sura.com/toma-de-muestras-a-domicilio\n\n¡Súper cómodo desde tu casa! 🏠"
);

// ==========================================
// OTRAS COMPAÑÍAS
// ==========================================

updateText($nodes, 'Menú Otras',
    "Perfecto, vamos con las *otras compañías* (Allianz, Bolívar, Mapfre, SBS, Qualitas) 📋\n\n¿Qué necesitas? Escoge y te ayudo:"
);

updateText($nodes, 'Volver Otras',
    "¿Necesitas algo más con otra compañía? Aquí estoy para lo que sea 😊"
);

updateText($nodes, 'Otras Asistencia',
    "📞 Aquí te dejo las líneas de *asistencia* de cada compañía (son gratuitas desde el celular):\n\n• *Mapfre:* #624\n• *Allianz:* #265\n• *Bolívar:* #322\n• *SBS:* #360\n• *Qualitas:* #963\n\nLlámalos directamente si necesitas ayuda inmediata 🤝"
);

// --- Otras Cancelaciones ---
updateText($nodes, 'Otras Cancelaciones',
    "Entendido, necesitas cancelar una póliza. ¿De qué tipo es?"
);

updateText($nodes, 'Otras Cancel Hogar',
    "Para cancelar tu póliza de *Hogar* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• Dirección del inmueble\n\nEnvíame esa info y en *30 minuticos* nos comunicamos contigo para procesar la cancelación 🏠"
);

updateText($nodes, 'Otras Cancel Autos',
    "Para cancelar tu póliza de *Autos* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• Placa del vehículo\n\nPásame los datos y en *30 minuticos* te contactamos 🚗"
);

// --- Otras Coberturas ---
updateText($nodes, 'Otras Coberturas',
    "¿De qué compañía quieres consultar las coberturas de *Autos*? 🚗"
);

updateText($nodes, 'Cob Allianz',
    "Aquí puedes consultar las coberturas de *Autos Allianz*:\n\n🔗 https://www.allianz.co/seguros/vehiculos/Autos.html\n\nSi tienes alguna duda sobre tu póliza, pregúntame 😊"
);

updateText($nodes, 'Cob Bolívar',
    "Consulta las coberturas de *Autos Bolívar* aquí:\n\n🔗 https://www.segurosbolivar.com/seguros-para-carros-integral\n\n¡Tu carro bien cubierto! 🚗"
);

updateText($nodes, 'Cob Qualitas',
    "Las coberturas de *Autos Qualitas* las encuentras aquí:\n\n🔗 https://www.qualitascolombia.com.co/web/qco/livianos\n\nCualquier pregunta me cuentas 👍"
);

updateText($nodes, 'Cob SBS',
    "Aquí están las coberturas de *Autos SBS*:\n\n🔗 https://www.sbseguros.co/seguros-autos/carros\n\n¡Revísalas con calma y si tienes preguntas, aquí estoy! 😊"
);

updateText($nodes, 'Cob Mapfre',
    "Las coberturas de *Autos Mapfre* las puedes ver aquí:\n\n🔗 https://www.mapfre.com.co/seguros-carros/familiar/\n\n¡Están muy completas! 🛡️"
);

// --- Otras Cotizaciones ---
updateText($nodes, 'Otras Cotizaciones',
    "¡Bien! ¿Qué tipo de seguro quieres cotizar? 💰"
);

updateText($nodes, 'Otras Cot Salud',
    "Para cotizarte *Salud* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación y contacto\n• Fecha de nacimiento\n• Dirección, estado civil, correo\n\nEnvíamelos y en *30 minuticos* te tenemos opciones listas 💚"
);

updateText($nodes, 'Otras Cot Autos',
    "Para cotizar *Autos* necesito:\n\n📝 *Tus datos:*\n• Nombres y apellidos, identificación, contacto\n• Estado civil y correo\n\n🚗 *Del vehículo:*\n• Marca, modelo, ciudad y placa\n\nPásame esa info y en *30 minuticos* te contactamos con la cotización 🏎️"
);

updateText($nodes, 'Otras Cot Hogar',
    "Para cotizar *Hogar* necesito:\n\n📝 *Tus datos personales completos*\n\n🏠 *Del inmueble:*\n• Dirección, ciudad, estrato\n• Valor de la vivienda y contenidos\n\nEnvíame todo y en *30 minuticos* te tengo la propuesta 🏡"
);

updateText($nodes, 'Otras Cot Emp',
    "Para cotizar un seguro *Empresarial* necesito:\n\n📝 *Datos:*\n• Nombres, identificación, contacto\n• NIT de la empresa\n• Dirección y actividad económica\n\nEnvíame la info y en *30 minuticos* te contactamos con la propuesta 🏢"
);

// --- Otras Reclamaciones ---
updateText($nodes, 'Otras Reclamaciones',
    "Entiendo, necesitas hacer una reclamación. ¿De qué tipo es? Te guío 👇"
);

updateText($nodes, 'Otras Rec Autos',
    "🚗 Para generar un siniestro de *Autos*, llama directamente a tu aseguradora:\n\n• *Bolívar:* #322\n• *Mapfre:* #624\n• *Allianz:* #265\n\nEllos te atienden al instante y te indican los pasos a seguir. ¡Ánimo! 💪"
);

updateText($nodes, 'Otras Rec Hurtos',
    "Para reclamar por *hurto en hogar*, primero comunícate con tu aseguradora:\n\n• *Allianz:* #265\n• *Bolívar:* #322\n• *Mapfre:* #624\n\n📋 *Documentos que necesitarás:*\n• Carta de reclamo\n• Denuncia ante la Fiscalía\n• Cotización de reposición\n\nSé que es difícil, pero estamos para apoyarte 🤝"
);

updateText($nodes, 'Otras Rec Daños',
    "Para reclamar por *daños en hogar o empresa*, comunícate con tu aseguradora:\n\n• *Mapfre:* #624\n• *Bolívar:* #322\n• *Allianz:* #265\n\n📋 *Documentos que necesitarás:*\n• Carta de reclamo\n• Informe técnico\n• Fotos de los daños\n• Cotización de reparación\n\nTe acompañamos en todo el proceso 🏠"
);

// --- Otras Pagos ---
updateText($nodes, 'Otras Pagos',
    "💳 ¿De qué compañía necesitas hacer el pago? Selecciona y te doy el link:"
);

updateText($nodes, 'Pago Allianz',
    "Para pagar tu póliza de *Allianz*, hazlo aquí:\n\n🔗 https://gateway1.ecollect.co/eCollectPlus/Default.aspx\n\n¡Listo, fácil y rápido! ✅"
);

updateText($nodes, 'Pago Bolívar',
    "Paga tu póliza de *Bolívar* aquí:\n\n🔗 https://recaudos.segurosbolivar.com/login\n\n¡En unos minutos quedas al día! 💳"
);

updateText($nodes, 'Pago Mapfre',
    "Para pagar tu póliza de *Mapfre*, ingresa aquí:\n\n🔗 https://cotiza.mapfre.com.co/pagosWeb/vista/paginas/noFilterIniPagosPublico.jsf\n\n¡Súper sencillo! ✅"
);

updateText($nodes, 'Pago SBS',
    "Paga tu póliza de *SBS* aquí:\n\n🔗 https://www.sbseguros.co/servicio-al-cliente/alternativas-pagos\n\nTienen varias opciones de pago para tu comodidad 💰"
);

updateText($nodes, 'Pago Qualitas',
    "Para pagar tu póliza de *Qualitas*, ingresa aquí:\n\n🔗 https://www.qualitascolombia.com.co/pago-de-poliza\n\n¡Queda al día en segundos! ⚡"
);

// --- Otras Fecha Pago ---
updateText($nodes, 'Otras Fecha Pago',
    "Para consultar tu *fecha límite de pago*, ¿de qué tipo de póliza es? 📅"
);

updateText($nodes, 'Fecha Hogar',
    "Para consultar la fecha de pago de tu póliza de *Hogar* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• Dirección del inmueble\n\nEnvíame la info y en *30 minuticos* te damos la respuesta 📅"
);

updateText($nodes, 'Fecha Autos',
    "Para consultar la fecha de pago de tu póliza de *Autos* necesito:\n\n📝 *Datos:*\n• Nombres y apellidos completos\n• Número de identificación\n• Número de contacto\n• Placa del vehículo\n\nPásame los datos y en *30 minuticos* te confirmamos la fecha 🚗"
);

DB::commit();
echo "\n🎉 Todos los mensajes actualizados con tono cálido y profesional\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
}
