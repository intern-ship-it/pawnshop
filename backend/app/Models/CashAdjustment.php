<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashAdjustment extends Model
{
    use HasFactory;

    public const TYPE_INJECTION  = 'injection';
    public const TYPE_WITHDRAWAL = 'withdrawal';

    protected $fillable = [
        'day_end_report_id',
        'branch_id',
        'type',
        'amount',
        'reason',
        'created_by',
        'voided',
        'voided_by',
        'voided_at',
    ];

    protected $casts = [
        'amount'    => 'decimal:2',
        'voided'    => 'boolean',
        'voided_at' => 'datetime',
    ];

    public function dayEndReport(): BelongsTo
    {
        return $this->belongsTo(DayEndReport::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function scopeActive($query)
    {
        return $query->where('voided', false);
    }
}
