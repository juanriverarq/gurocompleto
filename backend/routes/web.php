<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', function () {
    return response()->json([
        'success' => false,
        'message' => 'Esta es una ruta de fallback. Usa el sistema de autenticación del frontend.',
        'redirect_to' => env('FRONTEND_URL', 'http://localhost:5173') . '/auth/auth1/login'
    ], 401);
})->name('login');
