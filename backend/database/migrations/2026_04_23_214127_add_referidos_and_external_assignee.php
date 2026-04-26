<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega:
 *  - sales_funnel: campos de referido (opcional: vendedor interno u "otro" con nombre libre)
 *  - commercial_tasks: campos para asignar una tarea a una compañía/financiera
 *    (no sustituye a assigned_to — conviven: assigned_to es el responsable
 *    interno; assigned_company / assigned_financial_entity son la contraparte
 *    externa a la que el broker está tramitando algo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_funnel', function (Blueprint $t) {
            $t->enum('referrer_type', ['vendedor', 'otro'])->nullable()->after('assigned_agent_id');
            $t->unsignedBigInteger('referrer_vendedor_id')->nullable()->after('referrer_type');
            $t->string('referrer_name')->nullable()->after('referrer_vendedor_id');

            $t->index('referrer_type');
            $t->index('referrer_vendedor_id');
        });

        Schema::table('commercial_tasks', function (Blueprint $t) {
            $t->string('assigned_company')->nullable()->after('assigned_to');
            $t->string('assigned_financial_entity')->nullable()->after('assigned_company');
        });
    }

    public function down(): void
    {
        Schema::table('sales_funnel', function (Blueprint $t) {
            $t->dropIndex(['referrer_type']);
            $t->dropIndex(['referrer_vendedor_id']);
            $t->dropColumn(['referrer_type', 'referrer_vendedor_id', 'referrer_name']);
        });

        Schema::table('commercial_tasks', function (Blueprint $t) {
            $t->dropColumn(['assigned_company', 'assigned_financial_entity']);
        });
    }
};
