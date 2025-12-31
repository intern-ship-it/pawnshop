<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class RoleController extends Controller
{
    /**
     * List all roles
     */
    public function index(Request $request): JsonResponse
    {
        $roles = Role::withCount('users')
            ->orderBy('name')
            ->get();

        return $this->success($roles);
    }

    /**
     * Create role
     */
    public function store(Request $request): JsonResponse
    {
        // Only super admin can manage roles
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:50|unique:roles,name',
            'description' => 'nullable|string|max:255',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']),
            'description' => $validated['description'] ?? null,
            'is_system' => false,
        ]);

        return $this->success($role, 'Role created successfully', 201);
    }

    /**
     * Get role details
     */
    public function show(Request $request, Role $role): JsonResponse
    {
        $role->load(['permissions']);

        return $this->success($role);
    }

    /**
     * Update role
     */
    public function update(Request $request, Role $role): JsonResponse
    {
        // Only super admin can manage roles
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        // Cannot update system roles
        if ($role->is_system) {
            return $this->error('Cannot modify system roles', 422);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:50|unique:roles,name,' . $role->id,
            'description' => 'nullable|string|max:255',
        ]);

        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $role->update($validated);

        return $this->success($role, 'Role updated successfully');
    }

    /**
     * Delete role
     */
    public function destroy(Request $request, Role $role): JsonResponse
    {
        // Only super admin can manage roles
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        // Cannot delete system roles
        if ($role->is_system) {
            return $this->error('Cannot delete system roles', 422);
        }

        // Check if role has users
        if ($role->users()->exists()) {
            return $this->error('Cannot delete role with assigned users', 422);
        }

        // Detach all permissions
        $role->permissions()->detach();

        $role->delete();

        return $this->success(null, 'Role deleted successfully');
    }

    /**
     * Get role permissions
     */
    public function permissions(Request $request, Role $role): JsonResponse
    {
        $permissions = Permission::all()->groupBy('module');

        // Get enabled permissions for this role
        $enabledPermissions = $role->permissions()
            ->wherePivot('is_enabled', true)
            ->pluck('permissions.id')
            ->toArray();

        // Format response
        $result = [];
        foreach ($permissions as $module => $modulePermissions) {
            $result[$module] = $modulePermissions->map(function ($permission) use ($enabledPermissions) {
                return [
                    'id' => $permission->id,
                    'action' => $permission->action,
                    'name' => $permission->name,
                    'description' => $permission->description,
                    'requires_passkey' => $permission->requires_passkey,
                    'is_enabled' => in_array($permission->id, $enabledPermissions),
                ];
            });
        }

        return $this->success($result);
    }

    /**
     * Update role permissions
     */
    public function updatePermissions(Request $request, Role $role): JsonResponse
    {
        // Only super admin can manage permissions
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'integer|exists:permissions,id',
        ]);

        // Sync permissions
        $syncData = [];
        foreach ($validated['permissions'] as $permissionId) {
            $syncData[$permissionId] = ['is_enabled' => true];
        }

        // Get all permission IDs to properly sync (disable those not in the list)
        $allPermissions = Permission::pluck('id')->toArray();
        foreach ($allPermissions as $permId) {
            if (!isset($syncData[$permId])) {
                $syncData[$permId] = ['is_enabled' => false];
            }
        }

        $role->permissions()->sync($syncData);

        return $this->success(null, 'Permissions updated successfully');
    }

    /**
     * Get all available permissions
     */
    public function allPermissions(Request $request): JsonResponse
    {
        $permissions = Permission::all()->groupBy('module');

        return $this->success($permissions);
    }

    /**
     * Bulk enable/disable permissions for role
     */
    public function bulkUpdatePermissions(Request $request, Role $role): JsonResponse
    {
        // Only super admin can manage permissions
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'enable' => 'nullable|array',
            'enable.*' => 'integer|exists:permissions,id',
            'disable' => 'nullable|array',
            'disable.*' => 'integer|exists:permissions,id',
        ]);

        // Enable specified permissions
        if (!empty($validated['enable'])) {
            foreach ($validated['enable'] as $permissionId) {
                $role->permissions()->syncWithoutDetaching([
                    $permissionId => ['is_enabled' => true]
                ]);
            }
        }

        // Disable specified permissions
        if (!empty($validated['disable'])) {
            foreach ($validated['disable'] as $permissionId) {
                $role->permissions()->syncWithoutDetaching([
                    $permissionId => ['is_enabled' => false]
                ]);
            }
        }

        return $this->success(null, 'Permissions updated');
    }

    /**
     * Copy permissions from one role to another
     */
    public function copyPermissions(Request $request): JsonResponse
    {
        // Only super admin can manage permissions
        if (!$request->user()->isSuperAdmin()) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'source_role_id' => 'required|exists:roles,id',
            'target_role_id' => 'required|exists:roles,id|different:source_role_id',
        ]);

        $sourceRole = Role::find($validated['source_role_id']);
        $targetRole = Role::find($validated['target_role_id']);

        // Cannot modify system roles
        if ($targetRole->is_system) {
            return $this->error('Cannot modify system role permissions', 422);
        }

        // Get source permissions
        $sourcePermissions = $sourceRole->permissions()
            ->wherePivot('is_enabled', true)
            ->pluck('permissions.id')
            ->toArray();

        // Apply to target
        $syncData = [];
        foreach (Permission::pluck('id')->toArray() as $permId) {
            $syncData[$permId] = ['is_enabled' => in_array($permId, $sourcePermissions)];
        }

        $targetRole->permissions()->sync($syncData);

        return $this->success(null, 'Permissions copied successfully');
    }
}
