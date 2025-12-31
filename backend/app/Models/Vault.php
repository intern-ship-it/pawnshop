<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vault extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'code',
        'name',
        'description',
        'total_boxes',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function boxes(): HasMany
    {
        return $this->hasMany(Box::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PledgeItem::class);
    }

    public function getTotalSlotsAttribute(): int
    {
        return $this->boxes->sum('total_slots');
    }

    public function getOccupiedSlotsAttribute(): int
    {
        return $this->boxes->sum('occupied_slots');
    }

    public function getAvailableSlotsAttribute(): int
    {
        return $this->total_slots - $this->occupied_slots;
    }
}
