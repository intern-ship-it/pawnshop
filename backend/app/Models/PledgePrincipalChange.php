<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One entry in a pledge's principal ledger: the amount outstanding from a given date.
 *
 * Written, never rewritten. Correcting a mistake means another row, so the history of
 * what the customer was actually charged stays readable.
 */
class PledgePrincipalChange extends Model
{
    use HasFactory;

    public const REASON_INITIAL = 'initial';
    public const REASON_PARTIAL_REDEMPTION = 'partial_redemption';
    public const REASON_PRINCIPAL_PAYMENT = 'principal_payment';

    protected $fillable = [
        'pledge_id',
        'effective_from',
        'principal_amount',
        'reason',
        'source_type',
        'source_id',
        'created_by',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'principal_amount' => 'decimal:2',
    ];

    public function pledge(): BelongsTo
    {
        return $this->belongsTo(Pledge::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
