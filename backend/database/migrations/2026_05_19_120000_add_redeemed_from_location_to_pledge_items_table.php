<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('pledge_items', function (Blueprint $table) {
            if (!Schema::hasColumn('pledge_items', 'redeemed_from_location')) {
                $table->string('redeemed_from_location', 255)->nullable()->after('redeemed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pledge_items', function (Blueprint $table) {
            if (Schema::hasColumn('pledge_items', 'redeemed_from_location')) {
                $table->dropColumn('redeemed_from_location');
            }
        });
    }
};
