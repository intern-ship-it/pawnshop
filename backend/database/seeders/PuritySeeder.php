<?php

namespace Database\Seeders;

use App\Models\Purity;
use Illuminate\Database\Seeder;

class PuritySeeder extends Seeder
{
    public function run(): void
    {
        $purities = [
            ['code' => '999', 'name' => '999 (24K)', 'karat' => '24K', 'percentage' => 99.90, 'sort_order' => 1],
            ['code' => '916', 'name' => '916 (22K)', 'karat' => '22K', 'percentage' => 91.60, 'sort_order' => 2],
            ['code' => '875', 'name' => '875 (21K)', 'karat' => '21K', 'percentage' => 87.50, 'sort_order' => 3],
            ['code' => '750', 'name' => '750 (18K)', 'karat' => '18K', 'percentage' => 75.00, 'sort_order' => 4],
            ['code' => '585', 'name' => '585 (14K)', 'karat' => '14K', 'percentage' => 58.50, 'sort_order' => 5],
            ['code' => '375', 'name' => '375 (9K)', 'karat' => '9K', 'percentage' => 37.50, 'sort_order' => 6],
        ];

        foreach ($purities as $purity) {
            Purity::create($purity);
        }
    }
}
