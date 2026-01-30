<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    /**
     * Crear usuario SUPERADMIN para el panel master
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'info@gurocontable.com'],
            [
                'name' => 'Super Admin Guro',
                'email' => 'info@gurocontable.com',
                'password' => Hash::make('Jua88riv25.'),
                'user_type' => 'ADMIN',
                'role' => 'superadmin',
                'status' => 'active',
                'email_verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        $this->command->info('✅ Usuario SUPERADMIN creado: info@gurocontable.com');
    }
}
