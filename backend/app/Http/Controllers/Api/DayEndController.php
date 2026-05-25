<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashAdjustment;
use App\Models\DayEndReport;
use App\Models\DayEndVerification;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use App\Models\PledgeItem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DayEndController extends Controller
{
    /**
     * Check if user can access the given branch
     * Admin and Super Admin can access any branch
     */
    private function canAccessBranch(Request $request, $branchId): bool
    {
        $user = $request->user();

        // Load role if not loaded
        if (!$user->relationLoaded('role')) {
            $user->load('role');
        }

        // Admin and Super Admin can access any branch
        if ($user->isAdmin()) {
            return true;
        }

        return $user->branch_id == $branchId;
    }
    /**
     * List all day-end reports
     */
    public function index(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $reports = DayEndReport::where('branch_id', $branchId)
            ->with(['closedBy:id,name'])
            ->orderBy('report_date', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($reports);
    }

    /**
     * Get current day's report or create new
     */
    public function current(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $today = Carbon::today();

        $report = DayEndReport::where('branch_id', $branchId)
            ->whereDate('report_date', $today)
            ->first();

        if (!$report) {
            // Generate current stats
            $stats = $this->calculateDayStats($branchId, $today);

            return $this->success([
                'report' => null,
                'stats' => $stats,
                'suggested_opening_balance' => $this->getSuggestedOpeningBalance($branchId, $today),
                'message' => 'No day-end report started yet for today',
            ]);
        }

        $report->load(['verifications', 'closedBy:id,name', 'cashAdjustments.createdBy:id,name', 'cashAdjustments.voidedBy:id,name']);

        // Also include purity breakdown and transaction details (calculated on the fly)
        $purityBreakdown = $this->calculatePurityBreakdown($branchId, $today);
        $stats = $this->calculateDayStats($branchId, $today);

        // While the day is still open, overlay live counts/amounts onto the report
        // so transactions created AFTER the report was opened are reflected.
        if ($report->status !== 'closed') {
            $this->overlayLiveStats($report, $stats);
        }

        return $this->success([
            'report' => $report,
            'items_in_by_purity' => $purityBreakdown['items_in_by_purity'],
            'items_out_by_purity' => $purityBreakdown['items_out_by_purity'],
            'pledges_detail' => $stats['pledges_detail'] ?? [],
            'redemptions_detail' => $stats['redemptions_detail'] ?? [],
            'renewals_detail' => $stats['renewals_detail'] ?? [],
            'cash_adjustments' => $report->cashAdjustments->sortBy('created_at')->values(),
            'cash_adjustments_totals' => $this->sumCashAdjustments($report),
        ]);
    }

    /**
     * Get report by date
     */
    public function byDate(Request $request, string $date): JsonResponse
    {
        $branchId = $request->user()->branch_id;

        $report = DayEndReport::where('branch_id', $branchId)
            ->whereDate('report_date', $date)
            ->with(['verifications', 'closedBy:id,name'])
            ->first();

        if (!$report) {
            // No report exists - return calculated stats instead of 404
            $stats = $this->calculateDayStats($branchId, $date);

            return $this->success([
                'report' => null,
                'stats' => $stats,
                'suggested_opening_balance' => $this->getSuggestedOpeningBalance($branchId, $date),
                'report_date' => $date,
                'message' => 'No day-end report exists for this date',
            ]);
        }

        // Include purity breakdown and transaction details alongside report
        $purityBreakdown = $this->calculatePurityBreakdown($branchId, $date);
        $stats = $this->calculateDayStats($branchId, $date);

        // While the day is still open, overlay live counts/amounts onto the report.
        if ($report->status !== 'closed') {
            $this->overlayLiveStats($report, $stats);
        }

        $report->load(['cashAdjustments.createdBy:id,name', 'cashAdjustments.voidedBy:id,name']);

        return $this->success([
            'report' => $report,
            'items_in_by_purity' => $purityBreakdown['items_in_by_purity'],
            'items_out_by_purity' => $purityBreakdown['items_out_by_purity'],
            'pledges_detail' => $stats['pledges_detail'] ?? [],
            'redemptions_detail' => $stats['redemptions_detail'] ?? [],
            'renewals_detail' => $stats['renewals_detail'] ?? [],
            'cash_adjustments' => $report->cashAdjustments->sortBy('created_at')->values(),
            'cash_adjustments_totals' => $this->sumCashAdjustments($report),
        ]);
    }

    /**
     * Create item_in / item_out / amount verification rows for a newly-opened report.
     * Extracted so both manual open() and auto ensureOpen() share the same logic.
     */
    private function createVerificationsForReport(DayEndReport $report, int $branchId, $date, array $stats): void
    {
        // Items in (from pledges)
        $pledges = Pledge::where('branch_id', $branchId)
            ->whereDate('pledge_date', $date)
            ->with('items')
            ->get();

        foreach ($pledges as $pledge) {
            foreach ($pledge->items as $item) {
                DayEndVerification::create([
                    'day_end_id'        => $report->id,
                    'verification_type' => 'item_in',
                    'related_type'      => 'Pledge',
                    'related_id'        => $pledge->id,
                    'item_description'  => sprintf('%s - %s', $pledge->pledge_no, $item->barcode),
                    'expected_amount'   => $item->net_value,
                    'is_verified'       => false,
                ]);
            }
        }

        // Items out (from redemptions)
        $redemptions = Redemption::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->with('pledge.items')
            ->get();

        foreach ($redemptions as $redemption) {
            foreach ($redemption->pledge->items as $item) {
                DayEndVerification::create([
                    'day_end_id'        => $report->id,
                    'verification_type' => 'item_out',
                    'related_type'      => 'Pledge',
                    'related_id'        => $redemption->pledge->id,
                    'item_description'  => sprintf('%s - %s', $redemption->pledge->pledge_no, $item->barcode),
                    'expected_amount'   => $item->net_value,
                    'is_verified'       => false,
                ]);
            }
        }

        // Amount verifications (skip zero-amount rows)
        $totalCash = $stats['pledges']['cash'] + $stats['renewals']['cash'] + $stats['redemptions']['cash'];
        if ($totalCash > 0) {
            DayEndVerification::create([
                'day_end_id'        => $report->id,
                'verification_type' => 'amount',
                'related_type'      => 'cash_total',
                'item_description'  => 'Total Cash',
                'expected_amount'   => $totalCash,
                'is_verified'       => false,
            ]);
        }

        $totalTransfer = $stats['pledges']['transfer'] + $stats['renewals']['transfer'] + $stats['redemptions']['transfer'];
        if ($totalTransfer > 0) {
            DayEndVerification::create([
                'day_end_id'        => $report->id,
                'verification_type' => 'amount',
                'related_type'      => 'transfer_total',
                'item_description'  => 'Total Transfer',
                'expected_amount'   => $totalTransfer,
                'is_verified'       => false,
            ]);
        }
    }

    /**
     * Sum active (non-voided) cash adjustments grouped by type.
     */
    private function sumCashAdjustments(DayEndReport $report): array
    {
        $active = $report->cashAdjustments->where('voided', false);

        return [
            'injections'  => (float) $active->where('type', CashAdjustment::TYPE_INJECTION)->sum('amount'),
            'withdrawals' => (float) $active->where('type', CashAdjustment::TYPE_WITHDRAWAL)->sum('amount'),
        ];
    }

    /**
     * Overlay live calculated stats onto an open day-end report so newly-created
     * transactions (after the report was opened) are reflected. Does not persist.
     */
    private function overlayLiveStats(DayEndReport $report, array $stats): void
    {
        $report->new_pledges_count    = $stats['pledges']['count'];
        $report->new_pledges_amount   = $stats['pledges']['total'];
        $report->new_pledges_cash     = $stats['pledges']['cash'];
        $report->new_pledges_transfer = $stats['pledges']['transfer'];
        $report->renewals_count       = $stats['renewals']['count'];
        $report->renewals_amount      = $stats['renewals']['total'];
        $report->renewals_cash        = $stats['renewals']['cash'];
        $report->renewals_transfer    = $stats['renewals']['transfer'];
        $report->redemptions_count    = $stats['redemptions']['count'];
        $report->redemptions_amount   = $stats['redemptions']['total'];
        $report->redemptions_cash     = $stats['redemptions']['cash'];
        $report->redemptions_transfer = $stats['redemptions']['transfer'];
        $report->items_in_count       = $stats['items_in'];
        $report->items_out_count      = $stats['items_out'];
    }

    /**
     * Get the suggested opening balance for a given date:
     * the closing_balance of the most recent prior day-end report,
     * or 0 if none exists.
     */
    private function getSuggestedOpeningBalance(int $branchId, $date): float
    {
        $prior = DayEndReport::where('branch_id', $branchId)
            ->whereDate('report_date', '<', $date)
            ->orderBy('report_date', 'desc')
            ->first();

        if (!$prior) {
            return 0.0;
        }

        return $prior->closing_balance !== null
            ? (float) $prior->closing_balance
            : (float) $prior->opening_balance;
    }

    /**
     * Open/Start day-end process
     */
    public function open(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;
        $today = Carbon::today();

        // Check if already exists
        $existing = DayEndReport::where('branch_id', $branchId)
            ->whereDate('report_date', $today)
            ->first();

        if ($existing) {
            return $this->error('Day-end report already exists for today', 422);
        }

        DB::beginTransaction();

        try {
            // Calculate today's stats
            $stats = $this->calculateDayStats($branchId, $today);

            // Auto-carry opening balance from prior day's closing balance
            // unless explicitly overridden in the request.
            $providedOpening = $request->input('opening_balance');
            $openingBalance = $providedOpening !== null && $providedOpening !== ''
                ? (float) $providedOpening
                : $this->getSuggestedOpeningBalance($branchId, $today);

            // Create report
            $report = DayEndReport::create([
                'branch_id' => $branchId,
                'report_date' => $today,
                'opening_balance' => $openingBalance,
                'new_pledges_count' => $stats['pledges']['count'],
                'new_pledges_amount' => $stats['pledges']['total'],
                'new_pledges_cash' => $stats['pledges']['cash'],
                'new_pledges_transfer' => $stats['pledges']['transfer'],
                'renewals_count' => $stats['renewals']['count'],
                'renewals_amount' => $stats['renewals']['total'],
                'renewals_cash' => $stats['renewals']['cash'],
                'renewals_transfer' => $stats['renewals']['transfer'],
                'redemptions_count' => $stats['redemptions']['count'],
                'redemptions_amount' => $stats['redemptions']['total'],
                'redemptions_cash' => $stats['redemptions']['cash'],
                'redemptions_transfer' => $stats['redemptions']['transfer'],
                'items_in_count' => $stats['items_in'],
                'items_out_count' => $stats['items_out'],
                'status' => 'open',
            ]);

            $this->createVerificationsForReport($report, $branchId, $today, $stats);

            DB::commit();

            $report->load('verifications');

            return $this->success($report, 'Day-end process started', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to start day-end: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get verification items
     */
    public function verifications(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Unauthorized', 403);
        }

        $verifications = $dayEndReport->verifications()
            ->with(['verifiedBy:id,name'])
            ->get()
            ->groupBy('verification_type');

        return $this->success($verifications);
    }

    /**
     * Verify single item
     */
    public function verifyItem(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Unauthorized', 403);
        }

        if ($dayEndReport->status === 'closed') {
            return $this->error('Day-end is already closed; verifications are locked', 422);
        }

        $verificationId = $request->input('verification_id');
        $verification = DayEndVerification::find($verificationId);

        if (!$verification || (int) $verification->day_end_id !== (int) $dayEndReport->id) {
            return $this->error('Verification does not belong to this report', 422);
        }

        $verified = $request->boolean('is_verified', true);
        $notes = $request->get('notes');

        $verification->update([
            'is_verified' => $verified,
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
            'notes' => $notes,
        ]);

        // Check if all items verified
        $this->updateVerificationStatus($dayEndReport);

        return $this->success($verification, 'Item verified');
    }

    /**
     * Verify amount
     */
    public function verifyAmount(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'verification_id' => 'required|exists:day_end_verifications,id',
            'actual_amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $verification = DayEndVerification::find($validated['verification_id']);

        if ($verification->day_end_id !== $dayEndReport->id) {
            return $this->error('Verification does not belong to this report', 422);
        }

        $isMatch = abs($verification->expected_amount - $validated['actual_amount']) < 0.01;

        $verification->update([
            'is_verified' => $isMatch,
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
            'notes' => $validated['notes'] ?? ($isMatch ? null : 'Amount mismatch: expected ' . $verification->expected_amount . ', got ' . $validated['actual_amount']),
        ]);

        // Check if all amounts verified
        $this->updateVerificationStatus($dayEndReport);

        return $this->success([
            'verification' => $verification,
            'is_match' => $isMatch,
            'difference' => round($validated['actual_amount'] - $verification->expected_amount, 2),
        ]);
    }

    /**
     * Close day-end
     */
    public function close(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Unauthorized', 403);
        }

        if ($dayEndReport->status === 'closed') {
            return $this->error('Day-end already closed', 422);
        }

        // Check if all verifications done
        $unverified = $dayEndReport->verifications()->where('is_verified', false)->count();

        $forceClose = $request->boolean('force_close', false);

        if ($unverified > 0 && !$forceClose) {
            return $this->error("Cannot close: $unverified items not verified. Use force_close=true to override.", 422);
        }

        $closingBalance = $request->input('closing_balance');

        $dayEndReport->update([
            'status' => 'closed',
            'closing_balance' => $closingBalance !== null && $closingBalance !== ''
                ? (float) $closingBalance
                : null,
            'closed_by' => $request->user()->id,
            'closed_at' => now(),
            'notes' => $request->get('notes'),
        ]);

        return $this->success($dayEndReport, 'Day-end closed successfully');
    }

    /**
     * Send WhatsApp summary
     */
    public function sendWhatsApp(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Unauthorized', 403);
        }

        // TODO: Integrate with WhatsApp service
        $dayEndReport->update([
            'whatsapp_sent' => true,
            'whatsapp_sent_at' => now(),
        ]);

        return $this->success(null, 'WhatsApp summary sent');
    }

    /**
     * Print day-end report
     */
    public function print(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Unauthorized', 403);
        }

        $dayEndReport->update([
            'report_printed' => true,
        ]);

        // TODO: Generate PDF
        return $this->success([
            'print_url' => null, // Would be PDF URL
        ]);
    }

    /**
     * Export day-end report (CSV)
     */
    public function export(Request $request): mixed
    {
        $branchId = $request->user()->branch_id;
        $date = $request->get('date', Carbon::today()->toDateString());

        // Get report or calculate stats
        $report = DayEndReport::where('branch_id', $branchId)
            ->whereDate('report_date', $date)
            ->with(['verifications.verifiedBy', 'closedBy'])
            ->first();

        $stats = null;
        if (!$report) {
            $stats = $this->calculateDayStats($branchId, $date);
        }

        // Generate CSV
        $output = fopen('php://temp', 'r+');

        // Header
        fputcsv($output, ['Day End Report', $date]);
        fputcsv($output, ['Status', $report ? ucfirst($report->status) : 'Not Started']);
        fputcsv($output, []); // Empty line

        // Transaction Summary
        fputcsv($output, ['--- TRANSACTION SUMMARY ---']);
        fputcsv($output, ['Type', 'Count', 'Amount']);

        if ($report) {
            fputcsv($output, ['New Pledges', $report->new_pledges_count, number_format($report->new_pledges_amount, 2)]);
            fputcsv($output, ['Renewals', $report->renewals_count, number_format($report->renewals_amount, 2)]);
            fputcsv($output, ['Redemptions', $report->redemptions_count, number_format($report->redemptions_amount, 2)]);
        } else {
            fputcsv($output, ['New Pledges', $stats['pledges']['count'], number_format($stats['pledges']['total'], 2)]);
            fputcsv($output, ['Renewals', $stats['renewals']['count'], number_format($stats['renewals']['total'], 2)]);
            fputcsv($output, ['Redemptions', $stats['redemptions']['count'], number_format($stats['redemptions']['total'], 2)]);
        }
        fputcsv($output, []);

        // Cash Flow
        fputcsv($output, ['--- CASH FLOW ---']);

        $cashIn = $report ? ($report->renewals_amount + $report->redemptions_amount) : ($stats['renewals']['total'] + $stats['redemptions']['total']);
        $cashOut = $report ? $report->new_pledges_amount : $stats['pledges']['total'];
        $netFlow = $cashIn - $cashOut;

        fputcsv($output, ['Cash In (Received)', number_format($cashIn, 2)]);
        fputcsv($output, ['Cash Out (Disbursed)', number_format($cashOut, 2)]);
        fputcsv($output, ['Net Cash Flow', number_format($netFlow, 2)]);

        if ($report) {
            fputcsv($output, ['Opening Balance', number_format($report->opening_balance, 2)]);
            fputcsv($output, ['Closing Balance', $report->closing_balance ? number_format($report->closing_balance, 2) : '-']);

            if ($report->closing_balance) {
                $expected = $report->opening_balance + $netFlow;
                $variance = $report->closing_balance - $expected;
                fputcsv($output, ['Variance', number_format($variance, 2)]);
            }
        }
        fputcsv($output, []);

        // Verifications
        if ($report && $report->verifications->count() > 0) {
            fputcsv($output, ['--- VERIFICATIONS ---']);
            fputcsv($output, ['Type', 'Description', 'Expected', 'Status', 'Verified By', 'Notes']);

            foreach ($report->verifications as $v) {
                fputcsv($output, [
                    ucfirst(str_replace('_', ' ', $v->verification_type)),
                    $v->item_description,
                    number_format($v->expected_amount, 2),
                    $v->is_verified ? 'Verified' : 'Pending',
                    $v->verifiedBy->name ?? '',
                    $v->notes
                ]);
            }
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        $filename = 'day_end_' . $date . '.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Ensure today's day-end report exists for the current user's branch.
     * Idempotent: returns the existing report if any. Only Admin / Super Admin
     * may auto-open. Skips creation when no prior closing balance is available.
     */
    public function ensureOpen(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->relationLoaded('role')) {
            $user->load('role');
        }

        if (!$user->isAdmin()) {
            return $this->success([
                'report'   => null,
                'created'  => false,
                'skipped'  => 'not_admin',
            ]);
        }

        $branchId = $user->branch_id;
        if (!$branchId) {
            return $this->success([
                'report'   => null,
                'created'  => false,
                'skipped'  => 'no_branch',
            ]);
        }

        $today = Carbon::today();

        $existing = DayEndReport::where('branch_id', $branchId)
            ->whereDate('report_date', $today)
            ->first();

        if ($existing) {
            return $this->success([
                'report'  => $existing,
                'created' => false,
            ]);
        }

        // Skip auto-open if there's no prior closing balance to carry forward.
        $prior = DayEndReport::where('branch_id', $branchId)
            ->whereDate('report_date', '<', $today)
            ->orderBy('report_date', 'desc')
            ->first();

        if (!$prior || $prior->closing_balance === null) {
            return $this->success([
                'report'   => null,
                'created'  => false,
                'skipped'  => 'no_prior_closing_balance',
            ]);
        }

        $stats = $this->calculateDayStats($branchId, $today);

        DB::beginTransaction();
        try {
            $report = DayEndReport::create([
                'branch_id'             => $branchId,
                'report_date'           => $today,
                'opening_balance'       => (float) $prior->closing_balance,
                'new_pledges_count'     => $stats['pledges']['count'],
                'new_pledges_amount'    => $stats['pledges']['total'],
                'new_pledges_cash'      => $stats['pledges']['cash'],
                'new_pledges_transfer'  => $stats['pledges']['transfer'],
                'renewals_count'        => $stats['renewals']['count'],
                'renewals_amount'       => $stats['renewals']['total'],
                'renewals_cash'         => $stats['renewals']['cash'],
                'renewals_transfer'     => $stats['renewals']['transfer'],
                'redemptions_count'     => $stats['redemptions']['count'],
                'redemptions_amount'    => $stats['redemptions']['total'],
                'redemptions_cash'      => $stats['redemptions']['cash'],
                'redemptions_transfer'  => $stats['redemptions']['transfer'],
                'items_in_count'        => $stats['items_in'],
                'items_out_count'       => $stats['items_out'],
                'status'                => 'open',
            ]);

            $this->createVerificationsForReport($report, $branchId, $today, $stats);

            DB::commit();

            return $this->success([
                'report'  => $report,
                'created' => true,
            ], 'Day auto-opened');
        } catch (\Throwable $e) {
            DB::rollBack();
            return $this->error('Failed to auto-open day: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Update opening balance on an open day-end report.
     * Admin / Super Admin only. Disallowed once the day is closed.
     */
    public function updateOpeningBalance(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        $user = $request->user();
        if (!$user->relationLoaded('role')) {
            $user->load('role');
        }
        if (!$user->isAdmin()) {
            return $this->error('Only Admin / Super Admin can edit opening balance', 403);
        }

        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Forbidden', 403);
        }

        if ($dayEndReport->status === 'closed') {
            return $this->error('Cannot edit opening balance on a closed day-end report', 422);
        }

        $validated = $request->validate([
            'opening_balance' => 'required|numeric|min:0',
        ]);

        $dayEndReport->update([
            'opening_balance' => (float) $validated['opening_balance'],
        ]);

        return $this->success(['report' => $dayEndReport->fresh()], 'Opening balance updated');
    }

    /**
     * List cash adjustments for a day-end report.
     */
    public function listCashAdjustments(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Forbidden', 403);
        }

        $adjustments = $dayEndReport->cashAdjustments()
            ->with(['createdBy:id,name', 'voidedBy:id,name'])
            ->orderBy('created_at')
            ->get();

        return $this->success([
            'adjustments' => $adjustments,
            'totals' => [
                'injections'  => (float) $adjustments->where('voided', false)->where('type', CashAdjustment::TYPE_INJECTION)->sum('amount'),
                'withdrawals' => (float) $adjustments->where('voided', false)->where('type', CashAdjustment::TYPE_WITHDRAWAL)->sum('amount'),
            ],
        ]);
    }

    /**
     * Create a cash adjustment (injection or withdrawal) on an open day-end report.
     */
    public function createCashAdjustment(Request $request, DayEndReport $dayEndReport): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Forbidden', 403);
        }

        if ($dayEndReport->status === 'closed') {
            return $this->error('Cannot adjust cash on a closed day-end report', 422);
        }

        $validated = $request->validate([
            'type'   => 'required|in:injection,withdrawal',
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string|max:255',
        ]);

        $adjustment = CashAdjustment::create([
            'day_end_report_id' => $dayEndReport->id,
            'branch_id'         => $dayEndReport->branch_id,
            'type'              => $validated['type'],
            'amount'            => $validated['amount'],
            'reason'            => $validated['reason'] ?? null,
            'created_by'        => $request->user()->id,
        ]);

        $adjustment->load('createdBy:id,name');

        return $this->success(['adjustment' => $adjustment], 'Cash adjustment recorded', 201);
    }

    /**
     * Void a cash adjustment (soft-cancel; preserves audit trail).
     */
    public function voidCashAdjustment(Request $request, DayEndReport $dayEndReport, CashAdjustment $cashAdjustment): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Forbidden', 403);
        }

        if ($cashAdjustment->day_end_report_id !== $dayEndReport->id) {
            return $this->error('Adjustment does not belong to this report', 404);
        }

        if ($dayEndReport->status === 'closed') {
            return $this->error('Cannot void adjustments on a closed day-end report', 422);
        }

        if ($cashAdjustment->voided) {
            return $this->error('Adjustment is already voided', 422);
        }

        $cashAdjustment->update([
            'voided'    => true,
            'voided_by' => $request->user()->id,
            'voided_at' => now(),
        ]);

        return $this->success(['adjustment' => $cashAdjustment->fresh()], 'Adjustment voided');
    }

    /**
     * Calculate day statistics
     */
    protected function calculateDayStats(int $branchId, $date): array
    {
        // Pledges
        $pledges = Pledge::where('branch_id', $branchId)
            ->whereDate('pledge_date', $date)
            ->with('payments')
            ->get();

        $pledgeStats = [
            'count' => $pledges->count(),
            'total' => $pledges->sum('loan_amount'),
            'cash' => $pledges->sum(fn($p) => $p->payments->sum('cash_amount')),
            'transfer' => $pledges->sum(fn($p) => $p->payments->sum('transfer_amount')),
        ];

        // Renewals
        $renewals = Renewal::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->get();

        $renewalStats = [
            'count' => $renewals->count(),
            'total' => $renewals->sum('total_payable'),
            'cash' => $renewals->sum('cash_amount'),
            'transfer' => $renewals->sum('transfer_amount'),
        ];

        // Redemptions
        $redemptions = Redemption::where('branch_id', $branchId)
            ->whereDate('created_at', $date)
            ->get();

        $redemptionStats = [
            'count' => $redemptions->count(),
            'total' => $redemptions->sum('total_payable'),
            'cash' => $redemptions->sum('cash_amount'),
            'transfer' => $redemptions->sum('transfer_amount'),
        ];

        // Items in (from pledges) - with purity breakdown
        $itemsInQuery = PledgeItem::whereHas('pledge', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('pledge_date', $date);
        });
        $itemsIn = $itemsInQuery->count();

        $itemsInByPurity = PledgeItem::whereHas('pledge', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('pledge_date', $date);
        })
        ->with('purity:id,code,name')
        ->get()
        ->groupBy(fn($item) => $item->purity->code ?? 'Unknown')
        ->map(fn($group) => [
            'count' => $group->count(),
            'weight' => round($group->sum('net_weight'), 3),
        ]);

        // Items out (from redemptions) - with purity breakdown
        $itemsOut = PledgeItem::whereHas('pledge.redemption', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('created_at', $date);
        })->count();

        $itemsOutByPurity = PledgeItem::whereHas('pledge.redemption', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('created_at', $date);
        })
        ->with('purity:id,code,name')
        ->get()
        ->groupBy(fn($item) => $item->purity->code ?? 'Unknown')
        ->map(fn($group) => [
            'count' => $group->count(),
            'weight' => round($group->sum('net_weight'), 3),
        ]);

        // Individual transaction details for detailed report
        $pledgesDetail = $pledges->map(function ($pledge) {
            $pledge->load(['customer:id,name', 'items.category:id,name_en']);
            $itemTypes = $pledge->items->pluck('category.name_en')->filter()->unique()->implode(', ') ?: 'Gold Item';
            return [
                'ref_no' => $pledge->pledge_no,
                'customer' => $pledge->customer->name ?? 'N/A',
                'item_type' => $itemTypes,
                'item_count' => $pledge->items->count(),
                'weight' => round((float)$pledge->total_weight, 3),
                'amount' => round((float)$pledge->loan_amount, 2),
            ];
        })->values();

        $redemptionsDetail = $redemptions->map(function ($redemption) {
            $redemption->load(['pledge.customer:id,name', 'pledge.items.category:id,name_en']);
            return [
                'ref_no' => $redemption->redemption_no ?? $redemption->pledge->pledge_no,
                'customer' => $redemption->pledge->customer->name ?? 'N/A',
                'item_count' => $redemption->pledge->items->count(),
                'weight' => round((float)$redemption->pledge->total_weight, 3),
                'principal' => round((float)$redemption->principal_amount, 2),
                'interest' => round((float)$redemption->interest_amount, 2),
                'total_paid' => round((float)$redemption->total_payable, 2),
            ];
        })->values();

        $renewalsDetail = $renewals->map(function ($renewal) {
            $renewal->load(['pledge.customer:id,name', 'pledge.items.category:id,name_en']);
            return [
                'ref_no' => $renewal->renewal_no ?? $renewal->pledge->pledge_no,
                'customer' => $renewal->pledge->customer->name ?? 'N/A',
                'item_count' => $renewal->pledge->items->count(),
                'weight' => round((float)$renewal->pledge->total_weight, 3),
                'interest_paid' => round((float)$renewal->total_payable, 2),
                'extension_months' => $renewal->renewal_months ?? 0,
            ];
        })->values();

        return [
            'pledges' => $pledgeStats,
            'renewals' => $renewalStats,
            'redemptions' => $redemptionStats,
            'items_in' => $itemsIn,
            'items_out' => $itemsOut,
            'items_in_by_purity' => $itemsInByPurity,
            'items_out_by_purity' => $itemsOutByPurity,
            'pledges_detail' => $pledgesDetail,
            'redemptions_detail' => $redemptionsDetail,
            'renewals_detail' => $renewalsDetail,
        ];
    }

    /**
     * Update verification status on report
     */
    protected function updateVerificationStatus(DayEndReport $report): void
    {
        $itemVerifications = $report->verifications()
            ->whereIn('verification_type', ['item_in', 'item_out'])
            ->get();

        $amountVerifications = $report->verifications()
            ->where('verification_type', 'amount')
            ->get();

        $allItemsVerified = $itemVerifications->every(fn($v) => $v->is_verified);
        $allAmountsVerified = $amountVerifications->every(fn($v) => $v->is_verified);

        $report->update([
            'all_items_verified' => $allItemsVerified,
            'all_amounts_verified' => $allAmountsVerified,
            'status' => ($allItemsVerified && $allAmountsVerified) ? 'pending_verification' : 'open',
        ]);
    }

    /**
     * Calculate purity breakdown for items in/out
     */
    protected function calculatePurityBreakdown(int $branchId, $date): array
    {
        $itemsInByPurity = PledgeItem::whereHas('pledge', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('pledge_date', $date);
        })
        ->with('purity:id,code,name')
        ->get()
        ->groupBy(fn($item) => $item->purity->code ?? 'Unknown')
        ->map(fn($group) => [
            'count' => $group->count(),
            'weight' => round($group->sum('net_weight'), 3),
        ]);

        $itemsOutByPurity = PledgeItem::whereHas('pledge.redemption', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('created_at', $date);
        })
        ->with('purity:id,code,name')
        ->get()
        ->groupBy(fn($item) => $item->purity->code ?? 'Unknown')
        ->map(fn($group) => [
            'count' => $group->count(),
            'weight' => round($group->sum('net_weight'), 3),
        ]);

        return [
            'items_in_by_purity' => $itemsInByPurity,
            'items_out_by_purity' => $itemsOutByPurity,
        ];
    }
}
