<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     * Adds 'redeemed' to the status ENUM for pledge_items
     */
    public function up(): void
    {
        // MySQL requires ALTER TABLE to modify ENUM
        DB::statement("ALTER TABLE `pledge_items` MODIFY COLUMN `status` ENUM('stored', 'released', 'auctioned', 'redeemed') DEFAULT 'stored'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // First update any 'redeemed' items back to 'released' 
        DB::statement("UPDATE `pledge_items` SET `status` = 'released' WHERE `status` = 'redeemed'");

        // Then revert the ENUM
        DB::statement("ALTER TABLE `pledge_items` MODIFY COLUMN `status` ENUM('stored', 'released', 'auctioned') DEFAULT 'stored'");
    }
};
