<?php
/**
 * Seeder script: Proyectamos V3 chatbot for broker dpalacior@sura.com.co (broker_id=37)
 * Run on production:
 *   /opt/cpanel/ea-php83/root/usr/bin/php seed_proyectamosv3_chatbot.php
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

$BROKER_ID   = 37;
$INSTANCE_ID = 'instance_37_T6Trfgkc';
$CHATBOT_NAME = 'proyectamosv3';

// Base URL for media files stored in public/storage/chatbot/
$MEDIA_BASE = 'https://app.guro.co/storage/chatbot';

echo "=== Creando chatbot '{$CHATBOT_NAME}' para broker_id={$BROKER_ID} ===\n";

DB::beginTransaction();

try {
    // ========== 1. CREATE CHATBOT ==========
    $chatbot = Chatbot::create([
        'broker_id'   => $BROKER_ID,
        'instance_id' => $INSTANCE_ID,
        'name'        => $CHATBOT_NAME,
        'description' => 'Chatbot Proyectamos Seguros v3 - Menú completo de seguros',
        'is_active'   => false,  // Se activa manualmente después de verificar
        'welcome_message' => "¡Hola! 👋 Bienvenido a *Proyectamos Seguros*.\n\nSoy tu asistente virtual. ¿En qué puedo ayudarte hoy?",
        'fallback_message' => "Lo siento, no entendí tu mensaje. Por favor selecciona una de las opciones del menú o escribe *menú* para ver las opciones disponibles.",
        'goodbye_message' => "¡Gracias por contactarnos! Si necesitas algo más, no dudes en escribirnos. ¡Que tengas un excelente día! 🙌",
        'ai_enabled'   => false,
        'typing_delay_ms' => 800,
        'response_delay_ms' => 500,
        'session_timeout_minutes' => 30,
        'max_fallback_count' => 3,
    ]);
    echo "✅ Chatbot creado: ID={$chatbot->id}\n";

    // ========== 2. CREATE MAIN FLOW ==========
    $flow = ChatbotFlow::create([
        'chatbot_id'  => $chatbot->id,
        'name'        => 'Flujo Principal',
        'description' => 'Menú principal de Proyectamos Seguros v3',
        'is_default'  => true,
        'is_active'   => true,
    ]);
    echo "✅ Flujo creado: ID={$flow->id}\n";

    // ========== HELPER ==========
    $y = 0;
    $mk = function (string $type, string $name, array $config, int $x = 400, ?int $customY = null) use ($flow, &$y) {
        $node = ChatbotNode::create([
            'flow_id'    => $flow->id,
            'node_type'  => $type,
            'name'       => $name,
            'position_x' => $x,
            'position_y' => $customY ?? $y,
            'config'     => $config,
        ]);
        return $node;
    };

    // ========== 3. START + WELCOME ==========
    $startNode = $mk('start', 'Inicio', [], 400, 0);
    $welcomeNode = $mk('message', 'Bienvenida', [
        'text' => "¡Hola! 👋 Bienvenido a *Proyectamos Seguros*.\n\nSoy tu asistente virtual y estoy aquí para ayudarte.",
    ], 400, 150);
    $startNode->update(['next_node_id' => $welcomeNode->id]);

    // ========== 4. MAIN MENU ==========
    $mainMenu = $mk('question', 'Menú Principal', [
        'text' => "¿En qué te puedo ayudar?",
        'options' => [
            ['label' => '1️⃣ Autos', 'value' => 'autos'],
            ['label' => '2️⃣ Salud', 'value' => 'salud'],
            ['label' => '3️⃣ Vida y Rentas', 'value' => 'vida'],
            ['label' => '4️⃣ Empresariales', 'value' => 'empresariales'],
            ['label' => '5️⃣ Otros Seguros', 'value' => 'otros_seguros'],
            ['label' => '6️⃣ Cartera / Pagos', 'value' => 'cartera'],
            ['label' => '7️⃣ Certificados', 'value' => 'certificados'],
            ['label' => '8️⃣ Asistencia', 'value' => 'asistencia'],
            ['label' => '9️⃣ Otras Consultas', 'value' => 'otras_consultas'],
            ['label' => '🔟 Canales de Contacto', 'value' => 'canales_contacto'],
            ['label' => '💬 Hablar con un asesor', 'value' => 'asesor'],
        ],
    ], 400, 300);
    $welcomeNode->update(['next_node_id' => $mainMenu->id]);

    // ========== TRANSFER NODE ==========
    $transferNode = $mk('transfer', 'Transferir a asesor', [
        'text' => "Te estamos transfiriendo con un asesor. En un momento te atenderemos. 🙋‍♂️",
    ], 400, 5000);

    // ============================================================
    // ========== AUTOS SECTION ==========
    // ============================================================
    $autosMenu = $mk('question', 'Menú Autos', [
        'text' => "🚗 *AUTOS* - ¿Qué necesitas?",
        'options' => [
            ['label' => '1️⃣ Cotizar', 'value' => 'autos_cotizar'],
            ['label' => '2️⃣ Modificar', 'value' => 'autos_modificar'],
            ['label' => '3️⃣ Cancelar', 'value' => 'autos_cancelar'],
            ['label' => '4️⃣ Coberturas', 'value' => 'autos_coberturas'],
            ['label' => '5️⃣ Reclamaciones', 'value' => 'autos_reclamaciones'],
            ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
        ],
    ], 0, 600);

    $autosCotizar = $mk('message', 'Autos - Cotizar', [
        'text' => "Para cotizarte la póliza de *Autos* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Fecha de nacimiento\n• Número de contacto\n• Estado civil y correo electrónico\n\n🚗 *Datos de la póliza:*\n• Marca\n• Modelo del auto\n• Ciudad de circulación y placa\n• En caso de ser 0 kilómetros adjuntar factura del vehículo\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], -200, 800);

    $autosModificar = $mk('message', 'Autos - Modificar', [
        'text' => "Necesitamos los siguientes datos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🚗 *Datos de la póliza:*\n• Placa\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], -50, 800);

    $autosCancelar = $mk('message', 'Autos - Cancelar', [
        'text' => "Necesitamos los siguientes datos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🚗 *Datos de la póliza:*\n• Placa\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], 100, 800);

    // Autos Coberturas - submenu by company
    $autosCoberturas = $mk('question', 'Autos - Coberturas', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'autos_cob_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'autos_cob_allianz'],
            ['label' => '3️⃣ SBS', 'value' => 'autos_cob_sbs'],
            ['label' => '4️⃣ Qualitas', 'value' => 'autos_cob_qualitas'],
            ['label' => '5️⃣ Bolívar', 'value' => 'autos_cob_bolivar'],
            ['label' => '6️⃣ Mapfre', 'value' => 'autos_cob_mapfre'],
            ['label' => '🔙 Volver', 'value' => 'menu_autos'],
        ],
    ], 250, 800);

    $autosCobSura = $mk('message', 'Autos Cob - Sura', ['text' => "🔗 https://www.segurossura.com.co/paginas/movilidad/autos/inicio.aspx"], 100, 1000);
    $autosCobAllianz = $mk('message', 'Autos Cob - Allianz', ['text' => "🔗 https://www.allianz.co/seguros/vehiculos/Autos.html"], 200, 1000);
    $autosCobSbs = $mk('message', 'Autos Cob - SBS', ['text' => "🔗 https://www.sbseguros.co/seguros-autos/carros"], 300, 1000);
    $autosCobQualitas = $mk('message', 'Autos Cob - Qualitas', ['text' => "🔗 https://www.qualitascolombia.com.co/livianos"], 400, 1000);
    $autosCobBolivar = $mk('message', 'Autos Cob - Bolívar', ['text' => "🔗 https://www.segurosbolivar.com/seguros-para-carros-integral"], 500, 1000);
    $autosCobMapfre = $mk('message', 'Autos Cob - Mapfre', ['text' => "🔗 https://www.mapfre.com.co/seguros-carros/familiar/"], 600, 1000);

    // Autos Reclamaciones - submenu by company
    $autosReclamaciones = $mk('question', 'Autos - Reclamaciones', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'autos_rec_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'autos_rec_allianz'],
            ['label' => '3️⃣ SBS', 'value' => 'autos_rec_sbs'],
            ['label' => '4️⃣ Qualitas', 'value' => 'autos_rec_qualitas'],
            ['label' => '5️⃣ Bolívar', 'value' => 'autos_rec_bolivar'],
            ['label' => '6️⃣ Mapfre', 'value' => 'autos_rec_mapfre'],
            ['label' => '🔙 Volver', 'value' => 'menu_autos'],
        ],
    ], 450, 800);

    $autosRecSura = $mk('message', 'Autos Rec - Sura', ['text' => "Se debe comunicar al *#888* para generar el siniestro y así poder realizarte el acompañamiento en todo el proceso."], 350, 1000);
    $autosRecAllianz = $mk('message', 'Autos Rec - Allianz', ['text' => "Se debe comunicar al *#265* para generar el siniestro y así poder realizarte el acompañamiento en todo el proceso."], 450, 1000);
    $autosRecSbs = $mk('message', 'Autos Rec - SBS', ['text' => "Se debe comunicar al *#360* para generar el siniestro y así poder realizarte el acompañamiento en todo el proceso."], 550, 1000);
    $autosRecQualitas = $mk('message', 'Autos Rec - Qualitas', ['text' => "Se debe comunicar al *#963* para generar el siniestro y así poder realizarte el acompañamiento en todo el proceso."], 650, 1000);
    $autosRecBolivar = $mk('message', 'Autos Rec - Bolívar', ['text' => "Se debe comunicar al *#322* para generar el siniestro y así poder realizarte el acompañamiento en todo el proceso."], 750, 1000);
    $autosRecMapfre = $mk('message', 'Autos Rec - Mapfre', ['text' => "Se debe comunicar al *#624* para generar el siniestro y así poder realizarte el acompañamiento en todo el proceso."], 850, 1000);

    // Back nodes for Autos
    $backAutos = $mk('question', 'Volver (Autos)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🔙 Volver a Autos', 'value' => 'menu_autos'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], 0, 1200);

    foreach ([$autosCotizar, $autosModificar, $autosCancelar,
              $autosCobSura, $autosCobAllianz, $autosCobSbs, $autosCobQualitas, $autosCobBolivar, $autosCobMapfre,
              $autosRecSura, $autosRecAllianz, $autosRecSbs, $autosRecQualitas, $autosRecBolivar, $autosRecMapfre] as $n) {
        $n->update(['next_node_id' => $backAutos->id]);
    }

    // ============================================================
    // ========== SALUD SECTION ==========
    // ============================================================
    $saludMenu = $mk('question', 'Menú Salud', [
        'text' => "🏥 *SALUD* - ¿Qué necesitas?",
        'options' => [
            ['label' => '1️⃣ Cotizar', 'value' => 'salud_cotizar'],
            ['label' => '2️⃣ Modificar', 'value' => 'salud_modificar'],
            ['label' => '3️⃣ Cancelar', 'value' => 'salud_cancelar'],
            ['label' => '4️⃣ Coberturas', 'value' => 'salud_coberturas'],
            ['label' => '5️⃣ Reclamaciones', 'value' => 'salud_reclamaciones'],
            ['label' => '6️⃣ Medicamentos POS', 'value' => 'salud_medicamentos'],
            ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
        ],
    ], 1000, 600);

    $saludCotizar = $mk('message', 'Salud - Cotizar', [
        'text' => "Para cotizarte la póliza de *Salud* necesitamos:\n\n📝 *Datos personales de cada asegurado:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección\n• Estado civil y correo electrónico\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], 800, 800);

    $saludModificar = $mk('message', 'Salud - Modificar', [
        'text' => "Para modificarte la póliza de *Salud* necesitamos los siguientes datos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], 950, 800);

    $saludCancelar = $mk('message', 'Salud - Cancelar', [
        'text' => "Para cancelarte la póliza de *Salud* necesitamos los siguientes datos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], 1100, 800);

    // Salud Coberturas
    $saludCoberturas = $mk('question', 'Salud - Coberturas', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'salud_cob_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'salud_cob_allianz'],
            ['label' => '3️⃣ SBS', 'value' => 'salud_cob_sbs'],
            ['label' => '4️⃣ Bolívar', 'value' => 'salud_cob_bolivar'],
            ['label' => '5️⃣ Mapfre', 'value' => 'salud_cob_mapfre'],
            ['label' => '🔙 Volver', 'value' => 'menu_salud'],
        ],
    ], 1250, 800);

    $saludCobSura = $mk('message', 'Salud Cob - Sura', ['text' => "🔗 https://www.segurossura.com.co/paginas/salud/planes.aspx"], 1100, 1000);
    $saludCobAllianz = $mk('message', 'Salud Cob - Allianz', ['text' => "🔗 https://www.allianz.co/seguros/personas/salud.html"], 1200, 1000);
    $saludCobSbs = $mk('message', 'Salud Cob - SBS', ['text' => "🔗 https://www.sbseguros.co/seguro-salud"], 1300, 1000);
    $saludCobBolivar = $mk('message', 'Salud Cob - Bolívar', ['text' => "🔗 https://digital.experienciasbolivar.segurosbolivar.com/seguro-salud-a-su-medida"], 1400, 1000);
    $saludCobMapfre = $mk('message', 'Salud Cob - Mapfre', ['text' => "🔗 https://www.mapfre.com.co/seguros-salud/"], 1500, 1000);

    // Salud Reclamaciones
    $saludReclamaciones = $mk('question', 'Salud - Reclamaciones', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'salud_rec_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'salud_rec_allianz'],
            ['label' => '3️⃣ SBS', 'value' => 'salud_rec_sbs'],
            ['label' => '4️⃣ Bolívar', 'value' => 'salud_rec_bolivar'],
            ['label' => '5️⃣ Mapfre', 'value' => 'salud_rec_mapfre'],
            ['label' => '🔙 Volver', 'value' => 'menu_salud'],
        ],
    ], 1450, 800);

    // Salud Rec Sura -> submenu (Autorización, Reembolso)
    $saludRecSura = $mk('question', 'Salud Rec - Sura', [
        'text' => "Indícanos en qué podemos ayudarte:",
        'options' => [
            ['label' => '1️⃣ Autorización', 'value' => 'salud_rec_sura_autorizacion'],
            ['label' => '2️⃣ Reembolso', 'value' => 'salud_rec_sura_reembolso'],
            ['label' => '🔙 Volver', 'value' => 'salud_reclamaciones'],
        ],
    ], 1300, 1000);

    $saludRecSuraAutorizacion = $mk('message', 'Salud Rec Sura - Autorización', [
        'text' => "Para realizar la solicitud, debes enviarnos los siguientes documentos: 📝\n• Orden médica\n• Historia clínica\n\nRealizaremos tu solicitud lo más pronto posible 🤓\nGracias por confiar en nosotros 🤝",
    ], 1200, 1200);

    // Salud Rec Sura Reembolso -> submenu (Terapias, Consulta externa)
    $saludRecSuraReembolso = $mk('question', 'Salud Rec Sura - Reembolso', [
        'text' => "¿Qué tipo de reembolso necesitas?",
        'options' => [
            ['label' => '1️⃣ Terapias', 'value' => 'salud_reemb_terapias'],
            ['label' => '2️⃣ Consulta externa', 'value' => 'salud_reemb_consulta'],
            ['label' => '🔙 Volver', 'value' => 'salud_rec_sura'],
        ],
    ], 1400, 1200);

    $saludReembTerapias = $mk('message', 'Salud Reemb - Terapias', [
        'text' => "Para realizar la solicitud, debes enviarnos los siguientes documentos: 📝\n• Planilla de asistencia\n• Factura\n• Orden médica\n\nRealizaremos tu solicitud lo más pronto posible 🤓\nGracias por confiar en nosotros 🤝",
    ], 1300, 1400);

    // Consulta externa -> send video
    $saludReembConsultaMsg = $mk('message', 'Salud Reemb - Consulta Msg', [
        'text' => "Te enviaremos un video con el paso a paso para gestionar tu reembolso de consulta externa:",
    ], 1500, 1400);

    $saludReembConsultaVideo = $mk('media', 'Salud Reemb - Video', [
        'media_type' => 'video',
        'url' => "{$MEDIA_BASE}/Reembolso.mp4",
        'caption' => 'Paso a paso - Reembolso consulta externa',
    ], 1500, 1550);
    $saludReembConsultaMsg->update(['next_node_id' => $saludReembConsultaVideo->id]);

    $saludRecAllianz = $mk('message', 'Salud Rec - Allianz', ['text' => "🔗 https://www.allianz.co/clientes/salud-medicall/reembolsos-autorizaciones.html"], 1500, 1000);
    $saludRecSbs = $mk('message', 'Salud Rec - SBS', ['text' => "🔗 https://www.sbseguros.co/indemnizaciones/solicitar-indemnizacion"], 1600, 1000);
    $saludRecBolivar = $mk('message', 'Salud Rec - Bolívar', ['text' => "🔗 https://www.segurosbolivar.com/seguro-de-salud"], 1700, 1000);
    $saludRecMapfre = $mk('message', 'Salud Rec - Mapfre', ['text' => "🔗 https://www.mapfre.com.co/seguros-salud/"], 1800, 1000);

    // Salud Medicamentos POS
    $saludMedicamentos = $mk('question', 'Salud - Medicamentos POS', [
        'text' => "¿Para qué servicio requieres asistencia?",
        'options' => [
            ['label' => '1️⃣ Renovar fórmula', 'value' => 'salud_med_renovar'],
            ['label' => '2️⃣ Solicitar domicilio', 'value' => 'salud_med_domicilio'],
            ['label' => '🔙 Volver', 'value' => 'menu_salud'],
        ],
    ], 1650, 800);

    // Renovar formula -> send video
    $saludMedRenovarMsg = $mk('message', 'Salud Med - Renovar Msg', [
        'text' => "Te enviaremos un video con el paso a paso para renovar tu fórmula:",
    ], 1600, 1000);

    $saludMedRenovarVideo = $mk('media', 'Salud Med - Renovar Video', [
        'media_type' => 'video',
        'url' => "{$MEDIA_BASE}/Renovar_Formula.mp4",
        'caption' => 'Paso a paso - Renovar fórmula',
    ], 1600, 1150);
    $saludMedRenovarMsg->update(['next_node_id' => $saludMedRenovarVideo->id]);

    // Solicitar domicilio -> send PDF
    $saludMedDomicilioMsg = $mk('message', 'Salud Med - Domicilio Msg', [
        'text' => "Te adjuntamos el instructivo con el paso a paso para coordinar el domicilio de tu medicamento:",
    ], 1750, 1000);

    $saludMedDomicilioPdf = $mk('media', 'Salud Med - Domicilio PDF', [
        'media_type' => 'document',
        'url' => "{$MEDIA_BASE}/Paso_a_paso_domicilio_medicamento.pdf",
        'filename' => 'Paso a paso domicilio medicamento.pdf',
        'caption' => 'Instructivo domicilio medicamento',
    ], 1750, 1150);
    $saludMedDomicilioMsg->update(['next_node_id' => $saludMedDomicilioPdf->id]);

    // Back nodes for Salud
    $backSalud = $mk('question', 'Volver (Salud)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🔙 Volver a Salud', 'value' => 'menu_salud'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], 1000, 1700);

    foreach ([$saludCotizar, $saludModificar, $saludCancelar,
              $saludCobSura, $saludCobAllianz, $saludCobSbs, $saludCobBolivar, $saludCobMapfre,
              $saludRecSuraAutorizacion, $saludReembTerapias, $saludReembConsultaVideo,
              $saludRecAllianz, $saludRecSbs, $saludRecBolivar, $saludRecMapfre,
              $saludMedRenovarVideo, $saludMedDomicilioPdf] as $n) {
        $n->update(['next_node_id' => $backSalud->id]);
    }

    // ============================================================
    // ========== VIDA Y RENTAS SECTION ==========
    // ============================================================
    $vidaMenu = $mk('question', 'Menú Vida y Rentas', [
        'text' => "🛡️ *VIDA Y RENTAS* - ¿Qué necesitas?",
        'options' => [
            ['label' => '1️⃣ Cotizar', 'value' => 'vida_cotizar'],
            ['label' => '2️⃣ Modificar', 'value' => 'vida_modificar'],
            ['label' => '3️⃣ Cancelar', 'value' => 'vida_cancelar'],
            ['label' => '4️⃣ Coberturas', 'value' => 'vida_coberturas'],
            ['label' => '5️⃣ Reclamaciones', 'value' => 'vida_reclamaciones'],
            ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
        ],
    ], 2000, 600);

    $vidaCotizar = $mk('message', 'Vida - Cotizar', [
        'text' => "Para cotizarte la póliza de *Vida* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• Fecha de nacimiento\n• Dirección\n• Estado civil y correo electrónico\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], 1800, 800);

    $vidaModificar = $mk('message', 'Vida - Modificar', [
        'text' => "Para modificarte la póliza de *Vida* necesitamos los siguientes datos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], 1950, 800);

    $vidaCancelar = $mk('message', 'Vida - Cancelar', [
        'text' => "Para cancelarte la póliza de *Vida* necesitamos los siguientes datos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo para brindarte toda la información al respecto.",
    ], 2100, 800);

    // Vida Coberturas
    $vidaCoberturas = $mk('question', 'Vida - Coberturas', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'vida_cob_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'vida_cob_allianz'],
            ['label' => '3️⃣ Bolívar', 'value' => 'vida_cob_bolivar'],
            ['label' => '4️⃣ Mapfre', 'value' => 'vida_cob_mapfre'],
            ['label' => '🔙 Volver', 'value' => 'menu_vida'],
        ],
    ], 2250, 800);

    $vidaCobSura = $mk('message', 'Vida Cob - Sura', ['text' => "🔗 https://www.sura.co/seguros/personas/vida/seguro-de-vida"], 2100, 1000);
    $vidaCobAllianz = $mk('message', 'Vida Cob - Allianz', ['text' => "🔗 https://www.allianz.co/seguros/personas/vida.html"], 2200, 1000);
    $vidaCobBolivar = $mk('message', 'Vida Cob - Bolívar', ['text' => "🔗 https://www.segurosbolivar.com/portafolio-seguros-de-vida-familia"], 2300, 1000);
    $vidaCobMapfre = $mk('message', 'Vida Cob - Mapfre', ['text' => "🔗 https://www.mapfre.com.co/seguros-riesgo/"], 2400, 1000);

    // Vida Reclamaciones
    $vidaReclamaciones = $mk('question', 'Vida - Reclamaciones', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'vida_rec_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'vida_rec_allianz'],
            ['label' => '3️⃣ Bolívar', 'value' => 'vida_rec_bolivar'],
            ['label' => '4️⃣ Mapfre', 'value' => 'vida_rec_mapfre'],
            ['label' => '🔙 Volver', 'value' => 'menu_vida'],
        ],
    ], 2450, 800);

    // Vida Rec Sura -> submenu
    $vidaRecSura = $mk('question', 'Vida Rec - Sura', [
        'text' => "Indícanos en qué podemos ayudarte:",
        'options' => [
            ['label' => '1️⃣ Renta diaria', 'value' => 'vida_rec_renta_diaria'],
            ['label' => '2️⃣ Auxilio maternidad/paternidad', 'value' => 'vida_rec_maternidad'],
            ['label' => '3️⃣ Enfermedades graves', 'value' => 'vida_rec_enfermedades'],
            ['label' => '4️⃣ Invalidez', 'value' => 'vida_rec_invalidez'],
            ['label' => '🔙 Volver', 'value' => 'vida_reclamaciones'],
        ],
    ], 2300, 1000);

    $vidaRecRentaDiaria = $mk('message', 'Vida Rec - Renta Diaria', [
        'text' => "Necesitamos los siguientes datos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n📋 *Adicional:*\n• Historia clínica\n• Incapacidad\n• Número de cuenta o certificación bancaria\n\nEn *30 minutos aprox.* nos comunicaremos contigo.",
    ], 2150, 1200);

    $vidaRecMaternidad = $mk('message', 'Vida Rec - Maternidad', [
        'text' => "Necesitamos los siguientes datos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n📋 *Adicional:*\n• Registro civil del menor\n• Número de cuenta o certificación bancaria\n\nEn *30 minutos aprox.* nos comunicaremos contigo.",
    ], 2300, 1200);

    $vidaRecEnfermedades = $mk('message', 'Vida Rec - Enfermedades', [
        'text' => "Necesitamos los siguientes datos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n📋 *Adicional:*\n• Historia clínica\n• Resultado de exámenes\n• Número de cuenta o certificación bancaria\n\nEn *30 minutos aprox.* nos comunicaremos contigo.",
    ], 2450, 1200);

    $vidaRecInvalidez = $mk('message', 'Vida Rec - Invalidez', [
        'text' => "Necesitamos los siguientes datos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n📋 *Adicional:*\n• Historia clínica\n• Certificado de invalidez\n• Número de cuenta o certificación bancaria\n\nEn *30 minutos aprox.* nos comunicaremos contigo.",
    ], 2600, 1200);

    $vidaRecAllianz = $mk('message', 'Vida Rec - Allianz', [
        'text' => "Para presentar una reclamación de seguro de vida en Allianz Colombia, envíe los documentos a indemnizacionesvida@allianz.co o comunícate al #265 (celular) o 018000 513500.",
    ], 2500, 1000);
    $vidaRecBolivar = $mk('message', 'Vida Rec - Bolívar', [
        'text' => "Para presentar una reclamación de seguro de vida en Seguros Bolívar, comuníquese al #322 desde celulares o al 018000 123322 (opción 4) a nivel nacional.",
    ], 2600, 1000);
    $vidaRecMapfre = $mk('message', 'Vida Rec - Mapfre', ['text' => "🔗 https://www.mapfre.com.co/seguros-riesgo/preguntas-frecuentes/como-cobrar-seguro-vida-colombia/"], 2700, 1000);

    // Back for Vida
    $backVida = $mk('question', 'Volver (Vida)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🔙 Volver a Vida', 'value' => 'menu_vida'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], 2000, 1500);

    foreach ([$vidaCotizar, $vidaModificar, $vidaCancelar,
              $vidaCobSura, $vidaCobAllianz, $vidaCobBolivar, $vidaCobMapfre,
              $vidaRecRentaDiaria, $vidaRecMaternidad, $vidaRecEnfermedades, $vidaRecInvalidez,
              $vidaRecAllianz, $vidaRecBolivar, $vidaRecMapfre] as $n) {
        $n->update(['next_node_id' => $backVida->id]);
    }

    // ============================================================
    // ========== EMPRESARIALES SECTION ==========
    // ============================================================
    $empresarialesMenu = $mk('question', 'Menú Empresariales', [
        'text' => "🏢 *EMPRESARIALES* - ¿Qué necesitas?",
        'options' => [
            ['label' => '1️⃣ Cotizar', 'value' => 'emp_cotizar'],
            ['label' => '2️⃣ Modificar', 'value' => 'emp_modificar'],
            ['label' => '3️⃣ Cancelar', 'value' => 'emp_cancelar'],
            ['label' => '4️⃣ Coberturas', 'value' => 'emp_coberturas'],
            ['label' => '5️⃣ Reclamaciones', 'value' => 'emp_reclamaciones'],
            ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
        ],
    ], 3000, 600);

    $empCotizar = $mk('message', 'Empresariales - Cotizar', [
        'text' => "Para cotizarte una póliza *Empresarial* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Fecha de nacimiento\n• Número de contacto\n\n🏢 *Datos empresa:*\n• NIT\n• Dirección del inmueble\n• Actividad económica\n\nEn *30 minutos aprox.* nos comunicaremos contigo. 🏢",
    ], 2800, 800);

    $empModificar = $mk('message', 'Empresariales - Modificar', [
        'text' => "Para modificar la póliza *Empresarial* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\n🏢 *Datos empresa:*\n• NIT\n\nEn *30 minutos aprox.* nos comunicaremos contigo. 🏢",
    ], 2950, 800);

    $empCancelar = $mk('message', 'Empresariales - Cancelar', [
        'text' => "Para cancelarte la póliza *Empresarial* necesitamos los siguientes datos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo.",
    ], 3100, 800);

    // Emp Coberturas
    $empCoberturas = $mk('question', 'Empresariales - Coberturas', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'emp_cob_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'emp_cob_allianz'],
            ['label' => '3️⃣ SBS', 'value' => 'emp_cob_sbs'],
            ['label' => '4️⃣ Bolívar', 'value' => 'emp_cob_bolivar'],
            ['label' => '5️⃣ Mapfre', 'value' => 'emp_cob_mapfre'],
            ['label' => '🔙 Volver', 'value' => 'menu_empresariales'],
        ],
    ], 3250, 800);

    $empCobSura = $mk('message', 'Emp Cob - Sura', ['text' => "🔗 https://www.sura.co/seguros/empresas/bienes-y-patrimonio/todo-riesgo-empresarial"], 3100, 1000);
    $empCobAllianz = $mk('message', 'Emp Cob - Allianz', ['text' => "🔗 https://www.allianz.co/seguros/bienes/mi-pyme.html"], 3200, 1000);
    $empCobSbs = $mk('message', 'Emp Cob - SBS', ['text' => "🔗 https://www.sbseguros.co/empresas"], 3300, 1000);
    $empCobBolivar = $mk('message', 'Emp Cob - Bolívar', ['text' => "🔗 https://www.segurosbolivar.com/empresas"], 3400, 1000);
    $empCobMapfre = $mk('message', 'Emp Cob - Mapfre', ['text' => "🔗 https://www.mapfre.com.co/empresas/seguros-todo-riesgo/pyme/"], 3500, 1000);

    // Emp Reclamaciones
    $empReclamaciones = $mk('question', 'Empresariales - Reclamaciones', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'emp_rec_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'emp_rec_allianz'],
            ['label' => '3️⃣ SBS', 'value' => 'emp_rec_sbs'],
            ['label' => '4️⃣ Bolívar', 'value' => 'emp_rec_bolivar'],
            ['label' => '5️⃣ Mapfre', 'value' => 'emp_rec_mapfre'],
            ['label' => '🔙 Volver', 'value' => 'menu_empresariales'],
        ],
    ], 3450, 800);

    // Emp Rec Sura -> Daños / Hurto
    $empRecSura = $mk('question', 'Emp Rec - Sura', [
        'text' => "Selecciona el tipo de reclamación:",
        'options' => [
            ['label' => '1️⃣ Daños', 'value' => 'emp_rec_sura_danos'],
            ['label' => '2️⃣ Hurto', 'value' => 'emp_rec_sura_hurto'],
            ['label' => '🔙 Volver', 'value' => 'emp_reclamaciones'],
        ],
    ], 3300, 1000);

    $empRecSuraDanos = $mk('message', 'Emp Rec Sura - Daños', [
        'text' => "Debe enviar carta generando el reclamo a la compañía donde se informe tiempo, modo y lugar, informe técnico, fotos del equipo afectado, factura inicial de compra, cotización de la reposición y certificación bancaria.",
    ], 3200, 1200);

    $empRecSuraHurto = $mk('message', 'Emp Rec Sura - Hurto', [
        'text' => "Debe enviar carta generando el reclamo a la compañía donde se informe tiempo, modo y lugar, denuncia ante las autoridades competentes, videos o fotografías del evento si lo tiene, factura inicial de compra, cotización de la reposición y certificación bancaria.",
    ], 3400, 1200);

    $empRecAllianz = $mk('message', 'Emp Rec - Allianz', [
        'text' => "Accede a Mi Cuenta, con tu DNI o NIE, y en el apartado Siniestros, haz clic en 'Gestionar'. Te aparecerá la opción 'Quiero dar un parte'.",
    ], 3500, 1000);
    $empRecSbs = $mk('message', 'Emp Rec - SBS', ['text' => "🔗 https://www.sbseguros.co/indemnizaciones"], 3600, 1000);
    $empRecBolivar = $mk('message', 'Emp Rec - Bolívar', [
        'text' => "Para reportar un siniestro en Seguros Bolívar Empresarial, comuníquese al #322 desde celular o a la línea nacional 01 8000 123 322 (disponibles 24/7).",
    ], 3700, 1000);
    $empRecMapfre = $mk('message', 'Emp Rec - Mapfre', ['text' => "🔗 https://www.mapfre.com.co/contacto/canales-aviso-de-siniestros/"], 3800, 1000);

    // Back for Empresariales
    $backEmp = $mk('question', 'Volver (Empresariales)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🔙 Volver a Empresariales', 'value' => 'menu_empresariales'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], 3000, 1500);

    foreach ([$empCotizar, $empModificar, $empCancelar,
              $empCobSura, $empCobAllianz, $empCobSbs, $empCobBolivar, $empCobMapfre,
              $empRecSuraDanos, $empRecSuraHurto, $empRecAllianz, $empRecSbs, $empRecBolivar, $empRecMapfre] as $n) {
        $n->update(['next_node_id' => $backEmp->id]);
    }

    // ============================================================
    // ========== OTROS SEGUROS SECTION ==========
    // ============================================================
    $otrosSegurosMenu = $mk('question', 'Menú Otros Seguros', [
        'text' => "📋 *OTROS SEGUROS* - ¿Qué necesitas?",
        'options' => [
            ['label' => '1️⃣ Arrendamiento', 'value' => 'otros_arrendamiento'],
            ['label' => '2️⃣ Viaje', 'value' => 'otros_viaje'],
            ['label' => '3️⃣ Cumplimiento', 'value' => 'otros_cumplimiento'],
            ['label' => '4️⃣ Mascotas', 'value' => 'otros_mascotas'],
            ['label' => '5️⃣ Hogar', 'value' => 'otros_hogar'],
            ['label' => '6️⃣ SOAT', 'value' => 'otros_soat'],
            ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
        ],
    ], -1000, 600);

    $otrosArrendamiento = $mk('message', 'Otros - Arrendamiento', [
        'text' => "Solicitamos los siguientes datos:\n• Nombre completo\n• Cédula\n• Tipo de cliente (propietario o inquilino)\n• Celular\n• Correo",
    ], -1200, 800);

    $otrosViaje = $mk('message', 'Otros - Viaje', [
        'text' => "Compartimos el siguiente link para que puedas autogestionar tu seguro de viaje:\n🔗 https://www.suraenlinea.com/viajes/sura?codigoAsesor=6486",
    ], -1050, 800);

    $otrosCumplimiento = $mk('message', 'Otros - Cumplimiento', [
        'text' => "Solicitamos los siguientes datos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n• NIT contratante\n• NIT contratista\n• Adjuntar el contrato firmado",
    ], -900, 800);

    $otrosMascotas = $mk('message', 'Otros - Mascotas', [
        'text' => "Se comparte link para autogestión:\n🔗 https://surapet.com.co/asesorcliente/6486\n\nO si prefieres, envíanos los siguientes datos:\n• Nombre, documento, celular y correo del tomador\n• Nombre, sexo, edad, raza, perro o gato\n• ¿Ha tenido enfermedades?",
    ], -750, 800);

    // Otros Hogar -> submenu
    $otrosHogar = $mk('question', 'Otros - Hogar', [
        'text' => "🏠 *HOGAR* - Indícanos en qué podemos ayudarte:",
        'options' => [
            ['label' => '1️⃣ Cotizar', 'value' => 'hogar_cotizar'],
            ['label' => '2️⃣ Modificar', 'value' => 'hogar_modificar'],
            ['label' => '3️⃣ Cancelar', 'value' => 'hogar_cancelar'],
            ['label' => '4️⃣ Coberturas', 'value' => 'hogar_coberturas'],
            ['label' => '5️⃣ Reclamaciones', 'value' => 'hogar_reclamaciones'],
            ['label' => '🔙 Volver', 'value' => 'menu_otros_seguros'],
        ],
    ], -600, 800);

    $hogarCotizar = $mk('message', 'Hogar - Cotizar', [
        'text' => "Para cotizarte una póliza de *Hogar* necesitamos:\n\n📝 *Datos personales:*\n• Nombres y apellidos\n• Número de identificación\n• Fecha de nacimiento\n• Número de contacto\n• Dirección del inmueble\n• Ciudad y departamento del inmueble\n• Estrato\n• Valor de la vivienda\n• Valor de los contenidos\n\nEn *30 minutos aprox.* nos comunicaremos contigo. 🏢",
    ], -800, 1000);

    $hogarModificar = $mk('message', 'Hogar - Modificar', [
        'text' => "Para modificarte la póliza de *Hogar* necesitamos los siguientes datos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo.",
    ], -650, 1000);

    $hogarCancelar = $mk('message', 'Hogar - Cancelar', [
        'text' => "Para cancelarte la póliza de *Hogar* necesitamos los siguientes datos:\n• Nombres y apellidos\n• Número de identificación\n• Número de contacto\n\nEn *30 minutos aprox.* nos comunicaremos contigo.",
    ], -500, 1000);

    // Hogar Coberturas
    $hogarCoberturas = $mk('question', 'Hogar - Coberturas', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'hogar_cob_sura'],
            ['label' => '2️⃣ Bolívar', 'value' => 'hogar_cob_bolivar'],
            ['label' => '3️⃣ Allianz', 'value' => 'hogar_cob_allianz'],
            ['label' => '4️⃣ Mapfre', 'value' => 'hogar_cob_mapfre'],
            ['label' => '5️⃣ SBS', 'value' => 'hogar_cob_sbs'],
            ['label' => '🔙 Volver', 'value' => 'menu_hogar'],
        ],
    ], -350, 1000);

    $hogarCobSura = $mk('message', 'Hogar Cob - Sura', ['text' => "🔗 https://www.sura.co/seguros/personas/hogar/hogares"], -500, 1200);
    $hogarCobBolivar = $mk('message', 'Hogar Cob - Bolívar', ['text' => "🔗 https://www.segurosbolivar.com/seguro-en-casa"], -400, 1200);
    $hogarCobAllianz = $mk('message', 'Hogar Cob - Allianz', ['text' => "🔗 https://www.allianz.co/seguros/bienes/hogar.html"], -300, 1200);
    $hogarCobMapfre = $mk('message', 'Hogar Cob - Mapfre', ['text' => "🔗 https://www.mapfre.com.co/seguros-hogar/"], -200, 1200);
    $hogarCobSbs = $mk('message', 'Hogar Cob - SBS', ['text' => "🔗 https://www.sbseguros.co/seguros-hogar"], -100, 1200);

    // Hogar Reclamaciones -> Daños / Hurto
    $hogarReclamaciones = $mk('question', 'Hogar - Reclamaciones', [
        'text' => "Selecciona el tipo de reclamación:",
        'options' => [
            ['label' => '1️⃣ Daños', 'value' => 'hogar_rec_danos'],
            ['label' => '2️⃣ Hurto', 'value' => 'hogar_rec_hurto'],
            ['label' => '🔙 Volver', 'value' => 'menu_hogar'],
        ],
    ], -200, 1000);

    $hogarRecDanos = $mk('message', 'Hogar Rec - Daños', [
        'text' => "Debe enviar carta generando el reclamo a la compañía donde se informe tiempo, modo y lugar, informe técnico, fotos del equipo afectado, factura inicial de compra, cotización de la reposición y certificación bancaria.",
    ], -300, 1200);

    $hogarRecHurto = $mk('message', 'Hogar Rec - Hurto', [
        'text' => "Debe enviar carta generando el reclamo a la compañía donde se informe tiempo, modo y lugar, denuncia ante las autoridades competentes, videos o fotografías del evento si lo tiene, factura inicial de compra, cotización de la reposición y certificación bancaria.",
    ], -100, 1200);

    $otrosSoat = $mk('message', 'Otros - SOAT', [
        'text' => "Buen día ☀️\n\nDebido a la resolución del gobierno colombiano de eliminar a los intermediarios de seguros en la comercialización del SOAT, les recomendamos SOLO adquirirlo en lugares debidamente identificados como puntos de venta de las aseguradoras.\n\nEn este vínculo se puede corroborar su legalidad:\n🔗 https://www.runt.com.co/consultaCiudadana/#/consultaVehiculo\n\nAlgunas páginas que les pueden servir:\n• *SURA:* https://www.suraenlinea.com/soat/sura/seguro-obligatorio\n• *MUNDIAL:* https://soatmundial.com.co/\n• *AXA COLPATRIA:* https://www.axacolpatria.co/portalpublico-lf-soat\n• *PREVISORA:* https://previsora.gov.co/soat/compraSOAT.html",
    ], -450, 800);

    // Back for Otros Seguros
    $backOtros = $mk('question', 'Volver (Otros)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🔙 Volver a Otros Seguros', 'value' => 'menu_otros_seguros'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], -800, 1500);

    foreach ([$otrosArrendamiento, $otrosViaje, $otrosCumplimiento, $otrosMascotas, $otrosSoat,
              $hogarCotizar, $hogarModificar, $hogarCancelar,
              $hogarCobSura, $hogarCobBolivar, $hogarCobAllianz, $hogarCobMapfre, $hogarCobSbs,
              $hogarRecDanos, $hogarRecHurto] as $n) {
        $n->update(['next_node_id' => $backOtros->id]);
    }

    // ============================================================
    // ========== CARTERA / PAGOS SECTION ==========
    // ============================================================
    $carteraMenu = $mk('question', 'Menú Cartera', [
        'text' => "💰 *CARTERA / PAGOS* - Indícanos la compañía:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'cartera_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'cartera_allianz'],
            ['label' => '3️⃣ Bolívar', 'value' => 'cartera_bolivar'],
            ['label' => '4️⃣ Mapfre', 'value' => 'cartera_mapfre'],
            ['label' => '5️⃣ SBS', 'value' => 'cartera_sbs'],
            ['label' => '6️⃣ Qualitas', 'value' => 'cartera_qualitas'],
            ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
        ],
    ], -2000, 600);

    $carteraSura = $mk('message', 'Cartera - Sura', ['text' => "🔗 https://pagos.segurossura.com.co/pagos"], -2200, 800);
    $carteraAllianz = $mk('message', 'Cartera - Allianz', ['text' => "🔗 https://www.allianz.co/clientes/todos-los-clientes/pagos.html"], -2100, 800);
    $carteraBolivar = $mk('message', 'Cartera - Bolívar', ['text' => "🔗 https://recaudos.segurosbolivar.com/login"], -2000, 800);
    $carteraMapfre = $mk('message', 'Cartera - Mapfre', ['text' => "🔗 https://cotiza.mapfre.com.co/pagosWeb/vista/paginas/noFilterIniPagosPublico.jsf"], -1900, 800);
    $carteraSbs = $mk('message', 'Cartera - SBS', ['text' => "🔗 https://www.sbseguros.co/servicio-al-cliente/alternativas-pagos"], -1800, 800);
    $carteraQualitas = $mk('message', 'Cartera - Qualitas', ['text' => "🔗 https://www.qualitascolombia.com.co/pago-de-poliza"], -1700, 800);

    $backCartera = $mk('question', 'Volver (Cartera)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🔙 Volver a Cartera', 'value' => 'menu_cartera'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], -2000, 1000);

    foreach ([$carteraSura, $carteraAllianz, $carteraBolivar, $carteraMapfre, $carteraSbs, $carteraQualitas] as $n) {
        $n->update(['next_node_id' => $backCartera->id]);
    }

    // ============================================================
    // ========== CERTIFICADOS SECTION ==========
    // ============================================================
    $certificadosMenu = $mk('question', 'Menú Certificados', [
        'text' => "📄 *CERTIFICADOS* - ¿Qué certificado necesitas?",
        'options' => [
            ['label' => '1️⃣ Asistencia en el exterior', 'value' => 'cert_viaje'],
            ['label' => '2️⃣ Declaración de renta (Salud)', 'value' => 'cert_renta_salud'],
            ['label' => '3️⃣ Certificado EPS', 'value' => 'cert_eps'],
            ['label' => '4️⃣ Renta Pensión', 'value' => 'cert_renta_pension'],
            ['label' => '5️⃣ Renta Educativa', 'value' => 'cert_renta_educativa'],
            ['label' => '6️⃣ Endoso', 'value' => 'cert_endoso'],
            ['label' => '7️⃣ ARL', 'value' => 'cert_arl'],
            ['label' => '8️⃣ Carátula Póliza', 'value' => 'cert_caratula'],
            ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
        ],
    ], -3000, 600);

    $certViaje = $mk('message', 'Cert - Viaje', [
        'text' => "Para solicitar el certificado de viaje debes escribir al chat 3152757888 ingresando por las siguientes opciones:\n• Urgencias\n• Asistencia en viaje\n• Póliza de salud\n• Ingresa el documento de identidad\n• Registra tu viaje",
    ], -3400, 800);

    $certGenericDatos = $mk('message', 'Cert - Datos Genéricos', [
        'text' => "Envíanos los siguientes datos:\n• Nombre completo\n• Número de identificación\n• Número de contacto",
    ], -3200, 800);

    $certEndoso = $mk('message', 'Cert - Endoso', [
        'text' => "Envíanos los siguientes datos:\n• Nombre completo\n• Número de identificación\n• Número de contacto\n• Placa del vehículo en caso que aplique",
    ], -3000, 800);

    $certArl = $mk('message', 'Cert - ARL', [
        'text' => "Envíanos los siguientes datos:\n• Nombre completo\n• Número de identificación\n• Número de contacto\n• NIT de la empresa",
    ], -2800, 800);

    $certCaratula = $mk('message', 'Cert - Carátula', [
        'text' => "Envíanos los siguientes datos:\n• Nombre completo\n• Número de identificación\n• Número de contacto\n• Placa del vehículo en caso que aplique",
    ], -2600, 800);

    $backCertificados = $mk('question', 'Volver (Certificados)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🔙 Volver a Certificados', 'value' => 'menu_certificados'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], -3000, 1000);

    foreach ([$certViaje, $certGenericDatos, $certEndoso, $certArl, $certCaratula] as $n) {
        $n->update(['next_node_id' => $backCertificados->id]);
    }

    // ============================================================
    // ========== ASISTENCIA SECTION ==========
    // ============================================================
    $asistenciaNode = $mk('message', 'Asistencia', [
        'text' => "📞 *Líneas de asistencia:*\n\n• *Sura:* #888\n• *Allianz:* #265\n• *Mapfre:* #624\n• *Bolívar:* #322\n• *SBS:* #360\n• *Qualitas:* #963",
    ], -4000, 600);

    $backAsistencia = $mk('question', 'Volver (Asistencia)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], -4000, 800);
    $asistenciaNode->update(['next_node_id' => $backAsistencia->id]);

    // ============================================================
    // ========== OTRAS CONSULTAS SECTION ==========
    // ============================================================
    $otrasConsultasMenu = $mk('question', 'Menú Otras Consultas', [
        'text' => "🔍 *OTRAS CONSULTAS* - ¿Qué necesitas?",
        'options' => [
            ['label' => '1️⃣ Longevo / Bienestar Sura', 'value' => 'consulta_longevo'],
            ['label' => '2️⃣ Carnet Sura', 'value' => 'consulta_carnet'],
            ['label' => '3️⃣ Directorio Médico', 'value' => 'consulta_directorio'],
            ['label' => '4️⃣ Sedes Salud Sura', 'value' => 'consulta_sedes'],
            ['label' => '5️⃣ Vacunación', 'value' => 'consulta_vacunacion'],
            ['label' => '6️⃣ AutoSura', 'value' => 'consulta_autosura'],
            ['label' => '🔙 Volver al menú principal', 'value' => 'menu_principal'],
        ],
    ], -5000, 600);

    $consultaLongevo = $mk('message', 'Consulta - Longevo', ['text' => "🔗 https://www.sura.co/bienestar"], -5400, 800);

    $consultaCarnet = $mk('message', 'Consulta - Carnet Sura', [
        'text' => "Envíanos los siguientes datos:\n• Nombre completo\n• Número de identificación\n• Número de contacto",
    ], -5250, 800);

    // Directorio Médico submenu
    $consultaDirectorio = $mk('question', 'Consulta - Directorio Médico', [
        'text' => "Indícanos la compañía para la que requieres información:",
        'options' => [
            ['label' => '1️⃣ Sura', 'value' => 'dir_sura'],
            ['label' => '2️⃣ Allianz', 'value' => 'dir_allianz'],
            ['label' => '3️⃣ Bolívar', 'value' => 'dir_bolivar'],
            ['label' => '4️⃣ Mapfre', 'value' => 'dir_mapfre'],
            ['label' => '5️⃣ SBS', 'value' => 'dir_sbs'],
            ['label' => '🔙 Volver', 'value' => 'menu_otras_consultas'],
        ],
    ], -5100, 800);

    $dirSura = $mk('message', 'Dir - Sura', ['text' => "🔗 https://www.sura.co/seguros/personas/salud/centro-de-ayuda/directorios-medicos"], -5300, 1000);
    $dirAllianz = $mk('message', 'Dir - Allianz', ['text' => "🔗 https://www.allianz.co/clientes/salud-medicall/directorio-medico.html"], -5200, 1000);
    $dirBolivar = $mk('message', 'Dir - Bolívar', ['text' => "🔗 https://www.segurosbolivar.com/directorios-medicos"], -5100, 1000);
    $dirMapfre = $mk('message', 'Dir - Mapfre', ['text' => "🔗 https://digital.mapfre.com.co/reportesWeb/vista/dirmedico/noFilterServiMedicosSalud.jsf"], -5000, 1000);
    $dirSbs = $mk('message', 'Dir - SBS', ['text' => "🔗 https://www.topdoctors.com.co/seguro-medico/sbs-seguros-cuadro-medico/provincia/medellin/"], -4900, 1000);

    $consultaSedes = $mk('message', 'Consulta - Sedes', ['text' => "🔗 https://www.sura.co/seguros/personas/salud/centro-de-ayuda/sedes"], -4950, 800);
    $consultaVacunacion = $mk('message', 'Consulta - Vacunación', ['text' => "🔗 https://www.sura.co/ips/personas/vacunacion"], -4800, 800);
    $consultaAutosura = $mk('message', 'Consulta - AutoSura', ['text' => "🔗 https://www.sura.co/seguros/personas/movilidad/centro-de-servicios/autos"], -4650, 800);

    $backOtrasConsultas = $mk('question', 'Volver (Otras Consultas)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🔙 Volver a Otras Consultas', 'value' => 'menu_otras_consultas'],
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], -5000, 1200);

    foreach ([$consultaLongevo, $consultaCarnet, $consultaSedes, $consultaVacunacion, $consultaAutosura,
              $dirSura, $dirAllianz, $dirBolivar, $dirMapfre, $dirSbs] as $n) {
        $n->update(['next_node_id' => $backOtrasConsultas->id]);
    }

    // ============================================================
    // ========== CANALES DE CONTACTO ==========
    // ============================================================
    $canalesContacto = $mk('message', 'Canales de Contacto', [
        'text' => "📱 *Canales de contacto Proyectamos Seguros:*\n\n• *Cartera:* 3046454852\n• *Información general:* 3006748706\n• *Fijo:* 604 3121180\n• *Facebook:* https://www.facebook.com/proyectamosseguros\n• *Página:* https://proyectamosseguros.com/\n• *José Muñoz:* cel 3104493791\n• *Sandra Álvarez:* cel 3217000303",
    ], -6000, 600);

    $backCanales = $mk('question', 'Volver (Canales)', [
        'text' => "¿Necesitas algo más?",
        'options' => [
            ['label' => '🏠 Menú principal', 'value' => 'menu_principal'],
        ],
    ], -6000, 800);
    $canalesContacto->update(['next_node_id' => $backCanales->id]);

    // ============================================================
    // ========== 5. WIRE UP ALL NAVIGATION ==========
    // ============================================================
    echo "🔗 Conectando rutas de navegación...\n";

    // Main Menu
    $mainMenu->update(['config' => array_merge($mainMenu->config, ['option_routes' => [
        'autos' => $autosMenu->id,
        'salud' => $saludMenu->id,
        'vida' => $vidaMenu->id,
        'empresariales' => $empresarialesMenu->id,
        'otros_seguros' => $otrosSegurosMenu->id,
        'cartera' => $carteraMenu->id,
        'certificados' => $certificadosMenu->id,
        'asistencia' => $asistenciaNode->id,
        'otras_consultas' => $otrasConsultasMenu->id,
        'canales_contacto' => $canalesContacto->id,
        'asesor' => $transferNode->id,
    ]])]);

    // Autos Menu
    $autosMenu->update(['config' => array_merge($autosMenu->config, ['option_routes' => [
        'autos_cotizar' => $autosCotizar->id,
        'autos_modificar' => $autosModificar->id,
        'autos_cancelar' => $autosCancelar->id,
        'autos_coberturas' => $autosCoberturas->id,
        'autos_reclamaciones' => $autosReclamaciones->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    $autosCoberturas->update(['config' => array_merge($autosCoberturas->config, ['option_routes' => [
        'autos_cob_sura' => $autosCobSura->id,
        'autos_cob_allianz' => $autosCobAllianz->id,
        'autos_cob_sbs' => $autosCobSbs->id,
        'autos_cob_qualitas' => $autosCobQualitas->id,
        'autos_cob_bolivar' => $autosCobBolivar->id,
        'autos_cob_mapfre' => $autosCobMapfre->id,
        'menu_autos' => $autosMenu->id,
    ]])]);

    $autosReclamaciones->update(['config' => array_merge($autosReclamaciones->config, ['option_routes' => [
        'autos_rec_sura' => $autosRecSura->id,
        'autos_rec_allianz' => $autosRecAllianz->id,
        'autos_rec_sbs' => $autosRecSbs->id,
        'autos_rec_qualitas' => $autosRecQualitas->id,
        'autos_rec_bolivar' => $autosRecBolivar->id,
        'autos_rec_mapfre' => $autosRecMapfre->id,
        'menu_autos' => $autosMenu->id,
    ]])]);

    $backAutos->update(['config' => array_merge($backAutos->config, ['option_routes' => [
        'menu_autos' => $autosMenu->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Salud Menu
    $saludMenu->update(['config' => array_merge($saludMenu->config, ['option_routes' => [
        'salud_cotizar' => $saludCotizar->id,
        'salud_modificar' => $saludModificar->id,
        'salud_cancelar' => $saludCancelar->id,
        'salud_coberturas' => $saludCoberturas->id,
        'salud_reclamaciones' => $saludReclamaciones->id,
        'salud_medicamentos' => $saludMedicamentos->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    $saludCoberturas->update(['config' => array_merge($saludCoberturas->config, ['option_routes' => [
        'salud_cob_sura' => $saludCobSura->id,
        'salud_cob_allianz' => $saludCobAllianz->id,
        'salud_cob_sbs' => $saludCobSbs->id,
        'salud_cob_bolivar' => $saludCobBolivar->id,
        'salud_cob_mapfre' => $saludCobMapfre->id,
        'menu_salud' => $saludMenu->id,
    ]])]);

    $saludReclamaciones->update(['config' => array_merge($saludReclamaciones->config, ['option_routes' => [
        'salud_rec_sura' => $saludRecSura->id,
        'salud_rec_allianz' => $saludRecAllianz->id,
        'salud_rec_sbs' => $saludRecSbs->id,
        'salud_rec_bolivar' => $saludRecBolivar->id,
        'salud_rec_mapfre' => $saludRecMapfre->id,
        'menu_salud' => $saludMenu->id,
    ]])]);

    $saludRecSura->update(['config' => array_merge($saludRecSura->config, ['option_routes' => [
        'salud_rec_sura_autorizacion' => $saludRecSuraAutorizacion->id,
        'salud_rec_sura_reembolso' => $saludRecSuraReembolso->id,
        'salud_reclamaciones' => $saludReclamaciones->id,
    ]])]);

    $saludRecSuraReembolso->update(['config' => array_merge($saludRecSuraReembolso->config, ['option_routes' => [
        'salud_reemb_terapias' => $saludReembTerapias->id,
        'salud_reemb_consulta' => $saludReembConsultaMsg->id,
        'salud_rec_sura' => $saludRecSura->id,
    ]])]);

    $saludMedicamentos->update(['config' => array_merge($saludMedicamentos->config, ['option_routes' => [
        'salud_med_renovar' => $saludMedRenovarMsg->id,
        'salud_med_domicilio' => $saludMedDomicilioMsg->id,
        'menu_salud' => $saludMenu->id,
    ]])]);

    $backSalud->update(['config' => array_merge($backSalud->config, ['option_routes' => [
        'menu_salud' => $saludMenu->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Vida Menu
    $vidaMenu->update(['config' => array_merge($vidaMenu->config, ['option_routes' => [
        'vida_cotizar' => $vidaCotizar->id,
        'vida_modificar' => $vidaModificar->id,
        'vida_cancelar' => $vidaCancelar->id,
        'vida_coberturas' => $vidaCoberturas->id,
        'vida_reclamaciones' => $vidaReclamaciones->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    $vidaCoberturas->update(['config' => array_merge($vidaCoberturas->config, ['option_routes' => [
        'vida_cob_sura' => $vidaCobSura->id,
        'vida_cob_allianz' => $vidaCobAllianz->id,
        'vida_cob_bolivar' => $vidaCobBolivar->id,
        'vida_cob_mapfre' => $vidaCobMapfre->id,
        'menu_vida' => $vidaMenu->id,
    ]])]);

    $vidaReclamaciones->update(['config' => array_merge($vidaReclamaciones->config, ['option_routes' => [
        'vida_rec_sura' => $vidaRecSura->id,
        'vida_rec_allianz' => $vidaRecAllianz->id,
        'vida_rec_bolivar' => $vidaRecBolivar->id,
        'vida_rec_mapfre' => $vidaRecMapfre->id,
        'menu_vida' => $vidaMenu->id,
    ]])]);

    $vidaRecSura->update(['config' => array_merge($vidaRecSura->config, ['option_routes' => [
        'vida_rec_renta_diaria' => $vidaRecRentaDiaria->id,
        'vida_rec_maternidad' => $vidaRecMaternidad->id,
        'vida_rec_enfermedades' => $vidaRecEnfermedades->id,
        'vida_rec_invalidez' => $vidaRecInvalidez->id,
        'vida_reclamaciones' => $vidaReclamaciones->id,
    ]])]);

    $backVida->update(['config' => array_merge($backVida->config, ['option_routes' => [
        'menu_vida' => $vidaMenu->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Empresariales Menu
    $empresarialesMenu->update(['config' => array_merge($empresarialesMenu->config, ['option_routes' => [
        'emp_cotizar' => $empCotizar->id,
        'emp_modificar' => $empModificar->id,
        'emp_cancelar' => $empCancelar->id,
        'emp_coberturas' => $empCoberturas->id,
        'emp_reclamaciones' => $empReclamaciones->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    $empCoberturas->update(['config' => array_merge($empCoberturas->config, ['option_routes' => [
        'emp_cob_sura' => $empCobSura->id,
        'emp_cob_allianz' => $empCobAllianz->id,
        'emp_cob_sbs' => $empCobSbs->id,
        'emp_cob_bolivar' => $empCobBolivar->id,
        'emp_cob_mapfre' => $empCobMapfre->id,
        'menu_empresariales' => $empresarialesMenu->id,
    ]])]);

    $empReclamaciones->update(['config' => array_merge($empReclamaciones->config, ['option_routes' => [
        'emp_rec_sura' => $empRecSura->id,
        'emp_rec_allianz' => $empRecAllianz->id,
        'emp_rec_sbs' => $empRecSbs->id,
        'emp_rec_bolivar' => $empRecBolivar->id,
        'emp_rec_mapfre' => $empRecMapfre->id,
        'menu_empresariales' => $empresarialesMenu->id,
    ]])]);

    $empRecSura->update(['config' => array_merge($empRecSura->config, ['option_routes' => [
        'emp_rec_sura_danos' => $empRecSuraDanos->id,
        'emp_rec_sura_hurto' => $empRecSuraHurto->id,
        'emp_reclamaciones' => $empReclamaciones->id,
    ]])]);

    $backEmp->update(['config' => array_merge($backEmp->config, ['option_routes' => [
        'menu_empresariales' => $empresarialesMenu->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Otros Seguros Menu
    $otrosSegurosMenu->update(['config' => array_merge($otrosSegurosMenu->config, ['option_routes' => [
        'otros_arrendamiento' => $otrosArrendamiento->id,
        'otros_viaje' => $otrosViaje->id,
        'otros_cumplimiento' => $otrosCumplimiento->id,
        'otros_mascotas' => $otrosMascotas->id,
        'otros_hogar' => $otrosHogar->id,
        'otros_soat' => $otrosSoat->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    $otrosHogar->update(['config' => array_merge($otrosHogar->config, ['option_routes' => [
        'hogar_cotizar' => $hogarCotizar->id,
        'hogar_modificar' => $hogarModificar->id,
        'hogar_cancelar' => $hogarCancelar->id,
        'hogar_coberturas' => $hogarCoberturas->id,
        'hogar_reclamaciones' => $hogarReclamaciones->id,
        'menu_otros_seguros' => $otrosSegurosMenu->id,
    ]])]);

    $hogarCoberturas->update(['config' => array_merge($hogarCoberturas->config, ['option_routes' => [
        'hogar_cob_sura' => $hogarCobSura->id,
        'hogar_cob_bolivar' => $hogarCobBolivar->id,
        'hogar_cob_allianz' => $hogarCobAllianz->id,
        'hogar_cob_mapfre' => $hogarCobMapfre->id,
        'hogar_cob_sbs' => $hogarCobSbs->id,
        'menu_hogar' => $otrosHogar->id,
    ]])]);

    $hogarReclamaciones->update(['config' => array_merge($hogarReclamaciones->config, ['option_routes' => [
        'hogar_rec_danos' => $hogarRecDanos->id,
        'hogar_rec_hurto' => $hogarRecHurto->id,
        'menu_hogar' => $otrosHogar->id,
    ]])]);

    $backOtros->update(['config' => array_merge($backOtros->config, ['option_routes' => [
        'menu_otros_seguros' => $otrosSegurosMenu->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Cartera Menu
    $carteraMenu->update(['config' => array_merge($carteraMenu->config, ['option_routes' => [
        'cartera_sura' => $carteraSura->id,
        'cartera_allianz' => $carteraAllianz->id,
        'cartera_bolivar' => $carteraBolivar->id,
        'cartera_mapfre' => $carteraMapfre->id,
        'cartera_sbs' => $carteraSbs->id,
        'cartera_qualitas' => $carteraQualitas->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    $backCartera->update(['config' => array_merge($backCartera->config, ['option_routes' => [
        'menu_cartera' => $carteraMenu->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Certificados Menu
    $certificadosMenu->update(['config' => array_merge($certificadosMenu->config, ['option_routes' => [
        'cert_viaje' => $certViaje->id,
        'cert_renta_salud' => $certGenericDatos->id,
        'cert_eps' => $certGenericDatos->id,
        'cert_renta_pension' => $certGenericDatos->id,
        'cert_renta_educativa' => $certGenericDatos->id,
        'cert_endoso' => $certEndoso->id,
        'cert_arl' => $certArl->id,
        'cert_caratula' => $certCaratula->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    $backCertificados->update(['config' => array_merge($backCertificados->config, ['option_routes' => [
        'menu_certificados' => $certificadosMenu->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Asistencia
    $backAsistencia->update(['config' => array_merge($backAsistencia->config, ['option_routes' => [
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Otras Consultas Menu
    $otrasConsultasMenu->update(['config' => array_merge($otrasConsultasMenu->config, ['option_routes' => [
        'consulta_longevo' => $consultaLongevo->id,
        'consulta_carnet' => $consultaCarnet->id,
        'consulta_directorio' => $consultaDirectorio->id,
        'consulta_sedes' => $consultaSedes->id,
        'consulta_vacunacion' => $consultaVacunacion->id,
        'consulta_autosura' => $consultaAutosura->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    $consultaDirectorio->update(['config' => array_merge($consultaDirectorio->config, ['option_routes' => [
        'dir_sura' => $dirSura->id,
        'dir_allianz' => $dirAllianz->id,
        'dir_bolivar' => $dirBolivar->id,
        'dir_mapfre' => $dirMapfre->id,
        'dir_sbs' => $dirSbs->id,
        'menu_otras_consultas' => $otrasConsultasMenu->id,
    ]])]);

    $backOtrasConsultas->update(['config' => array_merge($backOtrasConsultas->config, ['option_routes' => [
        'menu_otras_consultas' => $otrasConsultasMenu->id,
        'menu_principal' => $mainMenu->id,
    ]])]);

    // Canales
    $backCanales->update(['config' => array_merge($backCanales->config, ['option_routes' => [
        'menu_principal' => $mainMenu->id,
    ]])]);

    // ========== 6. CREATE TRIGGER ==========
    ChatbotTrigger::create([
        'chatbot_id' => $chatbot->id,
        'flow_id' => $flow->id,
        'name' => 'Trigger Principal',
        'trigger_type' => 'keyword',
        'trigger_value' => 'hola,menu,menú,inicio,hi,hello,buenas,buenos días,buenas tardes,buenas noches',
        'is_active' => true,
        'priority' => 100,
    ]);

    DB::commit();

    $nodeCount = ChatbotNode::where('flow_id', $flow->id)->count();
    echo "\n✅ Chatbot '{$CHATBOT_NAME}' creado exitosamente!\n";
    echo "   - Chatbot ID: {$chatbot->id}\n";
    echo "   - Flow ID: {$flow->id}\n";
    echo "   - Nodos creados: {$nodeCount}\n";
    echo "   - Instance: {$INSTANCE_ID}\n";
    echo "   - Estado: INACTIVO (activar manualmente después de verificar)\n";
    echo "\n⚠️  Para activar: UPDATE chatbots SET is_active=1 WHERE id={$chatbot->id};\n";

} catch (\Throwable $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "   File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "   Se hizo rollback.\n";
    exit(1);
}
