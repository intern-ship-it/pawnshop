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
        'current_term_start',
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
        // datetime, not date: renew-then-pay on the same day is only separable by time.
        'current_term_start' => 'datetime',
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

    /**
     * The month-based rate ladder frozen onto this pledge at creation.
     *
     * Empty for pledges created before tiering existed; those fall back to the flat
     * standard/extended rates held in this table's own columns.
     */
    public function interestTiers(): HasMany
    {
        return $this->hasMany(PledgeInterestTier::class)->orderBy('from_month');
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

    /**
     * Filter by one or more display statuses (comma-separated), OR-combined.
     *
     * Several statuses are "virtual" -- they are not the stored `status` column but a
     * real-state view of it, because the column never flips when a due date passes:
     * an active pledge past its due date is overdue in fact. `overdue` and `active`
     * therefore each expand to a condition on status + due_date.
     *
     * The statuses must be OR'd, not AND'd. Passing "active,overdue" means "either
     * redeemable state" -- the redemption search relies on it. Applying each branch
     * as a bare ->where() (as the controller once did inline) AND-ed them into
     * "active AND overdue", a contradiction that returned zero rows and made the
     * redemption lookup fail for every pledge.
     */
    public function scopeDisplayStatus($query, string $status)
    {
        $statuses = array_filter(array_map('trim', explode(',', $status)));
        if (empty($statuses)) {
            return $query;
        }

        $today = Carbon::today()->toDateString();

        return $query->where(function ($outer) use ($statuses, $today) {
            foreach ($statuses as $s) {
                switch ($s) {
                    case 'due_soon':
                        $weekAhead = Carbon::parse($today)->addDays(7)->toDateString();
                        $outer->orWhere(function ($q) use ($today, $weekAhead) {
                            $q->where('status', 'active')
                                ->whereBetween('due_date', [$today, $weekAhead]);
                        });
                        break;

                    case 'partial':
                        $outer->orWhere(function ($q) {
                            $q->where('status', 'active')->whereHas('redemption');
                        });
                        break;

                    case 'overdue_partial':
                        $outer->orWhere(function ($q) {
                            $q->where('status', 'overdue')->whereHas('redemption');
                        });
                        break;

                    case 'overdue':
                        // Stored 'overdue', OR active-but-past-due (real state).
                        $outer->orWhere(function ($q) use ($today) {
                            $q->where('status', 'overdue')
                                ->orWhere(function ($q2) use ($today) {
                                    $q2->where('status', 'active')
                                        ->whereNotNull('due_date')
                                        ->whereDate('due_date', '<', $today);
                                });
                        });
                        break;

                    case 'active':
                        // Active AND not yet past due, so Active and Overdue partition
                        // the list the same way the stat tiles count them.
                        $outer->orWhere(function ($q) use ($today) {
                            $q->where('status', 'active')
                                ->where(function ($q2) use ($today) {
                                    $q2->whereNull('due_date')
                                        ->orWhereDate('due_date', '>=', $today);
                                });
                        });
                        break;

                    default:
                        $outer->orWhere('status', $s);
                        break;
                }
            }
        });
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
        // due_date first: diffInDays counts from the receiver to the argument, so
        // today->diffInDays(due_date) is negative once the due date has passed.
        // That made `$daysOverdue > 0` always false and the overdue rate never applied.
        return (int) $this->due_date->diffInDays(Carbon::today());
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

    /**
     * Interest paid toward the CURRENT term only — payments made on or after
     * current_term_start. This is what the renewal gate measures: a pledge in its
     * second term must not be credited for interest paid on the first.
     *
     * current_term_start is backfilled for every pledge, but guard against null so
     * an un-migrated row falls back to counting everything rather than crashing.
     */
    public function interestPaidThisTerm(): float
    {
        // Matched on the term the payment was stamped with, not on time. Timestamps
        // cannot separate a payment from a renewal made in the same second: `>=`
        // credited the closing term's money to the new term (making the next renewal
        // free) and `>` discarded it (billing the customer twice for one term).
        return (float) $this->interestPayments()
            ->where('status', 'completed')
            ->where('term_number', (int) $this->renewal_count)
            ->sum('interest_amount');
    }

    /**
     * The branch's standard term length: the widest month a configured standard/
     * custom rate rule covers, defaulting to 6 when no ladder exists. This is the
     * value both controllers used to read for themselves; centralising it here (and
     * in currentTermMonths) is what keeps the renewal gate and the interest-payment
     * screen from ever disagreeing on the term.
     */
    public function standardTermMonths(): int
    {
        $end = (int) \App\Models\InterestRate::where('is_active', true)
            ->whereIn('rate_type', ['standard', 'custom'])
            ->where(function ($q) {
                $q->where('branch_id', $this->branch_id)->orWhereNull('branch_id');
            })
            ->max('to_month');

        return $end > 0 ? $end : 6;
    }

    /**
     * The length in months of the pledge's CURRENT term — what "a full term of
     * interest" is measured against by both the renewal gate and the interest
     * screen.
     *
     * Legacy pledges were booked for short terms (2, 3, 4 months) while every modern
     * pledge is booked for the standard 6. Reading the term from the pledge's own
     * booked dates lets an old 2-month pledge renew once its 2 months are paid,
     * instead of being wrongly forced to prepay all 6.
     *
     *  - First term (renewal_count 0): the pledge's own booked span, rounded to whole
     *    months from pledge_date to due_date. Modern pledges round to exactly 6, so
     *    nothing changes for them.
     *  - After a renewal (renewal_count >= 1): the standard length, since every
     *    renewal extends by the fixed standard term regardless of the original
     *    booking.
     */
    public function currentTermMonths(): int
    {
        // First term with real dates: derive from the pledge's own booking.
        if ((int) $this->renewal_count === 0 && $this->pledge_date && $this->due_date) {
            $months = (int) round(
                Carbon::parse($this->pledge_date)->floatDiffInMonths(Carbon::parse($this->due_date))
            );
            if ($months >= 1) {
                return $months;
            }
        }

        // Renewed terms, or an un-dated row, fall back to the standard length.
        return $this->standardTermMonths();
    }

    /**
     * The ladder month this pledge's CURRENT term begins at.
     *
     * Months keep climbing across renewals: term 1 is months 1-6, term 2 is 7-12,
     * and so on. That is what pushes a renewed pledge onto the extended tier — the
     * ladder's "from month 7 onwards" rule. Restarting each term at month 1 would
     * mean the extended rate never applied to a renewed pledge at all.
     */
    public function termStartMonth(int $termMonths = 6): int
    {
        return ((int) $this->renewal_count * $termMonths) + 1;
    }

    /**
     * The full interest for the CURRENT term, down the pledge's frozen tier ladder,
     * counted from the term's real ladder position. Term 1 of a 0.5/1.0 ladder costs
     * 3 months at 0.5% plus 3 at 1.0%; term 2 sits at months 7-12 and so takes the
     * extended rate throughout.
     *
     * This is the amount that must be settled before a renewal may proceed — not
     * merely the interest accrued so far.
     *
     * Untiered legacy pledges fall back to the flat rate their own column holds, via
     * the same service every screen uses, so no existing pledge changes.
     */
    public function fullTermInterest(int $termMonths = 6): float
    {
        // An unsettled pledge that ran past its due date reprices EVERY month to the
        // overdue rate, so the term it must settle costs the overdue rate throughout.
        if ($this->overdueRepricingApplies()) {
            return round((float) $this->loan_amount * ($this->overdueRate() / 100) * $termMonths, 2);
        }

        return $this->ladderTermInterest($termMonths);
    }

    /**
     * The term's interest at the pledge's OWN ladder — no overdue repricing.
     *
     * Kept separate because overdueRepricingApplies() asks "did he pay what he
     * originally owed?", and answering that with the repriced figure would both
     * recurse and move the goalposts: the customer is judged against the rates he
     * signed for, not the penalty rates.
     */
    private function ladderTermInterest(int $termMonths): float
    {
        $service = app(\App\Services\InterestCalculationService::class)->forPledge($this);
        $principal = (float) $this->loan_amount;
        $flatRate = (float) $this->interest_rate;

        $firstMonth = $this->termStartMonth($termMonths);
        $total = 0.0;

        for ($offset = 0; $offset < $termMonths; $offset++) {
            $rate = $service->rateForMaintainedMonth($firstMonth + $offset, $flatRate)['rate'];
            $total += $principal * ($rate / 100);
        }

        return round($total, 2);
    }

    /**
     * The penalty rate an overdue pledge reprices to.
     *
     * Prefers the pledge's own frozen column so a reprint or a later settings change
     * cannot alter what this customer was told, then the customer's own override,
     * then the branch rule, and finally the service default.
     */
    public function overdueRate(): float
    {
        if ($this->interest_rate_overdue !== null) {
            return (float) $this->interest_rate_overdue;
        }

        if ($this->customer && $this->customer->custom_interest_rate_overdue !== null) {
            return (float) $this->customer->custom_interest_rate_overdue;
        }

        $configured = \App\Models\InterestRate::where('is_active', true)
            ->where('rate_type', 'overdue')
            ->where(function ($q) {
                $q->where('branch_id', $this->branch_id)->orWhereNull('branch_id');
            })
            ->value('rate_percentage');

        return $configured !== null
            ? (float) $configured
            : \App\Services\InterestCalculationService::OVERDUE_RATE;
    }

    /**
     * Whether this pledge's whole bill reprices to the overdue rate.
     *
     * The client's rule: a pledge that passes its due date WITHOUT its term interest
     * having been settled moves to the overdue rate for every month — the term months
     * are recharged, not just the months past the due date. Settling the term in full
     * protects the customer: he keeps the rates he signed for even if he is late.
     *
     * "Past the due date" is strictly after it — a pledge due today is still on normal
     * rates and only flips tomorrow.
     */
    public function overdueRepricingApplies(): bool
    {
        if (!$this->due_date || !Carbon::today()->gt($this->due_date)) {
            return false;
        }

        $termMonths = $this->currentTermMonths();

        // Half a cent of tolerance so rounding cannot leave a fully-paid term looking
        // a fraction short and hit the customer with the penalty rate.
        return $this->interestPaidThisTerm() + 0.005 < $this->ladderTermInterest($termMonths);
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
