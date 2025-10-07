<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->boot();

use App\Models\User;

echo "=== VERIFICACIÓN DE USUARIOS ===\n\n";

// 1. Primer usuario
$firstUser = User::first();
echo "1. PRIMER USUARIO EN LA BASE DE DATOS:\n";
echo "   ID: {$firstUser->id}\n";
echo "   Nombre: {$firstUser->name}\n";
echo "   Email: {$firstUser->email}\n";
echo "   Firebase UID: {$firstUser->firebase_uid}\n";
echo "   Broker ID: {$firstUser->broker_id}\n";
echo "   Tipo: {$firstUser->user_type}\n\n";

// 2. Usuario chseguros.com.co@gmail.com
$chsegurosUser = User::where('email', 'chseguros.com.co@gmail.com')->first();
if ($chsegurosUser) {
    echo "2. USUARIO chseguros.com.co@gmail.com:\n";
    echo "   ID: {$chsegurosUser->id}\n";
    echo "   Nombre: {$chsegurosUser->name}\n";
    echo "   Firebase UID: {$chsegurosUser->firebase_uid}\n";
    echo "   Broker ID: {$chsegurosUser->broker_id}\n";
    echo "   Tipo: {$chsegurosUser->user_type}\n\n";
} else {
    echo "2. USUARIO chseguros.com.co@gmail.com NO ENCONTRADO\n\n";
}

// 3. Buscar usuarios con Firebase UID duplicados
$duplicates = User::select('firebase_uid', \DB::raw('COUNT(*) as count'))
    ->whereNotNull('firebase_uid')
    ->groupBy('firebase_uid')
    ->having('count', '>', 1)
    ->get();

if ($duplicates->count() > 0) {
    echo "3. USUARIOS CON FIREBASE UID DUPLICADOS:\n";
    foreach ($duplicates as $dup) {
        echo "   Firebase UID: {$dup->firebase_uid} - Cantidad: {$dup->count}\n";
        $users = User::where('firebase_uid', $dup->firebase_uid)->get();
        foreach ($users as $user) {
            echo "      - {$user->name} ({$user->email}) - ID: {$user->id}\n";
        }
    }
    echo "\n";
} else {
    echo "3. NO HAY FIREBASE UIDs DUPLICADOS\n\n";
}

// 4. Total de usuarios
$totalUsers = User::count();
echo "4. TOTAL DE USUARIOS: {$totalUsers}\n\n";

// 5. Usuarios con broker_id 5
$broker5Users = User::where('broker_id', 5)->get();
echo "5. USUARIOS CON BROKER_ID 5:\n";
foreach ($broker5Users as $user) {
    echo "   - {$user->name} ({$user->email}) - ID: {$user->id}\n";
}

echo "\n=== FIN DE VERIFICACIÓN ===\n";
