<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Encolar SyncInsurerJob
    |--------------------------------------------------------------------------
    |
    | false (por defecto): ejecuta cada SyncInsurerJob en el mismo request HTTP
    | tras crear el batch (no requiere php artisan queue:work). El POST /sync
    | puede tardar varios minutos según aseguradoras y tipos.
    |
    | true: encola en la conexión por defecto (QUEUE_CONNECTION); obligatorio
    | ejecutar un worker en producción para que avance el estado en sync_jobs.
    |
    */
    'use_queue' => filter_var(env('INSURER_SYNC_USE_QUEUE', false), FILTER_VALIDATE_BOOLEAN),

];
