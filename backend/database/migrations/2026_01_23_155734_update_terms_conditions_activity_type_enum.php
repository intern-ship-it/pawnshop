<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Update the activity_type enum to include 'general' for general/miscellaneous terms
     */
    public function up(): void
    {
        // MySQL requires raw SQL to modify ENUM columns
        DB::statement("ALTER TABLE terms_conditions MODIFY COLUMN activity_type ENUM('pledge', 'renewal', 'redemption', 'auction', 'forfeit', 'general') NOT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to original enum (data with 'general' would need to be updated first)
        DB::statement("ALTER TABLE terms_conditions MODIFY COLUMN activity_type ENUM('pledge', 'renewal', 'redemption', 'auction', 'forfeit') NOT NULL");
    }
};
