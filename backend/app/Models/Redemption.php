<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Redemption extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'pledge_id',
        'redemption_no',
        'principal_amount',
        'interest_months',
        'interest_rate',
        'interest_amount',
        'handling_fee',
        'other_charges',
        'total_payable',
        'payment_method',
        'cash_amount',
        'transfer_amount',
        'bank_id',
        'account_number',
        'reference_no',
        'status',
        'terms_accepted',
        'customer_signature',
        'items_released',
        'released_at',
        'released_by',
        'created_by',
    ];

    protected $casts = [
        'principal_amount' => 'decimal:2',
        'interest_rate' => 'decimal:2',
        'interest_amount' => 'decimal:2',
        'handling_fee' => 'decimal:2',
        'other_charges' => 'decimal:2',
        'total_payable' => 'decimal:2',
        'cash_amount' => 'decimal:2',
        'transfer_amount' => 'decimal:2',
        'terms_accepted' => 'boolean',
        'items_released' => 'boolean',
        'released_at' => 'datetime',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

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

    public function releasedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }

    public static function generateRedemptionNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $year = date('Y');
        $lastRedemption = static::where('branch_id', $branchId)
            ->whereYear('created_at', $year)
            ->orderBy('id', 'desc')
            ->first();

        $number = $lastRedemption ? (int)substr($lastRedemption->redemption_no, -4) + 1 : 1;
        return sprintf('RDM-%s-%s-%04d', $branch->code, $year, $number);
    }
}
