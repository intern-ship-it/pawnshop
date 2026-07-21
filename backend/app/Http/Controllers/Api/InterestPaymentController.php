<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterestPayment;
use App\Models\InterestPaymentBreakdown;
use App\Models\Pledge;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Services\InterestCalculationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class InterestPaymentController extends Controller
{
    protected $interestService;

    public function __construct(InterestCalculationService $interestService)
    {
        $this->interestService = $interestService;
    }

    /**
     * List all interest payments
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = InterestPayment::where('branch_id', $branchId)
            ->with(['pledge.customer:id,name,ic_number']);

        // Date filter
        if ($from = $request->get('from_date')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('created_at', '<=', $to);
        }

        // Search by payment number, pledge number, or customer name/IC
        if ($search = $request->get('search')) {
            $searchNormalized = strtoupper(str_replace('-', '', $search));

            $query->where(function ($q) use ($search, $searchNormalized) {
                $q->where('payment_no', 'like', "%{$search}%")
                    ->orWhereRaw("REPLACE(payment_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                    ->orWhereHas('pledge', function ($pq) use ($search, $searchNormalized) {
                        $pq->where(function ($pq2) use ($search, $searchNormalized) {
                            $pq2->where('pledge_no', 'like', "%{$search}%")
                                ->orWhere('receipt_no', 'like', "%{$search}%")
                                ->orWhereRaw("REPLACE(pledge_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                                ->orWhereRaw("REPLACE(receipt_no, '-', '') LIKE ?", ["%{$searchNormalized}%"]);
                        });
                    })
                    ->orWhereHas('pledge.customer', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%")
                            ->orWhere('ic_number', 'like', "%{$search}%");
                    });
            });
        }

        $payments = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($payments);
    }

    /**
     * Get today's interest payments
     */
    public function today(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $payments = InterestPayment::where('branch_id', $branchId)
            ->whereDate('created_at', Carbon::today())
            ->with(['pledge.customer:id,name,ic_number,phone'])
            ->orderBy('created_at', 'desc')
            ->get();

        $summary = [
            'count' => $payments->count(),
            'total' => $payments->sum('total_payable'),
            'cash' => $payments->sum('cash_amount'),
            'transfer' => $payments->sum('transfer_amount'),
        ];

        return $this->success([
            'payments' => $payments,
            'summary' => $summary,
        ]);
    }

    /**
     * Get pledges eligible for interest payment
     * Active pledges that have accrued unpaid interest
     */
    public function eligibleList(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Pledge::where('branch_id', $branchId)
            ->whereIn('status', ['active', 'overdue'])
            ->with([
                'customer:id,name,ic_number,phone,custom_interest_rate,custom_interest_rate_extended,custom_interest_rate_overdue',
                'items:id,pledge_id,category_id,purity_id,net_weight,net_value,description,barcode',
                'items.category:id,name_en,name_ms',
                'items.purity:id,code,name',
            ]);

        // Search by IC number, pledge_no, receipt_no, or customer name
        if ($search = $request->get('search')) {
            $searchTerm = trim($search);
            $searchNormalized = strtoupper(str_replace('-', '', $searchTerm));
            $cleanIC = preg_replace('/[-\s]/', '', $searchTerm);

            $query->where(function ($q) use ($searchTerm, $searchNormalized, $cleanIC) {
                $q->where('pledge_no', 'like', "%{$searchTerm}%")
                    ->orWhere('receipt_no', 'like', "%{$searchTerm}%")
                    ->orWhereRaw("REPLACE(pledge_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                    ->orWhereRaw("REPLACE(receipt_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                    ->orWhereHas('customer', function ($cq) use ($searchTerm, $cleanIC) {
                        $cq->where('ic_number', 'like', "%{$searchTerm}%")
                            ->orWhereRaw("REPLACE(REPLACE(ic_number, '-', ''), ' ', '') LIKE ?", ["%{$cleanIC}%"])
                            ->orWhere('name', 'like', "%{$searchTerm}%");
                    });
            });
        }

        // Date range filter on due_date
        if ($dateFrom = $request->get('date_from')) {
            $query->whereDate('due_date', '>=', $dateFrom);
        }
        if ($dateTo = $request->get('date_to')) {
            $query->whereDate('due_date', '<=', $dateTo);
        }

        $pledges = $query->orderBy('due_date')->get();

        // Attach previous interest payment info
        $pledges->each(function ($pledge) {
            $lastPayment = InterestPayment::where('pledge_id', $pledge->id)
                ->where('status', 'completed')
                ->orderBy('created_at', 'desc')
                ->first();

            $pledge->last_interest_payment = $lastPayment ? [
                'payment_no' => $lastPayment->payment_no,
                'date' => $lastPayment->created_at->toDateString(),
                'amount' => (float) $lastPayment->total_payable,
                'period_to' => $lastPayment->period_to->toDateString(),
            ] : null;

            $pledge->total_interest_paid = InterestPayment::where('pledge_id', $pledge->id)
                ->where('status', 'completed')
                ->sum('total_payable');
        });

        return $this->success($pledges);
    }

    /**
     * Calculate interest payment preview
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
            'months_to_pay' => 'nullable|integer|min:1|max:120',
        ]);

        $branchId = $request->user()->branch_id;
        $pledgeId = (int) $validated['pledge_id'];

        $pledge = Pledge::where('id', $pledgeId)
            ->where('branch_id', $branchId)
            ->whereIn('status', ['active', 'overdue'])
            ->with(['customer:id,name,ic_number,custom_interest_rate,custom_interest_rate_extended,custom_interest_rate_overdue'])
            ->first();

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        // Determine interest rate (priority: request param > customer custom > pledge stored rate)
        $rate = $request->input('interest_rate');
        $rateSource = 'global';
        $isManualOverride = false;

        if ($rate !== null && $rate !== '') {
            $rate = (float) $rate;
            $rateSource = 'manual';
            // A rate typed by the operator replaces the ladder outright: every month
            // bills at it. Only an untouched box lets the pledge's frozen tiers apply.
            $isManualOverride = true;
        } elseif ($pledge->customer && $pledge->customer->custom_interest_rate !== null) {
            $rate = (float) $pledge->customer->custom_interest_rate;
            $rateSource = 'customer';
        } else {
            // The pledge's own frozen rate. It only deserves the "global" label when
            // it still matches the branch's standard rule — staff can override the
            // rate at pledge creation, and calling that override "global" told the
            // operator a rate came from Settings when it never did.
            $rate = (float) $pledge->interest_rate;
            $rateSource = $this->rateMatchesGlobalStandard($rate, $pledge->branch_id) ? 'global' : 'manual';
        }

        $pledgeDate = Carbon::parse($pledge->pledge_date);
        $termMonths = $this->termMonths($pledge);

        // Months already paid THIS TERM, counted by the money actually received down
        // the ladder — not by payment dates, which miscounted (2 months of money read
        // as 3) and then billed the wrong tier. This is the same figure the renewal
        // gate uses, so the two screens agree.
        $paidThisTerm = $pledge->interestPaidThisTerm();
        $monthsPaid = $this->interestService
            ->forPledge($pledge)
            ->monthsCoveredBy($paidThisTerm, (float) $pledge->loan_amount, (float) $pledge->interest_rate, $termMonths);

        // The current term began at current_term_start; each unpaid month is billed
        // from there. months_paid full months have been settled, so the next unpaid
        // month is month_paid + 1.
        $termStart = $pledge->current_term_start
            ? Carbon::parse($pledge->current_term_start)
            : $pledgeDate->copy();
        $periodFrom = $termStart->copy()->addMonths($monthsPaid);

        // By default, offer to settle the rest of the term. The customer may pay any
        // number of remaining months up to the term (prepayment is allowed so a young
        // pledge can settle all 6 and renew), but never past it.
        //
        // Zero, not one, when the term is fully paid: max(1, ...) used to invent a
        // month that was not owed, so a settled pledge kept offering the month after
        // its own term — month 25 of a 24-month pledge.
        $monthsOwed = max(0, $termMonths - $monthsPaid);
        $monthsRemaining = $monthsOwed;

        if ($request->has('months_to_pay')) {
            $requested = (int) $request->input('months_to_pay');
            // Clamp to what is actually still owed on the term.
            $monthsRemaining = max(0, min($requested, $monthsOwed));
        }

        $periodTo = $periodFrom->copy()->addMonths($monthsRemaining);
        $monthsElapsed = max(1, $pledge->months_elapsed);

        // Calculate interest, month by month down the pledge's frozen rate ladder.
        // Paying months 4-6 of a 0.5%/1.0% ladder must bill 1.0%, not the flat
        // pledges.interest_rate this screen used to apply to every month — that
        // undercharged every tiered pledge whose payment reached month 4.
        $principal = (float) $pledge->loan_amount;
        $calculator = $this->interestService->forPledge($pledge);
        $breakdown = [];
        $totalInterest = 0;
        $cumulative = 0;

        for ($i = 0; $i < $monthsRemaining; $i++) {
            // Ladder position, not position within the term: term 2 starts at month 7,
            // where the extended rate applies.
            $monthNumber = $pledge->termStartMonth($termMonths) + $monthsPaid + $i;
            $monthRate = $isManualOverride
                ? $rate
                : $calculator->rateForMaintainedMonth($monthNumber, $rate)['rate'];

            $monthlyInterest = $principal * ($monthRate / 100);
            $cumulative += $monthlyInterest;

            $breakdown[] = [
                'month' => $monthNumber,
                'rate' => $monthRate,
                'interest' => round($monthlyInterest, 2),
                'cumulative' => round($cumulative, 2),
            ];

            $totalInterest += $monthlyInterest;
        }

        $totalInterest = round($totalInterest, 2);
        $handlingFee = 0; // Disabled per user preference
        $totalPayable = $totalInterest + $handlingFee;

        // What the rate box should say. Read it off the months actually being billed
        // so it can never contradict the breakdown: one distinct rate means that rate
        // is the whole story, several means the UI should show the ladder instead.
        $ratesBilled = array_unique(array_column($breakdown, 'rate'));
        $distinctRates = count($ratesBilled);
        $displayRate = $distinctRates === 1 ? (float) reset($ratesBilled) : $rate;

        return $this->success([
            'pledge' => [
                'id' => $pledge->id,
                'pledge_no' => $pledge->pledge_no,
                'receipt_no' => $pledge->receipt_no,
                'loan_amount' => $principal,
                'pledge_date' => $pledge->pledge_date->toDateString(),
                'due_date' => $pledge->due_date->toDateString(),
                'status' => $pledge->status,
                'renewal_count' => (int) $pledge->renewal_count,
                // Whether a renewal is still possible, so the screen can offer the
                // right next step after a payment: a pledge that has used all its
                // renewals must be redeemed, and pointing it at Renewals would only
                // lead to a refusal. Resolved here rather than in the UI so both
                // screens read the same limit.
                'renewals_allowed' => $this->maxRenewals(),
                'can_renew' => (int) $pledge->renewal_count < $this->maxRenewals(),
                'customer' => $pledge->customer,
            ],
            'period' => [
                'from' => $periodFrom->toDateString(),
                'to' => $periodTo->toDateString(),
                'months_elapsed' => $monthsElapsed,
                'months_paid' => $monthsPaid,
                'months_remaining' => $monthsRemaining,
                'term_months' => $termMonths,
                // Nothing left to pay on this term. The screen shows a settled notice
                // instead of a breakdown, rather than offering a month that is not owed.
                'term_settled' => $monthsOwed === 0,
            ],
            'calculation' => [
                // The rate the months being paid actually bill at — not the pledge's
                // opening rate. A renewed pledge paying months 7-12 is on the extended
                // tier, so quoting its frozen 0.5% here contradicted every row of the
                // breakdown below. Falls back to the resolved rate when there are no
                // rows to read.
                'interest_rate' => $displayRate,
                'rate_source' => $rateSource,
                // True when the months being paid do not all bill at one rate, so the
                // UI knows the single interest_rate above does not describe the bill.
                'is_tiered' => $distinctRates > 1,
                'interest_breakdown' => $breakdown,
                'interest_amount' => $totalInterest,
                'handling_fee' => round($handlingFee, 2),
                'total_payable' => round($totalPayable, 2),
            ],
        ]);
    }

    /**
     * Renewals allowed per pledge. Reads the same setting RenewalController uses, so
     * the two screens cannot disagree about whether a pledge can still be renewed.
     */
    private function maxRenewals(): int
    {
        return (int) (\App\Models\Setting::where('key_name', 'max_renewals')->value('value')
            ?? config('pawnsys.pledge.max_renewals', 2));
    }

    /**
     * The pledge's term length in months — the span the tier ladder covers (max
     * standard/custom to_month), defaulting to 6 when there is no ladder. Kept in
     * step with RenewalController::termMonths so both screens agree on the term.
     */
    private function termMonths(Pledge $pledge): int
    {
        $end = (int) \App\Models\InterestRate::where('is_active', true)
            ->whereIn('rate_type', ['standard', 'custom'])
            ->where(function ($q) use ($pledge) {
                $q->where('branch_id', $pledge->branch_id)->orWhereNull('branch_id');
            })
            ->max('to_month');

        return $end > 0 ? $end : 6;
    }

    /**
     * Whether a pledge's frozen rate still matches a configured standard rule for
     * its branch, i.e. it came from Settings rather than an operator override.
     *
     * Checks every active standard/custom rule, not just the first: a branch may
     * define more than one standard row (e.g. months 1-3 and 4-6), and a pledge
     * created under either is still on the global rate.
     */
    private function rateMatchesGlobalStandard(float $rate, ?int $branchId): bool
    {
        $rules = \App\Models\InterestRate::where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->where('is_active', true)
            ->whereIn('rate_type', ['standard', 'custom'])
            ->pluck('rate_percentage');

        foreach ($rules as $configured) {
            if (abs($rate - (float) $configured) < 0.001) {
                return true;
            }
        }

        return false;
    }

    /**
     * Process interest payment
     * CRITICAL: Does NOT modify pledge due_date, status, or renewal_count
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
            'months_to_pay' => 'nullable|integer|min:1|max:120',
            'payment_method' => 'required|in:cash,transfer,partial',
            'cash_amount' => 'nullable|numeric|min:0',
            'transfer_amount' => 'nullable|numeric|min:0',
            'bank_id' => 'nullable|exists:banks,id',
            'reference_no' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:500',
        ]);

        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;
        $pledgeId = (int) $validated['pledge_id'];

        $pledge = Pledge::where('id', $pledgeId)
            ->where('branch_id', $branchId)
            ->whereIn('status', ['active', 'overdue'])
            ->with(['customer'])
            ->first();

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        DB::beginTransaction();

        try {
            // Determine interest rate. A rate posted by the operator is a deliberate
            // override and flattens the ladder; otherwise the pledge's frozen tiers
            // decide each month. Kept in step with calculate() so the amount charged
            // is the amount the screen previewed.
            $rate = isset($validated['interest_rate']) ? (float) $validated['interest_rate'] : null;
            $isManualOverride = $rate !== null;

            if ($rate === null) {
                if ($pledge->customer && $pledge->customer->custom_interest_rate !== null) {
                    $rate = (float) $pledge->customer->custom_interest_rate;
                } else {
                    $rate = (float) $pledge->interest_rate;
                }
            }

            // Period, counted by money against the ladder — identical to calculate(),
            // so the amount charged is exactly what the screen previewed.
            $pledgeDate = Carbon::parse($pledge->pledge_date);
            $termMonths = $this->termMonths($pledge);

            $paidThisTerm = $pledge->interestPaidThisTerm();
            $monthsPaid = $this->interestService
                ->forPledge($pledge)
                ->monthsCoveredBy($paidThisTerm, (float) $pledge->loan_amount, (float) $pledge->interest_rate, $termMonths, $pledge->termStartMonth($termMonths));

            $termStart = $pledge->current_term_start
                ? Carbon::parse($pledge->current_term_start)
                : $pledgeDate->copy();
            $periodFrom = $termStart->copy()->addMonths($monthsPaid);

            $monthsOwed = max(0, $termMonths - $monthsPaid);

            // Nothing owed on this term: refuse rather than invent a month. A
            // disabled button is a courtesy; this endpoint is callable directly, and
            // max(1, ...) here would have charged for a month past the pledge's term.
            if ($monthsOwed === 0) {
                DB::rollBack();
                return $this->error(
                    'This term\'s interest is already settled in full. Nothing further is payable'
                        . ($pledge->renewal_count < $this->maxRenewals()
                            ? ' until the pledge is renewed.'
                            : '; this pledge must now be redeemed.'),
                    422
                );
            }

            $monthsRemaining = $monthsOwed;

            // Prepayment allowed, but never past the term.
            if (isset($validated['months_to_pay'])) {
                $monthsRemaining = max(1, min((int) $validated['months_to_pay'], $monthsOwed));
            }

            $periodTo = $periodFrom->copy()->addMonths($monthsRemaining);

            // Calculate interest down the pledge's frozen ladder, exactly as
            // calculate() previews it. Each breakdown row records the rate that month
            // actually billed at, so the receipt and the audit trail agree.
            $principal = (float) $pledge->loan_amount;
            $calculator = $this->interestService->forPledge($pledge);
            $totalInterest = 0;
            $breakdownData = [];
            $cumulative = 0;

            for ($i = 0; $i < $monthsRemaining; $i++) {
                // Ladder position, not position within the term: term 2 starts at month 7,
            // where the extended rate applies.
            $monthNumber = $pledge->termStartMonth($termMonths) + $monthsPaid + $i;
                $monthRate = $isManualOverride
                    ? $rate
                    : $calculator->rateForMaintainedMonth($monthNumber, $rate)['rate'];

                $monthlyInterest = $principal * ($monthRate / 100);
                $cumulative += $monthlyInterest;

                $breakdownData[] = [
                    'month_number' => $monthNumber,
                    'interest_rate' => $monthRate,
                    'interest_amount' => round($monthlyInterest, 2),
                    'cumulative_amount' => round($cumulative, 2),
                ];

                $totalInterest += $monthlyInterest;
            }

            $totalInterest = round($totalInterest, 2);
            $handlingFee = 0;
            $totalPayable = $totalInterest + $handlingFee;

            // Generate payment number
            $paymentNo = InterestPayment::generatePaymentNo($branchId);

            // Create interest payment record
            $payment = InterestPayment::create([
                'branch_id' => $branchId,
                'pledge_id' => $pledge->id,
                // The term this money is for. Stamped from the pledge's current
                // renewal_count so the renewal gate can credit it exactly, even when
                // the payment and a renewal land in the same second.
                'term_number' => (int) $pledge->renewal_count,
                'payment_no' => $paymentNo,
                'interest_months' => $monthsRemaining,
                'period_from' => $periodFrom,
                'period_to' => $periodTo,
                'interest_rate' => $rate,
                'interest_amount' => $totalInterest,
                'handling_fee' => $handlingFee,
                'total_payable' => $totalPayable,
                'payment_method' => $validated['payment_method'],
                'cash_amount' => (float) ($validated['cash_amount'] ?? 0),
                'transfer_amount' => (float) ($validated['transfer_amount'] ?? 0),
                'bank_id' => $validated['bank_id'] ?? null,
                'reference_no' => $validated['reference_no'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'status' => 'completed',
                'created_by' => $userId,
            ]);

            // Create breakdown records
            foreach ($breakdownData as $item) {
                InterestPaymentBreakdown::create(array_merge(
                    $item,
                    ['interest_payment_id' => $payment->id]
                ));
            }

            // NOTE: We intentionally do NOT update pledge->due_date, status, or renewal_count
            // This is an interest-only payment, not a renewal

            DB::commit();

            $payment->load(['pledge.customer', 'breakdown', 'bank', 'createdBy:id,name']);

            // Audit log
            try {
                AuditLog::create([
                    'branch_id' => $branchId,
                    'user_id' => $userId,
                    'action' => 'create',
                    'module' => 'interest_payment',
                    'description' => "Processed interest payment {$payment->payment_no} for pledge {$pledge->pledge_no} - RM" . number_format($totalPayable, 2),
                    'record_type' => 'InterestPayment',
                    'record_id' => $payment->id,
                    'new_values' => [
                        'payment_no' => $payment->payment_no,
                        'pledge_no' => $pledge->pledge_no,
                        'months' => $monthsRemaining,
                        'interest_rate' => $rate,
                        'interest_amount' => $totalInterest,
                        'total_payable' => $totalPayable,
                        'period_from' => $periodFrom->toDateString(),
                        'period_to' => $periodTo->toDateString(),
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                    'severity' => 'info',
                    'created_at' => now(),
                ]);
            } catch (\Exception $e) {
                Log::warning('Audit log failed: ' . $e->getMessage());
            }

            // Create notification
            try {
                $customerName = $pledge->customer->name ?? 'Customer';
                Notification::create([
                    'branch_id' => $branchId,
                    'user_id' => null,
                    'type' => 'info',
                    'title' => 'Interest Payment Received',
                    'message' => "Interest payment {$payment->payment_no} received for pledge {$pledge->pledge_no} - RM" . number_format($totalPayable, 2),
                    'category' => 'interest_payment',
                    'action_url' => "/pledges/{$pledge->id}",
                    'is_read' => false,
                    'metadata' => [
                        'interest_payment_id' => $payment->id,
                        'payment_no' => $payment->payment_no,
                        'pledge_id' => $pledge->id,
                        'pledge_no' => $pledge->pledge_no,
                        'customer_name' => $customerName,
                        'months' => $monthsRemaining,
                        'total_payable' => $totalPayable,
                        'created_by' => $request->user()->name,
                    ],
                ]);
            } catch (\Exception $e) {
                Log::warning('Notification creation failed: ' . $e->getMessage());
            }

            return $this->success($payment, 'Interest payment processed successfully', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Interest payment failed: ' . $e->getMessage());
            return $this->error('Failed to process interest payment: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get interest payment details
     */
    public function show(Request $request, InterestPayment $interestPayment): JsonResponse
    {
        if ($interestPayment->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $interestPayment->load(['pledge.customer', 'pledge.items', 'breakdown', 'bank', 'createdBy:id,name']);

        return $this->success($interestPayment);
    }

    /**
     * Print interest payment receipt
     */
    public function printReceipt(Request $request, InterestPayment $interestPayment): JsonResponse
    {
        if ($interestPayment->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $interestPayment->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.branch',
            'breakdown',
            'bank',
            'createdBy:id,name'
        ]);

        return $this->success([
            'payment' => $interestPayment,
            'receipt_data' => [
                'payment_no' => $interestPayment->payment_no,
                'date' => $interestPayment->created_at->format('d/m/Y'),
                'time' => $interestPayment->created_at->format('h:i A'),
                'customer_name' => $interestPayment->pledge->customer->name,
                'customer_ic' => $interestPayment->pledge->customer->ic_number,
                'pledge_no' => $interestPayment->pledge->pledge_no,
                'loan_amount' => number_format($interestPayment->pledge->loan_amount, 2),
                'interest_months' => $interestPayment->interest_months,
                'period_from' => $interestPayment->period_from->format('d/m/Y'),
                'period_to' => $interestPayment->period_to->format('d/m/Y'),
                'interest_rate' => number_format($interestPayment->interest_rate, 2),
                'interest_amount' => number_format($interestPayment->interest_amount, 2),
                'handling_fee' => number_format($interestPayment->handling_fee, 2),
                'total_payable' => number_format($interestPayment->total_payable, 2),
                'payment_method' => ucfirst($interestPayment->payment_method),
                'cash_amount' => number_format($interestPayment->cash_amount, 2),
                'transfer_amount' => number_format($interestPayment->transfer_amount, 2),
                'bank_name' => $interestPayment->bank->name ?? null,
                'reference_no' => $interestPayment->reference_no,
                'processed_by' => $interestPayment->createdBy->name,
                'interest_breakdown' => $interestPayment->breakdown,
                'due_date' => $interestPayment->pledge->due_date->format('d/m/Y'),
                'note' => 'Interest payment only. Due date unchanged.',
            ],
        ], 'Receipt data retrieved');
    }
}
