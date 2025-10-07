<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Broker;
use App\Models\Cliente;
use App\Models\Poliza;
use Illuminate\Support\Str;

class SeedBrokerPolizas extends Command
{
    protected $signature = 'polizas:seed-broker {brokerId} {--count=5}';
    protected $description = 'Genera pólizas de prueba para un broker específico';

    public function handle(): int
    {
        $brokerId = (int) $this->argument('brokerId');
        $count = (int) $this->option('count');

        $broker = Broker::find($brokerId);
        if (!$broker) {
            $this->warn("Broker {$brokerId} no existe. Creándolo...");
            $broker = Broker::create([
                'id' => $brokerId,
                'name' => 'Broker ' . $brokerId,
                'legal_name' => 'Broker ' . $brokerId . ' S.A.S.',
                'document_type' => 'NIT',
                'document_number' => '900' . str_pad((string)$brokerId, 6, '0', STR_PAD_LEFT),
                'email' => 'broker' . $brokerId . '@test.com',
                'phone' => '3000000000',
                'address' => 'Calle Falsa 123',
                'city' => 'Bogotá',
                'state' => 'Cundinamarca',
                'country' => 'Colombia',
                'status' => 'active',
                'plan' => 'professional',
                'max_users' => 50,
                'max_clients' => 10000,
                'max_policies' => 100000,
            ]);
        }

        // Asegurar al menos un cliente
        $cliente = Cliente::where('broker_id', $broker->id)->first();
        if (!$cliente) {
            $cliente = Cliente::create([
                'broker_id' => $broker->id,
                'first_name' => 'Cliente',
                'last_name' => 'Demo',
                'document_number' => '100' . rand(100000, 999999),
                'email' => 'cliente.demo' . $broker->id . '@test.com',
                'phone' => '3100000000',
                'address' => 'Direccion Demo',
                'status' => 'active',
            ]);
        }

        $this->info("Generando {$count} pólizas para el broker {$broker->id} ({$broker->name})");

        $created = 0;
        for ($i = 0; $i < $count; $i++) {
            $num = 'POL-' . $broker->id . '-' . Str::upper(Str::random(6));
            // Evitar duplicados por índice único compuesto
            if (Poliza::where('broker_id', $broker->id)->where('policy_number', $num)->exists()) {
                $i--;
                continue;
            }

            Poliza::create([
                'broker_id' => $broker->id,
                'policy_number' => $num,
                'internal_number' => null,
                'type' => 'vida',
                'product_name' => 'Vida Individual',
                'insurance_company' => 'PruebaSeguros',
                'description' => 'Póliza de prueba generada por comando',
                'client_id' => $cliente->id,
                'client_name' => $cliente->first_name . ' ' . $cliente->last_name,
                'client_document' => $cliente->document_number,
                'issue_date' => now()->toDateString(),
                'start_date' => now()->toDateString(),
                'end_date' => now()->addYear()->toDateString(),
                'premium_amount' => rand(300000, 1500000),
                'insured_amount' => rand(50000000, 200000000),
                'commission_percentage' => 12.5,
                'commission_amount' => 0,
                'vat_percentage' => 19,
                'vat_amount' => 0,
                'total_amount' => 0,
                'payment_frequency' => 'annual',
                'payment_method' => 'transfer',
                'status' => 'active',
            ]);
            $created++;
        }

        $this->info("Pólizas creadas: {$created}");
        return self::SUCCESS;
    }
}


