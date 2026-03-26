<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Slot extends Model
{
    use HasFactory;

    protected $fillable = [
        'box_id',
        'slot_number',
        'is_occupied',
        'current_item_id',
        'occupied_at',
    ];

    protected $casts = [
        'is_occupied' => 'boolean',
        'occupied_at' => 'datetime',
    ];

    public function box(): BelongsTo
    {
        return $this->belongsTo(Box::class);
    }

    public function currentItem(): BelongsTo
    {
        return $this->belongsTo(PledgeItem::class, 'current_item_id');
    }

    public function occupy(int $itemId): void
    {
        $this->update([
            'is_occupied' => true,
            'current_item_id' => $itemId,
            'occupied_at' => now(),
        ]);
        $this->box->updateOccupiedSlots();
    }

    public function release(): void
    {
        $this->update([
            'is_occupied' => false,
            'current_item_id' => null,
            'occupied_at' => null,
        ]);
        $this->box->updateOccupiedSlots();
    }

    public function getLocationCodeAttribute(): string
    {
        $slotStr = $this->slot_number;
        if ($this->box->has_subslots) {
            $subslotsPerSlot = $this->box->subslots_per_slot ?: 1;
            $slotNum = ceil($this->slot_number / $subslotsPerSlot);
            $subslotNum = (($this->slot_number - 1) % $subslotsPerSlot) + 1;
            $slotStr = sprintf('%d-%d', $slotNum, $subslotNum);
        }

        return sprintf('%s-B%s-S%s',
            $this->box->vault->code,
            $this->box->box_number,
            $slotStr
        );
    }
}
