<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     * 
     * Adds columns to track item redemption:
     * - redemption_id: Links item to the redemption that released it
     * - redeemed_at: Timestamp when item was redeemed
     */
    public function up(): void
    {
        Schema::table('pledge_items', function (Blueprint $table) {
            if (!Schema::hasColumn('pledge_items', 'redemption_id')) {
                $table->foreignId('redemption_id')->nullable()->after('pledge_id')
                    ->constrained('redemptions')->nullOnDelete();
            }
            if (!Schema::hasColumn('pledge_items', 'redeemed_at')) {
                $table->timestamp('redeemed_at')->nullable()->after('status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pledge_items', function (Blueprint $table) {
            $table->dropForeign(['redemption_id']);
            $table->dropColumn(['redemption_id', 'redeemed_at']);
        });
    }
};
