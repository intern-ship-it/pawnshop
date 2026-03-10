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
        if ($type === 'percentage') {
            $handlingFee = $principal * ($value / 100);
            if ($handlingFee < $min)
                $handlingFee = $min;
        } else {
            $handlingFee = $value;
        }
        $handlingFee = round($handlingFee, 2);

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
            if ($type === 'percentage') {
                $handlingFee = $principal * ($value / 100);
                if ($handlingFee < $min)
                    $handlingFee = $min;
            } else {
                $handlingFee = $value;
            }
            $handlingFee = round($handlingFee, 2);

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

            // Send text message via configured provider
            $result = $this->sendViaProvider($config, $phone, $message);

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

                // Send PDF receipt inline (app()->terminating doesn't fire reliably on all servers)
                try {
                    Log::info('Starting PDF receipt generation for renewal ' . $renewal->renewal_no);
                    $pdfResult = $this->sendPdfReceipt($config, $phone, $renewal);
                    Log::info('PDF receipt result: ' . json_encode($pdfResult));
                    if (!$pdfResult['success']) {
                        Log::warning('PDF attachment failed: ' . ($pdfResult['message'] ?? 'Unknown error'));
                    }
                }
                catch (\Exception $pdfError) {
                    Log::warning('PDF attachment error: ' . $pdfError->getMessage());
                }

                return $this->success([
                    'message' => 'WhatsApp sent successfully to ' . $phone,
                ]);
            }
            else {
                return $this->error($result['message'] ?? 'Failed to send WhatsApp', 500);
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
        $message = "🏦 *RENEWAL RECEIPT*\n";
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
     * Send message via configured provider
     */
    private function sendViaProvider($config, string $phone, string $message): array
    {
        switch ($config->provider) {
            case 'ultramsg':
                return $this->sendViaUltramsg($config, $phone, $message);
            case 'twilio':
                return $this->sendViaTwilio($config, $phone, $message);
            case 'wati':
                return $this->sendViaWati($config, $phone, $message);
            default:
                return ['success' => false, 'message' => 'Unknown provider'];
        }
    }

    private function sendViaUltramsg($config, string $phone, string $message): array
    {
        try {
            // Disable SSL verification for development (Windows SSL cert issue)
            $response = \Illuminate\Support\Facades\Http::withoutVerifying()
                ->post(
                "https://api.ultramsg.com/{$config->instance_id}/messages/chat",
            [
                'token' => $config->api_token,
                'to' => $phone,
                'body' => $message,
            ]
            );

            $data = $response->json();

            if ($response->successful()) {
                if (isset($data['sent']) && $data['sent'] === 'true') {
                    return ['success' => true];
                }
                return ['success' => false, 'message' => $data['message'] ?? 'Failed to send'];
            }

            // Extract descriptive error from response body
            $errorMessage = $data['error'] ?? $data['message'] ?? ('API request failed: ' . $response->status());
            return ['success' => false, 'message' => $errorMessage];
        }
        catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function sendViaTwilio($config, string $phone, string $message): array
    {
        return ['success' => false, 'message' => 'Twilio not yet implemented'];
    }

    private function sendViaWati($config, string $phone, string $message): array
    {
        return ['success' => false, 'message' => 'WATI not yet implemented'];
    }

    /**
     * Send PDF receipt via WhatsApp
     */
    private function sendPdfReceipt($config, string $phone, Renewal $renewal): array
    {
        // Extend time limit for PDF generation + upload
        set_time_limit(90);

        try {
            // Get company settings
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

            // Resolve logo as base64 data URI
            $logoUrl = $settingsMap['logo'] ?? $settingsMap['logo_url'] ?? $settingsMap['company_logo'] ?? null;
            if ($logoUrl && !str_starts_with($logoUrl, 'data:')) {
                $logoPath = $logoUrl;
                if (str_starts_with($logoPath, 'http')) {
                    $parsed = parse_url($logoPath);
                    $logoPath = ltrim($parsed['path'] ?? '', '/');
                }
                $logoPath = ltrim($logoPath, '/');
                $localPath = str_starts_with($logoPath, 'storage/')
                    ? storage_path('app/public/' . substr($logoPath, 8))
                    : public_path($logoPath);
                if (file_exists($localPath)) {
                    $mime = mime_content_type($localPath);
                    $logoUrl = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($localPath));
                } else {
                    $logoUrl = null;
                }
            }

            $settings = [
                'company_name' => $settingsMap['name'] ?? $renewal->pledge->branch->name ?? 'PAJAK GADAI SDN BHD',
                'company_name_chinese' => $settingsMap['name_chinese'] ?? '',
                'company_name_tamil' => $settingsMap['name_tamil'] ?? '',
                'registration_no' => $settingsMap['registration_no'] ?? '',
                'license_no' => $settingsMap['license_no'] ?? $renewal->pledge->branch->license_no ?? '',
                'established_year' => $settingsMap['established_year'] ?? '',
                'address' => $settingsMap['address'] ?? $renewal->pledge->branch->address ?? '',
                'phone' => $settingsMap['phone'] ?? $renewal->pledge->branch->phone ?? '',
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

            $terms = [];
            try {
                $terms = \App\Models\TermsCondition::getForActivity('pledge', $renewal->branch_id) ?? [];
            }
            catch (\Exception $e) {
                $terms = [];
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

            // Generate barcode data URI
            $generator = new \Picqer\Barcode\BarcodeGeneratorPNG();
            $barcodeDataUri = 'data:image/png;base64,' . base64_encode(
                $generator->getBarcode($renewal->pledge->pledge_no, $generator::TYPE_CODE_128, 4, 100)
            );

            // Generate multilang image URI (Chinese/Tamil company name)
            // Always load static image if it exists — settings may default to empty strings
            $multilangUri = null;
            $staticImage = storage_path('fonts/multilang_header.png');
            if (file_exists($staticImage)) {
                $mime = mime_content_type($staticImage);
                $multilangUri = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($staticImage));
            }

            $data = [
                'renewal' => $renewal,
                'pledge' => $renewal->pledge,
                'copy_type' => 'customer',
                'settings' => $settings,
                'terms' => $terms,
                'printed_at' => now(),
                'printed_by' => 'WhatsApp',
                'barcode_data_uri' => $barcodeDataUri,
                'multilang_image_uri' => $multilangUri,
            ];

            // Generate PDF
            Log::info('Generating PDF for renewal ' . $renewal->renewal_no . ' using view pdf.renewal-receipt-preprinted');
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.renewal-receipt-preprinted', $data);
            $pdf->setPaper([0.0, 0.0, 710.0, 450.0]); 
            $pdfContent = $pdf->output();
            $pdfBase64 = base64_encode($pdfContent);

            Log::info('PDF generated successfully for renewal. Size: ' . strlen($pdfContent) . ' bytes');

            // Send via Ultramsg document API
            if ($config->provider === 'ultramsg') {
                $response = \Illuminate\Support\Facades\Http::withoutVerifying()
                    ->timeout(60)
                    ->post(
                    "https://api.ultramsg.com/{$config->instance_id}/messages/document",
                [
                    'token' => $config->api_token,
                    'to' => $phone,
                    'document' => 'data:application/pdf;base64,' . $pdfBase64,
                    'filename' => 'Renewal-Receipt-' . $renewal->renewal_no . '.pdf',
                ]
                );

                $responseData = $response->json();
                Log::info('Ultramsg document API response for renewal: status=' . $response->status() . ' body=' . substr($response->body(), 0, 500));

                if ($response->successful()) {
                    // Ultramsg may return sent as string "true" or boolean true
                    $sent = $responseData['sent'] ?? null;
                    if ($sent === 'true' || $sent === true || isset($responseData['id'])) {
                        return ['success' => true];
                    }
                    return ['success' => false, 'message' => $responseData['message'] ?? $responseData['error'] ?? 'Failed to send PDF: ' . json_encode($responseData)];
                }

                $errorMessage = $responseData['error'] ?? $responseData['message'] ?? ('API request failed: ' . $response->status());
                return ['success' => false, 'message' => $errorMessage];
            }

            return ['success' => false, 'message' => 'Provider not supported for PDF'];
        }
        catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}