<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The renewal ticket's start date -- what prints as "Tarikh Dipajak" -- was derived as
 * previous_due_date + 1 day. That stopped being the true start once a renewed term
 * could be anchored on the date interest is paid through instead (client-confirmed
 * 2026-09-10): a pledge due 24/07 whose interest was paid to 25/09 renews to 24/03, so
 * the derived start printed 25/07 and the ticket read as an eight-month term directly
 * above the words "6 BULAN".
 *
 * Deriving it backwards from new_due_date is not safe -- rows exist whose new_due_date
 * is not previous_due_date plus renewal_months, and reversing the arithmetic would
 * re-date those tickets.
 *
 * So the anchor is recorded at renewal time. Nullable, and left null for every existing
 * row: the accessor keeps falling back to previous_due_date + 1 for those, which is
 * exactly what they print today.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('renewals', function (Blueprint $table) {
            $table->date('term_start_date')->nullable()->after('previous_due_date');
        });
    }

    public function down(): void
    {
        Schema::table('renewals', function (Blueprint $table) {
            $table->dropColumn('term_start_date');
        });
    }
};
