<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            // Dashboard
            ['module' => 'dashboard', 'action' => 'view', 'name' => 'View Dashboard'],

            // Customers
            ['module' => 'customers', 'action' => 'view', 'name' => 'View Customers'],
            ['module' => 'customers', 'action' => 'create', 'name' => 'Create Customer'],
            ['module' => 'customers', 'action' => 'edit', 'name' => 'Edit Customer'],
            ['module' => 'customers', 'action' => 'delete', 'name' => 'Delete Customer'],
            ['module' => 'customers', 'action' => 'blacklist', 'name' => 'Blacklist Customer', 'requires_passkey' => true],

            // Pledges
            ['module' => 'pledges', 'action' => 'view', 'name' => 'View Pledges'],
            ['module' => 'pledges', 'action' => 'create', 'name' => 'Create Pledge'],
            ['module' => 'pledges', 'action' => 'edit', 'name' => 'Edit Pledge', 'requires_passkey' => true],
            ['module' => 'pledges', 'action' => 'delete', 'name' => 'Delete Pledge', 'requires_passkey' => true],
            ['module' => 'pledges', 'action' => 'print', 'name' => 'Print Pledge Receipt'],
            ['module' => 'pledges', 'action' => 'reprint', 'name' => 'Reprint Pledge Receipt', 'requires_passkey' => true],
            ['module' => 'pledges', 'action' => 'custom_loan', 'name' => 'Custom Loan Percentage', 'requires_passkey' => true],
            ['module' => 'pledges', 'action' => 'custom_deduction', 'name' => 'Custom Stone Deduction', 'requires_passkey' => true],
            ['module' => 'pledges', 'action' => 'assign_storage', 'name' => 'Assign Storage Location'],
            ['module' => 'pledges', 'action' => 'change_storage', 'name' => 'Change Storage Location', 'requires_passkey' => true],

            // Renewals
            ['module' => 'renewals', 'action' => 'view', 'name' => 'View Renewals'],
            ['module' => 'renewals', 'action' => 'create', 'name' => 'Process Renewal'],
            ['module' => 'renewals', 'action' => 'cancel', 'name' => 'Cancel Renewal', 'requires_passkey' => true],
            ['module' => 'renewals', 'action' => 'print', 'name' => 'Print Renewal Receipt'],

            // Redemptions
            ['module' => 'redemptions', 'action' => 'view', 'name' => 'View Redemptions'],
            ['module' => 'redemptions', 'action' => 'create', 'name' => 'Process Redemption'],
            ['module' => 'redemptions', 'action' => 'cancel', 'name' => 'Cancel Redemption', 'requires_passkey' => true],
            ['module' => 'redemptions', 'action' => 'print', 'name' => 'Print Redemption Receipt'],

            // Inventory
            ['module' => 'inventory', 'action' => 'view', 'name' => 'View Inventory'],
            ['module' => 'inventory', 'action' => 'update_location', 'name' => 'Update Item Location'],
            ['module' => 'inventory', 'action' => 'print_barcode', 'name' => 'Print Barcode Label'],

            // Storage
            ['module' => 'storage', 'action' => 'view', 'name' => 'View Storage'],
            ['module' => 'storage', 'action' => 'manage', 'name' => 'Manage Vaults/Boxes/Slots'],

            // Reconciliation
            ['module' => 'reconciliation', 'action' => 'view', 'name' => 'View Reconciliation'],
            ['module' => 'reconciliation', 'action' => 'start', 'name' => 'Start Reconciliation'],
            ['module' => 'reconciliation', 'action' => 'complete', 'name' => 'Complete Reconciliation'],

            // Auctions
            ['module' => 'auctions', 'action' => 'view', 'name' => 'View Auctions'],
            ['module' => 'auctions', 'action' => 'create', 'name' => 'Create Auction'],
            ['module' => 'auctions', 'action' => 'manage', 'name' => 'Manage Auction Items'],
            ['module' => 'auctions', 'action' => 'complete', 'name' => 'Complete Auction'],

            // Reports
            ['module' => 'reports', 'action' => 'view', 'name' => 'View Reports'],
            ['module' => 'reports', 'action' => 'export', 'name' => 'Export Reports'],

            // Day End
            ['module' => 'dayend', 'action' => 'view', 'name' => 'View Day End'],
            ['module' => 'dayend', 'action' => 'open', 'name' => 'Open Day End'],
            ['module' => 'dayend', 'action' => 'verify', 'name' => 'Verify Items/Amounts'],
            ['module' => 'dayend', 'action' => 'close', 'name' => 'Close Day End'],

            // Settings
            ['module' => 'settings', 'action' => 'view', 'name' => 'View Settings'],
            ['module' => 'settings', 'action' => 'edit', 'name' => 'Edit Settings'],
            ['module' => 'settings', 'action' => 'gold_prices', 'name' => 'Update Gold Prices'],

            // Users
            ['module' => 'users', 'action' => 'view', 'name' => 'View Users'],
            ['module' => 'users', 'action' => 'create', 'name' => 'Create User'],
            ['module' => 'users', 'action' => 'edit', 'name' => 'Edit User'],
            ['module' => 'users', 'action' => 'delete', 'name' => 'Delete User'],
            ['module' => 'users', 'action' => 'manage_roles', 'name' => 'Manage Roles'],
            ['module' => 'users', 'action' => 'manage_permissions', 'name' => 'Manage Permissions'],

            // WhatsApp
            ['module' => 'whatsapp', 'action' => 'view', 'name' => 'View WhatsApp'],
            ['module' => 'whatsapp', 'action' => 'send', 'name' => 'Send WhatsApp Message'],
            ['module' => 'whatsapp', 'action' => 'configure', 'name' => 'Configure WhatsApp'],

            // Branches
            ['module' => 'branches', 'action' => 'view', 'name' => 'View Branches'],
            ['module' => 'branches', 'action' => 'manage', 'name' => 'Manage Branches'],
            ['module' => 'branches', 'action' => 'switch', 'name' => 'Switch Branch'],

            // Audit Logs
            ['module' => 'audit', 'action' => 'view', 'name' => 'View Audit Logs'],
        ];

        foreach ($permissions as $permission) {
            Permission::create($permission);
        }

        // Assign all permissions to Super Admin
        $superAdmin = Role::where('slug', 'super-admin')->first();
        $allPermissions = Permission::all();
        foreach ($allPermissions as $permission) {
            $superAdmin->permissions()->attach($permission->id, ['is_enabled' => true]);
        }

        // Assign permissions to Admin (all except manage branches and roles)
        $admin = Role::where('slug', 'admin')->first();
        $adminExclude = ['manage_roles', 'manage_permissions'];
        foreach ($allPermissions as $permission) {
            if (!in_array($permission->action, $adminExclude)) {
                $admin->permissions()->attach($permission->id, ['is_enabled' => true]);
            }
        }

        // Assign permissions to Manager
        $manager = Role::where('slug', 'manager')->first();
        $managerModules = ['dashboard', 'customers', 'pledges', 'renewals', 'redemptions', 'inventory', 'storage', 'reconciliation', 'reports', 'dayend', 'whatsapp'];
        foreach ($allPermissions as $permission) {
            if (in_array($permission->module, $managerModules)) {
                $manager->permissions()->attach($permission->id, ['is_enabled' => true]);
            }
        }

        // Assign permissions to Cashier
        $cashier = Role::where('slug', 'cashier')->first();
        $cashierPermissions = [
            'dashboard' => ['view'],
            'customers' => ['view', 'create', 'edit'],
            'pledges' => ['view', 'create', 'print', 'assign_storage'],
            'renewals' => ['view', 'create', 'print'],
            'redemptions' => ['view', 'create', 'print'],
            'inventory' => ['view', 'print_barcode'],
            'storage' => ['view'],
            'whatsapp' => ['send'],
        ];
        foreach ($allPermissions as $permission) {
            if (isset($cashierPermissions[$permission->module]) && in_array($permission->action, $cashierPermissions[$permission->module])) {
                $cashier->permissions()->attach($permission->id, ['is_enabled' => true]);
            }
        }

        // Assign permissions to Auditor (view only)
        $auditor = Role::where('slug', 'auditor')->first();
        foreach ($allPermissions as $permission) {
            if ($permission->action === 'view') {
                $auditor->permissions()->attach($permission->id, ['is_enabled' => true]);
            }
        }
    }
}
