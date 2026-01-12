<?php

namespace Database\Seeders;

use App\Models\MarginPreset;
use Illuminate\Database\Seeder;

class MarginPresetSeeder extends Seeder
{
    public function run(): void
    {
        $presets = [
            ['value' => 80, 'label' => '80%', 'is_default' => true, 'sort_order' => 1],
            ['value' => 75, 'label' => '75%', 'is_default' => false, 'sort_order' => 2],
            ['value' => 70, 'label' => '70%', 'is_default' => false, 'sort_order' => 3],
            ['value' => 65, 'label' => '65%', 'is_default' => false, 'sort_order' => 4],
            ['value' => 60, 'label' => '60%', 'is_default' => false, 'sort_order' => 5],
        ];

        foreach ($presets as $preset) {
            MarginPreset::create($preset);
        }
    }
}