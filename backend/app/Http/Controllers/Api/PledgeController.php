<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\PledgeItem;
use App\Models\PledgePayment;
use App\Models\Customer;
use App\Models\GoldPrice;
use App\Models\Slot;
use App\Services\InterestCalculationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class PledgeController extends Controller
{
    protected $interestService;

    public function __construct(InterestCalculationService $interestService)
    {
        $this->interestService = $interestService;
    }

    /**
     * List all pledges
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Pledge::where('branch_id', $branchId)
            ->with(['customer:id,name,ic_number,phone'])
            ->withCount('items');

        // Search
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('pledge_no', 'like', "%{$search}%")
                    ->orWhere('receipt_no', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%")
                            ->orWhere('ic_number', 'like', "%{$search}%");
                    });
            });
        }

        // Filter by status
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        // Filter by date range
        if ($from = $request->get('from_date')) {
            $query->whereDate('pledge_date', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('pledge_date', '<=', $to);
        }

        $pledges = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($pledges);
    }

    /**
     * Get pledge by receipt number
     */
    public function byReceipt(Request $request, string $receiptNo): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $pledge = Pledge::where('branch_id', $branchId)
            ->where('receipt_no', $receiptNo)
            ->with(['customer', 'items.category', 'items.purity', 'items.vault', 'items.box', 'items.slot'])
            ->first();

        if (!$pledge) {
            return $this->error('Pledge not found', 404);
        }

        return $this->success($pledge);
    }

    /**
     * Calculate pledge values (preview before creating)
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.category_id' => 'required|exists:categories,id',
            'items.*.purity_id' => 'required|exists:purities,id',
            'items.*.gross_weight' => 'required|numeric|min:0.001',
            'items.*.stone_deduction_type' => 'required|in:percentage,amount,grams',
            'items.*.stone_deduction_value' => 'required|numeric|min:0',
            'loan_percentage' => 'required|numeric|min:1|max:100',
        ]);

        $branchId = $request->user()->branch_id;

        // Get today's gold prices
        $goldPrices = GoldPrice::where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->orderBy('price_date', 'desc')
            ->first();

        if (!$goldPrices) {
            return $this->error('Gold prices not set. Please update gold prices first.', 422);
        }

        $itemsCalculated = [];
        $totalGrossWeight = 0;
        $totalNetWeight = 0;
        $totalGrossValue = 0;
        $totalDeduction = 0;
        $totalNetValue = 0;

        foreach ($validated['items'] as $item) {
            $purity = \App\Models\Purity::find($item['purity_id']);
            $pricePerGram = $goldPrices->getPriceForPurity($purity->code);

            $grossWeight = $item['gross_weight'];
            $stoneDeductionType = $item['stone_deduction_type'];
            $stoneDeductionValue = $item['stone_deduction_value'];

            // Calculate deduction
            $deductionWeight = 0;
            $deductionAmount = 0;

            switch ($stoneDeductionType) {
                case 'percentage':
                    $deductionWeight = $grossWeight * ($stoneDeductionValue / 100);
                    break;
                case 'grams':
                    $deductionWeight = $stoneDeductionValue;
                    break;
                case 'amount':
                    $deductionAmount = $stoneDeductionValue;
                    break;
            }

            $netWeight = $grossWeight - $deductionWeight;
            $grossValue = $grossWeight * $pricePerGram;

            if ($stoneDeductionType === 'amount') {
                $netValue = $grossValue - $deductionAmount;
                $deductionAmountCalc = $deductionAmount;
            } else {
                $netValue = $netWeight * $pricePerGram;
                $deductionAmountCalc = $deductionWeight * $pricePerGram;
            }

            $itemsCalculated[] = [
                'category_id' => $item['category_id'],
                'purity_id' => $item['purity_id'],
                'purity_code' => $purity->code,
                'gross_weight' => round($grossWeight, 3),
                'stone_deduction_type' => $stoneDeductionType,
                'stone_deduction_value' => $stoneDeductionValue,
                'net_weight' => round($netWeight, 3),
                'price_per_gram' => $pricePerGram,
                'gross_value' => round($grossValue, 2),
                'deduction_amount' => round($deductionAmountCalc, 2),
                'net_value' => round($netValue, 2),
            ];

            $totalGrossWeight += $grossWeight;
            $totalNetWeight += $netWeight;
            $totalGrossValue += $grossValue;
            $totalDeduction += $deductionAmountCalc;
            $totalNetValue += $netValue;
        }

        $loanPercentage = $validated['loan_percentage'];
        $loanAmount = $totalNetValue * ($loanPercentage / 100);

        // Calculate interest breakdown
        $interestBreakdown = $this->interestService->calculateMonthlyBreakdown($loanAmount, 6);

        // Calculate redemption estimates
        $redemptionEstimates = [
            '1_month' => $loanAmount + $interestBreakdown[0]['cumulative'],
            '3_months' => $loanAmount + $interestBreakdown[2]['cumulative'],
            '6_months' => $loanAmount + $interestBreakdown[5]['cumulative'],
        ];

        return $this->success([
            'items' => $itemsCalculated,
            'summary' => [
                'total_gross_weight' => round($totalGrossWeight, 3),
                'total_net_weight' => round($totalNetWeight, 3),
                'total_gross_value' => round($totalGrossValue, 2),
                'total_deduction' => round($totalDeduction, 2),
                'total_net_value' => round($totalNetValue, 2),
                'loan_percentage' => $loanPercentage,
                'loan_amount' => round($loanAmount, 2),
            ],
            'interest_breakdown' => $interestBreakdown,
            'redemption_estimates' => $redemptionEstimates,
            'gold_prices' => [
                'date' => $goldPrices->price_date->toDateString(),
                '999' => $goldPrices->price_999,
                '916' => $goldPrices->price_916,
                '875' => $goldPrices->price_875,
                '750' => $goldPrices->price_750,
            ],
        ]);
    }

    /**
     * Create new pledge
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'items' => 'required|array|min:1',
            'items.*.category_id' => 'required|exists:categories,id',
            'items.*.purity_id' => 'required|exists:purities,id',
            'items.*.gross_weight' => 'required|numeric|min:0.001',
            'items.*.stone_deduction_type' => 'required|in:percentage,amount,grams',
            'items.*.stone_deduction_value' => 'required|numeric|min:0',
            'items.*.description' => 'nullable|string|max:255',
            'items.*.vault_id' => 'nullable|exists:vaults,id',
            'items.*.box_id' => 'nullable|exists:boxes,id',
            'items.*.slot_id' => 'nullable|exists:slots,id',
            'loan_percentage' => 'required|numeric|min:1|max:100',
            'payment' => 'required|array',
            'payment.method' => 'required|in:cash,transfer,partial',
            'payment.cash_amount' => 'required_if:payment.method,cash,partial|numeric|min:0',
            'payment.transfer_amount' => 'required_if:payment.method,transfer,partial|numeric|min:0',
            'payment.bank_id' => 'required_if:payment.method,transfer,partial|exists:banks,id',
            'payment.reference_no' => 'nullable|string|max:50',
            'customer_signature' => 'nullable|string',
            'terms_accepted' => 'required|boolean|accepted',
        ]);

        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;

        // Verify customer belongs to branch
        $customer = Customer::where('id', $validated['customer_id'])
            ->where('branch_id', $branchId)
            ->first();

        if (!$customer) {
            return $this->error('Customer not found', 404);
        }

        if ($customer->is_blacklisted) {
            return $this->error('Customer is blacklisted', 422);
        }

        // Get gold prices
        $goldPrices = GoldPrice::where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->orWhereNull('branch_id');
        })
            ->orderBy('price_date', 'desc')
            ->first();

        if (!$goldPrices) {
            return $this->error('Gold prices not set', 422);
        }

        DB::beginTransaction();

        try {
            // Calculate totals
            $totalWeight = 0;
            $grossValue = 0;
            $totalDeduction = 0;
            $netValue = 0;

            foreach ($validated['items'] as $item) {
                $purity = \App\Models\Purity::find($item['purity_id']);
                $pricePerGram = $goldPrices->getPriceForPurity($purity->code);

                $gw = $item['gross_weight'];
                $deductionWeight = 0;
                $deductionAmt = 0;

                switch ($item['stone_deduction_type']) {
                    case 'percentage':
                        $deductionWeight = $gw * ($item['stone_deduction_value'] / 100);
                        break;
                    case 'grams':
                        $deductionWeight = $item['stone_deduction_value'];
                        break;
                    case 'amount':
                        $deductionAmt = $item['stone_deduction_value'];
                        break;
                }

                $nw = $gw - $deductionWeight;
                $gv = $gw * $pricePerGram;
                $da = $item['stone_deduction_type'] === 'amount' ? $deductionAmt : ($deductionWeight * $pricePerGram);
                $nv = $gv - $da;

                $totalWeight += $nw;
                $grossValue += $gv;
                $totalDeduction += $da;
                $netValue += $nv;
            }

            $loanAmount = $netValue * ($validated['loan_percentage'] / 100);
            $dueDate = Carbon::today()->addMonths(6);

            // Create pledge
            $pledge = Pledge::create([
                'branch_id' => $branchId,
                'customer_id' => $customer->id,
                'pledge_no' => Pledge::generatePledgeNo($branchId),
                'receipt_no' => Pledge::generateReceiptNo($branchId),
                'total_weight' => $totalWeight,
                'gross_value' => $grossValue,
                'total_deduction' => $totalDeduction,
                'net_value' => $netValue,
                'loan_percentage' => $validated['loan_percentage'],
                'loan_amount' => $loanAmount,
                'interest_rate' => config('pawnsys.interest.standard', 0.5),
                'interest_rate_extended' => config('pawnsys.interest.extended', 1.5),
                'interest_rate_overdue' => config('pawnsys.interest.overdue', 2.0),
                'pledge_date' => Carbon::today(),
                'due_date' => $dueDate,
                'grace_end_date' => $dueDate->copy()->addDays(7),
                'gold_price_999' => $goldPrices->price_999,
                'gold_price_916' => $goldPrices->price_916,
                'gold_price_875' => $goldPrices->price_875,
                'gold_price_750' => $goldPrices->price_750,
                'customer_signature' => $validated['customer_signature'] ?? null,
                'terms_accepted' => true,
                'terms_accepted_at' => now(),
                'created_by' => $userId,
            ]);

            // Create items
            $itemNumber = 1;
            foreach ($validated['items'] as $item) {
                $purity = \App\Models\Purity::find($item['purity_id']);
                $pricePerGram = $goldPrices->getPriceForPurity($purity->code);

                $gw = $item['gross_weight'];
                $deductionWeight = 0;
                $deductionAmt = 0;

                switch ($item['stone_deduction_type']) {
                    case 'percentage':
                        $deductionWeight = $gw * ($item['stone_deduction_value'] / 100);
                        break;
                    case 'grams':
                        $deductionWeight = $item['stone_deduction_value'];
                        break;
                    case 'amount':
                        $deductionAmt = $item['stone_deduction_value'];
                        break;
                }

                $nw = $gw - $deductionWeight;
                $gv = $gw * $pricePerGram;
                $da = $item['stone_deduction_type'] === 'amount' ? $deductionAmt : ($deductionWeight * $pricePerGram);
                $nv = $gv - $da;

                $pledgeItem = PledgeItem::create([
                    'pledge_id' => $pledge->id,
                    'item_no' => sprintf('%s-%02d', $pledge->pledge_no, $itemNumber),
                    'barcode' => PledgeItem::generateBarcode($pledge->id, $itemNumber),
                    'category_id' => $item['category_id'],
                    'purity_id' => $item['purity_id'],
                    'gross_weight' => $gw,
                    'stone_deduction_type' => $item['stone_deduction_type'],
                    'stone_deduction_value' => $item['stone_deduction_value'],
                    'net_weight' => $nw,
                    'price_per_gram' => $pricePerGram,
                    'gross_value' => $gv,
                    'deduction_amount' => $da,
                    'net_value' => $nv,
                    'description' => $item['description'] ?? null,
                    'vault_id' => $item['vault_id'] ?? null,
                    'box_id' => $item['box_id'] ?? null,
                    'slot_id' => $item['slot_id'] ?? null,
                    'location_assigned_at' => isset($item['slot_id']) ? now() : null,
                    'location_assigned_by' => isset($item['slot_id']) ? $userId : null,
                ]);
                // Update slot if assigned
                if (isset($item['slot_id'])) {
                    Slot::where('id', $item['slot_id'])->update([
                        'is_occupied' => true,
                        'current_item_id' => $pledgeItem->id,
                        'occupied_at' => now(),
                    ]);

                    // Also increment box occupied count
                    if (isset($item['box_id'])) {
                        \App\Models\Box::where('id', $item['box_id'])->increment('occupied_slots');
                    }
                }

                $itemNumber++;
            }

            // Create payment
            $payment = $validated['payment'];
            PledgePayment::create([
                'pledge_id' => $pledge->id,
                'total_amount' => $loanAmount,
                'cash_amount' => $payment['cash_amount'] ?? 0,
                'transfer_amount' => $payment['transfer_amount'] ?? 0,
                'bank_id' => $payment['bank_id'] ?? null,
                'reference_no' => $payment['reference_no'] ?? null,
                'payment_method' => $payment['method'],
                'payment_date' => Carbon::today(),
                'created_by' => $userId,
            ]);

            // Update customer stats
            $customer->updateStats();

            DB::commit();

            $pledge->load(['customer', 'items.category', 'items.purity', 'payments']);

            return $this->success($pledge, 'Pledge created successfully', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to create pledge: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get pledge details
     */
    public function show(Request $request, Pledge $pledge): JsonResponse
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $pledge->load([
            'customer',
            'items.category',
            'items.purity',
            'items.vault',
            'items.box',
            'items.slot',
            'payments.bank',
            'renewals',
            'receipts',
            'createdBy:id,name',
        ]);

        // Add interest breakdown
        $interestBreakdown = $this->interestService->calculateMonthlyBreakdown(
            $pledge->loan_amount,
            12,
            $pledge->interest_rate,
            $pledge->interest_rate_extended
        );

        return $this->success([
            'pledge' => $pledge,
            'interest_breakdown' => $interestBreakdown,
            'current_interest' => $pledge->current_interest_amount,
            'is_overdue' => $pledge->isOverdue(),
            'days_overdue' => $pledge->days_overdue,
        ]);
    }

    /**
     * Get pledge items
     */
    public function items(Request $request, Pledge $pledge): JsonResponse
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $items = $pledge->items()
            ->with(['category', 'purity', 'vault', 'box', 'slot'])
            ->get();

        return $this->success($items);
    }

    /**
     * Get interest breakdown
     */
    public function interestBreakdown(Request $request, Pledge $pledge): JsonResponse
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $breakdown = $this->interestService->calculateMonthlyBreakdown(
            $pledge->loan_amount,
            12,
            $pledge->interest_rate,
            $pledge->interest_rate_extended
        );

        return $this->success([
            'loan_amount' => $pledge->loan_amount,
            'breakdown' => $breakdown,
        ]);
    }

    /**
     * Assign storage location to items
     */
    public function assignStorage(Request $request, Pledge $pledge): JsonResponse
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.item_id' => 'required|exists:pledge_items,id',
            'items.*.vault_id' => 'required|exists:vaults,id',
            'items.*.box_id' => 'required|exists:boxes,id',
            'items.*.slot_id' => 'required|exists:slots,id',
        ]);

        $userId = $request->user()->id;

        DB::beginTransaction();

        try {
            foreach ($validated['items'] as $itemData) {
                $item = PledgeItem::find($itemData['item_id']);

                if ($item->pledge_id !== $pledge->id) {
                    throw new \Exception('Item does not belong to this pledge');
                }

                // Release old slot if exists
                if ($item->slot_id) {
                    Slot::where('id', $item->slot_id)->update([
                        'is_occupied' => false,
                        'current_item_id' => null,
                        'occupied_at' => null,
                    ]);
                }

                // Assign new slot
                $item->update([
                    'vault_id' => $itemData['vault_id'],
                    'box_id' => $itemData['box_id'],
                    'slot_id' => $itemData['slot_id'],
                    'location_assigned_at' => now(),
                    'location_assigned_by' => $userId,
                ]);

                Slot::where('id', $itemData['slot_id'])->update([
                    'is_occupied' => true,
                    'current_item_id' => $item->id,
                    'occupied_at' => now(),
                ]);
            }

            DB::commit();

            return $this->success(null, 'Storage locations assigned successfully');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to assign storage: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Print receipt (track reprints)
     */
    public function printReceipt(Request $request, Pledge $pledge): JsonResponse
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'copy_type' => 'required|in:office,customer',
        ]);

        $isReprint = $pledge->receipt_printed;
        $chargeAmount = 0;

        if ($isReprint) {
            $chargeAmount = config('pawnsys.receipt.reprint_charge', 2.00);
        }

        // Create receipt record
        \App\Models\PledgeReceipt::create([
            'pledge_id' => $pledge->id,
            'print_type' => $isReprint ? 'reprint' : 'original',
            'copy_type' => $validated['copy_type'],
            'is_chargeable' => $isReprint,
            'charge_amount' => $chargeAmount,
            'printed_by' => $request->user()->id,
        ]);

        // Update pledge
        $pledge->update([
            'receipt_printed' => true,
            'receipt_print_count' => $pledge->receipt_print_count + 1,
        ]);

        return $this->success([
            'is_reprint' => $isReprint,
            'charge_amount' => $chargeAmount,
            'print_count' => $pledge->receipt_print_count,
        ], 'Receipt print recorded');
    }


    /**
     * Cancel a pledge (soft cancel - maintains audit trail)
     */
    public function cancel(Request $request, $id): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $pledge = Pledge::where('branch_id', $branchId)
            ->with('items.slot')
            ->find($id);

        if (!$pledge) {
            return $this->error('Pledge not found', 404);
        }

        // Check if pledge can be cancelled
        if ($pledge->status !== 'active') {
            return $this->error('Only active pledges can be cancelled', 400);
        }

        if ($pledge->renewal_count > 0) {
            return $this->error('Pledges that have been renewed cannot be cancelled', 400);
        }

        // Check if any payments have been made (optional - adjust based on your business rules)
        // if ($pledge->payments()->exists()) {
        //     return $this->error('Pledges with payments cannot be cancelled', 400);
        // }

        DB::beginTransaction();
        try {
            // Release storage slots
            foreach ($pledge->items as $item) {
                if ($item->slot_id) {
                    // Update slot
                    $slot = $item->slot;
                    if ($slot) {
                        $slot->update([
                            'is_occupied' => false,
                            'current_item_id' => null,
                            'occupied_at' => null,
                        ]);

                        // Update box occupied count
                        if ($slot->box) {
                            $slot->box->decrement('occupied_slots');
                        }
                    }

                    // Clear item location
                    $item->update([
                        'vault_id' => null,
                        'box_id' => null,
                        'slot_id' => null,
                        'status' => 'released',
                    ]);
                }
            }

            // Update pledge status
            $pledge->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancelled_by' => $request->user()->id,
                'cancellation_reason' => $request->input('reason', 'Cancelled by user'),
            ]);

            DB::commit();

            return $this->success([
                'message' => 'Pledge cancelled successfully',
                'pledge' => $pledge->fresh(),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Pledge cancellation failed: ' . $e->getMessage());
            return $this->error('Failed to cancel pledge: ' . $e->getMessage(), 500);
        }
    }
}
