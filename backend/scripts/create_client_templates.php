<?php
require __DIR__ . "/../vendor/autoload.php";
$app = require_once __DIR__ . "/../bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$instance = App\Models\WhatsAppInstance::find(84);
$cloudApi = new App\Services\WhatsAppCloudApiService();

$templates = [
    [
        'name' => 'cliente_cumpleanos',
        'text' => 'Feliz cumpleanos {{1}}! 🎂 Te deseamos un excelente dia lleno de alegria. Gracias por confiar en nosotros.',
        'example' => [['Juan']],
    ],
    [
        'name' => 'cliente_dia_trabajador',
        'text' => 'Feliz Dia del Trabajador {{1}}! Reconocemos tu esfuerzo y dedicacion. Gracias por confiar en nosotros.',
        'example' => [['Juan']],
    ],
    [
        'name' => 'cliente_dia_mujer',
        'text' => 'Feliz Dia de la Mujer {{1}}! Un reconocimiento especial a tu fortaleza y dedicacion. Gracias por confiar en nosotros.',
        'example' => [['Maria']],
    ],
    [
        'name' => 'cliente_dia_hombre',
        'text' => 'Feliz Dia del Hombre {{1}}! Un saludo especial en este dia. Gracias por confiar en nosotros.',
        'example' => [['Juan']],
    ],
    [
        'name' => 'cliente_dia_asesor',
        'text' => 'Feliz Dia del Asesor de Seguros {{1}}! Agradecemos tu confianza y te recordamos que estamos aqui para protegerte.',
        'example' => [['Juan']],
    ],
];

foreach ($templates as $t) {
    $result = $cloudApi->createMessageTemplate($instance, [
        'name' => $t['name'],
        'language' => 'es',
        'category' => 'MARKETING',
        'components' => [
            [
                'type' => 'BODY',
                'text' => $t['text'],
                'example' => [
                    'body_text' => $t['example'],
                ],
            ],
        ],
    ]);

    $status = ($result['success'] ?? false) 
        ? "OK - id=" . ($result['data']['id'] ?? '?')
        : "ERROR - " . ($result['error'] ?? json_encode($result));
    echo "{$t['name']}: {$status}\n";
}
