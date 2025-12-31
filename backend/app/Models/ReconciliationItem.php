<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReconciliationItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'reconciliation_id',
        'pledge_item_id',
        'barcode_scanned',
        'status',
        'scanned_at',
        'scanned_by',
        'notes',
    ];

    protected $casts = [
        'scanned_at' => 'datetime',
    ];

    public function reconciliation(): BelongsTo
    {
        return $this->belongsTo(Reconciliation::class);
    }

    public function pledgeItem(): BelongsTo
    {
        return $this->belongsTo(PledgeItem::class, 'pledge_item_id');
    }

    public function scannedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scanned_by');
    }
}
