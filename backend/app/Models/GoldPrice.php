<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class GoldPrice extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'price_date',
        'price_999',
        'price_916',
        'price_875',
        'price_750',
        'price_585',
        'price_375',
        'source',
        'api_response',
        'created_by',
    ];

    protected $casts = [
        'price_date' => 'date',
        'price_999' => 'decimal:2',
        'price_916' => 'decimal:2',
        'price_875' => 'decimal:2',
        'price_750' => 'decimal:2',
        'price_585' => 'decimal:2',
        'price_375' => 'decimal:2',
        'api_response' => 'array',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function getToday(?int $branchId = null): ?self
    {
        return static::where('price_date', Carbon::today())
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->orderBy('id', 'desc')
            ->first();
    }

    public static function getLatest(?int $branchId = null): ?self
    {
        return static::when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->orderBy('price_date', 'desc')
            ->first();
    }

    public function getPriceByPurity(string $purityCode): float
    {
        return match ($purityCode) {
            '999' => $this->price_999,
            '916' => $this->price_916,
            '875' => $this->price_875,
            '750' => $this->price_750,
            '585' => $this->price_585 ?? 0,
            '375' => $this->price_375 ?? 0,
            default => 0,
        };
    }

    /**
     * Alias for getPriceByPurity
     */
    public function getPriceForPurity(string $purityCode): float
    {
        return $this->getPriceByPurity($purityCode);
    }
}
