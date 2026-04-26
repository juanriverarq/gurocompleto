<?php

namespace App\Console\Commands;

use App\Models\Broker;
use App\Models\Poliza;
use App\Models\PagoPoliza;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Elimina todas las pólizas de un broker específico (filtrado por email).
 *
 * Uso:
 *   php artisan polizas:purge-broker seguroscelesteoriente@gmail.com
 *   php artisan polizas:purge-broker seguroscelesteoriente@gmail.com --force   # hard delete
 */
class PurgeBrokerPolizas extends Command
{
    protected $signature = 'polizas:purge-broker
                            {email : Email del broker o del usuario owner del broker}
                            {--force : Hard delete (irreversible). Por defecto hace soft delete}';

    protected $description = 'Elimina todas las pólizas de un broker específico (filtrado por email)';

    public function handle(): int
    {
        $email = trim($this->argument('email'));
        $force = (bool) $this->option('force');

        // 1) Buscar broker por email directo
        $brokers = Broker::where('email', $email)->get();

        // 2) Si no hay por email del broker, buscar por user owner
        if ($brokers->isEmpty()) {
            $user = User::where('email', $email)->first();
            if ($user) {
                $brokers = Broker::where('owner_id', $user->id)->get();
            }
        }

        if ($brokers->isEmpty()) {
            $this->error("No se encontró ningún broker asociado al email: {$email}");
            return self::FAILURE;
        }

        $this->info("Brokers encontrados para {$email}:");
        foreach ($brokers as $b) {
            $this->line("  - ID {$b->id} · {$b->name} · email broker: {$b->email}");
        }

        $brokerIds = $brokers->pluck('id')->all();

        // Contar pólizas (incluyendo ya soft-deleted si es hard)
        $query = $force
            ? Poliza::withTrashed()->whereIn('broker_id', $brokerIds)
            : Poliza::whereIn('broker_id', $brokerIds);

        $count = (clone $query)->count();

        if ($count === 0) {
            $this->warn('No hay pólizas para eliminar.');
            return self::SUCCESS;
        }

        $mode = $force ? 'HARD DELETE (irreversible)' : 'soft delete (reversible)';
        $this->warn("Se eliminarán {$count} pólizas en modo: {$mode}");

        if (! $this->confirm('¿Confirmas la eliminación?', false)) {
            $this->info('Cancelado.');
            return self::SUCCESS;
        }

        DB::beginTransaction();
        try {
            if ($force) {
                // Hard delete: limpiamos dependientes primero
                $polizaIds = (clone $query)->pluck('id');

                // Dependencias con FK — ajustar si hay más tablas:
                PagoPoliza::whereIn('poliza_id', $polizaIds)->withTrashed()->forceDelete();
                // poliza_coverages tiene cascadeOnDelete, pero lo limpiamos explícito por si acaso
                DB::table('poliza_coverages')->whereIn('poliza_id', $polizaIds)->delete();
                DB::table('poliza_vinculados')->whereIn('poliza_id', $polizaIds)->delete();
                DB::table('comisiones_manuales_polizas')->whereIn('poliza_id', $polizaIds)->delete();

                // Force delete polizas
                (clone $query)->forceDelete();
            } else {
                // Soft delete — Eloquent respeta SoftDeletes
                (clone $query)->delete();
            }

            DB::commit();
            $this->info("✓ {$count} pólizas eliminadas para broker(s): " . implode(', ', $brokerIds));
            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Error al eliminar: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
