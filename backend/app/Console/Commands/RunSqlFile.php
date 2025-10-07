<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RunSqlFile extends Command
{
    protected $signature = 'db:run-sql {path : Absolute path to .sql file} {--connection= : DB connection name}';
    protected $description = 'Ejecuta un archivo SQL usando la conexión de Laravel (soporta múltiples sentencias)';

    public function handle(): int
    {
        $path = $this->argument('path');
        if (!is_file($path)) {
            $this->error("Archivo no encontrado: {$path}");
            return self::FAILURE;
        }

        $connectionName = $this->option('connection') ?: config('database.default');
        $conn = DB::connection($connectionName);

        $sql = file_get_contents($path);
        if ($sql === false) {
            $this->error('No se pudo leer el archivo SQL.');
            return self::FAILURE;
        }

        // Separación por ';' aceptando fin de línea o fin de archivo
        $statements = array_filter(array_map('trim', preg_split('/;\s*(?:\r?\n|$)/', $sql)));

        $this->info("Ejecutando " . count($statements) . " sentencias en {$connectionName} desde {$path}");

        try {
            $conn->unprepared('SET FOREIGN_KEY_CHECKS=0');
            foreach ($statements as $stmt) {
                if ($stmt === '' || str_starts_with($stmt, '--')) continue;
                $firstToken = strtoupper(strtok(ltrim($stmt), " \t\r\n"));
                // Para SELECT/SHOW/DESCRIBE usamos select() para consumir/bufferizar resultados
                if (in_array($firstToken, ['SELECT','SHOW','DESCRIBE','EXPLAIN'])) {
                    $rows = $conn->select($stmt);
                    $count = is_countable($rows) ? count($rows) : 0;
                    $this->line("SELECT returned {$count} rows");
                    $max = 10;
                    $shown = 0;
                    foreach ($rows as $row) {
                        if ($shown >= $max) { $this->line('...'); break; }
                        $this->line(json_encode($row, JSON_UNESCAPED_UNICODE));
                        $shown++;
                    }
                } else {
                    $conn->unprepared($stmt);
                }
            }
            $conn->unprepared('SET FOREIGN_KEY_CHECKS=1');
        } catch (\Throwable $e) {
            $this->error('Error ejecutando SQL: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info('Archivo SQL ejecutado correctamente.');
        return self::SUCCESS;
    }
}


