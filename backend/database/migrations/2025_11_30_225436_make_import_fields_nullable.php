<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Hacer campos nullable para permitir importación sin datos inventados
     */
    public function up(): void
    {
        // Clientes
        Schema::table('clientes', function (Blueprint $table) {
            $table->string('last_name')->nullable()->change();
        });
        
        // Vendedores
        Schema::table('vendedores', function (Blueprint $table) {
            $table->string('tipo_documento')->nullable()->change();
        });
        
        // Pólizas
        Schema::table('polizas', function (Blueprint $table) {
            $table->string('client_name')->nullable()->change();
            $table->string('client_document')->nullable()->change();
            $table->string('product_name')->nullable()->change();
            $table->string('insurance_company')->nullable()->change();
            $table->decimal('premium_amount', 15, 2)->nullable()->change();
            $table->decimal('insured_amount', 15, 2)->nullable()->change();
            $table->decimal('total_amount', 15, 2)->nullable()->change();
            $table->date('issue_date')->nullable()->change();
            $table->date('start_date')->nullable()->change();
            $table->date('end_date')->nullable()->change();
            $table->string('seller_name')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No revertimos para no perder datos
    }
};
