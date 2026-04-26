<?php

namespace App\Console\Commands;

use App\Models\InsurerConnection;
use App\Services\MicroservicioInsurerService;
use Illuminate\Console\Command;

class InsurerConnectionsHealthcheck extends Command
{
    protected $signature = 'insurer-connections:healthcheck {--limit=200}';
    protected $description = 'Verifica y reconecta sesiones de aseguradoras en microservicio. Reconecta proactivamente antes de expirar.';

    /**
     * Minutos de buffer antes de que expire la sesión para reconectar proactivamente.
     * Si quedan menos de estos minutos, se reconecta sin esperar al healthcheck.
     */
    private const PROACTIVE_BUFFER = [
        'hdi'               => 15,
        'bolivar'           => 30,
        'axa-colpatria'     => 60,
        'seguros-del-estado' => 15,
        'sura'              => 0,  // no auto-reconnect (cookie-based)
    ];

    private const MAX_RECONNECT_FAILURES = 3;

    public function handle(MicroservicioInsurerService $microservice): int
    {
        $limit = (int) $this->option('limit');

        $rows = InsurerConnection::query()
            ->whereIn('status', ['connected', 'reconnect_required', 'error'])
            ->orderBy('last_healthcheck_at')
            ->limit($limit)
            ->get();

        if ($rows->isEmpty()) {
            $this->info('No hay conexiones para verificar.');
            return self::SUCCESS;
        }

        $ok = 0;
        $reconnected = 0;
        $failed = 0;

        foreach ($rows as $connection) {
            $result = $this->processConnection($connection, $microservice);
            match ($result) {
                'ok' => $ok++,
                'reconnected' => $reconnected++,
                'failed' => $failed++,
            };
        }

        $this->info("Healthcheck completado. OK: {$ok}, Reconectadas: {$reconnected}, Fallidas: {$failed}");
        return self::SUCCESS;
    }

    private function processConnection(InsurerConnection $connection, MicroservicioInsurerService $microservice): string
    {
        $connection->last_healthcheck_at = now();

        // ── Reconexión proactiva: si está cerca de expirar, reconecta sin esperar fallo ──
        $buffer = self::PROACTIVE_BUFFER[$connection->insurer_code] ?? 15;
        $nearExpiry = $connection->expires_at && $connection->expires_at->subMinutes($buffer)->isPast();

        if ($nearExpiry && $buffer > 0) {
            $this->line("[{$connection->insurer_code}] Sesión expira pronto ({$connection->expires_at}), reconectando proactivamente...");
            return $this->attemptReconnect($connection, $microservice);
        }

        // ── Healthcheck normal ──
        $health = $microservice->checkHealth($connection);

        if ($health['success']) {
            $connection->status = 'connected';
            $connection->last_error = null;
            $connection->reconnect_count = 0;
            $connection->credentials_valid = true;
            $connection->save();
            return 'ok';
        }

        // ── Healthcheck falló → intentar reconectar ──
        $this->line("[{$connection->insurer_code}] Healthcheck falló: " . ($health['error'] ?? 'desconocido'));
        return $this->attemptReconnect($connection, $microservice);
    }

    private function attemptReconnect(InsurerConnection $connection, MicroservicioInsurerService $microservice): string
    {
        $credentials = $connection->credentials;

        // Sin credenciales (ej: SURA cookies) → no se puede reconectar automáticamente
        if (empty($credentials)) {
            $connection->status = 'reconnect_required';
            $connection->last_error = 'Sin credenciales almacenadas para auto-reconexión.';
            $connection->save();
            return 'failed';
        }

        // Demasiados fallos consecutivos → marcar credenciales como inválidas
        if ($connection->reconnect_count >= self::MAX_RECONNECT_FAILURES) {
            $connection->status = 'credentials_invalid';
            $connection->credentials_valid = false;
            $connection->last_error = "Auto-reconexión falló {$connection->reconnect_count} veces consecutivas. Posibles credenciales incorrectas.";
            $connection->save();
            $this->warn("[{$connection->insurer_code}] Marcada como credentials_invalid tras {$connection->reconnect_count} fallos.");
            return 'failed';
        }

        // Intentar reconexión
        $connect = $microservice->connect($connection->insurer_code, $credentials);

        if ($connect['success']) {
            $connection->status = 'connected';
            $connection->microservice_session_id = $connect['session_id'];
            $connection->session_payload = $connect['payload'] ?? null;
            $connection->connected_at = now();
            $connection->expires_at = $connect['expires_at'] ?? null;
            $connection->last_error = null;
            $connection->reconnect_count = 0;
            $connection->credentials_valid = true;
            $connection->last_reconnect_at = now();
            $connection->save();
            $this->info("[{$connection->insurer_code}] Reconectada exitosamente.");
            return 'reconnected';
        }

        // Reconexión falló
        $connection->reconnect_count = ($connection->reconnect_count ?? 0) + 1;
        $connection->last_error = $connect['error'] ?? 'Reconnect falló';
        $connection->status = 'reconnect_required';
        $connection->last_reconnect_at = now();
        $connection->save();
        $this->warn("[{$connection->insurer_code}] Reconexión falló (intento {$connection->reconnect_count}).");
        return 'failed';
    }
}
