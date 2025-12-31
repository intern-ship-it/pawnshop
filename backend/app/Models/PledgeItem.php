<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PledgeItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'pledge_id',
        'item_no',
        'barcode',
        'category_id',
        'purity_id',
        'gross_weight',
        'stone_deduction_type',
        'stone_deduction_value',
        'net_weight',
        'price_per_gram',
        'gross_value',
        'deduction_amount',
        'net_value',
        'description',
        'remarks',
        'photo',
        'vault_id',
        'box_id',
        'slot_id',
        'location_assigned_at',
        'location_assigned_by',
        'status',
        'released_at',
    ];

    protected $casts = [
        'gross_weight' => 'decimal:3',
        'stone_deduction_value' => 'decimal:3',
        'net_weight' => 'decimal:3',
        'price_per_gram' => 'decimal:2',
        'gross_value' => 'decimal:2',
        'deduction_amount' => 'decimal:2',
        'net_value' => 'decimal:2',
        'location_assigned_at' => 'datetime',
        'released_at' => 'datetime',
    ];

    public function pledge(): BelongsTo
    {
        return $this->belongsTo(Pledge::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function purity(): BelongsTo
    {
        return $this->belongsTo(Purity::class);
    }

    public function vault(): BelongsTo
    {
        return $this->belongsTo(Vault::class);
    }

    public function box(): BelongsTo
    {
        return $this->belongsTo(Box::class);
    }

    public function slot(): BelongsTo
    {
        return $this->belongsTo(Slot::class);
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'location_assigned_by');
    }

    public function locationHistory(): HasMany
    {
        return $this->hasMany(ItemLocationHistory::class, 'pledge_item_id');
    }

    public function auctionItems(): HasMany
    {
        return $this->hasMany(AuctionItem::class, 'pledge_item_id');
    }

    public function getLocationStringAttribute(): string
    {
        if (!$this->vault_id) {
            return 'Not Assigned';
        }
        return sprintf('%s / Box %d / Slot %d',
            $this->vault->code,
            $this->box->box_number,
            $this->slot->slot_number
        );
    }

    public static function generateBarcode(int $pledgeId, int $itemIndex): string
    {
        $pledge = Pledge::find($pledgeId);
        return sprintf('%s-%02d', $pledge->pledge_no, $itemIndex);
    }
}
