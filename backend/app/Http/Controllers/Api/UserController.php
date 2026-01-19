<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Permission;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
{
    /**
     * List users
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Super admin sees all users, others see only their branch
        if ($user->isSuperAdmin()) {
            $query = User::with(['role', 'branch']);
        } else {
            $query = User::where('branch_id', $user->branch_id)
                ->with(['role', 'branch']);
        }

        // Search filter
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%");
            });
        }

        $users = $query->orderBy('name')->get();

        return $this->success($users);
    }

    /**
     * Create user
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_id' => 'required|string|max:20|unique:users,employee_id',
            'username' => 'required|string|max:50|unique:users,username',
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:100|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'password' => 'required|string|min:8',
            'role_id' => 'required|exists:roles,id',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'nullable|boolean',
            'custom_permissions' => 'nullable|array',
            'custom_permissions.granted' => 'nullable|array',
            'custom_permissions.granted.*' => 'integer|exists:permissions,id',
            'custom_permissions.revoked' => 'nullable|array',
            'custom_permissions.revoked.*' => 'integer|exists:permissions,id',
        ]);

        // Determine branch
        if ($request->user()->isSuperAdmin() && isset($validated['branch_id'])) {
            $branchId = $validated['branch_id'];
        } else {
            $branchId = $request->user()->branch_id;
        }

        $user = User::create([
            'branch_id' => $branchId,
            'employee_id' => $validated['employee_id'],
            'username' => $validated['username'],
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => Hash::make($validated['password']),
            'role_id' => $validated['role_id'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        // Handle custom permissions
        if (!empty($validated['custom_permissions'])) {
            $this->syncCustomPermissions($user, $validated['custom_permissions']);
        }

        $user->load(['role', 'branch']);

        // Audit log - user created
        try {
            AuditLog::create([
                'branch_id' => $request->user()->branch_id,
                'user_id' => $request->user()->id,
                'action' => 'create',
                'module' => 'user',
                'description' => "Created user {$user->name} ({$user->employee_id})",
                'record_type' => 'User',
                'record_id' => $user->id,
                'new_values' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role->name ?? null,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'info',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Audit log failed: ' . $e->getMessage());
        }

        return $this->success($user, 'User created successfully', 201);
    }

    /**
     * Get user details with permissions
     */
    public function show(Request $request, User $user): JsonResponse
    {
        // Authorization check
        if (!$request->user()->isSuperAdmin() && $user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $user->load(['role', 'branch', 'customPermissions']);

        // Get effective permissions
        $effectivePermissions = $user->getEffectivePermissions();

        // Get custom permission IDs
        $customGranted = $user->customPermissions()
            ->wherePivot('is_granted', true)
            ->pluck('permissions.id')
            ->toArray();

        $customRevoked = $user->customPermissions()
            ->wherePivot('is_granted', false)
            ->pluck('permissions.id')
            ->toArray();

        return $this->success([
            'user' => $user,
            'effective_permissions' => $effectivePermissions,
            'custom_permissions' => [
                'granted' => $customGranted,
                'revoked' => $customRevoked,
            ],
        ]);
    }

    /**
     * Update user
     */
    public function update(Request $request, User $user): JsonResponse
    {
        // Authorization
        if (!$request->user()->isSuperAdmin() && $user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'email' => 'sometimes|email|max:100|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:8',
            'role_id' => 'sometimes|exists:roles,id',
            'branch_id' => 'nullable|exists:branches,id',
            'is_active' => 'nullable|boolean',
            'custom_permissions' => 'nullable|array',
            'custom_permissions.granted' => 'nullable|array',
            'custom_permissions.granted.*' => 'integer|exists:permissions,id',
            'custom_permissions.revoked' => 'nullable|array',
            'custom_permissions.revoked.*' => 'integer|exists:permissions,id',
        ]);

        // Handle branch_id for super admin
        if (!$request->user()->isSuperAdmin()) {
            unset($validated['branch_id']);
        }

        // Handle password
        if (isset($validated['password']) && $validated['password']) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        // Remove custom_permissions from validated (handle separately)
        $customPermissions = $validated['custom_permissions'] ?? null;
        unset($validated['custom_permissions']);

        $user->update($validated);

        // Handle custom permissions
        if ($customPermissions !== null) {
            $this->syncCustomPermissions($user, $customPermissions);
        }

        $user->load(['role', 'branch']);

        // Audit log - user updated
        try {
            AuditLog::create([
                'branch_id' => $request->user()->branch_id,
                'user_id' => $request->user()->id,
                'action' => 'update',
                'module' => 'user',
                'description' => "Updated user {$user->name}",
                'record_type' => 'User',
                'record_id' => $user->id,
                'new_values' => $validated,
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'info',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Audit log failed: ' . $e->getMessage());
        }

        return $this->success($user, 'User updated successfully');
    }

    /**
     * Delete user
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if (!$request->user()->isSuperAdmin() && $user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Cannot delete yourself
        if ($user->id === $request->user()->id) {
            return $this->error('Cannot delete your own account', 422);
        }

        // Cannot delete super admin
        if ($user->isSuperAdmin()) {
            return $this->error('Cannot delete super admin', 422);
        }

        $userName = $user->name;
        $userEmail = $user->email;

        // Detach custom permissions
        $user->customPermissions()->detach();

        $user->delete();

        // Audit log - user deleted
        try {
            AuditLog::create([
                'branch_id' => $request->user()->branch_id,
                'user_id' => $request->user()->id,
                'action' => 'delete',
                'module' => 'user',
                'description' => "Deleted user {$userName} ({$userEmail})",
                'record_type' => 'User',
                'record_id' => null,
                'old_values' => ['name' => $userName, 'email' => $userEmail],
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'severity' => 'warning',
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Audit log failed: ' . $e->getMessage());
        }

        return $this->success(null, 'User deleted successfully');
    }

    /**
     * Get user permissions (role + custom)
     */
    public function permissions(Request $request, User $user): JsonResponse
    {
        if (!$request->user()->isSuperAdmin() && $user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $allPermissions = Permission::all()->groupBy('module');

        // Get role permissions
        $rolePermissionIds = [];
        if ($user->role) {
            $rolePermissionIds = $user->role->getEnabledPermissions()
                ->pluck('id')
                ->toArray();
        }

        // Get custom permissions
        $customGranted = $user->customPermissions()
            ->wherePivot('is_granted', true)
            ->pluck('permissions.id')
            ->toArray();

        $customRevoked = $user->customPermissions()
            ->wherePivot('is_granted', false)
            ->pluck('permissions.id')
            ->toArray();

        // Format response
        $result = [];
        foreach ($allPermissions as $module => $permissions) {
            $result[$module] = $permissions->map(function ($permission) use ($rolePermissionIds, $customGranted, $customRevoked) {
                $fromRole = in_array($permission->id, $rolePermissionIds);
                $isGranted = in_array($permission->id, $customGranted);
                $isRevoked = in_array($permission->id, $customRevoked);

                // Effective status
                $effective = ($fromRole || $isGranted) && !$isRevoked;

                return [
                    'id' => $permission->id,
                    'action' => $permission->action,
                    'name' => $permission->name,
                    'description' => $permission->description,
                    'requires_passkey' => $permission->requires_passkey,
                    'from_role' => $fromRole,
                    'custom_granted' => $isGranted,
                    'custom_revoked' => $isRevoked,
                    'is_enabled' => $effective,
                ];
            });
        }

        return $this->success($result);
    }

    /**
     * Update user custom permissions
     */
    public function updatePermissions(Request $request, User $user): JsonResponse
    {
        // Only super admin can manage permissions
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'granted' => 'nullable|array',
            'granted.*' => 'integer|exists:permissions,id',
            'revoked' => 'nullable|array',
            'revoked.*' => 'integer|exists:permissions,id',
        ]);

        $this->syncCustomPermissions($user, $validated);

        return $this->success(null, 'Permissions updated successfully');
    }

    /**
     * Sync custom permissions for user
     */
    private function syncCustomPermissions(User $user, array $permissions): void
    {
        // Clear existing custom permissions
        $user->customPermissions()->detach();

        // Add granted permissions
        if (!empty($permissions['granted'])) {
            foreach ($permissions['granted'] as $permissionId) {
                $user->customPermissions()->attach($permissionId, ['is_granted' => true]);
            }
        }

        // Add revoked permissions
        if (!empty($permissions['revoked'])) {
            foreach ($permissions['revoked'] as $permissionId) {
                $user->customPermissions()->attach($permissionId, ['is_granted' => false]);
            }
        }
    }

    /**
     * Update passkey
     */
    public function updatePasskey(Request $request, User $user): JsonResponse
    {
        if (!$request->user()->isSuperAdmin() && $user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'passkey' => 'required|string|size:6',
        ]);

        $user->update([
            'passkey' => Hash::make($validated['passkey']),
        ]);

        return $this->success(null, 'Passkey updated successfully');
    }

    /**
     * Toggle user status
     */
    public function toggleStatus(Request $request, User $user): JsonResponse
    {
        if (!$request->user()->isSuperAdmin() && $user->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $user->update([
            'is_active' => !$user->is_active,
        ]);

        return $this->success($user, 'Status updated successfully');
    }
}