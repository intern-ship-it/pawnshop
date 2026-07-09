<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The gold_price_* columns hold the price actually USED to value a pledge,
     * which staff may override at entry. That override replaced the system price,
     * leaving no record of what the market quoted at the time.
     *
     * These columns snapshot the market side: the branch's gold_prices row, and
     * whether that row came from an API feed or was keyed in manually. Nullable —
     * pledges created before this migration have no such record, and must stay
     * blank rather than be backfilled with a guess.
     */
    public function up(): void
    {
        Schema::table('pledges', function (Blueprint $table) {
            $table->json('market_gold_prices')->nullable()->after('gold_price_750');
            $table->string('market_price_source', 32)->nullable()->after('market_gold_prices');
        });
    }

    public function down(): void
    {
        Schema::table('pledges', function (Blueprint $table) {
            $table->dropColumn(['market_gold_prices', 'market_price_source']);
        });
    }
};
