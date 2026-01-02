<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Hash;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'branch_id',
        'employee_id',
        'username',
        'name',
        'email',
        'phone',
        'password',
        'passkey',
        'role_id',
        'is_active',
        'last_login_at',
        'last_login_ip',
        'profile_photo',
    ];

    protected $hidden = [
        'password',
        'passkey',
        'remember_token',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_login_at' => 'datetime',
        'password' => 'hashed',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Custom user permissions (overrides role permissions)
     */
    public function customPermissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'user_permissions')
            ->withPivot('is_granted')
            ->withTimestamps();
    }

    /**
     * Get all effective permissions for user
     * Combines role permissions with custom user overrides
     */
    public function getEffectivePermissions(): array
    {
        // Super admin has all permissions
        if ($this->isSuperAdmin()) {
            return Permission::all()
                ->map(fn($p) => $p->module . '.' . $p->action)
                ->toArray();
        }

        // Get role permissions
        $rolePermissionIds = [];
        if ($this->role) {
            $rolePermissionIds = $this->role->getEnabledPermissions()
                ->pluck('id')
                ->toArray();
        }

        // Get custom permissions
        $customGranted = $this->customPermissions()
            ->wherePivot('is_granted', true)
            ->pluck('permissions.id')
            ->toArray();

        $customRevoked = $this->customPermissions()
            ->wherePivot('is_granted', false)
            ->pluck('permissions.id')
            ->toArray();

        // Merge: role + custom granted - custom revoked
        $effectiveIds = array_merge($rolePermissionIds, $customGranted);
        $effectiveIds = array_diff($effectiveIds, $customRevoked);
        $effectiveIds = array_unique($effectiveIds);

        return Permission::whereIn('id', $effectiveIds)
            ->get()
            ->map(fn($p) => $p->module . '.' . $p->action)
            ->toArray();
    }

    public function hasPermission(string $module, string $action): bool
    {
        // Super admin has all permissions
        if ($this->isSuperAdmin()) {
            return true;
        }

        $permission = Permission::where('module', $module)
            ->where('action', $action)
            ->first();

        if (!$permission) {
            return false;
        }

        // Check custom permission first (overrides role)
        $customPermission = $this->customPermissions()
            ->where('permissions.id', $permission->id)
            ->first();

        if ($customPermission) {
            return $customPermission->pivot->is_granted;
        }

        // Fall back to role permission
        if ($this->role) {
            return $this->role->hasPermission($module, $action);
        }

        return false;
    }

    public function hasAnyPermission(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            [$module, $action] = explode('.', $permission);
            if ($this->hasPermission($module, $action)) {
                return true;
            }
        }
        return false;
    }

    public function isSuperAdmin(): bool
    {
        return $this->role->slug === 'super-admin';
    }

    public function isAdmin(): bool
    {
        return in_array($this->role->slug, ['super-admin', 'admin']);
    }

    public function isManager(): bool
    {
        return in_array($this->role->slug, ['super-admin', 'admin', 'manager']);
    }

    public function verifyPasskey(string $passkey): bool
    {
        if (!$this->passkey) {
            return false;
        }
        return Hash::check($passkey, $this->passkey);
    }

    public function updateLastLogin(string $ip): void
    {
        $this->update([
            'last_login_at' => now(),
            'last_login_ip' => $ip,
        ]);
    }
}