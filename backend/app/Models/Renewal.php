<?php

namespace App\Models;

use Carbon\Carbon;
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
        'term_start_date',
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
        'term_start_date' => 'date',
        'new_due_date' => 'date',
        'interest_rate' => 'decimal:2',
        'interest_amount' => 'decimal:2',
        'handling_fee' => 'decimal:2',
        'total_payable' => 'decimal:2',
        'cash_amount' => 'decimal:2',
        'transfer_amount' => 'decimal:2',
        'terms_accepted' => 'boolean',
    ];

    /**
     * Interest that actually changed hands at the counter.
     *
     * A renewal only extends the due date; the money is taken on the interest
     * payment screen. RenewalController writes cash_amount/transfer_amount as zero
     * and keeps `interest_amount` purely as the accrued figure for the receipt, so
     * summing that column counts interest nobody paid. Historical renewals DID
     * collect, so credit what was received rather than assuming zero.
     *
     * Mirrors InterestPayment::interest_collected so reports can sum one field
     * across both record types, and Pledge::total_interest_paid, which already
     * credits renewals by money received for the same reason.
     */
    public function getInterestCollectedAttribute(): float
    {
        return round((float) $this->cash_amount + (float) $this->transfer_amount, 2);
    }

    /**
     * The date a renewal ticket is dated -- what prints under "Tarikh Dipajak".
     *
     * The new term begins the DAY AFTER the previous due date. The stored due date
     * is itself one day before the anniversary (a pledge's own "-1 day" convention),
     * so the real anniversary -- and the first day of the renewed term -- is
     * previous_due_date + 1. A pledge due 10/07 therefore prints 11/07 here, and its
     * six-month renewal ends 10/01, exactly the way a new pledge reads (23/07 pawn
     * -> 22/01 due).
     *
     * Deliberately NOT the pledge's pledge_date (the first-pawn date, which never
     * moves) and NOT the day the customer came in. The visit date is kept on the row
     * as created_at, so "when did he renew?" stays answerable even though it is not
     * what prints.
     *
     * Falls back to created_at, then today, so a preview rendered before the row is
     * saved (no previous_due_date yet) still prints a date.
     */
    public function getTicketStartDateAttribute(): Carbon
    {
        // The anchor actually used, recorded at renewal time. Rows written before that
        // column existed have none and fall through to the derivation below -- which is
        // precisely what they print today, so no old ticket is re-dated.
        if ($this->term_start_date) {
            return $this->term_start_date instanceof Carbon
                ? $this->term_start_date->copy()
                : Carbon::parse($this->term_start_date);
        }

        if ($this->previous_due_date) {
            $due = $this->previous_due_date instanceof Carbon
                ? $this->previous_due_date->copy()
                : Carbon::parse($this->previous_due_date);

            return $due->addDay();
        }

        $date = $this->created_at ?? Carbon::today();

        return $date instanceof Carbon ? $date->copy() : Carbon::parse($date);
    }

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

    /**
     * When a renewed term ends, given the previous due date it continues from.
     *
     * The new term starts the day AFTER the previous due date (that stored date is
     * itself one day before the anniversary), runs `termMonths`, and ends one day
     * before its own anniversary -- the same "-1 day" convention a new pledge uses
     * (PledgeController: start + N months - 1 day).
     *
     * So a pledge due 10/07 renewed for 6 months: term starts 11/07, ends 10/01. The
     * ticket reads 11/07 -> 10/01, exactly as a pawn of 23/07 reads 23/07 -> 22/01.
     * The addDay/subDay are written out rather than cancelled so the reasoning -- and
     * month-end behaviour -- stays visible.
     *
     * The term is anchored to the due date, not the day the customer walks in, so a
     * late renewer gets fewer usable days; the actual visit stays on the row as
     * created_at for reference.
     *
     * $paidThrough moves that anchor forward for a customer who went overdue and paid
     * interest PAST the due date. Client-confirmed 2026-09-10: those months must not
     * be sold twice. A pledge due 24/07 whose interest is paid to 25/09 renews to
     * 24/03, not 24/01 — six months paid, six months received. Anchoring on the due
     * date alone charged a full term while handing back only the part that did not
     * overlap what was already settled.
     *
     * It can only ever push the date later, never earlier, and for a pledge renewed
     * on time the two anchors are the same date, so on-time renewals are unaffected.
     */
    public static function dueDateForNewTerm(
        Carbon $previousDueDate,
        int $termMonths,
        ?Carbon $paidThrough = null
    ): Carbon {
        return static::termStartForNewTerm($previousDueDate, $paidThrough)
            ->addMonths($termMonths)
            ->subDay();
    }

    /**
     * The first day of the renewed term — the anchor the new due date is measured from,
     * and the date the ticket is dated. Split out so the printed start date and the
     * printed expiry can never be derived from different rules: a ticket reading
     * 25/07 -> 24/03 above the words "6 BULAN" is a contradiction the customer can see.
     */
    public static function termStartForNewTerm(Carbon $previousDueDate, ?Carbon $paidThrough = null): Carbon
    {
        $start = $previousDueDate->copy()->addDay();

        return ($paidThrough !== null && $paidThrough->gt($start))
            ? $paidThrough->copy()
            : $start;
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
