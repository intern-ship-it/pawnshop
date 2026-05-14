<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InterestPaymentBreakdown extends Model
{
    use HasFactory;

    protected $table = 'interest_payment_breakdown';

    public $timestamps = false;

    protected $fillable = [
        'interest_payment_id',
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

    public function interestPayment(): BelongsTo
    {
        return $this->belongsTo(InterestPayment::class);
    }
}
