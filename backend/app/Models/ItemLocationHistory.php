<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ItemLocationHistory extends Model
{
    public $timestamps = false;

    protected $table = 'item_location_history';

    protected $fillable = [
        'pledge_item_id',
        'action',
        'from_slot_id',
        'to_slot_id',
        'reason',
        'performed_by',
        'performed_at',
    ];

    protected $casts = [
        'performed_at' => 'datetime',
    ];

    public function pledgeItem(): BelongsTo
    {
        return $this->belongsTo(PledgeItem::class, 'pledge_item_id');
    }

    public function fromSlot(): BelongsTo
    {
        return $this->belongsTo(Slot::class, 'from_slot_id');
    }

    public function toSlot(): BelongsTo
    {
        return $this->belongsTo(Slot::class, 'to_slot_id');
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
