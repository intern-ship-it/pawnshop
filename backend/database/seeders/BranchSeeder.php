<?php

namespace Database\Seeders;

use App\Models\Branch;
use Illuminate\Database\Seeder;

class BranchSeeder extends Seeder
{
    public function run(): void
    {
        $branches = [
            [
                'code' => 'HQ',
                'name' => 'HQ - Kuala Lumpur',
                'address' => '123 Jalan Bukit Bintang, 55100 Kuala Lumpur',
                'phone' => '03-21234567',
                'email' => 'hq@pawnsys.com',
                'license_no' => 'KPKT-PPG-001-2024',
                'license_expiry' => '2025-12-31',
                'is_active' => true,
                'is_headquarters' => true,
                'settings' => json_encode([
                    'company_name' => 'Dsara Asset Ventures Sdn Bhd',
                    'company_reg_no' => '201901012345',
                ]),
            ],
            [
                'code' => 'PJ',
                'name' => 'Petaling Jaya',
                'address' => '45 Jalan SS2/55, 47300 Petaling Jaya, Selangor',
                'phone' => '03-78765432',
                'email' => 'pj@pawnsys.com',
                'license_no' => 'KPKT-PPG-002-2024',
                'license_expiry' => '2025-12-31',
                'is_active' => true,
                'is_headquarters' => false,
            ],
            [
                'code' => 'JB',
                'name' => 'Johor Bahru',
                'address' => '88 Jalan Wong Ah Fook, 80000 Johor Bahru, Johor',
                'phone' => '07-2234567',
                'email' => 'jb@pawnsys.com',
                'license_no' => 'KPKT-PPG-003-2024',
                'license_expiry' => '2025-12-31',
                'is_active' => true,
                'is_headquarters' => false,
            ],
        ];

        foreach ($branches as $branch) {
            Branch::create($branch);
        }
    }
}
