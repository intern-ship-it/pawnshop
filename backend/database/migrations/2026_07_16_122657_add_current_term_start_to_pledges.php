<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Anchors each pledge to its CURRENT renewal term.
 *
 * A renewal may only proceed once the full term's interest is paid, and after a
 * renewal the next term must start fresh (interest paid for the old term does not
 * carry over). Both need a boundary marking where the current term began — which
 * did not exist: total_interest_paid summed every payment ever, and accrual counted
 * from the original pledge_date regardless of renewals.
 *
 * current_term_start is that boundary:
 *   - a fresh pledge  -> its pledge_date
 *   - a renewed pledge -> the new_due_date of its most recent renewal, i.e. the day
 *     the current term began.
 */
return new class extends Migration
{
    public function up(): void
    {
        // datetime, not date: a pledge can be renewed and then paid the same day, and
        // only the time separates the old term's payment from the new one's.
        Schema::table('pledges', function (Blueprint $table) {
            $table->dateTime('current_term_start')->nullable()->after('due_date');
        });

        // Backfill: un-renewed pledges start at pledge_date; renewed ones at the
        // most recent renewal's new_due_date.
        DB::table('pledges')->orderBy('id')->each(function ($pledge) {
            $termStart = $pledge->pledge_date;

            if ((int) $pledge->renewal_count > 0) {
                // When the renewal HAPPENED, not the period it opened. The customer
                // pays for the new term from the moment they renew, months before the
                // new period begins, so anchoring to the future due date would put
                // every payment outside the window.
                $lastRenewalAt = DB::table('renewals')
                    ->where('pledge_id', $pledge->id)
                    ->orderBy('created_at', 'desc')
                    ->orderBy('id', 'desc')
                    ->value('created_at');

                if ($lastRenewalAt) {
                    $termStart = $lastRenewalAt;
                }
            }

            DB::table('pledges')
                ->where('id', $pledge->id)
                ->update(['current_term_start' => $termStart]);
        });
    }

    public function down(): void
    {
        Schema::table('pledges', function (Blueprint $table) {
            $table->dropColumn('current_term_start');
        });
    }
};
