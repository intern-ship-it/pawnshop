<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Auction extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'auction_no',
        'auction_date',
        'auction_time',
        'location',
        'total_items',
        'total_sold',
        'total_unsold',
        'total_reserve_price',
        'total_sold_amount',
        'status',
        'created_by',
    ];

    protected $casts = [
        'auction_date' => 'date',
        'total_reserve_price' => 'decimal:2',
        'total_sold_amount' => 'decimal:2',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(AuctionItem::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
