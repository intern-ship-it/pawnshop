<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuctionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'auction_id',
        'pledge_item_id',
        'lot_number',
        'reserve_price',
        'sold_price',
        'status',
        'buyer_name',
        'buyer_ic',
        'buyer_phone',
        'sold_at',
    ];

    protected $casts = [
        'reserve_price' => 'decimal:2',
        'sold_price' => 'decimal:2',
        'sold_at' => 'datetime',
    ];

    public function auction(): BelongsTo
    {
        return $this->belongsTo(Auction::class);
    }

    public function pledgeItem(): BelongsTo
    {
        return $this->belongsTo(PledgeItem::class, 'pledge_item_id');
    }
}
