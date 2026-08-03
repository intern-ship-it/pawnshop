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
     * Per the client, the renewed term continues from the PREVIOUS DUE DATE, so the
     * ticket is dated from there. It is deliberately NOT:
     *  - the pledge's pledge_date (the first-pawn date, which never moves), nor
     *  - the day the customer actually came in to renew.
     * A customer due 10/07 who renews late on 24/07 still gets a ticket dated 10/07.
     *
     * The day he came in is not lost -- it stays on this row as created_at, so
     * "when did he renew?" is always answerable even though it is not what prints.
     *
     * Falls back to created_at, then today, so a preview rendered before the row is
     * saved (no previous_due_date yet) still prints a date.
     */
    public function getTicketStartDateAttribute(): Carbon
    {
        $date = $this->previous_due_date ?? $this->created_at ?? Carbon::today();

        return $date instanceof Carbon ? $date : Carbon::parse($date);
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
     * The term is anchored to the PREVIOUS DUE DATE, not the day the customer walks
     * in: a pledge due 10/07 renewed for 6 months runs to 10/01 whether he comes on
     * the 3rd, the 10th or the 24th. A late renewer therefore gets fewer usable
     * days -- that is the client's rule, and the actual visit date is kept on the
     * row as created_at for reference.
     *
     * No -1 day here: the previous due date is already the term's own anchor, and
     * "+ N months" lands on the date that reads back as exactly N BULAN (10/07 ->
     * 10/01). Existing renewals were stored this way, so nothing needs backfilling.
     */
    public static function dueDateForNewTerm(Carbon $previousDueDate, int $termMonths): Carbon
    {
        return $previousDueDate->copy()->addMonths($termMonths);
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
