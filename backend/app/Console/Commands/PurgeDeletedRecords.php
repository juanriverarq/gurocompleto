<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\Vendedor;
use App\Models\Aseguradora;
use App\Models\Ramo;

class PurgeDeletedRecords extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'imports:purge 
                            {--broker= : ID del broker (requerido)}
                            {--entity= : Entidad específica (clientes, polizas, vendedores, aseguradoras, ramos) o "all"}
                            {--force : Eliminar permanentemente sin confirmación}
                            {--include-active : También eliminar registros activos (PELIGROSO)}';

    /**
     * The console command description.
     */
    protected $description = 'Eliminar permanentemente registros soft-deleted de un broker';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $brokerId = $this->option('broker');
        $entity = $this->option('entity') ?? 'all';
        $force = $this->option('force');
        $includeActive = $this->option('include-active');

        if (!$brokerId) {
            $this->error('Debes especificar el broker con --broker=ID');
            return 1;
        }

        $entities = [
            'clientes' => Cliente::class,
            'polizas' => Poliza::class,
            'vendedores' => Vendedor::class,
            'aseguradoras' => Aseguradora::class,
            'ramos' => Ramo::class,
        ];

        if ($entity !== 'all' && !isset($entities[$entity])) {
            $this->error("Entidad no válida: {$entity}. Opciones: " . implode(', ', array_keys($entities)) . ", all");
            return 1;
        }

        $toProcess = $entity === 'all' ? $entities : [$entity => $entities[$entity]];

        // Mostrar resumen
        $this->info("=== Resumen de registros para broker_id={$brokerId} ===");
        $this->newLine();

        $summary = [];
        foreach ($toProcess as $name => $modelClass) {
            // Verificar si el modelo usa SoftDeletes
            $usesSoftDeletes = in_array(\Illuminate\Database\Eloquent\SoftDeletes::class, class_uses_recursive($modelClass));
            
            if ($usesSoftDeletes) {
                $softDeleted = $modelClass::onlyTrashed()->where('broker_id', $brokerId)->count();
                $active = $modelClass::where('broker_id', $brokerId)->count();
            } else {
                $softDeleted = 0;
                $active = $modelClass::where('broker_id', $brokerId)->count();
            }
            
            $summary[$name] = [
                'soft_deleted' => $softDeleted,
                'active' => $active,
                'uses_soft_deletes' => $usesSoftDeletes,
            ];
            
            if ($usesSoftDeletes) {
                $this->line("  {$name}: {$softDeleted} soft-deleted, {$active} activos");
            } else {
                $this->line("  {$name}: {$active} activos (no usa soft-delete)");
            }
        }

        $this->newLine();

        if ($includeActive) {
            $this->warn('⚠️  MODO PELIGROSO: Se eliminarán TODOS los registros (activos y eliminados)');
            $totalToDelete = array_sum(array_column($summary, 'soft_deleted')) + array_sum(array_column($summary, 'active'));
        } else {
            $this->info('Se eliminarán solo los registros soft-deleted (ya marcados como eliminados)');
            $totalToDelete = array_sum(array_column($summary, 'soft_deleted'));
        }

        if ($totalToDelete === 0) {
            $this->info('No hay registros para eliminar.');
            return 0;
        }

        $this->warn("Total a eliminar permanentemente: {$totalToDelete} registros");
        $this->newLine();

        if (!$force) {
            if (!$this->confirm('¿Estás seguro de que deseas eliminar permanentemente estos registros? Esta acción NO se puede deshacer.')) {
                $this->info('Operación cancelada.');
                return 0;
            }
        }

        // Ejecutar eliminación
        $this->info('Eliminando registros...');
        $this->newLine();

        $deleted = [];
        foreach ($toProcess as $name => $modelClass) {
            $usesSoftDeletes = $summary[$name]['uses_soft_deletes'] ?? false;
            
            if ($includeActive) {
                // Eliminar todos (activos + soft-deleted)
                if ($usesSoftDeletes) {
                    $count = $modelClass::withTrashed()->where('broker_id', $brokerId)->forceDelete();
                } else {
                    $count = $modelClass::where('broker_id', $brokerId)->delete();
                }
            } else {
                // Solo eliminar soft-deleted
                if ($usesSoftDeletes) {
                    $count = $modelClass::onlyTrashed()->where('broker_id', $brokerId)->forceDelete();
                } else {
                    $count = 0; // No hay soft-deleted si no usa SoftDeletes
                }
            }
            $deleted[$name] = $count;
            $this->line("  ✓ {$name}: {$count} registros eliminados permanentemente");
        }

        $this->newLine();
        $this->info('=== Eliminación completada ===');
        $this->info('Total eliminado: ' . array_sum($deleted) . ' registros');

        return 0;
    }
}
