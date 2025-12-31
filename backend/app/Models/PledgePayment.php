<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PledgePayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'pledge_id',
        'total_amount',
        'cash_amount',
        'transfer_amount',
        'bank_id',
        'account_number',
        'account_name',
        'reference_no',
        'payment_method',
        'payment_date',
        'created_by',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'cash_amount' => 'decimal:2',
        'transfer_amount' => 'decimal:2',
        'payment_date' => 'date',
    ];

    public function pledge(): BelongsTo
    {
        return $this->belongsTo(Pledge::class);
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
