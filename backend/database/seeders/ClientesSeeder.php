<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Cliente;
use App\Models\Broker;
use Faker\Factory as Faker;

class ClientesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create('es_ES');
        
        // Obtener los brokers existentes
        $brokers = Broker::all();
        
        if ($brokers->isEmpty()) {
            $this->command->error('No hay brokers en la base de datos. Ejecuta primero el seeder de brokers.');
            return;
        }
        
        // Generar 20 clientes (10 para cada broker)
        $totalClientes = 20;
        $clientesPorBroker = intval($totalClientes / $brokers->count());
        
        foreach ($brokers as $broker) {
            for ($i = 0; $i < $clientesPorBroker; $i++) {
                $firstName = $faker->firstName;
                $lastName = $faker->lastName;
                
                Cliente::create([
                    'broker_id' => $broker->id,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'document_type' => $faker->randomElement(['CC', 'NIT', 'CE']),
                    'document_number' => $faker->unique()->numerify('##########'),
                    'email' => $faker->unique()->email,
                    'phone' => $faker->phoneNumber,
                    'mobile_phone' => $faker->phoneNumber,
                    'birth_date' => $faker->dateTimeBetween('-65 years', '-18 years')->format('Y-m-d'),
                    'gender' => $faker->randomElement(['M', 'F']),
                    'marital_status' => $faker->randomElement(['soltero', 'casado', 'divorciado', 'viudo', 'union_libre']),
                    'address' => $faker->address,
                    'city' => $faker->city,
                    'state' => $faker->state,
                    'country' => 'Colombia',
                    'postal_code' => $faker->postcode,
                    'occupation' => $faker->jobTitle,
                    'company' => $faker->company,
                    'monthly_income' => $faker->numberBetween(1200000, 8000000), // Entre 1.2M y 8M COP
                    'work_address' => $faker->address,
                    'emergency_contact_name' => $faker->name,
                    'emergency_contact_phone' => $faker->phoneNumber,
                    'emergency_contact_relationship' => $faker->randomElement(['Padre', 'Madre', 'Hermano', 'Hermana', 'Cónyuge', 'Hijo', 'Hija', 'Amigo']),
                    'status' => $faker->randomElement(['active', 'prospect']),
                    'priority' => $faker->randomElement(['low', 'medium', 'high']),
                    'notes' => $faker->optional(0.6)->sentence,
                    'source' => $faker->randomElement(['Referido', 'Redes Sociales', 'Página Web', 'Publicidad', 'Llamada Fría', 'Email']),
                    'total_policies_value' => 0, // Se actualizará cuando se creen las pólizas
                    'total_policies_count' => 0, // Se actualizará cuando se creen las pólizas
                    'last_contact_at' => $faker->optional(0.8)->dateTimeBetween('-30 days', 'now'),
                    'next_follow_up_at' => $faker->optional(0.4)->dateTimeBetween('now', '+30 days'),
                    'created_at' => $faker->dateTimeBetween('-6 months', 'now'),
                    'updated_at' => now(),
                ]);
            }
        }
        
        $this->command->info("Se han creado {$totalClientes} clientes exitosamente.");
    }
}
