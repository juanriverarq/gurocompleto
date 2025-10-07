<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Broker>
 */
class BrokerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $companyTypes = ['Correduría', 'Agencia', 'Empresa Asesora'];
        $subscriptionStatuses = ['trial', 'active', 'suspended', 'cancelled'];

        return [
            'name' => $this->faker->company() . ' Seguros',
            'code' => $this->faker->unique()->regexify('[A-Z]{3}[0-9]{3}'),
            'nit' => $this->faker->unique()->numerify('###########'),
            'email' => $this->faker->companyEmail(),
            'phone' => $this->faker->phoneNumber(),
            'address' => $this->faker->address(),
            'city' => $this->faker->city(),
            'country' => 'Colombia',
            'website' => $this->faker->optional(0.6)->url(),
            'logo' => null,
            'company_type' => $this->faker->randomElement($companyTypes),
            'license_number' => $this->faker->optional(0.8)->numerify('LIC-#######'),
            'license_expiry' => $this->faker->optional(0.8)->dateTimeBetween('now', '+2 years'),
            'contact_person' => $this->faker->name(),
            'contact_email' => $this->faker->email(),
            'contact_phone' => $this->faker->phoneNumber(),
            'is_active' => $this->faker->boolean(90), // 90% activos
            'max_users' => $this->faker->numberBetween(5, 50),
            'max_policies' => $this->faker->numberBetween(1000, 10000),
            'storage_limit_gb' => $this->faker->numberBetween(10, 500),
            'trial_ends_at' => $this->faker->optional(0.3)->dateTimeBetween('now', '+30 days'),
            'subscription_status' => $this->faker->randomElement($subscriptionStatuses),
            'subscription_plan' => $this->faker->randomElement(['básico', 'profesional', 'empresarial']),
            'billing_email' => $this->faker->email(),
            'billing_address' => $this->faker->address(),
            'tax_id' => $this->faker->numerify('###########'),
            'settings' => [
                'timezone' => 'America/Bogota',
                'currency' => 'COP',
                'language' => 'es',
                'notifications' => [
                    'email_enabled' => true,
                    'sms_enabled' => false,
                    'push_enabled' => true
                ]
            ],
            'features' => [
                'advanced_reporting' => $this->faker->boolean(70),
                'api_access' => $this->faker->boolean(50),
                'white_label' => $this->faker->boolean(30),
                'multiple_currencies' => $this->faker->boolean(40)
            ],
            'last_activity_at' => $this->faker->optional(0.8)->dateTimeBetween('-1 month', 'now'),
        ];
    }

    /**
     * Indicate that the broker is active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => true,
            'subscription_status' => 'active',
        ]);
    }

    /**
     * Indicate that the broker is on trial.
     */
    public function trial(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => true,
            'subscription_status' => 'trial',
            'trial_ends_at' => now()->addDays(30),
        ]);
    }

    /**
     * Indicate that the broker is suspended.
     */
    public function suspended(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
            'subscription_status' => 'suspended',
        ]);
    }
}
