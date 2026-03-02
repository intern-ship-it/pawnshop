<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Redemption;
use App\Models\Pledge;
use App\Models\PledgeItem;
use App\Models\Slot;
use App\Models\AuditLog;
use App\Models\Notification;
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

        // Search by pledge number (handle barcode scanner format without hyphens)
        if ($search = $request->get('search')) {
            // Normalize: remove hyphens and uppercase
            $searchNormalized = strtoupper(str_replace('-', '', $search));

            $query->whereHas('pledge', function ($q) use ($search, $searchNormalized) {
                $q->where(function ($q2) use ($search, $searchNormalized) {
                        // Match with hyphens (original format)
                        $q2->where('pledge_no', 'like', "%{$search}%")
                            ->orWhere('receipt_no', 'like', "%{$search}%")
                            // Match without hyphens (barcode scanner format)
                            ->orWhereRaw("REPLACE(pledge_no, '-', '') LIKE ?", ["%{$searchNormalized}%"])
                            ->orWhereRaw("REPLACE(receipt_no, '-', '') LIKE ?", ["%{$searchNormalized}%"]);
                    }
                    );
                });
        }

        $redemptions = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($redemptions);
    }

    /**
     * Calculate redemption amount
     * 
     * FIXES:
     * - Issue 1: Now accepts both 'active' and 'overdue' pledges
     * - Issue 2: Supports partial item redemption via item_ids parameter
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'item_ids' => 'nullable|array', // Issue 2: Optional item selection
            'item_ids.*' => 'exists:pledge_items,id',
        ]);

        $branchId = $request->user()->branch_id;

        // Issue 1 FIX: Accept both 'active' and 'overdue' pledges
        $pledge = Pledge::where('id', $validated['pledge_id'])
            ->where('branch_id', $branchId)
            ->whereIn('status', ['active', 'overdue']) // Changed from just 'active'
            ->with(['items' => function ($q) {
            // Only load items that have NOT been redeemed yet
            $q->whereNotIn('status', ['redeemed', 'released'])
                ->with(['category', 'purity', 'vault', 'box', 'slot']);
        }])
            ->first();

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        $monthsElapsed = max(1, $pledge->months_elapsed);
        $daysOverdue = $pledge->days_overdue;

        // Issue 2: Handle partial item selection
        $selectedItemIds = $validated['item_ids'] ?? null;
        $allItems = $pledge->items;

        if ($selectedItemIds && count($selectedItemIds) > 0) {
            // Partial redemption - calculate pro-rata
            $selectedItems = $allItems->whereIn('id', $selectedItemIds);
            $totalNetValue = $allItems->sum('net_value');
            $selectedNetValue = $selectedItems->sum('net_value');

            // Pro-rata loan amount based on selected items value
            $proRataRatio = $totalNetValue > 0 ? ($selectedNetValue / $totalNetValue) : 1;
            $proRataLoanAmount = $pledge->loan_amount * $proRataRatio;

            // Calculate interest on pro-rata loan amount
            $calculation = $this->interestService->calculateRedemption(
                $proRataLoanAmount,
                $monthsElapsed,
                $daysOverdue,
                $pledge->status,
                $pledge->interest_rate,
                $pledge->interest_rate_extended,
                $pledge->interest_rate_overdue
            );

            // Add partial redemption info
            $calculation['is_partial'] = true;
            $calculation['selected_items_count'] = $selectedItems->count();
            $calculation['total_items_count'] = $allItems->count();
            $calculation['selected_net_value'] = round($selectedNetValue, 2);
            $calculation['total_net_value'] = round($totalNetValue, 2);
            $calculation['pro_rata_ratio'] = round($proRataRatio, 4);

            // Add location_string to each item for display
            $itemsWithLocation = $selectedItems->map(function ($item) {
                $item->location_string = $this->buildLocationString($item);
                return $item;
            });

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
                'items' => $itemsWithLocation->values(),
                'all_items' => $allItems->map(function ($item) {
                $item->location_string = $this->buildLocationString($item);
                return $item;
            }),
                'calculation' => $calculation,
            ]);
        }

        // Full redemption (original behavior)
        $calculation = $this->interestService->calculateRedemption(
            $pledge->loan_amount,
            $monthsElapsed,
            $daysOverdue,
            $pledge->status,
            $pledge->interest_rate,
            $pledge->interest_rate_extended,
            $pledge->interest_rate_overdue
        );

        $calculation['is_partial'] = false;

        // Add location_string to each item
        $itemsWithLocation = $allItems->map(function ($item) {
            $item->location_string = $this->buildLocationString($item);
            return $item;
        });

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
            'items' => $itemsWithLocation,
            'all_items' => $itemsWithLocation,
            'calculation' => $calculation,
        ]);
    }

    /**
     * Build location string for an item
     */
    private function buildLocationString($item): ?string
    {
        if ($item->vault_id && $item->vault) {
            $location = $item->vault->code ?? $item->vault->name ?? 'Vault';
            if ($item->box) {
                $location .= ' / Box ' . ($item->box->box_number ?? $item->box->name ?? $item->box_id);
            }
            if ($item->slot) {
                $location .= ' / Slot ' . ($item->slot->slot_number ?? $item->slot_id);
            }
            return $location;
        }
        return null;
    }

    /**
     * Process redemption
     * 
     * FIXES:
     * - Issue 1: Now accepts both 'active' and 'overdue' pledges
     * - Issue 2: Supports partial item redemption
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pledge_id' => 'required|exists:pledges,id',
            'item_ids' => 'nullable|array', // Issue 2: Optional - if empty, redeem all
            'item_ids.*' => 'exists:pledge_items,id',
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

        // Issue 1 FIX: Accept both 'active' and 'overdue' pledges
        $pledge = Pledge::where('id', $validated['pledge_id'])
            ->where('branch_id', $branchId)
            ->whereIn('status', ['active', 'overdue']) // Changed from just 'active'
            ->with(['items' => function ($q) {
            // Only load items that have NOT been redeemed yet
            $q->whereNotIn('status', ['redeemed', 'released']);
        }])
            ->first();

        if (!$pledge) {
            return $this->error('Active pledge not found', 404);
        }

        DB::beginTransaction();

        try {
            $monthsElapsed = max(1, $pledge->months_elapsed);
            $daysOverdue = $pledge->days_overdue;

            // Issue 2: Handle partial item redemption
            $selectedItemIds = $validated['item_ids'] ?? null;
            $allItems = $pledge->items;
            $isPartialRedemption = $selectedItemIds && count($selectedItemIds) > 0 && count($selectedItemIds) < $allItems->count();

            $loanAmountToRedeem = $pledge->loan_amount;
            $selectedItems = $allItems;
            $remainingItems = collect([]);

            if ($isPartialRedemption) {
                $selectedItems = $allItems->whereIn('id', $selectedItemIds);
                $remainingItems = $allItems->whereNotIn('id', $selectedItemIds);

                $totalNetValue = $allItems->sum('net_value');
                $selectedNetValue = $selectedItems->sum('net_value');

                // Pro-rata loan amount
                $proRataRatio = $totalNetValue > 0 ? ($selectedNetValue / $totalNetValue) : 1;
                $loanAmountToRedeem = $pledge->loan_amount * $proRataRatio;
            }

            $calculation = $this->interestService->calculateRedemption(
                $loanAmountToRedeem,
                $monthsElapsed,
                $daysOverdue,
                $pledge->status,
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

            // Create redemption record
            $redemption = Redemption::create([
                'branch_id' => $branchId,
                'pledge_id' => $pledge->id,
                'redemption_no' => $redemptionNo,
                'principal_amount' => round($loanAmountToRedeem, 2),
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
                'is_partial' => $isPartialRedemption,
                'redeemed_item_ids' => $isPartialRedemption ? $selectedItemIds : null,
                'created_by' => $userId,
            ]);

            // Release selected items and their slots
            foreach ($selectedItems as $item) {
                // Release slot
                if ($item->slot_id) {
                    Slot::where('id', $item->slot_id)->update([
                        'is_occupied' => false,
                        'current_item_id' => null,
                        'occupied_at' => null,
                    ]);

                    // Update box occupied count
                    if ($item->box_id) {
                        \App\Models\Box::where('id', $item->box_id)->decrement('occupied_slots');
                    }
                }

                // Update item status
                $item->update([
                    'status' => 'redeemed',
                    'redeemed_at' => now(),
                    'redemption_id' => $redemption->id,
                    'vault_id' => null,
                    'box_id' => null,
                    'slot_id' => null,
                ]);
            }

            // Issue 2: Handle remaining items for partial redemption
            if ($isPartialRedemption && $remainingItems->count() > 0) {
                // Update pledge totals for remaining items
                $remainingNetValue = $remainingItems->sum('net_value');
                $remainingLoanAmount = $pledge->loan_amount - $loanAmountToRedeem;

                $pledge->update([
                    'net_value' => $remainingNetValue,
                    'loan_amount' => round($remainingLoanAmount, 2),
                    'total_weight' => $remainingItems->sum('net_weight'),
                    // Keep status as active/overdue for remaining items
                ]);

            // Note: Remaining items keep their existing barcodes
            // New barcodes could be generated here if business rules require it
            }
            else {
                // Full redemption - update pledge status
                $pledge->update(['status' => 'redeemed']);
            }

            // Update redemption with items released info
            $redemption->update([
                'items_released' => true,
                'released_at' => now(),
                'released_by' => $userId,
            ]);

            // Update customer stats
            $pledge->customer->updateStats();

            DB::commit();

            $redemption->load(['pledge.customer', 'pledge.items']);

            // Audit log
            try {
                $description = $isPartialRedemption
                    ? "Processed partial redemption {$redemption->redemption_no} ({$selectedItems->count()}/{$allItems->count()} items) for pledge {$pledge->pledge_no}"
                    : "Processed full redemption {$redemption->redemption_no} for pledge {$pledge->pledge_no}";

                AuditLog::create([
                    'branch_id' => $branchId,
                    'user_id' => $userId,
                    'action' => 'create',
                    'module' => 'redemption',
                    'description' => $description . " - RM" . number_format($calculation['total_payable'], 2),
                    'record_type' => 'Redemption',
                    'record_id' => $redemption->id,
                    'new_values' => [
                        'redemption_no' => $redemption->redemption_no,
                        'pledge_no' => $pledge->pledge_no,
                        'principal' => $loanAmountToRedeem,
                        'interest' => $calculation['total_interest'],
                        'total_payable' => $calculation['total_payable'],
                        'is_partial' => $isPartialRedemption,
                        'items_redeemed' => $selectedItems->count(),
                        'items_remaining' => $remainingItems->count(),
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => substr($request->userAgent() ?? '', 0, 255),
                    'severity' => 'info',
                    'created_at' => now(),
                ]);
            }
            catch (\Exception $e) {
                Log::warning('Audit log failed: ' . $e->getMessage());
            }

            // Create notification
            try {
                $customerName = $pledge->customer->name ?? 'Customer';
                $title = $isPartialRedemption ? 'Partial Redemption Processed' : 'Pledge Redeemed';
                $message = $isPartialRedemption
                    ? "Pledge {$pledge->pledge_no}: {$selectedItems->count()} item(s) redeemed, {$remainingItems->count()} remaining"
                    : "Pledge {$pledge->pledge_no} fully redeemed by {$customerName}";

                Notification::create([
                    'branch_id' => $branchId,
                    'user_id' => null,
                    'type' => 'success',
                    'title' => $title,
                    'message' => $message . " - RM" . number_format($calculation['total_payable'], 2),
                    'category' => 'redemption',
                    'action_url' => "/pledges/{$pledge->id}",
                    'is_read' => false,
                    'metadata' => [
                        'redemption_id' => $redemption->id,
                        'redemption_no' => $redemption->redemption_no,
                        'pledge_id' => $pledge->id,
                        'pledge_no' => $pledge->pledge_no,
                        'customer_name' => $customerName,
                        'principal' => $loanAmountToRedeem,
                        'interest' => $calculation['total_interest'],
                        'total_payable' => $calculation['total_payable'],
                        'is_partial' => $isPartialRedemption,
                        'created_by' => $request->user()->name,
                    ],
                ]);
            }
            catch (\Exception $e) {
                Log::warning('Notification creation failed: ' . $e->getMessage());
            }

            return $this->success([
                'redemption' => $redemption,
                'is_partial' => $isPartialRedemption,
                'items_redeemed' => $selectedItems->count(),
                'items_remaining' => $remainingItems->count(),
            ], 'Redemption processed successfully', 201);

        }
        catch (\Exception $e) {
            DB::rollBack();
            Log::error('Redemption failed: ' . $e->getMessage());
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
     * Release items (after redemption) - kept for backwards compatibility
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
            // Get items to release (check if partial redemption)
            $itemsToRelease = $redemption->redeemed_item_ids
                ? $redemption->pledge->items->whereIn('id', $redemption->redeemed_item_ids)
                : $redemption->pledge->items;

            foreach ($itemsToRelease as $item) {
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

        }
        catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to release items: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Send redemption details via WhatsApp
     */
    public function sendWhatsApp(Request $request, Redemption $redemption): JsonResponse
    {
        try {
            // Check branch access
            if ($redemption->branch_id !== $request->user()->branch_id) {
                return $this->error('Unauthorized', 403);
            }

            // Load relationships
            $redemption->load(['pledge.customer', 'pledge.items.category', 'pledge.items.purity', 'pledge.branch', 'bank', 'createdBy']);

            $pledge = $redemption->pledge;

            // Get WhatsApp configuration
            $config = \App\Models\WhatsAppConfig::where('branch_id', $redemption->branch_id)
                ->where('is_enabled', true)
                ->first();

            if (!$config) {
                return $this->error('WhatsApp not configured for this branch', 400);
            }

            // Build redemption message
            $message = $this->buildRedemptionWhatsAppMessage($redemption);

            // Get customer phone with correct country code from database
            $phone = preg_replace('/[^0-9]/', '', $pledge->customer->phone);
            $countryCode = preg_replace('/[^0-9]/', '', $pledge->customer->country_code ?? '60');

            // Remove leading 0 from phone if present
            if (substr($phone, 0, 1) === '0') {
                $phone = substr($phone, 1);
            }

            // Add country code (use stored country_code, default to 60 for Malaysia)
            $phone = $countryCode . $phone;

            // Send text message via configured provider
            $result = $this->sendViaProvider($config, $phone, $message);

            if ($result['success']) {
                // Also send PDF redemption receipt as document
                try {
                    $pdfResult = $this->sendRedemptionPdfReceipt($config, $phone, $redemption);
                    if (!$pdfResult['success']) {
                        Log::warning('Redemption PDF attachment failed: ' . ($pdfResult['message'] ?? 'Unknown error'));
                    }
                }
                catch (\Exception $pdfError) {
                    Log::warning('Redemption PDF attachment error: ' . $pdfError->getMessage());
                }

                // Log the message
                \App\Models\WhatsAppLog::create([
                    'branch_id' => $redemption->branch_id,
                    'recipient_phone' => $phone,
                    'recipient_name' => $pledge->customer->name,
                    'message_content' => $message,
                    'status' => 'sent',
                    'related_type' => 'redemption',
                    'related_id' => $redemption->id,
                    'sent_at' => now(),
                    'sent_by' => $request->user()->id,
                ]);

                return $this->success([
                    'message' => 'Redemption WhatsApp sent successfully to ' . $phone,
                ]);
            }
            else {
                return $this->error($result['message'] ?? 'Failed to send WhatsApp', 500);
            }

        }
        catch (\Exception $e) {
            Log::error('Redemption WhatsApp sending failed: ' . $e->getMessage());
            return $this->error('Failed to send WhatsApp: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Build WhatsApp message for redemption
     */
    private function buildRedemptionWhatsAppMessage(Redemption $redemption): string
    {
        $pledge = $redemption->pledge;

        $items = $pledge->items->map(function ($item) {
            return "• {$item->category->name_en} ({$item->purity->code}) - {$item->net_weight}g";
        })->join("\n");

        $isPartial = $redemption->is_partial;

        $message = "✅ *REDEMPTION RECEIPT*\n";
        $message .= "━━━━━━━━━━━━━━━━━━\n\n";
        $message .= "📋 *Redemption No:* {$redemption->redemption_no}\n";
        $message .= "📋 *Pledge No:* {$pledge->pledge_no}\n";
        $message .= "📅 *Date:* {$redemption->created_at->format('d/m/Y H:i')}\n\n";
        $message .= "*Customer:* {$pledge->customer->name}\n";
        $message .= "*IC:* {$pledge->customer->ic_number}\n\n";

        if ($isPartial) {
            $message .= "⚠️ *Partial Redemption*\n\n";
        }

        $message .= "📦 *Items Released:*\n{$items}\n\n";
        $message .= "💰 *Principal:* RM " . number_format($redemption->principal_amount, 2) . "\n";
        $message .= "📊 *Interest:* RM " . number_format($redemption->interest_amount, 2) . "\n";

        if ($redemption->handling_fee > 0) {
            $message .= "🧾 *Handling Fee:* RM " . number_format($redemption->handling_fee, 2) . "\n";
        }

        $message .= "💵 *Total Paid:* RM " . number_format($redemption->total_payable, 2) . "\n\n";

        $paymentInfo = '';
        if ($redemption->cash_amount > 0) {
            $paymentInfo .= "Cash: RM " . number_format($redemption->cash_amount, 2);
        }
        if ($redemption->transfer_amount > 0) {
            if ($paymentInfo)
                $paymentInfo .= " | ";
            $paymentInfo .= "Transfer: RM " . number_format($redemption->transfer_amount, 2);
        }
        if ($paymentInfo) {
            $message .= "💳 *Payment:* {$paymentInfo}\n\n";
        }

        $message .= "━━━━━━━━━━━━━━━━━━\n";
        $message .= "_Your items have been released._\n";
        $message .= "_Thank you for your business!_\n";
        $message .= "_{$pledge->branch->name}_";

        return $message;
    }

    /**
     * Send redemption PDF receipt via WhatsApp
     */
    private function sendRedemptionPdfReceipt($config, string $phone, Redemption $redemption): array
    {
        try {
            $redemption->load([
                'pledge.customer',
                'pledge.items.category',
                'pledge.items.purity',
                'pledge.branch',
            ]);

            // Build company settings
            $settingsMap = [];
            try {
                $companySettings = \App\Models\Setting::where('category', 'company')->get();
                $receiptSettings = \App\Models\Setting::where('category', 'receipt')->get();
                foreach ($companySettings as $setting) {
                    $settingsMap[$setting->key_name] = $setting->value;
                }
                foreach ($receiptSettings as $setting) {
                    $settingsMap['receipt_' . $setting->key_name] = $setting->value;
                }
            }
            catch (\Exception $e) {
            // Settings table may not exist
            }

            // Resolve logo URL
            $logoUrl = $settingsMap['logo'] ?? $settingsMap['logo_url'] ?? $settingsMap['company_logo'] ?? null;
            if ($logoUrl && !str_starts_with($logoUrl, 'http') && !str_starts_with($logoUrl, 'data:')) {
                $path = ltrim($logoUrl, '/');
                $logoUrl = str_starts_with($path, 'storage/') ? url($path) : url('storage/' . $path);
            }

            $branch = $redemption->pledge->branch;
            $settings = [
                'company_name' => $settingsMap['name'] ?? $branch->name ?? 'PAJAK GADAI SDN BHD',
                'company_name_chinese' => $settingsMap['name_chinese'] ?? '',
                'company_name_tamil' => $settingsMap['name_tamil'] ?? '',
                'registration_no' => $settingsMap['registration_no'] ?? '',
                'license_no' => $settingsMap['license_no'] ?? $branch->license_no ?? '',
                'established_year' => $settingsMap['established_year'] ?? '',
                'address' => $settingsMap['address'] ?? $branch->address ?? '',
                'phone' => $settingsMap['phone'] ?? $branch->phone ?? '',
                'phone2' => $settingsMap['phone2'] ?? '',
                'fax' => $settingsMap['fax'] ?? '',
                'business_hours' => $settingsMap['business_hours'] ?? '8.30AM - 6.00PM',
                'business_days' => $settingsMap['business_days'] ?? 'ISNIN - AHAD',
                'closed_days' => $settingsMap['closed_days'] ?? '',
                'redemption_period' => $settingsMap['receipt_redemption_period'] ?? $settingsMap['redemption_period'] ?? '6 BULAN',
                'interest_rate_normal' => $settingsMap['receipt_interest_rate_normal'] ?? $settingsMap['interest_rate_normal'] ?? '1.5',
                'interest_rate_overdue' => $settingsMap['receipt_interest_rate_overdue'] ?? $settingsMap['interest_rate_overdue'] ?? '2.0',
                'logo_url' => $logoUrl,
            ];

            $data = [
                'redemption' => $redemption,
                'settings' => $settings,
                'printed_at' => now(),
                'printed_by' => 'WhatsApp',
            ];

            // Generate PDF using pre-printed redemption template
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.redemption-receipt-preprinted', $data);
            $pdf->setPaper([0, 0, 595.28, 419.53], 'landscape'); // A5 landscape
            $pdfContent = $pdf->output();
            $pdfBase64 = base64_encode($pdfContent);

            // Send via Ultramsg document API
            if ($config->provider === 'ultramsg') {
                $response = \Illuminate\Support\Facades\Http::withoutVerifying()
                    ->post(
                    "https://api.ultramsg.com/{$config->instance_id}/messages/document",
                [
                    'token' => $config->api_token,
                    'to' => $phone,
                    'document' => 'data:application/pdf;base64,' . $pdfBase64,
                    'filename' => "Redemption-Receipt-{$redemption->redemption_no}.pdf",
                    'caption' => "📄 Redemption Receipt {$redemption->redemption_no}",
                ]
                );

                if ($response->successful()) {
                    $responseData = $response->json();
                    if (isset($responseData['sent']) && $responseData['sent'] === 'true') {
                        return ['success' => true];
                    }
                    return ['success' => false, 'message' => $responseData['message'] ?? 'Document send failed'];
                }

                return ['success' => false, 'message' => 'Document API request failed: ' . $response->status()];
            }

            return ['success' => false, 'message' => 'PDF sending not supported for this provider'];

        }
        catch (\Exception $e) {
            Log::error('Redemption PDF receipt generation failed: ' . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Send message via configured provider
     */
    private function sendViaProvider($config, string $phone, string $message): array
    {
        switch ($config->provider) {
            case 'ultramsg':
                return $this->sendViaUltramsg($config, $phone, $message);
            default:
                return ['success' => false, 'message' => 'Provider not supported'];
        }
    }

    private function sendViaUltramsg($config, string $phone, string $message): array
    {
        try {
            $response = \Illuminate\Support\Facades\Http::withoutVerifying()
                ->post(
                "https://api.ultramsg.com/{$config->instance_id}/messages/chat",
            [
                'token' => $config->api_token,
                'to' => $phone,
                'body' => $message,
            ]
            );

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['sent']) && $data['sent'] === 'true') {
                    return ['success' => true];
                }
                return ['success' => false, 'message' => $data['message'] ?? 'Failed to send'];
            }

            return ['success' => false, 'message' => 'API request failed: ' . $response->status()];
        }
        catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}