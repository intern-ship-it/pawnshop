<?php

namespace Tests\Feature;

use App\Models\InterestPayment;
use App\Models\Renewal;
use Tests\TestCase;

/**
 * A renewal only extends the due date -- the interest is taken on the interest
 * payment screen. The renewal row still carries an `interest_amount`, but that is
 * the accrued figure printed on the receipt, not money received: RenewalController
 * writes cash_amount/transfer_amount/total_payable as zero.
 *
 * The renewals report summed `interest_amount` across both record types anyway, so
 * "Interest Collected" for July 2026 read RM 10,236.23 when only RM 8,534.15 was
 * ever taken -- RM 1,702.08 of it was four renewals that collected nothing.
 *
 * `interest_collected` is the shared primitive: given a counter record, how much
 * interest actually changed hands. Reports sum that instead.
 */
class RenewalReportInterestTest extends TestCase
{
    /** The four July 2026 renewals: interest accrued and printed, nothing collected. */
    private const JULY_RENEWALS = [734.69, 120.31, 337.08, 510.00];

    /** The four July 2026 interest payments -- the money actually taken. */
    private const JULY_INTEREST_PAYMENTS = [5877.57, 962.43, 674.15, 1020.00];

    private function renewalCollectingNothing(float $accrued): Renewal
    {
        return new Renewal([
            'interest_amount' => $accrued,
            'total_payable' => 0,
            'cash_amount' => 0,
            'transfer_amount' => 0,
        ]);
    }

    public function test_a_renewal_that_took_no_money_collected_no_interest(): void
    {
        // RNW-HQ-2026-0001 on PLG-HQ-2026-0026: RM 734.69 accrued, RM 0 taken.
        $renewal = $this->renewalCollectingNothing(734.69);

        $this->assertSame(0.0, $renewal->interest_collected);
    }

    public function test_a_legacy_renewal_credits_the_money_actually_received(): void
    {
        // Renewals used to collect at the counter. Those must still report what was
        // taken -- crediting `interest_amount` over-counts, assuming zero under-counts.
        $renewal = new Renewal([
            'interest_amount' => 1000.00,
            'total_payable' => 900.00,
            'cash_amount' => 400.00,
            'transfer_amount' => 500.00,
        ]);

        $this->assertSame(900.0, $renewal->interest_collected);
    }

    public function test_an_interest_payment_collects_what_it_charged(): void
    {
        // Interest payments are the channel that actually takes the money.
        $payment = new InterestPayment(['interest_amount' => 5877.57]);

        $this->assertSame(5877.57, $payment->interest_collected);
    }

    public function test_the_report_total_counts_only_money_taken(): void
    {
        $rows = [];
        foreach (self::JULY_RENEWALS as $accrued) {
            $rows[] = $this->renewalCollectingNothing($accrued);
        }
        foreach (self::JULY_INTEREST_PAYMENTS as $paid) {
            $rows[] = new InterestPayment(['interest_amount' => $paid]);
        }

        $collected = round(array_sum(array_map(fn ($r) => $r->interest_collected, $rows)), 2);

        // The four interest payments, and only those.
        $this->assertSame(8534.15, $collected);
        // Not the figure the report showed, which added RM 1,702.08 nobody paid.
        $this->assertNotSame(10236.23, $collected);
    }
}
