<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Cambiar default del enum a 'USUARIO'
        DB::statement("ALTER TABLE users MODIFY COLUMN user_type ENUM('MASTER','ADMIN','EMPLEADO','USUARIO') NOT NULL DEFAULT 'USUARIO'");
    }

    public function down(): void
    {
        // Revertir default a 'MASTER'
        DB::statement("ALTER TABLE users MODIFY COLUMN user_type ENUM('MASTER','ADMIN','EMPLEADO','USUARIO') NOT NULL DEFAULT 'MASTER'");
    }
};


