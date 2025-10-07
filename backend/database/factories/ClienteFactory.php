<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Broker;
use App\Models\User;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Cliente>
 */
class ClienteFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $documentTypes = ['CC', 'CE', 'NIT', 'TI', 'PP'];
        $genders = ['M', 'F'];
        $maritalStatuses = ['soltero', 'casado', 'divorciado', 'viudo', 'union_libre'];
        $priorities = ['low', 'medium', 'high'];
        $statuses = ['active', 'inactive', 'prospect', 'blocked'];
        $sources = ['Referido', 'Web', 'Redes Sociales', 'Llamada en frío', 'Email', 'Evento', 'Otros'];

        // Obtener un broker random o crear uno si no existe
        $broker = Broker::inRandomOrder()->first();
        if (!$broker) {
            $broker = Broker::factory()->create();
        }

        // Obtener un usuario random del broker o crear uno si no existe
        $user = User::where('broker_id', $broker->id)->inRandomOrder()->first();
        if (!$user) {
            $user = User::factory()->create(['broker_id' => $broker->id]);
        }

        return [
            // Aislamiento por broker
            'broker_id' => $broker->id,
            
            // Información personal
            'first_name' => $this->faker->firstName(),
            'last_name' => $this->faker->lastName() . ' ' . $this->faker->lastName(),
            'document_type' => $this->faker->randomElement($documentTypes),
            'document_number' => $this->faker->unique()->numerify('##########'),
            'email' => $this->faker->optional(0.8)->email(),
            'phone' => $this->faker->optional(0.6)->numerify('(###) ###-####'),
            'mobile_phone' => $this->faker->optional(0.9)->numerify('3## ### ####'),
            'birth_date' => $this->faker->optional(0.7)->dateTimeBetween('-80 years', '-18 years'),
            'gender' => $this->faker->optional(0.7)->randomElement($genders),
            'marital_status' => $this->faker->optional(0.6)->randomElement($maritalStatuses),
            
            // Información de contacto
            'address' => $this->faker->optional(0.8)->address(),
            'city' => $this->faker->optional(0.8)->city(),
            'state' => $this->faker->optional(0.7)->state(),
            'country' => 'Colombia',
            'postal_code' => $this->faker->optional(0.5)->numerify('#####'),
            
            // Información laboral
            'occupation' => $this->faker->optional(0.7)->jobTitle(),
            'company' => $this->faker->optional(0.6)->company(),
            'monthly_income' => $this->faker->optional(0.6)->randomFloat(2, 1000000, 10000000),
            'work_address' => $this->faker->optional(0.4)->address(),
            
            // Información de emergencia
            'emergency_contact_name' => $this->faker->optional(0.6)->name(),
            'emergency_contact_phone' => $this->faker->optional(0.6)->phoneNumber(),
            'emergency_contact_relationship' => $this->faker->optional(0.6)->randomElement(['Cónyuge', 'Hijo/a', 'Padre/Madre', 'Hermano/a', 'Amigo/a', 'Otro']),
            
            // Gestión y seguimiento
            'assigned_user_id' => $user->id,
            'status' => $this->faker->randomElement($statuses),
            'priority' => $this->faker->randomElement($priorities),
            'notes' => $this->faker->optional(0.4)->paragraph(),
            'tags' => $this->faker->optional(0.5)->passthrough([
                $this->faker->randomElement(['VIP', 'Referido', 'Potencial', 'Nuevo', 'Renovación'])
            ]),
            'custom_fields' => $this->faker->optional(0.3)->passthrough([
                'preferencia_contacto' => $this->faker->randomElement(['Email', 'Teléfono', 'WhatsApp']),
                'horario_contacto' => $this->faker->randomElement(['Mañana', 'Tarde', 'Noche'])
            ]),
            
            // Información comercial
            'source' => $this->faker->optional(0.7)->randomElement($sources),
            'total_policies_value' => 0,
            'total_policies_count' => 0,
            'last_contact_at' => $this->faker->optional(0.5)->dateTimeBetween('-6 months', 'now'),
            'next_follow_up_at' => $this->faker->optional(0.3)->dateTimeBetween('now', '+3 months'),
            
            // Auditoria
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ];
    }

    /**
     * Indicate that the cliente is active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
        ]);
    }

    /**
     * Indicate that the cliente is a prospect.
     */
    public function prospect(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'prospect',
        ]);
    }

    /**
     * Indicate that the cliente has high priority.
     */
    public function highPriority(): static
    {
        return $this->state(fn (array $attributes) => [
            'priority' => 'high',
        ]);
    }

    /**
     * Set specific broker for the cliente.
     */
    public function forBroker($brokerId): static
    {
        return $this->state(fn (array $attributes) => [
            'broker_id' => $brokerId,
        ]);
    }
}
