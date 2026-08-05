<?php

namespace Tests\Feature;

use App\Models\Pledge;
use App\Models\Renewal;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * "Tarikh Dipajak" on a renewal ticket is the day AFTER the previous due date, per
 * the client.
 *
 * The stored due date is itself one day before the anniversary, so the real
 * anniversary -- and the first day of the renewed term -- is previous_due + 1. A
 * pledge due 10/07 therefore prints 11/07, not 10/07. It is deliberately NOT the day
 * the customer came in, and NOT the pledge's original pawn date.
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

    public function test_the_ticket_is_dated_the_day_after_the_previous_due_date(): void
    {
        // PLG-HQ-2026-0026: due 10/07 (one day before the 11/07 anniversary), pawned
        // 11/05, renewed late on 24/07. The term's real first day is 11/07.
        $renewal = $this->renewalOf('2026-05-11', '2026-07-24', '2026-07-10');

        $this->assertSame('11/07/2026', $renewal->ticket_start_date->format('d/m/Y'));
    }

    public function test_it_is_not_the_stored_due_date_itself(): void
    {
        $renewal = $this->renewalOf('2026-05-11', '2026-07-24', '2026-07-10');

        // 10/07 is one day before the anniversary; the term starts the day after it.
        $this->assertNotSame('10/07/2026', $renewal->ticket_start_date->format('d/m/Y'));
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
        // Term 1 due 10/07 -> starts 11/07, ends 10/01; term 2 due 10/01 -> starts 11/01.
        $first = $this->renewalOf('2026-05-11', '2026-07-24', '2026-07-10');
        $second = $this->renewalOf('2026-05-11', '2027-01-15', '2027-01-10');

        $this->assertSame('11/07/2026', $first->ticket_start_date->format('d/m/Y'));
        $this->assertSame('11/01/2027', $second->ticket_start_date->format('d/m/Y'));
    }

    public function test_the_actual_renewal_day_is_still_recorded(): void
    {
        // The ticket prints the term's first day, but created_at keeps the real
        // walk-in date so it can be answered later.
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
