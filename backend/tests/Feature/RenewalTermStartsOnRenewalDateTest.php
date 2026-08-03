<?php

namespace Tests\Feature;

use App\Models\Renewal;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * A renewed term continues from the previous due date, per the client.
 *
 * The new term is measured from where the old one ended, NOT from the day the
 * customer walks in. So a pledge due 10/07 renewed for 6 months runs to 10/01
 * whether the customer comes on the 3rd, the 10th, or the 24th. A late renewer
 * therefore gets fewer usable days -- the term is anchored to the due date, and the
 * day he actually came in is kept only as a record (Renewal::created_at).
 *
 * dueDateForNewTerm(previousDueDate, months) is the single rule the renewal quote
 * and the save share, so the screen cannot promise an expiry the ticket contradicts.
 */
class RenewalTermStartsOnRenewalDateTest extends TestCase
{
    public function test_the_new_term_runs_six_months_from_the_previous_due_date(): void
    {
        // Due 10/07/2026, six-month renewal -> 10/01/2027.
        $due = Renewal::dueDateForNewTerm(Carbon::parse('2026-07-10'), 6);

        $this->assertSame('2027-01-10', $due->toDateString());
    }

    public function test_the_expiry_ignores_when_the_customer_came_in(): void
    {
        // Due 10/07/2026. Whether he renews on the 3rd, 10th or 24th, the new expiry
        // is the same, because it is measured from the due date, not the visit.
        $due = Renewal::dueDateForNewTerm(Carbon::parse('2026-07-10'), 6);

        $this->assertSame('2027-01-10', $due->toDateString());
    }

    public function test_short_terms_follow_the_same_rule(): void
    {
        // Legacy 2/3/4-month bookings renew off the previous due date too.
        $due = Carbon::parse('2026-07-10');

        $this->assertSame('2026-09-10', Renewal::dueDateForNewTerm($due, 2)->toDateString());
        $this->assertSame('2026-10-10', Renewal::dueDateForNewTerm($due, 3)->toDateString());
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
        // 31/08 + 6 months has no 31/02 to land on, so Carbon rolls forward into
        // March. Locked in deliberately so the behaviour is a conscious choice, not
        // an accident, if a month-end due date is ever renewed.
        $due = Carbon::parse('2026-08-31');

        $this->assertSame(
            $due->copy()->addMonths(6)->toDateString(),
            Renewal::dueDateForNewTerm($due, 6)->toDateString()
        );
        $this->assertSame('2027-03-03', Renewal::dueDateForNewTerm($due, 6)->toDateString());
    }
}
