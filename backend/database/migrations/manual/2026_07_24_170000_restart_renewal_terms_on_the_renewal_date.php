<?php

use App\Models\Renewal;
use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  NOT RUN AUTOMATICALLY. Lives outside database/migrations on purpose.
 *
 *  `php artisan migrate` globs that directory non-recursively, so nothing here
 *  is picked up by a normal deploy. Run it only when the client asks:
 *
 *      php artisan migrate --path=database/migrations/manual
 *      php artisan migrate:rollback --path=database/migrations/manual
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A renewed term now runs from the day the customer comes in to renew
 * (Renewal::dueDateForNewTerm). It used to extend the pledge's OLD due date, so
 * anyone renewing late got a term shorter than the "6 BULAN" printed on their
 * ticket -- PLG-HQ-2026-0026 renewed 14 days late was docked 13 days.
 *
 * The code change only governs renewals taken from now on. Rows already booked
 * under the old rule keep their short dates, because due_date is stored and
 * nothing recomputes it on read. This corrects those rows.
 *
 * Rows are derived, never hardcoded: each environment has different renewals.
 *
 * Deliberately skipped:
 *  - renewals whose stored date already matches the new rule (nothing to do);
 *  - pledges already settled (redeemed/forfeited/cancelled/auctioned) -- a
 *    closed pledge's dates are history and must not move;
 *  - a pledge whose due_date no longer matches the renewal being corrected: a
 *    later renewal has since set it, and that later row is corrected on its own.
 */
return new class extends Migration
{
    /**
     * Records exactly which rows up() changed, and their previous values.
     *
     * down() cannot re-derive its targets by shape here: once corrected, a fixed
     * row is indistinguishable from one booked correctly under the new rule, so a
     * shape-based rollback would drag good rows backwards. This journal is what
     * makes the migration reversible.
     *
     * It lives in the database rather than a file because the affected IDs differ
     * per environment, and a committed file would carry one environment's IDs into
     * another where they mean different renewals.
     */
    private const JOURNAL = 'renewal_term_restart_journal';

    public function up(): void
    {
        Schema::dropIfExists(self::JOURNAL);
        Schema::create(self::JOURNAL, function (Blueprint $table) {
            $table->unsignedBigInteger('renewal_id')->primary();
            $table->date('original_new_due_date');
            // Null when the pledge's own due_date was left alone (a later renewal
            // owns it, or the pledge is settled).
            $table->unsignedBigInteger('pledge_id')->nullable();
            $table->date('original_pledge_due_date')->nullable();
        });

        foreach ($this->affectedRows() as $row) {
            DB::table('renewals')
                ->where('id', $row['renewal_id'])
                ->update(['new_due_date' => $row['corrected']]);

            if ($row['pledge_id'] !== null) {
                DB::table('pledges')
                    ->where('id', $row['pledge_id'])
                    ->update(['due_date' => $row['corrected']]);
            }

            DB::table(self::JOURNAL)->insert([
                'renewal_id' => $row['renewal_id'],
                'original_new_due_date' => $row['original'],
                'pledge_id' => $row['pledge_id'],
                'original_pledge_due_date' => $row['pledge_id'] !== null ? $row['original'] : null,
            ]);
        }
    }

    /**
     * Restores the old short dates on exactly the rows up() changed.
     */
    public function down(): void
    {
        if (!Schema::hasTable(self::JOURNAL)) {
            // up() never ran here. Reverting by shape would corrupt renewals that
            // were booked correctly under the new rule, so do nothing at all.
            return;
        }

        foreach (DB::table(self::JOURNAL)->get() as $entry) {
            DB::table('renewals')
                ->where('id', $entry->renewal_id)
                ->update(['new_due_date' => $entry->original_new_due_date]);

            if ($entry->pledge_id !== null) {
                DB::table('pledges')
                    ->where('id', $entry->pledge_id)
                    ->update(['due_date' => $entry->original_pledge_due_date]);
            }
        }

        Schema::dropIfExists(self::JOURNAL);
    }

    /**
     * Renewals whose stored expiry was produced by the old "extend the previous due
     * date" rule, paired with the date the new rule gives.
     *
     * A row is only touched when its stored date matches the old formula exactly.
     * That proves which rule produced it -- anything else was hand-edited or came
     * from somewhere we do not model, and is left alone.
     */
    private function affectedRows(): array
    {
        $renewals = DB::table('renewals')
            ->select('id', 'pledge_id', 'renewal_months', 'previous_due_date', 'new_due_date', 'created_at')
            ->orderBy('id')
            ->get();

        $settled = ['redeemed', 'forfeited', 'cancelled', 'auctioned'];
        $rows = [];

        foreach ($renewals as $renewal) {
            if (!$renewal->created_at || !$renewal->new_due_date || !$renewal->previous_due_date) {
                continue;
            }

            $months = (int) $renewal->renewal_months;
            if ($months < 1) {
                continue;
            }

            $storedDue = Carbon::parse($renewal->new_due_date)->startOfDay();
            $previousDue = Carbon::parse($renewal->previous_due_date)->startOfDay();

            // The old rule: previous due date + N months, with no -1 day.
            if (!$storedDue->eq($previousDue->copy()->addMonths($months))) {
                continue; // Not produced by the old rule. Not ours to rewrite.
            }

            $corrected = Renewal::dueDateForNewTerm(
                Carbon::parse($renewal->created_at)->startOfDay(),
                $months
            );

            if ($corrected->eq($storedDue)) {
                continue; // Renewed exactly on the due date; both rules agree.
            }

            $pledge = DB::table('pledges')
                ->select('id', 'status', 'due_date')
                ->where('id', $renewal->pledge_id)
                ->first();

            // Move the pledge's own due_date only when this renewal is the one that
            // set it. If a later renewal has since overwritten it, that row gets
            // corrected on its own pass and this one must not fight it.
            $pledgeId = null;
            if (
                $pledge
                && !in_array($pledge->status, $settled, true)
                && $pledge->due_date
                && Carbon::parse($pledge->due_date)->startOfDay()->eq($storedDue)
            ) {
                $pledgeId = $pledge->id;
            }

            $rows[] = [
                'renewal_id' => $renewal->id,
                'pledge_id' => $pledgeId,
                'original' => $storedDue->toDateString(),
                'corrected' => $corrected->toDateString(),
            ];
        }

        return $rows;
    }
};
