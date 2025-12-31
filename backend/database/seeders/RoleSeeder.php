<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name' => 'Super Admin',
                'slug' => 'super-admin',
                'description' => 'Full system access with all permissions',
                'is_system' => true,
            ],
            [
                'name' => 'Admin',
                'slug' => 'admin',
                'description' => 'Branch administrator with most permissions',
                'is_system' => true,
            ],
            [
                'name' => 'Manager',
                'slug' => 'manager',
                'description' => 'Branch manager with approval rights',
                'is_system' => true,
            ],
            [
                'name' => 'Cashier',
                'slug' => 'cashier',
                'description' => 'Front desk staff for daily operations',
                'is_system' => true,
            ],
            [
                'name' => 'Auditor',
                'slug' => 'auditor',
                'description' => 'Read-only access for audit purposes',
                'is_system' => true,
            ],
        ];

        foreach ($roles as $role) {
            Role::create($role);
        }
    }
}
