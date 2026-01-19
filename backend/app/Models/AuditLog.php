<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'branch_id',
        'user_id',
        'action',
        'module',
        'description',
        'record_type',
        'record_id',
        'old_values',
        'new_values',
        'metadata',
        'ip_address',
        'user_agent',
        'severity',
        'created_at',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    // Action constants
    public const ACTION_LOGIN = 'login';
    public const ACTION_LOGOUT = 'logout';
    public const ACTION_CREATE = 'create';
    public const ACTION_UPDATE = 'update';
    public const ACTION_DELETE = 'delete';
    public const ACTION_VIEW = 'view';
    public const ACTION_PRINT = 'print';
    public const ACTION_OVERRIDE = 'override';
    public const ACTION_APPROVAL = 'approval';
    public const ACTION_REJECTION = 'rejection';

    // Module constants
    public const MODULE_AUTH = 'auth';
    public const MODULE_CUSTOMER = 'customer';
    public const MODULE_PLEDGE = 'pledge';
    public const MODULE_RENEWAL = 'renewal';
    public const MODULE_REDEMPTION = 'redemption';
    public const MODULE_INVENTORY = 'inventory';
    public const MODULE_AUCTION = 'auction';
    public const MODULE_SETTINGS = 'settings';
    public const MODULE_USER = 'user';

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope by branch
     */
    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    /**
     * Scope by module
     */
    public function scopeForModule($query, string $module)
    {
        return $query->where('module', $module);
    }

    /**
     * Scope by action
     */
    public function scopeForAction($query, string $action)
    {
        return $query->where('action', $action);
    }

    /**
     * Scope by user
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope today
     */
    public function scopeToday($query)
    {
        return $query->whereDate('created_at', today());
    }

    /**
     * Static log helper
     */
    public static function log(
        string $action,
        string $module,
        string $description,
        ?Model $entity = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?array $metadata = null,
        string $severity = 'info'
    ): self {
        $user = auth()->user();
        $request = request();

        return static::create([
            'branch_id' => $user?->branch_id,
            'user_id' => $user?->id,
            'action' => $action,
            'module' => $module,
            'description' => $description,
            'record_type' => $entity ? class_basename($entity) : null,
            'record_id' => $entity?->id,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
            'user_agent' => substr($request->userAgent() ?? '', 0, 255),
            'severity' => $severity,
            'created_at' => now(),
        ]);
    }

    /**
     * Log login
     */
    public static function logLogin($user, $request): self
    {
        return static::create([
            'branch_id' => $user->branch_id,
            'user_id' => $user->id,
            'action' => self::ACTION_LOGIN,
            'module' => self::MODULE_AUTH,
            'description' => "User {$user->name} logged in",
            'record_type' => 'User',
            'record_id' => $user->id,
            'metadata' => ['browser' => self::parseBrowser($request->userAgent())],
            'ip_address' => $request->ip(),
            'user_agent' => substr($request->userAgent() ?? '', 0, 255),
            'severity' => 'info',
            'created_at' => now(),
        ]);
    }

    /**
     * Log logout
     */
    public static function logLogout($user, $request): self
    {
        return static::create([
            'branch_id' => $user->branch_id,
            'user_id' => $user->id,
            'action' => self::ACTION_LOGOUT,
            'module' => self::MODULE_AUTH,
            'description' => "User {$user->name} logged out",
            'record_type' => 'User',
            'record_id' => $user->id,
            'ip_address' => $request->ip(),
            'user_agent' => substr($request->userAgent() ?? '', 0, 255),
            'severity' => 'info',
            'created_at' => now(),
        ]);
    }

    /**
     * Parse browser from user agent
     */
    private static function parseBrowser(?string $ua): string
    {
        if (!$ua)
            return 'Unknown';
        if (str_contains($ua, 'Chrome'))
            return 'Chrome';
        if (str_contains($ua, 'Firefox'))
            return 'Firefox';
        if (str_contains($ua, 'Safari'))
            return 'Safari';
        if (str_contains($ua, 'Edge'))
            return 'Edge';
        return 'Other';
    }
}
