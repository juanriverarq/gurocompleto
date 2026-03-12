<?php
require __DIR__ . "/../vendor/autoload.php";
$app = require_once __DIR__ . "/../bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$instance = App\Models\WhatsAppInstance::find(84);
$cloudApi = new App\Services\WhatsAppCloudApiService();

// 1. Template: Vencimiento de poliza
$result1 = $cloudApi->createMessageTemplate($instance, [
    'name' => 'poliza_vencimiento',
    'language' => 'es',
    'category' => 'UTILITY',
    'components' => [
        [
            'type' => 'BODY',
            'text' => 'Hola {{1}}, te informamos que tu poliza {{2}} de {{3}} vence el {{4}}. Por favor contactanos para gestionar su renovacion.',
            'example' => [
                'body_text' => [['Juan', 'POL-12345', 'SURA', '15/03/2026']]
            ]
        ]
    ]
]);
echo "poliza_vencimiento: " . ($result1['success'] ? "OK - id=" . $result1['data']['id'] : "ERROR - " . ($result1['error'] ?? json_encode($result1))) . "\n";

// 2. Template: Renovacion de poliza
$result2 = $cloudApi->createMessageTemplate($instance, [
    'name' => 'poliza_renovacion',
    'language' => 'es',
    'category' => 'UTILITY',
    'components' => [
        [
            'type' => 'BODY',
            'text' => 'Hola {{1}}, es momento de renovar tu poliza {{2}} de {{3}}. La fecha de renovacion es {{4}}. Contactanos para ayudarte con el proceso.',
            'example' => [
                'body_text' => [['Juan', 'POL-12345', 'SURA', '15/03/2026']]
            ]
        ]
    ]
]);
echo "poliza_renovacion: " . ($result2['success'] ? "OK - id=" . $result2['data']['id'] : "ERROR - " . ($result2['error'] ?? json_encode($result2))) . "\n";

// 3. Template: Pago pendiente de poliza
$result3 = $cloudApi->createMessageTemplate($instance, [
    'name' => 'poliza_pago_pendiente',
    'language' => 'es',
    'category' => 'UTILITY',
    'components' => [
        [
            'type' => 'BODY',
            'text' => 'Hola {{1}}, te recordamos que el pago de tu poliza {{2}} vence el {{3}}. Monto: {{4}}. Por favor realiza tu pago a tiempo para mantener tu cobertura.',
            'example' => [
                'body_text' => [['Juan', 'POL-12345', '15/03/2026', '500000']]
            ]
        ]
    ]
]);
echo "poliza_pago_pendiente: " . ($result3['success'] ? "OK - id=" . $result3['data']['id'] : "ERROR - " . ($result3['error'] ?? json_encode($result3))) . "\n";
