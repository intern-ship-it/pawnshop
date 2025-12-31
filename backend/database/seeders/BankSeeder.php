<?php

namespace Database\Seeders;

use App\Models\Bank;
use Illuminate\Database\Seeder;

class BankSeeder extends Seeder
{
    public function run(): void
    {
        $banks = [
            ['code' => 'MBB', 'name' => 'Maybank', 'swift_code' => 'MBBEMYKL', 'sort_order' => 1],
            ['code' => 'CIMB', 'name' => 'CIMB Bank', 'swift_code' => 'CIBBMYKL', 'sort_order' => 2],
            ['code' => 'PBB', 'name' => 'Public Bank', 'swift_code' => 'PABORBB', 'sort_order' => 3],
            ['code' => 'RHB', 'name' => 'RHB Bank', 'swift_code' => 'RHBBMYKL', 'sort_order' => 4],
            ['code' => 'HLB', 'name' => 'Hong Leong Bank', 'swift_code' => 'HLBBMYKL', 'sort_order' => 5],
            ['code' => 'AMB', 'name' => 'AmBank', 'swift_code' => 'ARBKMYKL', 'sort_order' => 6],
            ['code' => 'BIMB', 'name' => 'Bank Islam', 'swift_code' => 'BIMBMYKL', 'sort_order' => 7],
            ['code' => 'BSN', 'name' => 'Bank Simpanan Nasional', 'swift_code' => 'BSNAMYK1', 'sort_order' => 8],
            ['code' => 'AFFIN', 'name' => 'Affin Bank', 'swift_code' => 'PHBMMYKL', 'sort_order' => 9],
            ['code' => 'MUAMALAT', 'name' => 'Bank Muamalat', 'swift_code' => 'BMMBMYKL', 'sort_order' => 10],
            ['code' => 'OCBC', 'name' => 'OCBC Bank', 'swift_code' => 'OCBCMYKL', 'sort_order' => 11],
            ['code' => 'UOB', 'name' => 'UOB Bank', 'swift_code' => 'UOVBMYKL', 'sort_order' => 12],
            ['code' => 'HSBC', 'name' => 'HSBC Bank', 'swift_code' => 'HBMBMYKL', 'sort_order' => 13],
            ['code' => 'SCB', 'name' => 'Standard Chartered', 'swift_code' => 'SCBLMYKX', 'sort_order' => 14],
            ['code' => 'AGROBANK', 'name' => 'Agrobank', 'swift_code' => 'BPMBMYKL', 'sort_order' => 15],
            ['code' => 'ALLIANCE', 'name' => 'Alliance Bank', 'swift_code' => 'MFBBMYKL', 'sort_order' => 16],
            ['code' => 'RAKYAT', 'name' => 'Bank Rakyat', 'swift_code' => 'BKRMMYKL', 'sort_order' => 17],
        ];

        foreach ($banks as $bank) {
            Bank::create($bank);
        }
    }
}
