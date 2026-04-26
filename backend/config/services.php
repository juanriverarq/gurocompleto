<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Configuración para Google OAuth móvil (Opción A - OAuth puro)
    'google_mobile' => [
        'client_id' => env('GOOGLE_MOBILE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_MOBILE_CLIENT_SECRET'),
    ],

    // Configuración WhatsApp Cloud API
    'whatsapp' => [
        'cloud_api_verify_token' => env('WHATSAPP_CLOUD_API_VERIFY_TOKEN', 'guro_webhook_verify_2024'),
        'service_url' => env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'),
    ],

    'microservicio' => [
        'base_url' => env('MICROSERVICIO_API_URL', 'http://127.0.0.1:8002'),
        'timeout' => env('MICROSERVICIO_TIMEOUT', 120),
        'connect_timeout' => env('MICROSERVICIO_CONNECT_TIMEOUT', 15),
    ],

];
