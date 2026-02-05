<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('redemptions', function (Blueprint $table) {
            // Check if items_released exists to determine position, otherwise just add
            $after = Schema::hasColumn('redemptions', 'items_released') ? 'items_released' : 'updated_at';

            if (!Schema::hasColumn('redemptions', 'released_at')) {
                $table->timestamp('released_at')->nullable()->after($after);
            }
            if (!Schema::hasColumn('redemptions', 'released_by')) {
                // If released_at was just added, position after it
                $table->foreignId('released_by')->nullable()->after('released_at')->constrained('users');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('redemptions', function (Blueprint $table) {
            $table->dropForeign(['released_by']);
            $table->dropColumn(['released_at', 'released_by']);
        });
    }
};
