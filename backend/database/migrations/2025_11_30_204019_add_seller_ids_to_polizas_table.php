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
        Schema::table('polizas', function (Blueprint $table) {
            // Vendedor principal (opcional)
            $table->unsignedBigInteger('seller_id')->nullable()->after('seller_name');
            $table->foreign('seller_id')->references('id')->on('vendedores')->nullOnDelete();
            
            // Segundo vendedor (opcional)
            $table->unsignedBigInteger('seller_id_2')->nullable()->after('seller_id');
            $table->string('seller_name_2')->nullable()->after('seller_id_2');
            $table->foreign('seller_id_2')->references('id')->on('vendedores')->nullOnDelete();
            
            // Índices para búsquedas
            $table->index('seller_id');
            $table->index('seller_id_2');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropForeign(['seller_id']);
            $table->dropForeign(['seller_id_2']);
            $table->dropIndex(['seller_id']);
            $table->dropIndex(['seller_id_2']);
            $table->dropColumn(['seller_id', 'seller_id_2', 'seller_name_2']);
        });
    }
};
