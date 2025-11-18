<?php

/**
 * Script para verificar el estado de verificación de emails en la BD
 * Ejecutar desde la raíz del proyecto: php check_email_verification.php
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

echo "=== VERIFICACIÓN DE EMAILS EN LA BASE DE DATOS ===\n\n";

// Estadísticas generales
$total = User::count();
$verificados = User::whereNotNull('email_verified_at')->count();
$noVerificados = User::whereNull('email_verified_at')->count();
$porcentaje = $total > 0 ? round(($verificados / $total) * 100, 2) : 0;

echo "ESTADÍSTICAS GENERALES:\n";
echo "- Total de usuarios: $total\n";
echo "- Emails verificados: $verificados ($porcentaje%)\n";
echo "- Emails NO verificados: $noVerificados\n\n";

// Usuarios por proveedor
echo "USUARIOS POR PROVEEDOR:\n";
$providers = User::selectRaw('provider, COUNT(*) as total')->groupBy('provider')->get();
foreach ($providers as $prov) {
    echo "- {$prov->provider}: {$prov->total} usuarios\n";
}
echo "\n";

// Usuarios NO verificados
if ($noVerificados > 0) {
    echo "USUARIOS CON EMAIL NO VERIFICADO:\n";
    $usuariosNoVerificados = User::whereNull('email_verified_at')
        ->select('id', 'name', 'email', 'firebase_uid', 'provider', 'created_at')
        ->get();
    
    foreach ($usuariosNoVerificados as $user) {
        echo "- ID: {$user->id} | {$user->name} ({$user->email}) | Provider: {$user->provider} | Creado: {$user->created_at}\n";
    }
    echo "\n";
}

// Verificar usuario específico (opcional)
if ($argc > 1) {
    $email = $argv[1];
    echo "VERIFICANDO USUARIO ESPECÍFICO: $email\n";
    
    $user = User::where('email', $email)->first();
    
    if ($user) {
        echo "✓ Usuario encontrado\n";
        echo "  - ID: {$user->id}\n";
        echo "  - Nombre: {$user->name}\n";
        echo "  - Email: {$user->email}\n";
        echo "  - Firebase UID: {$user->firebase_uid}\n";
        echo "  - Provider: {$user->provider}\n";
        echo "  - Tipo Usuario: {$user->user_type}\n";
        echo "  - Estado: {$user->status}\n";
        
        if ($user->hasVerifiedEmail()) {
            echo "  - ✓ Email VERIFICADO el: {$user->email_verified_at}\n";
        } else {
            echo "  - ✗ Email NO VERIFICADO\n";
        }
    } else {
        echo "✗ Usuario no encontrado\n";
    }
}

echo "\n=== FIN DEL REPORTE ===\n";
