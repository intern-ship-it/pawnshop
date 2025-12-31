<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'branch_id',
        'employee_id',
        'name',
        'email',
        'phone',
        'username',
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

    public function hasPermission(string $module, string $action): bool
    {
        return $this->role->hasPermission($module, $action);
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
