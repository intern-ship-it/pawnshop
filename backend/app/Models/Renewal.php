<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Renewal extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'pledge_id',
        'renewal_no',
        'renewal_count',
        'renewal_months',
        'previous_due_date',
        'new_due_date',
        'interest_rate',
        'interest_amount',
        'handling_fee',
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
        'created_by',
    ];

    protected $casts = [
        'previous_due_date' => 'date',
        'new_due_date' => 'date',
        'interest_rate' => 'decimal:2',
        'interest_amount' => 'decimal:2',
        'handling_fee' => 'decimal:2',
        'total_payable' => 'decimal:2',
        'cash_amount' => 'decimal:2',
        'transfer_amount' => 'decimal:2',
        'terms_accepted' => 'boolean',
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

    public function interestBreakdown(): HasMany
    {
        return $this->hasMany(RenewalInterestBreakdown::class);
    }

    public static function generateRenewalNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $year = date('Y');
        $lastRenewal = static::where('branch_id', $branchId)
            ->whereYear('created_at', $year)
            ->orderBy('id', 'desc')
            ->first();

        $number = $lastRenewal ? (int)substr($lastRenewal->renewal_no, -4) + 1 : 1;
        return sprintf('RNW-%s-%s-%04d', $branch->code, $year, $number);
    }
}
