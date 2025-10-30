<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;
use Illuminate\Support\Facades\Http;

echo "=== TEST: Envío Real de Email con SendGrid ===\n\n";

$apiKey = env('SENDGRID_API_KEY');
$fromEmail = env('SENDGRID_FROM_EMAIL', 'info@guro.co');
$fromName = env('SENDGRID_FROM_NAME', 'Guro');

if (!$apiKey) {
    echo "❌ SENDGRID_API_KEY no configurada\n";
    exit(1);
}

echo "✅ SendGrid configurado:\n";
echo "   API Key: " . substr($apiKey, 0, 10) . "...\n";
echo "   From: {$fromName} <{$fromEmail}>\n\n";

// Crear una campaña de prueba
$campaign = EmailCampaign::create([
    'broker_id' => 2, // Usar broker existente
    'name' => 'Test Webhook ' . date('Y-m-d H:i:s'),
    'subject' => 'Test de Webhook SendGrid',
    'content' => '<h1>Hola {{nombre}}</h1><p>Este es un email de prueba para verificar el webhook de SendGrid.</p><p><a href="https://guro.co">Haz click aquí</a></p>',
    'audience_type' => 'segment',
    'throttling_per_minute' => 30,
    'status' => 'running',
    'is_active' => true,
]);

echo "📧 Campaña de prueba creada: ID {$campaign->id}\n\n";

// Crear un recipient de prueba (usa tu email real para poder abrir y hacer click)
$testEmail = 'soyjuanrivera@gmail.com'; // Cambia esto por tu email
$recipient = EmailCampaignRecipient::create([
    'campaign_id' => $campaign->id,
    'broker_id' => 2,
    'email' => $testEmail,
    'name' => 'Usuario de Prueba',
    'variables_resolved' => json_encode(['nombre' => 'Usuario de Prueba']),
    'status' => 'pending',
]);

echo "👤 Recipient creado: ID {$recipient->id}\n";
echo "   Email: {$recipient->email}\n\n";

// Enviar el email
echo "📤 Enviando email vía SendGrid...\n";

$html = str_replace('{{nombre}}', 'Usuario de Prueba', $campaign->content);

$payload = [
    'from' => ['email' => $fromEmail, 'name' => $fromName],
    'personalizations' => [[
        'to' => [['email' => $recipient->email, 'name' => $recipient->name]],
        'subject' => $campaign->subject,
        'custom_args' => [
            'campaign_id' => (string)$campaign->id,
            'recipient_id' => (string)$recipient->id,
        ],
    ]],
    'content' => [[
        'type' => 'text/html',
        'value' => $html,
    ]],
    'tracking_settings' => [
        'click_tracking' => ['enable' => true],
        'open_tracking' => ['enable' => true],
    ],
];

try {
    $response = Http::withHeaders([
        'Authorization' => 'Bearer ' . $apiKey,
        'Content-Type' => 'application/json',
    ])->timeout(20)->post('https://api.sendgrid.com/v3/mail/send', $payload);
    
    if ($response->status() === 202) {
        $messageId = $response->header('X-Message-Id');
        echo "   ✅ Email enviado exitosamente!\n";
        echo "   Message ID: " . ($messageId ?? 'N/A') . "\n\n";
        
        $recipient->update([
            'status' => 'sent',
            'provider_message_id' => $messageId,
            'sent_at' => now(),
        ]);
        
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "📊 INSTRUCCIONES:\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        echo "1. Revisa tu bandeja de entrada: {$testEmail}\n";
        echo "2. Abre el email (esto generará un evento 'open')\n";
        echo "3. Haz click en el enlace (esto generará un evento 'click')\n";
        echo "4. Espera 30-60 segundos para que SendGrid envíe los eventos\n";
        echo "5. Ejecuta este comando para ver las estadísticas:\n\n";
        echo "   php -r \"require 'vendor/autoload.php'; \\\$app = require_once 'bootstrap/app.php'; \\\$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); \\\$c = App\\Models\\EmailCampaign::find({$campaign->id}); \\\$c->refreshStats(); echo json_encode(\\\$c->stats_json, JSON_PRETTY_PRINT) . '\\n';\"\n\n";
        echo "6. O verifica el recipient directamente:\n\n";
        echo "   php -r \"require 'vendor/autoload.php'; \\\$app = require_once 'bootstrap/app.php'; \\\$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); \\\$r = App\\Models\\EmailCampaignRecipient::find({$recipient->id}); echo 'Status: ' . \\\$r->status . '\\n'; echo 'Delivered: ' . (\\\$r->delivered_at ?? 'N/A') . '\\n'; echo 'Opened: ' . (\\\$r->opened_at ?? 'N/A') . '\\n'; echo 'Clicked: ' . (\\\$r->clicked_at ?? 'N/A') . '\\n';\"\n\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        
    } else {
        echo "   ❌ Error al enviar: HTTP " . $response->status() . "\n";
        echo "   Body: " . $response->body() . "\n";
    }
} catch (\Exception $e) {
    echo "   ❌ Excepción: " . $e->getMessage() . "\n";
}