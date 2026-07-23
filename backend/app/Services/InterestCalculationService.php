<?php

namespace App\Services;

class InterestCalculationService
{
    // Interest rate constants
    const STANDARD_RATE = 0.5;   // First 6 months if redeemed on time
    const RENEWED_RATE = 1.5;    // Renewal rate (months 7-12 after renewal)
    const OVERDUE_RATE = 2.0;    // Overdue rate (replaces standard if overdue)

    /**
     * The pledge's frozen month-based rate ladder, if it has one.
     *
     * Rows of ['from_month' => int, 'to_month' => ?int, 'rate_percentage' => float],
     * lowest month first. Empty means "no tiers" — fall back to the flat split.
     */
    private array $tiers = [];

    /**
     * A copy of this service that reads the given ladder.
     *
     * Returns a clone rather than mutating, because the container shares one
     * instance across a request: a pledge's tiers must never leak into the next
     * pledge's calculation.
     */
    /**
     * A copy of this service that reads the given pledge's frozen ladder.
     * Pledges created before tiering have none, and keep the flat behaviour.
     */
    public function forPledge(\App\Models\Pledge $pledge): self
    {
        return $this->withTiers($pledge->interestTiers);
    }

    public function withTiers(iterable $tiers): self
    {
        $rows = [];
        foreach ($tiers as $tier) {
            // Accept models, arrays, or anything array-accessible.
            $get = fn(string $key) => is_array($tier) ? ($tier[$key] ?? null) : $tier->$key;

            $to = $get('to_month');
            $rows[] = [
                'from_month' => (int) $get('from_month'),
                'to_month' => $to === null ? null : (int) $to,
                'rate_percentage' => (float) $get('rate_percentage'),
                'rate_type' => (string) $get('rate_type'),
            ];
        }

        usort($rows, fn($a, $b) => $a['from_month'] <=> $b['from_month']);

        $clone = clone $this;
        $clone->tiers = $rows;

        return $clone;
    }

    /**
     * Calculate monthly interest breakdown based on scenario
     * 
     * Scenarios:
     * - 'standard': Customer redeems within 6 months (0.5% throughout)
     * - 'renewed': Customer renews before due date (0.5% months 1-6, 1.5% months 7-12)
     * - 'overdue': No payment after 6 months (2.0% for ALL months including first 6)
     */
    public function calculateMonthlyBreakdown(
        float $principal,
        int $months = 6,
        string $scenario = 'standard',
        ?float $standardRate = null,
        ?float $renewedRate = null,
        ?float $overdueRate = null,
        int $maintainedMonths = 0
    ): array {
        // Use provided rates or defaults
        $standardRate = $standardRate ?? self::STANDARD_RATE;
        $renewedRate = $renewedRate ?? self::RENEWED_RATE;
        $overdueRate = $overdueRate ?? self::OVERDUE_RATE;

        $breakdown = [];
        $cumulative = 0;

        for ($month = 1; $month <= $months; $month++) {
            // Determine rate based on scenario and month
            $rate = $this->getRateForMonth($month, $scenario, $standardRate, $renewedRate, $overdueRate, $maintainedMonths);

            $monthlyInterest = $principal * ($rate / 100);
            $cumulative += $monthlyInterest;

            $breakdown[] = [
                'month' => $month,
                'rate' => $rate,
                'rate_type' => $this->getRateType($month, $scenario, $maintainedMonths),
                'interest' => round($monthlyInterest, 2),
                'cumulative' => round($cumulative, 2),
                'total_payable' => round($principal + $cumulative, 2),
            ];
        }

        return $breakdown;
    }

    /**
     * Get interest rate for a specific month based on scenario
     *
     * BUSINESS RULES:
     * - Standard (redeem within 6 months): standard rate for all months
     * - Renewed (maintained past month 6): standard months 1-6, extended months 7+
     * - Overdue (past due date): months up to the due date keep the rate they
     *   accrued at; only the months past the due date take the overdue rate.
     *
     * Interest already accrued is NOT rebilled. A pledge one day late is charged
     * the overdue rate on that month alone, not retroactively on months 1-6.
     */
    private function getRateForMonth(
        int $month,
        string $scenario,
        float $standardRate,
        float $renewedRate,
        float $overdueRate,
        int $maintainedMonths = 0
    ): float {
        switch ($scenario) {
            case 'standard':
                return $this->maintainedRateForMonth($month, $standardRate, $renewedRate);

            case 'renewed':
                return $this->maintainedRateForMonth($month, $standardRate, $renewedRate);

            case 'overdue':
                // Months on or before the due date accrued while the pledge was
                // maintained, so they keep the rate they accrued at. Only months
                // past the due date take the overdue rate.
                return $month <= $maintainedMonths
                    ? $this->maintainedRateForMonth($month, $standardRate, $renewedRate)
                    : $overdueRate;

            default:
                // Callers that pass a non-scenario here (e.g. a rate) must keep
                // their existing flat-rate behaviour.
                return $standardRate;
        }
    }

    /**
     * The rate a maintained (not overdue) pledge pays in a given month.
     *
     * Consults the pledge's frozen tier ladder when one has been supplied via
     * withTiers(). Pledges created before tiering have none, and fall back to the
     * flat "standard for months 1-6, extended thereafter" split they have always
     * used — which is why no existing bill moves.
     */
    private function maintainedRateForMonth(int $month, float $standardRate, float $renewedRate): float
    {
        $tier = $this->tierForMonth($month);
        if ($tier !== null) {
            return (float) $tier['rate_percentage'];
        }

        return $month <= 6 ? $standardRate : $renewedRate;
    }

    /**
     * The rate and label for a single maintained month, for callers that bill month
     * by month rather than from month 1 (the interest-payment screen pays months
     * 4-6 on their own, so it cannot use calculateMonthlyBreakdown's 1..n loop).
     *
     * $flatRate is the rate to fall back on when the pledge has no tier covering
     * this month — an untiered pledge, or a manual override that deliberately
     * flattens the ladder.
     */
    public function rateForMaintainedMonth(int $month, float $flatRate): array
    {
        $tier = $this->tierForMonth($month);

        return [
            'rate' => $tier !== null ? (float) $tier['rate_percentage'] : $flatRate,
            'rate_type' => $tier !== null ? $tier['rate_type'] : ($month <= 6 ? 'standard' : 'renewed'),
        ];
    }

    /**
     * How many whole months a sum of money covers when charged down the ladder from
     * month 1. The interest-payment screen used to derive "months already paid" from
     * payment dates, which miscounted (2 months of money read as 3) and then billed
     * the wrong tier. Counting the money itself is exact and cannot drift.
     *
     * Only whole covered months count: a part-paid month is not "paid". Stops at
     * $maxMonths (the term length) so overpayment cannot report more than a full term.
     */
    public function monthsCoveredBy(float $amountPaid, float $principal, float $flatRate, int $maxMonths = 6, int $firstMonth = 1): int
    {
        if ($principal <= 0) {
            return 0;
        }

        $remaining = $amountPaid;
        $covered = 0;

        // Count from the term's real ladder position: a renewed pledge's second term
        // starts at month 7, where the extended rate applies. Counting from month 1
        // would price its months at the cheaper opening tiers.
        for ($offset = 0; $offset < $maxMonths; $offset++) {
            $month = $firstMonth + $offset;
            $monthCost = $principal * ($this->rateForMaintainedMonth($month, $flatRate)['rate'] / 100);
            // A free month (0% rate) is trivially covered; otherwise it must be
            // fully funded. Allow a cent of rounding slack.
            if ($monthCost <= 0 || $remaining + 0.005 >= $monthCost) {
                $remaining -= $monthCost;
                $covered++;
            } else {
                break;
            }
        }

        return $covered;
    }

    /**
     * The label for a maintained month: the tier's own rate_type, or the flat split.
     */
    private function maintainedTypeForMonth(int $month): string
    {
        $tier = $this->tierForMonth($month);
        if ($tier !== null) {
            return $tier['rate_type'];
        }

        return $month <= 6 ? 'standard' : 'renewed';
    }

    /**
     * The frozen tier covering this month, or null when the pledge has no ladder.
     * A null to_month means the tier runs onwards with no upper bound.
     */
    private function tierForMonth(int $month): ?array
    {
        foreach ($this->tiers as $tier) {
            if ($month >= $tier['from_month']
                && ($tier['to_month'] === null || $month <= $tier['to_month'])) {
                return $tier;
            }
        }

        return null;
    }

    /**
     * Get rate type label for display
     */
    private function getRateType(int $month, string $scenario, int $maintainedMonths = 0): string
    {
        switch ($scenario) {
            case 'standard':
                return $this->maintainedTypeForMonth($month);
            case 'renewed':
                return $this->maintainedTypeForMonth($month);
            case 'overdue':
                return $month <= $maintainedMonths
                    ? $this->maintainedTypeForMonth($month)
                    : 'overdue';
            default:
                return 'standard';
        }
    }

    /**
     * Calculate total interest for a specific period and scenario
     */
    public function calculateInterest(
        float $principal,
        int $months,
        string $scenario = 'standard',
        ?float $standardRate = null,
        ?float $renewedRate = null,
        ?float $overdueRate = null,
        int $maintainedMonths = 0
    ): float {
        $standardRate = $standardRate ?? self::STANDARD_RATE;
        $renewedRate = $renewedRate ?? self::RENEWED_RATE;
        $overdueRate = $overdueRate ?? self::OVERDUE_RATE;

        $totalInterest = 0;

        for ($month = 1; $month <= $months; $month++) {
            $rate = $this->getRateForMonth($month, $scenario, $standardRate, $renewedRate, $overdueRate, $maintainedMonths);
            $totalInterest += $principal * ($rate / 100);
        }

        return round($totalInterest, 2);
    }

    /**
     * Interest accrued over a run of months, used by the renewal screen to show what
     * has built up so far (months 1..elapsed).
     *
     * Honours the pledge's frozen tier ladder when one has been supplied. Without it
     * the flat $renewedRate applies to every month, as before — which is correct for
     * an untiered pledge and was wrong for a tiered one: months 4-6 of a 0.5/1.0
     * ladder were billed at 0.5%, understating what redemption would charge and
     * letting a renewal through on interest that was not really settled.
     */
    public function calculateRenewalInterest(
        float $principal,
        int $currentMonth,
        int $renewalMonths,
        ?float $renewedRate = null
    ): array {
        $renewedRate = $renewedRate ?? self::RENEWED_RATE;

        $breakdown = [];
        $totalInterest = 0;

        for ($i = 0; $i < $renewalMonths; $i++) {
            $month = $currentMonth + $i;
            // A tier for this month wins; otherwise the flat rate, as before.
            $tier = $this->tierForMonth($month);
            $rate = $tier !== null ? (float) $tier['rate_percentage'] : $renewedRate;
            $monthlyInterest = $principal * ($rate / 100);
            $totalInterest += $monthlyInterest;

            $breakdown[] = [
                'month' => $month,
                'rate' => $rate,
                'rate_type' => $tier !== null ? $tier['rate_type'] : 'renewed',
                'interest' => round($monthlyInterest, 2),
            ];
        }

        return [
            'breakdown' => $breakdown,
            'total_interest' => round($totalInterest, 2),
            'monthly_interest' => round($principal * ($renewedRate / 100), 2),
        ];
    }

    /**
     * Calculate overdue penalty interest (daily calculation for days beyond term)
     */
    public function calculateOverduePenalty(
        float $principal,
        int $daysOverdue,
        ?float $overdueRate = null
    ): float {
        $overdueRate = $overdueRate ?? self::OVERDUE_RATE;

        // Convert monthly rate to daily rate
        $dailyRate = ($overdueRate / 100) / 30;
        return round($principal * $dailyRate * $daysOverdue, 2);
    }

    /**
     * @deprecated Rebills every month at the overdue rate, including months that
     * accrued while the pledge was still maintained. The branch's rule is that
     * only months past the due date take the overdue rate, so calculateRedemption()
     * no longer calls this. Retained for callers outside this codebase.
     */
    public function calculateOverdueInterest(
        float $principal,
        int $totalMonthsElapsed,
        int $daysOverdueBeyondMonths = 0,
        ?float $overdueRate = null
    ): array {
        $overdueRate = $overdueRate ?? self::OVERDUE_RATE;

        // All months at overdue rate (including first 6 which are recalculated)
        $monthlyInterest = $principal * ($overdueRate / 100);
        $totalMonthlyInterest = $monthlyInterest * $totalMonthsElapsed;

        // Additional daily penalty for days beyond complete months
        $dailyPenalty = $this->calculateOverduePenalty($principal, $daysOverdueBeyondMonths, $overdueRate);

        // Calculate what they WOULD have paid at standard rate (for comparison)
        $standardRate = self::STANDARD_RATE;
        $wouldHavePaidStandard = $principal * ($standardRate / 100) * min($totalMonthsElapsed, 6);

        // The additional amount due to recalculation
        $recalculationDifference = ($monthlyInterest * min($totalMonthsElapsed, 6)) - $wouldHavePaidStandard;

        return [
            'months_elapsed' => $totalMonthsElapsed,
            'days_overdue' => $daysOverdueBeyondMonths,
            'rate_applied' => $overdueRate,
            'monthly_interest' => round($monthlyInterest, 2),
            'total_monthly_interest' => round($totalMonthlyInterest, 2),
            'daily_penalty' => round($dailyPenalty, 2),
            'total_interest' => round($totalMonthlyInterest + $dailyPenalty, 2),
            'recalculation_difference' => round($recalculationDifference, 2),
            'note' => 'First 6 months recalculated at overdue rate (' . $overdueRate . '%)',
        ];
    }

    /**
     * Calculate redemption amount based on pledge status
     * 
     * @param string $status 'active' | 'renewed' | 'overdue'
     */
    public function calculateRedemption(
        float $principal,
        int $monthsElapsed,
        int $daysOverdue = 0,
        string $status = 'active',
        ?float $standardRate = null,
        ?float $renewedRate = null,
        ?float $overdueRate = null
    ): array {
        $standardRate = $standardRate ?? self::STANDARD_RATE;
        $renewedRate = $renewedRate ?? self::RENEWED_RATE;
        $overdueRate = $overdueRate ?? self::OVERDUE_RATE;

        $interestBreakdown = [];
        $totalInterest = 0;

        // A pledge is "not maintained" only when it has passed its due date —
        // being more than 6 months old is NOT the same thing, because a renewal
        // legitimately carries a pledge past month 6 while moving the due date.
        // Settings states the rule: "Extended rate applies after 6 months if
        // maintained. Overdue rate applies if pledge is not maintained."
        if ($status === 'overdue' || $daysOverdue > 0) {
            // NOT MAINTAINED: only the months past the due date take the overdue
            // rate. Interest that accrued while the pledge was still maintained is
            // never rebilled — a pledge one day late owes the overdue rate on that
            // month alone, not retroactively on months 1-6.
            $scenario = 'overdue';

            // Started months of lateness, matching how months_elapsed rounds up.
            $overdueMonths = (int) ceil($daysOverdue / 30);
            $maintainedMonths = max(0, $monthsElapsed - $overdueMonths);

            $totalInterest = $this->calculateInterest(
                $principal,
                $monthsElapsed,
                $scenario,
                $standardRate,
                $renewedRate,
                $overdueRate,
                $maintainedMonths
            );
            $interestBreakdown = $this->calculateMonthlyBreakdown(
                $principal,
                $monthsElapsed,
                $scenario,
                $standardRate,
                $renewedRate,
                $overdueRate,
                $maintainedMonths
            );
        } else {
            // MAINTAINED: standard rate for months 1-6, extended rate from 7 on.
            // 'renewed' is the scenario that applies the extended rate per month;
            // it is correct for any maintained pledge, renewed or not, because a
            // pledge only reaches month 7 by being renewed.
            $scenario = $monthsElapsed > 6 ? 'renewed' : 'standard';
            $totalInterest = $this->calculateInterest(
                $principal,
                $monthsElapsed,
                $scenario,
                $standardRate,
                $renewedRate,
                $overdueRate
            );
            $interestBreakdown = $this->calculateMonthlyBreakdown(
                $principal,
                $monthsElapsed,
                $scenario,
                $standardRate,
                $renewedRate,
                $overdueRate
            );
        }

        return [
            'principal' => $principal,
            'months_elapsed' => $monthsElapsed,
            'days_overdue' => $daysOverdue,
            'status' => $status,
            'scenario' => $scenario,
            'rates_applied' => [
                'standard' => $standardRate,
                'renewed' => $renewedRate,
                'overdue' => $overdueRate,
            ],
            'interest_breakdown' => $interestBreakdown,
            'total_interest' => round($totalInterest, 2),
            'total_payable' => round($principal + $totalInterest, 2),
        ];
    }

    /**
     * Get handling fee from settings
     */
    private function getHandlingFee(float $principal): float
    {
        $settings = \App\Models\Setting::whereIn('key_name', [
            'handling_charge_type',
            'handling_charge_value',
            'handling_charge_min',
            'handling_fee'
        ])->get()->pluck('value', 'key_name');

        $type = $settings['handling_charge_type'] ?? 'fixed';
        $value = (float) ($settings['handling_charge_value'] ?? $settings['handling_fee'] ?? 0);
        $min = (float) ($settings['handling_charge_min'] ?? 0);

        $handlingFee = 0;
        if ($type === 'percentage') {
            $handlingFee = $principal * ($value / 100);
            if ($handlingFee < $min) {
                $handlingFee = $min;
            }
        } else {
            $handlingFee = $value;
        }

        return round($handlingFee, 2);
    }

    /**
     * Get interest summary for display
     */
    public function getInterestSummary(float $principal): array
    {
        $standardMonthly = $principal * (self::STANDARD_RATE / 100);
        $renewedMonthly = $principal * (self::RENEWED_RATE / 100);
        $overdueMonthly = $principal * (self::OVERDUE_RATE / 100);

        return [
            'principal' => $principal,
            'rates' => [
                'standard' => self::STANDARD_RATE,
                'renewed' => self::RENEWED_RATE,
                'overdue' => self::OVERDUE_RATE,
            ],
            'monthly_interest' => [
                'standard' => round($standardMonthly, 2),
                'renewed' => round($renewedMonthly, 2),
                'overdue' => round($overdueMonthly, 2),
            ],
            'six_month_total' => [
                'standard' => round($standardMonthly * 6, 2),
                'overdue' => round($overdueMonthly * 6, 2),
            ],
            'twelve_month_total' => [
                'renewed' => round(($standardMonthly * 6) + ($renewedMonthly * 6), 2),
                'overdue' => round($overdueMonthly * 12, 2),
            ],
        ];
    }
}