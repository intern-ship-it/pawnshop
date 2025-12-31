<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use App\Models\Branch;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $hq = Branch::where('code', 'HQ')->first();
        $superAdmin = Role::where('slug', 'super-admin')->first();
        $admin = Role::where('slug', 'admin')->first();
        $manager = Role::where('slug', 'manager')->first();
        $cashier = Role::where('slug', 'cashier')->first();

        // Super Admin
        User::create([
            'branch_id' => $hq->id,
            'employee_id' => 'EMP001',
            'name' => 'Super Admin',
            'username' => 'superadmin',
            'email' => 'superadmin@pawnsys.com',
            'phone' => '0123456789',
            'password' => Hash::make('password123'),
            'passkey' => Hash::make('123456'),
            'role_id' => $superAdmin->id,
            'is_active' => true,
        ]);

        // Admin
        User::create([
            'branch_id' => $hq->id,
            'employee_id' => 'EMP002',
            'name' => 'Admin User',
            'username' => 'admin',
            'email' => 'admin@pawnsys.com',
            'phone' => '0123456780',
            'password' => Hash::make('password123'),
            'passkey' => Hash::make('123456'),
            'role_id' => $admin->id,
            'is_active' => true,
        ]);

        // Manager
        User::create([
            'branch_id' => $hq->id,
            'employee_id' => 'EMP003',
            'name' => 'Branch Manager',
            'username' => 'manager',
            'email' => 'manager@pawnsys.com',
            'phone' => '0123456781',
            'password' => Hash::make('password123'),
            'passkey' => Hash::make('123456'),
            'role_id' => $manager->id,
            'is_active' => true,
        ]);

        // Cashier
        User::create([
            'branch_id' => $hq->id,
            'employee_id' => 'EMP004',
            'name' => 'Cashier Staff',
            'username' => 'cashier',
            'email' => 'cashier@pawnsys.com',
            'phone' => '0123456782',
            'password' => Hash::make('password123'),
            'role_id' => $cashier->id,
            'is_active' => true,
        ]);
    }
}
