<?php

namespace Tests\Feature;

use App\Models\Pledge;
use App\Models\PledgePrincipalChange;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * Interest is charged on the principal that was outstanding WHEN each month ran.
 *
 * Every figure used to come from one loan_amount column, applied to every month
 * including ones long past. That was harmless until partial redemption began
 * overwriting it: PLG-HQ-2026-0293 carried RM 56,880 for its first four months, had
 * items released, and those four months were then billed on RM 45,279.42 -- RM 232.01
 * short on money the customer genuinely held.
 *
 * Client-confirmed 2026-10-01: months before a change bill at the old amount, months
 * after it at the new one.
 *
 * These run without a database, like the rest of this suite: the ledger is attached as
 * a relation rather than saved.
 */
class PrincipalHistoryTest extends TestCase
{
    private function pledge(string $pledgeDate, float $loanAmount, array $changes = []): Pledge
    {
        $pledge = new Pledge([
            'pledge_date' => $pledgeDate,
            'loan_amount' => $loanAmount,
        ]);

        $pledge->setRelation(
            'principalChanges',
            collect($changes)->map(fn ($row) => new PledgePrincipalChange([
                'effective_from' => $row[0],
                'principal_amount' => $row[1],
                'reason' => $row[2] ?? PledgePrincipalChange::REASON_PARTIAL_REDEMPTION,
            ]))
        );

        return $pledge;
    }

    public function test_a_pledge_with_no_recorded_changes_bills_on_its_loan_amount(): void
    {
        // Every pledge whose principal never moved, which is nearly all of them. This
        // is the guarantee that the ledger changes nothing until it holds something.
        $pledge = $this->pledge('2026-06-16', 15000.00);

        foreach ([1, 3, 6, 12] as $month) {
            $this->assertSame(15000.00, $pledge->principalForMonth($month));
        }

        $this->assertSame(15000.00, $pledge->principalOn(Carbon::parse('2030-01-01')));
    }

    public function test_months_before_a_reduction_keep_the_larger_principal(): void
    {
        // The reported case, to the cent.
        $pledge = $this->pledge('2026-06-16', 45279.42, [
            ['2026-06-16', 56880.00, PledgePrincipalChange::REASON_INITIAL],
            ['2026-09-26', 45279.42],
        ]);

        // Months 1-4 begin 16/06, 16/07, 16/08, 16/09 -- all before the redemption.
        foreach ([1, 2, 3, 4] as $month) {
            $this->assertSame(56880.00, $pledge->principalForMonth($month), "Month {$month}");
        }

        // Months 5 and 6 begin 16/10 and 16/11, after it.
        $this->assertSame(45279.42, $pledge->principalForMonth(5));
        $this->assertSame(45279.42, $pledge->principalForMonth(6));
    }

    public function test_the_undercharge_the_ledger_recovers(): void
    {
        $pledge = $this->pledge('2026-06-16', 45279.42, [
            ['2026-06-16', 56880.00, PledgePrincipalChange::REASON_INITIAL],
            ['2026-09-26', 45279.42],
        ]);

        $correct = 0.0;
        $flat = 0.0;

        for ($month = 1; $month <= 6; $month++) {
            $correct += $pledge->principalForMonth($month) * 0.005;
            $flat += 45279.42 * 0.005;
        }

        $this->assertSame(1590.39, round($correct, 2));
        $this->assertSame(1358.38, round($flat, 2));
        $this->assertSame(232.01, round($correct - $flat, 2));
    }

    public function test_a_change_applies_from_its_own_day_inclusive(): void
    {
        $pledge = $this->pledge('2026-01-10', 5000.00, [
            ['2026-01-10', 15000.00, PledgePrincipalChange::REASON_INITIAL],
            ['2026-04-10', 5000.00, PledgePrincipalChange::REASON_PRINCIPAL_PAYMENT],
        ]);

        $this->assertSame(15000.00, $pledge->principalOn(Carbon::parse('2026-04-09')));
        $this->assertSame(5000.00, $pledge->principalOn(Carbon::parse('2026-04-10')));
        $this->assertSame(5000.00, $pledge->principalOn(Carbon::parse('2026-04-11')));
    }

    public function test_several_reductions_each_apply_from_their_own_date(): void
    {
        // A pledge may be part-paid more than once in a term.
        $pledge = $this->pledge('2026-01-10', 2000.00, [
            ['2026-01-10', 10000.00, PledgePrincipalChange::REASON_INITIAL],
            ['2026-02-10', 7000.00, PledgePrincipalChange::REASON_PRINCIPAL_PAYMENT],
            ['2026-04-10', 2000.00, PledgePrincipalChange::REASON_PRINCIPAL_PAYMENT],
        ]);

        $this->assertSame(10000.00, $pledge->principalForMonth(1));
        $this->assertSame(7000.00, $pledge->principalForMonth(2));
        $this->assertSame(7000.00, $pledge->principalForMonth(3));
        $this->assertSame(2000.00, $pledge->principalForMonth(4));
        $this->assertSame(2000.00, $pledge->principalForMonth(7));
    }

    public function test_a_date_before_the_first_entry_falls_back_rather_than_guessing(): void
    {
        // A ledger whose opening row somehow postdates the pledge. Reading nothing
        // would be worse than reading the column every other pledge uses.
        $pledge = $this->pledge('2026-01-10', 9000.00, [
            ['2026-03-10', 4000.00],
        ]);

        $this->assertSame(9000.00, $pledge->principalForMonth(1));
        $this->assertSame(4000.00, $pledge->principalForMonth(3));
    }
}
