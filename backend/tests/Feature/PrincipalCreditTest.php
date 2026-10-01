<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\RedemptionController;
use App\Services\InterestCalculationService;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Principal paid directly buys goods outright.
 *
 * Client-confirmed 2026-10-01, in the client's own example: RM 10,000 over four equal
 * items, RM 5,000 paid off the principal. Two items may then be taken with nothing
 * further to pay; a third costs its own RM 2,500.
 *
 * Releasing goods used to be priced pro-rata on whatever the loan currently stood at,
 * which would have made ALL four items cheaper after that payment instead of paying
 * for two of them outright. The credit rule replaces that, but only on pledges that
 * have actually taken a principal payment -- every other redemption prices as before,
 * which is the property most of these tests exist to pin down.
 */
class PrincipalCreditTest extends TestCase
{
    /** creditRemaining($paidDirect, $originalLoan, $outstanding, $releasedValue, $totalValue) */
    private function credit(
        float $paidDirect,
        float $originalLoan,
        float $outstanding,
        float $releasedNetValue,
        float $totalNetValue
    ): float {
        $controller = new RedemptionController(new InterestCalculationService());
        $method = new ReflectionMethod($controller, 'creditRemaining');
        $method->setAccessible(true);

        return $method->invokeArgs($controller, func_get_args());
    }

    public function test_a_pledge_that_never_paid_principal_has_no_credit(): void
    {
        // The guarantee that existing redemptions are untouched.
        $this->assertSame(0.0, $this->credit(0, 10000, 10000, 0, 8000));
        $this->assertSame(0.0, $this->credit(0, 10000, 5000, 4000, 8000));
    }

    public function test_the_client_example_two_items_free_then_the_third_costs_its_share(): void
    {
        // RM 10,000 over 4 items of equal value; items priced at RM 2,500 each.
        // Item values are arbitrary here -- only their proportions matter.
        $total = 4000.0;
        $perItem = 1000.0;

        // Paid 5,000, nothing released yet: the whole payment is still spendable.
        $this->assertSame(5000.00, $this->credit(5000, 10000, 5000, 0, $total));

        // Two items taken against it, so the loan did not move again.
        $this->assertSame(0.00, $this->credit(5000, 10000, 5000, 2 * $perItem, $total));

        // Third item paid for at the counter: 2,500 settled, loan down to 2,500.
        $this->assertSame(0.00, $this->credit(5000, 10000, 2500, 3 * $perItem, $total));
    }

    public function test_one_item_taken_leaves_the_rest_of_the_credit_spendable(): void
    {
        // 5,000 paid, only one 2,500 item taken: 2,500 of credit survives for the next.
        $this->assertSame(2500.00, $this->credit(5000, 10000, 5000, 1000.0, 4000.0));
    }

    public function test_credit_never_goes_negative(): void
    {
        // More released than paid for -- the balance covers it, the credit does not
        // go below zero and start handing money back.
        $this->assertSame(0.00, $this->credit(2500, 10000, 2500, 3000.0, 4000.0));
    }

    public function test_items_of_different_values_take_their_own_share(): void
    {
        // A 10,000 loan over items worth 1,000 / 3,000 / 4,000 (total 8,000).
        // Their shares are 1,250 / 3,750 / 5,000.
        //
        // Paid 5,000, then released the 4,000 item (share 5,000): exactly consumed.
        $this->assertSame(0.00, $this->credit(5000, 10000, 5000, 4000.0, 8000.0));

        // Paid 5,000, released only the 1,000 item (share 1,250): 3,750 survives.
        $this->assertSame(3750.00, $this->credit(5000, 10000, 5000, 1000.0, 8000.0));
    }

    public function test_a_pledge_with_no_item_value_cannot_divide_by_zero(): void
    {
        $this->assertSame(0.0, $this->credit(5000, 10000, 5000, 0, 0));
    }

    public function test_paying_the_whole_loan_leaves_every_item_covered(): void
    {
        // Nothing left owing, so each item may be collected without further payment.
        $this->assertSame(10000.00, $this->credit(10000, 10000, 0, 0, 8000.0));
        $this->assertSame(5000.00, $this->credit(10000, 10000, 0, 4000.0, 8000.0));
        $this->assertSame(0.00, $this->credit(10000, 10000, 0, 8000.0, 8000.0));
    }
}
