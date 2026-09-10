<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\InterestPaymentController;
use App\Services\InterestCalculationService;
use ReflectionMethod;
use Tests\TestCase;

/**
 * A pledge that passes its due date keeps accruing past its own term, so the interest
 * screen must offer months beyond it and must read back what was actually paid.
 *
 * It shipped capped at the term in three places at once: the offer stopped at 6, the
 * paid counter stopped at 6, and "settled" meant "6 paid". A customer charged RM 2,472
 * for 8 months at the 2% overdue rate therefore read back as 6 months paid and fully
 * settled — the money was right, the read-back was not.
 *
 * These lock the three rules down. They deliberately take primitives rather than a
 * saved pledge, matching the rest of this suite, which runs without a database.
 */
class OverdueMonthsToPayTest extends TestCase
{
    private function rule(string $method, array $args)
    {
        $controller = new InterestPaymentController(new InterestCalculationService());
        $reflected = new ReflectionMethod($controller, $method);
        $reflected->setAccessible(true);

        return $reflected->invokeArgs($controller, $args);
    }

    /** payableMonths($isOverdue, $termMonths) */
    public function test_the_offer_stops_at_the_term_until_the_due_date_passes(): void
    {
        $this->assertSame(6, $this->rule('payableMonths', [false, 6]), 'Inside its term a pledge may never be billed past it');
        $this->assertSame(2, $this->rule('payableMonths', [false, 2]), 'A legacy 2-month term is still bounded by its own term');
    }

    public function test_a_pledge_past_due_may_be_billed_up_to_twelve_months(): void
    {
        $this->assertSame(12, $this->rule('payableMonths', [true, 6]));

        // Never shrink a term that is already longer than the ceiling.
        $this->assertSame(24, $this->rule('payableMonths', [true, 24]));
    }

    /** monthsDue($isOverdue, $termMonths, $ceilingMonths, $monthsElapsed, $monthsPaid) */
    public function test_inside_the_term_the_amount_due_is_the_terms_remainder(): void
    {
        // Elapsed months are irrelevant while the pledge is current: 4 months in with
        // nothing paid still owes the whole term, exactly as before this change.
        $this->assertSame(6, $this->rule('monthsDue', [false, 6, 6, 4, 0]));
        $this->assertSame(3, $this->rule('monthsDue', [false, 6, 6, 4, 3]));
        $this->assertSame(0, $this->rule('monthsDue', [false, 6, 6, 6, 6]));
    }

    public function test_one_day_past_due_owes_the_whole_of_month_seven(): void
    {
        // months_elapsed rounds a started month up, and there is no grace period:
        // the day after the due date, month 7 is owed in full.
        $this->assertSame(7, $this->rule('monthsDue', [true, 6, 12, 7, 0]));
        $this->assertSame(1, $this->rule('monthsDue', [true, 6, 12, 7, 6]));
    }

    public function test_an_overdue_pledge_paid_up_to_the_current_month_owes_nothing(): void
    {
        // The reported bug: 8 elapsed, 8 paid. Nothing is due today...
        $this->assertSame(0, $this->rule('monthsDue', [true, 6, 12, 8, 8]));

        // ...but the term is NOT closed — month 9 reopens it.
        $this->assertSame(1, $this->rule('monthsDue', [true, 6, 12, 9, 8]));
    }

    public function test_the_amount_due_never_exceeds_the_twelve_month_ceiling(): void
    {
        $this->assertSame(12, $this->rule('monthsDue', [true, 6, 12, 15, 0]));
        $this->assertSame(4, $this->rule('monthsDue', [true, 6, 12, 15, 8]));
    }

    public function test_an_overdue_pledge_never_owes_less_than_its_own_term(): void
    {
        // Overdue but months_elapsed somehow below the term (a back-dated due date):
        // fall back to the term rather than reporting less than it.
        $this->assertSame(6, $this->rule('monthsDue', [true, 6, 12, 3, 0]));
    }

    /** creditedMonths($byMoney, $billed, $ceilingMonths) */
    public function test_paid_months_are_credited_from_what_was_actually_billed(): void
    {
        // RM 2,472 collected as 8 months at 2% re-prices to 12 months down the cheaper
        // ladder. The customer paid for 8, so 8 is what they get.
        $this->assertSame(8, $this->rule('creditedMonths', [12, 8, 12]));
    }

    public function test_overdue_repricing_still_shrinks_the_value_of_old_money(): void
    {
        // The confirmed rule: 3 months paid at 0.5% is worth 0 whole months once every
        // month costs the 2% penalty rate. The billed-months cap must not undo that.
        $this->assertSame(0, $this->rule('creditedMonths', [0, 3, 12]));
        $this->assertSame(1, $this->rule('creditedMonths', [1, 3, 12]));
    }

    public function test_a_normal_in_term_payment_is_unchanged(): void
    {
        $this->assertSame(3, $this->rule('creditedMonths', [3, 3, 6]));
        $this->assertSame(0, $this->rule('creditedMonths', [0, 0, 6]));
    }

    public function test_payments_without_breakdown_rows_fall_back_to_the_money_count(): void
    {
        // Legacy payments predate the breakdown table. Treating their absence as zero
        // billed months would wipe out months the customer really paid.
        $this->assertSame(8, $this->rule('creditedMonths', [8, null, 12]));
        $this->assertSame(6, $this->rule('creditedMonths', [6, null, 6]));
    }

    public function test_credited_months_never_exceed_the_ceiling_or_go_negative(): void
    {
        $this->assertSame(12, $this->rule('creditedMonths', [99, 99, 12]));
        $this->assertSame(6, $this->rule('creditedMonths', [99, null, 6]));
        $this->assertSame(0, $this->rule('creditedMonths', [-1, 3, 12]));
    }
}
