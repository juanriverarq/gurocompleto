<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\EmpleadoBroker;
use App\Models\RolBroker;
use App\Models\Broker;

class EmpleadoBrokerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Obtener el primer broker disponible
        $broker = Broker::first();
        
        if (!$broker) {
            $this->command->info('No hay brokers disponibles. Crea un broker primero.');
            return;
        }

        // Crear o obtener un rol admin para el broker
        $rolAdmin = RolBroker::firstOrCreate([
            'broker_id' => $broker->id,
            'slug' => 'admin-empleado'
        ], [
            'nombre' => 'Administrador Empleado',
            'descripcion' => 'Rol de administrador para empleados',
            'permisos' => ['*'], // Todos los permisos
            'nivel_acceso' => 4,
            'es_admin' => true,
            'activo' => true,
        ]);

        // Crear empleados de prueba
        $empleados = [
            [
                'nombres' => 'Juan Carlos',
                'apellidos' => 'Pérez García',
                'tipo_documento' => 'cedula',
                'numero_documento' => '12345678',
                'email' => 'empleado@test.com',
                'usuario' => 'empleado1',
                'password' => 'password123', // Se hasheará automáticamente
                'telefono' => '555-0001',
                'celular' => '300-555-0001',
                'cargo' => 'Agente de Seguros',
                'departamento' => 'Ventas',
                'fecha_ingreso' => now()->subMonths(6),
                'estado' => EmpleadoBroker::ESTADO_ACTIVO,
                'tipo_vinculacion' => EmpleadoBroker::TIPO_EMPLEADO,
                'acceso_activo' => true,
                'requiere_cambio_password' => false, // Para testing, no requerir cambio
                'first_login' => false,
                'rol_id' => $rolAdmin->id,
                'broker_id' => $broker->id,
            ],
            [
                'nombres' => 'María Elena',
                'apellidos' => 'González López',
                'tipo_documento' => 'cedula',
                'numero_documento' => '87654321',
                'email' => 'maria@test.com',
                'usuario' => 'maria.gonzalez',
                'password' => 'password123',
                'telefono' => '555-0002',
                'celular' => '300-555-0002',
                'cargo' => 'Asesora Comercial',
                'departamento' => 'Ventas',
                'fecha_ingreso' => now()->subMonths(3),
                'estado' => EmpleadoBroker::ESTADO_ACTIVO,
                'tipo_vinculacion' => EmpleadoBroker::TIPO_EMPLEADO,
                'acceso_activo' => true,
                'requiere_cambio_password' => true, // Esta requerirá cambio
                'first_login' => true,
                'rol_id' => $rolAdmin->id,
                'broker_id' => $broker->id,
            ],
        ];

        foreach ($empleados as $empleadoData) {
            EmpleadoBroker::create($empleadoData);
            $this->command->info("Empleado creado: {$empleadoData['nombres']} {$empleadoData['apellidos']} - Usuario: {$empleadoData['usuario']}");
        }

        $this->command->info('✅ Empleados de prueba creados exitosamente:');
        $this->command->info('👤 empleado1 / password123 (sin cambio requerido)');
        $this->command->info('👤 maria.gonzalez / password123 (requiere cambio)');
        $this->command->info('📧 También pueden usar: empleado@test.com o maria@test.com');
    }
}
