<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

/**
 * Advisory, short-lived claim on a slot while a user fills out a pledge.
 *
 * Not part of the permanent slot-assignment logic — purely a concurrency
 * guard so two staff cannot book the same slot/subslot at the same time.
 * Expiry is lazy: a hold whose expires_at is in the past is ignored
 * (and cleaned up opportunistically), so no scheduled job is required.
 */
class SlotHold extends Model
{
    use HasFactory;

    protected $fillable = [
        'slot_id',
        'held_by',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public function slot(): BelongsTo
    {
        return $this->belongsTo(Slot::class);
    }

    public function holder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'held_by');
    }

    /**
     * Only holds that have not yet expired.
     */
    public function scopeLive(Builder $query): Builder
    {
        return $query->where('expires_at', '>', now());
    }
}
