<?php
// Run: php scripts/chatbot_nodes.php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChatbotNode;
use App\Models\ChatbotTrigger;
use Illuminate\Support\Facades\DB;

$ids = json_decode(file_get_contents('/tmp/chatbot_ids.json'), true);
$flowId = $ids['flow'];
$chatbotId = $ids['chatbot'];
$assignTo = 164; // Daniel Palacio Rave

echo "Flow=$flowId Chatbot=$chatbotId AssignTo=$assignTo\n";

// Delete existing nodes
ChatbotNode::where('flow_id', $flowId)->delete();

DB::beginTransaction();
try {

$ni = 0;
$mk = function($type, $name, $config) use ($flowId, &$ni) {
    $ni++;
    return ChatbotNode::create([
        'flow_id'=>$flowId,'node_type'=>$type,'name'=>$name,
        'position_x'=>0,'position_y'=>$ni*150,
        'config'=>$config,'next_node_id'=>null
    ]);
};

// Helper to wire options
$wire = function($node, $mapping) {
    $c = $node->config;
    foreach($mapping as $i=>$targetId) {
        $c['options'][$i]['next_node_id'] = (string)$targetId;
    }
    $node->update(['config'=>$c]);
};

// ===== START + WELCOME =====
$start = $mk('start','Inicio',[]);
$welcome = $mk('message','Bienvenida',[
    'text'=>"¡Hola! 👋 Bienvenid@ a *Proyectamos Seguros*, es un gusto poderte atender.\n\nSelecciona una opción para continuar:"
]);
$start->update(['next_node_id'=>$welcome->id]);

// ===== MAIN MENU =====
$mainMenu = $mk('question','Menú Principal',[
    'text'=>"¿En qué podemos ayudarte?",
    'error_message'=>"Por favor selecciona una opción válida.",
    'options'=>[
        ['text'=>'📋 Cotizaciones','next_node_id'=>null],
        ['text'=>'📄 Certificaciones','next_node_id'=>null],
        ['text'=>'🔍 Consultas','next_node_id'=>null],
        ['text'=>'❌ Cancelaciones','next_node_id'=>null],
        ['text'=>'⚠️ Reclamaciones','next_node_id'=>null],
        ['text'=>'💰 Reembolsos','next_node_id'=>null],
        ['text'=>'📝 Solicitudes','next_node_id'=>null],
        ['text'=>'🚗 Expediciones (SOAT)','next_node_id'=>null],
        ['text'=>'📞 Contacto','next_node_id'=>null],
        ['text'=>'💳 Pagos','next_node_id'=>null],
    ]
]);
$welcome->update(['next_node_id'=>$mainMenu->id]);

// =========== TRANSFER NODE (reusable) ===========
$transferNode = $mk('transfer','Asignar a asesor',[
    'assign_to_user_id'=>$assignTo,
    'transfer_message'=>"Un asesor te atenderá pronto. ⏳"
]);

// ===== 1. COTIZACIONES =====
$cotMenu = $mk('question','Cotizaciones',[
    'text'=>"📋 *COTIZACIONES*\n¿Qué tipo de póliza deseas cotizar?",
    'options'=>[
        ['text'=>'🏥 Salud','next_node_id'=>null],
        ['text'=>'❤️ Seguros de Vida','next_node_id'=>null],
        ['text'=>'🚗 Vehículos','next_node_id'=>null],
        ['text'=>'🏠 Hogar','next_node_id'=>null],
        ['text'=>'🏢 Empresarial','next_node_id'=>null],
        ['text'=>'🐾 Mascotas','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);

// Cot Salud submenu
$cotSaludMenu = $mk('question','Cot Salud',[
    'text'=>"🏥 *COTIZACIÓN DE SALUD*\n¿Qué plan te interesa?",
    'options'=>[
        ['text'=>'Salud General','next_node_id'=>null],
        ['text'=>'Salud para Dos','next_node_id'=>null],
        ['text'=>'Salud para Todos','next_node_id'=>null],
        ['text'=>'🔙 Volver','next_node_id'=>null],
    ]
]);
$cotSaludResp = $mk('message','Resp Cot Salud',[
    'text'=>"Para cotizarte una póliza de *Salud* necesitamos:\n\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección\n• Estado civil\n• Correo electrónico\n\nEnvíanos esta información y en *30 minutos aprox.* nos comunicaremos contigo. 🏥"
]);
$cotSaludResp->update(['next_node_id'=>$transferNode->id]);
$wire($cotSaludMenu, [
    0=>$cotSaludResp->id, 1=>$cotSaludResp->id, 2=>$cotSaludResp->id, 3=>$cotMenu->id
]);

// Cot Vida
$cotVidaResp = $mk('message','Resp Cot Vida',[
    'text'=>"Para cotizarte una póliza de *Vida* necesitamos:\n\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección\n• Estado civil\n• Correo electrónico\n\nEn *30 minutos aprox.* nos comunicaremos contigo. ❤️"
]);
$cotVidaResp->update(['next_node_id'=>$transferNode->id]);

// Cot Autos
$cotAutosResp = $mk('message','Resp Cot Autos',[
    'text'=>"Para cotizarte una póliza de *Vehículos* necesitamos:\n\n*Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Estado civil\n• Correo electrónico\n\n*Datos del vehículo:*\n• Marca y modelo\n• Ciudad de circulación\n• Placa\n\nEn *30 minutos aprox.* nos comunicaremos contigo. 🚗"
]);
$cotAutosResp->update(['next_node_id'=>$transferNode->id]);

// Cot Hogar
$cotHogarResp = $mk('message','Resp Cot Hogar',[
    'text'=>"Para cotizarte una póliza de *Hogar* necesitamos:\n\n*Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección\n• Estado civil\n• Correo electrónico\n\n*Datos del inmueble:*\n• Dirección del inmueble\n• Ciudad y departamento\n• Estrato\n• Valor vivienda y contenidos\n\nEn *30 minutos aprox.* nos comunicaremos contigo. 🏠"
]);
$cotHogarResp->update(['next_node_id'=>$transferNode->id]);

// Cot Empresarial
$cotEmpResp = $mk('message','Resp Cot Emp',[
    'text'=>"Para cotizarte una póliza *Empresarial* necesitamos:\n\n*Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n*Datos empresa:*\n• NIT\n• Dirección del inmueble\n• Actividad económica\n\nEn *30 minutos aprox.* nos comunicaremos contigo. 🏢"
]);
$cotEmpResp->update(['next_node_id'=>$transferNode->id]);

// Cot Mascotas
$cotMascResp = $mk('message','Resp Cot Mascotas',[
    'text'=>"🐾 *COTIZACIÓN DE MASCOTAS*\n\nCotiza directamente:\n🔗 https://surapet.com.co/asesorcliente/6486\n\nO envíanos:\n• Edad, nombre, sexo, raza\n• Perro o gato\n• ¿Ha tenido enfermedades?\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$cotMascResp->update(['next_node_id'=>$transferNode->id]);

// Wire cotizaciones menu
$wire($cotMenu, [
    0=>$cotSaludMenu->id, 1=>$cotVidaResp->id, 2=>$cotAutosResp->id,
    3=>$cotHogarResp->id, 4=>$cotEmpResp->id, 5=>$cotMascResp->id,
    6=>$mainMenu->id
]);

// ===== 2. CERTIFICACIONES =====
$certMenu = $mk('question','Certificaciones',[
    'text'=>"📄 *CERTIFICACIONES*\n¿Qué certificado necesitas?",
    'options'=>[
        ['text'=>'✈️ Certificado de Viaje','next_node_id'=>null],
        ['text'=>'📊 Declaración de Renta','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);
$certViajeResp = $mk('message','Resp Cert Viaje',[
    'text'=>"✈️ *Certificado de Viaje - Asistencia en el Exterior*\n\nDescárgalo aquí:\n🔗 https://www.segurossura.com.co/paginas/salud/asistencia-viajero.aspx\n\nEscribe *menu* para volver al menú. 😊"
]);
$certRentaResp = $mk('message','Resp Cert Renta',[
    'text'=>"📊 *Certificado para Declaración de Renta*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$certRentaResp->update(['next_node_id'=>$transferNode->id]);
$wire($certMenu, [0=>$certViajeResp->id, 1=>$certRentaResp->id, 2=>$mainMenu->id]);

// ===== 3. CONSULTAS =====
$consMenu = $mk('question','Consultas',[
    'text'=>"🔍 *CONSULTAS*\n¿Qué necesitas consultar?",
    'options'=>[
        ['text'=>'💳 Pagos de Póliza Sura','next_node_id'=>null],
        ['text'=>'🏥 Directorio Médico / Citas','next_node_id'=>null],
        ['text'=>'📝 Modificaciones de Póliza','next_node_id'=>null],
        ['text'=>'🚗 Vigencia SOAT','next_node_id'=>null],
        ['text'=>'📅 Vencimiento Póliza','next_node_id'=>null],
        ['text'=>'🏢 Sedes Salud Sura','next_node_id'=>null],
        ['text'=>'🛡️ Coberturas','next_node_id'=>null],
        ['text'=>'⚠️ Pérdida de Cobertura','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);

$consPagosResp = $mk('message','Resp Pagos Sura',[
    'text'=>"💳 *¿Cómo pagar tu póliza Sura?*\n\n🔗 https://www.segurossura.com.co/paginas/pagos.aspx\n\nEscribe *menu* para volver."
]);
$consCitasResp = $mk('message','Resp Directorio',[
    'text'=>"🏥 *Directorio Médico y Citas*\n\n🔗 https://www.segurossura.com.co/paginas/salud/directorio-medico.aspx\n\nTambién llama al *#888* para agendar citas.\n\nEscribe *menu* para volver."
]);
$consModifResp = $mk('message','Resp Modif Póliza',[
    'text'=>"📝 *Modificación de Póliza*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Tipo de modificación\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$consModifResp->update(['next_node_id'=>$transferNode->id]);

$consSoatResp = $mk('message','Resp Vigencia SOAT',[
    'text'=>"🚗 *Validar Vigencia del SOAT*\n\n🔗 https://www.runt.com.co/consultaCiudadana/#/consultaVehiculo\n\nEscribe *menu* para volver."
]);
$consVencResp = $mk('message','Resp Vencimiento',[
    'text'=>"📅 *Vencimiento de Póliza*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Placa del vehículo (si aplica)\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$consVencResp->update(['next_node_id'=>$transferNode->id]);

$consSedesResp = $mk('message','Resp Sedes',[
    'text'=>"🏢 *Sedes Salud Sura*\n\n🔗 https://www.segurossura.com.co/paginas/salud/sedes/saludsura.aspx\n\nEscribe *menu* para volver."
]);

// Coberturas submenu
$cobMenu = $mk('question','Coberturas',[
    'text'=>"🛡️ *COBERTURAS*\n¿De qué tipo de póliza?",
    'options'=>[
        ['text'=>'🏥 Salud','next_node_id'=>null],
        ['text'=>'❤️ Vida Individual','next_node_id'=>null],
        ['text'=>'🏠 Hogar','next_node_id'=>null],
        ['text'=>'🚗 Autos Sura','next_node_id'=>null],
        ['text'=>'🔙 Volver','next_node_id'=>null],
    ]
]);
$cobSalud = $mk('message','Cob Salud',['text'=>"🏥 *Coberturas Salud*\n\n🔗 https://www.segurossura.com.co/paginas/salud/planes.aspx\n\nEscribe *menu* para volver."]);
$cobVida = $mk('message','Cob Vida',['text'=>"❤️ *Coberturas Vida Individual*\n\n🔗 https://www.segurossura.com.co/paginas/vida/inicio.aspx\n\nEscribe *menu* para volver."]);
$cobHogar = $mk('message','Cob Hogar',['text'=>"🏠 *Coberturas Hogar*\n\n🔗 https://www.segurossura.com.co/paginas/hogar/inicio.aspx\n\nEscribe *menu* para volver."]);
$cobAutos = $mk('message','Cob Autos',['text'=>"🚗 *Coberturas Autos*\n\n🔗 https://www.segurossura.com.co/paginas/movilidad/autos/inicio.aspx\n\nEscribe *menu* para volver."]);
$wire($cobMenu, [0=>$cobSalud->id, 1=>$cobVida->id, 2=>$cobHogar->id, 3=>$cobAutos->id, 4=>$consMenu->id]);

$consPerdidaResp = $mk('message','Resp Pérdida Cob',[
    'text'=>"⚠️ *Pérdida de Cobertura - Salud*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$consPerdidaResp->update(['next_node_id'=>$transferNode->id]);

// Wire consultas
$wire($consMenu, [
    0=>$consPagosResp->id, 1=>$consCitasResp->id, 2=>$consModifResp->id,
    3=>$consSoatResp->id, 4=>$consVencResp->id, 5=>$consSedesResp->id,
    6=>$cobMenu->id, 7=>$consPerdidaResp->id, 8=>$mainMenu->id
]);

// ===== 4. CANCELACIONES =====
$cancelMenu = $mk('question','Cancelaciones',[
    'text'=>"❌ *CANCELACIONES*\n¿Qué tipo de póliza deseas cancelar?",
    'options'=>[
        ['text'=>'❤️ Vida Individual','next_node_id'=>null],
        ['text'=>'🏥 Salud','next_node_id'=>null],
        ['text'=>'🚗 Autos','next_node_id'=>null],
        ['text'=>'🏠 Hogar','next_node_id'=>null],
        ['text'=>'🏢 Empresarial','next_node_id'=>null],
        ['text'=>'🐾 Mascotas','next_node_id'=>null],
        ['text'=>'📋 Otra póliza','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);
$cancelResp = $mk('message','Resp Cancelación',[
    'text'=>"Para gestionar la cancelación necesitamos:\n\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Número de póliza\n• Motivo de cancelación\n\nEnvíanos esta información y en *30 minutos aprox.* nos comunicaremos contigo."
]);
$cancelResp->update(['next_node_id'=>$transferNode->id]);
$wire($cancelMenu, [
    0=>$cancelResp->id, 1=>$cancelResp->id, 2=>$cancelResp->id, 3=>$cancelResp->id,
    4=>$cancelResp->id, 5=>$cancelResp->id, 6=>$cancelResp->id, 7=>$mainMenu->id
]);

// ===== 5. RECLAMACIONES =====
$recMenu = $mk('question','Reclamaciones',[
    'text'=>"⚠️ *RECLAMACIONES*\n¿Qué tipo de reclamación?",
    'options'=>[
        ['text'=>'❤️ Seguros de Vida','next_node_id'=>null],
        ['text'=>'🏠 Hogar','next_node_id'=>null],
        ['text'=>'🏢 Empresarial','next_node_id'=>null],
        ['text'=>'🚗 Vehículos','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);

// Rec Vida submenu
$recVidaMenu = $mk('question','Rec Vida',[
    'text'=>"❤️ *Reclamaciones Vida*\n¿Qué tipo?",
    'options'=>[
        ['text'=>'🤕 Incapacidad','next_node_id'=>null],
        ['text'=>'👶 Auxilio Maternidad/Paternidad','next_node_id'=>null],
        ['text'=>'💰 Renta Diaria','next_node_id'=>null],
        ['text'=>'🔙 Volver','next_node_id'=>null],
    ]
]);
$recVidaResp = $mk('message','Resp Rec Vida',[
    'text'=>"Para tu reclamación de *Seguros de Vida* necesitamos:\n\n*Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n*Documentación:*\n• Historia clínica\n• Incapacidad\n• Número de cuenta o certificación bancaria\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$recVidaResp->update(['next_node_id'=>$transferNode->id]);
$wire($recVidaMenu, [0=>$recVidaResp->id, 1=>$recVidaResp->id, 2=>$recVidaResp->id, 3=>$recMenu->id]);

// Rec Hogar submenu
$recHogarMenu = $mk('question','Rec Hogar',[
    'text'=>"🏠 *Reclamaciones Hogar*\n¿Qué tipo?",
    'options'=>[
        ['text'=>'🔧 Daños','next_node_id'=>null],
        ['text'=>'🔒 Hurto','next_node_id'=>null],
        ['text'=>'🔙 Volver','next_node_id'=>null],
    ]
]);
$recHogarDanos = $mk('message','Resp Rec Hogar Daño',[
    'text'=>"🏠 *Reclamación Hogar - Daños*\n\nSura: Comunicarse al *#888* opción 2 para generar siniestro.\nAdicional: carta de reclamo a la compañía + soporte de propiedad del bien.\n\nAllianz: #265 | Mapfre: #624\n\nEscribe *menu* para volver."
]);
$recHogarHurto = $mk('message','Resp Rec Hogar Hurto',[
    'text'=>"🏠 *Reclamación Hogar - Hurto*\n\nSura: Comunicarse al *#888* opción 2 para generar siniestro.\nAdicional: carta de reclamo + soporte de propiedad + denuncia ante fiscalía.\n\nAllianz: #265 | Mapfre: #624\n\nEscribe *menu* para volver."
]);
$wire($recHogarMenu, [0=>$recHogarDanos->id, 1=>$recHogarHurto->id, 2=>$recMenu->id]);

// Rec Empresarial
$recEmpResp = $mk('message','Resp Rec Emp',[
    'text'=>"🏢 *Reclamación Empresarial*\n\nSura: Comunicarse al *#888* opción 2.\nMapfre: #624 | Bolívar: #322\n\nAdicional: carta de reclamo + soporte de propiedad del bien.\n\nEscribe *menu* para volver."
]);

// Rec Vehículos
$recAutoResp = $mk('message','Resp Rec Autos',[
    'text'=>"🚗 *Reclamación Autos*\n\nSura: Comunicarse al *#888* opción 1.\nBolívar: #322 | Mapfre: #624 | SBS: #360 | Allianz: #265\n\nEscribe *menu* para volver."
]);

$wire($recMenu, [
    0=>$recVidaMenu->id, 1=>$recHogarMenu->id, 2=>$recEmpResp->id,
    3=>$recAutoResp->id, 4=>$mainMenu->id
]);

// ===== 6. REEMBOLSOS =====
$reembMenu = $mk('question','Reembolsos',[
    'text'=>"💰 *REEMBOLSOS*\n¿Qué tipo de reembolso?",
    'options'=>[
        ['text'=>'💊 Terapias','next_node_id'=>null],
        ['text'=>'🏥 Consultas','next_node_id'=>null],
        ['text'=>'💳 Pagos','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);
$reembTerapiaResp = $mk('message','Resp Reemb Terapia',[
    'text'=>"💊 *Reembolso de Terapias*\n\n🔗 Radicar en: https://www.segurossura.com.co/paginas/salud/reembolsos.aspx\n\nEscribe *menu* para volver."
]);
$reembConsultaResp = $mk('message','Resp Reemb Consulta',[
    'text'=>"🏥 *Reembolso de Consultas*\n\n🔗 Radicar en: https://www.segurossura.com.co/paginas/salud/reembolsos.aspx\n\nEscribe *menu* para volver."
]);
$reembPagosResp = $mk('message','Resp Reemb Pagos',[
    'text'=>"💳 *Reembolso de Pagos*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de póliza\n• Monto y concepto del pago\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$reembPagosResp->update(['next_node_id'=>$transferNode->id]);
$wire($reembMenu, [0=>$reembTerapiaResp->id, 1=>$reembConsultaResp->id, 2=>$reembPagosResp->id, 3=>$mainMenu->id]);

// ===== 7. SOLICITUDES =====
$solMenu = $mk('question','Solicitudes',[
    'text'=>"📝 *SOLICITUDES*\n¿Qué necesitas solicitar?",
    'options'=>[
        ['text'=>'🏠 Atención a Domicilio','next_node_id'=>null],
        ['text'=>'✅ Autorizaciones','next_node_id'=>null],
        ['text'=>'📋 Transcribir Incapacidad (EPS)','next_node_id'=>null],
        ['text'=>'💊 Medicamentos','next_node_id'=>null],
        ['text'=>'🦷 Urgencias Odontológicas','next_node_id'=>null],
        ['text'=>'🧪 Toma de Muestras','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);
$solDomicilioResp = $mk('message','Resp Sol Domicilio',[
    'text'=>"🏠 *Atención en Salud Domiciliaria (Salud en Casa)*\n\nLínea atención Sura: *#888* opción 0\n\nEscribe *menu* para volver."
]);
$solAutoResp = $mk('message','Resp Sol Autorizaciones',[
    'text'=>"✅ *Autorizaciones*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Tipo de autorización requerida\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$solAutoResp->update(['next_node_id'=>$transferNode->id]);

$solIncapResp = $mk('message','Resp Sol Incapacidad',[
    'text'=>"📋 *Transcribir Incapacidad (EPS)*\n\nNecesitamos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Copia de la incapacidad\n\nEn *30 minutos aprox.* nos comunicaremos contigo."
]);
$solIncapResp->update(['next_node_id'=>$transferNode->id]);

$solMedicResp = $mk('message','Resp Sol Medicamentos',[
    'text'=>"💊 *Renovación o Solicitud de Medicamentos*\n\nSigue el instructivo paso a paso en la app de Sura o comunícate al *#888* opción 0.\n\nEscribe *menu* para volver."
]);
$solOdontoResp = $mk('message','Resp Sol Odonto',[
    'text'=>"🦷 *Urgencias Odontológicas*\n\nComunícate al *#888* opción 0 para asistencia.\n\nEscribe *menu* para volver."
]);
$solMuestrasResp = $mk('message','Resp Sol Muestras',[
    'text'=>"🧪 *Toma de Muestras a Domicilio*\n\nSolicítala aquí:\n🔗 https://seguros.comunicaciones.sura.com/toma-de-muestras-a-domicilio\n\nEscribe *menu* para volver."
]);
$wire($solMenu, [
    0=>$solDomicilioResp->id, 1=>$solAutoResp->id, 2=>$solIncapResp->id,
    3=>$solMedicResp->id, 4=>$solOdontoResp->id, 5=>$solMuestrasResp->id,
    6=>$mainMenu->id
]);

// ===== 8. EXPEDICIONES (SOAT) =====
$expResp = $mk('message','Resp Expedición SOAT',[
    'text'=>"🚗 *Expedición del SOAT*\n\nConsulta y compra tu SOAT:\n🔗 https://www.runt.com.co/consultaCiudadana/#/consultaVehiculo\n\nMundial: https://soatmundial.com.co/\nAXA Colpatria: https://www.axacolpatria.co/portal/soat-en-linea/\n\nEscribe *menu* para volver."
]);

// ===== 9. CONTACTO =====
$contactoMenu = $mk('question','Contacto',[
    'text'=>"📞 *CONTACTO*\n¿Qué necesitas?",
    'options'=>[
        ['text'=>'📞 Líneas de Asistencia','next_node_id'=>null],
        ['text'=>'📱 Canales de Contacto','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);
$contactoLineasResp = $mk('message','Resp Líneas',[
    'text'=>"📞 *Líneas de Asistencia*\n\nSura: *#888*\nMapfre: *#624*\nAllianz: *#265*\nBolívar: *#322*\nSBS: *#360*\n\nEscribe *menu* para volver."
]);
$contactoCanalesResp = $mk('message','Resp Canales',[
    'text'=>"📱 *Canales de Contacto Proyectamos Seguros*\n\n📞 José Muñoz: 3104493791\n📞 Sandra Alvarez: 3217000303\n📧 contacto@proyectamosseguros.com\n\n🕐 L-J 7:30am-5:00pm | V 7:30am-4:00pm\n\nEscribe *menu* para volver."
]);
$wire($contactoMenu, [0=>$contactoLineasResp->id, 1=>$contactoCanalesResp->id, 2=>$mainMenu->id]);

// ===== 10. PAGOS =====
$pagosMenu = $mk('question','Pagos',[
    'text'=>"💳 *PAGOS DE PÓLIZAS*\n¿De qué compañía?",
    'options'=>[
        ['text'=>'Sura','next_node_id'=>null],
        ['text'=>'Allianz','next_node_id'=>null],
        ['text'=>'Bolívar','next_node_id'=>null],
        ['text'=>'Mapfre','next_node_id'=>null],
        ['text'=>'SBS','next_node_id'=>null],
        ['text'=>'Qualitas','next_node_id'=>null],
        ['text'=>'🔙 Volver al menú','next_node_id'=>null],
    ]
]);
$pagoSura = $mk('message','Pago Sura',['text'=>"💳 *Pago Sura*\n🔗 https://www.segurossura.com.co/paginas/pagos.aspx\n\nEscribe *menu* para volver."]);
$pagoAllianz = $mk('message','Pago Allianz',['text'=>"💳 *Pago Allianz*\n🔗 https://gateway1.ecollect.co/eCollectPlus/Default.aspx\n\nEscribe *menu* para volver."]);
$pagoBolivar = $mk('message','Pago Bolívar',['text'=>"💳 *Pago Bolívar*\n🔗 https://recaudos.segurosbolivar.com/login\n\nEscribe *menu* para volver."]);
$pagoMapfre = $mk('message','Pago Mapfre',['text'=>"💳 *Pago Mapfre*\n🔗 https://cotiza.mapfre.com.co/pagosWeb/vista/paginas/noFilterIniPagosPublico.jsf\n\nEscribe *menu* para volver."]);
$pagoSBS = $mk('message','Pago SBS',['text'=>"💳 *Pago SBS*\n🔗 https://www.sbseguros.co/servicio-al-cliente/alternativas-pagos\n\nEscribe *menu* para volver."]);
$pagoQualitas = $mk('message','Pago Qualitas',['text'=>"💳 *Pago Qualitas*\n🔗 https://www.qualitascolombia.com.co/pago-de-poliza\n\nEscribe *menu* para volver."]);
$wire($pagosMenu, [
    0=>$pagoSura->id, 1=>$pagoAllianz->id, 2=>$pagoBolivar->id,
    3=>$pagoMapfre->id, 4=>$pagoSBS->id, 5=>$pagoQualitas->id, 6=>$mainMenu->id
]);

// ===== WIRE MAIN MENU =====
$wire($mainMenu, [
    0=>$cotMenu->id, 1=>$certMenu->id, 2=>$consMenu->id,
    3=>$cancelMenu->id, 4=>$recMenu->id, 5=>$reembMenu->id,
    6=>$solMenu->id, 7=>$expResp->id, 8=>$contactoMenu->id, 9=>$pagosMenu->id
]);

// ===== SET START NODE ON FLOW =====
$mainFlow = \App\Models\ChatbotFlow::find($flowId);
$mainFlow->update(['start_node_id' => $start->id]);

// ===== TRIGGER: any message starts the chatbot =====
ChatbotTrigger::where('chatbot_id', $chatbotId)->delete();
ChatbotTrigger::create([
    'chatbot_id'=>$chatbotId, 'flow_id'=>$flowId,
    'trigger_type'=>'first_message', 'trigger_value'=>'',
    'is_case_sensitive'=>false, 'priority'=>100, 'is_active'=>true,
    'retrigger_mode'=>'session_expired', 'reset_on_transfer'=>true, 'reset_on_resolve'=>true,
]);

// Menu keyword trigger
ChatbotTrigger::create([
    'chatbot_id'=>$chatbotId, 'flow_id'=>$flowId,
    'trigger_type'=>'keyword', 'trigger_value'=>'menu',
    'is_case_sensitive'=>false, 'priority'=>90, 'is_active'=>true,
    'retrigger_mode'=>'always',
]);

$totalNodes = ChatbotNode::where('flow_id', $flowId)->count();
echo "DONE! Total nodes: $totalNodes\n";

DB::commit();
echo "COMMITTED\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: ".$e->getMessage()."\n".$e->getTraceAsString()."\n";
}
