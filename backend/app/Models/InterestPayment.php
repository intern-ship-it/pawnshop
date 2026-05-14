<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InterestPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'pledge_id',
        'payment_no',
        'interest_months',
        'period_from',
        'period_to',
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
        'notes',
        'created_by',
    ];

    protected $casts = [
        'period_from' => 'date',
        'period_to' => 'date',
        'interest_rate' => 'decimal:2',
        'interest_amount' => 'decimal:2',
        'handling_fee' => 'decimal:2',
        'total_payable' => 'decimal:2',
        'cash_amount' => 'decimal:2',
        'transfer_amount' => 'decimal:2',
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

    public function breakdown(): HasMany
    {
        return $this->hasMany(InterestPaymentBreakdown::class);
    }

    public static function generatePaymentNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $year = date('Y');
        $lastPayment = static::where('branch_id', $branchId)
            ->whereYear('created_at', $year)
            ->orderBy('id', 'desc')
            ->first();

        $number = $lastPayment ? (int) substr($lastPayment->payment_no, -4) + 1 : 1;
        return sprintf('INT-%s-%s-%04d', $branch->code, $year, $number);
    }
}
