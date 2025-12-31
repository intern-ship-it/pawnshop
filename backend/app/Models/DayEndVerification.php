<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DayEndVerification extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'day_end_id',
        'verification_type',
        'related_type',
        'related_id',
        'item_description',
        'expected_amount',
        'is_verified',
        'verified_by',
        'verified_at',
        'notes',
    ];

    protected $casts = [
        'expected_amount' => 'decimal:2',
        'is_verified' => 'boolean',
        'verified_at' => 'datetime',
    ];

    public function dayEndReport(): BelongsTo
    {
        return $this->belongsTo(DayEndReport::class, 'day_end_id');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
