<?php

namespace Database\Seeders;

use App\Models\StoneDeduction;
use Illuminate\Database\Seeder;

class StoneDeductionSeeder extends Seeder
{
    public function run(): void
    {
        $deductions = [
            // Percentage deductions
            ['name' => 'No Deduction', 'deduction_type' => 'percentage', 'value' => 0, 'is_default' => true, 'sort_order' => 1],
            ['name' => '5% Stone', 'deduction_type' => 'percentage', 'value' => 5, 'sort_order' => 2],
            ['name' => '10% Stone', 'deduction_type' => 'percentage', 'value' => 10, 'sort_order' => 3],
            ['name' => '15% Stone', 'deduction_type' => 'percentage', 'value' => 15, 'sort_order' => 4],
            ['name' => '20% Stone', 'deduction_type' => 'percentage', 'value' => 20, 'sort_order' => 5],

            // Amount deductions (RM)
            ['name' => 'RM 5 Deduction', 'deduction_type' => 'amount', 'value' => 5, 'sort_order' => 10],
            ['name' => 'RM 10 Deduction', 'deduction_type' => 'amount', 'value' => 10, 'sort_order' => 11],
            ['name' => 'RM 20 Deduction', 'deduction_type' => 'amount', 'value' => 20, 'sort_order' => 12],
            ['name' => 'RM 50 Deduction', 'deduction_type' => 'amount', 'value' => 50, 'sort_order' => 13],

            // Grams deductions
            ['name' => '0.5g Stone', 'deduction_type' => 'grams', 'value' => 0.5, 'sort_order' => 20],
            ['name' => '1g Stone', 'deduction_type' => 'grams', 'value' => 1, 'sort_order' => 21],
            ['name' => '2g Stone', 'deduction_type' => 'grams', 'value' => 2, 'sort_order' => 22],
            ['name' => '3g Stone', 'deduction_type' => 'grams', 'value' => 3, 'sort_order' => 23],
            ['name' => '5g Stone', 'deduction_type' => 'grams', 'value' => 5, 'sort_order' => 24],
        ];

        foreach ($deductions as $deduction) {
            StoneDeduction::create($deduction);
        }
    }
}
