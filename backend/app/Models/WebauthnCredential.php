<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A registered authenticator (fingerprint sensor, Windows Hello, security key).
 *
 * Stores a PUBLIC key only. No biometric ever reaches this server — the device's
 * secure enclave holds the private key and merely signs a challenge with it.
 */
class WebauthnCredential extends Model
{
    protected $fillable = [
        'user_id',
        'credential_id',
        'public_key',
        'sign_count',
        'rp_id',
        'device_label',
        'last_used_at',
    ];

    protected $casts = [
        'sign_count'   => 'integer',
        'last_used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
