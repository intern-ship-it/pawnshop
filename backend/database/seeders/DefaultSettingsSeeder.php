<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Models\GoldPrice;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class DefaultSettingsSeeder extends Seeder
{
    public function run(): void
    {
        // Company Settings
        $companySettings = [
            ['category' => 'company', 'key_name' => 'name', 'value' => 'Dsara Asset Ventures Sdn Bhd', 'value_type' => 'string'],
            ['category' => 'company', 'key_name' => 'registration_no', 'value' => '201901012345', 'value_type' => 'string'],
            ['category' => 'company', 'key_name' => 'address', 'value' => '123 Jalan Bukit Bintang, 55100 Kuala Lumpur', 'value_type' => 'string'],
            ['category' => 'company', 'key_name' => 'phone', 'value' => '03-21234567', 'value_type' => 'string'],
            ['category' => 'company', 'key_name' => 'email', 'value' => 'info@dsara.com', 'value_type' => 'string'],
            ['category' => 'company', 'key_name' => 'website', 'value' => 'www.dsara.com', 'value_type' => 'string'],
        ];

        // Pledge Settings
        $pledgeSettings = [
            ['category' => 'pledge', 'key_name' => 'prefix', 'value' => 'PLG', 'value_type' => 'string'],
            ['category' => 'pledge', 'key_name' => 'default_loan_percentage', 'value' => '70', 'value_type' => 'number'],
            ['category' => 'pledge', 'key_name' => 'max_renewal_months', 'value' => '6', 'value_type' => 'number'],
            ['category' => 'pledge', 'key_name' => 'grace_period_days', 'value' => '7', 'value_type' => 'number'],
            ['category' => 'pledge', 'key_name' => 'handling_fee', 'value' => '0.50', 'value_type' => 'number'],
            ['category' => 'pledge', 'key_name' => 'handling_fee_min_loan', 'value' => '10', 'value_type' => 'number'],
        ];

        // Receipt Settings
        $receiptSettings = [
            ['category' => 'receipt', 'key_name' => 'reprint_charge', 'value' => '2.00', 'value_type' => 'number'],
            ['category' => 'receipt', 'key_name' => 'first_print_free', 'value' => 'true', 'value_type' => 'boolean'],
            ['category' => 'receipt', 'key_name' => 'paper_size', 'value' => 'A5', 'value_type' => 'string'],
        ];

        // Reconciliation Settings
        $reconciliationSettings = [
            ['category' => 'reconciliation', 'key_name' => 'schedule', 'value' => 'weekly', 'value_type' => 'string'],
            ['category' => 'reconciliation', 'key_name' => 'require_manager', 'value' => 'true', 'value_type' => 'boolean'],
        ];

        // All settings
        $allSettings = array_merge($companySettings, $pledgeSettings, $receiptSettings, $reconciliationSettings);

        foreach ($allSettings as $setting) {
            Setting::create($setting);
        }

        // Add today's gold prices
        GoldPrice::create([
            'price_date' => Carbon::today(),
            'price_999' => 410.00,
            'price_916' => 378.00,
            'price_875' => 359.00,
            'price_750' => 308.00,
            'price_585' => 240.00,
            'price_375' => 154.00,
            'source' => 'manual',
        ]);
    }
}
