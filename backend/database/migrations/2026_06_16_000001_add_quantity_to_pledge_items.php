<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pledge_items', function (Blueprint $table) {
            // Number of physical pieces in this item (e.g. 3 rings). Display-only;
            // does not affect weight or valuation. Existing rows default to 1.
            $table->unsignedSmallInteger('quantity')->default(1)->after('category_id');
        });
    }

    public function down(): void
    {
        Schema::table('pledge_items', function (Blueprint $table) {
            $table->dropColumn('quantity');
        });
    }
};
