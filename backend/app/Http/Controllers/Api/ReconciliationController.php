<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reconciliation;
use App\Models\ReconciliationItem;
use App\Models\PledgeItem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReconciliationController extends Controller
{
    /**
     * List all reconciliations
     */
    public function index(Request $request): JsonResponse
    {
        // No branch filter
        $query = Reconciliation::with(['startedBy:id,name', 'completedBy:id,name']);

        // Filter by status
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        // Filter by type
        if ($type = $request->get('type')) {
            $query->where('reconciliation_type', $type);
        }

        $reconciliations = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($reconciliations);
    }

    /**
     * Check for existing in-progress reconciliation
     */
    public function checkInProgress(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        
        $existing = Reconciliation::activeInProgress()
            ->where('branch_id', $branchId)
            ->first();

        return $this->success([
            'has_in_progress' => !is_null($existing),
            'reconciliation' => $existing,
        ]);
    }

    /**
     * Start new reconciliation
     */
    public function start(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        $userId = $request->user()->id;

        $validated = $request->validate([
            'reconciliation_type' => 'required|in:daily,weekly,monthly,adhoc',
            'notes' => 'nullable|string',
            'force_start' => 'nullable|boolean', // Allow forcing start by cancelling existing
        ]);

        // Auto-cancel any expired reconciliations first
        Reconciliation::expired()
            ->where('branch_id', $branchId)
            ->get()
            ->each(function ($rec) {
                $rec->update([
                    'status' => 'cancelled',
                    'notes' => ($rec->notes ? $rec->notes . ' | ' : '') . 'Auto-cancelled: exceeded 4-hour time limit',
                ]);
            });

        // Check for ACTIVE (non-expired) in-progress reconciliation
        $existing = Reconciliation::activeInProgress()
            ->where('branch_id', $branchId)
            ->first();

        if ($existing) {
            // If force_start is true, cancel the existing reconciliation
            if ($validated['force_start'] ?? false) {
                $existing->update([
                    'status' => 'cancelled',
                    'notes' => ($existing->notes ? $existing->notes . ' | ' : '') . 'Auto-cancelled to start new reconciliation',
                ]);
                
                $this->info('Previous reconciliation cancelled automatically');
            } else {
                // Return the existing reconciliation details with error
                return $this->error('There is already a reconciliation in progress for this branch', 422, [
                    'existing_reconciliation' => $existing->load('startedBy:id,name'),
                    'can_force_start' => true,
                ]);
            }
        }

        DB::beginTransaction();

        try {
            // Count expected items (branch-specific)
            $expectedItems = PledgeItem::whereHas('pledge', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)
                  ->where('status', 'active');
            })
                ->where('status', 'stored')
                ->count();

            // Generate reconciliation number
            $reconciliationNo = sprintf(
                'RCN-%s-%s-%04d',
                $request->user()->branch->code,
                date('Ymd'),
                Reconciliation::where('branch_id', $branchId)->whereDate('created_at', Carbon::today())->count() + 1
            );

            $reconciliation = Reconciliation::create([
                'branch_id' => $branchId,
                'reconciliation_no' => $reconciliationNo,
                'reconciliation_type' => $validated['reconciliation_type'],
                'expected_items' => $expectedItems,
                'scanned_items' => 0,
                'matched_items' => 0,
                'missing_items' => 0,
                'unexpected_items' => 0,
                'status' => 'in_progress',
                'started_at' => now(),
                'started_by' => $userId,
                'expires_at' => now()->addHours(4),
                'notes' => $validated['notes'] ?? null,
            ]);

            DB::commit();

            return $this->success($reconciliation, 'Reconciliation started', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to start reconciliation: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Force cancel any stuck in-progress reconciliation for this branch
     */
    public function forceCancel(Request $request): JsonResponse
    {
        $branchId = $request->user()->branch_id;
        
        $existing = Reconciliation::where('status', 'in_progress')
            ->where('branch_id', $branchId)
            ->first();

        if (!$existing) {
            return $this->error('No in-progress reconciliation found', 404);
        }

        $existing->update([
            'status' => 'cancelled',
            'notes' => ($existing->notes ? $existing->notes . ' | ' : '') . 'Force cancelled by user',
        ]);

        return $this->success(null, 'Reconciliation cancelled successfully');
    }

    /**
     * Scan item barcode
     */
    public function scan(Request $request, Reconciliation $reconciliation): JsonResponse
    {
        // No branch check

        if ($reconciliation->status !== 'in_progress') {
            return $this->error('Reconciliation is not in progress', 422);
        }

        $validated = $request->validate([
            'barcode' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        $userId = $request->user()->id;
        $branchId = $reconciliation->branch_id;

        // Check if barcode already scanned in this reconciliation
        $alreadyScanned = ReconciliationItem::where('reconciliation_id', $reconciliation->id)
            ->where('barcode_scanned', $validated['barcode'])
            ->exists();

        if ($alreadyScanned) {
            return $this->error('This item has already been scanned', 422);
        }

        // Find the item by barcode OR by pledge_no (more flexible scanning)
        $barcode = $validated['barcode'];

        // First try exact barcode match
        $item = PledgeItem::whereHas('pledge', function ($q) use ($branchId) {
            $q->where('branch_id', $branchId);
        })
            ->where('barcode', $barcode)
            ->first();

        // If not found, try matching by pledge_no (in case user scanned pledge receipt)
        if (!$item) {
            $item = PledgeItem::whereHas('pledge', function ($q) use ($branchId, $barcode) {
                $q->where('branch_id', $branchId)
                    ->where('pledge_no', $barcode);
            })
                ->first();
        }

        $status = 'unexpected';
        $pledgeItemId = null;

        if ($item) {
            $pledgeItemId = $item->id;

            if ($item->status === 'stored' && $item->pledge->status === 'active') {
                $status = 'matched';
            } else {
                // Item exists but shouldn't be in storage
                $status = 'unexpected';
            }
        }

        // Create scan record
        ReconciliationItem::create([
            'reconciliation_id' => $reconciliation->id,
            'pledge_item_id' => $pledgeItemId,
            'barcode_scanned' => $validated['barcode'],
            'status' => $status,
            'scanned_at' => now(),
            'scanned_by' => $userId,
            'notes' => $validated['notes'] ?? null,
        ]);

        // Update counts
        $reconciliation->increment('scanned_items');
        if ($status === 'matched') {
            $reconciliation->increment('matched_items');
        } elseif ($status === 'unexpected') {
            $reconciliation->increment('unexpected_items');
        }

        return $this->success([
            'status' => $status,
            'item' => $item ? $item->load(['pledge.customer:id,name', 'category', 'purity']) : null,
            'message' => match ($status) {
                'matched' => 'Item verified successfully',
                'unexpected' => $item ? 'Item found but should not be in storage' : 'Unknown barcode',
            },
        ]);
    }

    /**
     * Complete reconciliation
     */
    public function complete(Request $request, Reconciliation $reconciliation): JsonResponse
    {
        // No branch check

        if ($reconciliation->status !== 'in_progress') {
            return $this->error('Reconciliation is not in progress', 422);
        }

        $userId = $request->user()->id;
        $branchId = $reconciliation->branch_id;

        // Calculate missing items
        $expectedBarcodes = PledgeItem::whereHas('pledge', function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)->where('status', 'active');
        })
            ->where('status', 'stored')
            ->pluck('barcode')
            ->toArray();

        $scannedBarcodes = ReconciliationItem::where('reconciliation_id', $reconciliation->id)
            ->where('status', 'matched')
            ->pluck('barcode_scanned')
            ->toArray();

        $missingBarcodes = array_diff($expectedBarcodes, $scannedBarcodes);
        $missingCount = count($missingBarcodes);

        // Record missing items
        foreach ($missingBarcodes as $barcode) {
            $item = PledgeItem::where('barcode', $barcode)->first();

            ReconciliationItem::create([
                'reconciliation_id' => $reconciliation->id,
                'pledge_item_id' => $item?->id,
                'barcode_scanned' => $barcode,
                'status' => 'missing',
                'notes' => 'Not scanned during reconciliation',
            ]);
        }

        // Update reconciliation
        $reconciliation->update([
            'missing_items' => $missingCount,
            'status' => 'completed',
            'completed_at' => now(),
            'completed_by' => $userId,
            'notes' => $request->get('notes', $reconciliation->notes),
        ]);

        $reconciliation->load(['items.pledgeItem.pledge.customer:id,name']);

        return $this->success([
            'reconciliation' => $reconciliation,
            'summary' => [
                'expected' => $reconciliation->expected_items,
                'scanned' => $reconciliation->scanned_items,
                'matched' => $reconciliation->matched_items,
                'missing' => $reconciliation->missing_items,
                'unexpected' => $reconciliation->unexpected_items,
            ],
        ], 'Reconciliation completed');
    }

    /**
     * Cancel reconciliation
     */
    public function cancel(Request $request, Reconciliation $reconciliation): JsonResponse
    {
        // No branch check

        if ($reconciliation->status !== 'in_progress') {
            return $this->error('Only in-progress reconciliations can be cancelled', 422);
        }

        $reconciliation->update([
            'status' => 'cancelled',
            'notes' => $request->get('reason', 'Cancelled by user'),
        ]);

        return $this->success(null, 'Reconciliation cancelled');
    }

    /**
     * Get reconciliation details
     */
    public function show(Request $request, Reconciliation $reconciliation): JsonResponse
    {
        // No branch check

        $reconciliation->load([
            'items.pledgeItem.pledge.customer:id,name',
            'items.pledgeItem.category',
            'items.scannedBy:id,name',
            'startedBy:id,name',
            'completedBy:id,name',
        ]);

        return $this->success($reconciliation);
    }

    /**
     * Get reconciliation report
     */
    public function report(Request $request, Reconciliation $reconciliation): JsonResponse
    {
        // No branch check

        if ($reconciliation->status !== 'completed') {
            return $this->error('Reconciliation not yet completed', 422);
        }

        $items = $reconciliation->items()
            ->with(['pledgeItem.pledge.customer:id,name', 'pledgeItem.category', 'pledgeItem.vault', 'scannedBy:id,name'])
            ->get()
            ->groupBy('status');

        return $this->success([
            'reconciliation' => $reconciliation,
            'summary' => [
                'expected' => $reconciliation->expected_items,
                'scanned' => $reconciliation->scanned_items,
                'matched' => $reconciliation->matched_items,
                'missing' => $reconciliation->missing_items,
                'unexpected' => $reconciliation->unexpected_items,
                'accuracy_rate' => $reconciliation->expected_items > 0
                    ? round(($reconciliation->matched_items / $reconciliation->expected_items) * 100, 2)
                    : 100,
            ],
            'items' => [
                'matched' => $items->get('matched', collect()),
                'missing' => $items->get('missing', collect()),
                'unexpected' => $items->get('unexpected', collect()),
            ],
        ]);
    }
}