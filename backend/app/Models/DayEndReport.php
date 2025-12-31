<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DayEndReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'report_date',
        'opening_balance',
        'new_pledges_count',
        'new_pledges_amount',
        'new_pledges_cash',
        'new_pledges_transfer',
        'renewals_count',
        'renewals_amount',
        'renewals_cash',
        'renewals_transfer',
        'redemptions_count',
        'redemptions_amount',
        'redemptions_cash',
        'redemptions_transfer',
        'items_in_count',
        'items_out_count',
        'all_items_verified',
        'all_amounts_verified',
        'status',
        'closed_by',
        'closed_at',
        'notes',
        'whatsapp_sent',
        'whatsapp_sent_at',
        'report_printed',
    ];

    protected $casts = [
        'report_date' => 'date',
        'opening_balance' => 'decimal:2',
        'new_pledges_amount' => 'decimal:2',
        'new_pledges_cash' => 'decimal:2',
        'new_pledges_transfer' => 'decimal:2',
        'renewals_amount' => 'decimal:2',
        'renewals_cash' => 'decimal:2',
        'renewals_transfer' => 'decimal:2',
        'redemptions_amount' => 'decimal:2',
        'redemptions_cash' => 'decimal:2',
        'redemptions_transfer' => 'decimal:2',
        'all_items_verified' => 'boolean',
        'all_amounts_verified' => 'boolean',
        'closed_at' => 'datetime',
        'whatsapp_sent' => 'boolean',
        'whatsapp_sent_at' => 'datetime',
        'report_printed' => 'boolean',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(DayEndVerification::class, 'day_end_id');
    }

    public function getTotalCashAttribute(): float
    {
        return $this->new_pledges_cash + $this->renewals_cash + $this->redemptions_cash;
    }

    public function getTotalTransferAttribute(): float
    {
        return $this->new_pledges_transfer + $this->renewals_transfer + $this->redemptions_transfer;
    }
}
