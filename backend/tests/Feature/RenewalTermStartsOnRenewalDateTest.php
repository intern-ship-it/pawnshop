<?php

namespace Tests\Feature;

use App\Models\Renewal;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * A renewed term starts the DAY AFTER the previous due date and ends one day before
 * its own anniversary -- the same convention a new pledge uses, per the client.
 *
 * The stored due date is itself one day before the anniversary, so the renewed term
 * begins previous_due + 1: a pledge due 10/07 renews to a term of 11/07 -> 10/01,
 * whether the customer comes on the 3rd, the 10th or the 24th. It is anchored to the
 * due date, not the visit, so a late renewer gets fewer usable days; the actual
 * visit stays on the row as created_at.
 *
 * dueDateForNewTerm(previousDueDate, months) is the single rule the renewal quote
 * and the save share, so the screen cannot promise an expiry the ticket contradicts.
 */
class RenewalTermStartsOnRenewalDateTest extends TestCase
{
    public function test_the_new_term_ends_one_day_before_its_anniversary(): void
    {
        // Due 10/07 -> term starts 11/07, six months -> ends 10/01/2027.
        $due = Renewal::dueDateForNewTerm(Carbon::parse('2026-07-10'), 6);

        $this->assertSame('2027-01-10', $due->toDateString());
        // Not 11/01 -- that would be a day too long (the bare anniversary).
        $this->assertNotSame('2027-01-11', $due->toDateString());
    }

    public function test_the_expiry_ignores_when_the_customer_came_in(): void
    {
        // Due 10/07/2026. Whether he renews on the 3rd, 10th or 24th, the new expiry
        // is the same, because it is measured from the due date, not the visit.
        $due = Renewal::dueDateForNewTerm(Carbon::parse('2026-07-10'), 6);

        $this->assertSame('2027-01-10', $due->toDateString());
    }

    public function test_it_matches_how_a_new_pledge_counts_its_term(): void
    {
        // A new pledge does start + N months - 1 day (PledgeController). The renewed
        // term starts the day after the previous due date and counts the same way, so
        // the two ticket types never disagree on what a 6-month term looks like.
        $termStart = Carbon::parse('2026-07-10')->addDay(); // 11/07, the real anniversary

        $this->assertSame(
            $termStart->copy()->addMonths(6)->subDay()->toDateString(),
            Renewal::dueDateForNewTerm(Carbon::parse('2026-07-10'), 6)->toDateString()
        );
    }

    public function test_short_terms_follow_the_same_rule(): void
    {
        // Legacy 2/3/4-month bookings: term starts 11/07, ends one day before.
        $due = Carbon::parse('2026-07-10');

        $this->assertSame('2026-10-10', Renewal::dueDateForNewTerm($due, 3)->toDateString());
        $this->assertSame('2026-09-10', Renewal::dueDateForNewTerm($due, 2)->toDateString());
        $this->assertSame('2026-11-10', Renewal::dueDateForNewTerm($due, 4)->toDateString());
    }

    public function test_the_previous_due_date_is_not_mutated(): void
    {
        // Carbon is mutable; a leaked addMonths() here would silently shift the
        // pledge's stored due_date that was passed in.
        $due = Carbon::parse('2026-07-10');
        Renewal::dueDateForNewTerm($due, 6);

        $this->assertSame('2026-07-10', $due->toDateString());
    }

    public function test_a_month_end_due_date_overflows_rather_than_clamping(): void
    {
        // Due 31/08 -> term starts 01/09, +6 months -> 01/03, -1 day -> 28/02/2027.
        // Locked in deliberately so the behaviour is a conscious choice if a
        // month-end due date is ever renewed.
        $due = Carbon::parse('2026-08-31');

        $this->assertSame(
            $due->copy()->addDay()->addMonths(6)->subDay()->toDateString(),
            Renewal::dueDateForNewTerm($due, 6)->toDateString()
        );
        $this->assertSame('2027-02-28', Renewal::dueDateForNewTerm($due, 6)->toDateString());
    }
}
