<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\PledgeItem;
use App\Models\PledgePayment;
use App\Models\Customer;
use App\Models\GoldPrice;
use App\Models\Slot;
use App\Models\SlotHold;
use App\Models\AuditLog;
use App\Models\Notification;
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
            ->with(['customer:id,name,ic_number,phone,country_code,selfie_photo'])
            // Load latest renewal and redemption IDs for print routing
            ->with(['renewals' => function ($q) {
            $q->select('id', 'pledge_id')->latest()->limit(1);
        }])
            ->with(['redemption' => function ($q) {
            $q->select('id', 'pledge_id', 'redemption_no')->latest()->limit(1);
        }])
            // Count all items in the pledge
            ->withCount('items as items_count')
            // Interest payment summary (additive, does not affect existing fields)
            ->withSum('interestPayments as interest_paid_months_total', 'interest_months')
            ->withMax('interestPayments as interest_paid_through', 'period_to');

        if ($request->boolean('with_items')) {
            // Only load items that have NOT been redeemed/released.
            // Exclude the `photo` column: it holds a base64 image (~110KB each),
            // so loading it for every item in a bulk list blows past the PHP
            // memory limit. List/reconciliation views never use the photo;
            // the item detail endpoint loads it separately when needed.
            $query->with(['items' => function ($q) {
                $q->whereNotIn('status', ['redeemed', 'released'])
                    ->select($this->itemListColumns())
                    ->with(['category', 'purity', 'vault', 'box', 'slot']);
            }]);
        }

        // Search
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('pledge_no', 'like', "%{$search}%")
                    ->orWhere('receipt_no', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($cq) use ($search) {
                    $cq->where('name', 'like', "%{$search}%")
                        ->orWhere('ic_number', 'like', "%{$search}%");
                    })
                    ->orWhereHas('redemption', function ($rq) use ($search) {
                    $rq->where('redemption_no', 'like', "%{$search}%");
                    })
                    // A renewal issues its own ticket (RNW-...), and that is the
                    // number printed on the receipt the customer walks out with.
                    // Without this, searching the number off a renewal ticket
                    // returned nothing at all.
                    ->orWhereHas('renewals', function ($rnq) use ($search) {
                    $rnq->where('renewal_no', 'like', "%{$search}%");
                    });
            });
        }

        // Filter by status (supports virtual statuses: due_soon, partial, overdue_partial)
        if ($status = $request->get('status')) {
            $statuses = explode(',', $status);
            $realStatuses = [];
            foreach ($statuses as $s) {
                if ($s === 'due_soon') {
                    $today = Carbon::today();
                    $weekAhead = (clone $today)->addDays(7);
                    $query->where('status', 'active')
                        ->whereBetween('due_date', [$today, $weekAhead]);
                } elseif ($s === 'partial') {
                    $query->where('status', 'active')
                        ->whereHas('redemption');
                } elseif ($s === 'overdue_partial') {
                    $query->where('status', 'overdue')
                        ->whereHas('redemption');
                } elseif ($s === 'overdue') {
                    // Same real-state definition the stats tiles use: the stored
                    // status never flips when a due date passes, so an active pledge
                    // past its due date is overdue too. Matching on the column alone
                    // returned nothing while the tile reported pledges overdue.
                    $overdueToday = Carbon::today()->toDateString();
                    $query->where(function ($q) use ($overdueToday) {
                        $q->where('status', 'overdue')
                            ->orWhere(function ($q2) use ($overdueToday) {
                                $q2->where('status', 'active')
                                    ->whereNotNull('due_date')
                                    ->whereDate('due_date', '<', $overdueToday);
                            });
                    });
                } elseif ($s === 'active') {
                    // Mirror of the branch above, so Active and Overdue partition the
                    // list the same way the two tiles count them. Without this, a
                    // past-due pledge appeared under BOTH filters and the Active
                    // filter disagreed with its own tile.
                    $activeToday = Carbon::today()->toDateString();
                    $query->where('status', 'active')
                        ->where(function ($q) use ($activeToday) {
                            $q->whereNull('due_date')
                                ->orWhereDate('due_date', '>=', $activeToday);
                        });
                } else {
                    $realStatuses[] = $s;
                }
            }
            if (!empty($realStatuses)) {
                $query->whereIn('status', $realStatuses);
            }
        }

        // Filter by date range
        if ($from = $request->get('from_date')) {
            $query->whereDate('pledge_date', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('pledge_date', '<=', $to);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'newest');
        switch ($sortBy) {
            case 'oldest':
                $query->orderBy('created_at', 'asc');
                break;
            case 'receipt-desc':
                $query->orderBy('receipt_no', 'desc');
                break;
            case 'receipt-asc':
                $query->orderBy('receipt_no', 'asc');
                break;
            case 'amount-high':
                $query->orderBy('loan_amount', 'desc');
                break;
            case 'amount-low':
                $query->orderBy('loan_amount', 'asc');
                break;
            case 'due-soon':
                $query->orderBy('due_date', 'asc');
                break;
            case 'newest':
            default:
                $query->orderBy('created_at', 'desc');
                break;
        }

        $pledges = $query->paginate($request->get('per_page', 15));

        return $this->paginated($pledges);
    }

    /**
     * Columns to load for items in list/bulk contexts. Deliberately excludes the
     * heavy `photo` (base64 image) column. Includes all foreign keys so the
     * eager-loaded category/purity/vault/box/slot relations resolve correctly.
     */
    private function itemListColumns(): array
    {
        return [
            'id', 'pledge_id', 'redemption_id', 'item_no', 'barcode',
            'category_id', 'quantity', 'purity_id',
            'gross_weight', 'stone_deduction_type', 'stone_deduction_value',
            'net_weight', 'price_per_gram', 'gross_value', 'deduction_amount', 'net_value',
            'description', 'remarks',
            'vault_id', 'box_id', 'slot_id',
            'location_assigned_at', 'location_assigned_by',
            'status', 'redeemed_at', 'redeemed_from_location', 'released_at',
            'created_at', 'updated_at',
        ];
    }

    /**
     * Aggregate pledge stats (branch-scoped). Reflects full dataset, not the current page.
     */
    public function stats(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $base = Pledge::where('branch_id', $branchId);

        $total = (clone $base)->count();

        // A pledge past its due date is overdue in fact, but nothing ever flips the
        // stored column: it sits at 'active' until a renewal or redemption rewrites
        // it. Counting the column alone reported "Overdue 0" while pledges sat weeks
        // late, and inflated "Active" by the same amount. Count by real state instead:
        // the stored status OR an active pledge whose due date has passed.
        $today = Carbon::today()->toDateString();

        $overdue = (clone $base)
            ->where(function ($q) use ($today) {
                $q->where('status', 'overdue')
                    ->orWhere(function ($q2) use ($today) {
                        $q2->where('status', 'active')
                            ->whereNotNull('due_date')
                            ->whereDate('due_date', '<', $today);
                    });
            })
            ->count();

        // Active means active AND not yet past due. A row with no due date cannot be
        // judged late, so it stays counted as active rather than vanishing from both.
        $active = (clone $base)
            ->where('status', 'active')
            ->where(function ($q) use ($today) {
                $q->whereNull('due_date')
                    ->orWhereDate('due_date', '>=', $today);
            })
            ->count();

        $redeemed = (clone $base)->where('status', 'redeemed')->count();
        $totalValue = (clone $base)
            ->whereIn('status', ['active', 'overdue'])
            ->sum('loan_amount');

        return $this->success([
            'total' => $total,
            'active' => $active,
            'overdue' => $overdue,
            'redeemed' => $redeemed,
            'total_value' => (float) $totalValue,
        ]);
    }

    /**
     * Get pledge by receipt number, pledge number, or IC
     */
    public function byReceipt(Request $request, string $receiptNo): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $searchTerm = trim($receiptNo);

        // Normalize for barcode scanner format (remove hyphens and uppercase)
        $searchNormalized = strtoupper(str_replace('-', '', $searchTerm));

        // Search by receipt_no, pledge_no, or customer IC
        $pledge = Pledge::where('branch_id', $branchId)
            ->where(function ($query) use ($searchTerm, $searchNormalized) {
            $query->where('receipt_no', $searchTerm)
                ->orWhere('pledge_no', $searchTerm)
                // Handle barcode scanner format (without hyphens)
                ->orWhereRaw("REPLACE(receipt_no, '-', '') = ?", [$searchNormalized])
                ->orWhereRaw("REPLACE(pledge_no, '-', '') = ?", [$searchNormalized])
                ->orWhereHas('customer', function ($q) use ($searchTerm) {
                // Remove dashes/spaces from IC for matching
                $cleanIC = preg_replace('/[-\s]/', '', $searchTerm);
                $q->where('ic_number', $searchTerm)
                    ->orWhere(DB::raw("REPLACE(REPLACE(ic_number, '-', ''), ' ', '')"), $cleanIC);
            }
            );
        })
            ->with(['customer', 'items' => function ($q) {
            // Only show non-redeemed items when loading a pledge by receipt/pledge no
            $q->whereNotIn('status', ['redeemed', 'released'])
                ->with(['category', 'purity', 'vault', 'box', 'slot']);
        }])
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

            $netValue = floor($netValue / 50) * 50;

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
        $rawLoanAmount = $totalNetValue * ($loanPercentage / 100);
        $loanAmount = floor($rawLoanAmount / 50) * 50;

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
            'items.*.quantity' => 'nullable|integer|min:1',
            'items.*.purity_id' => 'required|exists:purities,id',
            'items.*.gross_weight' => 'required|numeric|min:0.001',
            'items.*.stone_deduction_type' => 'required|in:percentage,amount,grams',
            'items.*.stone_deduction_value' => 'required|numeric|min:0',
            'items.*.price_per_gram' => 'nullable|numeric|min:0',
            'items.*.description' => 'nullable|string|max:255',
            'items.*.photo' => 'nullable|string', // Base64 encoded image or URL
            'items.*.vault_id' => 'nullable|exists:vaults,id',
            'items.*.box_id' => 'nullable|exists:boxes,id',
            'items.*.slot_id' => 'nullable|exists:slots,id',
            'loan_percentage' => 'required|numeric|min:1|max:100',
            'loan_amount' => 'nullable|numeric|min:0',
            'handling_fee' => 'nullable|numeric|min:0',
            'payment' => 'required|array',
            'payment.method' => 'required|in:cash,transfer,partial',
            'payment.cash_amount' => 'required_if:payment.method,cash,partial|numeric|min:0',
            'payment.transfer_amount' => 'required_if:payment.method,transfer,partial|numeric|min:0',
            'payment.bank_id' => 'required_if:payment.method,transfer,partial|exists:banks,id',
            'payment.account_number' => 'nullable|string|max:30',
            'payment.reference_no' => 'nullable|string|max:50',
            // Multi-bank transfer split (max 3). When present, each row becomes a PledgePayment.
            'payment.transfer_splits' => 'nullable|array|max:3',
            'payment.transfer_splits.*.bank_id' => 'required_with:payment.transfer_splits|exists:banks,id',
            'payment.transfer_splits.*.account_number' => 'nullable|string|max:30',
            'payment.transfer_splits.*.amount' => 'required_with:payment.transfer_splits|numeric|min:0',
            'customer_signature' => 'nullable|string',
            'terms_accepted' => 'required|boolean|accepted',
            'gold_prices' => 'nullable|array',
            'gold_prices.price_999' => 'nullable|numeric|min:0',
            'gold_prices.price_916' => 'nullable|numeric|min:0',
            'gold_prices.price_875' => 'nullable|numeric|min:0',
            'gold_prices.price_750' => 'nullable|numeric|min:0',
            'override_interest_rate' => 'nullable|numeric|min:0|max:99',
            'override_interest_rate_extended' => 'nullable|numeric|min:0|max:99',
            'override_interest_rate_overdue' => 'nullable|numeric|min:0|max:99',
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

        // ── PRE-CREATION AUDIT: Log the raw payload BEFORE saving ──
        // This captures exactly what the frontend sent so we can trace
        // if items were missing from the request vs lost during save.
        try {
            $payloadItems = array_map(function ($item, $index) {
                return [
                    'index' => $index + 1,
                    'category_id' => $item['category_id'] ?? null,
                    'purity_id' => $item['purity_id'] ?? null,
                    'gross_weight' => $item['gross_weight'] ?? 0,
                    'stone_deduction_type' => $item['stone_deduction_type'] ?? null,
                    'stone_deduction_value' => $item['stone_deduction_value'] ?? 0,
                    'description' => $item['description'] ?? null,
                ];
            }, $validated['items'], array_keys($validated['items']));

            AuditLog::create([
                'branch_id' => $branchId,
                'user_id' => $userId,
                'action' => 'create_attempt',
                'module' => 'pledge',
                'description' => "Pledge creation attempt for {$customer->name} - Items: " . count($validated['items']) . ", Loan%: {$validated['loan_percentage']}",
                'record_type' => 'Pledge',
                'record_id' => 0, // Not created yet
                'new_values' => [
                    'customer_id' => $customer->id,
                    'customer_name' => $customer->name,
                    'backend_received_items' => count($validated['items']),
                    'items_payload' => $payloadItems,
                    'loan_percentage' => $validated['loan_percentage'],
                    'loan_amount_override' => $validated['loan_amount'] ?? 'auto',
                    'handling_fee' => $validated['handling_fee'] ?? 0,
                    'payment_method' => $validated['payment']['method'] ?? null,
                    'frontend_debug' => $request->input('_debug_frontend', null),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Pre-creation audit log failed: ' . $e->getMessage());
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
                // Use frontend-provided price if available, otherwise fall back to DB gold price
                $pricePerGram = !empty($item['price_per_gram']) ? (float) $item['price_per_gram'] : $goldPrices->getPriceForPurity($purity->code);

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

            $rawLoanAmount = $netValue * ($validated['loan_percentage'] / 100);
            $calculatedLoanAmount = floor($rawLoanAmount / 50) * 50;
            // Use frontend-provided loan_amount if edited, otherwise use auto-calculated
            $loanAmount = isset($validated['loan_amount']) ? round($validated['loan_amount'], 2) : $calculatedLoanAmount;
            $handlingFee = $validated['handling_fee'] ?? 0;
            $payoutAmount = max(0, $loanAmount - $handlingFee);

            // Auto-correct payment amounts to match server-calculated payout amount
            $payment = $validated['payment'];
            $paymentMethod = $payment['method'] ?? 'cash';

            if ($paymentMethod === 'cash') {
                $payment['cash_amount'] = $payoutAmount;
                $payment['transfer_amount'] = 0;
            } elseif ($paymentMethod === 'transfer') {
                $payment['cash_amount'] = 0;
                $payment['transfer_amount'] = $payoutAmount;
            } else {
                // Partial: keep cash as-is, adjust transfer to fill the remainder
                $cashAmt = min((float) ($payment['cash_amount'] ?? 0), $payoutAmount);
                $payment['cash_amount'] = $cashAmt;
                $payment['transfer_amount'] = max(0, $payoutAmount - $cashAmt);
            }

            // Fetch interest rates from database (branch specific or global)
            $interestRates = \App\Models\InterestRate::where(function($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            })->where('is_active', true)->orderBy('sort_order')->get();

            // The standard bucket may be split into tiers (e.g. 0.5% months 1-3 then
            // 1.0% months 4-6), lowest month first. A 'custom' rule still overrides
            // the standard ones outright, as it always has.
            $customTiers = $interestRates->where('rate_type', 'custom');
            $standardTiers = ($customTiers->isNotEmpty() ? $customTiers : $interestRates->where('rate_type', 'standard'))
                ->sortBy(fn($r) => $r->from_month ?? 1)
                ->values();

            // The term runs to the END of the standard bucket, not to the end of its
            // first tier. Taking ->first()->to_month gave a 3-month pledge whenever
            // months 1-3 and 4-6 were configured separately.
            $pledgeMonths = (int) ($standardTiers->max(fn($r) => $r->to_month ?? 0) ?: 6);
            $dueDate = Carbon::today()->addMonths($pledgeMonths)->subDay();

            // Set rates: Priority order:
            // 1. Frontend override (operator manually adjusted in NewPledge)
            // 2. Customer custom rates (per-person defaults from customer profile)
            // 3. Global InterestRate settings (from Settings page)
            // 4. Config fallback
            //
            // interest_rate holds the rate for month 1 — the FIRST standard tier.
            // keyBy('rate_type') collapsed the tiers and silently kept the last row,
            // so a pledge configured for 0.5% months 1-3 was created at 1.0%.
            $ratesByType = $interestRates->keyBy('rate_type');
            $globalStandard = $standardTiers->isNotEmpty()
                ? $standardTiers->first()->rate_percentage
                : config('pawnsys.interest.standard', 0.5);
            $globalExtended = isset($ratesByType['extended']) ? $ratesByType['extended']->rate_percentage : config('pawnsys.interest.extended', 1.5);
            $globalOverdue = isset($ratesByType['overdue']) ? $ratesByType['overdue']->rate_percentage : config('pawnsys.interest.overdue', 2.0);

            // Apply customer custom rates if set (per-person override)
            $rateStandard = $customer->custom_interest_rate ?? $globalStandard;
            $rateExtended = $customer->custom_interest_rate_extended ?? $globalExtended;
            $rateOverdue = $customer->custom_interest_rate_overdue ?? $globalOverdue;

            // Apply frontend manual overrides if provided (highest priority - operator decides)
            if (isset($validated['override_interest_rate'])) {
                $rateStandard = $validated['override_interest_rate'];
            }
            if (isset($validated['override_interest_rate_extended'])) {
                $rateExtended = $validated['override_interest_rate_extended'];
            }
            if (isset($validated['override_interest_rate_overdue'])) {
                $rateOverdue = $validated['override_interest_rate_overdue'];
            }

            // Resolve the market prices actually on offer. Settings ("manual" source)
            // takes precedence over the gold_prices table, which only the API fetch
            // writes and can be weeks stale when a branch prices manually.
            $manual = \App\Models\Setting::goldPriceSettings($branchId);
            if ($manual) {
                $marketPrices = [
                    'price_999' => $manual['prices']['999'] ?? null,
                    'price_916' => $manual['prices']['916'] ?? null,
                    'price_875' => $manual['prices']['875'] ?? null,
                    'price_750' => $manual['prices']['750'] ?? null,
                ];
                $marketSource = $manual['source'];
            } else {
                $marketPrices = [
                    'price_999' => (float) $goldPrices->price_999,
                    'price_916' => (float) $goldPrices->price_916,
                    'price_875' => (float) $goldPrices->price_875,
                    'price_750' => (float) $goldPrices->price_750,
                ];
                $marketSource = $goldPrices->source ?? $goldPrices->price_source ?? null;
            }

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
                'handling_fee' => $handlingFee,
                'payout_amount' => $payoutAmount,
                'interest_rate' => $rateStandard,
                'interest_rate_extended' => $rateExtended,
                'interest_rate_overdue' => $rateOverdue,
                'pledge_date' => Carbon::today(),
                'due_date' => $dueDate,
                'grace_end_date' => $dueDate->copy()->addDays(7),
                // Prices actually used to value the pledge — staff may override these.
                'gold_price_999' => $validated['gold_prices']['price_999'] ?? $goldPrices->price_999,
                'gold_price_916' => $validated['gold_prices']['price_916'] ?? $goldPrices->price_916,
                'gold_price_875' => $validated['gold_prices']['price_875'] ?? $goldPrices->price_875,
                'gold_price_750' => $validated['gold_prices']['price_750'] ?? $goldPrices->price_750,
                // Market prices on offer at that moment, read server-side so a client
                // cannot pass off an override as the market rate.
                'market_gold_prices' => $marketPrices,
                'market_price_source' => $marketSource,
                'customer_signature' => $validated['customer_signature'] ?? null,
                'terms_accepted' => true,
                'terms_accepted_at' => now(),
                'created_by' => $userId,
            ]);

            // Freeze the rate ladder onto the pledge, so a later Settings edit cannot
            // reprice a loan the customer has already signed for.
            //
            // Skipped when the standard rate was overridden (per-customer or by the
            // operator), because that override replaces the whole ladder with one
            // flat rate. Skipped too when there is only one standard tier: a pledge
            // with no tiers falls back to exactly that flat behaviour, so storing a
            // single row would be noise.
            //
            // The overdue rate is never a tier — it is chosen by the pledge's state,
            // not by which month it is in.
            $standardOverridden = $customer->custom_interest_rate !== null
                || isset($validated['override_interest_rate']);

            if (!$standardOverridden && $standardTiers->count() > 1) {
                foreach ($standardTiers as $tier) {
                    $pledge->interestTiers()->create([
                        'from_month' => $tier->from_month ?? 1,
                        'to_month' => $tier->to_month,
                        'rate_percentage' => $tier->rate_percentage,
                        'rate_type' => 'standard',
                    ]);
                }

                // The extended tier runs from the end of the standard bucket onwards.
                // Month 13 is not a cliff: to_month is left null so the rate continues.
                $pledge->interestTiers()->create([
                    'from_month' => $pledgeMonths + 1,
                    'to_month' => null,
                    'rate_percentage' => $rateExtended,
                    'rate_type' => 'extended',
                ]);
            }

            // Create items
            $itemNumber = 1;
            // Slots already claimed by an earlier item IN THIS SAME pledge.
            // The guard below marks a slot occupied on the first item that uses
            // it; a later item pointing at the same slot must NOT be treated as
            // "taken by another user" — it is this very pledge re-using its own
            // slot. We skip the guard + assignment for slots already handled.
            $slotsClaimedThisPledge = [];
            foreach ($validated['items'] as $item) {
                $purity = \App\Models\Purity::find($item['purity_id']);
                // Use frontend-provided price if available, otherwise fall back to DB gold price
                $pricePerGram = !empty($item['price_per_gram']) ? (float) $item['price_per_gram'] : $goldPrices->getPriceForPurity($purity->code);

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
                    'quantity' => $item['quantity'] ?? 1,
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
                    'photo' => $item['photo'] ?? null, // Save item photo
                    'vault_id' => $item['vault_id'] ?? null,
                    'box_id' => $item['box_id'] ?? null,
                    'slot_id' => $item['slot_id'] ?? null,
                    'location_assigned_at' => isset($item['slot_id']) ? now() : null,
                    'location_assigned_by' => isset($item['slot_id']) ? $userId : null,
                ]);
                // Final concurrency guard (last-resort net) — runs BEFORE the
                // existing assignment below. Locks the slot row and rejects if
                // another pledge already occupies it or another user is holding
                // it. This is a check placed in front of the assignment logic;
                // the assignment block itself is unchanged.
                if (isset($item['slot_id']) && !in_array($item['slot_id'], $slotsClaimedThisPledge, true)) {
                    $lockedSlot = Slot::where('id', $item['slot_id'])->lockForUpdate()->first();

                    $heldByOther = SlotHold::live()
                        ->where('slot_id', $item['slot_id'])
                        ->where('held_by', '!=', $userId)
                        ->exists();

                    if (($lockedSlot && $lockedSlot->is_occupied) || $heldByOther) {
                        // Trace exactly why this rejected, so cross-machine
                        // failures can be diagnosed from the server log instead
                        // of guesswork. Captured before rollBack().
                        $conflictHold = SlotHold::live()
                            ->where('slot_id', $item['slot_id'])
                            ->where('held_by', '!=', $userId)
                            ->first();

                        Log::warning('Pledge slot guard rejected', [
                            'slot_id' => $item['slot_id'],
                            'request_user_id' => $userId,
                            'branch_id' => $branchId,
                            'slot_is_occupied' => $lockedSlot ? (bool) $lockedSlot->is_occupied : null,
                            'slot_current_item_id' => $lockedSlot->current_item_id ?? null,
                            'held_by_other' => $heldByOther,
                            'conflict_hold_held_by' => $conflictHold->held_by ?? null,
                            'conflict_hold_expires_at' => $conflictHold->expires_at ?? null,
                            'ip' => $request->ip(),
                        ]);

                        DB::rollBack();

                        return $this->error(
                            'A selected slot was just taken by another user. Please reselect storage and try again.',
                            409
                        );
                    }
                }

                // Update slot if assigned — only the first item in this pledge
                // to use the slot performs the occupy + hold-release. Later
                // items sharing the same slot skip this (already done).
                if (isset($item['slot_id']) && !in_array($item['slot_id'], $slotsClaimedThisPledge, true)) {
                    Slot::where('id', $item['slot_id'])->update([
                        'is_occupied' => true,
                        'current_item_id' => $pledgeItem->id,
                        'occupied_at' => now(),
                    ]);

                    // Also increment box occupied count
                    if (isset($item['box_id'])) {
                        \App\Models\Box::where('id', $item['box_id'])->increment('occupied_slots');
                    }

                    // Release the advisory hold now that the slot is permanently assigned.
                    SlotHold::where('slot_id', $item['slot_id'])->delete();

                    // Mark this slot as handled so subsequent items in the same
                    // pledge don't re-trip the guard or double-count the box.
                    $slotsClaimedThisPledge[] = $item['slot_id'];
                }

                $itemNumber++;
            }

            // Create payment(s)
            $payment = $validated['payment'];
            $splits = $payment['transfer_splits'] ?? [];

            if (\count($splits) > 0) {
                // One PledgePayment row per bank split. The first row carries the
                // cash portion + total_amount so report sums (which aggregate across
                // all rows) are not double-counted; later rows carry only their
                // own transfer amount.
                foreach (\array_values($splits) as $i => $split) {
                    PledgePayment::create([
                        'pledge_id' => $pledge->id,
                        'total_amount' => $i === 0 ? $loanAmount : 0,
                        'cash_amount' => $i === 0 ? $payment['cash_amount'] : 0,
                        'transfer_amount' => (float) ($split['amount'] ?? 0),
                        'bank_id' => $split['bank_id'] ?? null,
                        'account_number' => $split['account_number'] ?? null,
                        'reference_no' => $i === 0 ? ($payment['reference_no'] ?? null) : null,
                        'payment_method' => $paymentMethod,
                        'payment_date' => Carbon::today(),
                        'created_by' => $userId,
                    ]);
                }
            } else {
                PledgePayment::create([
                    'pledge_id' => $pledge->id,
                    'total_amount' => $loanAmount,
                    'cash_amount' => $payment['cash_amount'],
                    'transfer_amount' => $payment['transfer_amount'],
                    'bank_id' => $payment['bank_id'] ?? null,
                    'account_number' => $payment['account_number'] ?? null,
                    'reference_no' => $payment['reference_no'] ?? null,
                    'payment_method' => $paymentMethod,
                    'payment_date' => Carbon::today(),
                    'created_by' => $userId,
                ]);
            }

            // Update customer stats
            $customer->updateStats();

            DB::commit();

            $pledge->load(['customer', 'items.category', 'items.purity', 'payments']);

            // Audit log - pledge created
            try {
                AuditLog::create([
                    'branch_id' => $branchId,
                    'user_id' => $userId,
                    'action' => 'create',
                    'module' => 'pledge',
                    'description' => "Created pledge {$pledge->pledge_no} for {$customer->name} - RM" . number_format($pledge->loan_amount, 2),
                    'record_type' => 'Pledge',
                    'record_id' => $pledge->id,
                    'new_values' => [
                        'pledge_no' => $pledge->pledge_no,
                        'customer' => $customer->name,
                        'loan_amount' => $pledge->loan_amount,
                        'items_count' => count($validated['items']),
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                    'severity' => 'info',
                    'created_at' => now(),
                ]);
            }
            catch (\Exception $e) {
                // Don't fail pledge creation if audit logging fails
                Log::warning('Audit log failed: ' . $e->getMessage());
            }

            // Create notification for new pledge
            try {
                Notification::create([
                    'branch_id' => $branchId,
                    'user_id' => null, // Visible to all users in branch
                    'type' => 'success',
                    'title' => 'New Pledge Created',
                    'message' => "Pledge {$pledge->pledge_no} created for {$customer->name} - RM" . number_format($pledge->loan_amount, 2),
                    'category' => 'pledge',
                    'action_url' => "/pledges/{$pledge->id}",
                    'is_read' => false,
                    'metadata' => [
                        'pledge_id' => $pledge->id,
                        'pledge_no' => $pledge->pledge_no,
                        'customer_name' => $customer->name,
                        'loan_amount' => $pledge->loan_amount,
                        'items_count' => count($validated['items']),
                        'created_by' => $request->user()->name,
                    ],
                ]);
            }
            catch (\Exception $e) {
                // Don't fail pledge creation if notification fails
                Log::warning('Notification creation failed: ' . $e->getMessage());
            }

            return $this->success($pledge, 'Pledge created successfully', 201);

        }
        catch (\Exception $e) {
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
            'payments.createdBy:id,name',
            'renewals',
            'interestPayments',
            'receipts',
            'createdBy:id,name',
            'redemption.createdBy:id,name',
            'redemption.bank:id,name',
            'interestTiers',
        ]);

        // The 3rd parameter is the scenario, not a rate. Passing $pledge->interest_rate
        // fell through to the default branch, so this panel reported a flat rate for
        // all 12 months — and the rate it reported was interest_rate_extended, which
        // had landed in $standardRate. 'renewed' is the maintained scenario: standard
        // months 1-6, extended from 7 on, honouring the pledge's frozen tier ladder.
        $interestBreakdown = $this->interestService
            ->forPledge($pledge)
            ->calculateMonthlyBreakdown(
                $pledge->loan_amount,
                12,
                'renewed',
                $pledge->interest_rate,
                $pledge->interest_rate_extended,
                $pledge->interest_rate_overdue
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
            ->whereNotIn('status', ['redeemed', 'released'])
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

        }
        catch (\Exception $e) {
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
                'cancellation_reason' => $request->input('reason', 'No reason provided'),
                'cancellation_notes' => $request->input('notes', ''),
            ]);

            DB::commit();

            // Audit log - pledge cancelled
            try {
                AuditLog::create([
                    'branch_id' => $branchId,
                    'user_id' => $request->user()->id,
                    'action' => 'cancel',
                    'module' => 'pledge',
                    'description' => "Cancelled pledge {$pledge->pledge_no} - Reason: " . ($request->input('reason', 'No reason')),
                    'record_type' => 'Pledge',
                    'record_id' => $pledge->id,
                    'old_values' => ['status' => 'active'],
                    'new_values' => ['status' => 'cancelled'],
                    'ip_address' => $request->ip(),
                    'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                    'severity' => 'warning',
                    'created_at' => now(),
                ]);
            }
            catch (\Exception $e) {
                Log::warning('Audit log failed: ' . $e->getMessage());
            }

            return $this->success([
                'message' => 'Pledge cancelled successfully',
                'pledge' => $pledge->fresh(),
            ]);

        }
        catch (\Exception $e) {
            DB::rollBack();
            Log::error('Pledge cancellation failed: ' . $e->getMessage());
            return $this->error('Failed to cancel pledge: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Send pledge details via WhatsApp
     */
    public function sendWhatsApp(Request $request, Pledge $pledge): JsonResponse
    {
        // Extend time limit for PDF generation + WhatsApp sending
        set_time_limit(120);

        try {
            // Check branch access
            if ($pledge->branch_id !== $request->user()->branch_id) {
                return $this->error('Unauthorized', 403);
            }

            // ── Duplicate check: prevent accidental double-send ──
            $forceResend = $request->boolean('force', false);
            $existingLog = \App\Models\WhatsAppLog::where('related_type', 'pledge')
                ->where('related_id', $pledge->id)
                ->where('status', 'sent')
                ->first();

            if ($existingLog && !$forceResend) {
                return $this->error(
                    'WhatsApp already sent for this pledge on ' . $existingLog->sent_at->format('d/m/Y h:i A') .
                    '. Use force=true to resend.',
                    409 // HTTP 409 Conflict
                );
            }

            // Load relationships
            $pledge->load(['customer', 'items.category', 'items.purity', 'branch']);

            // Get WhatsApp configuration
            $config = \App\Models\WhatsAppConfig::where('branch_id', $pledge->branch_id)
                ->where('is_enabled', true)
                ->first();

            if (!$config) {
                return $this->error('WhatsApp not configured for this branch', 400);
            }

            // Build message
            $message = $this->buildPledgeWhatsAppMessage($pledge);

            // Get customer phone with correct country code from database
            $phone = preg_replace('/[^0-9]/', '', $pledge->customer->phone);
            $countryCode = preg_replace('/[^0-9]/', '', $pledge->customer->country_code ?? '60');

            // Remove leading 0 from phone if present
            if (substr($phone, 0, 1) === '0') {
                $phone = substr($phone, 1);
            }

            // Add country code (use stored country_code, default to 60 for Malaysia)
            $phone = $countryCode . $phone;

            // ── Phone validation per country code ──
            $phoneMinLengths = [
                '60' => 9,   // Malaysia: 9-10 digits (e.g. 123456789)
                '91' => 10,  // India: 10 digits
                '65' => 8,   // Singapore: 8 digits
                '62' => 9,   // Indonesia: 9-12 digits
                '66' => 9,   // Thailand: 9 digits
                '63' => 10,  // Philippines: 10 digits
                '880' => 10, // Bangladesh: 10 digits
                '95' => 7,   // Myanmar: 7-9 digits
                '44' => 10,  // UK: 10 digits
                '1' => 10,   // US/Canada: 10 digits
            ];
            // Strip country code to get local number length
            $localPhone = $phone;
            $matchedMin = 7; // default minimum
            foreach ($phoneMinLengths as $code => $minLen) {
                if (strpos($phone, $code) === 0) {
                    $localPhone = substr($phone, strlen($code));
                    $matchedMin = $minLen;
                    break;
                }
            }
            if (strlen($localPhone) < $matchedMin) {
                return $this->error(
                    'Invalid phone number: ' . $phone . ' (need at least ' . $matchedMin . ' digits after country code, got ' . strlen($localPhone) . '). Customer phone: ' . $pledge->customer->phone,
                    422
                );
            }

            // Load AiSensy template + ordered data map (UltraMsg ignores these)
            $template = \App\Models\WhatsAppTemplate::where('template_key', 'pledge_created')
                ->where(function ($q) use ($pledge) {
                    $q->where('branch_id', $pledge->branch_id)->orWhereNull('branch_id');
                })
                ->orderBy('branch_id', 'desc')
                ->first();

            // Item list formatted the same way as the printed/text receipt.
            $itemsList = $pledge->items->map(function ($item) {
                return "{$item->category->name_en} ({$item->purity->code}) - {$item->net_weight}g";
            })->join(', ');

            $templateData = [
                'customer_name' => $pledge->customer->name ?? '',
                'pledge_no'     => $pledge->pledge_no,
                'date'          => \Carbon\Carbon::parse($pledge->pledge_date)->format('d/m/Y'),
                'customer_ic'   => $pledge->customer->ic_number ?? '',
                'items'         => $itemsList,
                'total_weight'  => number_format($pledge->total_weight, 2),
                'loan_amount'   => number_format($pledge->loan_amount, 2),
                'interest_rate' => number_format($pledge->interest_rate, 2),
                'due_date'      => \Carbon\Carbon::parse($pledge->due_date)->format('d/m/Y'),
            ];

            // Send text message via the shared WhatsApp service
            $result = app(\App\Services\WhatsApp\WhatsAppService::class)
                ->sendText($config, $phone, $message, $template, $templateData, $pledge->customer->name ?? null);

            if ($result['success']) {
                // Log the message immediately
                \App\Models\WhatsAppLog::create([
                    'branch_id' => $pledge->branch_id,
                    'recipient_phone' => $phone,
                    'recipient_name' => $pledge->customer->name,
                    'message_content' => $message,
                    'status' => 'sent',
                    'related_type' => 'pledge',
                    'related_id' => $pledge->id,
                    'sent_at' => now(),
                    'sent_by' => $request->user()->id,
                ]);

                // Optionally attach the full PDF receipt as a second message.
                // Per-branch toggle (default off); works for UltraMsg + AiSensy.
                $pdfAttached = false;
                if ($config->attach_pdf_receipt) {
                    $pdfAttached = $this->sendPledgePdfReceipt($config, $phone, $pledge, $template, $templateData, $request->user()->id);
                }

                return $this->success([
                    'message' => 'WhatsApp sent successfully to ' . $phone,
                    'was_resend' => $existingLog ? true : false,
                    'pdf_attached' => $pdfAttached,
                ]);
            }
            else {
                return $this->error($result['error'] ?? 'Failed to send WhatsApp', 500);
            }

        }
        catch (\Exception $e) {
            Log::error('WhatsApp sending failed: ' . $e->getMessage());
            return $this->error('Failed to send WhatsApp: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Send the pledge PDF receipt as a follow-up WhatsApp document.
     * Returns true on success. Never throws — a PDF failure must not undo the
     * text message that was already sent. The document is logged separately.
     */
    private function sendPledgePdfReceipt(
        $config,
        string $phone,
        Pledge $pledge,
        $template,
        array $templateData,
        ?int $userId
    ): bool {
        try {
            $pdfBase64 = app(\App\Services\WhatsApp\ReceiptPdfBuilder::class)->pledge($pledge);

            // AiSensy needs a public URL; UltraMsg uses the base64 directly.
            $publicUrl = $config->provider === 'aisensy'
                ? \Illuminate\Support\Facades\URL::temporarySignedRoute(
                    'whatsapp.receipt',
                    now()->addMinutes(15),
                    ['type' => 'pledge', 'id' => $pledge->id]
                )
                : null;

            $result = app(\App\Services\WhatsApp\WhatsAppService::class)->sendDocument(
                $config,
                $phone,
                $pdfBase64,
                "Receipt-{$pledge->pledge_no}.pdf",
                "📄 Receipt for Pledge {$pledge->pledge_no}",
                $publicUrl,
                $template,
                $templateData,
                $pledge->customer->name ?? null
            );

            \App\Models\WhatsAppLog::create([
                'branch_id' => $pledge->branch_id,
                'recipient_phone' => $phone,
                'recipient_name' => $pledge->customer->name,
                'message_content' => "[PDF] Receipt-{$pledge->pledge_no}.pdf",
                'status' => $result['success'] ? 'sent' : 'failed',
                'error_message' => $result['error'] ?? null,
                'related_type' => 'pledge_pdf',
                'related_id' => $pledge->id,
                'sent_at' => $result['success'] ? now() : null,
                'sent_by' => $userId,
            ]);

            return (bool) $result['success'];
        }
        catch (\Throwable $e) {
            Log::error('Pledge PDF receipt send failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Build WhatsApp message for pledge
     */
    private function buildPledgeWhatsAppMessage(Pledge $pledge): string
    {
        $items = $pledge->items->map(function ($item) {
            return "• {$item->category->name_en} ({$item->purity->code}) - {$item->net_weight}g";
        })->join("\n");

        $companyName = \App\Models\Setting::where('category', 'company')
            ->where('key_name', 'name')
            ->value('value') ?? $pledge->branch->name ?? 'PAJAK GADAI SDN BHD';

        $message = "*{$companyName}*\n";
        $message .= "🏦 *PLEDGE RECEIPT*\n";
        $message .= "━━━━━━━━━━━━━━━━━━\n\n";
        $message .= "📋 *Pledge No:* {$pledge->pledge_no}\n";
        $message .= "📅 *Date:* {$pledge->pledge_date->format('d/m/Y')}\n\n";
        $message .= "*Customer:* {$pledge->customer->name}\n";
        $message .= "*IC:* {$pledge->customer->ic_number}\n\n";
        $message .= "📦 *Items:*\n{$items}\n\n";
        $message .= "⚖️ *Total Weight:* {$pledge->total_weight}g\n";
        $message .= "💰 *Loan Amount:* RM " . number_format($pledge->loan_amount, 2) . "\n";
        $message .= "📊 *Interest:* {$pledge->interest_rate}% /month\n\n";
        $message .= "📅 *Due Date:* {$pledge->due_date->format('d/m/Y')}\n\n";
        $message .= "━━━━━━━━━━━━━━━━━━\n";
        $message .= "_Thank you for your business!_\n";
        $message .= "_{$pledge->branch->name}_";

        return $message;
    }

    /**
     * Send PDF receipt via WhatsApp
     */
    private function sendPdfReceipt($config, string $phone, Pledge $pledge): array
    {
        // Extend time limit for PDF generation + upload
        set_time_limit(90);

        try {
            $pdfBase64 = app(\App\Services\WhatsApp\ReceiptPdfBuilder::class)->pledge($pledge);

            $publicUrl = $config->provider === 'aisensy'
                ? \Illuminate\Support\Facades\URL::temporarySignedRoute('whatsapp.receipt', now()->addMinutes(15), ['type' => 'pledge', 'id' => $pledge->id])
                : null;

            return app(\App\Services\WhatsApp\WhatsAppService::class)->sendDocument(
                $config,
                $phone,
                $pdfBase64,
                "Receipt-{$pledge->pledge_no}.pdf",
                "📄 Receipt for Pledge {$pledge->pledge_no}",
                $publicUrl,
                null,
                [],
                $pledge->customer->name ?? null
            );
        }
        catch (\Exception $e) {
            Log::error('PDF receipt generation failed: ' . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Get pledges that never had WhatsApp sent (for retroactive sending)
     * These are pledges created before WhatsApp was configured.
     */
    public function getPendingWhatsApp(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Pledge::where('pledges.branch_id', $branchId)
            ->leftJoin('whatsapp_logs', function ($join) {
                $join->on('pledges.id', '=', 'whatsapp_logs.related_id')
                    ->where('whatsapp_logs.related_type', '=', 'pledge')
                    ->where('whatsapp_logs.status', '=', 'sent');
            })
            ->whereNull('whatsapp_logs.id')
            ->join('customers', 'customers.id', '=', 'pledges.customer_id')
            ->select([
                'pledges.id',
                'pledges.pledge_no',
                'pledges.loan_amount',
                'pledges.status',
                'pledges.pledge_date',
                'pledges.due_date',
                'pledges.created_at',
                'customers.name as customer_name',
                'customers.phone as customer_phone',
                'customers.country_code as customer_country_code',
            ]);

        // Optional: filter by status
        if ($status = $request->get('status')) {
            $query->where('pledges.status', $status);
        }

        // Optional: filter by date range
        if ($from = $request->get('from_date')) {
            $query->whereDate('pledges.created_at', '>=', $from);
        }
        if ($to = $request->get('to_date')) {
            $query->whereDate('pledges.created_at', '<=', $to);
        }

        $pendingPledges = $query->orderBy('pledges.created_at', 'asc')->get();

        return $this->success([
            'total_count' => $pendingPledges->count(),
            'pledges' => $pendingPledges,
        ], $pendingPledges->count() . ' pledge(s) found without WhatsApp sent');
    }

    /**
     * Bulk send WhatsApp for multiple pledges (retroactive sending)
     * Accepts pledge IDs or pledge numbers, sends WhatsApp for each.
     * Includes duplicate protection per pledge.
     */
    public function bulkSendWhatsApp(Request $request): JsonResponse
    {
        set_time_limit(300); // 5 minutes for bulk

        $validated = $request->validate([
            'pledge_ids' => 'nullable|array',
            'pledge_ids.*' => 'integer|exists:pledges,id',
            'pledge_nos' => 'nullable|array',
            'pledge_nos.*' => 'string',
            'force' => 'nullable|boolean',
        ]);

        if (empty($validated['pledge_ids'] ?? []) && empty($validated['pledge_nos'] ?? [])) {
            return $this->error('Provide pledge_ids or pledge_nos', 422);
        }

        $branchId = $request->user()->branch_id;
        $forceResend = $request->boolean('force', false);

        // Collect pledges by ID or pledge_no
        $pledges = collect();

        if (!empty($validated['pledge_ids'])) {
            $pledges = $pledges->merge(
                Pledge::where('branch_id', $branchId)
                    ->whereIn('id', $validated['pledge_ids'])
                    ->get()
            );
        }

        if (!empty($validated['pledge_nos'])) {
            $pledges = $pledges->merge(
                Pledge::where('branch_id', $branchId)
                    ->whereIn('pledge_no', $validated['pledge_nos'])
                    ->get()
            );
        }

        // Deduplicate by ID
        $pledges = $pledges->unique('id');

        if ($pledges->isEmpty()) {
            return $this->error('No matching pledges found for this branch', 404);
        }

        // Get WhatsApp config
        $config = \App\Models\WhatsAppConfig::where('branch_id', $branchId)
            ->where('is_enabled', true)
            ->first();

        if (!$config) {
            return $this->error('WhatsApp not configured for this branch', 400);
        }

        $results = [
            'sent' => [],
            'skipped_duplicate' => [],
            'failed' => [],
        ];

        foreach ($pledges as $pledge) {
            try {
                // Load relationships
                $pledge->load(['customer', 'items.category', 'items.purity', 'branch']);

                // ── Duplicate check ──
                $existingLog = \App\Models\WhatsAppLog::where('related_type', 'pledge')
                    ->where('related_id', $pledge->id)
                    ->where('status', 'sent')
                    ->first();

                if ($existingLog && !$forceResend) {
                    $results['skipped_duplicate'][] = [
                        'pledge_id' => $pledge->id,
                        'pledge_no' => $pledge->pledge_no,
                        'customer' => $pledge->customer->name,
                        'already_sent_at' => $existingLog->sent_at->format('d/m/Y h:i A'),
                    ];
                    continue;
                }

                // Build message
                $message = $this->buildPledgeWhatsAppMessage($pledge);

                // Get phone
                $phone = preg_replace('/[^0-9]/', '', $pledge->customer->phone);
                $countryCode = preg_replace('/[^0-9]/', '', $pledge->customer->country_code ?? '60');
                if (substr($phone, 0, 1) === '0') {
                    $phone = substr($phone, 1);
                }
                $phone = $countryCode . $phone;

                // ── Phone validation per country code ──
                $phoneMinLengths = [
                    '60' => 9,   // Malaysia: 9-10 digits
                    '91' => 10,  // India: 10 digits
                    '65' => 8,   // Singapore: 8 digits
                    '62' => 9,   // Indonesia: 9-12 digits
                    '66' => 9,   // Thailand: 9 digits
                    '63' => 10,  // Philippines: 10 digits
                    '880' => 10, // Bangladesh: 10 digits
                    '95' => 7,   // Myanmar: 7-9 digits
                    '44' => 10,  // UK: 10 digits
                    '1' => 10,   // US/Canada: 10 digits
                ];
                $localPhone = $phone;
                $matchedMin = 7;
                foreach ($phoneMinLengths as $code => $minLen) {
                    if (strpos($phone, $code) === 0) {
                        $localPhone = substr($phone, strlen($code));
                        $matchedMin = $minLen;
                        break;
                    }
                }
                if (strlen($localPhone) < $matchedMin) {
                    $results['failed'][] = [
                        'pledge_id' => $pledge->id,
                        'pledge_no' => $pledge->pledge_no,
                        'customer' => $pledge->customer->name,
                        'phone' => $phone,
                        'error' => 'Invalid phone: ' . $phone . ' (need ' . $matchedMin . ' digits after country code, got ' . strlen($localPhone) . ', original: ' . $pledge->customer->phone . ')',
                    ];
                    continue;
                }

                // Send
                $result = app(\App\Services\WhatsApp\WhatsAppService::class)
                    ->sendText($config, $phone, $message, null, [], $pledge->customer->name ?? null);

                if ($result['success']) {
                    \App\Models\WhatsAppLog::create([
                        'branch_id' => $pledge->branch_id,
                        'recipient_phone' => $phone,
                        'recipient_name' => $pledge->customer->name,
                        'message_content' => $message,
                        'status' => 'sent',
                        'related_type' => 'pledge',
                        'related_id' => $pledge->id,
                        'sent_at' => now(),
                        'sent_by' => $request->user()->id,
                    ]);

                    $results['sent'][] = [
                        'pledge_id' => $pledge->id,
                        'pledge_no' => $pledge->pledge_no,
                        'customer' => $pledge->customer->name,
                        'phone' => $phone,
                    ];
                } else {
                    $results['failed'][] = [
                        'pledge_id' => $pledge->id,
                        'pledge_no' => $pledge->pledge_no,
                        'customer' => $pledge->customer->name,
                        'error' => $result['error'] ?? 'Unknown error',
                    ];
                }

                // Small delay between sends to avoid API rate limiting
                usleep(500000); // 0.5 seconds

            } catch (\Exception $e) {
                $results['failed'][] = [
                    'pledge_id' => $pledge->id,
                    'pledge_no' => $pledge->pledge_no,
                    'error' => $e->getMessage(),
                ];
            }
        }

        $summary = sprintf(
            'Bulk WhatsApp: %d sent, %d skipped (duplicate), %d failed',
            count($results['sent']),
            count($results['skipped_duplicate']),
            count($results['failed'])
        );

        return $this->success($results, $summary);
    }
}
