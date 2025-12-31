<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class Pledge extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'customer_id',
        'pledge_no',
        'receipt_no',
        'owner_id',
        'is_owner',
        'total_weight',
        'gross_value',
        'total_deduction',
        'net_value',
        'loan_percentage',
        'loan_amount',
        'interest_rate',
        'interest_rate_extended',
        'interest_rate_overdue',
        'pledge_date',
        'due_date',
        'grace_end_date',
        'gold_price_999',
        'gold_price_916',
        'gold_price_875',
        'gold_price_750',
        'status',
        'renewal_count',
        'customer_signature',
        'terms_accepted',
        'terms_accepted_at',
        'receipt_printed',
        'receipt_print_count',
        'created_by',
        'approved_by',
    ];

    protected $casts = [
        'is_owner' => 'boolean',
        'total_weight' => 'decimal:3',
        'gross_value' => 'decimal:2',
        'total_deduction' => 'decimal:2',
        'net_value' => 'decimal:2',
        'loan_percentage' => 'decimal:2',
        'loan_amount' => 'decimal:2',
        'interest_rate' => 'decimal:2',
        'interest_rate_extended' => 'decimal:2',
        'interest_rate_overdue' => 'decimal:2',
        'pledge_date' => 'date',
        'due_date' => 'date',
        'grace_end_date' => 'date',
        'gold_price_999' => 'decimal:2',
        'gold_price_916' => 'decimal:2',
        'gold_price_875' => 'decimal:2',
        'gold_price_750' => 'decimal:2',
        'terms_accepted' => 'boolean',
        'terms_accepted_at' => 'datetime',
        'receipt_printed' => 'boolean',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(CustomerOwner::class, 'owner_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PledgeItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PledgePayment::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(PledgeReceipt::class);
    }

    public function renewals(): HasMany
    {
        return $this->hasMany(Renewal::class);
    }

    public function redemption(): HasMany
    {
        return $this->hasMany(Redemption::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isOverdue(): bool
    {
        return $this->status === 'active' && Carbon::today()->gt($this->due_date);
    }

    public function isInGracePeriod(): bool
    {
        $today = Carbon::today();
        return $today->gt($this->due_date) && $today->lte($this->grace_end_date);
    }

    public function getDaysOverdueAttribute(): int
    {
        if (!$this->isOverdue()) {
            return 0;
        }
        return Carbon::today()->diffInDays($this->due_date);
    }

    public function getMonthsElapsedAttribute(): int
    {
        return Carbon::parse($this->pledge_date)->diffInMonths(Carbon::today());
    }

    public function getCurrentInterestRateAttribute(): float
    {
        $months = $this->months_elapsed;
        
        if ($this->isOverdue()) {
            return $this->interest_rate_overdue;
        }
        
        if ($months > 6) {
            return $this->interest_rate_extended;
        }
        
        return $this->interest_rate;
    }

    public function getCurrentInterestAmountAttribute(): float
    {
        $months = max(1, $this->months_elapsed);
        return $this->loan_amount * ($this->current_interest_rate / 100) * $months;
    }

    public function getTotalInterestPaidAttribute(): float
    {
        return $this->renewals()->sum('interest_amount');
    }

    public static function generatePledgeNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $year = date('Y');
        $lastPledge = static::where('branch_id', $branchId)
            ->whereYear('created_at', $year)
            ->orderBy('id', 'desc')
            ->first();

        $number = $lastPledge ? (int)substr($lastPledge->pledge_no, -4) + 1 : 1;
        return sprintf('PLG-%s-%s-%04d', $branch->code, $year, $number);
    }

    public static function generateReceiptNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $year = date('Y');
        $lastPledge = static::where('branch_id', $branchId)
            ->whereYear('created_at', $year)
            ->orderBy('id', 'desc')
            ->first();

        $number = $lastPledge ? (int)substr($lastPledge->receipt_no, -4) + 1 : 1;
        return sprintf('RCP-%s-%s-%04d', $branch->code, $year, $number);
    }
}
