<?php
/**
 * Rebuild chatbot for Celeste Oriente (broker_id=53)
 * Deletes existing chatbot and creates fresh with properly connected nodes.
 * Run: /opt/cpanel/ea-php83/root/usr/bin/php rebuild_celeste_chatbot.php
 */
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Chatbot;
use App\Models\ChatbotFlow;
use App\Models\ChatbotNode;
use App\Models\ChatbotTrigger;
use Illuminate\Support\Facades\DB;

$BROKER_ID = 53;

// Delete existing
$existing = Chatbot::where('broker_id', $BROKER_ID)->first();
if ($existing) {
    echo "🗑️  Eliminando chatbot anterior ID={$existing->id}...\n";
    $existing->delete();
}

DB::beginTransaction();
try {

// ============================================================
// 1. CHATBOT
// ============================================================
$bot = Chatbot::create([
    'broker_id' => $BROKER_ID,
    'name' => 'Asistente Celeste Oriente',
    'description' => 'Chatbot para Seguros Celeste Oriente - Proyectamos Seguros',
    'is_active' => true,
    'welcome_message' => "¡Hola! 👋 Bienvenido a *Celeste Oriente - Proyectamos Seguros*.",
    'fallback_message' => "No entendí tu mensaje. Escribe *menú* para ver las opciones.",
    'goodbye_message' => "¡Gracias por contactarnos! 🙌",
    'ai_enabled' => false,
    'ai_provider' => 'none',
    'typing_delay_ms' => 800,
    'response_delay_ms' => 500,
    'session_timeout_minutes' => 30,
    'max_fallback_count' => 3,
]);
echo "✅ Chatbot ID={$bot->id}\n";

// ============================================================
// 2. FLOW
// ============================================================
$flow = ChatbotFlow::create([
    'chatbot_id' => $bot->id,
    'name' => 'Flujo Principal',
    'description' => 'Menú completo por compañía',
    'is_default' => true,
    'is_active' => true,
]);
echo "✅ Flow ID={$flow->id}\n";

// Helper: create node
function n($flow, $type, $name, $config) {
    return ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => $type,
        'name' => $name,
        'position_x' => 0,
        'position_y' => 0,
        'config' => $config,
    ]);
}

// Helper: question node with text + options (options get next_node_id filled later)
function q($flow, $name, $text, $optionLabels) {
    $options = [];
    foreach ($optionLabels as $value => $label) {
        $options[] = ['label' => $label, 'value' => $value, 'next_node_id' => null];
    }
    return ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => $name,
        'position_x' => 0,
        'position_y' => 0,
        'config' => ['text' => $text, 'options' => $options],
    ]);
}

// Helper: message node
function m($flow, $name, $text) {
    return ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => $name,
        'position_x' => 0,
        'position_y' => 0,
        'config' => ['text' => $text],
    ]);
}

// Helper: wire option routes into a question node
function wire($node, $routes) {
    $config = $node->config;
    foreach ($config['options'] as &$opt) {
        if (isset($routes[$opt['value']])) {
            $opt['next_node_id'] = $routes[$opt['value']]->id;
        }
    }
    $node->update(['config' => $config]);
}

// Helper: chain message -> question (next_node_id)
function chain($from, $to) {
    $from->update(['next_node_id' => $to->id]);
}

// ============================================================
// 3. NODES
// ============================================================

// --- Start & Welcome ---
$start = n($flow, 'start', 'Inicio', []);
$welcome = m($flow, 'Bienvenida', "¡Hola! 👋 Bienvenido a *Celeste Oriente - Proyectamos Seguros*.\n\nSoy tu asistente virtual. ¿En qué te puedo ayudar?");

// --- MENÚ PRINCIPAL ---
$menuPrincipal = q($flow, 'Menú Principal', "¿Con cuál compañía de seguros necesitas ayuda?", [
    'sura' => '1️⃣ Sura',
    'otras' => '2️⃣ Otras Compañías (Allianz, Bolívar, Mapfre, SBS, Qualitas)',
    'asesor' => '3️⃣ Hablar con un asesor',
]);

// --- TRANSFER ---
$transfer = n($flow, 'transfer', 'Transferir a asesor', [
    'text' => "Te estamos transfiriendo con un asesor humano. En breve te atenderemos. 🙏",
]);

// ============================================================
// SURA
// ============================================================
$menuSura = q($flow, 'Menú Sura', "📋 *SURA* - ¿Qué necesitas?", [
    'contacto' => '1️⃣ Contacto / Asistencia',
    'cancelaciones' => '2️⃣ Cancelaciones',
    'consultas' => '3️⃣ Consultas',
    'cotizaciones' => '4️⃣ Cotizaciones',
    'reclamaciones' => '5️⃣ Reclamaciones',
    'reembolsos' => '6️⃣ Reembolsos',
    'solicitudes' => '7️⃣ Solicitudes',
    'volver' => '🔙 Volver al menú principal',
]);

// --- Pregunta ¿Algo más? (reutilizable para Sura) ---
$volverSura = q($flow, 'Volver Sura', "¿Necesitas algo más?", [
    'sura' => '🔙 Volver a Sura',
    'principal' => '🏠 Menú principal',
]);

// ---- SURA > CONTACTO ----
$suraContacto = q($flow, 'Sura Contacto', "📞 *Contacto SURA*\n\nSelecciona una opción:", [
    'linea' => '1️⃣ Líneas de asistencia',
    'canales' => '2️⃣ Canales de contacto',
    'volver' => '🔙 Volver',
]);
$suraLinea = m($flow, 'Sura Línea', "📞 *Línea de asistencia Sura:* #888\n\nMarca desde tu celular para atención inmediata.");
$suraCanales = m($flow, 'Sura Canales', "📱 *Medios de contacto Proyectamos Seguros:*\n\n• Cartera: 3046454852\n• Info general: 3006748706\n• Fijo: 604 3121180\n• Facebook: https://www.facebook.com/proyectamosseguros\n• Página: https://proyectamosseguros.com/\n• José Muñoz: 3104493791\n• Sandra Álvarez: 3217000303");
chain($suraLinea, $volverSura);
chain($suraCanales, $volverSura);
wire($suraContacto, ['linea' => $suraLinea, 'canales' => $suraCanales, 'volver' => $menuSura]);

// ---- SURA > CANCELACIONES ----
$suraCancelMenu = q($flow, 'Sura Cancelaciones', "❌ *Cancelaciones SURA*\n\n¿Qué póliza deseas cancelar?", [
    'vida' => '1️⃣ Vida (Individual/Grupo)',
    'salud' => '2️⃣ Salud / PAC',
    'autos' => '3️⃣ Autos',
    'hogar' => '4️⃣ Hogar',
    'empresarial' => '5️⃣ Empresarial',
    'mascotas' => '6️⃣ Mascotas',
    'otra' => '7️⃣ Otra póliza',
    'volver' => '🔙 Volver',
]);
$cancelGeneric = m($flow, 'Cancel Info General', "Para gestionar tu cancelación necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEnvíalos por este chat y en *30 minutos aprox.* nos comunicaremos contigo.");
$cancelAutos = m($flow, 'Cancel Autos', "Para cancelar tu póliza de *Autos* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🚗 *Dato del vehículo:*\n• Placa\n\nEnvíalos y en *30 minutos aprox.* nos comunicaremos contigo.");
$cancelHogar = m($flow, 'Cancel Hogar/Emp', "Para cancelar tu póliza de *Hogar/Empresarial* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🏠 *Dato del inmueble:*\n• Dirección\n\nEnvíalos y en *30 minutos aprox.* nos comunicaremos contigo.");
chain($cancelGeneric, $volverSura);
chain($cancelAutos, $volverSura);
chain($cancelHogar, $volverSura);
wire($suraCancelMenu, [
    'vida' => $cancelGeneric, 'salud' => $cancelGeneric, 'mascotas' => $cancelGeneric, 'otra' => $cancelGeneric,
    'autos' => $cancelAutos, 'hogar' => $cancelHogar, 'empresarial' => $cancelHogar,
    'volver' => $menuSura,
]);

// ---- SURA > CONSULTAS ----
$suraConsultas = q($flow, 'Sura Consultas', "🔎 *Consultas SURA*", [
    'pagos' => '1️⃣ Pagos de póliza',
    'directorio' => '2️⃣ Directorio médico / Citas',
    'modificacion' => '3️⃣ Modificación de póliza',
    'soat' => '4️⃣ Vigencia SOAT',
    'vencimiento' => '5️⃣ Vencimiento de póliza',
    'coberturas' => '6️⃣ Coberturas',
    'sedes' => '7️⃣ Sedes / AutoSura',
    'perdida' => '8️⃣ Pérdida de cobertura',
    'volver' => '🔙 Volver',
]);

$volverConsultas = q($flow, 'Volver Consultas', "¿Necesitas algo más?", [
    'consultas' => '🔙 Volver a Consultas',
    'sura' => '🔙 Volver a Sura',
    'principal' => '🏠 Menú principal',
]);

$suraPagos = m($flow, 'Sura Pagos', "💳 *Pago de póliza Sura*\n\nRealiza tu pago aquí:\n🔗 https://www.segurossura.com.co/paginas/pago-express.aspx/");
$suraDirectorio = m($flow, 'Sura Directorio', "🏥 *Directorio Médico Sura*\n\nConsulta y agenda cita:\n🔗 https://www.segurossura.com.co/paginas/salud/directorio-medico.aspx");
$suraModificacion = m($flow, 'Sura Modificación', "✏️ *Modificación de póliza de salud*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Tipo de póliza\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$suraSoat = m($flow, 'Sura SOAT', "🚗 *Vigencia del SOAT*\n\nValida directamente en el *RUNT* o en la *app Sura*.");
$suraVencimiento = m($flow, 'Sura Vencimiento', "📅 *Vencimiento de póliza*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Placa\n• Número de contacto\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$suraPerdida = m($flow, 'Sura Pérdida Cob', "⚠️ *Pérdida de cobertura - Salud*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");

foreach ([$suraPagos, $suraDirectorio, $suraModificacion, $suraSoat, $suraVencimiento, $suraPerdida] as $n) {
    chain($n, $volverConsultas);
}

// Coberturas submenu
$suraCoberturas = q($flow, 'Sura Coberturas', "📋 *Coberturas SURA*\n\nSelecciona el tipo:", [
    'salud' => '1️⃣ Salud',
    'vida' => '2️⃣ Vida Individual',
    'hogar' => '3️⃣ Hogar',
    'autos' => '4️⃣ Autos',
    'volver' => '🔙 Volver a Consultas',
]);
$cobSalud = m($flow, 'Cob Salud', "🏥 *Coberturas Salud Sura*\n🔗 https://www.segurossura.com.co/paginas/salud/planes.aspx");
$cobVida = m($flow, 'Cob Vida', "💚 *Coberturas Vida Individual Sura*\n🔗 https://www.segurossura.com.co/paginas/vida/inicio.aspx");
$cobHogar = m($flow, 'Cob Hogar', "🏠 *Coberturas Hogar Sura*\n🔗 https://www.segurossura.com.co/paginas/hogar/inicio.aspx");
$cobAutos = m($flow, 'Cob Autos', "🚗 *Coberturas Autos Sura*\n🔗 https://www.segurossura.com.co/paginas/movilidad/autos/inicio.aspx");
foreach ([$cobSalud, $cobVida, $cobHogar, $cobAutos] as $n) { chain($n, $volverConsultas); }
wire($suraCoberturas, ['salud' => $cobSalud, 'vida' => $cobVida, 'hogar' => $cobHogar, 'autos' => $cobAutos, 'volver' => $suraConsultas]);

// Sedes submenu
$suraSedes = q($flow, 'Sura Sedes', "📍 *Sedes SURA*", [
    'salud' => '1️⃣ Sedes Salud Sura',
    'autosura' => '2️⃣ AutoSura (Centros de servicio)',
    'volver' => '🔙 Volver a Consultas',
]);
$sedesSalud = m($flow, 'Sedes Salud', "🏥 *Sedes Salud Sura*\n🔗 https://www.segurossura.com.co/paginas/salud/sedes/saludsura.aspx");
$autosura = m($flow, 'AutoSura', "🚗 *AutoSura - Centros de servicio*\n🔗 https://www.segurossura.com.co/paginas/movilidad/autos/centros-de-servicio/inicio.aspx");
chain($sedesSalud, $volverConsultas);
chain($autosura, $volverConsultas);
wire($suraSedes, ['salud' => $sedesSalud, 'autosura' => $autosura, 'volver' => $suraConsultas]);

// Wire consultas
wire($suraConsultas, [
    'pagos' => $suraPagos, 'directorio' => $suraDirectorio, 'modificacion' => $suraModificacion,
    'soat' => $suraSoat, 'vencimiento' => $suraVencimiento, 'coberturas' => $suraCoberturas,
    'sedes' => $suraSedes, 'perdida' => $suraPerdida, 'volver' => $menuSura,
]);
wire($volverConsultas, ['consultas' => $suraConsultas, 'sura' => $menuSura, 'principal' => $menuPrincipal]);

// ---- SURA > COTIZACIONES ----
$suraCotizaciones = q($flow, 'Sura Cotizaciones', "💰 *Cotizaciones SURA*\n\n¿Qué seguro deseas cotizar?", [
    'vida' => '1️⃣ Vida',
    'salud' => '2️⃣ Salud',
    'autos' => '3️⃣ Autos',
    'hogar' => '4️⃣ Hogar',
    'mascotas' => '5️⃣ Mascotas',
    'empresarial' => '6️⃣ Empresarial / Otros',
    'volver' => '🔙 Volver',
]);
$volverCot = q($flow, 'Volver Cotizaciones', "¿Necesitas algo más?", [
    'cotizaciones' => '🔙 Volver a Cotizaciones',
    'sura' => '🔙 Volver a Sura',
    'principal' => '🏠 Menú principal',
]);

$cotGeneric = m($flow, 'Cot Vida/Salud', "Para cotizar necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección\n• Estado civil\n• Correo electrónico\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$cotAutos = m($flow, 'Cot Autos', "Para cotizar *Autos* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Estado civil y correo electrónico\n\n🚗 *Vehículo:*\n• Marca y modelo\n• Ciudad de circulación\n• Placa\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$cotHogar = m($flow, 'Cot Hogar', "Para cotizar *Hogar* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos, identificación, contacto\n• Fecha de nacimiento, dirección, estado civil, correo\n\n🏠 *Inmueble:*\n• Dirección, ciudad, departamento\n• Estrato, valor vivienda, valor contenidos\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$cotMascotas = m($flow, 'Cot Mascotas', "🐾 *Cotización Mascotas*\n\nCotiza directamente:\n🔗 https://surapet.com.co/asesorcliente/6486\n\nO envíanos:\n• Edad, nombre, sexo, raza\n• Perro o gato\n• ¿Ha tenido enfermedades?");
$cotEmpresarial = m($flow, 'Cot Empresarial', "Para cotizar *Empresarial* necesitamos:\n\n📝 *Datos:*\n• Nombres y apellidos, identificación, contacto\n\n🏢 *Empresa:*\n• NIT, dirección, actividad económica\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");

foreach ([$cotGeneric, $cotAutos, $cotHogar, $cotMascotas, $cotEmpresarial] as $n) { chain($n, $volverCot); }
wire($suraCotizaciones, [
    'vida' => $cotGeneric, 'salud' => $cotGeneric, 'autos' => $cotAutos,
    'hogar' => $cotHogar, 'mascotas' => $cotMascotas, 'empresarial' => $cotEmpresarial,
    'volver' => $menuSura,
]);
wire($volverCot, ['cotizaciones' => $suraCotizaciones, 'sura' => $menuSura, 'principal' => $menuPrincipal]);

// ---- SURA > RECLAMACIONES ----
$suraReclam = q($flow, 'Sura Reclamaciones', "⚡ *Reclamaciones SURA*", [
    'incapacidad' => '1️⃣ Vida - Incapacidad',
    'auxilio' => '2️⃣ Vida - Auxilio materno/paterno',
    'renta' => '3️⃣ Vida - Renta diaria',
    'hogar_danos' => '4️⃣ Hogar - Daños',
    'hogar_hurtos' => '5️⃣ Hogar - Hurtos',
    'empresarial' => '6️⃣ Empresarial - Daños',
    'autos' => '7️⃣ Autos',
    'volver' => '🔙 Volver',
]);
$volverRec = q($flow, 'Volver Reclamaciones', "¿Necesitas algo más?", [
    'reclamaciones' => '🔙 Volver a Reclamaciones',
    'sura' => '🔙 Volver a Sura',
    'principal' => '🏠 Menú principal',
]);

$recVida = m($flow, 'Rec Vida', "Para tu reclamación necesitamos:\n\n📝 *Datos:*\n• Nombres y apellidos, identificación, contacto\n\n📋 *Documentos:*\n• Historia clínica\n• Incapacidad\n• Número de cuenta o certificación bancaria\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$recHogarDanos = m($flow, 'Rec Hogar Daños', "Para tu reclamación de *daños en hogar* necesitamos:\n\n📝 *Datos:*\n• Nombres, identificación, contacto, dirección inmueble\n\n📋 *Documentos:*\n• Carta de reclamo\n• Informe técnico\n• Fotos del equipo\n• Cotización reposición\n• Certificación bancaria\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$recHogarHurtos = m($flow, 'Rec Hogar Hurtos', "Para tu reclamación de *hurto en hogar* necesitamos:\n\n📝 *Datos:*\n• Nombres, identificación, contacto, dirección inmueble\n\n📋 *Documentos:*\n• Carta de reclamo\n• Denuncia\n• Cotización reposición\n• Certificación bancaria\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$recAutos = m($flow, 'Rec Autos Sura', "🚗 *Reclamación Autos Sura*\n\nPara reportar un siniestro comunícate al *#888*.");

foreach ([$recVida, $recHogarDanos, $recHogarHurtos, $recAutos] as $n) { chain($n, $volverRec); }
wire($suraReclam, [
    'incapacidad' => $recVida, 'auxilio' => $recVida, 'renta' => $recVida,
    'hogar_danos' => $recHogarDanos, 'hogar_hurtos' => $recHogarHurtos,
    'empresarial' => $recHogarDanos, 'autos' => $recAutos,
    'volver' => $menuSura,
]);
wire($volverRec, ['reclamaciones' => $suraReclam, 'sura' => $menuSura, 'principal' => $menuPrincipal]);

// ---- SURA > REEMBOLSOS ----
$suraReemb = q($flow, 'Sura Reembolsos', "💸 *Reembolsos SURA*", [
    'terapia' => '1️⃣ Terapias',
    'consulta' => '2️⃣ Consultas',
    'pagos' => '3️⃣ Pagos generales',
    'volver' => '🔙 Volver',
]);
$volverReemb = q($flow, 'Volver Reembolsos', "¿Necesitas algo más?", [
    'reembolsos' => '🔙 Volver a Reembolsos',
    'sura' => '🔙 Volver a Sura',
    'principal' => '🏠 Menú principal',
]);

$reembTerapia = m($flow, 'Reemb Terapia', "💸 *Reembolso de terapias*\n\nTe enviaremos video explicativo.\n\n📋 *Documentos:*\n• Planilla de asistencia\n• Factura\n• Orden médica");
$reembConsulta = m($flow, 'Reemb Consulta', "💸 *Reembolso de consultas*\n\nTe enviaremos video explicativo.\n\n📋 *Documento:*\n• Factura de la atención");
$reembPagos = m($flow, 'Reemb Pagos', "Para tu reembolso necesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");

foreach ([$reembTerapia, $reembConsulta, $reembPagos] as $n) { chain($n, $volverReemb); }
wire($suraReemb, ['terapia' => $reembTerapia, 'consulta' => $reembConsulta, 'pagos' => $reembPagos, 'volver' => $menuSura]);
wire($volverReemb, ['reembolsos' => $suraReemb, 'sura' => $menuSura, 'principal' => $menuPrincipal]);

// ---- SURA > SOLICITUDES ----
$suraSolic = q($flow, 'Sura Solicitudes', "📝 *Solicitudes SURA*", [
    'domicilio' => '1️⃣ Atención domiciliaria',
    'autorizaciones' => '2️⃣ Autorizaciones',
    'eps' => '3️⃣ Transcribir incapacidad (EPS)',
    'medicamentos' => '4️⃣ Medicamentos',
    'odonto' => '5️⃣ Urgencias odontológicas',
    'muestras' => '6️⃣ Toma de muestras',
    'volver' => '🔙 Volver',
]);
$volverSol = q($flow, 'Volver Solicitudes', "¿Necesitas algo más?", [
    'solicitudes' => '🔙 Volver a Solicitudes',
    'sura' => '🔙 Volver a Sura',
    'principal' => '🏠 Menú principal',
]);

$solDomicilio = m($flow, 'Sol Domicilio', "🏥 *Salud en casa*\n\nLlama a Sura: *#888 opción 0*");
$solAuto = m($flow, 'Sol Autorizaciones', "📋 *Autorizaciones*\n\nNecesitamos:\n• Nombres, identificación, contacto\n\n📋 *Documentos:*\n• Orden médica\n• Historia clínica\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$solEps = m($flow, 'Sol EPS', "📝 *Transcribir Incapacidad*\n\nNecesitamos:\n• Nombres, identificación, contacto\n\n📋 *Documentos:*\n• Historia clínica, epicrisis, incapacidad\n\nEnvíalos y en *30 min aprox.* nos comunicaremos contigo.");
$solMed = m($flow, 'Sol Medicamentos', "💊 *Medicamentos*\n\nTe enviaremos instructivo paso a paso.");
$solOdonto = m($flow, 'Sol Odonto', "🦷 *Urgencias odontológicas*\n\nTe compartimos info y puedes llamar al *#888 opción 0*.");
$solMuestras = m($flow, 'Sol Muestras', "🩺 *Toma de muestras a domicilio*\n\nSolicita aquí:\n🔗 https://seguros.comunicaciones.sura.com/toma-de-muestras-a-domicilio");

foreach ([$solDomicilio, $solAuto, $solEps, $solMed, $solOdonto, $solMuestras] as $n) { chain($n, $volverSol); }
wire($suraSolic, [
    'domicilio' => $solDomicilio, 'autorizaciones' => $solAuto, 'eps' => $solEps,
    'medicamentos' => $solMed, 'odonto' => $solOdonto, 'muestras' => $solMuestras,
    'volver' => $menuSura,
]);
wire($volverSol, ['solicitudes' => $suraSolic, 'sura' => $menuSura, 'principal' => $menuPrincipal]);

// Wire Sura menu
wire($menuSura, [
    'contacto' => $suraContacto, 'cancelaciones' => $suraCancelMenu, 'consultas' => $suraConsultas,
    'cotizaciones' => $suraCotizaciones, 'reclamaciones' => $suraReclam,
    'reembolsos' => $suraReemb, 'solicitudes' => $suraSolic,
    'volver' => $menuPrincipal,
]);
wire($volverSura, ['sura' => $menuSura, 'principal' => $menuPrincipal]);

// ============================================================
// OTRAS COMPAÑÍAS
// ============================================================
$menuOtras = q($flow, 'Menú Otras', "📋 *Otras Compañías* (Allianz, Bolívar, Mapfre, SBS, Qualitas)", [
    'asistencia' => '1️⃣ Líneas de asistencia',
    'cancelaciones' => '2️⃣ Cancelaciones',
    'coberturas' => '3️⃣ Coberturas Autos',
    'cotizaciones' => '4️⃣ Cotizaciones',
    'reclamaciones' => '5️⃣ Reclamaciones',
    'pagos' => '6️⃣ Pagos de póliza',
    'fecha_pago' => '7️⃣ Fecha límite de pago',
    'volver' => '🔙 Volver al menú principal',
]);

$volverOtras = q($flow, 'Volver Otras', "¿Necesitas algo más?", [
    'otras' => '🔙 Volver a Otras Compañías',
    'principal' => '🏠 Menú principal',
]);

// --- Otras > Asistencia ---
$otrasAsist = m($flow, 'Otras Asistencia', "📞 *Líneas de asistencia:*\n\n• Mapfre: *#624*\n• Allianz: *#265*\n• Bolívar: *#322*\n• SBS: *#360*\n• Qualitas: *#963*");
chain($otrasAsist, $volverOtras);

// --- Otras > Cancelaciones ---
$otrasCancelMenu = q($flow, 'Otras Cancelaciones', "❌ *Cancelaciones*\n\n¿Qué póliza?", [
    'hogar' => '1️⃣ Hogar / Empresarial',
    'autos' => '2️⃣ Autos',
    'volver' => '🔙 Volver',
]);
$otrasCancelHogar = m($flow, 'Otras Cancel Hogar', "Necesitamos:\n• Nombres, identificación, contacto\n• Dirección del inmueble\n\nEn *30 min aprox.* nos comunicaremos contigo.");
$otrasCancelAutos = m($flow, 'Otras Cancel Autos', "Necesitamos:\n• Nombres, identificación, contacto\n• Placa\n\nEn *30 min aprox.* nos comunicaremos contigo.");
chain($otrasCancelHogar, $volverOtras);
chain($otrasCancelAutos, $volverOtras);
wire($otrasCancelMenu, ['hogar' => $otrasCancelHogar, 'autos' => $otrasCancelAutos, 'volver' => $menuOtras]);

// --- Otras > Coberturas Autos ---
$otrasCobMenu = q($flow, 'Otras Coberturas', "🚗 *Coberturas Autos*\n\nSelecciona compañía:", [
    'allianz' => '1️⃣ Allianz',
    'bolivar' => '2️⃣ Bolívar',
    'qualitas' => '3️⃣ Qualitas',
    'sbs' => '4️⃣ SBS',
    'mapfre' => '5️⃣ Mapfre',
    'volver' => '🔙 Volver',
]);
$cobAllianz = m($flow, 'Cob Allianz', "🚗 *Coberturas Autos Allianz*\n🔗 https://www.allianz.co/seguros/vehiculos/Autos.html");
$cobBolivar = m($flow, 'Cob Bolívar', "🚗 *Coberturas Autos Bolívar*\n🔗 https://www.segurosbolivar.com/seguros-para-carros-integral");
$cobQualitas = m($flow, 'Cob Qualitas', "🚗 *Coberturas Autos Qualitas*\n🔗 https://www.qualitascolombia.com.co/web/qco/livianos");
$cobSbs = m($flow, 'Cob SBS', "🚗 *Coberturas Autos SBS*\n🔗 https://www.sbseguros.co/seguros-autos/carros");
$cobMapfre = m($flow, 'Cob Mapfre', "🚗 *Coberturas Autos Mapfre*\n🔗 https://www.mapfre.com.co/seguros-carros/familiar/");
foreach ([$cobAllianz, $cobBolivar, $cobQualitas, $cobSbs, $cobMapfre] as $n) { chain($n, $volverOtras); }
wire($otrasCobMenu, ['allianz' => $cobAllianz, 'bolivar' => $cobBolivar, 'qualitas' => $cobQualitas, 'sbs' => $cobSbs, 'mapfre' => $cobMapfre, 'volver' => $menuOtras]);

// --- Otras > Cotizaciones ---
$otrasCotMenu = q($flow, 'Otras Cotizaciones', "💰 *Cotizaciones*\n\n¿Qué seguro?", [
    'salud' => '1️⃣ Salud (Allianz)',
    'autos' => '2️⃣ Autos (Todas)',
    'hogar' => '3️⃣ Hogar',
    'empresarial' => '4️⃣ Empresarial',
    'volver' => '🔙 Volver',
]);
$otrasCotSalud = m($flow, 'Otras Cot Salud', "Para cotizar *Salud* necesitamos:\n• Nombres, identificación, contacto\n• Fecha nacimiento, dirección, estado civil, correo\n\nEn *30 min aprox.* nos comunicaremos contigo.");
$otrasCotAutos = m($flow, 'Otras Cot Autos', "Para cotizar *Autos* necesitamos:\n• Nombres, identificación, contacto, estado civil, correo\n\n🚗 *Vehículo:* Marca, modelo, ciudad, placa\n\nEn *30 min aprox.* nos comunicaremos contigo.");
$otrasCotHogar = m($flow, 'Otras Cot Hogar', "Para cotizar *Hogar* necesitamos:\n• Datos personales completos\n\n🏠 *Inmueble:* Dirección, ciudad, estrato, valor vivienda, valor contenidos\n\nEn *30 min aprox.* nos comunicaremos contigo.");
$otrasCotEmp = m($flow, 'Otras Cot Emp', "Para cotizar *Empresarial* necesitamos:\n• Nombres, identificación, contacto\n• NIT, dirección, actividad económica\n\nEn *30 min aprox.* nos comunicaremos contigo.");
foreach ([$otrasCotSalud, $otrasCotAutos, $otrasCotHogar, $otrasCotEmp] as $n) { chain($n, $volverOtras); }
wire($otrasCotMenu, ['salud' => $otrasCotSalud, 'autos' => $otrasCotAutos, 'hogar' => $otrasCotHogar, 'empresarial' => $otrasCotEmp, 'volver' => $menuOtras]);

// --- Otras > Reclamaciones ---
$otrasRecMenu = q($flow, 'Otras Reclamaciones', "⚡ *Reclamaciones*", [
    'autos' => '1️⃣ Autos',
    'hogar_hurtos' => '2️⃣ Hogar - Hurtos',
    'hogar_danos' => '3️⃣ Hogar - Daños',
    'empresarial' => '4️⃣ Empresarial - Daños',
    'volver' => '🔙 Volver',
]);
$otrasRecAutos = m($flow, 'Otras Rec Autos', "🚗 *Reclamación Autos*\n\nPara generar siniestro:\n• Bolívar: *#322*\n• Mapfre: *#624*\n• Allianz: *#265*");
$otrasRecHurtos = m($flow, 'Otras Rec Hurtos', "🏠 *Reclamación Hogar - Hurto*\n\nLlama a tu aseguradora:\n• Allianz: *#265*  • Bolívar: *#322*  • Mapfre: *#624*\n\n📋 *Documentos adicionales:*\n• Carta de reclamo, denuncia\n• Cotización reposición\n• Certificación bancaria");
$otrasRecDanos = m($flow, 'Otras Rec Daños', "🏠 *Reclamación Hogar/Empresarial - Daños*\n\nLlama a tu aseguradora:\n• Mapfre: *#624*  • Bolívar: *#322*  • Allianz: *#265*\n\n📋 *Documentos adicionales:*\n• Carta de reclamo, informe técnico\n• Fotos del equipo, cotización reposición\n• Certificación bancaria");
foreach ([$otrasRecAutos, $otrasRecHurtos, $otrasRecDanos] as $n) { chain($n, $volverOtras); }
wire($otrasRecMenu, ['autos' => $otrasRecAutos, 'hogar_hurtos' => $otrasRecHurtos, 'hogar_danos' => $otrasRecDanos, 'empresarial' => $otrasRecDanos, 'volver' => $menuOtras]);

// --- Otras > Pagos ---
$otrasPagosMenu = q($flow, 'Otras Pagos', "💳 *Pagos de póliza*\n\nSelecciona compañía:", [
    'allianz' => '1️⃣ Allianz',
    'bolivar' => '2️⃣ Bolívar',
    'mapfre' => '3️⃣ Mapfre',
    'sbs' => '4️⃣ SBS',
    'qualitas' => '5️⃣ Qualitas',
    'volver' => '🔙 Volver',
]);
$pagoAllianz = m($flow, 'Pago Allianz', "💳 *Pago Allianz*\n🔗 https://gateway1.ecollect.co/eCollectPlus/Default.aspx");
$pagoBolivar = m($flow, 'Pago Bolívar', "💳 *Pago Bolívar*\n🔗 https://recaudos.segurosbolivar.com/login");
$pagoMapfre = m($flow, 'Pago Mapfre', "💳 *Pago Mapfre*\n🔗 https://cotiza.mapfre.com.co/pagosWeb/vista/paginas/noFilterIniPagosPublico.jsf");
$pagoSbs = m($flow, 'Pago SBS', "💳 *Pago SBS*\n🔗 https://www.sbseguros.co/servicio-al-cliente/alternativas-pagos");
$pagoQualitas = m($flow, 'Pago Qualitas', "💳 *Pago Qualitas*\n🔗 https://www.qualitascolombia.com.co/pago-de-poliza");
foreach ([$pagoAllianz, $pagoBolivar, $pagoMapfre, $pagoSbs, $pagoQualitas] as $n) { chain($n, $volverOtras); }
wire($otrasPagosMenu, ['allianz' => $pagoAllianz, 'bolivar' => $pagoBolivar, 'mapfre' => $pagoMapfre, 'sbs' => $pagoSbs, 'qualitas' => $pagoQualitas, 'volver' => $menuOtras]);

// --- Otras > Fecha límite pago ---
$otrasFechaMenu = q($flow, 'Otras Fecha Pago', "📅 *Fecha límite de pago*\n\n¿Tipo de póliza?", [
    'hogar' => '1️⃣ Hogar / Empresarial',
    'autos' => '2️⃣ Autos',
    'volver' => '🔙 Volver',
]);
$fechaHogar = m($flow, 'Fecha Hogar', "Necesitamos:\n• Nombres, identificación, contacto\n• Dirección del inmueble\n\nEn *30 min aprox.* nos comunicaremos contigo.");
$fechaAutos = m($flow, 'Fecha Autos', "Necesitamos:\n• Nombres, identificación, contacto\n• Placa\n\nEn *30 min aprox.* nos comunicaremos contigo.");
chain($fechaHogar, $volverOtras);
chain($fechaAutos, $volverOtras);
wire($otrasFechaMenu, ['hogar' => $fechaHogar, 'autos' => $fechaAutos, 'volver' => $menuOtras]);

// Wire Otras menu
wire($menuOtras, [
    'asistencia' => $otrasAsist, 'cancelaciones' => $otrasCancelMenu,
    'coberturas' => $otrasCobMenu, 'cotizaciones' => $otrasCotMenu,
    'reclamaciones' => $otrasRecMenu, 'pagos' => $otrasPagosMenu,
    'fecha_pago' => $otrasFechaMenu, 'volver' => $menuPrincipal,
]);
wire($volverOtras, ['otras' => $menuOtras, 'principal' => $menuPrincipal]);

// ============================================================
// WIRE MAIN FLOW
// ============================================================
chain($start, $welcome);
chain($welcome, $menuPrincipal);
wire($menuPrincipal, ['sura' => $menuSura, 'otras' => $menuOtras, 'asesor' => $transfer]);

// ============================================================
// 4. TRIGGERS
// ============================================================
ChatbotTrigger::create(['chatbot_id' => $bot->id, 'flow_id' => $flow->id, 'trigger_type' => 'first_message', 'priority' => 100, 'is_active' => true]);
ChatbotTrigger::create(['chatbot_id' => $bot->id, 'flow_id' => $flow->id, 'trigger_type' => 'keyword', 'trigger_value' => 'menú', 'priority' => 90, 'is_active' => true]);
ChatbotTrigger::create(['chatbot_id' => $bot->id, 'flow_id' => $flow->id, 'trigger_type' => 'keyword', 'trigger_value' => 'menu', 'priority' => 90, 'is_active' => true]);
ChatbotTrigger::create(['chatbot_id' => $bot->id, 'flow_id' => $flow->id, 'trigger_type' => 'keyword', 'trigger_value' => 'hola', 'priority' => 80, 'is_active' => true]);
ChatbotTrigger::create(['chatbot_id' => $bot->id, 'flow_id' => $flow->id, 'trigger_type' => 'keyword', 'trigger_value' => 'inicio', 'priority' => 80, 'is_active' => true]);

DB::commit();

// ============================================================
// AUDIT
// ============================================================
$allNodes = ChatbotNode::where('flow_id', $flow->id)->get();
$questionNodes = $allNodes->where('node_type', 'question');
$messageNodes = $allNodes->where('node_type', 'message');
$issues = 0;

echo "\n📊 AUDITORÍA:\n";
echo "   Total nodos: " . $allNodes->count() . "\n";
echo "   Question: " . $questionNodes->count() . "\n";
echo "   Message: " . $messageNodes->count() . "\n";
echo "   Triggers: " . ChatbotTrigger::where('chatbot_id', $bot->id)->count() . "\n\n";

// Check message nodes have next_node_id
foreach ($messageNodes as $mn) {
    if (!$mn->next_node_id) {
        echo "⚠️  Message sin next: {$mn->name} (ID {$mn->id})\n";
        $issues++;
    }
}

// Check question options have next_node_id
foreach ($questionNodes as $qn) {
    $opts = $qn->config['options'] ?? [];
    foreach ($opts as $opt) {
        if (empty($opt['next_node_id'])) {
            echo "⚠️  Option sin next_node_id: {$qn->name} -> {$opt['label']}\n";
            $issues++;
        }
    }
}

if ($issues === 0) {
    echo "✅ Todos los nodos están correctamente conectados!\n";
}

echo "\n🎉 Chatbot reconstruido: ID={$bot->id}, Flow={$flow->id}, Nodos={$allNodes->count()}\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "   " . $e->getFile() . ":" . $e->getLine() . "\n";
}
