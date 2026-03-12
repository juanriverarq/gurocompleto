<?php
require __DIR__ . "/../vendor/autoload.php";
$app = require_once __DIR__ . "/../bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$instance = App\Models\WhatsAppInstance::find(84);
$cloudApi = new App\Services\WhatsAppCloudApiService();
$result = $cloudApi->getMessageTemplates($instance, null, 50);

if ($result['success']) {
    foreach ($result['data'] as $t) {
        if (str_starts_with($t['name'], 'poliza_')) {
            echo $t['name'] . " => " . $t['status'] . "\n";
        }
    }
} else {
    echo "Error: " . $result['error'] . "\n";
}
