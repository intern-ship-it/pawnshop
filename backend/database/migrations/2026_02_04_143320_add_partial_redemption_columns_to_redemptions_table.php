<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     * 
     * Adds columns to support partial item redemption:
     * - is_partial: Flag indicating if this is a partial redemption
     * - redeemed_item_ids: JSON array of item IDs that were redeemed
     */
    public function up(): void
    {
        Schema::table('redemptions', function (Blueprint $table) {
            // Check if columns don't exist before adding
            if (!Schema::hasColumn('redemptions', 'is_partial')) {
                $table->boolean('is_partial')->default(false)->after('total_payable');
            }
            if (!Schema::hasColumn('redemptions', 'redeemed_item_ids')) {
                $table->json('redeemed_item_ids')->nullable()->after('is_partial');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('redemptions', function (Blueprint $table) {
            $table->dropColumn(['is_partial', 'redeemed_item_ids']);
        });
    }
};
