<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Verificar si la columna ya existe
        if (!Schema::hasColumn('campaigns', 'broker_id')) {
            Schema::table('campaigns', function (Blueprint $table) {
                $table->unsignedBigInteger('broker_id')->nullable()->after('id');
            });
        }
        
        // Asignar un broker_id por defecto a las campañas existentes (tomar el primer broker)
        $firstBroker = \DB::table('brokers')->first();
        if ($firstBroker) {
            \DB::table('campaigns')
                ->where(function($query) {
                    $query->whereNull('broker_id')->orWhere('broker_id', 0);
                })
                ->update(['broker_id' => $firstBroker->id]);
        }
        
        // Ahora hacer la columna NOT NULL y agregar la foreign key (si no existe)
        $foreignKeys = \DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' 
             AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'campaigns_broker_id_foreign'"
        );
        
        if (empty($foreignKeys)) {
            Schema::table('campaigns', function (Blueprint $table) {
                $table->unsignedBigInteger('broker_id')->nullable(false)->change();
                $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropForeign(['broker_id']);
            $table->dropColumn('broker_id');
        });
    }
};
