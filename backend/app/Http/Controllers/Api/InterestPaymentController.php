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

        if ($rate !== null && $rate !== '') {
            $rate = (float) $rate;
            $rateSource = 'manual';
        } elseif ($pledge->customer && $pledge->customer->custom_interest_rate !== null) {
            $rate = (float) $pledge->customer->custom_interest_rate;
            $rateSource = 'customer';
        } else {
            $rate = (float) $pledge->interest_rate;
            $rateSource = 'global';
        }

        // Calculate months elapsed from pledge date
        $pledgeDate = Carbon::parse($pledge->pledge_date);
        $now = Carbon::now();
        $monthsElapsed = max(1, $pledgeDate->diffInMonths($now));

        // Determine the interest period
        // Check if there were previous interest payments
        $lastPayment = InterestPayment::where('pledge_id', $pledge->id)
            ->where('status', 'completed')
            ->orderBy('period_to', 'desc')
            ->first();

        if ($lastPayment) {
            $periodFrom = $lastPayment->period_to->copy()->addDay();
            $monthsPaid = $pledgeDate->diffInMonths($lastPayment->period_to);
        } else {
            $periodFrom = $pledgeDate->copy();
            $monthsPaid = 0;
        }

        // Months remaining to pay
        $monthsRemaining = $monthsElapsed - $monthsPaid;
        if ($monthsRemaining < 1) {
            $monthsRemaining = 1; // Minimum 1 month
        }

        // Allow user to override months to pay (e.g. for prepayment)
        if ($request->has('months_to_pay')) {
            $monthsRemaining = (int) $request->input('months_to_pay');
        }

        $periodTo = $periodFrom->copy()->addMonths($monthsRemaining);

        // Calculate interest
        $principal = (float) $pledge->loan_amount;
        $breakdown = [];
        $totalInterest = 0;
        $cumulative = 0;

        for ($i = 0; $i < $monthsRemaining; $i++) {
            $monthNumber = $monthsPaid + $i + 1;
            $monthlyInterest = $principal * ($rate / 100);
            $cumulative += $monthlyInterest;

            $breakdown[] = [
                'month' => $monthNumber,
                'rate' => $rate,
                'interest' => round($monthlyInterest, 2),
                'cumulative' => round($cumulative, 2),
            ];

            $totalInterest += $monthlyInterest;
        }

        $totalInterest = round($totalInterest, 2);
        $handlingFee = 0; // Disabled per user preference
        $totalPayable = $totalInterest + $handlingFee;

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
                'customer' => $pledge->customer,
            ],
            'period' => [
                'from' => $periodFrom->toDateString(),
                'to' => $periodTo->toDateString(),
                'months_elapsed' => $monthsElapsed,
                'months_paid' => $monthsPaid,
                'months_remaining' => $monthsRemaining,
            ],
            'calculation' => [
                'interest_rate' => $rate,
                'rate_source' => $rateSource,
                'interest_breakdown' => $breakdown,
                'interest_amount' => $totalInterest,
                'handling_fee' => round($handlingFee, 2),
                'total_payable' => round($totalPayable, 2),
            ],
        ]);
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
            // Determine interest rate
            $rate = isset($validated['interest_rate']) ? (float) $validated['interest_rate'] : null;

            if ($rate === null) {
                if ($pledge->customer && $pledge->customer->custom_interest_rate !== null) {
                    $rate = (float) $pledge->customer->custom_interest_rate;
                } else {
                    $rate = (float) $pledge->interest_rate;
                }
            }

            // Calculate period
            $pledgeDate = Carbon::parse($pledge->pledge_date);
            $now = Carbon::now();
            $monthsElapsed = max(1, $pledgeDate->diffInMonths($now));

            $lastPayment = InterestPayment::where('pledge_id', $pledge->id)
                ->where('status', 'completed')
                ->orderBy('period_to', 'desc')
                ->first();

            if ($lastPayment) {
                $periodFrom = $lastPayment->period_to->copy()->addDay();
                $monthsPaid = $pledgeDate->diffInMonths($lastPayment->period_to);
            } else {
                $periodFrom = $pledgeDate->copy();
                $monthsPaid = 0;
            }

            $monthsRemaining = max(1, $monthsElapsed - $monthsPaid);
            
            // Allow override for prepayment
            if (isset($validated['months_to_pay'])) {
                $monthsRemaining = (int) $validated['months_to_pay'];
            }

            $periodTo = $periodFrom->copy()->addMonths($monthsRemaining);

            // Calculate interest
            $principal = (float) $pledge->loan_amount;
            $totalInterest = 0;
            $breakdownData = [];
            $cumulative = 0;

            for ($i = 0; $i < $monthsRemaining; $i++) {
                $monthNumber = $monthsPaid + $i + 1;
                $monthlyInterest = $principal * ($rate / 100);
                $cumulative += $monthlyInterest;

                $breakdownData[] = [
                    'month_number' => $monthNumber,
                    'interest_rate' => $rate,
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
