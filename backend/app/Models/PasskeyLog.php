<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PasskeyLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'branch_id',
        'user_id',
        'action',
        'module',
        'record_id',
        'passkey_user_id',
        'details',
        'ip_address',
        'created_at',
    ];

    protected $casts = [
        'details' => 'array',
        'created_at' => 'datetime',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function passkeyUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'passkey_user_id');
    }

    public static function log(
        int $branchId,
        int $userId,
        string $action,
        string $module,
        ?int $recordId = null,
        ?int $passkeyUserId = null,
        ?array $details = null,
        ?string $ipAddress = null
    ): self {
        return static::create([
            'branch_id' => $branchId,
            'user_id' => $userId,
            'action' => $action,
            'module' => $module,
            'record_id' => $recordId,
            'passkey_user_id' => $passkeyUserId,
            'details' => $details,
            'ip_address' => $ipAddress,
            'created_at' => now(),
        ]);
    }
}
