<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A payment made against the loan itself.
 *
 * Distinct from an InterestPayment, which settles the cost of borrowing and leaves the
 * debt untouched. This reduces the debt, and the goods stay where they are.
 */
class PrincipalPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'pledge_id',
        'payment_no',
        'amount',
        'principal_before',
        'principal_after',
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
        'amount' => 'decimal:2',
        'principal_before' => 'decimal:2',
        'principal_after' => 'decimal:2',
        'cash_amount' => 'decimal:2',
        'transfer_amount' => 'decimal:2',
    ];

    public function pledge(): BelongsTo
    {
        return $this->belongsTo(Pledge::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
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

        return sprintf('PRN-%s-%s-%04d', $branch->code, $year, $number);
    }
}
