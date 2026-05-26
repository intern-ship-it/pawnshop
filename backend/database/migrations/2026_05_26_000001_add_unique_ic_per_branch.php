<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Make ic_number unique per branch (composite unique index).
     * This prevents the same IC/Passport from being registered twice in the same branch.
     */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            // Drop the existing plain index on ic_number
            $table->dropIndex(['ic_number']);

            // Add composite unique index: ic_number + branch_id
            $table->unique(['ic_number', 'branch_id'], 'customers_ic_number_branch_unique');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique('customers_ic_number_branch_unique');
            $table->index('ic_number');
        });
    }
};
