<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RenewalInterestBreakdown extends Model
{
    public $timestamps = false;

    protected $table = 'renewal_interest_breakdown';

    protected $fillable = [
        'renewal_id',
        'month_number',
        'interest_rate',
        'interest_amount',
        'cumulative_amount',
    ];

    protected $casts = [
        'interest_rate' => 'decimal:2',
        'interest_amount' => 'decimal:2',
        'cumulative_amount' => 'decimal:2',
    ];

    public function renewal(): BelongsTo
    {
        return $this->belongsTo(Renewal::class);
    }
}
