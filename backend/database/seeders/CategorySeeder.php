<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['code' => 'RING', 'name_en' => 'Ring', 'name_ms' => 'Cincin', 'sort_order' => 1],
            ['code' => 'NECKLACE', 'name_en' => 'Necklace', 'name_ms' => 'Rantai Leher', 'sort_order' => 2],
            ['code' => 'BRACELET', 'name_en' => 'Bracelet', 'name_ms' => 'Gelang Tangan', 'sort_order' => 3],
            ['code' => 'BANGLE', 'name_en' => 'Bangle', 'name_ms' => 'Gelang Kaku', 'sort_order' => 4],
            ['code' => 'EARRING', 'name_en' => 'Earring', 'name_ms' => 'Subang', 'sort_order' => 5],
            ['code' => 'PENDANT', 'name_en' => 'Pendant', 'name_ms' => 'Loket', 'sort_order' => 6],
            ['code' => 'ANKLET', 'name_en' => 'Anklet', 'name_ms' => 'Gelang Kaki', 'sort_order' => 7],
            ['code' => 'BROOCH', 'name_en' => 'Brooch', 'name_ms' => 'Kerongsang', 'sort_order' => 8],
            ['code' => 'CHAIN', 'name_en' => 'Chain', 'name_ms' => 'Rantai', 'sort_order' => 9],
            ['code' => 'BAR', 'name_en' => 'Gold Bar', 'name_ms' => 'Jongkong Emas', 'sort_order' => 10],
            ['code' => 'COIN', 'name_en' => 'Gold Coin', 'name_ms' => 'Dinar Emas', 'sort_order' => 11],
            ['code' => 'OTHER', 'name_en' => 'Other', 'name_ms' => 'Lain-lain', 'sort_order' => 99],
        ];

        foreach ($categories as $category) {
            Category::create($category);
        }
    }
}
