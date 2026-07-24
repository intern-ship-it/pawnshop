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
     * Per the client, a renewal re-dates the ticket to the day the customer came in
     * to renew. It is NOT the pledge's pledge_date: that records when the item was
     * first pawned and never moves, so the A5 overlay -- which read it off the
     * pledge -- kept printing the original pawn date on every renewal while the A4
     * overlay printed the renewal date. Both now read this.
     *
     * Falls back to today so a preview rendered before the row is saved still
     * prints a date.
     */
    public function getTicketStartDateAttribute(): Carbon
    {
        $date = $this->created_at ?? Carbon::today();

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
     * When a renewed term ends, given the day it starts.
     *
     * The term runs from the day the customer comes in to renew -- NOT from the
     * pledge's old due date, which is what this used to extend. Renewing 14 days
     * late then produced a term 14 days short of the "6 BULAN" printed on the
     * ticket; renewing early quietly banked the unused days on top.
     *
     * The -1 day mirrors a new pledge (PledgeController: today + N months - 1 day)
     * so both ticket types count their term inclusively from the date they carry:
     * a ticket dated 24/07 for 6 months runs to 23/01, its last valid day.
     */
    public static function dueDateForNewTerm(Carbon $startDate, int $termMonths): Carbon
    {
        return $startDate->copy()->addMonths($termMonths)->subDay();
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
