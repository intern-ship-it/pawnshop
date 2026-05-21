<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('day_end_reports', function (Blueprint $table) {
            $table->decimal('closing_balance', 15, 2)->nullable()->after('opening_balance');
        });
    }

    public function down(): void
    {
        Schema::table('day_end_reports', function (Blueprint $table) {
            $table->dropColumn('closing_balance');
        });
    }
};
