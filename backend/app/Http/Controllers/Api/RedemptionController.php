<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Redemption;
use App\Models\Pledge;
use App\Models\PledgeItem;
use App\Models\Slot;
use App\Models\AuditLog;
use App\Services\InterestCalculationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class RedemptionController extends Controller
{
    protected $interestService;

    public function __construct(InterestCalculationService $interestService)
    {
        $this->interestService = $interestService;
    }

    /**
     * List all redemptions
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Redemption::where('branch_id', $branchId)
            ->with(['pledge.customer:id,name,ic_number']);

        // Date filter
        if ($from = $request->get('from_date')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $redemptions = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($redemptions);
    }

    /**
     * Calculate redemption amount
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
        ]);

        $branchId = $request->user()->branch_id;

        $pledge = Pledge::where('id', $validated['pledge_id'])
            ->where('branch_id', $branchId)
            ->where('status', 'active')
            ->with(['items.category', 'items.purity'])
            ->first();

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        $monthsElapsed = max(1, $pledge->months_elapsed);
        $daysOverdue = $pledge->days_overdue;

        $calculation = $this->interestService->calculateRedemption(
            $pledge->loan_amount,
            $monthsElapsed,
            $daysOverdue,
            $pledge->interest_rate,
            $pledge->interest_rate_extended,
            $pledge->interest_rate_overdue
        );

        return $this->success([
            'pledge' => [
                'id' => $pledge->id,
                'pledge_no' => $pledge->pledge_no,
                'receipt_no' => $pledge->receipt_no,
                'customer' => $pledge->customer,
                'loan_amount' => $pledge->loan_amount,
                'pledge_date' => $pledge->pledge_date->toDateString(),
                'due_date' => $pledge->due_date->toDateString(),
                'is_overdue' => $pledge->isOverdue(),
            ],
            'items' => $pledge->items,
            'calculation' => $calculation,
        ]);
    }

    /**
     * Process redemption
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'payment_method' => 'required|in:cash,transfer,partial',
            'cash_amount' => 'required_if:payment_method,cash,partial|numeric|min:0',
            'transfer_amount' => 'required_if:payment_method,transfer,partial|numeric|min:0',
            'bank_id' => 'required_if:payment_method,transfer,partial|exists:banks,id',
            'reference_no' => 'nullable|string|max:50',
            'customer_signature' => 'nullable|string',
            'terms_accepted' => 'required|boolean|accepted',
        ]);

        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;

        $pledge = Pledge::where('id', $validated['pledge_id'])
            ->where('branch_id', $branchId)
            ->where('status', 'active')
            ->first();

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        DB::beginTransaction();

        try {
            $monthsElapsed = max(1, $pledge->months_elapsed);
            $daysOverdue = $pledge->days_overdue;

            $calculation = $this->interestService->calculateRedemption(
                $pledge->loan_amount,
                $monthsElapsed,
                $daysOverdue,
                $pledge->interest_rate,
                $pledge->interest_rate_extended,
                $pledge->interest_rate_overdue
            );

            // Verify payment amount
            $totalPaid = ($validated['cash_amount'] ?? 0) + ($validated['transfer_amount'] ?? 0);
            if ($totalPaid < $calculation['total_payable']) {
                return $this->error('Insufficient payment amount', 422);
            }

            // Generate redemption number
            $redemptionNo = sprintf(
                'RDM-%s-%s-%04d',
                $pledge->branch->code,
                date('Y'),
                Redemption::where('branch_id', $branchId)->whereYear('created_at', date('Y'))->count() + 1
            );

            // Create redemption
            $redemption = Redemption::create([
                'branch_id' => $branchId,
                'pledge_id' => $pledge->id,
                'redemption_no' => $redemptionNo,
                'principal_amount' => $pledge->loan_amount,
                'interest_months' => $monthsElapsed,
                'interest_rate' => $pledge->interest_rate,
                'interest_amount' => $calculation['total_interest'],
                'handling_fee' => $calculation['handling_fee'],
                'total_payable' => $calculation['total_payable'],
                'payment_method' => $validated['payment_method'],
                'cash_amount' => $validated['cash_amount'] ?? 0,
                'transfer_amount' => $validated['transfer_amount'] ?? 0,
                'bank_id' => $validated['bank_id'] ?? null,
                'reference_no' => $validated['reference_no'] ?? null,
                'terms_accepted' => true,
                'customer_signature' => $validated['customer_signature'] ?? null,
                'created_by' => $userId,
            ]);

            // Update pledge status
            $pledge->update(['status' => 'redeemed']);

            // Update customer stats
            $pledge->customer->updateStats();

            DB::commit();

            $redemption->load(['pledge.customer', 'pledge.items']);

            // Audit log - redemption processed
            try {
                AuditLog::create([
                    'branch_id' => $branchId,
                    'user_id' => $userId,
                    'action' => 'create',
                    'module' => 'redemption',
                    'description' => "Processed redemption {$redemption->redemption_no} for pledge {$pledge->pledge_no} - RM" . number_format($calculation['total_payable'], 2),
                    'record_type' => 'Redemption',
                    'record_id' => $redemption->id,
                    'new_values' => [
                        'redemption_no' => $redemption->redemption_no,
                        'pledge_no' => $pledge->pledge_no,
                        'principal' => $pledge->loan_amount,
                        'interest' => $calculation['total_interest'],
                        'total_payable' => $calculation['total_payable'],
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                    'severity' => 'info',
                    'created_at' => now(),
                ]);
            } catch (\Exception $e) {
                Log::warning('Audit log failed: ' . $e->getMessage());
            }

            return $this->success($redemption, 'Redemption processed successfully', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to process redemption: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get redemption details
     */
    public function show(Request $request, Redemption $redemption): JsonResponse
    {
        if ($redemption->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $redemption->load(['pledge.customer', 'pledge.items.category', 'bank', 'createdBy:id,name']);

        return $this->success($redemption);
    }

    /**
     * Release items (after redemption)
     */
    public function releaseItems(Request $request, Redemption $redemption): JsonResponse
    {
        if ($redemption->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        if ($redemption->items_released) {
            return $this->error('Items already released', 422);
        }

        $userId = $request->user()->id;

        DB::beginTransaction();

        try {
            // Release all items and their slots
            $items = $redemption->pledge->items;

            foreach ($items as $item) {
                // Release slot
                if ($item->slot_id) {
                    Slot::where('id', $item->slot_id)->update([
                        'is_occupied' => false,
                        'current_item_id' => null,
                        'occupied_at' => null,
                    ]);
                }

                // Update item status
                $item->update([
                    'status' => 'released',
                    'released_at' => now(),
                ]);
            }

            // Update redemption
            $redemption->update([
                'items_released' => true,
                'released_at' => now(),
                'released_by' => $userId,
            ]);

            DB::commit();

            return $this->success(null, 'Items released successfully');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to release items: ' . $e->getMessage(), 500);
        }
    }
}
