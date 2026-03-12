<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\Poliza;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('caratulas:assign {--csv=} {--origen=} {--destino=} {--dry-run} {--limit=}', function () {
    $csvPath = $this->option('csv') ?: base_path('caratulas.csv');
    $origen = $this->option('origen') ?: '/Users/mac/Downloads/caratulas';
    $destinoBase = $this->option('destino') ?: $origen;
    $dryRun = (bool)$this->option('dry-run');
    $limit = $this->option('limit') ? (int)$this->option('limit') : null;

    $this->info("CSV: {$csvPath}");
    $this->info("Origen: {$origen}");
    $this->info("Destino base: {$destinoBase}");
    $this->info($dryRun ? 'Modo: DRY-RUN (no se moverán archivos)' : 'Modo: REAL (se moverán archivos)');
    if ($limit) { $this->info("Límite: {$limit} filas"); }

    if (!is_file($csvPath)) {
        $this->error("No se encontró el CSV en: {$csvPath}");
        return 1;
    }
    if (!is_dir($origen)) {
        $this->error("Carpeta de origen no existe: {$origen}");
        return 1;
    }

    // Normalizar números de póliza (solo dígitos, sin ceros a la izquierda)
    $normalize = function ($s) {
        return ltrim(preg_replace('/[^0-9]/', '', $s), '0') ?: '0';
    };

    // Indexar pólizas por número normalizado
    $this->info('Indexando pólizas...');
    $polizas = [];
    $duplicados = [];
    Poliza::withoutBrokerScope()->select('id', 'policy_number')->chunk(2000, function($chunk) use (&$polizas, &$duplicados, $normalize) {
        foreach ($chunk as $p) {
            $key = $normalize($p->policy_number);
            if (isset($polizas[$key])) {
                $duplicados[$key] = true;
            } else {
                $polizas[$key] = $p->id;
            }
        }
    });
    $this->info(sprintf("Pólizas indexadas: %d, Números duplicados: %d", count($polizas), count($duplicados)));

    // Procesar CSV
    $handle = fopen($csvPath, 'r');
    if (!$handle) {
        $this->error('No se pudo abrir el archivo CSV');
        return 1;
    }

    // Leer encabezados
    $headers = fgetcsv($handle);
    if (!$headers) {
        $this->error('El archivo CSV está vacío o es inválido');
        fclose($handle);
        return 1;
    }

    // Mapear índices de columnas
    $headerMap = [];
    foreach ($headers as $i => $h) {
        $headerMap[strtolower(trim($h))] = $i;
    }
    foreach (['number_policies', 'file_caratula'] as $req) {
        if (!isset($headerMap[$req])) {
            $this->error("Falta la columna requerida en el CSV: {$req}");
            fclose($handle);
            return 1;
        }
    }

    $procesados = 0;
    $movidos = 0;
    $sinMatch = 0;
    $sinArchivo = 0;
    $duplicado = 0;

    $this->info('Procesando filas del CSV...');
    while (($row = fgetcsv($handle)) !== false) {
        if ($limit !== null && $procesados >= $limit) break;
        $procesados++;

        $policyNumber = $row[$headerMap['number_policies']] ?? '';
        $fileName = $row[$headerMap['file_caratula']] ?? '';
        $key = $normalize($policyNumber);

        // Verificar si hay match
        if (!isset($polizas[$key])) {
            $this->warn("[{$procesados}] Sin match para póliza: {$policyNumber} (normalizado: {$key})");
            $sinMatch++;
            continue;
        }

        // Verificar si está duplicado
        if (isset($duplicados[$key])) {
            $this->warn("[{$procesados}] Número duplicado en DB: {$policyNumber} (ID: {$polizas[$key]})");
            $duplicado++;
            continue;
        }

        $polizaId = $polizas[$key];
        $sourceFile = rtrim($origen, '/') . '/' . $fileName;
        $destDir = rtrim($destinoBase, '/') . '/' . $polizaId;
        $destFile = $destDir . '/' . basename($fileName);

        // Verificar si existe el archivo fuente
        if (!file_exists($sourceFile)) {
            $this->warn("[{$procesados}] Archivo no encontrado: {$sourceFile}");
            $sinArchivo++;
            continue;
        }

        if ($dryRun) {
            $this->line("[DRY-RUN] Mover: {$sourceFile} -> {$destFile} (ID: {$polizaId})");
            $movidos++;
        } else {
            // Crear directorio de destino si no existe
            if (!is_dir($destDir)) {
                if (!mkdir($destDir, 0755, true)) {
                    $this->error("No se pudo crear el directorio: {$destDir}");
                    continue;
                }
            }

            // Mover archivo
            if (rename($sourceFile, $destFile)) {
                $this->info("[OK] Movido: {$destFile} (ID: {$polizaId})");
                $movidos++;
            } else {
                $this->error("Error al mover: {$sourceFile}");
            }
        }
    }
    fclose($handle);

    // Mostrar resumen
    $this->newLine();
    $this->info('Resumen:');
    $this->line("- Filas procesadas: {$procesados}");
    $this->line("- Archivos movidos: {$movidos}");
    $this->line("- Sin match en DB: {$sinMatch}");
    $this->line("- Archivos no encontrados: {$sinArchivo}");
    $this->line("- Números duplicados: {$duplicado}");

    return 0;
})->purpose('Asigna archivos de carátulas a pólizas según el CSV');

/**
 * ========== Programación de tareas (Scheduler) ==========
 * Ejecuta campañas de WhatsApp programadas cada minuto.
 * Ver comando: campaigns:run-scheduled
 */
Schedule::command('campaigns:run-scheduled --limit=20')
    ->everyMinute()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/schedule.log'));

/**
 * Ejecuta notificaciones de pólizas programadas cada minuto.
 * Verifica la hora configurada y los días de envío antes de ejecutar.
 * Ver comando: policy:send-notifications
 */
Schedule::command('policy:send-notifications')
    ->everyMinute()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/policy-notifications.log'));

/**
 * Sincroniza estadísticas de campañas de email desde SendGrid cada 5 minutos.
 * Actualiza métricas de aperturas, clics, entregas, rebotes para campañas activas.
 * Ver comando: sendgrid:sync-stats
 */
Schedule::command('sendgrid:sync-stats')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/sendgrid-sync.log'));

/**
 * Procesa triggers de vencimiento de pólizas para campañas de voz automáticas.
 * Revisa pólizas próximas a vencer y dispara llamadas según configuración de triggers.
 * Ver comando: voice-campaigns:process-policy-expiry
 */
Schedule::command('voice-campaigns:process-policy-expiry --days-range=60')
    ->dailyAt('06:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/voice-campaign-triggers.log'));

/**
 * Ejecuta llamadas programadas de campañas de voz automáticamente.
 * Procesa en lotes de máximo 20 llamadas simultáneas.
 * Solo ejecuta dentro de horario permitido (8am-8pm Colombia).
 * Ver comando: voice:execute-scheduled-calls
 */
Schedule::command('voice:execute-scheduled-calls --batch-size=20')
    ->everyMinute()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/voice-scheduled-calls.log'));

/**
 * Procesa suscripciones y cobros recurrentes diariamente.
 * - Verifica trials expirados y cambia su estado
 * - Notifica suscripciones próximas a vencer (5, 3, 1 días)
 * - Procesa suscripciones vencidas
 * - Genera cobros recurrentes para renovaciones
 * Ver comando: billing:process-subscriptions
 */
Schedule::command('billing:process-subscriptions')
    ->dailyAt('00:30')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/subscription-billing.log'));

/**
 * Verifica conversaciones inactivas y envía recordatorios automáticos.
 * - Cliente inactivo: si no responde en X minutos (máx 23h ventana WhatsApp)
 * - Agente inactivo: si fue asignado y no ha contestado en X minutos
 * Ver comando: chatbot:check-inactivity
 */
Schedule::command('chatbot:check-inactivity')
    ->everyMinute()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/chatbot-inactivity.log'));

/**
 * Envía notificaciones de clientes (cumpleaños, días especiales) cada minuto.
 * Verifica hora programada internamente antes de ejecutar.
 * Ver comando: client:send-notifications
 */
Schedule::command('client:send-notifications')
    ->everyMinute()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/client-notifications.log'));
