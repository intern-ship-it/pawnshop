<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
                'message' => 'No day-end report started yet for today',
            ]);
        }

        $report->load(['verifications', 'closedBy:id,name']);

        return $this->success($report);
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
            return $this->error('Report not found for this date', 404);
        }

        return $this->success($report);
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

            // Create report
            $report = DayEndReport::create([
                'branch_id' => $branchId,
                'report_date' => $today,
                'opening_balance' => $request->get('opening_balance', 0),
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

            // Create verification items for pledges (items in)
            $pledges = Pledge::where('branch_id', $branchId)
                ->whereDate('pledge_date', $today)
                ->with('items')
                ->get();

            foreach ($pledges as $pledge) {
                foreach ($pledge->items as $item) {
                    DayEndVerification::create([
                        'day_end_id' => $report->id,
                        'verification_type' => 'item_in',
                        'related_type' => 'PledgeItem',
                        'related_id' => $item->id,
                        'item_description' => sprintf('%s - %s', $pledge->pledge_no, $item->barcode),
                        'expected_amount' => $item->net_value,
                        'is_verified' => false,
                    ]);
                }
            }

            // Create verification items for redemptions (items out)
            $redemptions = Redemption::where('branch_id', $branchId)
                ->whereDate('created_at', $today)
                ->with('pledge.items')
                ->get();

            foreach ($redemptions as $redemption) {
                foreach ($redemption->pledge->items as $item) {
                    DayEndVerification::create([
                        'day_end_id' => $report->id,
                        'verification_type' => 'item_out',
                        'related_type' => 'PledgeItem',
                        'related_id' => $item->id,
                        'item_description' => sprintf('%s - %s', $redemption->pledge->pledge_no, $item->barcode),
                        'expected_amount' => $item->net_value,
                        'is_verified' => false,
                    ]);
                }
            }

            // Create amount verifications
            DayEndVerification::create([
                'day_end_id' => $report->id,
                'verification_type' => 'amount',
                'related_type' => 'cash_total',
                'item_description' => 'Total Cash',
                'expected_amount' => $stats['pledges']['cash'] + $stats['renewals']['cash'] + $stats['redemptions']['cash'],
                'is_verified' => false,
            ]);

            DayEndVerification::create([
                'day_end_id' => $report->id,
                'verification_type' => 'amount',
                'related_type' => 'transfer_total',
                'item_description' => 'Total Transfer',
                'expected_amount' => $stats['pledges']['transfer'] + $stats['renewals']['transfer'] + $stats['redemptions']['transfer'],
                'is_verified' => false,
            ]);

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
    public function verifyItem(Request $request, DayEndReport $dayEndReport, DayEndVerification $verification): JsonResponse
    {
        if (!$this->canAccessBranch($request, $dayEndReport->branch_id)) {
            return $this->error('Unauthorized', 403);
        }

        if ($verification->day_end_id !== $dayEndReport->id) {
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
        if ($dayEndReport->branch_id !== $request->user()->branch_id) {
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

        $dayEndReport->update([
            'status' => 'closed',
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
        if ($dayEndReport->branch_id !== $request->user()->branch_id) {
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
        if ($dayEndReport->branch_id !== $request->user()->branch_id) {
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

        // Items in (from pledges)
        $itemsIn = PledgeItem::whereHas('pledge', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('pledge_date', $date);
        })->count();

        // Items out (from redemptions)
        $itemsOut = PledgeItem::whereHas('pledge.redemption', function ($q) use ($branchId, $date) {
            $q->where('branch_id', $branchId)->whereDate('created_at', $date);
        })->count();

        return [
            'pledges' => $pledgeStats,
            'renewals' => $renewalStats,
            'redemptions' => $redemptionStats,
            'items_in' => $itemsIn,
            'items_out' => $itemsOut,
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
}
