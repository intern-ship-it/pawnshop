<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Box extends Model
{
    use HasFactory;

    protected $fillable = [
        'vault_id',
        'box_number',
        'name',
        'total_slots',
        'occupied_slots',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function vault(): BelongsTo
    {
        return $this->belongsTo(Vault::class);
    }

    public function slots(): HasMany
    {
        return $this->hasMany(Slot::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PledgeItem::class);
    }

    public function getAvailableSlotsCountAttribute(): int
    {
        return $this->total_slots - $this->occupied_slots;
    }

    public function getTotalValueAttribute(): float
    {
        return $this->items()->where('status', 'stored')->sum('net_value');
    }

    public function getTotalWeightAttribute(): float
    {
        return $this->items()->where('status', 'stored')->sum('net_weight');
    }

    public function updateOccupiedSlots(): void
    {
        $this->update([
            'occupied_slots' => $this->slots()->where('is_occupied', true)->count()
        ]);
    }
}
