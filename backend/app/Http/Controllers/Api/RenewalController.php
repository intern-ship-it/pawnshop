<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Renewal;
use App\Models\Pledge;
use App\Models\RenewalInterestBreakdown;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Services\InterestCalculationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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

        // Search by renewal number, pledge number, or customer name/IC
        if ($search = $request->get('search')) {
            // Normalize: remove hyphens and uppercase
            $searchNormalized = strtoupper(str_replace('-', '', $search));

            $query->where(function ($q) use ($search, $searchNormalized) {
                // Search by renewal_no (with and without hyphens)
                $q->where('renewal_no', 'like', "%{$search}%")
                    ->orWhereRaw("REPLACE(renewal_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                    // Search by pledge_no / receipt_no on related pledge
                    ->orWhereHas('pledge', function ($pq) use ($search, $searchNormalized) {
                        $pq->where(function ($pq2) use ($search, $searchNormalized) {
                            $pq2->where('pledge_no', 'like', "%{$search}%")
                                ->orWhere('receipt_no', 'like', "%{$search}%")
                                ->orWhereRaw("REPLACE(pledge_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                                ->orWhereRaw("REPLACE(receipt_no, '-', '') LIKE ?", ["%{$searchNormalized}%"]);
                        });
                    })
                    // Search by customer name or IC number
                    ->orWhereHas('pledge.customer', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%")
                            ->orWhere('ic_number', 'like', "%{$search}%");
                    });
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
     * Supports: date_from, date_to, search (IC/pledge_no/receipt_no)
     * 
     * FIXES:
     * - Issue 1: IC search now returns all active pledges for that customer
     * - Issue 2: Date filters (date_from/date_to) now work properly
     * - Issue 4: Items include vault/box/slot location data
     */
    public function dueList(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $query = Pledge::where('branch_id', $branchId)
            ->whereIn('status', ['active', 'overdue']) // Include overdue pledges too
            ->with([
                'customer:id,name,ic_number,phone',
                'items:id,pledge_id,category_id,purity_id,net_weight,net_value,vault_id,box_id,slot_id,description,barcode',
                'items.category:id,name_en,name_ms',
                'items.purity:id,code,name',
                'items.vault:id,code,name',
                'items.box:id,vault_id,box_number,name',
                'items.slot:id,box_id,slot_number'
            ]);

        // Date range filter - use date_from/date_to if provided (Issue 2 fix)
        if ($dateFrom = $request->get('date_from')) {
            $query->whereDate('due_date', '>=', $dateFrom);
        }
        if ($dateTo = $request->get('date_to')) {
            $query->whereDate('due_date', '<=', $dateTo);
        }

        // Fallback to 'days' parameter if no date range provided
        if (!$request->get('date_from') && !$request->get('date_to')) {
            $days = $request->get('days', 7);
            $today = Carbon::today();
            $query->whereBetween('due_date', [$today, $today->copy()->addDays($days)]);
        }

        // Search by IC number, pledge_no, receipt_no, or renewal_no (Issue 1 fix + renewal_no support)
        if ($search = $request->get('search')) {
            $searchTerm = trim($search);
            $searchNormalized = strtoupper(str_replace('-', '', $searchTerm));
            $cleanIC = preg_replace('/[-\s]/', '', $searchTerm);

            $query->where(function ($q) use ($searchTerm, $searchNormalized, $cleanIC) {
                // Match pledge_no or receipt_no (with or without hyphens)
                $q->where('pledge_no', 'like', "%{$searchTerm}%")
                    ->orWhere('receipt_no', 'like', "%{$searchTerm}%")
                    ->orWhereRaw("REPLACE(pledge_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                    ->orWhereRaw("REPLACE(receipt_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                    // Match renewal_no via renewals relationship
                    ->orWhereHas('renewals', function ($rq) use ($searchTerm, $searchNormalized) {
                        $rq->where('renewal_no', 'like', "%{$searchTerm}%")
                            ->orWhereRaw("REPLACE(renewal_no, '-', '') LIKE ?", ["%{$searchNormalized}%"]);
                    })
                    // Match customer IC number
                    ->orWhereHas('customer', function ($cq) use ($searchTerm, $cleanIC) {
                        $cq->where('ic_number', 'like', "%{$searchTerm}%")
                            ->orWhereRaw("REPLACE(REPLACE(ic_number, '-', ''), ' ', '') LIKE ?", ["%{$cleanIC}%"])
                            ->orWhere('name', 'like', "%{$searchTerm}%");
                    });
            });
        }

        $pledges = $query->orderBy('due_date')
            ->get();

        // Add location_string to each item for easier frontend display (Issue 4 fix)
        $pledges->each(function ($pledge) {
            $pledge->items->each(function ($item) {
                if ($item->vault_id && $item->vault) {
                    $location = $item->vault->code ?? $item->vault->name ?? 'Vault';
                    if ($item->box) {
                        $location .= ' / Box ' . ($item->box->box_number ?? $item->box->name ?? $item->box_id);
                    }
                    if ($item->slot) {
                        $location .= ' / Slot ' . ($item->slot->slot_number ?? $item->slot_id);
                    }
                    $item->location_string = $location;
                } else {
                    $item->location_string = null;
                }
            });
        });

        return $this->success($pledges);
    }

    /**
     * The interest rate to apply, and where it came from, in priority order:
     * an explicit override typed by the operator, then the customer's own rate,
     * then the rate frozen on the pledge.
     *
     * The pledge's rate only counts as "global" when it still matches a standard
     * rule configured for its branch; otherwise it was an operator override at
     * pledge creation. All active standard/custom rules are checked, because a
     * branch may define more than one (e.g. months 1-3 and 4-6).
     *
     * Mirrors InterestPaymentController so the two screens cannot disagree.
     *
     * @return array{0: float, 1: string} [rate, 'manual'|'customer'|'global']
     */
    private function resolveRate($requested, Pledge $pledge): array
    {
        if ($requested !== null && $requested !== '') {
            return [(float) $requested, 'manual'];
        }

        if ($pledge->customer && $pledge->customer->custom_interest_rate !== null) {
            return [(float) $pledge->customer->custom_interest_rate, 'customer'];
        }

        $rate = (float) $pledge->interest_rate;

        $configured = \App\Models\InterestRate::where(function ($q) use ($pledge) {
            $q->where('branch_id', $pledge->branch_id)->orWhereNull('branch_id');
        })
            ->where('is_active', true)
            ->whereIn('rate_type', ['standard', 'custom'])
            ->pluck('rate_percentage');

        foreach ($configured as $ruleRate) {
            if (abs($rate - (float) $ruleRate) < 0.001) {
                return [$rate, 'global'];
            }
        }

        return [$rate, 'manual'];
    }

    /**
     * Calculate renewal
     */
    public function calculate(Request $request): JsonResponse
    {
        $maxMonths = (int) (\App\Models\Setting::where('key_name', 'max_renewal_months')->value('value')
            ?? config('pawnsys.pledge.max_renewal_months', 12));

        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'renewal_months' => "required|integer|min:1|max:{$maxMonths}",
            'interest_rate' => 'nullable|numeric|min:0|max:100',
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

        // A renewal collects nothing, so the figure shown is interest ACCRUED TO
        // DATE — months 1..months_elapsed — not interest for the months being
        // added. Billing $renewalMonths from $currentMonth charged for months
        // that have not happened yet, and disagreed with the redemption and
        // interest-payment screens for the same pledge.
        // diffInMonths() returns a float; months_elapsed is the ceil'd integer.
        $monthsAccrued = max(1, $pledge->months_elapsed);

        // Resolve the rate the same way the interest-payment screen does, and say
        // where it came from. The screen previously guessed the source by comparing
        // the pledge rate against the global rule, so every operator override was
        // mislabelled "Customer Rate" even when the customer had none.
        [$customRate, $rateSource] = $this->resolveRate($request->input('interest_rate'), $pledge);

        // Interest accrued so far, month 1 onward.
        $calculation = $this->interestService->calculateRenewalInterest(
            (float) $pledge->loan_amount,
            1,
            $monthsAccrued,
            (float) $customRate
        );

        // Net off anything the customer has already settled at the counter.
        $alreadyPaid = (float) $pledge->total_interest_paid;
        $calculation['interest_already_paid'] = round($alreadyPaid, 2);
        $calculation['gross_interest'] = round($calculation['total_interest'], 2);
        $calculation['total_interest'] = round(max(0, $calculation['total_interest'] - $alreadyPaid), 2);

        // Fetch handling fee settings
        $settings = \App\Models\Setting::whereIn('key_name', [
            'handling_charge_type',
            'handling_charge_value',
            'handling_charge_min',
            'handling_fee'
        ])->get()->pluck('value', 'key_name');

        $type = $settings['handling_charge_type'] ?? 'fixed';
        $value = (float) ($settings['handling_charge_value'] ?? $settings['handling_fee'] ?? 0.50);
        $min = (float) ($settings['handling_charge_min'] ?? 0);

        $principal = (float) $pledge->loan_amount;
        $handlingFee = 0;
        
        // Disabled handling fee calculation per user request
        /*
        if ($type === 'percentage') {
            $handlingFee = $principal * ($value / 100);
            if ($handlingFee < $min)
                $handlingFee = $min;
        } else {
            $handlingFee = $value;
        }
        $handlingFee = round($handlingFee, 2);
        */

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
                // Interest accrued to date, net of anything settled at the counter.
                'interest_amount' => round($calculation['total_interest'], 2),
                'gross_interest' => $calculation['gross_interest'],
                'interest_already_paid' => $calculation['interest_already_paid'],
                'months_accrued' => $monthsAccrued,
                // The rate actually applied, and its true origin, so the screen can
                // show them instead of inferring both.
                'interest_rate' => round((float) $customRate, 2),
                'rate_source' => $rateSource,
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
        $maxMonths = (int) (\App\Models\Setting::where('key_name', 'max_renewal_months')->value('value')
            ?? config('pawnsys.pledge.max_renewal_months', 12));

        // A renewal extends the due date and collects nothing. Interest keeps
        // accruing on the pledge and is settled either at the counter (interest
        // payments) or at redemption. payment_method is therefore optional and
        // retained only so legacy clients that still post it do not break.
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'renewal_months' => "required|integer|min:1|max:{$maxMonths}",
            'payment_method' => 'nullable|in:cash,transfer,partial',
            'cash_amount' => 'nullable|numeric|min:0',
            'transfer_amount' => 'nullable|numeric|min:0',
            'bank_id' => 'nullable|exists:banks,id',
            'account_number' => 'nullable|string|max:30',
            'reference_no' => 'nullable|string|max:50',
            'customer_signature' => 'nullable|string',
            'terms_accepted' => 'required|boolean',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
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
            // Same month count the rest of the system uses (started month rounds up).
            $monthsAccrued = max(1, $pledge->months_elapsed);

            // Same resolution as calculate(), so the stored rate matches the preview.
            // This previously skipped the customer's custom rate entirely.
            [$customRate, ] = $this->resolveRate($validated['interest_rate'] ?? null, $pledge);

            // Interest accrued to date (months 1..elapsed), net of anything already
            // paid at the counter. See calculate() — this is a receipt figure only;
            // no money is collected here.
            $calculation = $this->interestService->calculateRenewalInterest(
                (float) $pledge->loan_amount,
                1,
                $monthsAccrued,
                (float) $customRate
            );
            $calculation['total_interest'] = max(0, $calculation['total_interest'] - (float) $pledge->total_interest_paid);

            // Fetch handling fee settings
            $settings = \App\Models\Setting::whereIn('key_name', [
                'handling_charge_type',
                'handling_charge_value',
                'handling_charge_min',
                'handling_fee'
            ])->get()->pluck('value', 'key_name');

            $type = $settings['handling_charge_type'] ?? 'fixed';
            $value = (float) ($settings['handling_charge_value'] ?? $settings['handling_fee'] ?? 0.50);
            $min = (float) ($settings['handling_charge_min'] ?? 0);

            $principal = (float) $pledge->loan_amount;
            $handlingFee = 0;
            
            // Disabled handling fee calculation per user request
            /*
            if ($type === 'percentage') {
                $handlingFee = $principal * ($value / 100);
                if ($handlingFee < $min)
                    $handlingFee = $min;
            } else {
                $handlingFee = $value;
            }
            $handlingFee = round($handlingFee, 2);
            */

            // Extension only — nothing is collected here. The accrued interest is
            // still recorded on the renewal for the receipt, but nothing is due now.
            $totalPayable = 0.0;

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
                'interest_rate' => $customRate,
                // Interest accrued to date, shown on the receipt. NOT collected here —
                // cash_amount/transfer_amount stay zero, and total_interest_paid credits
                // only money actually received, so this never becomes a phantom credit.
                'interest_amount' => $calculation['total_interest'],
                'handling_fee' => $handlingFee,
                'total_payable' => $totalPayable,
                'payment_method' => $validated['payment_method'] ?? null,
                'cash_amount' => 0,
                'transfer_amount' => 0,
                'bank_id' => $validated['bank_id'] ?? null,
                'account_number' => $validated['account_number'] ?? null,
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

            // Audit log - renewal processed
            try {
                AuditLog::create([
                    'branch_id' => $branchId,
                    'user_id' => $userId,
                    'action' => 'create',
                    'module' => 'renewal',
                    'description' => "Processed renewal {$renewal->renewal_no} for pledge {$pledge->pledge_no} - RM" . number_format($totalPayable, 2),
                    'record_type' => 'Renewal',
                    'record_id' => $renewal->id,
                    'new_values' => [
                        'renewal_no' => $renewal->renewal_no,
                        'pledge_no' => $pledge->pledge_no,
                        'months' => $renewalMonths,
                        'interest_amount' => $calculation['total_interest'],
                        'total_payable' => $totalPayable,
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                    'severity' => 'info',
                    'created_at' => now(),
                ]);
            } catch (\Exception $e) {
                Log::warning('Audit log failed: ' . $e->getMessage());
            }

            // Create notification for renewal
            try {
                $customerName = $pledge->customer->name ?? 'Customer';
                Notification::create([
                    'branch_id' => $branchId,
                    'user_id' => null,
                    'type' => 'info',
                    'title' => 'Pledge Renewed',
                    'message' => "Pledge {$pledge->pledge_no} renewed for {$renewalMonths} month(s) - RM" . number_format($totalPayable, 2),
                    'category' => 'renewal',
                    'action_url' => "/pledges/{$pledge->id}",
                    'is_read' => false,
                    'metadata' => [
                        'renewal_id' => $renewal->id,
                        'renewal_no' => $renewal->renewal_no,
                        'pledge_id' => $pledge->id,
                        'pledge_no' => $pledge->pledge_no,
                        'customer_name' => $customerName,
                        'renewal_months' => $renewalMonths,
                        'total_payable' => $totalPayable,
                        'new_due_date' => $newDueDate->toDateString(),
                        'created_by' => $request->user()->name,
                    ],
                ]);
            } catch (\Exception $e) {
                Log::warning('Notification creation failed: ' . $e->getMessage());
            }

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

    /**
     * Print renewal receipt
     */
    public function printReceipt(Request $request, Renewal $renewal): JsonResponse
    {
        if ($renewal->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        // Load relationships for receipt
        $renewal->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.branch',
            'interestBreakdown',
            'bank',
            'createdBy:id,name'
        ]);

        // Return receipt data
        return $this->success([
            'renewal' => $renewal,
            'receipt_data' => [
                'renewal_no' => $renewal->renewal_no,
                'date' => $renewal->created_at->format('d/m/Y'),
                'time' => $renewal->created_at->format('h:i A'),
                'customer_name' => $renewal->pledge->customer->name,
                'customer_ic' => $renewal->pledge->customer->ic_number,
                'pledge_no' => $renewal->pledge->pledge_no,
                'loan_amount' => number_format($renewal->pledge->loan_amount, 2),
                'renewal_months' => $renewal->renewal_months,
                'previous_due_date' => $renewal->previous_due_date->format('d/m/Y'),
                'new_due_date' => $renewal->new_due_date->format('d/m/Y'),
                'interest_amount' => number_format($renewal->interest_amount, 2),
                'handling_fee' => number_format($renewal->handling_fee, 2),
                'total_payable' => number_format($renewal->total_payable, 2),
                'payment_method' => ucfirst($renewal->payment_method),
                'cash_amount' => number_format($renewal->cash_amount, 2),
                'transfer_amount' => number_format($renewal->transfer_amount, 2),
                'bank_name' => $renewal->bank->name ?? null,
                'reference_no' => $renewal->reference_no,
                'processed_by' => $renewal->createdBy->name,
                'interest_breakdown' => $renewal->interestBreakdown,
            ],
        ], 'Receipt data retrieved');
    }

    /**
     * Send renewal details via WhatsApp
     */
    public function sendWhatsApp(Request $request, Renewal $renewal): JsonResponse
    {
        // Extend time limit for PDF generation + WhatsApp sending
        set_time_limit(120);

        try {
            // Check branch access
            if ($renewal->branch_id !== $request->user()->branch_id) {
                return $this->error('Unauthorized', 403);
            }

            // Load relationships
            $renewal->load(['pledge.customer', 'pledge.branch']);

            // Get WhatsApp configuration
            $config = \App\Models\WhatsAppConfig::where('branch_id', $renewal->branch_id)
                ->where('is_enabled', true)
                ->first();

            if (!$config) {
                return $this->error('WhatsApp not configured for this branch', 400);
            }

            // Build message
            $message = $this->buildRenewalWhatsAppMessage($renewal);

            // Get customer phone with correct country code from database
            $phone = preg_replace('/[^0-9]/', '', $renewal->pledge->customer->phone);
            $countryCode = preg_replace('/[^0-9]/', '', $renewal->pledge->customer->country_code ?? '60');

            // Remove leading 0 from phone if present
            if (substr($phone, 0, 1) === '0') {
                $phone = substr($phone, 1);
            }

            // Add country code 
            $phone = $countryCode . $phone;

            // Load AiSensy template + ordered data map (UltraMsg ignores these)
            $template = \App\Models\WhatsAppTemplate::where('template_key', 'renewal_completed')
                ->where(function ($q) use ($renewal) {
                    $q->where('branch_id', $renewal->branch_id)->orWhereNull('branch_id');
                })
                ->orderBy('branch_id', 'desc')
                ->first();

            $templateData = [
                'renewal_no'    => $renewal->renewal_no,
                'pledge_no'     => $renewal->pledge->pledge_no,
                'date'          => \Carbon\Carbon::parse($renewal->created_at)->format('d/m/Y'),
                'customer_name' => $renewal->pledge->customer->name ?? '',
                'customer_ic'   => $renewal->pledge->customer->ic_number ?? '',
                'loan_amount'   => number_format($renewal->pledge->loan_amount, 2),
                'extended'      => $renewal->renewal_months,
                // total_paid matches the "Total Paid" figure on the existing receipt.
                // interest_paid is also provided in case a template wants the interest line.
                'total_paid'    => number_format($renewal->total_payable, 2),
                'interest_paid' => number_format($renewal->interest_amount, 2),
                'new_due_date'  => \Carbon\Carbon::parse($renewal->new_due_date)->format('d/m/Y'),
            ];

            // Send text message via the shared WhatsApp service
            $result = app(\App\Services\WhatsApp\WhatsAppService::class)
                ->sendText($config, $phone, $message, $template, $templateData, $renewal->pledge->customer->name ?? null);

            if ($result['success']) {
                // Log the message immediately
                \App\Models\WhatsAppLog::create([
                    'branch_id' => $renewal->branch_id,
                    'recipient_phone' => $phone,
                    'recipient_name' => $renewal->pledge->customer->name,
                    'message_content' => $message,
                    'status' => 'sent',
                    'related_type' => 'renewal',
                    'related_id' => $renewal->id,
                    'sent_at' => now(),
                    'sent_by' => $request->user()->id,
                ]);

                // PDF receipt sending temporarily disabled - text-only WhatsApp for renewals
                // try {
                //     Log::info('Starting PDF receipt generation for renewal ' . $renewal->renewal_no);
                //     $pdfResult = $this->sendPdfReceipt($config, $phone, $renewal);
                //     Log::info('PDF receipt result: ' . json_encode($pdfResult));
                //     if (!$pdfResult['success']) {
                //         Log::warning('PDF attachment failed: ' . ($pdfResult['message'] ?? 'Unknown error'));
                //     }
                // }
                // catch (\Exception $pdfError) {
                //     Log::warning('PDF attachment error: ' . $pdfError->getMessage());
                // }

                return $this->success([
                    'message' => 'WhatsApp sent successfully to ' . $phone,
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
     * Build WhatsApp message for renewal
     */
    private function buildRenewalWhatsAppMessage(Renewal $renewal): string
    {
        $companyName = \App\Models\Setting::where('category', 'company')
            ->where('key_name', 'name')
            ->value('value') ?? $renewal->pledge->branch->name ?? 'PAJAK GADAI SDN BHD';

        $message = "*{$companyName}*\n";
        $message .= "🏦 *RENEWAL RECEIPT*\n";
        $message .= "━━━━━━━━━━━━━━━━━━\n\n";
        $message .= "📋 *Renewal No:* {$renewal->renewal_no}\n";
        $message .= "🔖 *Pledge No:* {$renewal->pledge->pledge_no}\n";
        $message .= "📅 *Date:* {$renewal->created_at->format('d/m/Y')}\n\n";
        
        $message .= "*Customer:* {$renewal->pledge->customer->name}\n";
        $message .= "*IC:* {$renewal->pledge->customer->ic_number}\n\n";
        
        $message .= "💰 *Loan Amount:* RM " . number_format($renewal->pledge->loan_amount, 2) . "\n";
        $message .= "⏱️ *Extended:* {$renewal->renewal_months} Month(s)\n";
        $message .= "💵 *Total Paid:* RM " . number_format($renewal->total_payable, 2) . "\n\n";
        
        $message .= "📅 *New Due Date:* {$renewal->new_due_date->format('d/m/Y')}\n\n";
        
        $message .= "━━━━━━━━━━━━━━━━━━\n";
        $message .= "_Thank you for your business!_\n";
        $message .= "_{$renewal->pledge->branch->name}_";

        return $message;
    }

    /**
     * Send PDF receipt via WhatsApp
     */
    private function sendPdfReceipt($config, string $phone, Renewal $renewal): array
    {
        // Extend time limit for PDF generation + upload
        set_time_limit(90);

        try {
            $pdfBase64 = app(\App\Services\WhatsApp\ReceiptPdfBuilder::class)->renewal($renewal);

            $publicUrl = $config->provider === 'aisensy'
                ? \Illuminate\Support\Facades\URL::temporarySignedRoute('whatsapp.receipt', now()->addMinutes(15), ['type' => 'renewal', 'id' => $renewal->id])
                : null;

            return app(\App\Services\WhatsApp\WhatsAppService::class)->sendDocument(
                $config,
                $phone,
                $pdfBase64,
                'Renewal-Receipt-' . $renewal->renewal_no . '.pdf',
                "📄 Renewal Receipt {$renewal->renewal_no}",
                $publicUrl,
                null,
                [],
                $renewal->pledge->customer->name ?? null
            );
        }
        catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}