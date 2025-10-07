<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

/**
 * Kernel de consola para programar tareas recurrentes
 *
 * Programa la ejecución automática de campañas de WhatsApp marcadas como "scheduled".
 * Requiere Cron apuntando a "php artisan schedule:run" cada minuto.
 *
 * Ver comando: [RunScheduledCampaigns](backend/app/Console/Commands/RunScheduledCampaigns.php)
 */
class Kernel extends ConsoleKernel
{
    /**
     * Define el schedule de Artisan.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Programación gestionada desde routes/console.php para evitar duplicidades
        // Ver definición activa en: routes/console.php (Schedule::command('campaigns:run-scheduled ...'))
    }

    /**
     * Registrar los comandos para Artisan.
     */
    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');

        require base_path('routes/console.php');
    }
}