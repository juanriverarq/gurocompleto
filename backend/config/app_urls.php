<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Application URLs Configuration
    |--------------------------------------------------------------------------
    |
    | This configuration file centralizes all URL and port configurations
    | to ensure consistency throughout the application.
    |
    */

    'backend' => [
        'protocol' => env('BACKEND_PROTOCOL', 'http'),
        'host' => env('BACKEND_HOST', '127.0.0.1'),
        'port' => env('BACKEND_PORT', '8001'),
        'url' => env('BACKEND_URL', 'http://127.0.0.1:8001'),
    ],

    'frontend' => [
        'protocol' => env('FRONTEND_PROTOCOL', 'http'),
        'host' => env('FRONTEND_HOST', 'localhost'),
        'port' => env('FRONTEND_PORT', '5174'),
        'url' => env('FRONTEND_URL', 'http://localhost:5174'),
    ],

    'api' => [
        'base_url' => env('API_URL', 'http://127.0.0.1:8001/api'),
        'version' => env('API_VERSION', 'v1'),
    ],

    'cors' => [
        'allowed_origins' => [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5174',
            'http://127.0.0.1:8001',
            'http://localhost:8081',
        ],
    ],

];
