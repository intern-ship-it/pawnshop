<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Records which renewal term each interest payment belongs to.
 *
 * The renewal gate needs "interest paid toward the CURRENT term". That was inferred
 * from timestamps — payments after current_term_start — but settling a term and then
 * immediately renewing puts the payment and the renewal in the same second, so no
 * comparison works: `>=` credits the closing term's money to the new one (second
 * renewal free), `>` discards it (customer billed twice).
 *
 * term_number removes the guesswork. A payment is stamped with the pledge's
 * renewal_count at the moment it is taken, so it belongs to exactly one term
 * regardless of how close the events are in time.
 *
 *   term_number 0 = the original term (months 1-6)
 *   term_number 1 = after the first renewal (months 7-12), and so on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interest_payments', function (Blueprint $table) {
            $table->unsignedInteger('term_number')->default(0)->after('pledge_id');
        });

        // Backfill existing payments by comparing against each pledge's renewals:
        // a payment belongs to the term opened by the last renewal that preceded it.
        DB::table('interest_payments')->orderBy('id')->each(function ($payment) {
            $termNumber = DB::table('renewals')
                ->where('pledge_id', $payment->pledge_id)
                ->where('created_at', '<', $payment->created_at)
                ->count();

            DB::table('interest_payments')
                ->where('id', $payment->id)
                ->update(['term_number' => $termNumber]);
        });
    }

    public function down(): void
    {
        Schema::table('interest_payments', function (Blueprint $table) {
            $table->dropColumn('term_number');
        });
    }
};
