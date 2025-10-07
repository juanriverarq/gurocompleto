<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Configuración Centralizada de Autenticación
    |--------------------------------------------------------------------------
    |
    | Este archivo centraliza la configuración de middleware de autenticación
    | para evitar problemas de inconsistencia entre rutas.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Middleware Estándar
    |--------------------------------------------------------------------------
    |
    | Middleware que debe aplicarse a todas las rutas protegidas del sistema.
    |
    */
    'standard_middleware' => [
        'firebase.auth'
    ],

    /*
    |--------------------------------------------------------------------------
    | Rutas SaaS
    |--------------------------------------------------------------------------
    |
    | Configuración específica para rutas del sistema SaaS multi-tenant.
    |
    */
    'saas_routes' => [
        'middleware' => [
            'firebase.auth',
            'global.broker.auth'
        ],
        'prefix' => 'saas',
    ],

    /*
    |--------------------------------------------------------------------------
    | Controladores que requieren AuthService
    |--------------------------------------------------------------------------
    |
    | Lista de controladores que deben usar el sistema centralizado AuthService
    | en lugar de implementaciones personalizadas.
    |
    */
    'controllers_using_auth_service' => [
        'App\Http\Controllers\Api\CampaignController',
        'App\Http\Controllers\SaaS\SaasClientesController',
        'App\Http\Controllers\SaaS\SaasPolizasController',
        'App\Http\Controllers\Api\DashboardController',
    ],

    /*
    |--------------------------------------------------------------------------
    | Rutas Públicas
    |--------------------------------------------------------------------------
    |
    | Rutas que no requieren autenticación.
    |
    */
    'public_routes' => [
        'test-simple',
        'campaign-templates',
        'temp/*', // Rutas temporales de debug
    ],

    /*
    |--------------------------------------------------------------------------
    | Configuración de Headers
    |--------------------------------------------------------------------------
    |
    | Headers estándar que deben incluirse en todas las respuestas de API.
    |
    */
    'standard_headers' => [
        'Content-Type' => 'application/json',
        'Accept' => 'application/json',
    ],
];
