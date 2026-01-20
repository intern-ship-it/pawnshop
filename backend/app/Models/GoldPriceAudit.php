<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoldPriceAudit extends Model
{
    protected $table = 'gold_price_audit';

    protected $fillable = [
        'branch_id',
        'price_date',
        'fetched_at',

        // Metals.Dev data
        'metals_dev_spot',
        'metals_dev_bid',
        'metals_dev_ask',
        'metals_dev_high',
        'metals_dev_low',
        'metals_dev_change',
        'metals_dev_change_percent',
        'metals_dev_timestamp',
        'metals_dev_raw',

        // BNM data
        'bnm_buying_per_oz',
        'bnm_selling_per_oz',
        'bnm_buying_per_gram',
        'bnm_selling_per_gram',
        'bnm_effective_date',
        'bnm_last_updated',
        'bnm_raw',

        // Calculated prices
        'active_source',
        'price_999',
        'price_916',
        'price_875',
        'price_750',
        'price_585',
        'price_375',

        // Audit fields
        'fetch_status',
        'error_message',
        'created_by',
        'ip_address',
    ];

    protected $casts = [
        'price_date' => 'date',
        'fetched_at' => 'datetime',
        'metals_dev_timestamp' => 'datetime',
        'bnm_effective_date' => 'date',
        'bnm_last_updated' => 'datetime',
        'metals_dev_raw' => 'array',
        'bnm_raw' => 'array',
        'metals_dev_spot' => 'decimal:2',
        'metals_dev_bid' => 'decimal:2',
        'metals_dev_ask' => 'decimal:2',
        'metals_dev_high' => 'decimal:2',
        'metals_dev_low' => 'decimal:2',
        'bnm_buying_per_oz' => 'decimal:2',
        'bnm_selling_per_oz' => 'decimal:2',
        'bnm_buying_per_gram' => 'decimal:2',
        'bnm_selling_per_gram' => 'decimal:2',
        'price_999' => 'decimal:2',
        'price_916' => 'decimal:2',
        'price_875' => 'decimal:2',
        'price_750' => 'decimal:2',
        'price_585' => 'decimal:2',
        'price_375' => 'decimal:2',
    ];

    /**
     * Relationships
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scopes
     */
    public function scopeForDate($query, string $date)
    {
        return $query->where('price_date', $date);
    }

    public function scopeForBranch($query, ?int $branchId)
    {
        if ($branchId) {
            return $query->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                    ->orWhereNull('branch_id');
            });
        }
        return $query;
    }

    public function scopeSuccessful($query)
    {
        return $query->where('fetch_status', 'success');
    }

    public function scopeFromSource($query, string $source)
    {
        return $query->where('active_source', $source);
    }

    public function scopeDateRange($query, string $startDate, string $endDate)
    {
        return $query->whereBetween('price_date', [$startDate, $endDate]);
    }

    /**
     * Accessors
     */
    public function getSourceLabelAttribute(): string
    {
        return match ($this->active_source) {
            'metals_dev' => 'Metals.Dev (Real-time)',
            'bnm' => 'BNM Kijang Emas (Official)',
            'manual' => 'Manual Entry',
            default => 'Unknown',
        };
    }

    public function getStatusBadgeAttribute(): string
    {
        return match ($this->fetch_status) {
            'success' => 'success',
            'partial' => 'warning',
            'failed' => 'danger',
            default => 'secondary',
        };
    }

    /**
     * Check if both sources were fetched successfully
     */
    public function hasBothSources(): bool
    {
        return $this->metals_dev_spot !== null && $this->bnm_buying_per_gram !== null;
    }

    /**
     * Get price comparison between sources
     */
    public function getPriceComparison(): array
    {
        if (!$this->hasBothSources()) {
            return [];
        }

        $metalsDev = $this->metals_dev_bid ?? $this->metals_dev_spot;
        $bnm = $this->bnm_buying_per_gram;

        $difference = $metalsDev - $bnm;
        $percentDiff = $bnm > 0 ? round(($difference / $bnm) * 100, 2) : 0;

        return [
            'metals_dev_price' => $metalsDev,
            'bnm_price' => $bnm,
            'difference' => round($difference, 2),
            'percent_difference' => $percentDiff,
            'higher_source' => $difference > 0 ? 'metals_dev' : ($difference < 0 ? 'bnm' : 'equal'),
        ];
    }

    /**
     * Generate KPKT compliance report data
     */
    public function toComplianceReport(): array
    {
        return [
            'report_date' => $this->price_date->format('Y-m-d'),
            'fetch_timestamp' => $this->fetched_at->format('Y-m-d H:i:s'),
            'primary_source' => [
                'name' => 'Metals.Dev',
                'spot_price_myr' => $this->metals_dev_spot,
                'bid_price_myr' => $this->metals_dev_bid,
                'ask_price_myr' => $this->metals_dev_ask,
                'data_timestamp' => $this->metals_dev_timestamp?->format('Y-m-d H:i:s'),
            ],
            'secondary_source' => [
                'name' => 'Bank Negara Malaysia - Kijang Emas',
                'buying_price_myr' => $this->bnm_buying_per_gram,
                'selling_price_myr' => $this->bnm_selling_per_gram,
                'effective_date' => $this->bnm_effective_date?->format('Y-m-d'),
            ],
            'active_source_used' => $this->source_label,
            'applied_prices' => [
                'gold_999' => $this->price_999,
                'gold_916' => $this->price_916,
                'gold_875' => $this->price_875,
                'gold_750' => $this->price_750,
            ],
            'fetch_status' => $this->fetch_status,
            'recorded_by_user_id' => $this->created_by,
            'recorded_from_ip' => $this->ip_address,
        ];
    }
}