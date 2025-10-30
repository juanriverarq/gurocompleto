<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\CommercialTask;

class CleanOrphanedCommercialTasks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'commercial-tasks:clean-orphaned';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Limpia referencias huérfanas en commercial_tasks (clientes, pólizas y usuarios eliminados)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Limpiando referencias huérfanas en commercial_tasks...');
        
        // Limpiar clientes eliminados
        $clientsCount = CommercialTask::whereNotNull('client_id')
            ->whereDoesntHave('client')
            ->count();
            
        if ($clientsCount > 0) {
            CommercialTask::whereNotNull('client_id')
                ->whereDoesntHave('client')
                ->update(['client_id' => null]);
            $this->info("✓ {$clientsCount} seguimientos con clientes eliminados limpiados");
        }
        
        // Limpiar pólizas eliminadas
        $polizasCount = CommercialTask::whereNotNull('poliza_id')
            ->whereDoesntHave('poliza')
            ->count();
            
        if ($polizasCount > 0) {
            CommercialTask::whereNotNull('poliza_id')
                ->whereDoesntHave('poliza')
                ->update(['poliza_id' => null]);
            $this->info("✓ {$polizasCount} seguimientos con pólizas eliminadas limpiados");
        }
        
        // Limpiar usuarios asignados eliminados
        $usersCount = CommercialTask::whereNotNull('assigned_to')
            ->whereDoesntHave('assignedUser')
            ->count();
            
        if ($usersCount > 0) {
            CommercialTask::whereNotNull('assigned_to')
                ->whereDoesntHave('assignedUser')
                ->update(['assigned_to' => null]);
            $this->info("✓ {$usersCount} seguimientos con usuarios eliminados limpiados");
        }
        
        if ($clientsCount === 0 && $polizasCount === 0 && $usersCount === 0) {
            $this->info('✓ No se encontraron referencias huérfanas');
        }
        
        $this->info('Limpieza completada exitosamente');
        
        return 0;
    }
}