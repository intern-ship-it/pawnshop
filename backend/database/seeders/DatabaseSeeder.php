<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            BranchSeeder::class,
            UserSeeder::class,
            CategorySeeder::class,
            PuritySeeder::class,
            BankSeeder::class,
            StoneDeductionSeeder::class,
            InterestRateSeeder::class,
            DefaultSettingsSeeder::class,
            WhatsAppTemplateSeeder::class,
            MarginPresetSeeder::class,
            TermsConditionSeeder::class,
        ]);
    }
}
