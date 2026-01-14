<?php

namespace App\Services;

class InterestCalculationService
{
    /**
     * Calculate monthly interest breakdown
     */
    public function calculateMonthlyBreakdown(
        float $principal,
        int $months = 6,
        float $standardRate = 0.5,
        float $extendedRate = 1.5
    ): array {
        $breakdown = [];
        $cumulative = 0;

        for ($month = 1; $month <= $months; $month++) {
            // Standard rate for first 6 months, extended rate after
            $rate = $month <= 6 ? $standardRate : $extendedRate;
            $monthlyInterest = $principal * ($rate / 100);
            $cumulative += $monthlyInterest;

            $breakdown[] = [
                'month' => $month,
                'rate' => $rate,
                'interest' => round($monthlyInterest, 2),
                'cumulative' => round($cumulative, 2),
                'total_payable' => round($principal + $cumulative, 2),
            ];
        }

        return $breakdown;
    }

    /**
     * Calculate interest for a specific period
     */
    public function calculateInterest(
        float $principal,
        int $months,
        float $standardRate = 0.5,
        float $extendedRate = 1.5
    ): float {
        $totalInterest = 0;

        for ($month = 1; $month <= $months; $month++) {
            $rate = $month <= 6 ? $standardRate : $extendedRate;
            $totalInterest += $principal * ($rate / 100);
        }

        return round($totalInterest, 2);
    }

    /**
     * Calculate renewal interest
     */
    public function calculateRenewalInterest(
        float $principal,
        int $currentMonth,
        int $renewalMonths,
        float $standardRate = 0.5,
        float $extendedRate = 1.5
    ): array {
        $breakdown = [];
        $totalInterest = 0;

        for ($i = 0; $i < $renewalMonths; $i++) {
            $month = $currentMonth + $i + 1;
            $rate = $month <= 6 ? $standardRate : $extendedRate;
            $monthlyInterest = $principal * ($rate / 100);
            $totalInterest += $monthlyInterest;

            $breakdown[] = [
                'month' => $month,
                'rate' => $rate,
                'interest' => round($monthlyInterest, 2),
            ];
        }

        return [
            'breakdown' => $breakdown,
            'total_interest' => round($totalInterest, 2),
        ];
    }

    /**
     * Calculate overdue interest
     */
    public function calculateOverdueInterest(
        float $principal,
        int $daysOverdue,
        float $overdueRate = 2.0
    ): float {
        // Convert days to months (for daily calculation)
        $dailyRate = ($overdueRate / 100) / 30;
        return round($principal * $dailyRate * $daysOverdue, 2);
    }

    /**
     * Calculate redemption amount
     */
    public function calculateRedemption(
        float $principal,
        int $monthsElapsed,
        int $daysOverdue = 0,
        float $standardRate = 0.5,
        float $extendedRate = 1.5,
        float $overdueRate = 2.0
    ): array {
        // Regular interest
        $regularInterest = $this->calculateInterest(
            $principal,
            $monthsElapsed,
            $standardRate,
            $extendedRate
        );

        // Overdue interest
        $overdueInterest = $daysOverdue > 0
            ? $this->calculateOverdueInterest($principal, $daysOverdue, $overdueRate)
            : 0;

        $totalInterest = $regularInterest + $overdueInterest;

        // Fetch handling fee settings
        $settings = \App\Models\Setting::whereIn('key_name', [
            'handling_charge_type',
            'handling_charge_value',
            'handling_charge_min',
            'handling_fee'
        ])->get()->pluck('value', 'key_name');

        $type = $settings['handling_charge_type'] ?? 'fixed';
        // Use handling_charge_value if present, otherwise fallback to handling_fee, then default 0.50
        $value = (float) ($settings['handling_charge_value'] ?? $settings['handling_fee'] ?? 0.50);
        $min = (float) ($settings['handling_charge_min'] ?? 0);

        $handlingFee = 0;
        if ($type === 'percentage') {
            $handlingFee = $principal * ($value / 100);
            if ($handlingFee < $min)
                $handlingFee = $min;
        } else {
            $handlingFee = $value;
        }

        // Round to 2 decimals
        $handlingFee = round($handlingFee, 2);

        return [
            'principal' => $principal,
            'months_elapsed' => $monthsElapsed,
            'days_overdue' => $daysOverdue,
            'regular_interest' => $regularInterest,
            'overdue_interest' => $overdueInterest,
            'total_interest' => round($totalInterest, 2),
            'handling_fee' => $handlingFee,
            'total_payable' => round($principal + $totalInterest + $handlingFee, 2),
        ];
    }
}
