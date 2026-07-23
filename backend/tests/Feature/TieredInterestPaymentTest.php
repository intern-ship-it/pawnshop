<?php

namespace Tests\Feature;

use App\Services\InterestCalculationService;
use Tests\TestCase;

/**
 * The interest-payment screen bills months 4-6 on their own, so it walks the ladder
 * month by month via rateForMaintainedMonth() rather than calculateMonthlyBreakdown()'s
 * 1..n loop. These lock in that walk: it shipped applying the flat pledges.interest_rate
 * to every month, which undercharged a 0.5/1.0 pledge by a third on a 6-month payment.
 */
class TieredInterestPaymentTest extends TestCase
{
    /** The client's real ladder: 0.5% months 1-3, 1.0% months 4-6, 1.5% from month 7. */
    private const LADDER = [
        ['from_month' => 1, 'to_month' => 3, 'rate_percentage' => 0.5, 'rate_type' => 'standard'],
        ['from_month' => 4, 'to_month' => 6, 'rate_percentage' => 1.0, 'rate_type' => 'standard'],
        ['from_month' => 7, 'to_month' => null, 'rate_percentage' => 1.5, 'rate_type' => 'extended'],
    ];

    private function tiered(): InterestCalculationService
    {
        return (new InterestCalculationService())->withTiers(self::LADDER);
    }

    public function test_each_month_bills_at_its_own_tier(): void
    {
        $svc = $this->tiered();

        $expected = [1 => 0.5, 2 => 0.5, 3 => 0.5, 4 => 1.0, 5 => 1.0, 6 => 1.0];
        foreach ($expected as $month => $rate) {
            $this->assertSame(
                $rate,
                $svc->rateForMaintainedMonth($month, 0.5)['rate'],
                "Month {$month} must bill at {$rate}%, not the pledge's flat rate"
            );
        }
    }

    public function test_open_ended_extended_tier_covers_every_later_month(): void
    {
        $svc = $this->tiered();

        // to_month === null means "from month 7 onwards", so month 7 and month 99 alike.
        $this->assertSame(1.5, $svc->rateForMaintainedMonth(7, 0.5)['rate']);
        $this->assertSame(1.5, $svc->rateForMaintainedMonth(99, 0.5)['rate']);
        $this->assertSame('extended', $svc->rateForMaintainedMonth(7, 0.5)['rate_type']);
    }

    public function test_paying_six_months_charges_the_ladder_not_six_times_the_first_rate(): void
    {
        $svc = $this->tiered();
        $principal = 202950.00;

        $total = 0;
        for ($month = 1; $month <= 6; $month++) {
            $total += $principal * ($svc->rateForMaintainedMonth($month, 0.5)['rate'] / 100);
        }

        // 3 x 1,014.75 (0.5%) + 3 x 2,029.50 (1.0%)
        $this->assertSame(9132.75, round($total, 2));
        $this->assertNotSame(
            6088.50,
            round($total, 2),
            'The old flat-rate bug charged 6 x 0.5% and undercharged by RM 3,044.25'
        );
    }

    public function test_paying_only_the_first_three_months_stays_flat(): void
    {
        $svc = $this->tiered();
        $principal = 202950.00;

        $total = 0;
        for ($month = 1; $month <= 3; $month++) {
            $total += $principal * ($svc->rateForMaintainedMonth($month, 0.5)['rate'] / 100);
        }

        // Months 1-3 are all in the 0.5% tier, so a 3-month payment is unchanged.
        $this->assertSame(3044.25, round($total, 2));
    }

    public function test_a_pledge_with_no_ladder_keeps_the_flat_rate(): void
    {
        // Pledges created before tiering have no rows. They must bill exactly as they
        // always did, or this fix would reprice ~300 live pledges.
        $svc = (new InterestCalculationService())->withTiers([]);

        foreach ([1, 4, 6] as $month) {
            $this->assertSame(0.5, $svc->rateForMaintainedMonth($month, 0.5)['rate']);
        }

        // With no tier, month 7+ still falls back to the flat rate the caller passed.
        $this->assertSame(0.8, $svc->rateForMaintainedMonth(2, 0.8)['rate']);
    }

    public function test_tiers_do_not_leak_between_pledges(): void
    {
        // The service is container-shared, so withTiers() must clone. If it mutated,
        // one tiered pledge would silently reprice the next untiered one in the request.
        $base = new InterestCalculationService();
        $tiered = $base->withTiers(self::LADDER);

        $this->assertSame(1.0, $tiered->rateForMaintainedMonth(4, 0.5)['rate']);
        $this->assertSame(0.5, $base->rateForMaintainedMonth(4, 0.5)['rate'], 'Base service must be untouched');
    }
}
