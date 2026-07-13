<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Hidden `developer` role + a DORMANT developer account.
     *
     * The account is created with NO password, NO passkey and is_active = false,
     * so this migration commits no usable credential to the repository. It cannot
     * be logged into as-is. Run `php artisan developer:credentials` to mint real
     * credentials at deploy time; they are printed once to the operator's terminal
     * and never stored in source control.
     *
     * The role is filtered out of RoleController::index(), which feeds both the
     * Roles page and the user-edit role dropdown, so it cannot be granted through
     * the UI either.
     */
    public function up(): void
    {
        if (DB::table('roles')->where('slug', 'developer')->exists()) {
            return;
        }

        $roleId = DB::table('roles')->insertGetId([
            'name'        => 'Developer',
            'slug'        => 'developer',
            'description' => 'Internal maintenance tooling. Hidden from role management.',
            'is_system'   => true,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        // Reuse whichever branch the existing superadmin sits in (HQ).
        $branchId = DB::table('users')->whereNotNull('branch_id')->value('branch_id')
            ?? DB::table('branches')->value('id');

        if (DB::table('users')->where('username', 'developer')->doesntExist()) {
            DB::table('users')->insert([
                'name'      => 'Developer',
                'username'  => 'developer',
                'email'     => 'developer@pawnsys.local',
                // Deliberately unusable until `developer:credentials` is run.
                // An empty-string hash can never match Hash::check(), and the
                // account is inactive besides.
                'password'  => '',
                'passkey'   => null,
                'role_id'   => $roleId,
                'branch_id' => $branchId,
                'is_active' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $roleId = DB::table('roles')->where('slug', 'developer')->value('id');
        DB::table('users')->where('username', 'developer')->delete();
        if ($roleId) {
            DB::table('role_permissions')->where('role_id', $roleId)->delete();
            DB::table('roles')->where('id', $roleId)->delete();
        }
    }
};
