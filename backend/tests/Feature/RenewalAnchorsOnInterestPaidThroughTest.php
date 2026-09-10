<?php

namespace Tests\Feature;

use App\Models\Renewal;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * Client-confirmed 2026-09-10: a customer who went overdue and paid interest PAST the
 * due date must not be sold those months a second time.
 *
 * The new term used to be anchored on the old due date alone. A pledge due 24/07 whose
 * customer had paid interest through 25/09 renewed to 24/01 — six months charged, four
 * months of new cover, with August and September paid for twice (once as overdue
 * interest, once inside the new term).
 *
 * The anchor is now the later of "day after the previous due date" and "the date
 * interest is paid through". For a pledge renewed on time those are the same date, so
 * the ordinary case must not move.
 */
class RenewalAnchorsOnInterestPaidThroughTest extends TestCase
{
    public function test_an_on_time_renewal_is_unchanged(): void
    {
        $due = Carbon::parse('2026-07-10');

        // Interest paid exactly to the end of the term: paid-through IS the day the
        // new term would start anyway, so the anchor cannot move.
        $this->assertSame(
            '2027-01-10',
            Renewal::dueDateForNewTerm($due, 6, Carbon::parse('2026-07-11'))->toDateString()
        );

        // And with no payments recorded at all.
        $this->assertSame('2027-01-10', Renewal::dueDateForNewTerm($due, 6, null)->toDateString());
        $this->assertSame('2027-01-10', Renewal::dueDateForNewTerm($due, 6)->toDateString());
    }

    public function test_interest_paid_past_the_due_date_pushes_the_new_term_out(): void
    {
        // The reported case: pledge due 24/07/2026, 8 months of interest paid, which
        // covers through 25/09/2026. Six months paid must buy six months.
        $this->assertSame(
            '2027-03-24',
            Renewal::dueDateForNewTerm(Carbon::parse('2026-07-24'), 6, Carbon::parse('2026-09-25'))->toDateString()
        );

        // Without the paid-through anchor this is the old, overlapping answer.
        $this->assertSame(
            '2027-01-24',
            Renewal::dueDateForNewTerm(Carbon::parse('2026-07-24'), 6)->toDateString()
        );
    }

    public function test_the_anchor_can_only_move_the_date_later(): void
    {
        $due = Carbon::parse('2026-07-24');

        // A paid-through date BEFORE the due date (a part-paid term) must never pull
        // the new term in and shorten it.
        $this->assertSame(
            '2027-01-24',
            Renewal::dueDateForNewTerm($due, 6, Carbon::parse('2026-04-25'))->toDateString()
        );
    }

    public function test_the_shorter_legacy_terms_use_the_same_anchor(): void
    {
        $paidThrough = Carbon::parse('2026-09-25');
        $due = Carbon::parse('2026-07-24');

        $this->assertSame('2026-11-24', Renewal::dueDateForNewTerm($due, 2, $paidThrough)->toDateString());
        $this->assertSame('2026-12-24', Renewal::dueDateForNewTerm($due, 3, $paidThrough)->toDateString());
        $this->assertSame('2027-01-24', Renewal::dueDateForNewTerm($due, 4, $paidThrough)->toDateString());
    }

    public function test_month_end_behaviour_is_preserved_on_the_new_anchor(): void
    {
        // Carbon clamps a short month rather than spilling into the next one, and the
        // -1 day convention still applies from the moved anchor.
        $this->assertSame(
            '2027-02-28',
            Renewal::dueDateForNewTerm(Carbon::parse('2026-07-24'), 6, Carbon::parse('2026-08-29'))->toDateString()
        );
    }

    public function test_the_anchor_does_not_mutate_the_dates_it_is_given(): void
    {
        $due = Carbon::parse('2026-07-24');
        $paidThrough = Carbon::parse('2026-09-25');

        Renewal::dueDateForNewTerm($due, 6, $paidThrough);

        $this->assertSame('2026-07-24', $due->toDateString(), 'The pledge due date must not be mutated');
        $this->assertSame('2026-09-25', $paidThrough->toDateString(), 'The paid-through date must not be mutated');
    }

    public function test_the_term_start_matches_the_anchor_the_due_date_used(): void
    {
        $due = Carbon::parse('2026-07-24');
        $paidThrough = Carbon::parse('2026-09-25');

        // The printed start and the printed expiry must come from ONE anchor, or the
        // ticket reads 25/07 -> 24/03 above the words "6 BULAN" — eight months on its
        // face, six in the text.
        $start = Renewal::termStartForNewTerm($due, $paidThrough);
        $this->assertSame('2026-09-25', $start->toDateString());
        $this->assertSame(
            '2027-03-24',
            Renewal::dueDateForNewTerm($due, 6, $paidThrough)->toDateString()
        );
        $this->assertSame(6, (int) $start->diffInMonths(Carbon::parse('2027-03-25')));
    }

    public function test_an_on_time_renewal_starts_the_day_after_the_due_date_as_before(): void
    {
        $due = Carbon::parse('2026-07-10');

        $this->assertSame('2026-07-11', Renewal::termStartForNewTerm($due)->toDateString());
        $this->assertSame('2026-07-11', Renewal::termStartForNewTerm($due, Carbon::parse('2026-07-11'))->toDateString());

        // A part-paid term cannot pull the start date backwards and shorten the loan.
        $this->assertSame('2026-07-11', Renewal::termStartForNewTerm($due, Carbon::parse('2026-05-01'))->toDateString());
    }

    public function test_a_recorded_anchor_is_what_the_ticket_prints(): void
    {
        $renewal = new Renewal([
            'previous_due_date' => '2026-07-24',
            'term_start_date' => '2026-09-25',
            'new_due_date' => '2027-03-24',
            'renewal_months' => 6,
        ]);

        $this->assertSame('2026-09-25', $renewal->ticket_start_date->toDateString());
    }

    public function test_a_renewal_with_no_recorded_anchor_prints_exactly_what_it_does_today(): void
    {
        // Every row written before the column existed. Falling back to
        // previous_due_date + 1 keeps their tickets byte-identical.
        $legacy = new Renewal([
            'previous_due_date' => '2026-07-24',
            'new_due_date' => '2027-01-24',
            'renewal_months' => 6,
        ]);

        $this->assertSame('2026-07-25', $legacy->ticket_start_date->toDateString());
    }
}
