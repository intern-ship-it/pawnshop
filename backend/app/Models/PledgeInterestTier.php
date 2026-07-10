<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One rung of a pledge's frozen interest ladder, e.g. "months 1-3 at 0.50%".
 *
 * Copied from the active InterestRate rules when the pledge is created, so a later
 * Settings edit cannot change what an existing customer owes.
 */
class PledgeInterestTier extends Model
{
    use HasFactory;

    protected $fillable = [
        'pledge_id',
        'from_month',
        'to_month',
        'rate_percentage',
        'rate_type',
    ];

    protected $casts = [
        'from_month' => 'integer',
        'to_month' => 'integer',
        'rate_percentage' => 'decimal:2',
    ];

    public function pledge(): BelongsTo
    {
        return $this->belongsTo(Pledge::class);
    }

    /**
     * Whether this tier covers the given month. A null to_month means "onwards".
     */
    public function covers(int $month): bool
    {
        return $month >= $this->from_month
            && ($this->to_month === null || $month <= $this->to_month);
    }
}
