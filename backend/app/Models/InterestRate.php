<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InterestRate extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'name',
        'rate_type',
        'rate_percentage',
        'from_month',
        'to_month',
        'is_active',
        'effective_from',
        'effective_to',
    ];

    protected $casts = [
        'rate_percentage' => 'decimal:2',
        'is_active' => 'boolean',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public static function getRate(string $type, ?int $branchId = null): float
    {
        $rate = static::where('rate_type', $type)
            ->where('is_active', true)
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->where('effective_from', '<=', now())
            ->where(fn($q) => $q->whereNull('effective_to')->orWhere('effective_to', '>=', now()))
            ->first();

        return $rate ? $rate->rate_percentage : 0;
    }
}
