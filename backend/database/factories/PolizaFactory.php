<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\User;
use App\Models\Broker;
use App\Models\Cliente;
use Carbon\Carbon;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Poliza>
 */
class PolizaFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $aseguradoras = [
            'Seguros Sura', 'Mapfre', 'Bolívar Seguros', 'La Previsora', 
            'AXA Colpatria', 'Allianz', 'Liberty Seguros', 'Solidaria', 
            'La Equidad', 'Mundial'
        ];

        $tipos = ['vida', 'autos', 'hogar', 'empresarial', 'salud', 'accidentes', 'responsabilidad_civil', 'otros'];
        $productos = [
            'Seguro de Vida Temporal', 'Automóvil Todo Riesgo', 'Hogar Integral', 
            'Salud Familiar', 'Empresarial Integral', 'SOAT', 'Responsabilidad Civil',
            'Accidentes Personales', 'Incendio y Terremoto', 'Transporte de Mercancías'
        ];

        $paymentFrequencies = ['monthly', 'quarterly', 'biannual', 'annual'];
        $paymentMethods = ['cash', 'transfer', 'check', 'card', 'financing'];
        $statuses = ['active', 'inactive', 'expired', 'cancelled', 'suspended', 'pending'];

        $issueDate = $this->faker->dateTimeBetween('-2 years', 'now');
        $startDate = Carbon::parse($issueDate)->addDays($this->faker->numberBetween(0, 30));
        $endDate = Carbon::parse($startDate)->addYear();

        $premiumAmount = $this->faker->randomFloat(2, 100000, 5000000);
        $insuredAmount = $premiumAmount * $this->faker->numberBetween(10, 100);
        $commissionPercentage = $this->faker->randomFloat(2, 5, 25);
        $commissionAmount = ($premiumAmount * $commissionPercentage) / 100;

        // Obtener un broker random o crear uno si no existe
        $broker = Broker::inRandomOrder()->first();
        if (!$broker) {
            $broker = Broker::factory()->create();
        }

        // Obtener un cliente random o crear uno si no existe
        $cliente = Cliente::inRandomOrder()->first();
        if (!$cliente) {
            $cliente = Cliente::factory()->create(['broker_id' => $broker->id]);
        }

        // Obtener un usuario random del broker o crear uno si no existe
        $user = User::where('broker_id', $broker->id)->inRandomOrder()->first();
        if (!$user) {
            $user = User::factory()->create(['broker_id' => $broker->id]);
        }

        return [
            // Aislamiento por broker
            'broker_id' => $broker->id,
            
            // Información básica de la póliza
            'policy_number' => 'POL-' . $this->faker->year() . '-' . $this->faker->unique()->numberBetween(100000, 999999),
            'internal_number' => $this->faker->optional()->numerify('INT-#####'),
            'type' => $this->faker->randomElement($tipos),
            'product_name' => $this->faker->randomElement($productos),
            'insurance_company' => $this->faker->randomElement($aseguradoras),
            'description' => $this->faker->optional()->sentence(),
            
            // Información del cliente
            'client_id' => $cliente->id,
            'client_name' => $cliente->first_name . ' ' . $cliente->last_name,
            'client_document' => $cliente->document_number,
            
            // Fechas importantes
            'issue_date' => $issueDate,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'payment_due_date' => $this->faker->optional()->dateTimeBetween($startDate, $endDate),
            'renewal_date' => $this->faker->optional()->dateTimeBetween($endDate, Carbon::parse($endDate)->addMonths(6)),
            
            // Información financiera
            'premium_amount' => $premiumAmount,
            'insured_amount' => $insuredAmount,
            'deductible' => $this->faker->optional()->randomFloat(2, 50000, 500000),
            'commission_percentage' => $commissionPercentage,
            'commission_amount' => $commissionAmount,
            'payment_frequency' => $this->faker->randomElement($paymentFrequencies),
            'payment_method' => $this->faker->randomElement($paymentMethods),
            
            // Estados
            'status' => $this->faker->randomElement($statuses),
            'payment_status' => $this->faker->randomElement(['paid', 'pending', 'overdue', 'cancelled']),
            'status_notes' => $this->faker->optional()->sentence(),
            
            // Información del beneficiario
            'beneficiary_name' => $this->faker->optional()->name(),
            'beneficiary_document' => $this->faker->optional()->numerify('##########'),
            'beneficiary_relationship' => $this->faker->optional()->randomElement(['Cónyuge', 'Hijo/a', 'Padre/Madre', 'Hermano/a', 'Otro']),
            'beneficiary_phone' => $this->faker->optional()->phoneNumber(),
            
            // Gestión y seguimiento
            'assigned_user_id' => $user->id,
            'created_by' => $user->id,
            'notes' => $this->faker->optional()->paragraph(),
            'custom_fields' => $this->faker->optional()->passthrough([
                'campo_personalizado_1' => $this->faker->word(),
                'campo_personalizado_2' => $this->faker->numberBetween(1, 100)
            ]),
            'documents' => $this->faker->optional()->passthrough([
                'cedula.pdf',
                'poliza_firmada.pdf'
            ]),
            
            // Renovación automática
            'auto_renewal' => $this->faker->boolean(30), // 30% de probabilidad
            'renewal_days_notice' => $this->faker->numberBetween(15, 60),
            'last_renewal_notice_sent' => null,
            
            // Auditoria
            'updated_by' => $user->id,
            'cancelled_at' => null,
            'cancelled_by' => null,
            'cancellation_reason' => null,
        ];
    }

    /**
     * Indicate that the poliza is active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
            'end_date' => $this->faker->dateTimeBetween('+1 month', '+2 years'),
        ]);
    }

    /**
     * Indicate that the poliza is expired.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'expired',
            'end_date' => $this->faker->dateTimeBetween('-1 year', '-1 day'),
        ]);
    }

    /**
     * Indicate that the poliza is about to expire.
     */
    public function expiringSoon(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
            'end_date' => $this->faker->dateTimeBetween('+1 day', '+30 days'),
        ]);
    }

    /**
     * Indicate that the poliza is from a specific insurance company.
     */
    public function insuranceCompany(string $company): static
    {
        return $this->state(fn (array $attributes) => [
            'insurance_company' => $company,
        ]);
    }

    /**
     * Indicate that the poliza is from a specific type.
     */
    public function type(string $type): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => $type,
        ]);
    }
}
