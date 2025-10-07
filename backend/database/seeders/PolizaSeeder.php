<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Poliza;
use App\Models\User;
use App\Models\Broker;
use App\Models\Cliente;

class PolizaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Asegurar que exista al menos un broker
        $broker = Broker::first();
        if (!$broker) {
            $this->command->warn('No hay brokers en la base de datos. Creando broker de prueba...');
            $broker = Broker::factory()->create([
                'name' => 'Broker de Prueba',
                'is_active' => true,
            ]);
        }

        // Asegurar que exista al menos un usuario para el broker
        $user = User::where('broker_id', $broker->id)->first();
        if (!$user) {
            $this->command->warn('No hay usuarios para este broker. Creando usuario de prueba...');
            $user = User::factory()->create([
                'name' => 'Usuario Prueba',
                'email' => 'prueba@ejemplo.com',
                'broker_id' => $broker->id,
            ]);
        }

        // Asegurar que existan clientes
        $clientesCount = Cliente::where('broker_id', $broker->id)->count();
        if ($clientesCount < 10) {
            $this->command->info('Creando clientes adicionales...');
            Cliente::factory()->count(15 - $clientesCount)->create(['broker_id' => $broker->id]);
        }

        $this->command->info('Creando pólizas de prueba...');

        // Crear 20 pólizas activas
        Poliza::factory()
            ->count(20)
            ->active()
            ->create();

        // Crear 8 pólizas vencidas
        Poliza::factory()
            ->count(8)
            ->expired()
            ->create();

        // Crear 12 pólizas por vencer (próximas a vencer)
        Poliza::factory()
            ->count(12)
            ->expiringSoon()
            ->create();

        // Crear 5 pólizas canceladas
        Poliza::factory()
            ->count(5)
            ->create(['status' => 'cancelled']);

        // Crear algunas pólizas específicas por aseguradora
        Poliza::factory()
            ->count(3)
            ->active()
            ->insuranceCompany('Seguros Sura')
            ->create();

        Poliza::factory()
            ->count(3)
            ->active()
            ->insuranceCompany('Mapfre')
            ->create();

        // Crear algunas pólizas específicas por tipo
        Poliza::factory()
            ->count(4)
            ->active()
            ->type('autos')
            ->create();

        Poliza::factory()
            ->count(3)
            ->active()
            ->type('vida')
            ->create();

        $this->command->info('✅ Pólizas de prueba creadas exitosamente!');
        
        // Mostrar estadísticas
        $this->command->table(
            ['Estado', 'Cantidad'],
            [
                ['Activas', Poliza::where('status', 'active')->count()],
                ['Vencidas', Poliza::where('status', 'expired')->count()],
                ['Por vencer', Poliza::where('status', 'active')->whereDate('end_date', '<=', now()->addDays(30))->count()],
                ['Canceladas', Poliza::where('status', 'cancelled')->count()],
                ['Pendientes', Poliza::where('status', 'pending')->count()],
                ['Total', Poliza::count()],
            ]
        );

        $this->command->info('Estadísticas por tipo:');
        $this->command->table(
            ['Tipo', 'Cantidad'],
            Poliza::select('type', \DB::raw('count(*) as total'))
                ->groupBy('type')
                ->get()
                ->map(function($item) {
                    return [$item->type, $item->total];
                })
                ->toArray()
        );
    }
}
