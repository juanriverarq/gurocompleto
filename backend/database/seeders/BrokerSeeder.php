<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Broker;

class BrokerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Evitar crear datos sensibles fuera de local
        if (!app()->environment('local')) {
            echo "BrokerSeeder: saltando (no-local)\n";
            return;
        }

        // 1. Crear o encontrar usuario master de prueba (solo local)
        $user = User::firstOrCreate([
            'email' => 'admin@test.com'
        ], [
            'name' => 'Admin Test',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
            'user_type' => 'MASTER',
            'status' => 'active'
        ]);

        echo "Usuario creado/encontrado: {$user->email}\n";

        // 2. Crear broker de prueba
        $broker = Broker::firstOrCreate([
            'owner_id' => $user->id
        ], [
            'name' => 'Broker de Prueba',
            'legal_name' => 'Broker de Prueba S.A.S.',
            'document_type' => 'NIT',
            'document_number' => '900123456-1',
            'email' => 'contacto@brokertest.com',
            'phone' => '+57 1 234 5678',
            'address' => 'Calle 100 # 15-20',
            'city' => 'Bogotá',
            'state' => 'Cundinamarca',
            'country' => 'Colombia',
            'postal_code' => '110111',
            'industry' => 'Seguros',
            'description' => 'Broker de prueba para desarrollo',
            'website' => 'https://brokertest.com',
            'subdomain' => 'brokertest',
            'plan' => 'enterprise',
            'max_users' => 100,
            'max_clients' => 10000,
            'max_policies' => 5000,
            'status' => 'active',
            'trial_ends_at' => now()->addDays(30),
            'subscription_ends_at' => now()->addYear(),
            'last_activity_at' => now(),
            'features' => [
                'whatsapp' => true,
                'email' => true,
                'sms' => true,
                'reports' => true,
                'api_access' => true
            ],
            'settings' => [
                'timezone' => 'America/Bogota',
                'currency' => 'COP',
                'language' => 'es'
            ],
            'brand_colors' => [
                'primary' => '#2563EB',
                'secondary' => '#64748B',
                'accent' => '#059669'
            ]
        ]);

        echo "Broker creado/encontrado: {$broker->name} (ID: {$broker->id})\n";

        // 3. Actualizar el usuario para que tenga relación con el broker
        $user->update([
            'broker_id' => $broker->id
        ]);

        echo "Usuario vinculado al broker\n";
        echo "Credenciales de prueba:\n";
        echo "Email: admin@test.com\n";
        echo "Password: password123\n";
        echo "Broker ID: {$broker->id}\n";
    }
}
