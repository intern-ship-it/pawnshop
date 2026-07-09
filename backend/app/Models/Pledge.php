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
        'handling_fee',
        'payout_amount',
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
        'market_gold_prices',
        'market_price_source',
        'status',
        'renewal_count',
        'customer_signature',
        'terms_accepted',
        'terms_accepted_at',
        'receipt_printed',
        'receipt_print_count',
        'created_by',
        'approved_by',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'cancellation_notes',
        'forfeited_at',
        'forfeited_by',
    ];

    protected $casts = [
        'is_owner' => 'boolean',
        'total_weight' => 'decimal:3',
        'gross_value' => 'decimal:2',
        'total_deduction' => 'decimal:2',
        'net_value' => 'decimal:2',
        'loan_percentage' => 'decimal:2',
        'loan_amount' => 'decimal:2',
        'handling_fee' => 'decimal:2',
        'payout_amount' => 'decimal:2',
        'interest_rate' => 'decimal:2',
        'interest_rate_extended' => 'decimal:2',
        'interest_rate_overdue' => 'decimal:2',
        'pledge_date' => 'date:Y-m-d',
        'due_date' => 'date:Y-m-d',
        'grace_end_date' => 'date:Y-m-d',
        'gold_price_999' => 'decimal:2',
        'gold_price_916' => 'decimal:2',
        'gold_price_875' => 'decimal:2',
        'gold_price_750' => 'decimal:2',
        'market_gold_prices' => 'array',
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

    public function interestPayments(): HasMany
    {
        return $this->hasMany(InterestPayment::class);
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
        // Charge per STARTED month: any leftover days past a completed month
        // round up to the next full month (e.g. 1 month 8 days = 2 months).
        // ceil() on the calendar-aware float keeps 31-day months correct.
        $months = Carbon::parse($this->pledge_date)->diffInMonths(Carbon::today(), true);

        return (int) ceil($months);
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

    /**
     * Interest the customer has actually handed over.
     *
     * Interest payments are the normal channel; cancelled ones must not count.
     * Renewals no longer collect anything (they only extend the due date), but
     * historical renewals did, so credit the cash/transfer actually received
     * rather than their `interest_amount` — that column is now only a reference
     * figure for the receipt and would otherwise become a phantom credit at
     * redemption for money nobody paid.
     *
     * Previously summed renewals' interest_amount alone, so interest paid at the
     * counter was invisible and got charged a second time at redemption.
     */
    public function getTotalInterestPaidAttribute(): float
    {
        $fromPayments = (float) $this->interestPayments()
            ->where('status', 'completed')
            ->sum('interest_amount');

        $fromRenewals = (float) $this->renewals()
            ->selectRaw('COALESCE(SUM(cash_amount + transfer_amount), 0) AS received')
            ->value('received');

        return $fromPayments + $fromRenewals;
    }

    public static function generatePledgeNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $year = date('Y');
        $lastPledge = static::where('branch_id', $branchId)
            ->whereYear('created_at', $year)
            ->orderBy('pledge_no', 'desc')
            ->first();

        $number = $lastPledge ? (int) substr($lastPledge->pledge_no, -4) + 1 : 1;
        return sprintf('PLG-%s-%s-%04d', $branch->code, $year, $number);
    }

    public static function generateReceiptNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $year = date('Y');
        $lastPledge = static::where('branch_id', $branchId)
            ->whereYear('created_at', $year)
            ->orderBy('receipt_no', 'desc')
            ->first();

        $number = $lastPledge ? (int) substr($lastPledge->receipt_no, -4) + 1 : 1;
        return sprintf('RCP-%s-%s-%04d', $branch->code, $year, $number);
    }
}
