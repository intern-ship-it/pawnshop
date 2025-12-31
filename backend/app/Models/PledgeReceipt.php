<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PledgeReceipt extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'pledge_id',
        'print_type',
        'copy_type',
        'is_chargeable',
        'charge_amount',
        'charge_paid',
        'printed_by',
        'printed_at',
    ];

    protected $casts = [
        'is_chargeable' => 'boolean',
        'charge_paid' => 'boolean',
        'charge_amount' => 'decimal:2',
        'printed_at' => 'datetime',
    ];

    public function pledge(): BelongsTo
    {
        return $this->belongsTo(Pledge::class);
    }

    public function printedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'printed_by');
    }
}
