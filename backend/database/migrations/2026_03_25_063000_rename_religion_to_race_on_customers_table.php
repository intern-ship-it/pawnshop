<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add race column (replaces old religion column)
        if (Schema::hasColumn('customers', 'religion')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->renameColumn('religion', 'race');
            });
        } elseif (!Schema::hasColumn('customers', 'race')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->string('race', 50)->nullable()->after('nationality');
            });
        }
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('race');
        });
    }
};
