<?php

namespace Tests\Feature;

use App\Services\InterestCalculationService;
use Tests\TestCase;

/**
 * The renewal gate requires the FULL term's interest to be paid before a pledge may
 * be extended, measured per term. These lock in the money-counting the gate and the
 * interest screen share -- previously the gate needed only interest accrued so far,
 * and the interest screen counted paid months from dates (miscounting 2 as 3).
 *
 * monthsCoveredBy is the shared primitive: given money paid, how many whole months
 * of the ladder does it cover. Both screens derive "months paid" from it, so they
 * cannot disagree.
 */
class RenewalTermGateTest extends TestCase
{
    /** The client's real ladder on the example pledge: 0.5% m1-3, 1.0% m4-6. */
    private const LADDER = [
        ['from_month' => 1, 'to_month' => 3, 'rate_percentage' => 0.5, 'rate_type' => 'standard'],
        ['from_month' => 4, 'to_month' => 6, 'rate_percentage' => 1.0, 'rate_type' => 'standard'],
    ];

    private const PRINCIPAL = 202950.00;

    private function service(): InterestCalculationService
    {
        return (new InterestCalculationService())->withTiers(self::LADDER);
    }

    public function test_money_maps_to_whole_ladder_months(): void
    {
        $svc = $this->service();

        // 0.5% month = 1,014.75; 1.0% month = 2,029.50.
        $cases = [
            [0.00, 0],
            [1014.75, 1],
            [2029.50, 2],   // two 0.5% months -- the case the old date-counter read as 3
            [3044.25, 3],
            [5073.75, 4],
            [7103.25, 5],
            [9132.75, 6],   // full term
        ];

        foreach ($cases as [$paid, $expectedMonths]) {
            $this->assertSame(
                $expectedMonths,
                $svc->monthsCoveredBy($paid, self::PRINCIPAL, 0.5, 6),
                "RM {$paid} must cover {$expectedMonths} whole months"
            );
        }
    }

    public function test_a_part_paid_month_does_not_count(): void
    {
        $svc = $this->service();

        // One cent short of month 1 is zero whole months, not one.
        $this->assertSame(0, $svc->monthsCoveredBy(1014.74, self::PRINCIPAL, 0.5, 6));
        // Enough for month 1 but a cent short of month 2 stays at one.
        $this->assertSame(1, $svc->monthsCoveredBy(2029.49, self::PRINCIPAL, 0.5, 6));
    }

    public function test_overpayment_never_exceeds_the_term(): void
    {
        $svc = $this->service();

        // Paying far more than the term still reports exactly the term length, so the
        // interest screen cannot offer "month 7" and the gate cannot over-credit.
        $this->assertSame(6, $svc->monthsCoveredBy(99999.00, self::PRINCIPAL, 0.5, 6));
        $this->assertSame(6, $svc->monthsCoveredBy(9132.75, self::PRINCIPAL, 0.5, 6));
    }

    public function test_full_term_interest_is_the_tiered_total_not_flat(): void
    {
        $svc = $this->service();

        $total = 0.0;
        for ($m = 1; $m <= 6; $m++) {
            $total += self::PRINCIPAL * ($svc->rateForMaintainedMonth($m, 0.5)['rate'] / 100);
        }

        // 3 x 1,014.75 + 3 x 2,029.50 -- the amount the gate demands before renewal.
        $this->assertSame(9132.75, round($total, 2));
        // Not the flat 6 x 0.5% the gate would have accepted before.
        $this->assertNotSame(6088.50, round($total, 2));
    }

    public function test_a_young_pledge_can_prepay_the_whole_term(): void
    {
        // The gate demands the full term even on a one-month-old pledge, so the
        // interest screen must let months not yet elapsed be paid. monthsCoveredBy
        // does not consult elapsed time -- money alone decides -- so prepaying all
        // six months reports six covered regardless of the pledge's age.
        $svc = $this->service();

        $this->assertSame(6, $svc->monthsCoveredBy(9132.75, self::PRINCIPAL, 0.5, 6));
    }

    public function test_a_renewed_term_is_priced_at_the_extended_tier(): void
    {
        // Months keep climbing across renewals: term 1 is months 1-6, term 2 is 7-12.
        // The ladder's "from month 7 onwards" extended tier is what makes renewing
        // dearer. Counting each term from month 1 would price term 2 at the opening
        // rates and the extended tier would never apply to a renewed pledge at all.
        $svc = (new InterestCalculationService())->withTiers([
            ['from_month' => 1, 'to_month' => 3, 'rate_percentage' => 0.5, 'rate_type' => 'standard'],
            ['from_month' => 4, 'to_month' => 6, 'rate_percentage' => 1.0, 'rate_type' => 'standard'],
            ['from_month' => 7, 'to_month' => null, 'rate_percentage' => 1.5, 'rate_type' => 'extended'],
        ]);

        // Term 2 months all sit in the open-ended extended tier.
        foreach ([7, 8, 9, 10, 11, 12] as $month) {
            $this->assertSame(1.5, $svc->rateForMaintainedMonth($month, 0.5)['rate']);
            $this->assertSame('extended', $svc->rateForMaintainedMonth($month, 0.5)['rate_type']);
        }

        // Counting money for term 2 must start at month 7, not month 1: one month of
        // term 2 costs 1.5%, so 0.5%-priced money buys fewer months than it would in
        // term 1.
        $oneExtendedMonth = self::PRINCIPAL * 0.015;
        $this->assertSame(1, $svc->monthsCoveredBy($oneExtendedMonth, self::PRINCIPAL, 0.5, 6, 7));
        // The same money in term 1 buys more, because months 1-3 are cheaper.
        $this->assertSame(3, $svc->monthsCoveredBy($oneExtendedMonth, self::PRINCIPAL, 0.5, 6, 1));
    }

    public function test_untiered_pledge_counts_against_the_flat_rate(): void
    {
        // A pledge with no ladder falls back to its flat rate for every month, so the
        // full term is 6 x that rate and money maps against it unchanged.
        $svc = (new InterestCalculationService())->withTiers([]);

        // At 0.5% flat, 3 months = 3 x 1,014.75 = 3,044.25.
        $this->assertSame(3, $svc->monthsCoveredBy(3044.25, self::PRINCIPAL, 0.5, 6));
        // At 0.8% flat, one month = 1,623.60; two months needs double that.
        $monthCost = self::PRINCIPAL * 0.008;
        $this->assertSame(2, $svc->monthsCoveredBy($monthCost * 2, self::PRINCIPAL, 0.8, 6));
    }
}
