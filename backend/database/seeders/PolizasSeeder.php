<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Poliza;
use App\Models\Broker;
use App\Models\Cliente;
use App\Models\User;
use Carbon\Carbon;
use Faker\Factory as Faker;

class PolizasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create('es_ES');
        
        // Obtener brokers y clientes existentes
        $brokers = Broker::all();
        $clientes = Cliente::all();
        $users = User::all();
        
        if ($brokers->isEmpty()) {
            $this->command->error('No hay brokers en la base de datos. Ejecuta primero el seeder de brokers.');
            return;
        }
        
        if ($clientes->isEmpty()) {
            $this->command->error('No hay clientes en la base de datos. Ejecuta primero el seeder de clientes.');
            return;
        }

        // Datos de ejemplo para las pólizas
        $aseguradoras = [
            'Seguros Sura', 'Mapfre', 'Bolívar Seguros', 'La Previsora', 
            'AXA Colpatria', 'Allianz', 'Liberty Seguros', 'Solidaria', 
            'La Equidad', 'Mundial'
        ];

        $productos = [
            'Vida Individual', 'Automóvil Particular', 'Hogar Propietario', 'Salud EPS', 
            'Empresarial PyME', 'SOAT', 'Responsabilidad Civil', 'Todo Riesgo Vehículo', 
            'Incendio y Terremoto', 'Transporte Nacional', 'Accidentes Personales'
        ];
        
        // Crear 100 pólizas de ejemplo (50 para cada broker)
        $polizasPorBroker = 50;
        $totalPolizas = 0;

        foreach ($brokers as $broker) {
            // Obtener clientes de este broker
            $clientesBroker = $clientes->where('broker_id', $broker->id);
            
            if ($clientesBroker->isEmpty()) {
                $this->command->warn("No hay clientes para el broker {$broker->name}. Saltando...");
                continue;
            }
            
            for ($i = 1; $i <= $polizasPorBroker; $i++) {
                $fechaExpedicion = $faker->dateTimeBetween('-365 days', 'now');
                $fechaInicio = $faker->dateTimeBetween($fechaExpedicion, '+30 days');
                $fechaFin = (clone $fechaInicio)->modify('+1 year');
                $fechaRenovacion = (clone $fechaFin)->modify('-30 days');
                $fechaVencimientoPago = $faker->dateTimeBetween($fechaInicio, '+90 days');

                // Determinar estado basado en fechas
                $estado = 'active';
                if ($fechaFin < now()) {
                    $estado = $faker->randomElement(['expired', 'active', 'active']); // Mayoría activas
                }
                if ($faker->boolean(5)) { // 5% de probabilidad
                    $estado = 'cancelled';
                }

                $primaNeta = $faker->numberBetween(100000, 5000000);
                $valorAsegurado = $faker->numberBetween(2000000, 50000000);
                $deducible = $faker->numberBetween(0, 500000);
                $porcentajeComision = $faker->numberBetween(5, 15);
                $montoComision = ($primaNeta * $porcentajeComision) / 100;
                
                // Seleccionar un cliente aleatorio del broker
                $cliente = $clientesBroker->random();

                Poliza::create([
                    'broker_id' => $broker->id,
                    'client_id' => $cliente->id,
                    'policy_number' => 'POL-' . date('Y') . '-' . $broker->id . '-' . str_pad($i, 4, '0', STR_PAD_LEFT),
                    'internal_number' => 'INT-' . $broker->id . '-' . str_pad($i, 4, '0', STR_PAD_LEFT),
                    'type' => $faker->randomElement(['vida', 'autos', 'hogar', 'empresarial', 'salud', 'accidentes', 'responsabilidad_civil', 'otros']),
                    'product_name' => collect($productos)->random(),
                    'insurance_company' => collect($aseguradoras)->random(),
                    'description' => $faker->optional(0.3)->sentence,
                    'client_name' => $cliente->first_name . ' ' . $cliente->last_name,
                    'client_document' => $cliente->document_number,
                    'issue_date' => $fechaExpedicion,
                    'start_date' => $fechaInicio,
                    'end_date' => $fechaFin,
                    'payment_due_date' => $fechaVencimientoPago,
                    'renewal_date' => $fechaRenovacion,
                    'premium_amount' => $primaNeta,
                    'insured_amount' => $valorAsegurado,
                    'deductible' => $deducible,
                    'commission_percentage' => $porcentajeComision,
                    'commission_amount' => $montoComision,
                    'payment_frequency' => $faker->randomElement(['monthly', 'quarterly', 'biannual', 'annual']),
                    'payment_method' => $faker->randomElement(['cash', 'transfer', 'check', 'card', 'financing']),
                    'status' => $estado,
                    'payment_status' => $faker->randomElement(['paid', 'pending', 'overdue']),
                    'status_notes' => $faker->optional(0.2)->sentence,
                    'beneficiary_name' => $faker->optional(0.7)->name,
                    'beneficiary_document' => $faker->optional(0.7)->numerify('##########'),
                    'beneficiary_relationship' => $faker->optional(0.7)->randomElement(['Cónyuge', 'Hijo/a', 'Padre', 'Madre', 'Hermano/a']),
                    'beneficiary_phone' => $faker->optional(0.7)->phoneNumber,
                    'assigned_user_id' => $users->isNotEmpty() ? $users->random()->id : null,
                    'created_by' => $users->isNotEmpty() ? $users->random()->id : null,
                    'notes' => $faker->optional(0.3)->paragraph,
                    'auto_renewal' => $faker->boolean(70), // 70% tienen auto renovación
                    'renewal_days_notice' => $faker->randomElement([15, 30, 45, 60]),
                    'created_at' => $fechaExpedicion,
                    'updated_at' => now(),
                ]);
                
                $totalPolizas++;
            }
        }

        $this->command->info("Se han creado {$totalPolizas} pólizas exitosamente.");
    }
}
