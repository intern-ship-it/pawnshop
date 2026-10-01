<?php

use App\Models\Pledge;
use App\Models\PledgePrincipalChange;
use App\Models\Redemption;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * MANUAL. Not run by `php artisan migrate` -- this directory is outside the migration
 * path. Run it deliberately, and only when the client has agreed to recover the
 * interest it will reveal.
 *
 * Reconstructs the principal ledger for pledges that were partially redeemed before
 * the ledger existed. Those pledges had their loan_amount overwritten in place, so the
 * months the customer held the LARGER sum are currently being billed on the smaller
 * one. PLG-HQ-2026-0293 is the live example: RM 56,880 for its first four months, now
 * billed on RM 45,279.42 -- RM 232.01 short across a six-month term.
 *
 * The opening principal is recovered by adding back every redemption's principal_amount,
 * and each redemption then writes the amount outstanding after it, dated to the day it
 * happened. Pledges with no partial redemption are left alone: with no rows they fall
 * back to loan_amount, exactly as now.
 *
 * Re-running is safe -- a pledge that already has rows is skipped.
 */
return new class extends Migration
{
    public function up(): void
    {
        $pledges = Pledge::whereHas('redemption')
            ->with(['redemption' => fn ($q) => $q->orderBy('created_at')])
            ->get();

        $written = 0;

        foreach ($pledges as $pledge) {
            if ($pledge->principalChanges()->exists()) {
                continue;
            }

            // Only partial redemptions moved the principal while leaving the pledge
            // alive. A fully redeemed pledge accrues nothing further, so its ledger
            // would never be read.
            $redemptions = $pledge->redemption->filter(
                fn ($r) => (float) ($r->principal_amount ?? 0) > 0
            );

            if ($redemptions->isEmpty() || $pledge->items()->whereNull('redemption_id')->doesntExist()) {
                continue;
            }

            $opening = (float) $pledge->loan_amount + (float) $redemptions->sum('principal_amount');

            DB::transaction(function () use ($pledge, $redemptions, $opening, &$written) {
                PledgePrincipalChange::create([
                    'pledge_id' => $pledge->id,
                    'effective_from' => $pledge->pledge_date,
                    'principal_amount' => round($opening, 2),
                    'reason' => PledgePrincipalChange::REASON_INITIAL,
                ]);

                $running = $opening;

                foreach ($redemptions as $redemption) {
                    $running -= (float) $redemption->principal_amount;

                    PledgePrincipalChange::create([
                        'pledge_id' => $pledge->id,
                        'effective_from' => $redemption->created_at->toDateString(),
                        'principal_amount' => round($running, 2),
                        'reason' => PledgePrincipalChange::REASON_PARTIAL_REDEMPTION,
                        'source_type' => Redemption::class,
                        'source_id' => $redemption->id,
                    ]);
                }

                $written++;
            });
        }

        echo "Backfilled principal history for {$written} pledge(s)." . PHP_EOL;
    }

    public function down(): void
    {
        PledgePrincipalChange::whereIn('reason', [
            PledgePrincipalChange::REASON_INITIAL,
            PledgePrincipalChange::REASON_PARTIAL_REDEMPTION,
        ])->delete();
    }
};
