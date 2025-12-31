<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'address',
        'phone',
        'email',
        'license_no',
        'license_expiry',
        'is_active',
        'is_headquarters',
        'settings',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_headquarters' => 'boolean',
        'license_expiry' => 'date',
        'settings' => 'array',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function pledges(): HasMany
    {
        return $this->hasMany(Pledge::class);
    }

    public function vaults(): HasMany
    {
        return $this->hasMany(Vault::class);
    }

    public function renewals(): HasMany
    {
        return $this->hasMany(Renewal::class);
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(Redemption::class);
    }

    public function dayEndReports(): HasMany
    {
        return $this->hasMany(DayEndReport::class);
    }

    public function getSettingAttribute($key, $default = null)
    {
        $settings = $this->settings ?? [];
        return $settings[$key] ?? $default;
    }
}
