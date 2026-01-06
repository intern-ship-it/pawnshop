<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Renewal;
use App\Models\Pledge;
use App\Models\RenewalInterestBreakdown;
use App\Services\InterestCalculationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class RenewalController extends Controller
{
    protected $interestService;

    public function __construct(InterestCalculationService $interestService)
    {
        $this->interestService = $interestService;
    }

    /**
     * List all renewals
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Renewal::where('branch_id', $branchId)
            ->with(['pledge.customer:id,name,ic_number']);

        // Date filter
        if ($from = $request->get('from_date')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('created_at', '<=', $to);
        }

        // Search by pledge number
        if ($search = $request->get('search')) {
            $query->whereHas('pledge', function ($q) use ($search) {
                $q->where('pledge_no', 'like', "%{$search}%")
                    ->orWhere('receipt_no', 'like', "%{$search}%");
            });
        }

        $renewals = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($renewals);
    }

    /**
     * Get today's renewals
     */
    public function today(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $renewals = Renewal::where('branch_id', $branchId)
            ->whereDate('created_at', Carbon::today())
            ->with(['pledge.customer:id,name,ic_number,phone'])
            ->orderBy('created_at', 'desc')
            ->get();

        $summary = [
            'count' => $renewals->count(),
            'total' => $renewals->sum('total_payable'),
            'cash' => $renewals->sum('cash_amount'),
            'transfer' => $renewals->sum('transfer_amount'),
        ];

        return $this->success([
            'renewals' => $renewals,
            'summary' => $summary,
        ]);
    }

    /**
     * Get pledges due for renewal
     */
    public function dueList(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();
        $days = $request->get('days', 7);

        $pledges = Pledge::where('branch_id', $branchId)
            ->where('status', 'active')
            ->whereBetween('due_date', [$today, $today->copy()->addDays($days)])
            ->with(['customer:id,name,ic_number,phone', 'items:id,pledge_id,category_id,net_weight'])
            ->orderBy('due_date')
            ->get();

        return $this->success($pledges);
    }

    /**
     * Calculate renewal
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'renewal_months' => 'required|integer|min:1|max:6',
        ]);

        $branchId = $request->user()->branch_id;

        // Cast to integer (GET params come as strings)
        $renewalMonths = (int) $validated['renewal_months'];
        $pledgeId = (int) $validated['pledge_id'];

        $pledge = Pledge::where('id', $pledgeId)
            ->where('branch_id', $branchId)
            ->whereIn('status', ['active', 'overdue']) // Allow overdue pledges too
            ->first();

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        // Calculate current month based on pledge date
        $pledgeDate = Carbon::parse($pledge->pledge_date);
        $now = Carbon::now();
        $monthsElapsed = $pledgeDate->diffInMonths($now);
        $currentMonth = max(1, $monthsElapsed);

        // Calculate renewal interest
        $calculation = $this->interestService->calculateRenewalInterest(
            (float) $pledge->loan_amount,
            $currentMonth,
            $renewalMonths,
            (float) $pledge->interest_rate,
            (float) $pledge->interest_rate_extended
        );

        $handlingFee = (float) config('pawnsys.handling_fee.amount', 0.50);
        $totalPayable = $calculation['total_interest'] + $handlingFee;

        return $this->success([
            'pledge' => [
                'id' => $pledge->id,
                'pledge_no' => $pledge->pledge_no,
                'loan_amount' => (float) $pledge->loan_amount,
                'current_due_date' => $pledge->due_date->toDateString(),
                'renewal_count' => (int) $pledge->renewal_count,
            ],
            'renewal' => [
                'months' => $renewalMonths,
                'new_due_date' => $pledge->due_date->copy()->addMonths($renewalMonths)->toDateString(),
            ],
            'calculation' => [
                'interest_breakdown' => $calculation['breakdown'],
                'interest_amount' => round($calculation['total_interest'], 2),
                'handling_fee' => round($handlingFee, 2),
                'total_payable' => round($totalPayable, 2),
            ],
        ]);
    }

    /**
     * Process renewal
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'renewal_months' => 'required|integer|min:1|max:6',
            'payment_method' => 'required|in:cash,transfer,partial',
            'cash_amount' => 'nullable|numeric|min:0',
            'transfer_amount' => 'nullable|numeric|min:0',
            'bank_id' => 'nullable|exists:banks,id',
            'reference_no' => 'nullable|string|max:50',
            'customer_signature' => 'nullable|string',
            'terms_accepted' => 'required|boolean',
        ]);

        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;

        // Cast to proper types
        $renewalMonths = (int) $validated['renewal_months'];
        $pledgeId = (int) $validated['pledge_id'];

        $pledge = Pledge::where('id', $pledgeId)
            ->where('branch_id', $branchId)
            ->whereIn('status', ['active', 'overdue'])
            ->first();

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        DB::beginTransaction();

        try {
            // Calculate current month
            $pledgeDate = Carbon::parse($pledge->pledge_date);
            $now = Carbon::now();
            $monthsElapsed = $pledgeDate->diffInMonths($now);
            $currentMonth = max(1, $monthsElapsed);

            // Calculate interest
            $calculation = $this->interestService->calculateRenewalInterest(
                (float) $pledge->loan_amount,
                $currentMonth,
                $renewalMonths,
                (float) $pledge->interest_rate,
                (float) $pledge->interest_rate_extended
            );

            $handlingFee = (float) config('pawnsys.handling_fee.amount', 0.50);
            $totalPayable = $calculation['total_interest'] + $handlingFee;

            // Generate renewal number
            $renewalNo = sprintf(
                'RNW-%s-%s-%04d',
                $pledge->branch->code,
                date('Y'),
                Renewal::where('branch_id', $branchId)->whereYear('created_at', date('Y'))->count() + 1
            );

            // Calculate new due date
            $newDueDate = $pledge->due_date->copy()->addMonths($renewalMonths);

            // Create renewal
            $renewal = Renewal::create([
                'branch_id' => $branchId,
                'pledge_id' => $pledge->id,
                'renewal_no' => $renewalNo,
                'renewal_count' => $pledge->renewal_count + 1,
                'renewal_months' => $renewalMonths,
                'previous_due_date' => $pledge->due_date,
                'new_due_date' => $newDueDate,
                'interest_rate' => $pledge->interest_rate,
                'interest_amount' => $calculation['total_interest'],
                'handling_fee' => $handlingFee,
                'total_payable' => $totalPayable,
                'payment_method' => $validated['payment_method'],
                'cash_amount' => (float) ($validated['cash_amount'] ?? 0),
                'transfer_amount' => (float) ($validated['transfer_amount'] ?? 0),
                'bank_id' => $validated['bank_id'] ?? null,
                'reference_no' => $validated['reference_no'] ?? null,
                'terms_accepted' => true,
                'customer_signature' => $validated['customer_signature'] ?? null,
                'created_by' => $userId,
            ]);

            // Create interest breakdown
            foreach ($calculation['breakdown'] as $item) {
                RenewalInterestBreakdown::create([
                    'renewal_id' => $renewal->id,
                    'month_number' => $item['month'],
                    'interest_rate' => $item['rate'],
                    'interest_amount' => $item['interest'],
                    'cumulative_amount' => $item['interest'],
                ]);
            }

            // Update pledge
            $pledge->update([
                'due_date' => $newDueDate,
                'grace_end_date' => $newDueDate->copy()->addDays(7),
                'renewal_count' => $pledge->renewal_count + 1,
                'status' => 'active',
            ]);

            DB::commit();

            $renewal->load(['pledge.customer', 'interestBreakdown']);

            return $this->success($renewal, 'Renewal processed successfully', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to process renewal: ' . $e->getMessage(), 500);
        }
    }


    /**
     * Get renewal details
     */
    public function show(Request $request, Renewal $renewal): JsonResponse
    {
        if ($renewal->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $renewal->load(['pledge.customer', 'pledge.items', 'interestBreakdown', 'bank', 'createdBy:id,name']);

        return $this->success($renewal);
    }
}
