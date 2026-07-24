<?php

namespace Tests\Feature;

use App\Models\Renewal;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * A renewed term runs from the day the customer comes in, per the client.
 *
 * It used to extend the OLD due date: renew 14 days late and the new term was 14
 * days short, so a ticket dated 24/07/2026 with "6 BULAN" printed on it actually
 * expired 10/01/2027 -- five and a half months. Now the ticket date and the expiry
 * describe the same period, whenever the customer turns up.
 *
 * The -1 day mirrors a new pledge (PledgeController: today + N months - 1 day), so
 * both ticket types count their term inclusively from the date they are dated.
 */
class RenewalTermStartsOnRenewalDateTest extends TestCase
{
    public function test_the_new_term_runs_six_months_from_the_renewal_day(): void
    {
        // Renewed 24/07/2026 -> the ticket covers 24/07/2026 to 23/01/2027.
        $due = Renewal::dueDateForNewTerm(Carbon::parse('2026-07-24'), 6);

        $this->assertSame('2027-01-23', $due->toDateString());
    }

    public function test_a_late_renewal_still_gets_a_full_term(): void
    {
        // PLG-HQ-2026-0026: due 10/07/2026, renewed 24/07/2026 -- 14 days late.
        $due = Renewal::dueDateForNewTerm(Carbon::parse('2026-07-24'), 6);

        // The old rule extended the due date instead, docking those 14 days.
        $this->assertNotSame('2027-01-10', $due->toDateString());
        $this->assertSame('2027-01-23', $due->toDateString());
    }

    public function test_an_early_renewal_does_not_get_extra_days(): void
    {
        // Due 10/07/2026 but renewed a week early: the term starts that day, so the
        // customer no longer banks the unused week on top of the new six months.
        $due = Renewal::dueDateForNewTerm(Carbon::parse('2026-07-03'), 6);

        $this->assertSame('2027-01-02', $due->toDateString());
        $this->assertNotSame('2027-01-10', $due->toDateString());
    }

    public function test_short_terms_follow_the_same_rule(): void
    {
        // Legacy 2/3/4-month bookings renew on the same inclusive count.
        $start = Carbon::parse('2026-07-24');

        $this->assertSame('2026-09-23', Renewal::dueDateForNewTerm($start, 2)->toDateString());
        $this->assertSame('2026-10-23', Renewal::dueDateForNewTerm($start, 3)->toDateString());
        $this->assertSame('2026-11-23', Renewal::dueDateForNewTerm($start, 4)->toDateString());
    }

    public function test_the_start_date_is_not_mutated(): void
    {
        // Carbon is mutable; a leaked addMonths() here would silently shift the
        // caller's "today" and re-date the ticket itself.
        $start = Carbon::parse('2026-07-24');
        Renewal::dueDateForNewTerm($start, 6);

        $this->assertSame('2026-07-24', $start->toDateString());
    }

    public function test_a_month_end_renewal_overflows_exactly_like_a_new_pledge(): void
    {
        // 31/08 + 6 months has no 31/02 to land on, so Carbon rolls forward into
        // March rather than clamping to the 28th. Locked in deliberately: a new
        // pledge booked on 31/08 lands on the same date via the identical
        // addMonths()->subDay() in PledgeController, and the two ticket types must
        // not disagree. Changing it is a decision for both paths together.
        $start = Carbon::parse('2026-08-31');

        $this->assertSame(
            $start->copy()->addMonths(6)->subDay()->toDateString(),
            Renewal::dueDateForNewTerm($start, 6)->toDateString()
        );
        $this->assertSame('2027-03-02', Renewal::dueDateForNewTerm($start, 6)->toDateString());
    }
}
