<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Pledge;
use App\Models\PledgePrincipalChange;
use App\Models\PrincipalPayment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Payments made against a pledge's principal.
 *
 * The shop had no way to take one. A customer wanting to owe less could only redeem
 * goods, so reducing the debt always meant emptying part of the locker.
 *
 * Client-confirmed 2026-10-01:
 *   - any amount, no minimum, as often as the customer likes;
 *   - interest need NOT be settled first;
 *   - the due date does not move -- the term is unchanged, the debt is smaller;
 *   - months already elapsed keep billing on the principal outstanding then.
 *
 * That last rule is why every payment writes to the principal ledger rather than just
 * overwriting loan_amount: a pledge that charged 0.5% of RM 15,000 for four months must
 * go on charging it for those four months after the balance falls to RM 5,000.
 */
class PrincipalPaymentController extends Controller
{
    /**
     * What a pledge currently owes, and what a payment would leave behind.
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'amount' => 'nullable|numeric|min:0',
        ]);

        $pledge = $this->findPayablePledge($request, (int) $validated['pledge_id']);

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        $outstanding = round((float) $pledge->loan_amount, 2);
        $amount = isset($validated['amount']) ? round((float) $validated['amount'], 2) : null;

        // Never below zero: a payment settles the principal at most, and the rest of
        // what a customer might owe is interest, which has its own screen.
        $applied = $amount === null ? null : min($amount, $outstanding);

        return $this->success([
            'pledge' => [
                'id' => $pledge->id,
                'pledge_no' => $pledge->pledge_no,
                'receipt_no' => $pledge->receipt_no,
                'pledge_date' => $pledge->pledge_date->toDateString(),
                'due_date' => $pledge->due_date->toDateString(),
                'status' => $pledge->status,
                'customer' => $pledge->customer,
                'items_held' => $pledge->items->whereNull('redemption_id')->count(),
            ],
            'principal' => [
                'outstanding' => $outstanding,
                'amount' => $applied,
                'remaining_after' => $applied === null ? null : round($outstanding - $applied, 2),
                // Says so plainly on screen: this is not an interest payment, and it
                // buys no extra time.
                'due_date_changes' => false,
                'settles_pledge' => $applied !== null && $applied >= $outstanding - 0.005,
            ],
            'history' => $pledge->principalPayments()
                ->where('status', 'completed')
                ->latest()
                ->get(['id', 'payment_no', 'amount', 'principal_after', 'created_at']),
        ]);
    }

    /**
     * Take the payment: record it, reduce the principal, and date the change so only
     * later months follow the smaller figure.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:cash,transfer,partial',
            'cash_amount' => 'nullable|numeric|min:0',
            'transfer_amount' => 'nullable|numeric|min:0',
            'bank_id' => 'nullable|exists:banks,id',
            'account_number' => 'nullable|string|max:50',
            'reference_no' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:500',
        ]);

        $pledge = $this->findPayablePledge($request, (int) $validated['pledge_id']);

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        $outstanding = round((float) $pledge->loan_amount, 2);

        if ($outstanding <= 0.005) {
            return $this->error('This pledge has no principal left to pay.', 422);
        }

        $amount = round((float) $validated['amount'], 2);

        // Refused rather than quietly trimmed: an operator typing 50,000 against a
        // 15,000 loan has made a mistake, and taking 15,000 of it hides that.
        if ($amount > $outstanding + 0.005) {
            return $this->error(
                'Payment of RM ' . number_format($amount, 2)
                    . ' is more than the RM ' . number_format($outstanding, 2)
                    . ' principal outstanding. Interest is collected on the Interest Payments screen.',
                422
            );
        }

        $cash = round((float) ($validated['cash_amount'] ?? 0), 2);
        $transfer = round((float) ($validated['transfer_amount'] ?? 0), 2);

        if ($validated['payment_method'] === 'cash') {
            $cash = $amount;
            $transfer = 0.0;
        } elseif ($validated['payment_method'] === 'transfer') {
            $cash = 0.0;
            $transfer = $amount;
        }

        if (abs(($cash + $transfer) - $amount) > 0.005) {
            return $this->error(
                'Cash and transfer must add up to RM ' . number_format($amount, 2) . '.',
                422
            );
        }

        $remaining = round($outstanding - $amount, 2);
        $userId = $request->user()->id;

        try {
            DB::beginTransaction();

            $payment = PrincipalPayment::create([
                'branch_id' => $pledge->branch_id,
                'pledge_id' => $pledge->id,
                'payment_no' => PrincipalPayment::generatePaymentNo($pledge->branch_id),
                'amount' => $amount,
                'principal_before' => $outstanding,
                'principal_after' => $remaining,
                'payment_method' => $validated['payment_method'],
                'cash_amount' => $cash,
                'transfer_amount' => $transfer,
                'bank_id' => $validated['bank_id'] ?? null,
                'account_number' => $validated['account_number'] ?? null,
                'reference_no' => $validated['reference_no'] ?? null,
                'status' => 'completed',
                'notes' => $validated['notes'] ?? null,
                'created_by' => $userId,
            ]);

            // Dated today, so the months the customer held the larger sum keep
            // charging on it. Recorded BEFORE loan_amount moves: the ledger's opening
            // row reads the outgoing figure off the pledge.
            $pledge->recordPrincipalChange(
                $remaining,
                PledgePrincipalChange::REASON_PRINCIPAL_PAYMENT,
                Carbon::today(),
                $payment,
                $userId
            );

            // The due date is untouched on purpose: this buys a smaller debt, not time.
            $pledge->update(['loan_amount' => $remaining]);

            try {
                AuditLog::create([
                    'branch_id' => $pledge->branch_id,
                    'user_id' => $userId,
                    'action' => 'principal_payment',
                    'model_type' => PrincipalPayment::class,
                    'model_id' => $payment->id,
                    'description' => "Principal payment {$payment->payment_no} of RM "
                        . number_format($amount, 2)
                        . " on pledge {$pledge->pledge_no}; principal RM "
                        . number_format($outstanding, 2) . ' -> RM ' . number_format($remaining, 2),
                ]);
            } catch (\Throwable $e) {
                Log::warning('Principal payment audit log failed: ' . $e->getMessage());
            }

            DB::commit();

            $payment->load(['pledge.customer', 'bank', 'createdBy:id,name']);

            return $this->success([
                'payment' => $payment,
                'principal' => [
                    'before' => $outstanding,
                    'after' => $remaining,
                    'settles_pledge' => $remaining <= 0.005,
                ],
            ], 'Principal payment recorded');
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Principal payment failed: ' . $e->getMessage());

            return $this->error('Failed to record principal payment: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Payments taken today, for the counter's own tally.
     */
    public function today(Request $request): JsonResponse
    {
        $payments = PrincipalPayment::where('branch_id', $request->user()->branch_id)
            ->where('status', 'completed')
            ->whereDate('created_at', Carbon::today())
            ->with(['pledge.customer:id,name,ic_number'])
            ->latest()
            ->get();

        return $this->success([
            'payments' => $payments,
            'summary' => [
                'count' => $payments->count(),
                'total' => round($payments->sum('amount'), 2),
                'cash' => round($payments->sum('cash_amount'), 2),
                'transfer' => round($payments->sum('transfer_amount'), 2),
            ],
        ]);
    }

    /**
     * A pledge this branch may take principal against: live, and not already closed.
     */
    private function findPayablePledge(Request $request, int $pledgeId): ?Pledge
    {
        return Pledge::where('id', $pledgeId)
            ->where('branch_id', $request->user()->branch_id)
            ->whereIn('status', ['active', 'overdue'])
            ->with(['customer:id,name,ic_number', 'items:id,pledge_id,redemption_id', 'principalChanges'])
            ->first();
    }
}
