<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Poliza;
use App\Models\Cliente;
use Carbon\Carbon;

class TestPolizaJuanRiveraSeeder extends Seeder
{
    /**
     * Crear póliza de prueba para Juan Rivera (documento 1223231414)
     * para probar campañas de recordatorio de pago.
     */
    public function run(): void
    {
        // Buscar el cliente Juan Rivera por documento
        $cliente = Cliente::where('document_number', '1223231414')->first();

        if (!$cliente) {
            $this->command->error('❌ No se encontró el cliente con documento 1223231414');
            return;
        }

        $this->command->info("✅ Cliente encontrado: {$cliente->first_name} {$cliente->last_name}");
        $this->command->info("   ID: {$cliente->id}");
        $this->command->info("   Teléfono: {$cliente->mobile_phone}");
        $this->command->info("   Broker ID: {$cliente->broker_id}");

        // Crear póliza de prueba con pago pendiente
        $poliza = Poliza::create([
            'broker_id' => $cliente->broker_id,
            'policy_number' => 'POL-TEST-' . date('Ymd') . '-001',
            'internal_number' => 'INT-' . date('Ymd') . '-001',
            'type' => 'autos',
            'product_name' => 'Seguro Todo Riesgo Automóvil',
            'insurance_company' => 'Seguros Sura',
            'description' => 'Póliza de prueba para campaña de recordatorio de pago',
            'client_id' => $cliente->id,
            'client_name' => trim("{$cliente->first_name} {$cliente->last_name}"),
            'client_document' => '1223231414',
            'policy_holder_name' => trim("{$cliente->first_name} {$cliente->last_name}"),
            'policy_holder_document' => '1223231414',
            'insured_name' => trim("{$cliente->first_name} {$cliente->last_name}"),
            'insured_document' => '1223231414',
            'issue_date' => Carbon::now()->subMonths(11),
            'reception_date' => Carbon::now()->subMonths(11),
            'start_date' => Carbon::now()->subMonths(11),
            'end_date' => Carbon::now()->addMonth(), // Vence en 1 mes
            'payment_due_date' => Carbon::now()->subDays(5), // Pago vencido hace 5 días
            'renewal_date' => Carbon::now()->addMonth(),
            'premium_amount' => 280000.00,
            'insured_amount' => 45000000.00,
            'deductible' => 500000.00,
            'commission_percentage' => 15.00,
            'commission_amount' => 42000.00,
            'commission_status' => 'pendiente',
            'vat_percentage' => 19.00,
            'vat_amount' => 53200.00,
            'total_amount' => 333200.00,
            'payment_frequency' => 'annual',
            'payment_method' => 'transfer',
            'status' => 'active',
            'payment_status' => 'overdue', // Pago vencido
            'status_notes' => 'Póliza de prueba para campaña de cobranza',
            'vehicle_plates' => json_encode(['ABC123']),
            'auto_renewal' => true,
            'renewal_days_notice' => 30,
            'notes' => 'Póliza creada para pruebas de campaña de recordatorio de pago. Cliente: Juan Rivera.',
            'custom_fields' => json_encode([
                'placa' => 'ABC123',
                'marca' => 'Mazda',
                'modelo' => 'CX-5',
                'año' => 2022,
                'color' => 'Gris',
                'uso' => 'Particular'
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->command->info('');
        $this->command->info('🎉 Póliza de prueba creada exitosamente!');
        $this->command->info('');
        $this->command->table(
            ['Campo', 'Valor'],
            [
                ['ID Póliza', $poliza->id],
                ['Número', $poliza->policy_number],
                ['Cliente', $poliza->client_name],
                ['Documento', $poliza->client_document],
                ['Tipo', $poliza->type],
                ['Producto', $poliza->product_name],
                ['Aseguradora', $poliza->insurance_company],
                ['Placa', 'ABC123'],
                ['Monto Pendiente', '$' . number_format($poliza->premium_amount, 0, ',', '.')],
                ['Fecha Vencimiento Pago', $poliza->payment_due_date->format('Y-m-d')],
                ['Estado Pago', $poliza->payment_status],
                ['Estado Póliza', $poliza->status],
            ]
        );

        $this->command->info('');
        $this->command->info('📞 Datos para la campaña de llamadas:');
        $this->command->info("   - customer_name: {$poliza->client_name}");
        $this->command->info("   - policy_number: {$poliza->policy_number}");
        $this->command->info("   - plate_number: ABC123");
        $this->command->info("   - debt_amount: $280,000");
        $this->command->info("   - payment_due_date: {$poliza->payment_due_date->format('d/m/Y')}");
        $this->command->info("   - phone: {$cliente->mobile_phone}");
    }
}
