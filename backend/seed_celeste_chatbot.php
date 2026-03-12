<?php
/**
 * Seeder script to create chatbot for Celeste Oriente (broker_id=53)
 * Run with: /opt/cpanel/ea-php83/root/usr/bin/php artisan tinker < seed_celeste_chatbot.php
 * Or: /opt/cpanel/ea-php83/root/usr/bin/php seed_celeste_chatbot.php
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

// Check if chatbot already exists
$existing = Chatbot::where('broker_id', $BROKER_ID)->first();
if ($existing) {
    echo "⚠️  Ya existe un chatbot para broker_id={$BROKER_ID}: '{$existing->name}' (ID:{$existing->id})\n";
    echo "¿Desea eliminarlo y crear uno nuevo? Eliminando...\n";
    $existing->delete();
    echo "✅ Chatbot anterior eliminado.\n";
}

DB::beginTransaction();

try {
    // ========== 1. CREATE CHATBOT ==========
    $chatbot = Chatbot::create([
        'broker_id' => $BROKER_ID,
        'name' => 'Asistente Celeste Oriente',
        'description' => 'Chatbot de atención al cliente para Seguros Celeste Oriente - Proyectamos Seguros',
        'is_active' => true,
        'welcome_message' => "¡Hola! 👋 Bienvenido a *Celeste Oriente - Proyectamos Seguros*.\n\nSoy tu asistente virtual y estoy aquí para ayudarte. ¿Con qué compañía de seguros necesitas ayuda?",
        'fallback_message' => "Lo siento, no entendí tu mensaje. Por favor selecciona una de las opciones del menú o escribe *menú* para ver las opciones disponibles.",
        'goodbye_message' => "¡Gracias por contactarnos! Si necesitas algo más, no dudes en escribirnos. ¡Que tengas un excelente día! 🙌",
        'ai_enabled' => false,
        'ai_provider' => 'none',
        'typing_delay_ms' => 800,
        'response_delay_ms' => 500,
        'session_timeout_minutes' => 30,
        'max_fallback_count' => 3,
    ]);
    echo "✅ Chatbot creado: ID={$chatbot->id}\n";

    // ========== 2. CREATE MAIN FLOW ==========
    $flow = ChatbotFlow::create([
        'chatbot_id' => $chatbot->id,
        'name' => 'Flujo Principal',
        'description' => 'Menú principal con opciones por compañía de seguros',
        'is_default' => true,
        'is_active' => true,
    ]);
    echo "✅ Flujo creado: ID={$flow->id}\n";

    // ========== 3. CREATE NODES ==========
    $y = 0;
    $nodeIds = [];

    // --- START NODE ---
    $startNode = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'start',
        'name' => 'Inicio',
        'position_x' => 400,
        'position_y' => $y,
        'config' => [],
    ]);
    $y += 150;

    // --- WELCOME MESSAGE ---
    $welcomeNode = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Bienvenida',
        'position_x' => 400,
        'position_y' => $y,
        'config' => [
            'text' => "¡Hola! 👋 Bienvenido a *Celeste Oriente - Proyectamos Seguros*.\n\nSoy tu asistente virtual y estoy aquí para ayudarte.",
        ],
    ]);
    $startNode->update(['next_node_id' => $welcomeNode->id]);
    $y += 150;

    // --- MAIN MENU: Select insurance company ---
    $mainMenu = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Menú Compañía',
        'position_x' => 400,
        'position_y' => $y,
        'config' => [
            'text' => "¿Con cuál compañía de seguros necesitas ayuda?",
            'options' => [
                ['label' => '1️⃣ Sura', 'value' => 'sura'],
                ['label' => '2️⃣ Otras Compañías (Allianz, Bolívar, Mapfre, SBS, Qualitas)', 'value' => 'otras'],
                ['label' => '3️⃣ Hablar con un asesor', 'value' => 'asesor'],
            ],
        ],
    ]);
    $welcomeNode->update(['next_node_id' => $mainMenu->id]);
    $y += 200;

    // ========== SURA SECTION ==========
    $suraY = $y;
    $suraMenu = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Menú Sura',
        'position_x' => 100,
        'position_y' => $suraY,
        'config' => [
            'text' => "📋 *SURA* - ¿Qué necesitas?",
            'options' => [
                ['label' => '1️⃣ Contacto / Asistencia', 'value' => 'sura_contacto'],
                ['label' => '2️⃣ Cancelaciones', 'value' => 'sura_cancelaciones'],
                ['label' => '3️⃣ Consultas', 'value' => 'sura_consultas'],
                ['label' => '4️⃣ Cotizaciones', 'value' => 'sura_cotizaciones'],
                ['label' => '5️⃣ Reclamaciones', 'value' => 'sura_reclamaciones'],
                ['label' => '6️⃣ Reembolsos', 'value' => 'sura_reembolsos'],
                ['label' => '7️⃣ Solicitudes', 'value' => 'sura_solicitudes'],
                ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
            ],
        ],
    ]);
    $suraY += 200;

    // --- SURA > CONTACTO ---
    $suraContacto = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Sura - Contacto',
        'position_x' => -300,
        'position_y' => $suraY,
        'config' => [
            'text' => "📞 *Contacto SURA*\n\nSelecciona una opción:",
            'options' => [
                ['label' => '1️⃣ Líneas de asistencia', 'value' => 'sura_linea_asistencia'],
                ['label' => '2️⃣ Canales de contacto', 'value' => 'sura_canales'],
                ['label' => '🔙 Volver', 'value' => 'menu_sura'],
            ],
        ],
    ]);

    $suraLineaAsist = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Línea Asistencia',
        'position_x' => -500,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "📞 *Línea de asistencia Sura:* #888\n\nMarca desde tu celular para atención inmediata.",
        ],
    ]);

    $suraCanales = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Canales Contacto',
        'position_x' => -200,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "📱 *Medios de contacto Proyectamos Seguros:*\n\n• Cartera: 3046454852\n• Info general: 3006748706\n• Fijo: 604 3121180\n• Facebook: https://www.facebook.com/proyectamosseguros\n• Página: https://proyectamosseguros.com/\n• José Muñoz: 3104493791\n• Sandra Álvarez: 3217000303",
        ],
    ]);

    // Add "back to menu" after contact messages
    $backToSuraFromContact = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Volver Sura (Contacto)',
        'position_x' => -350,
        'position_y' => $suraY + 400,
        'config' => [
            'text' => "¿Necesitas algo más?",
            'options' => [
                ['label' => '🔙 Volver a Sura', 'value' => 'menu_sura'],
                ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
            ],
        ],
    ]);
    $suraLineaAsist->update(['next_node_id' => $backToSuraFromContact->id]);
    $suraCanales->update(['next_node_id' => $backToSuraFromContact->id]);

    // --- SURA > CANCELACIONES ---
    $suraCancelaciones = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Sura - Cancelaciones',
        'position_x' => -50,
        'position_y' => $suraY,
        'config' => [
            'text' => "❌ *Cancelaciones SURA*\n\n¿Qué tipo de póliza deseas cancelar?",
            'options' => [
                ['label' => '1️⃣ Vida Individual', 'value' => 'sura_cancel_vida_ind'],
                ['label' => '2️⃣ Vida Grupo', 'value' => 'sura_cancel_vida_grupo'],
                ['label' => '3️⃣ Salud / PAC', 'value' => 'sura_cancel_salud'],
                ['label' => '4️⃣ Autos', 'value' => 'sura_cancel_autos'],
                ['label' => '5️⃣ Hogar', 'value' => 'sura_cancel_hogar'],
                ['label' => '6️⃣ Empresarial', 'value' => 'sura_cancel_empresarial'],
                ['label' => '7️⃣ Mascotas', 'value' => 'sura_cancel_mascotas'],
                ['label' => '8️⃣ Otra póliza', 'value' => 'sura_cancel_otra'],
                ['label' => '🔙 Volver', 'value' => 'menu_sura'],
            ],
        ],
    ]);

    // Generic cancel response (requires data collection)
    $suraCancelGeneric = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Cancelación Info',
        'position_x' => -50,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "Para gestionar tu cancelación, necesitamos los siguientes datos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo para brindarte toda la información.",
        ],
    ]);

    $suraCancelAutos = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Cancel Autos',
        'position_x' => 100,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "Para gestionar la cancelación de tu póliza de *Autos*, necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🚗 *Datos del vehículo:*\n• Placa\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo.",
        ],
    ]);

    $suraCancelHogar = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Cancel Hogar',
        'position_x' => 200,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "Para gestionar la cancelación de tu póliza de *Hogar/Empresarial*, necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🏠 *Datos del inmueble:*\n• Dirección del inmueble\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo.",
        ],
    ]);

    $backToSuraFromCancel = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Volver Sura (Cancel)',
        'position_x' => 50,
        'position_y' => $suraY + 400,
        'config' => [
            'text' => "¿Necesitas algo más?",
            'options' => [
                ['label' => '🔙 Volver a Sura', 'value' => 'menu_sura'],
                ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
            ],
        ],
    ]);
    $suraCancelGeneric->update(['next_node_id' => $backToSuraFromCancel->id]);
    $suraCancelAutos->update(['next_node_id' => $backToSuraFromCancel->id]);
    $suraCancelHogar->update(['next_node_id' => $backToSuraFromCancel->id]);

    // --- SURA > CONSULTAS ---
    $suraConsultas = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Sura - Consultas',
        'position_x' => 200,
        'position_y' => $suraY,
        'config' => [
            'text' => "🔎 *Consultas SURA*\n\nSelecciona una opción:",
            'options' => [
                ['label' => '1️⃣ Pagos de póliza', 'value' => 'sura_pagos'],
                ['label' => '2️⃣ Directorio médico / Citas', 'value' => 'sura_directorio'],
                ['label' => '3️⃣ Modificación de póliza', 'value' => 'sura_modificacion'],
                ['label' => '4️⃣ Vigencia SOAT', 'value' => 'sura_soat'],
                ['label' => '5️⃣ Vencimiento de póliza', 'value' => 'sura_vencimiento'],
                ['label' => '6️⃣ Coberturas', 'value' => 'sura_coberturas'],
                ['label' => '7️⃣ Sedes / AutoSura', 'value' => 'sura_sedes'],
                ['label' => '8️⃣ Pérdida de cobertura', 'value' => 'sura_perdida_cob'],
                ['label' => '🔙 Volver', 'value' => 'menu_sura'],
            ],
        ],
    ]);

    $suraPagos = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Pagos',
        'position_x' => 150,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "💳 *Pago de póliza Sura*\n\nPuedes realizar tu pago en el siguiente enlace:\n🔗 https://www.segurossura.com.co/paginas/pago-express.aspx/",
        ],
    ]);

    $suraDirectorio = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Directorio Médico',
        'position_x' => 300,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "🏥 *Directorio Médico Sura*\n\nConsulta el directorio médico y agenda tu cita aquí:\n🔗 https://www.segurossura.com.co/paginas/salud/directorio-medico.aspx",
        ],
    ]);

    $suraModificacion = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Modificación',
        'position_x' => 450,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "✏️ *Modificación de póliza de salud*\n\nPara gestionar la modificación necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n📋 *Datos de la póliza:*\n• Tipo de póliza\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo.",
        ],
    ]);

    $suraSoat = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - SOAT',
        'position_x' => 600,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "🚗 *Vigencia del SOAT*\n\nPuedes validar la vigencia de tu SOAT directamente en el *RUNT* o en la *app Sura*.",
        ],
    ]);

    $suraVencimiento = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'message',
        'name' => 'Sura - Vencimiento',
        'position_x' => 750,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "📅 *Vencimiento de póliza*\n\nPara consultar el vencimiento necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🚗 *Datos del vehículo:* Placa\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo.",
        ],
    ]);

    $suraCoberturas = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Sura - Coberturas',
        'position_x' => 900,
        'position_y' => $suraY + 200,
        'config' => [
            'text' => "📋 *Coberturas SURA*\n\nSelecciona el tipo de seguro:",
            'options' => [
                ['label' => '1️⃣ Salud', 'value' => 'sura_cob_salud'],
                ['label' => '2️⃣ Vida Individual', 'value' => 'sura_cob_vida'],
                ['label' => '3️⃣ Hogar', 'value' => 'sura_cob_hogar'],
                ['label' => '4️⃣ Autos', 'value' => 'sura_cob_autos'],
                ['label' => '🔙 Volver', 'value' => 'sura_consultas'],
            ],
        ],
    ]);

    $suraCobSalud = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cob Salud',
        'position_x' => 800, 'position_y' => $suraY + 400,
        'config' => ['text' => "🏥 *Coberturas Pólizas de Salud Sura*\n\n🔗 https://www.segurossura.com.co/paginas/salud/planes.aspx"],
    ]);
    $suraCobVida = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cob Vida',
        'position_x' => 900, 'position_y' => $suraY + 400,
        'config' => ['text' => "💚 *Coberturas Pólizas Vida Individual Sura*\n\n🔗 https://www.segurossura.com.co/paginas/vida/inicio.aspx"],
    ]);
    $suraCobHogar = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cob Hogar',
        'position_x' => 1000, 'position_y' => $suraY + 400,
        'config' => ['text' => "🏠 *Coberturas Pólizas de Hogar Sura*\n\n🔗 https://www.segurossura.com.co/paginas/hogar/inicio.aspx"],
    ]);
    $suraCobAutos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cob Autos',
        'position_x' => 1100, 'position_y' => $suraY + 400,
        'config' => ['text' => "🚗 *Coberturas Pólizas de Autos Sura*\n\n🔗 https://www.segurossura.com.co/paginas/movilidad/autos/inicio.aspx"],
    ]);

    $backToSuraFromConsultas = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Volver Sura (Consultas)',
        'position_x' => 500,
        'position_y' => $suraY + 600,
        'config' => [
            'text' => "¿Necesitas algo más?",
            'options' => [
                ['label' => '🔙 Volver a Consultas', 'value' => 'sura_consultas'],
                ['label' => '🔙 Volver a Sura', 'value' => 'menu_sura'],
                ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
            ],
        ],
    ]);
    foreach ([$suraPagos, $suraDirectorio, $suraModificacion, $suraSoat, $suraVencimiento, $suraCobSalud, $suraCobVida, $suraCobHogar, $suraCobAutos] as $n) {
        $n->update(['next_node_id' => $backToSuraFromConsultas->id]);
    }

    $suraSedes = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Sura - Sedes',
        'position_x' => 1200, 'position_y' => $suraY + 200,
        'config' => [
            'text' => "📍 *Sedes e Información SURA*",
            'options' => [
                ['label' => '1️⃣ Sedes Salud Sura', 'value' => 'sura_sedes_salud'],
                ['label' => '2️⃣ AutoSura (Centros de servicio)', 'value' => 'sura_autosura'],
                ['label' => '🔙 Volver', 'value' => 'sura_consultas'],
            ],
        ],
    ]);

    $suraSedesSalud = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Sedes Salud',
        'position_x' => 1150, 'position_y' => $suraY + 400,
        'config' => ['text' => "🏥 *Sedes Salud Sura*\n\n🔗 https://www.segurossura.com.co/paginas/salud/sedes/saludsura.aspx"],
    ]);
    $suraAutosura = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - AutoSura',
        'position_x' => 1300, 'position_y' => $suraY + 400,
        'config' => ['text' => "🚗 *AutoSura - Centros de servicio*\n\n🔗 https://www.segurossura.com.co/paginas/movilidad/autos/centros-de-servicio/inicio.aspx"],
    ]);
    $suraSedesSalud->update(['next_node_id' => $backToSuraFromConsultas->id]);
    $suraAutosura->update(['next_node_id' => $backToSuraFromConsultas->id]);

    $suraPerdidaCob = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Pérdida Cobertura',
        'position_x' => 1400, 'position_y' => $suraY + 200,
        'config' => ['text' => "⚠️ *Pérdida de cobertura - Salud*\n\nPara validar necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);
    $suraPerdidaCob->update(['next_node_id' => $backToSuraFromConsultas->id]);

    // --- SURA > COTIZACIONES ---
    $suraCotizaciones = ChatbotNode::create([
        'flow_id' => $flow->id,
        'node_type' => 'question',
        'name' => 'Sura - Cotizaciones',
        'position_x' => 450,
        'position_y' => $suraY,
        'config' => [
            'text' => "💰 *Cotizaciones SURA*\n\n¿Qué tipo de seguro deseas cotizar?",
            'options' => [
                ['label' => '1️⃣ Vida', 'value' => 'sura_cot_vida'],
                ['label' => '2️⃣ Salud', 'value' => 'sura_cot_salud'],
                ['label' => '3️⃣ Autos', 'value' => 'sura_cot_autos'],
                ['label' => '4️⃣ Hogar', 'value' => 'sura_cot_hogar'],
                ['label' => '5️⃣ Mascotas', 'value' => 'sura_cot_mascotas'],
                ['label' => '6️⃣ Empresarial / Otros', 'value' => 'sura_cot_empresarial'],
                ['label' => '🔙 Volver', 'value' => 'menu_sura'],
            ],
        ],
    ]);

    $suraCotGeneric = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cot Vida/Salud/Hogar',
        'position_x' => 350, 'position_y' => $suraY + 200,
        'config' => ['text' => "Para cotizar tu póliza necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección\n• Estado civil\n• Correo electrónico\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $suraCotAutos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cot Autos',
        'position_x' => 500, 'position_y' => $suraY + 200,
        'config' => ['text' => "Para cotizar tu póliza de *Autos* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Estado civil\n• Correo electrónico\n\n🚗 *Datos del vehículo:*\n• Marca y modelo\n• Ciudad de circulación\n• Placa\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $suraCotMascotas = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cot Mascotas',
        'position_x' => 650, 'position_y' => $suraY + 200,
        'config' => ['text' => "🐾 *Cotización de Póliza de Mascotas*\n\nPuedes cotizar directamente aquí:\n🔗 https://surapet.com.co/asesorcliente/6486\n\nO envíanos los siguientes datos:\n• Edad de la mascota\n• Nombre\n• Sexo\n• Raza\n• Perro o gato\n• ¿Ha tenido algún tipo de enfermedad?"],
    ]);

    $suraCotHogar = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cot Hogar',
        'position_x' => 800, 'position_y' => $suraY + 200,
        'config' => ['text' => "Para cotizar tu póliza de *Hogar* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección, estado civil, correo\n\n🏠 *Datos del inmueble:*\n• Dirección del inmueble\n• Ciudad y departamento\n• Estrato\n• Valor de la vivienda\n• Valor de los contenidos\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $suraCotEmpresarial = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Cot Empresarial',
        'position_x' => 950, 'position_y' => $suraY + 200,
        'config' => ['text' => "Para cotizar tu póliza *Empresarial* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🏢 *Datos de la empresa:*\n• NIT\n• Dirección del inmueble\n• Actividad económica\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $backToSuraFromCot = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Volver Sura (Cot)',
        'position_x' => 600, 'position_y' => $suraY + 400,
        'config' => ['text' => "¿Necesitas algo más?", 'options' => [
            ['label' => '🔙 Volver a Cotizaciones', 'value' => 'sura_cotizaciones'],
            ['label' => '🔙 Volver a Sura', 'value' => 'menu_sura'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ]],
    ]);
    foreach ([$suraCotGeneric, $suraCotAutos, $suraCotMascotas, $suraCotHogar, $suraCotEmpresarial] as $n) {
        $n->update(['next_node_id' => $backToSuraFromCot->id]);
    }

    // --- SURA > RECLAMACIONES ---
    $suraReclamaciones = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Sura - Reclamaciones',
        'position_x' => 700, 'position_y' => $suraY,
        'config' => [
            'text' => "⚡ *Reclamaciones SURA*\n\n¿Qué tipo de reclamación necesitas?",
            'options' => [
                ['label' => '1️⃣ Vida - Incapacidad', 'value' => 'sura_rec_incapacidad'],
                ['label' => '2️⃣ Vida - Auxilio materno/paterno', 'value' => 'sura_rec_auxilio'],
                ['label' => '3️⃣ Vida - Renta diaria', 'value' => 'sura_rec_renta'],
                ['label' => '4️⃣ Hogar - Daños', 'value' => 'sura_rec_hogar_danos'],
                ['label' => '5️⃣ Hogar - Hurtos', 'value' => 'sura_rec_hogar_hurtos'],
                ['label' => '6️⃣ Empresarial - Daños', 'value' => 'sura_rec_empresarial'],
                ['label' => '7️⃣ Autos', 'value' => 'sura_rec_autos'],
                ['label' => '🔙 Volver', 'value' => 'menu_sura'],
            ],
        ],
    ]);

    $suraRecVida = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Rec Vida',
        'position_x' => 600, 'position_y' => $suraY + 200,
        'config' => ['text' => "Para gestionar tu reclamación necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n📋 *Documentos requeridos:*\n• Historia clínica\n• Incapacidad\n• Número de cuenta o certificación bancaria\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $suraRecHogarDanos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Rec Hogar Daños',
        'position_x' => 750, 'position_y' => $suraY + 200,
        'config' => ['text' => "Para gestionar tu reclamación de *daños en hogar* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Dirección del inmueble\n\n📋 *Documentos requeridos:*\n• Carta de reclamo a la compañía\n• Informe técnico\n• Fotos del equipo afectado\n• Cotización de reposición\n• Certificación bancaria\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $suraRecHogarHurtos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Rec Hogar Hurtos',
        'position_x' => 900, 'position_y' => $suraY + 200,
        'config' => ['text' => "Para gestionar tu reclamación de *hurto en hogar* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Dirección del inmueble\n\n📋 *Documentos requeridos:*\n• Carta de reclamo a la compañía\n• Denuncia\n• Cotización de reposición\n• Certificación bancaria\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $suraRecAutos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Rec Autos',
        'position_x' => 1050, 'position_y' => $suraY + 200,
        'config' => ['text' => "🚗 *Reclamación Autos Sura*\n\nPara reportar un siniestro debes comunicarte al *#888* para generar el reporte."],
    ]);

    $backToSuraFromRec = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Volver Sura (Rec)',
        'position_x' => 800, 'position_y' => $suraY + 400,
        'config' => ['text' => "¿Necesitas algo más?", 'options' => [
            ['label' => '🔙 Volver a Reclamaciones', 'value' => 'sura_reclamaciones'],
            ['label' => '🔙 Volver a Sura', 'value' => 'menu_sura'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ]],
    ]);
    foreach ([$suraRecVida, $suraRecHogarDanos, $suraRecHogarHurtos, $suraRecAutos] as $n) {
        $n->update(['next_node_id' => $backToSuraFromRec->id]);
    }

    // --- SURA > REEMBOLSOS ---
    $suraReembolsos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Sura - Reembolsos',
        'position_x' => 950, 'position_y' => $suraY,
        'config' => [
            'text' => "💸 *Reembolsos SURA*\n\n¿Qué tipo de reembolso necesitas?",
            'options' => [
                ['label' => '1️⃣ Terapias', 'value' => 'sura_reemb_terapia'],
                ['label' => '2️⃣ Consultas', 'value' => 'sura_reemb_consulta'],
                ['label' => '3️⃣ Pagos generales', 'value' => 'sura_reemb_pagos'],
                ['label' => '🔙 Volver', 'value' => 'menu_sura'],
            ],
        ],
    ]);

    $suraReembTerapia = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Reemb Terapia',
        'position_x' => 900, 'position_y' => $suraY + 200,
        'config' => ['text' => "💸 *Reembolso de terapias*\n\nTe enviaremos un video explicando cómo gestionar el reembolso.\n\n📋 *Documentos necesarios:*\n• Planilla de asistencia\n• Factura\n• Orden médica"],
    ]);

    $suraReembConsulta = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Reemb Consulta',
        'position_x' => 1050, 'position_y' => $suraY + 200,
        'config' => ['text' => "💸 *Reembolso de consultas*\n\nTe enviaremos un video explicando cómo gestionar el reembolso.\n\n📋 *Documento necesario:*\n• Factura de la atención"],
    ]);

    $suraReembPagos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Reemb Pagos',
        'position_x' => 1200, 'position_y' => $suraY + 200,
        'config' => ['text' => "Para gestionar tu reembolso de pagos necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $backToSuraFromReemb = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Volver Sura (Reemb)',
        'position_x' => 1050, 'position_y' => $suraY + 400,
        'config' => ['text' => "¿Necesitas algo más?", 'options' => [
            ['label' => '🔙 Volver a Reembolsos', 'value' => 'sura_reembolsos'],
            ['label' => '🔙 Volver a Sura', 'value' => 'menu_sura'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ]],
    ]);
    foreach ([$suraReembTerapia, $suraReembConsulta, $suraReembPagos] as $n) {
        $n->update(['next_node_id' => $backToSuraFromReemb->id]);
    }

    // --- SURA > SOLICITUDES ---
    $suraSolicitudes = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Sura - Solicitudes',
        'position_x' => 1200, 'position_y' => $suraY,
        'config' => [
            'text' => "📝 *Solicitudes SURA*\n\nSelecciona una opción:",
            'options' => [
                ['label' => '1️⃣ Atención domiciliaria', 'value' => 'sura_sol_domicilio'],
                ['label' => '2️⃣ Autorizaciones', 'value' => 'sura_sol_autorizaciones'],
                ['label' => '3️⃣ Transcribir incapacidad (EPS)', 'value' => 'sura_sol_eps'],
                ['label' => '4️⃣ Medicamentos', 'value' => 'sura_sol_medicamentos'],
                ['label' => '5️⃣ Urgencias odontológicas', 'value' => 'sura_sol_odonto'],
                ['label' => '6️⃣ Toma de muestras a domicilio', 'value' => 'sura_sol_muestras'],
                ['label' => '🔙 Volver', 'value' => 'menu_sura'],
            ],
        ],
    ]);

    $suraSolDomicilio = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Sol Domicilio',
        'position_x' => 1100, 'position_y' => $suraY + 200,
        'config' => ['text' => "🏥 *Atención en salud domiciliaria (Salud en casa)*\n\nLlama a la línea de atención Sura: *#888 opción 0*"],
    ]);

    $suraSolAutorizaciones = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Sol Autorizaciones',
        'position_x' => 1250, 'position_y' => $suraY + 200,
        'config' => ['text' => "📋 *Autorizaciones*\n\nPara gestionar necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n📋 *Documentos:*\n• Orden médica\n• Historia clínica\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $suraSolEps = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Sol EPS',
        'position_x' => 1400, 'position_y' => $suraY + 200,
        'config' => ['text' => "📝 *Transcribir Incapacidad*\n\nPara gestionar necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n📋 *Documentos:*\n• Historia clínica\n• Epicrisis\n• Incapacidad\n\nPor favor envíalos y en *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $suraSolMedicamentos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Sol Medicamentos',
        'position_x' => 1550, 'position_y' => $suraY + 200,
        'config' => ['text' => "💊 *Renovación o solicitud de medicamentos*\n\nTe enviaremos un instructivo con el paso a paso para gestionar tus medicamentos."],
    ]);

    $suraSolOdonto = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Sol Odonto',
        'position_x' => 1700, 'position_y' => $suraY + 200,
        'config' => ['text' => "🦷 *Urgencias odontológicas*\n\nTe compartimos información y puedes solicitar atención al *#888 opción 0*."],
    ]);

    $suraSolMuestras = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Sura - Sol Muestras',
        'position_x' => 1850, 'position_y' => $suraY + 200,
        'config' => ['text' => "🩺 *Toma de muestras a domicilio*\n\nSolicita tu toma de muestras aquí:\n🔗 https://seguros.comunicaciones.sura.com/toma-de-muestras-a-domicilio"],
    ]);

    $backToSuraFromSol = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Volver Sura (Sol)',
        'position_x' => 1400, 'position_y' => $suraY + 400,
        'config' => ['text' => "¿Necesitas algo más?", 'options' => [
            ['label' => '🔙 Volver a Solicitudes', 'value' => 'sura_solicitudes'],
            ['label' => '🔙 Volver a Sura', 'value' => 'menu_sura'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ]],
    ]);
    foreach ([$suraSolDomicilio, $suraSolAutorizaciones, $suraSolEps, $suraSolMedicamentos, $suraSolOdonto, $suraSolMuestras] as $n) {
        $n->update(['next_node_id' => $backToSuraFromSol->id]);
    }

    // ========== OTRAS COMPAÑÍAS SECTION ==========
    $otrasY = $y;
    $otrasMenu = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Menú Otras Compañías',
        'position_x' => 700, 'position_y' => $otrasY,
        'config' => [
            'text' => "📋 *Otras Compañías* (Allianz, Bolívar, Mapfre, SBS, Qualitas)\n\n¿Qué necesitas?",
            'options' => [
                ['label' => '1️⃣ Líneas de asistencia', 'value' => 'otras_asistencia'],
                ['label' => '2️⃣ Cancelaciones', 'value' => 'otras_cancelaciones'],
                ['label' => '3️⃣ Coberturas Autos', 'value' => 'otras_coberturas'],
                ['label' => '4️⃣ Cotizaciones', 'value' => 'otras_cotizaciones'],
                ['label' => '5️⃣ Reclamaciones', 'value' => 'otras_reclamaciones'],
                ['label' => '6️⃣ Pagos de póliza', 'value' => 'otras_pagos'],
                ['label' => '7️⃣ Fecha límite de pago', 'value' => 'otras_fecha_pago'],
                ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
            ],
        ],
    ]);

    // --- OTRAS > ASISTENCIA ---
    $otrasAsistencia = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Asistencia',
        'position_x' => 600, 'position_y' => $otrasY + 200,
        'config' => ['text' => "📞 *Líneas de asistencia:*\n\n• Mapfre: *#624*\n• Allianz: *#265*\n• Bolívar: *#322*\n• SBS: *#360*\n• Qualitas: *#963*"],
    ]);

    // --- OTRAS > CANCELACIONES ---
    $otrasCancelaciones = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Otras - Cancelaciones',
        'position_x' => 750, 'position_y' => $otrasY + 200,
        'config' => [
            'text' => "❌ *Cancelaciones*\n\n¿Qué tipo de póliza deseas cancelar?",
            'options' => [
                ['label' => '1️⃣ Hogar', 'value' => 'otras_cancel_hogar'],
                ['label' => '2️⃣ Empresarial', 'value' => 'otras_cancel_empresarial'],
                ['label' => '3️⃣ Autos', 'value' => 'otras_cancel_autos'],
                ['label' => '🔙 Volver', 'value' => 'menu_otras'],
            ],
        ],
    ]);

    $otrasCancelHogar = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cancel Hogar',
        'position_x' => 700, 'position_y' => $otrasY + 400,
        'config' => ['text' => "Para cancelar tu póliza de *Hogar/Empresarial* necesitamos:\n\n📝 *Datos:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Dirección del inmueble\n\nEn *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    $otrasCancelAutos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cancel Autos',
        'position_x' => 850, 'position_y' => $otrasY + 400,
        'config' => ['text' => "Para cancelar tu póliza de *Autos* necesitamos:\n\n📝 *Datos:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Placa\n\nEn *30 minutos aproximadamente* nos comunicaremos contigo."],
    ]);

    // --- OTRAS > COBERTURAS AUTOS ---
    $otrasCoberturas = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Otras - Coberturas Autos',
        'position_x' => 900, 'position_y' => $otrasY + 200,
        'config' => [
            'text' => "🚗 *Coberturas Pólizas de Autos*\n\nSelecciona la compañía:",
            'options' => [
                ['label' => '1️⃣ Allianz', 'value' => 'otras_cob_allianz'],
                ['label' => '2️⃣ Bolívar', 'value' => 'otras_cob_bolivar'],
                ['label' => '3️⃣ Qualitas', 'value' => 'otras_cob_qualitas'],
                ['label' => '4️⃣ SBS', 'value' => 'otras_cob_sbs'],
                ['label' => '5️⃣ Mapfre', 'value' => 'otras_cob_mapfre'],
                ['label' => '🔙 Volver', 'value' => 'menu_otras'],
            ],
        ],
    ]);

    $otrasCobAllianz = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cob Allianz', 'position_x' => 850, 'position_y' => $otrasY + 400, 'config' => ['text' => "🚗 *Coberturas Autos Allianz*\n\n🔗 https://www.allianz.co/seguros/vehiculos/Autos.html"]]);
    $otrasCobBolivar = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cob Bolívar', 'position_x' => 950, 'position_y' => $otrasY + 400, 'config' => ['text' => "🚗 *Coberturas Autos Bolívar*\n\n🔗 https://www.segurosbolivar.com/seguros-para-carros-integral"]]);
    $otrasCobQualitas = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cob Qualitas', 'position_x' => 1050, 'position_y' => $otrasY + 400, 'config' => ['text' => "🚗 *Coberturas Autos Qualitas*\n\n🔗 https://www.qualitascolombia.com.co/web/qco/livianos"]]);
    $otrasCobSbs = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cob SBS', 'position_x' => 1150, 'position_y' => $otrasY + 400, 'config' => ['text' => "🚗 *Coberturas Autos SBS*\n\n🔗 https://www.sbseguros.co/seguros-autos/carros"]]);
    $otrasCobMapfre = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cob Mapfre', 'position_x' => 1250, 'position_y' => $otrasY + 400, 'config' => ['text' => "🚗 *Coberturas Autos Mapfre*\n\n🔗 https://www.mapfre.com.co/seguros-carros/familiar/"]]);

    // --- OTRAS > COTIZACIONES ---
    $otrasCotizaciones = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Otras - Cotizaciones',
        'position_x' => 1050, 'position_y' => $otrasY + 200,
        'config' => [
            'text' => "💰 *Cotizaciones*\n\n¿Qué tipo de seguro deseas cotizar?",
            'options' => [
                ['label' => '1️⃣ Salud (Allianz)', 'value' => 'otras_cot_salud'],
                ['label' => '2️⃣ Autos (Todas las compañías)', 'value' => 'otras_cot_autos'],
                ['label' => '3️⃣ Hogar', 'value' => 'otras_cot_hogar'],
                ['label' => '4️⃣ Empresarial', 'value' => 'otras_cot_empresarial'],
                ['label' => '🔙 Volver', 'value' => 'menu_otras'],
            ],
        ],
    ]);

    $otrasCotSalud = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cot Salud', 'position_x' => 1000, 'position_y' => $otrasY + 400, 'config' => ['text' => "Para cotizar tu póliza de *Salud* necesitamos:\n\n📝 *Datos:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección, estado civil, correo electrónico\n\nEn *30 minutos aproximadamente* nos comunicaremos contigo."]]);
    $otrasCotAutos = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cot Autos', 'position_x' => 1150, 'position_y' => $otrasY + 400, 'config' => ['text' => "Para cotizar tu póliza de *Autos* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Estado civil, correo electrónico\n\n🚗 *Datos del vehículo:*\n• Marca y modelo\n• Ciudad de circulación\n• Placa\n\nEn *30 minutos aproximadamente* nos comunicaremos contigo."]]);
    $otrasCotHogar = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cot Hogar', 'position_x' => 1300, 'position_y' => $otrasY + 400, 'config' => ['text' => "Para cotizar tu póliza de *Hogar* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento, dirección, estado civil, correo\n\n🏠 *Datos del inmueble:*\n• Dirección, ciudad, departamento\n• Estrato, valor vivienda, valor contenidos\n\nEn *30 minutos aproximadamente* nos comunicaremos contigo."]]);
    $otrasCotEmpresarial = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Cot Empresarial', 'position_x' => 1450, 'position_y' => $otrasY + 400, 'config' => ['text' => "Para cotizar tu póliza *Empresarial* necesitamos:\n\n📝 *Datos:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• NIT, dirección del inmueble\n• Actividad económica\n\nEn *30 minutos aproximadamente* nos comunicaremos contigo."]]);

    // --- OTRAS > RECLAMACIONES ---
    $otrasReclamaciones = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Otras - Reclamaciones',
        'position_x' => 1200, 'position_y' => $otrasY + 200,
        'config' => [
            'text' => "⚡ *Reclamaciones*\n\nSelecciona el tipo:",
            'options' => [
                ['label' => '1️⃣ Autos', 'value' => 'otras_rec_autos'],
                ['label' => '2️⃣ Hogar - Hurtos', 'value' => 'otras_rec_hogar_hurtos'],
                ['label' => '3️⃣ Hogar - Daños', 'value' => 'otras_rec_hogar_danos'],
                ['label' => '4️⃣ Empresarial - Daños', 'value' => 'otras_rec_empresarial'],
                ['label' => '🔙 Volver', 'value' => 'menu_otras'],
            ],
        ],
    ]);

    $otrasRecAutos = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Rec Autos', 'position_x' => 1100, 'position_y' => $otrasY + 400, 'config' => ['text' => "🚗 *Reclamación Autos*\n\nPara generar el siniestro comunícate a:\n\n• Bolívar: *#322*\n• Mapfre: *#624*\n• Allianz: *#265*"]]);
    $otrasRecHogarHurtos = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Rec Hogar Hurtos', 'position_x' => 1250, 'position_y' => $otrasY + 400, 'config' => ['text' => "🏠 *Reclamación Hogar - Hurto*\n\nComunícate a la línea de tu aseguradora:\n• Allianz: *#265*\n• Bolívar: *#322*\n• Mapfre: *#624*\n\n📋 *Documentos adicionales:*\n• Carta de reclamo a la compañía\n• Denuncia\n• Cotización de reposición\n• Certificación bancaria"]]);
    $otrasRecHogarDanos = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Rec Hogar Daños', 'position_x' => 1400, 'position_y' => $otrasY + 400, 'config' => ['text' => "🏠 *Reclamación Hogar - Daños*\n\nComunícate a la línea de tu aseguradora:\n• Mapfre: *#624*\n• Bolívar: *#322*\n• Allianz: *#265*\n\n📋 *Documentos adicionales:*\n• Carta de reclamo\n• Informe técnico\n• Fotos del equipo afectado\n• Cotización de reposición\n• Certificación bancaria"]]);
    $otrasRecEmpresarial = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Rec Empresarial', 'position_x' => 1550, 'position_y' => $otrasY + 400, 'config' => ['text' => "🏢 *Reclamación Empresarial - Daños*\n\nComunícate a la línea de tu aseguradora:\n• Mapfre: *#624*\n• Allianz: *#265*\n\n📋 *Documentos adicionales:*\n• Carta de reclamo\n• Informe técnico\n• Fotos del equipo afectado\n• Cotización de reposición\n• Certificación bancaria"]]);

    // --- OTRAS > PAGOS ---
    $otrasPagos = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Otras - Pagos',
        'position_x' => 1350, 'position_y' => $otrasY + 200,
        'config' => [
            'text' => "💳 *Pagos de póliza*\n\nSelecciona tu compañía:",
            'options' => [
                ['label' => '1️⃣ Allianz', 'value' => 'otras_pago_allianz'],
                ['label' => '2️⃣ Bolívar', 'value' => 'otras_pago_bolivar'],
                ['label' => '3️⃣ Mapfre', 'value' => 'otras_pago_mapfre'],
                ['label' => '4️⃣ SBS', 'value' => 'otras_pago_sbs'],
                ['label' => '5️⃣ Qualitas', 'value' => 'otras_pago_qualitas'],
                ['label' => '🔙 Volver', 'value' => 'menu_otras'],
            ],
        ],
    ]);

    $otrasPagoAllianz = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Pago Allianz', 'position_x' => 1200, 'position_y' => $otrasY + 400, 'config' => ['text' => "💳 *Pago Allianz*\n\n🔗 https://gateway1.ecollect.co/eCollectPlus/Default.aspx"]]);
    $otrasPagoBolivar = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Pago Bolívar', 'position_x' => 1300, 'position_y' => $otrasY + 400, 'config' => ['text' => "💳 *Pago Bolívar*\n\n🔗 https://recaudos.segurosbolivar.com/login"]]);
    $otrasPagoMapfre = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Pago Mapfre', 'position_x' => 1400, 'position_y' => $otrasY + 400, 'config' => ['text' => "💳 *Pago Mapfre*\n\n🔗 https://cotiza.mapfre.com.co/pagosWeb/vista/paginas/noFilterIniPagosPublico.jsf"]]);
    $otrasPagoSbs = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Pago SBS', 'position_x' => 1500, 'position_y' => $otrasY + 400, 'config' => ['text' => "💳 *Pago SBS*\n\n🔗 https://www.sbseguros.co/servicio-al-cliente/alternativas-pagos"]]);
    $otrasPagoQualitas = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Pago Qualitas', 'position_x' => 1600, 'position_y' => $otrasY + 400, 'config' => ['text' => "💳 *Pago Qualitas*\n\n🔗 https://www.qualitascolombia.com.co/pago-de-poliza"]]);

    // --- OTRAS > FECHA LIMITE DE PAGO ---
    $otrasFechaPago = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Otras - Fecha Pago',
        'position_x' => 1500, 'position_y' => $otrasY + 200,
        'config' => [
            'text' => "📅 *Consulta fecha límite de pago*\n\nSelecciona el tipo de póliza:",
            'options' => [
                ['label' => '1️⃣ Hogar', 'value' => 'otras_fecha_hogar'],
                ['label' => '2️⃣ Empresarial', 'value' => 'otras_fecha_empresarial'],
                ['label' => '3️⃣ Autos', 'value' => 'otras_fecha_autos'],
                ['label' => '🔙 Volver', 'value' => 'menu_otras'],
            ],
        ],
    ]);

    $otrasFechaHogar = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Fecha Hogar', 'position_x' => 1400, 'position_y' => $otrasY + 400, 'config' => ['text' => "Para consultar la fecha límite de pago de tu póliza de *Hogar/Empresarial* necesitamos:\n\n📝 *Datos:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Dirección del inmueble\n\nEn *30 minutos aproximadamente* nos comunicaremos contigo."]]);
    $otrasFechaAutos = ChatbotNode::create(['flow_id' => $flow->id, 'node_type' => 'message', 'name' => 'Otras - Fecha Autos', 'position_x' => 1550, 'position_y' => $otrasY + 400, 'config' => ['text' => "Para consultar la fecha límite de pago de tu póliza de *Autos* necesitamos:\n\n📝 *Datos:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Placa\n\nEn *30 minutos aproximadamente* nos comunicaremos contigo."]]);

    // --- TRANSFER TO AGENT ---
    $transferNode = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'transfer', 'name' => 'Transferir a asesor',
        'position_x' => 1100, 'position_y' => $otrasY,
        'config' => [
            'text' => "Te estamos transfiriendo con un asesor humano. En breve te atenderemos. 🙏",
            'department_id' => null,
        ],
    ]);

    // --- BACK-TO-MENU node for "Otras" ---
    $backToOtras = ChatbotNode::create([
        'flow_id' => $flow->id, 'node_type' => 'question', 'name' => 'Volver Otras',
        'position_x' => 1300, 'position_y' => $otrasY + 600,
        'config' => ['text' => "¿Necesitas algo más?", 'options' => [
            ['label' => '🔙 Volver a Otras Compañías', 'value' => 'menu_otras'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ]],
    ]);

    // Connect all "Otras" leaf nodes to back menu
    foreach ([$otrasAsistencia, $otrasCancelHogar, $otrasCancelAutos, 
              $otrasCobAllianz, $otrasCobBolivar, $otrasCobQualitas, $otrasCobSbs, $otrasCobMapfre,
              $otrasCotSalud, $otrasCotAutos, $otrasCotHogar, $otrasCotEmpresarial,
              $otrasRecAutos, $otrasRecHogarHurtos, $otrasRecHogarDanos, $otrasRecEmpresarial,
              $otrasPagoAllianz, $otrasPagoBolivar, $otrasPagoMapfre, $otrasPagoSbs, $otrasPagoQualitas,
              $otrasFechaHogar, $otrasFechaAutos] as $n) {
        $n->update(['next_node_id' => $backToOtras->id]);
    }

    // ========== 4. WIRE UP NAVIGATION (question options -> next nodes) ==========
    // Main Menu connections
    $mainMenu->update(['config' => array_merge($mainMenu->config, [
        'option_routes' => [
            'sura' => $suraMenu->id,
            'otras' => $otrasMenu->id,
            'asesor' => $transferNode->id,
        ],
    ])]);

    // Sura Menu connections
    $suraMenu->update(['config' => array_merge($suraMenu->config, [
        'option_routes' => [
            'sura_contacto' => $suraContacto->id,
            'sura_cancelaciones' => $suraCancelaciones->id,
            'sura_consultas' => $suraConsultas->id,
            'sura_cotizaciones' => $suraCotizaciones->id,
            'sura_reclamaciones' => $suraReclamaciones->id,
            'sura_reembolsos' => $suraReembolsos->id,
            'sura_solicitudes' => $suraSolicitudes->id,
            'menu_principal' => $mainMenu->id,
        ],
    ])]);

    // Sura Contacto
    $suraContacto->update(['config' => array_merge($suraContacto->config, [
        'option_routes' => [
            'sura_linea_asistencia' => $suraLineaAsist->id,
            'sura_canales' => $suraCanales->id,
            'menu_sura' => $suraMenu->id,
        ],
    ])]);

    // Sura Cancelaciones
    $suraCancelaciones->update(['config' => array_merge($suraCancelaciones->config, [
        'option_routes' => [
            'sura_cancel_vida_ind' => $suraCancelGeneric->id,
            'sura_cancel_vida_grupo' => $suraCancelGeneric->id,
            'sura_cancel_salud' => $suraCancelGeneric->id,
            'sura_cancel_autos' => $suraCancelAutos->id,
            'sura_cancel_hogar' => $suraCancelHogar->id,
            'sura_cancel_empresarial' => $suraCancelHogar->id,
            'sura_cancel_mascotas' => $suraCancelGeneric->id,
            'sura_cancel_otra' => $suraCancelGeneric->id,
            'menu_sura' => $suraMenu->id,
        ],
    ])]);

    // Sura Consultas
    $suraConsultas->update(['config' => array_merge($suraConsultas->config, [
        'option_routes' => [
            'sura_pagos' => $suraPagos->id,
            'sura_directorio' => $suraDirectorio->id,
            'sura_modificacion' => $suraModificacion->id,
            'sura_soat' => $suraSoat->id,
            'sura_vencimiento' => $suraVencimiento->id,
            'sura_coberturas' => $suraCoberturas->id,
            'sura_sedes' => $suraSedes->id,
            'sura_perdida_cob' => $suraPerdidaCob->id,
            'menu_sura' => $suraMenu->id,
        ],
    ])]);

    // Sura Coberturas submenu
    $suraCoberturas->update(['config' => array_merge($suraCoberturas->config, [
        'option_routes' => [
            'sura_cob_salud' => $suraCobSalud->id,
            'sura_cob_vida' => $suraCobVida->id,
            'sura_cob_hogar' => $suraCobHogar->id,
            'sura_cob_autos' => $suraCobAutos->id,
            'sura_consultas' => $suraConsultas->id,
        ],
    ])]);

    // Sura Sedes submenu
    $suraSedes->update(['config' => array_merge($suraSedes->config, [
        'option_routes' => [
            'sura_sedes_salud' => $suraSedesSalud->id,
            'sura_autosura' => $suraAutosura->id,
            'sura_consultas' => $suraConsultas->id,
        ],
    ])]);

    // Sura Cotizaciones
    $suraCotizaciones->update(['config' => array_merge($suraCotizaciones->config, [
        'option_routes' => [
            'sura_cot_vida' => $suraCotGeneric->id,
            'sura_cot_salud' => $suraCotGeneric->id,
            'sura_cot_autos' => $suraCotAutos->id,
            'sura_cot_hogar' => $suraCotHogar->id,
            'sura_cot_mascotas' => $suraCotMascotas->id,
            'sura_cot_empresarial' => $suraCotEmpresarial->id,
            'menu_sura' => $suraMenu->id,
        ],
    ])]);

    // Sura Reclamaciones
    $suraReclamaciones->update(['config' => array_merge($suraReclamaciones->config, [
        'option_routes' => [
            'sura_rec_incapacidad' => $suraRecVida->id,
            'sura_rec_auxilio' => $suraRecVida->id,
            'sura_rec_renta' => $suraRecVida->id,
            'sura_rec_hogar_danos' => $suraRecHogarDanos->id,
            'sura_rec_hogar_hurtos' => $suraRecHogarHurtos->id,
            'sura_rec_empresarial' => $suraRecHogarDanos->id,
            'sura_rec_autos' => $suraRecAutos->id,
            'menu_sura' => $suraMenu->id,
        ],
    ])]);

    // Sura Reembolsos
    $suraReembolsos->update(['config' => array_merge($suraReembolsos->config, [
        'option_routes' => [
            'sura_reemb_terapia' => $suraReembTerapia->id,
            'sura_reemb_consulta' => $suraReembConsulta->id,
            'sura_reemb_pagos' => $suraReembPagos->id,
            'menu_sura' => $suraMenu->id,
        ],
    ])]);

    // Sura Solicitudes
    $suraSolicitudes->update(['config' => array_merge($suraSolicitudes->config, [
        'option_routes' => [
            'sura_sol_domicilio' => $suraSolDomicilio->id,
            'sura_sol_autorizaciones' => $suraSolAutorizaciones->id,
            'sura_sol_eps' => $suraSolEps->id,
            'sura_sol_medicamentos' => $suraSolMedicamentos->id,
            'sura_sol_odonto' => $suraSolOdonto->id,
            'sura_sol_muestras' => $suraSolMuestras->id,
            'menu_sura' => $suraMenu->id,
        ],
    ])]);

    // All "back" question nodes
    foreach ([$backToSuraFromContact, $backToSuraFromCancel, $backToSuraFromConsultas, $backToSuraFromCot, $backToSuraFromRec, $backToSuraFromReemb, $backToSuraFromSol] as $backNode) {
        $routes = [];
        foreach ($backNode->config['options'] as $opt) {
            if ($opt['value'] === 'menu_sura') $routes[$opt['value']] = $suraMenu->id;
            elseif ($opt['value'] === 'menu_principal') $routes[$opt['value']] = $mainMenu->id;
            elseif ($opt['value'] === 'sura_consultas') $routes[$opt['value']] = $suraConsultas->id;
            elseif ($opt['value'] === 'sura_cotizaciones') $routes[$opt['value']] = $suraCotizaciones->id;
            elseif ($opt['value'] === 'sura_reclamaciones') $routes[$opt['value']] = $suraReclamaciones->id;
            elseif ($opt['value'] === 'sura_reembolsos') $routes[$opt['value']] = $suraReembolsos->id;
            elseif ($opt['value'] === 'sura_solicitudes') $routes[$opt['value']] = $suraSolicitudes->id;
        }
        $backNode->update(['config' => array_merge($backNode->config, ['option_routes' => $routes])]);
    }

    // Otras Menu connections
    $otrasMenu->update(['config' => array_merge($otrasMenu->config, [
        'option_routes' => [
            'otras_asistencia' => $otrasAsistencia->id,
            'otras_cancelaciones' => $otrasCancelaciones->id,
            'otras_coberturas' => $otrasCoberturas->id,
            'otras_cotizaciones' => $otrasCotizaciones->id,
            'otras_reclamaciones' => $otrasReclamaciones->id,
            'otras_pagos' => $otrasPagos->id,
            'otras_fecha_pago' => $otrasFechaPago->id,
            'menu_principal' => $mainMenu->id,
        ],
    ])]);

    // Otras submenus
    $otrasCancelaciones->update(['config' => array_merge($otrasCancelaciones->config, [
        'option_routes' => [
            'otras_cancel_hogar' => $otrasCancelHogar->id,
            'otras_cancel_empresarial' => $otrasCancelHogar->id,
            'otras_cancel_autos' => $otrasCancelAutos->id,
            'menu_otras' => $otrasMenu->id,
        ],
    ])]);

    $otrasCoberturas->update(['config' => array_merge($otrasCoberturas->config, [
        'option_routes' => [
            'otras_cob_allianz' => $otrasCobAllianz->id,
            'otras_cob_bolivar' => $otrasCobBolivar->id,
            'otras_cob_qualitas' => $otrasCobQualitas->id,
            'otras_cob_sbs' => $otrasCobSbs->id,
            'otras_cob_mapfre' => $otrasCobMapfre->id,
            'menu_otras' => $otrasMenu->id,
        ],
    ])]);

    $otrasCotizaciones->update(['config' => array_merge($otrasCotizaciones->config, [
        'option_routes' => [
            'otras_cot_salud' => $otrasCotSalud->id,
            'otras_cot_autos' => $otrasCotAutos->id,
            'otras_cot_hogar' => $otrasCotHogar->id,
            'otras_cot_empresarial' => $otrasCotEmpresarial->id,
            'menu_otras' => $otrasMenu->id,
        ],
    ])]);

    $otrasReclamaciones->update(['config' => array_merge($otrasReclamaciones->config, [
        'option_routes' => [
            'otras_rec_autos' => $otrasRecAutos->id,
            'otras_rec_hogar_hurtos' => $otrasRecHogarHurtos->id,
            'otras_rec_hogar_danos' => $otrasRecHogarDanos->id,
            'otras_rec_empresarial' => $otrasRecEmpresarial->id,
            'menu_otras' => $otrasMenu->id,
        ],
    ])]);

    $otrasPagos->update(['config' => array_merge($otrasPagos->config, [
        'option_routes' => [
            'otras_pago_allianz' => $otrasPagoAllianz->id,
            'otras_pago_bolivar' => $otrasPagoBolivar->id,
            'otras_pago_mapfre' => $otrasPagoMapfre->id,
            'otras_pago_sbs' => $otrasPagoSbs->id,
            'otras_pago_qualitas' => $otrasPagoQualitas->id,
            'menu_otras' => $otrasMenu->id,
        ],
    ])]);

    $otrasFechaPago->update(['config' => array_merge($otrasFechaPago->config, [
        'option_routes' => [
            'otras_fecha_hogar' => $otrasFechaHogar->id,
            'otras_fecha_empresarial' => $otrasFechaHogar->id,
            'otras_fecha_autos' => $otrasFechaAutos->id,
            'menu_otras' => $otrasMenu->id,
        ],
    ])]);

    $backToOtras->update(['config' => array_merge($backToOtras->config, [
        'option_routes' => [
            'menu_otras' => $otrasMenu->id,
            'menu_principal' => $mainMenu->id,
        ],
    ])]);

    // ========== 5. CREATE TRIGGERS ==========
    ChatbotTrigger::create([
        'chatbot_id' => $chatbot->id,
        'flow_id' => $flow->id,
        'trigger_type' => 'first_message',
        'trigger_value' => null,
        'priority' => 100,
        'is_active' => true,
    ]);

    ChatbotTrigger::create([
        'chatbot_id' => $chatbot->id,
        'flow_id' => $flow->id,
        'trigger_type' => 'keyword',
        'trigger_value' => 'menú',
        'priority' => 90,
        'is_active' => true,
    ]);

    ChatbotTrigger::create([
        'chatbot_id' => $chatbot->id,
        'flow_id' => $flow->id,
        'trigger_type' => 'keyword',
        'trigger_value' => 'menu',
        'priority' => 90,
        'is_active' => true,
    ]);

    ChatbotTrigger::create([
        'chatbot_id' => $chatbot->id,
        'flow_id' => $flow->id,
        'trigger_type' => 'keyword',
        'trigger_value' => 'hola',
        'priority' => 80,
        'is_active' => true,
    ]);

    DB::commit();

    $nodeCount = ChatbotNode::where('flow_id', $flow->id)->count();
    $triggerCount = ChatbotTrigger::where('chatbot_id', $chatbot->id)->count();

    echo "\n🎉 ¡Chatbot creado exitosamente!\n";
    echo "   Chatbot ID: {$chatbot->id}\n";
    echo "   Flujo ID: {$flow->id}\n";
    echo "   Nodos: {$nodeCount}\n";
    echo "   Triggers: {$triggerCount}\n";
    echo "   Broker ID: {$BROKER_ID}\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "   File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "   Trace: " . $e->getTraceAsString() . "\n";
}
