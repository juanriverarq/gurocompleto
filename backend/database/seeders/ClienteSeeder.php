<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Broker;
use App\Models\Cliente;

class ClienteSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Primero crear un broker si no existe
        $broker = Broker::first();
        if (!$broker) {
            $owner = User::create([
                'name' => 'Admin Test',
                'email' => 'admin@test.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]);

            $broker = Broker::create([
                'name' => 'Broker Test',
                'legal_name' => 'Broker Test S.A.S.',
                'document_type' => 'NIT',
                'document_number' => '900123456-1',
                'email' => 'contacto@brokertest.com',
                'phone' => '+57 1 234 5678',
                'address' => 'Calle 100 # 15-20',
                'city' => 'Bogotá',
                'state' => 'Cundinamarca',
                'country' => 'Colombia',
                'subdomain' => 'brokertest',
                'plan' => 'enterprise',
                'status' => 'active',
                'owner_id' => $owner->id,
            ]);
        }

        // Crear usuarios empleados si no existen
        $user1 = User::where('email', 'empleado1@test.com')->first();
        if (!$user1) {
            $user1 = User::create([
                'name' => 'Empleado 1',
                'email' => 'empleado1@test.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]);
        }

        $user2 = User::where('email', 'empleado2@test.com')->first();
        if (!$user2) {
            $user2 = User::create([
                'name' => 'Empleado 2',
                'email' => 'empleado2@test.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]);
        }

        // Crear clientes de prueba
        $clientes = [
            [
                'broker_id' => $broker->id,
                'first_name' => 'Juan Carlos',
                'last_name' => 'Pérez González',
                'document_type' => 'CC',
                'document_number' => '12345678',
                'email' => 'juan.perez@email.com',
                'phone' => '+57 310 123 4567',
                'mobile_phone' => '+57 310 123 4567',
                'birth_date' => '1985-03-15',
                'gender' => 'M',
                'marital_status' => 'casado',
                'address' => 'Calle 45 # 12-34 Apto 501',
                'city' => 'Bogotá',
                'state' => 'Cundinamarca',
                'country' => 'Colombia',
                'occupation' => 'Ingeniero',
                'monthly_income' => 5000000,
                'assigned_user_id' => $user1->id,
                'status' => 'active',
                'priority' => 'medium',
                'source' => 'referral',
                'tags' => ['vip', 'referido'],
                'last_contact_at' => now(),
                'created_by' => $user1->id,
            ],
            [
                'broker_id' => $broker->id,
                'first_name' => 'María Fernanda',
                'last_name' => 'Rodríguez Silva',
                'document_type' => 'CC',
                'document_number' => '87654321',
                'email' => 'maria.rodriguez@email.com',
                'phone' => '+57 311 234 5678',
                'mobile_phone' => '+57 311 234 5678',
                'birth_date' => '1990-07-22',
                'gender' => 'F',
                'marital_status' => 'soltero',
                'address' => 'Carrera 15 # 67-89 Casa 12',
                'city' => 'Medellín',
                'state' => 'Antioquia',
                'country' => 'Colombia',
                'occupation' => 'Abogada',
                'monthly_income' => 4500000,
                'assigned_user_id' => $user2->id,
                'status' => 'active',
                'priority' => 'high',
                'source' => 'web',
                'tags' => ['prospecto'],
                'last_contact_at' => now(),
                'created_by' => $user2->id,
            ],
            [
                'broker_id' => $broker->id,
                'first_name' => 'Carlos Andrés',
                'last_name' => 'López Martínez',
                'document_type' => 'CC',
                'document_number' => '11223344',
                'email' => 'carlos.lopez@email.com',
                'phone' => '+57 312 345 6789',
                'mobile_phone' => '+57 312 345 6789',
                'birth_date' => '1982-11-08',
                'gender' => 'M',
                'marital_status' => 'casado',
                'address' => 'Avenida 68 # 45-67',
                'city' => 'Cali',
                'state' => 'Valle del Cauca',
                'country' => 'Colombia',
                'occupation' => 'Contador',
                'monthly_income' => 3800000,
                'assigned_user_id' => $user1->id,
                'status' => 'active',
                'priority' => 'medium',
                'source' => 'phone',
                'tags' => ['corporativo'],
                'last_contact_at' => now()->subDays(5),
                'created_by' => $user1->id,
            ],
            [
                'broker_id' => $broker->id,
                'first_name' => 'Ana Patricia',
                'last_name' => 'García Herrera',
                'document_type' => 'CC',
                'document_number' => '55667788',
                'email' => 'ana.garcia@email.com',
                'phone' => '+57 313 456 7890',
                'mobile_phone' => '+57 313 456 7890',
                'birth_date' => '1988-04-12',
                'gender' => 'F',
                'marital_status' => 'soltero',
                'address' => 'Calle 20 # 30-40 Torre B Apto 803',
                'city' => 'Barranquilla',
                'state' => 'Atlántico',
                'country' => 'Colombia',
                'occupation' => 'Médica',
                'monthly_income' => 8000000,
                'assigned_user_id' => $user2->id,
                'status' => 'prospect',
                'priority' => 'high',
                'source' => 'referral',
                'tags' => ['vip', 'médico'],
                'last_contact_at' => now()->subDays(2),
                'next_follow_up_at' => now()->addDays(3),
                'created_by' => $user2->id,
            ],
            [
                'broker_id' => $broker->id,
                'first_name' => 'Roberto',
                'last_name' => 'Jiménez Castro',
                'document_type' => 'CC',
                'document_number' => '98765432',
                'email' => 'roberto.jimenez@email.com',
                'phone' => '+57 314 567 8901',
                'mobile_phone' => '+57 314 567 8901',
                'birth_date' => '1975-09-25',
                'gender' => 'M',
                'marital_status' => 'casado',
                'address' => 'Carrera 50 # 80-90',
                'city' => 'Bucaramanga',
                'state' => 'Santander',
                'country' => 'Colombia',
                'occupation' => 'Empresario',
                'company' => 'Tech Solutions S.A.S.',
                'monthly_income' => 12000000,
                'assigned_user_id' => $user1->id,
                'status' => 'active',
                'priority' => 'high',
                'source' => 'web',
                'tags' => ['vip', 'empresario'],
                'last_contact_at' => now()->subDays(1),
                'created_by' => $user1->id,
            ]
        ];

        foreach ($clientes as $clienteData) {
            // Verificar si ya existe un cliente con el mismo documento y broker
            $existing = Cliente::where('broker_id', $clienteData['broker_id'])
                              ->where('document_number', $clienteData['document_number'])
                              ->first();
            
            if (!$existing) {
                Cliente::create($clienteData);
            }
        }

        $this->command->info('Se crearon ' . count($clientes) . ' clientes de prueba exitosamente.');
    }
}
