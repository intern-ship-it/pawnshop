<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     * Change photo column from VARCHAR(255) to LONGTEXT to store base64 images
     */
    public function up(): void
    {
        // Use raw SQL to change the column type since Laravel doesn't handle this well
        DB::statement("ALTER TABLE pledge_items MODIFY COLUMN photo LONGTEXT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: This will truncate any data longer than 255 characters
        DB::statement("ALTER TABLE pledge_items MODIFY COLUMN photo VARCHAR(255) NULL");
    }
};
