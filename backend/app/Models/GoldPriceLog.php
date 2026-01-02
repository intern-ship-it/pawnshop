<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoldPriceLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'gold_price_per_gram',
        'silver_price_per_gram',
        'base_currency',
        'source',
        'raw_data',
        'fetched_at',
    ];

    protected $casts = [
        'gold_price_per_gram' => 'decimal:2',
        'silver_price_per_gram' => 'decimal:2',
        'fetched_at' => 'datetime',
    ];

    /**
     * Get latest gold price
     */
    public static function getLatestGoldPrice(): ?float
    {
        return static::latest('fetched_at')->value('gold_price_per_gram');
    }

    /**
     * Get price history for chart
     */
    public static function getPriceHistory(int $days = 30): array
    {
        return static::where('fetched_at', '>=', now()->subDays($days))
            ->orderBy('fetched_at')
            ->get(['gold_price_per_gram', 'silver_price_per_gram', 'fetched_at'])
            ->toArray();
    }

    /**
     * Get daily average prices
     */
    public static function getDailyAverages(int $days = 30): array
    {
        return static::where('fetched_at', '>=', now()->subDays($days))
            ->selectRaw('DATE(fetched_at) as date')
            ->selectRaw('AVG(gold_price_per_gram) as avg_gold')
            ->selectRaw('AVG(silver_price_per_gram) as avg_silver')
            ->selectRaw('MIN(gold_price_per_gram) as min_gold')
            ->selectRaw('MAX(gold_price_per_gram) as max_gold')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->toArray();
    }
}
