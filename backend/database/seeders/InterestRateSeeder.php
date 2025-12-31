<?php

namespace Database\Seeders;

use App\Models\InterestRate;
use Illuminate\Database\Seeder;

class InterestRateSeeder extends Seeder
{
    public function run(): void
    {
        $rates = [
            [
                'name' => 'Standard Rate (First 6 Months)',
                'rate_type' => 'standard',
                'rate_percentage' => 0.50,
                'from_month' => 1,
                'to_month' => 6,
                'effective_from' => '2024-01-01',
            ],
            [
                'name' => 'Extended Rate (After 6 Months)',
                'rate_type' => 'extended',
                'rate_percentage' => 1.50,
                'from_month' => 7,
                'to_month' => null,
                'effective_from' => '2024-01-01',
            ],
            [
                'name' => 'Overdue Rate',
                'rate_type' => 'overdue',
                'rate_percentage' => 2.00,
                'from_month' => 1,
                'to_month' => null,
                'effective_from' => '2024-01-01',
            ],
        ];

        foreach ($rates as $rate) {
            InterestRate::create($rate);
        }
    }
}
