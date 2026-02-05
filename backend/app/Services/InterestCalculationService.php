<?php

namespace App\Services;

class InterestCalculationService
{
    // Interest rate constants
    const STANDARD_RATE = 0.5;   // First 6 months if redeemed on time
    const RENEWED_RATE = 1.5;    // Renewal rate (months 7-12 after renewal)
    const OVERDUE_RATE = 2.0;    // Overdue rate (replaces standard if overdue)

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
        ?float $overdueRate = null
    ): array {
        // Use provided rates or defaults
        $standardRate = $standardRate ?? self::STANDARD_RATE;
        $renewedRate = $renewedRate ?? self::RENEWED_RATE;
        $overdueRate = $overdueRate ?? self::OVERDUE_RATE;

        $breakdown = [];
        $cumulative = 0;

        for ($month = 1; $month <= $months; $month++) {
            // Determine rate based on scenario and month
            $rate = $this->getRateForMonth($month, $scenario, $standardRate, $renewedRate, $overdueRate);

            $monthlyInterest = $principal * ($rate / 100);
            $cumulative += $monthlyInterest;

            $breakdown[] = [
                'month' => $month,
                'rate' => $rate,
                'rate_type' => $this->getRateType($month, $scenario),
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
     * - Standard (redeem within 6 months): 0.5% for all months
     * - Renewed (renew before due): 0.5% months 1-6, 1.5% months 7-12
     * - Overdue (no payment after 6 months): 2.0% for ALL months (including first 6 - recalculated)
     */
    private function getRateForMonth(
        int $month,
        string $scenario,
        float $standardRate,
        float $renewedRate,
        float $overdueRate
    ): float {
        switch ($scenario) {
            case 'standard':
                // Redeemed within 6 months - standard rate throughout
                return $standardRate;

            case 'renewed':
                // Renewed before due date
                // First 6 months: standard rate (already paid at 0.5%)
                // Months 7+: renewed rate (1.5%)
                return $month <= 6 ? $standardRate : $renewedRate;

            case 'overdue':
                // CRITICAL: No payment after 6 months
                // ALL months (including first 6) are at overdue rate (2.0%)
                // First 6 months are RECALCULATED at 2.0%
                return $overdueRate;

            default:
                return $standardRate;
        }
    }

    /**
     * Get rate type label for display
     */
    private function getRateType(int $month, string $scenario): string
    {
        switch ($scenario) {
            case 'standard':
                return 'standard';
            case 'renewed':
                return $month <= 6 ? 'standard' : 'renewed';
            case 'overdue':
                return 'overdue';
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
        ?float $overdueRate = null
    ): float {
        $standardRate = $standardRate ?? self::STANDARD_RATE;
        $renewedRate = $renewedRate ?? self::RENEWED_RATE;
        $overdueRate = $overdueRate ?? self::OVERDUE_RATE;

        $totalInterest = 0;

        for ($month = 1; $month <= $months; $month++) {
            $rate = $this->getRateForMonth($month, $scenario, $standardRate, $renewedRate, $overdueRate);
            $totalInterest += $principal * ($rate / 100);
        }

        return round($totalInterest, 2);
    }

    /**
     * Calculate renewal interest (for extending a pledge)
     * 
     * When customer renews BEFORE due date:
     * - They've already paid interest for months 1-6 at standard rate
     * - New period (months 7-12) is at renewed rate (1.5%)
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
            $month = $currentMonth + $i + 1;
            // Renewal always uses renewed rate (1.5%)
            $rate = $renewedRate;
            $monthlyInterest = $principal * ($rate / 100);
            $totalInterest += $monthlyInterest;

            $breakdown[] = [
                'month' => $month,
                'rate' => $rate,
                'rate_type' => 'renewed',
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
     * Calculate full overdue interest (recalculated first 6 months + additional months)
     * 
     * BUSINESS RULE: When overdue, first 6 months are RECALCULATED at 2.0%
     * This replaces any previous 0.5% calculation
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

        // Determine scenario based on status
        if ($status === 'overdue' || $daysOverdue > 0 || $monthsElapsed > 6) {
            // OVERDUE: Recalculate ALL months at overdue rate
            $scenario = 'overdue';
            $overdueCalc = $this->calculateOverdueInterest(
                $principal,
                $monthsElapsed,
                $daysOverdue,
                $overdueRate
            );
            $totalInterest = $overdueCalc['total_interest'];
            $interestBreakdown = $overdueCalc;
        } elseif ($status === 'renewed') {
            // RENEWED: Standard for 1-6, renewed for 7+
            $scenario = 'renewed';
            $totalInterest = $this->calculateInterest(
                $principal,
                $monthsElapsed,
                'renewed',
                $standardRate,
                $renewedRate,
                $overdueRate
            );
            $interestBreakdown = $this->calculateMonthlyBreakdown(
                $principal,
                $monthsElapsed,
                'renewed',
                $standardRate,
                $renewedRate,
                $overdueRate
            );
        } else {
            // ACTIVE/STANDARD: All at standard rate (redeemed within 6 months)
            $scenario = 'standard';
            $totalInterest = $this->calculateInterest(
                $principal,
                $monthsElapsed,
                'standard',
                $standardRate,
                $renewedRate,
                $overdueRate
            );
            $interestBreakdown = $this->calculateMonthlyBreakdown(
                $principal,
                $monthsElapsed,
                'standard',
                $standardRate,
                $renewedRate,
                $overdueRate
            );
        }

        // Fetch handling fee settings
        $handlingFee = $this->getHandlingFee($principal);

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
            'handling_fee' => $handlingFee,
            'total_payable' => round($principal + $totalInterest + $handlingFee, 2),
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
        $value = (float) ($settings['handling_charge_value'] ?? $settings['handling_fee'] ?? 0.50);
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