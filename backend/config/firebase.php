<?php

return [
    // ID del proyecto de Firebase (usado para validar aud/iss del JWT)
    'project_id' => env('FIREBASE_PROJECT_ID', 'guro-b3911'),

    // Opcional: claves del cliente si se usaran SDKs en backend (no requerido por ahora)
    'api_key' => env('FIREBASE_API_KEY'),
    'auth_domain' => env('FIREBASE_AUTH_DOMAIN'),
    'storage_bucket' => env('FIREBASE_STORAGE_BUCKET'),
    'messaging_sender_id' => env('FIREBASE_MESSAGING_SENDER_ID'),
    'app_id' => env('FIREBASE_APP_ID'),
    'measurement_id' => env('FIREBASE_MEASUREMENT_ID'),

    // Configuración (opcional) para Firebase Admin SDK si se llegara a usar
    'credentials' => [
        'type' => 'service_account',
        'project_id' => env('FIREBASE_PROJECT_ID', 'guro-b3911'),
        'private_key_id' => env('FIREBASE_PRIVATE_KEY_ID'),
        'private_key' => env('FIREBASE_PRIVATE_KEY'),
        'client_email' => env('FIREBASE_CLIENT_EMAIL'),
        'client_id' => env('FIREBASE_CLIENT_ID'),
        'auth_uri' => 'https://accounts.google.com/o/oauth2/auth',
        'token_uri' => 'https://oauth2.googleapis.com/token',
        'auth_provider_x509_cert_url' => 'https://www.googleapis.com/oauth2/v1/certs',
        'client_x509_cert_url' => env('FIREBASE_CLIENT_CERT_URL'),
    ],

    'database_url' => env('FIREBASE_DATABASE_URL'),
];