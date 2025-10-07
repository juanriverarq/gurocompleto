<?php

// Envío real de prueba a SendGrid usando credenciales del .env
// Destinatario: info@guro.co (proporcionado)
// Requisitos: SENDGRID_API_KEY y SENDGRID_FROM_EMAIL (verificados) en backend/.env

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';

/** @var \Illuminate\Foundation\Application $app */
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

try {
    $apiKey = (string) env('SENDGRID_API_KEY', '');
    $fromEmail = (string) env('SENDGRID_FROM_EMAIL', '');
    $fromName = (string) env('SENDGRID_FROM_NAME', 'GURO');

    if (empty($apiKey)) {
        throw new \RuntimeException('Falta SENDGRID_API_KEY en .env');
    }
    if (empty($fromEmail)) {
        throw new \RuntimeException('Falta SENDGRID_FROM_EMAIL en .env');
    }

    $toEmail = 'info@guro.co';
    $subject = 'Prueba SendGrid GURO';
    $html = '<b>Hola equipo GURO</b><br>Este es un envío de prueba directo a SendGrid desde el backend.';

    $payload = [
        'from' => ['email' => $fromEmail, 'name' => $fromName],
        'personalizations' => [[
            'to' => [[ 'email' => $toEmail, 'name' => 'Info GURO' ]],
            'subject' => $subject,
            'custom_args' => [
                'source' => 'manual-test',
                'timestamp' => time(),
            ],
        ]],
        'content' => [[ 'type' => 'text/html', 'value' => $html ]],
    ];

    /** @var \Illuminate\Http\Client\Response $resp */
    $resp = \Illuminate\Support\Facades\Http::withHeaders([
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
        ])
        ->timeout(30)
        ->post('https://api.sendgrid.com/v3/mail/send', $payload);

    $status = $resp->status();
    $xMsgId = $resp->header('X-Message-Id') ?: $resp->header('x-message-id');

    echo "HTTP: {$status}\n";
    if ($xMsgId) {
        echo "X-Message-Id: {$xMsgId}\n";
    }
    if ($status !== 202) {
        echo "Body: " . $resp->body() . "\n";
    } else {
        echo "Envío aceptado por SendGrid (202). Verifica el inbox de {$toEmail}.\n";
    }
} catch (\Throwable $e) {
    fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
    exit(1);
}