<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A pledge expires the day BEFORE its term anniversary: a 6-month pledge taken on
 * 27 Apr is due 26 Oct, not 27 Oct. PledgeController applies that (`->subDay()`),
 * but pledges created before that line existed were stored a day late and kept the
 * wrong date, because due_date is a stored column and nothing recomputes it on read.
 *
 * This corrects those legacy rows. It derives them rather than hardcoding IDs, so it
 * fixes whatever is actually affected on each environment.
 *
 * Deliberately skipped:
 *  - renewed pledges (renewal_count > 0): a renewal rewrites due_date under its own
 *    rules, so the pledge_date anniversary no longer describes the current due date.
 *  - anything already settled (redeemed/forfeited/cancelled): those must not move.
 */
return new class extends Migration
{
    /**
     * Records which rows up() actually changed, so down() can revert exactly those
     * and nothing else.
     *
     * Without it, down() would have to re-derive its targets by shape — and every
     * correctly-dated pledge has the same shape as the ones we fixed, so a rollback
     * would push all ~300 good rows a day late. This journal is what makes the
     * migration safe to reverse.
     *
     * It lives in the database, not a file: the affected IDs differ per environment,
     * and a file could be committed and carried to another database where those IDs
     * mean different pledges.
     */
    private const JOURNAL = 'due_date_subday_fix_journal';

    public function up(): void
    {
        Schema::dropIfExists(self::JOURNAL);
        Schema::create(self::JOURNAL, function (Blueprint $table) {
            $table->unsignedBigInteger('pledge_id')->primary();
            $table->date('original_due_date');
        });

        foreach ($this->affectedRows() as $row) {
            DB::table('pledges')
                ->where('id', $row['id'])
                ->update(['due_date' => $row['corrected']]);

            DB::table(self::JOURNAL)->insert([
                'pledge_id' => $row['id'],
                'original_due_date' => $row['original'],
            ]);
        }
    }

    /**
     * Restores the un-subtracted date on exactly the rows up() changed.
     */
    public function down(): void
    {
        if (!Schema::hasTable(self::JOURNAL)) {
            // No journal means up() never ran here. Reverting by shape would corrupt
            // every correctly-dated pledge, so do nothing at all.
            return;
        }

        foreach (DB::table(self::JOURNAL)->get() as $entry) {
            DB::table('pledges')
                ->where('id', $entry->pledge_id)
                ->update(['due_date' => $entry->original_due_date]);
        }

        Schema::dropIfExists(self::JOURNAL);
    }

    /**
     * Pledges whose due_date sits exactly on the term anniversary (i.e. the -1 day
     * was never applied). Matching on that exact shape means a row is only touched
     * when we can prove which rule produced it — anything else is left alone.
     */
    private function affectedRows(): array
    {
        $pledges = DB::table('pledges')
            ->select('id', 'pledge_date', 'due_date')
            ->where('renewal_count', 0)
            ->whereNotIn('status', ['redeemed', 'forfeited', 'cancelled', 'auctioned'])
            ->get();

        $rows = [];

        foreach ($pledges as $pledge) {
            if (!$pledge->pledge_date || !$pledge->due_date) {
                continue;
            }

            $pledgeDate = Carbon::parse($pledge->pledge_date)->startOfDay();
            $dueDate = Carbon::parse($pledge->due_date)->startOfDay();

            // The pledge's own term, inferred from the dates. Terms vary (2, 3, 4 and
            // 6 months all exist in this data), so we must not assume 6.
            $term = $this->termInMonths($pledgeDate, $dueDate);
            if ($term === null) {
                continue; // Matches no clean term — not ours to rewrite.
            }

            $anniversary = $pledgeDate->copy()->addMonths($term);

            // Only rows sitting exactly ON the anniversary are wrong. A row already
            // at anniversary-minus-a-day is correct and must be left untouched.
            if ($dueDate->eq($anniversary)) {
                $rows[] = [
                    'id' => $pledge->id,
                    'original' => $dueDate->toDateString(),
                    'corrected' => $anniversary->copy()->subDay()->toDateString(),
                ];
            }
        }

        return $rows;
    }

    /**
     * The term whose anniversary (or anniversary minus a day) lands on this due date.
     * Null when neither shape matches any term from 1 to 12 months, which means the
     * row was not produced by either rule and must not be rewritten.
     */
    private function termInMonths(Carbon $pledgeDate, Carbon $dueDate): ?int
    {
        for ($months = 1; $months <= 12; $months++) {
            $anniversary = $pledgeDate->copy()->addMonths($months);

            if ($dueDate->eq($anniversary) || $dueDate->eq($anniversary->copy()->subDay())) {
                return $months;
            }
        }

        return null;
    }
};
