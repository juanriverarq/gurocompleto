<?php
// Import clients from CSV for broker 52
require_once '/home/guro/public_html/app.guro.co/vendor/autoload.php';

$app = require_once '/home/guro/public_html/app.guro.co/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$brokerId = 52;
$csvFile = '/home/guro/import_clients_broker52.csv';

if (!file_exists($csvFile)) {
    echo "ERROR: CSV file not found at {$csvFile}\n";
    exit(1);
}

$handle = fopen($csvFile, 'r');
$headers = fgetcsv($handle);

$created = 0;
$skipped = 0;
$errors = 0;
$duplicates = 0;

while (($row = fgetcsv($handle)) !== false) {
    $data = array_combine($headers, $row);
    
    $docNumber = trim($data['document_number']);
    if (empty($docNumber)) {
        $skipped++;
        continue;
    }
    
    // Check duplicate
    $existing = \App\Models\Cliente::where('broker_id', $brokerId)
        ->where('document_number', $docNumber)
        ->first();
    
    if ($existing) {
        $duplicates++;
        continue;
    }
    
    try {
        $firstName = $data['first_name'] ?: ($data['company_legal_name'] ?: '');
        $lastName = $data['last_name'] ?: '';
        
        $clientData = [
            'broker_id' => $brokerId,
            'client_type' => $data['client_type'],
            'document_number' => $docNumber,
            'document_type' => $data['document_type'],
            'first_name' => $firstName,
            'last_name' => $lastName,
            'company' => $data['company_legal_name'] ?: null,
            'company_legal_name' => $data['company_legal_name'] ?: null,
            'birth_date' => !empty($data['birth_date']) ? $data['birth_date'] : null,
            'city' => $data['city'] ?: null,
            'mobile_phone' => $data['mobile_phone'] ?: null,
            'email' => !empty($data['email']) ? $data['email'] : null,
            'tags' => !empty($data['tags']) ? [$data['tags']] : [],
            'status' => 'active',
        ];
        
        \App\Models\Cliente::create($clientData);
        $created++;
    } catch (\Exception $e) {
        $errors++;
        if ($errors <= 5) {
            echo "ERROR [{$docNumber}]: {$e->getMessage()}\n";
        }
    }
}

fclose($handle);

echo "\n=== Import Complete ===\n";
echo "Created: {$created}\n";
echo "Duplicates: {$duplicates}\n";
echo "Skipped: {$skipped}\n";
echo "Errors: {$errors}\n";
echo "Total processed: " . ($created + $duplicates + $skipped + $errors) . "\n";
