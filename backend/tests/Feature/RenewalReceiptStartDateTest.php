<?php

namespace Tests\Feature;

use App\Models\Pledge;
use App\Models\Renewal;
use Carbon\Carbon;
use Tests\TestCase;

/**
 * "Tarikh Dipajak" on a renewal ticket is the RENEWAL date, per the client.
 *
 * The A5 pre-printed renewal overlay read it off the pledge, so a pledge first
 * pawned on 11/05/2026 and renewed on 24/07/2026 still printed 11/05/2026 -- the
 * original pawn date -- while the A4 overlay printed the renewal date. Same
 * renewal, same pre-printed label, two different dates depending on paper size.
 *
 * Renewal::ticket_start_date is the single source both overlays read, so they
 * cannot drift apart again.
 */
class RenewalReceiptStartDateTest extends TestCase
{
    private function renewalOf(string $pawnedOn, string $renewedOn, string $newDueDate): Renewal
    {
        $pledge = new Pledge(['pledge_date' => $pawnedOn]);

        $renewal = new Renewal([
            'previous_due_date' => '2026-07-10',
            'new_due_date' => $newDueDate,
            'renewal_months' => 6,
        ]);
        // created_at is guarded, so it cannot be mass-assigned.
        $renewal->created_at = Carbon::parse($renewedOn);
        $renewal->setRelation('pledge', $pledge);

        return $renewal;
    }

    public function test_the_ticket_starts_on_the_renewal_date(): void
    {
        // PLG-HQ-2026-0026: pawned 11/05/2026, renewed 24/07/2026.
        $renewal = $this->renewalOf('2026-05-11', '2026-07-24', '2027-01-10');

        $this->assertSame('24/07/2026', $renewal->ticket_start_date->format('d/m/Y'));
    }

    public function test_it_is_not_the_original_pawn_date(): void
    {
        $renewal = $this->renewalOf('2026-05-11', '2026-07-24', '2027-01-10');

        // What the A5 overlay used to print.
        $this->assertNotSame('11/05/2026', $renewal->ticket_start_date->format('d/m/Y'));
    }

    public function test_a_second_renewal_moves_the_date_again(): void
    {
        // Each renewal re-dates the ticket; the pawn date stays fixed forever, which
        // is exactly why reading it off the pledge was wrong.
        $first = $this->renewalOf('2026-05-11', '2026-07-24', '2027-01-10');
        $second = $this->renewalOf('2026-05-11', '2027-01-09', '2027-07-10');

        $this->assertSame('24/07/2026', $first->ticket_start_date->format('d/m/Y'));
        $this->assertSame('09/01/2027', $second->ticket_start_date->format('d/m/Y'));
    }

    public function test_an_unsaved_renewal_falls_back_to_today(): void
    {
        // A preview rendered before the row is written must still print a date
        // rather than blowing up on a null timestamp.
        $renewal = new Renewal(['new_due_date' => '2027-01-10']);

        $this->assertSame(
            Carbon::today()->format('d/m/Y'),
            $renewal->ticket_start_date->format('d/m/Y')
        );
    }
}
