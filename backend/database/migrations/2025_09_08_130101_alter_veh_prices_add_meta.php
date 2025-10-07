<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('veh_prices')) return; // creada en 130100 ya con columnas
    }

    public function down(): void
    {
        // noop
    }
};


