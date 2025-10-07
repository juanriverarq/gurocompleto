<?php

return [
    'env' => env('WOMPI_ENV', 'sandbox'), // sandbox | production
    'public_key' => env('WOMPI_PUBLIC_KEY'),
    'private_key' => env('WOMPI_PRIVATE_KEY'),
    'integrity_key' => env('WOMPI_INTEGRITY_KEY'),
    'webhook_secret' => env('WOMPI_WEBHOOK_SECRET'),
    'base_urls' => [
        'sandbox' => 'https://sandbox.wompi.co/v1',
        'production' => 'https://production.wompi.co/v1',
    ],
];


