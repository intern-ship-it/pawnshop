<?php

namespace Tests\Feature;

use App\Models\Pledge;
use App\Models\Renewal;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * "Tarikh Dipajak" on a renewal ticket is the PREVIOUS DUE DATE, per the client.
 *
 * The renewed term continues from where the old one ended, so the ticket is dated
 * from the old due date -- not the day the customer happens to come in, and not the
 * pledge's original pawn date. A customer due 10/07 who renews late on 24/07 still
 * gets a ticket dated 10/07.
 *
 * The day he actually came in is not lost: it stays on the renewal row as
 * created_at, so "when did he renew?" is always answerable even though it is not
 * what prints. Renewal::ticket_start_date is the single source both overlays read.
 */
class RenewalReceiptStartDateTest extends TestCase
{
    private function renewalOf(string $pawnedOn, string $renewedOn, string $previousDueDate): Renewal
    {
        $pledge = new Pledge(['pledge_date' => $pawnedOn]);

        $renewal = new Renewal([
            'previous_due_date' => $previousDueDate,
            'renewal_months' => 6,
        ]);
        // created_at is guarded, so it cannot be mass-assigned.
        $renewal->created_at = Carbon::parse($renewedOn);
        $renewal->setRelation('pledge', $pledge);

        return $renewal;
    }

    public function test_the_ticket_is_dated_from_the_previous_due_date(): void
    {
        // PLG-HQ-2026-0026: due 10/07, pawned 11/05, renewed late on 24/07.
        $renewal = $this->renewalOf('2026-05-11', '2026-07-24', '2026-07-10');

        $this->assertSame('10/07/2026', $renewal->ticket_start_date->format('d/m/Y'));
    }

    public function test_it_is_not_the_day_the_customer_came_in(): void
    {
        $renewal = $this->renewalOf('2026-05-11', '2026-07-24', '2026-07-10');

        // The walk-in date is kept on record (created_at) but must not print.
        $this->assertNotSame('24/07/2026', $renewal->ticket_start_date->format('d/m/Y'));
    }

    public function test_it_is_not_the_original_pawn_date(): void
    {
        $renewal = $this->renewalOf('2026-05-11', '2026-07-24', '2026-07-10');

        // What the A5 overlay printed before any of this work.
        $this->assertNotSame('11/05/2026', $renewal->ticket_start_date->format('d/m/Y'));
    }

    public function test_a_second_renewal_is_dated_from_its_own_previous_due_date(): void
    {
        // Term 1 ended 10/07; term 2 (dated 10/07) ends 10/01; term 3 is dated 10/01.
        $first = $this->renewalOf('2026-05-11', '2026-07-24', '2026-07-10');
        $second = $this->renewalOf('2026-05-11', '2027-01-15', '2027-01-10');

        $this->assertSame('10/07/2026', $first->ticket_start_date->format('d/m/Y'));
        $this->assertSame('10/01/2027', $second->ticket_start_date->format('d/m/Y'));
    }

    public function test_the_actual_renewal_day_is_still_recorded(): void
    {
        // The ticket prints the due date, but created_at keeps the real walk-in date
        // so it can be answered later.
        $renewal = $this->renewalOf('2026-05-11', '2026-07-24', '2026-07-10');

        $this->assertSame('24/07/2026', $renewal->created_at->format('d/m/Y'));
    }

    public function test_an_unsaved_renewal_falls_back_to_today(): void
    {
        // A preview with no previous due date and no timestamp must still print a
        // date rather than blowing up on null.
        $renewal = new Renewal(['renewal_months' => 6]);

        $this->assertSame(
            Carbon::today()->format('d/m/Y'),
            $renewal->ticket_start_date->format('d/m/Y')
        );
    }
}
