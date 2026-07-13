<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * A renewal now only extends the due date; it collects no money. There was no
     * enum value meaning "nothing was collected", and the column was NOT NULL, so
     * an extension-only renewal could not be stored without inventing a payment
     * method it never used.
     *
     * Raw MODIFY rather than ->change() so the enum's members are preserved exactly.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE renewals MODIFY payment_method ENUM('cash','transfer','partial') NULL DEFAULT NULL");
    }

    public function down(): void
    {
        // Rows with no payment method predate the extension-only workflow; give them
        // a concrete value so the NOT NULL constraint can be restored.
        DB::table('renewals')->whereNull('payment_method')->update(['payment_method' => 'cash']);

        DB::statement("ALTER TABLE renewals MODIFY payment_method ENUM('cash','transfer','partial') NOT NULL");
    }
};
