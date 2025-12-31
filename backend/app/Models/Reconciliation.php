<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reconciliation extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'reconciliation_no',
        'reconciliation_type',
        'expected_items',
        'scanned_items',
        'matched_items',
        'missing_items',
        'unexpected_items',
        'status',
        'started_at',
        'completed_at',
        'started_by',
        'completed_by',
        'notes',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ReconciliationItem::class);
    }

    public function startedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function getAccuracyRateAttribute(): float
    {
        if ($this->expected_items === 0) {
            return 100;
        }
        return round(($this->matched_items / $this->expected_items) * 100, 2);
    }
}
