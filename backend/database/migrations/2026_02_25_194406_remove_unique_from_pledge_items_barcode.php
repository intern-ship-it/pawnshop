<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration 
{
    /**
     * Remove unique constraint from barcode column since all items
     * in a pledge now share the same barcode (one barcode per pledge).
     */
    public function up(): void
    {
        // First, find and drop any unique index on the barcode column
        $indexes = DB::select("SHOW INDEX FROM pledge_items WHERE Column_name = 'barcode' AND Non_unique = 0");

        foreach ($indexes as $index) {
            DB::statement("ALTER TABLE pledge_items DROP INDEX `{$index->Key_name}`");
        }

        // Add a regular (non-unique) index if one doesn't already exist
        $regularIndexes = DB::select("SHOW INDEX FROM pledge_items WHERE Column_name = 'barcode' AND Non_unique = 1");
        if (count($regularIndexes) === 0) {
            DB::statement("ALTER TABLE pledge_items ADD INDEX pledge_items_barcode_index (barcode)");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop the regular index and re-add the unique one
        $indexes = DB::select("SHOW INDEX FROM pledge_items WHERE Column_name = 'barcode' AND Non_unique = 1");
        foreach ($indexes as $index) {
            DB::statement("ALTER TABLE pledge_items DROP INDEX `{$index->Key_name}`");
        }

        DB::statement("ALTER TABLE pledge_items ADD UNIQUE INDEX pledge_items_barcode_unique (barcode)");
    }
};
