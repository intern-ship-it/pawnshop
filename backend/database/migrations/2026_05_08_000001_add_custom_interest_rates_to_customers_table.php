<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->decimal('custom_interest_rate', 5, 2)->nullable()->after('notes');
            $table->decimal('custom_interest_rate_extended', 5, 2)->nullable()->after('custom_interest_rate');
            $table->decimal('custom_interest_rate_overdue', 5, 2)->nullable()->after('custom_interest_rate_extended');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn([
                'custom_interest_rate',
                'custom_interest_rate_extended',
                'custom_interest_rate_overdue',
            ]);
        });
    }
};
